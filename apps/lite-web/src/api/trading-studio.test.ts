import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateTradingDirectionSelectionCommandV1 } from '@markorbit/contracts/trading-direction-selection';
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

  it('records only an explicit exact-version Selection with authenticated mutation headers', async () => {
    const command: CreateTradingDirectionSelectionCommandV1 = {
      schemaVersion: 1,
      directionSetId: 'commercial-direction-set_client',
      expectedDirectionSetVersion: 2,
      selectedDirectionId: 'trading-ai-derived_commercial-direction_client-b',
      expectedDirectionVersion: 3,
      idempotencyKey: 'select-direction-client-b',
      correlationId: 'correlation_selection-client-b'
    };
    const selection = {
      directionSelectionId: 'trading-direction-selection_client',
      selectedDirection: { id: command.selectedDirectionId, version: 3 }
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-selection' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
      .mockImplementationOnce((input: string | URL | Request, init?: RequestInit) => {
        expect(requestUrl(input)).toBe(
          'http://127.0.0.1:4000/api/lite/trading/direction-sets/commercial-direction-set_client/selection'
        );
        expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
        const headers = new Headers(init?.headers);
        expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
        expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-selection');
        expect(headers.get('idempotency-key')).toBe(command.idempotencyKey);
        expect(headers.get('x-correlation-id')).toBe(command.correlationId);
        expect(JSON.parse(init?.body as string)).toEqual({
          expectedDirectionSetVersion: 2,
          selectedDirectionId: command.selectedDirectionId,
          expectedDirectionVersion: 3
        });
        return Promise.resolve(
          new Response(JSON.stringify({ selection }), {
            status: 201,
            headers: { 'content-type': 'application/json' }
          })
        );
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createTradingStudioClient(workspaceId).selectDirection(command)).resolves.toEqual(
      selection
    );
  });

  it('preserves owner Selection conflicts for durable reload handling', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ csrfToken: 'csrf-selection' }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              code: 'DIRECTION_SET_VERSION_CONFLICT',
              message: 'Selection targets a stale Direction Set.',
              retryable: false
            }),
            { status: 409, headers: { 'content-type': 'application/json' } }
          )
        )
    );

    await expect(
      createTradingStudioClient(workspaceId).selectDirection({
        schemaVersion: 1,
        directionSetId: 'commercial-direction-set_client',
        expectedDirectionSetVersion: 1,
        selectedDirectionId: 'trading-ai-derived_commercial-direction_client-a',
        expectedDirectionVersion: 1,
        idempotencyKey: 'select-direction-stale',
        correlationId: 'correlation_selection-stale'
      })
    ).rejects.toEqual(
      new TradingStudioHttpError(
        409,
        'DIRECTION_SET_VERSION_CONFLICT',
        'Selection targets a stale Direction Set.',
        false
      )
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
