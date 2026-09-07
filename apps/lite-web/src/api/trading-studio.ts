import type { TradingCommercialDirectionSetV1 } from '@markorbit/contracts/trading-commercial-direction';
import type { TradingDirectionSelectionV1 } from '@markorbit/contracts/trading-direction-selection';
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

  const parsed = (await response.json().catch(() => ({}))) as TradingStudioState & {
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

export function createTradingStudioClient(workspaceId: string): TradingStudioClient {
  return {
    loadState: (studioRunId) => loadState(workspaceId, studioRunId)
  };
}
