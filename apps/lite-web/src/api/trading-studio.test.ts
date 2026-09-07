import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';
import { createTradingStudioClient, TradingStudioHttpError } from './trading-studio.js';

const workspaceId = '81818181-8181-4818-8818-818181818181';
const studioRunId = 'trading-studio-run_client' as TradingStudioRunV1['studioRunId'];

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Trading Studio API client', () => {
  it('loads one composed state through the authenticated Gateway read boundary', async () => {
    const state = {
      run: { studioRunId },
      directionSet: { commercialDirectionSetId: 'commercial-direction-set_client', version: 1 },
      selection: null
    };
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      expect(requestUrl(input)).toBe(
        `http://127.0.0.1:4000/api/lite/trading/studio-runs/${studioRunId}/state`
      );
      expect(init).toMatchObject({
        method: 'GET',
        credentials: 'include',
        headers: { 'x-markorbit-workspace-id': workspaceId }
      });
      expect(init?.body).toBeUndefined();
      return Promise.resolve(
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createTradingStudioClient(workspaceId).loadState(studioRunId)).resolves.toEqual(
      state
    );
  });

  it('preserves owner currentness conflicts for the future Studio surface', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'STUDIO_STATE_VERSION_CONFLICT',
              message: 'Selection references another version.',
              retryable: false
            }),
            { status: 409, headers: { 'content-type': 'application/json' } }
          )
        )
      )
    );

    await expect(createTradingStudioClient(workspaceId).loadState(studioRunId)).rejects.toEqual(
      new TradingStudioHttpError(
        409,
        'STUDIO_STATE_VERSION_CONFLICT',
        'Selection references another version.',
        false
      )
    );
  });
});
