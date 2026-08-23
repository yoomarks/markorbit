import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDailyWorkspaceClient } from './daily-workspace.js';

const workspaceId = '71717171-7171-4717-8717-717171717171';

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

describe('Daily Workspace aggregate client', () => {
  it('loads SEE, CREATE and MOVE through the single authenticated Gateway read surface', async () => {
    const snapshot = {
      schemaVersion: 1 as const,
      workspaceId,
      subjectUserId: 'user_daily_workspace',
      generatedAt: '2026-08-24T00:00:00.000Z',
      see: { orbitItems: [] },
      create: { contentPicks: [] },
      move: { todayItems: [] },
      partial: false,
      warnings: [],
      executionAuthorized: false as const,
      externalPublishExecuted: false as const,
      officialTruthCreated: false as const
    };
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      expect(requestUrl(input)).toBe('http://127.0.0.1:4000/api/lite/daily-workspace');
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      expect(init?.credentials).toBe('include');
      expect(init?.headers).toMatchObject({
        'x-markorbit-workspace-id': workspaceId
      });
      return Promise.resolve(jsonResponse(snapshot));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createDailyWorkspaceClient(workspaceId).loadWorkspace()).resolves.toEqual(
      snapshot
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the aggregate partial-warning contract without manufacturing success', async () => {
    const partial = {
      schemaVersion: 1 as const,
      workspaceId,
      subjectUserId: 'user_daily_workspace',
      generatedAt: '2026-08-24T00:00:00.000Z',
      see: { orbitItems: [] },
      create: { contentPicks: [] },
      move: { todayItems: [] },
      partial: true,
      warnings: ['MOVE_UNAVAILABLE'],
      executionAuthorized: false as const,
      externalPublishExecuted: false as const,
      officialTruthCreated: false as const
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(partial))));

    const result = await createDailyWorkspaceClient(workspaceId).loadWorkspace();
    expect(result.partial).toBe(true);
    expect(result.warnings).toEqual(['MOVE_UNAVAILABLE']);
    expect(result.executionAuthorized).toBe(false);
    expect(result.externalPublishExecuted).toBe(false);
    expect(result.officialTruthCreated).toBe(false);
  });
});
