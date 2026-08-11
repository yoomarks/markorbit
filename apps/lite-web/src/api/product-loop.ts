import type {
  LiteTodaySnapshot,
  PreparedActionJourney,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export class TodayHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'TodayHttpError';
  }
}

export interface TodayClient {
  loadToday(): Promise<LiteTodaySnapshot>;
  loadPreparedAction(preparedActionId: string): Promise<PreparedActionJourney>;
  prepareContent(recommendation: Readonly<TodayRecommendation>): Promise<PreparedActionJourney>;
  confirm(journey: Readonly<PreparedActionJourney>): Promise<PreparedActionJourney>;
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const value = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !value.csrfToken)
    throw new TodayHttpError(
      response.status || 503,
      value.code ?? 'AUTHENTICATION_REQUIRED',
      value.message ?? 'An authenticated session is required.'
    );
  return value.csrfToken;
}

async function request<T>(
  path: string,
  workspaceId: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  idempotencyKey?: string
): Promise<T> {
  const csrf = method === 'GET' ? '' : await csrfToken();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        ...(csrf ? { 'x-markorbit-csrf-token': csrf } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      ...(method === 'GET'
        ? {}
        : { body: JSON.stringify({ workspaceId, ...(body as Record<string, unknown>) }) })
    });
  } catch (cause) {
    throw new TodayHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Lite Today is temporarily unavailable.',
      {
        cause: cause instanceof Error ? cause.message : 'network failure'
      }
    );
  }
  const parsed: unknown = await response.json().catch(() => ({}));
  const value = parsed as T & {
    code?: string;
    message?: string;
    details?: Readonly<Record<string, unknown>>;
  };
  if (!response.ok)
    throw new TodayHttpError(
      response.status,
      value.code ?? 'TODAY_REQUEST_FAILED',
      value.message ?? 'Lite Today request failed.',
      value.details
    );
  return value;
}

export function createTodayClient(workspaceId: string): TodayClient {
  return {
    loadToday: () => request<LiteTodaySnapshot>('/api/lite/today', workspaceId),
    loadPreparedAction: (preparedActionId) =>
      request<PreparedActionJourney>(
        `/api/lite/prepared-actions/${encodeURIComponent(preparedActionId)}`,
        workspaceId
      ),
    prepareContent: (recommendation) =>
      request<PreparedActionJourney>(
        `/api/lite/today/${encodeURIComponent(recommendation.todayRecommendationId)}/prepared-actions`,
        workspaceId,
        'POST',
        {
          recommendationVersion: recommendation.version,
          expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
          plan: {
            kind: 'PREPARE_CONTENT',
            title: recommendation.title,
            rationale: recommendation.explanation
          }
        },
        `prepare:${recommendation.todayRecommendationId}:${recommendation.version}`
      ),
    confirm: (journey) =>
      request<PreparedActionJourney>(
        `/api/lite/prepared-actions/${encodeURIComponent(journey.preparedAction.preparedActionId)}/confirm`,
        workspaceId,
        'POST',
        {
          preparedActionVersion: journey.preparedAction.version,
          expectedPreparedActionFingerprintSha256:
            journey.preparedAction.preparedActionFingerprintSha256,
          acknowledgedEffect: journey.preparedAction.confirmationEffect
        },
        `confirm:${journey.preparedAction.preparedActionId}:${journey.preparedAction.version}`
      )
  };
}
