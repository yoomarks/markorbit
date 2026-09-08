import type { TradingCommercialDirectionSetV1 } from '@markorbit/contracts/trading-commercial-direction';
import type {
  CreateTradingDirectionSelectionCommandV1,
  TradingDirectionSelectionV1
} from '@markorbit/contracts/trading-direction-selection';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export interface TradingStudioState {
  readonly run: Readonly<TradingStudioRunV1>;
  readonly directionSet: Readonly<TradingCommercialDirectionSetV1> | null;
  readonly selection: Readonly<TradingDirectionSelectionV1> | null;
}

export class TradingStudioHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'TradingStudioHttpError';
  }
}

export interface TradingStudioClient {
  loadState(studioRunId: TradingStudioRunV1['studioRunId']): Promise<TradingStudioState>;
  selectDirection(
    command: Readonly<CreateTradingDirectionSelectionCommandV1>
  ): Promise<Readonly<TradingDirectionSelectionV1>>;
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const value = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !value.csrfToken)
    throw new TradingStudioHttpError(
      response.status || 503,
      value.code ?? 'AUTHENTICATION_REQUIRED',
      value.message ?? 'An authenticated session is required.'
    );
  return value.csrfToken;
}

async function parse<T>(response: Response): Promise<T> {
  const parsed = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  if (!response.ok)
    throw new TradingStudioHttpError(
      response.status,
      parsed.code ?? 'TRADING_STUDIO_REQUEST_FAILED',
      parsed.message ?? 'Trading Studio request failed.',
      parsed.retryable ?? response.status >= 500
    );
  return parsed;
}

async function loadState(
  workspaceId: string,
  studioRunId: TradingStudioRunV1['studioRunId']
): Promise<TradingStudioState> {
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl}/api/lite/trading/studio-runs/${encodeURIComponent(studioRunId)}/state`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-workspace-id': workspaceId
        }
      }
    );
  } catch {
    throw new TradingStudioHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Trading Studio is temporarily unavailable.',
      true
    );
  }

  return parse<TradingStudioState>(response);
}

export function createTradingStudioClient(workspaceId: string): TradingStudioClient {
  return {
    loadState: (studioRunId) => loadState(workspaceId, studioRunId),
    async selectDirection(command) {
      const csrf = await csrfToken();
      let response: Response;
      try {
        response = await fetch(
          `${baseUrl}/api/lite/trading/direction-sets/${encodeURIComponent(command.directionSetId)}/selection`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
              'x-markorbit-workspace-id': workspaceId,
              'x-markorbit-csrf-token': csrf,
              'idempotency-key': command.idempotencyKey,
              'x-correlation-id': command.correlationId
            },
            body: JSON.stringify({
              expectedDirectionSetVersion: command.expectedDirectionSetVersion,
              selectedDirectionId: command.selectedDirectionId,
              expectedDirectionVersion: command.expectedDirectionVersion
            })
          }
        );
      } catch {
        throw new TradingStudioHttpError(
          503,
          'DOWNSTREAM_UNAVAILABLE',
          'Trading Studio is temporarily unavailable.',
          true
        );
      }
      const result = await parse<{ selection: Readonly<TradingDirectionSelectionV1> }>(response);
      return result.selection;
    }
  };
}
