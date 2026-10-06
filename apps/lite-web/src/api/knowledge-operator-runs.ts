export type KnowledgeOperatorRunReceipt = Readonly<{
  replayed: boolean;
  record: Readonly<{
    run: Readonly<{ id: string }>;
    job?: Readonly<{ id: string }>;
    execution?: Readonly<{ id: string }>;
  }>;
}>;

type ErrorPayload = Readonly<{
  code?: string;
  message?: string;
  error?: Readonly<{ code?: string; message?: string }>;
}>;

export class KnowledgeOperatorRunHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'KnowledgeOperatorRunHttpError';
  }
}

export interface KnowledgeOperatorRunClient {
  dispatch(
    input: Readonly<{ planId: string; idempotencyKey: string }>
  ): Promise<KnowledgeOperatorRunReceipt>;
}

function errorFrom(status: number, payload: ErrorPayload, fallback: string) {
  return new KnowledgeOperatorRunHttpError(
    status || 503,
    payload.code ?? payload.error?.code ?? 'KNOWLEDGE_OPERATOR_RUN_REQUEST_FAILED',
    payload.message ?? payload.error?.message ?? fallback
  );
}

async function currentCsrf(baseUrl: string, fetchImpl: typeof fetch): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  } catch {
    throw new KnowledgeOperatorRunHttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication is unavailable.'
    );
  }
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload & {
    csrfToken?: string;
  };
  if (!response.ok || !payload.csrfToken)
    throw errorFrom(response.status, payload, 'A current authenticated session is required.');
  return payload.csrfToken;
}

export function createKnowledgeOperatorRunClient(
  workspaceId: string,
  options: Readonly<{ baseUrl?: string; fetchImpl?: typeof fetch }> = {}
): KnowledgeOperatorRunClient {
  const baseUrl = (
    options.baseUrl ??
    import.meta.env['VITE_LITE_GATEWAY_URL'] ??
    'http://127.0.0.1:4000'
  ).replace(/\/$/u, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    dispatch: async ({ planId, idempotencyKey }) => {
      const csrf = await currentCsrf(baseUrl, fetchImpl);
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/api/knowledge/operator-runs`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-workspace-id': workspaceId,
            'x-markorbit-csrf-token': csrf,
            'idempotency-key': idempotencyKey
          },
          body: JSON.stringify({ planId })
        });
      } catch {
        throw new KnowledgeOperatorRunHttpError(
          503,
          'KNOWLEDGE_RUNTIME_UNAVAILABLE',
          'Knowledge runtime is unavailable.'
        );
      }
      const payload = (await response.json().catch(() => ({}))) as
        KnowledgeOperatorRunReceipt | ErrorPayload;
      if (!response.ok)
        throw errorFrom(
          response.status,
          payload as ErrorPayload,
          'Knowledge operator run dispatch failed.'
        );
      return payload as KnowledgeOperatorRunReceipt;
    }
  };
}
