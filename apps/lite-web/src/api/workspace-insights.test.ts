import { afterEach, describe, expect, it, vi } from 'vitest';
import { insightsWorkspaceId, workspaceInsightsFixture } from '../features/insights/fixtures.js';
import {
  createWorkspaceInsightsClient,
  type WorkspaceInsightsHttpError
} from './workspace-insights.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('Workspace Insights analytics client', () => {
  it('loads the exact authenticated Workspace owner snapshot', async () => {
    const fixture = workspaceInsightsFixture();
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      expect(requestUrl(input)).toBe(
        'http://127.0.0.1:4000/api/lite/analytics/product-loop-conversions'
      );
      expect(init?.credentials).toBe('include');
      expect(init?.headers).toMatchObject({
        'x-markorbit-workspace-id': insightsWorkspaceId
      });
      return Promise.resolve(jsonResponse(fixture));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createWorkspaceInsightsClient(insightsWorkspaceId).load()).resolves.toEqual(
      fixture
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 503])('keeps owner failure %s distinct from zero metrics', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ code: 'OWNER_UNAVAILABLE', message: 'owner read failed' }, status)
        )
      )
    );
    await expect(createWorkspaceInsightsClient(insightsWorkspaceId).load()).rejects.toMatchObject({
      name: 'WorkspaceInsightsHttpError',
      status,
      code: 'OWNER_UNAVAILABLE',
      message: 'owner read failed'
    } satisfies Partial<WorkspaceInsightsHttpError>);
  });

  it('fails closed when owner data does not match the requested Workspace', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            ...workspaceInsightsFixture(),
            workspaceId: '59595959-5959-4595-8959-595959595959'
          })
        )
      )
    );

    await expect(createWorkspaceInsightsClient(insightsWorkspaceId).load()).rejects.toMatchObject({
      status: 502,
      code: 'MALFORMED_ANALYTICS_SNAPSHOT'
    });
  });

  it('fails closed when a zero denominator is disguised as a percentage', async () => {
    const fixture = workspaceInsightsFixture();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            ...fixture,
            content: {
              ...fixture.content,
              rates: {
                ...fixture.content.rates,
                opportunityToDraft: { numerator: 0, denominator: 0, rate: 0 }
              }
            }
          })
        )
      )
    );

    await expect(createWorkspaceInsightsClient(insightsWorkspaceId).load()).rejects.toMatchObject({
      code: 'MALFORMED_ANALYTICS_SNAPSHOT'
    });
  });
});
