import type {
  AuthorizationAuthorityConsequences,
  ExecutionRelease,
  FilingAuthorizationId,
  FilingExecutionChannel,
  FilingExecutionTaskDraft
} from '@markorbit/contracts';

export class ExecutionHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ExecutionHttpError';
  }
}

export interface ExecutionMutationResponse<T> {
  consequences: AuthorizationAuthorityConsequences;
  executionRelease?: T;
  filingExecutionTaskDraft?: T;
  releaseResult?: T;
}

export interface LiteExecutionClient {
  createRelease(command: {
    filingAuthorizationId: FilingAuthorizationId;
    filingAuthorizationVersion: number;
    requestedExecutionChannel: FilingExecutionChannel;
    idempotencyKey: string;
  }): Promise<{
    executionRelease: ExecutionRelease;
    consequences: AuthorizationAuthorityConsequences;
  }>;
  listReleases(): Promise<{
    executionReleases: ExecutionRelease[];
    consequences: AuthorizationAuthorityConsequences;
  }>;
  getRelease(id: string): Promise<{
    executionRelease: ExecutionRelease;
    consequences: AuthorizationAuthorityConsequences;
  }>;
  evaluateRelease(id: string): Promise<{
    executionRelease: ExecutionRelease;
    consequences: AuthorizationAuthorityConsequences;
  }>;
  updateAssignment(
    id: string,
    command: Readonly<{ expectedVersion: number }>
  ): Promise<{
    executionRelease: ExecutionRelease;
    consequences: AuthorizationAuthorityConsequences;
  }>;
  release(
    id: string,
    command: Readonly<{ rationale: string; idempotencyKey: string }>
  ): Promise<{
    releaseResult: { release: ExecutionRelease; taskDraft: FilingExecutionTaskDraft };
    consequences: AuthorizationAuthorityConsequences;
  }>;
  withdrawRelease(id: string): Promise<{
    executionRelease: ExecutionRelease;
    consequences: AuthorizationAuthorityConsequences;
  }>;
  getTaskDraft(id: string): Promise<{
    filingExecutionTaskDraft: FilingExecutionTaskDraft;
    consequences: AuthorizationAuthorityConsequences;
  }>;
  getTaskDraftForRelease(id: string): Promise<{
    filingExecutionTaskDraft: FilingExecutionTaskDraft;
    consequences: AuthorizationAuthorityConsequences;
  }>;
}

type ExecutionMethod = 'GET' | 'POST' | 'PATCH';
type ErrorPayload = {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
};

function executionError(
  status: number,
  value: ErrorPayload,
  fallbackCode: string,
  fallbackMessage: string
) {
  return new ExecutionHttpError(
    status || 503,
    value.code ?? value.error?.code ?? fallbackCode,
    value.message ?? value.error?.message ?? fallbackMessage
  );
}

async function csrfToken(baseUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  } catch (cause) {
    throw new ExecutionHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      cause instanceof Error ? cause.message : 'Authentication service is unavailable.'
    );
  }
  const value = (await response.json().catch(() => ({}))) as ErrorPayload & { csrfToken?: string };
  if (!response.ok || !value.csrfToken)
    throw executionError(
      response.status,
      value,
      'AUTHENTICATION_REQUIRED',
      'An authenticated session is required.'
    );
  return value.csrfToken;
}

async function request<T>(
  baseUrl: string,
  workspaceId: string,
  path: string,
  method: ExecutionMethod = 'GET',
  body?: unknown,
  idempotencyKey?: string
): Promise<T> {
  const csrf = method === 'GET' ? '' : await csrfToken(baseUrl);
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
      ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) })
    });
  } catch (cause) {
    throw new ExecutionHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      cause instanceof Error ? cause.message : 'Execution governance is temporarily unavailable.'
    );
  }
  const value = (await response.json().catch(() => ({}))) as T & ErrorPayload;
  if (!response.ok)
    throw executionError(
      response.status,
      value,
      'EXECUTION_REQUEST_FAILED',
      'Execution governance request failed.'
    );
  return value as T;
}

export function createLiteExecutionClient(
  workspaceId: string,
  baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000'
): LiteExecutionClient {
  return {
    createRelease: (command) => {
      const { idempotencyKey, ...body } = command;
      return request(
        baseUrl,
        workspaceId,
        '/api/execution/execution-releases',
        'POST',
        body,
        idempotencyKey
      );
    },
    listReleases: () => request(baseUrl, workspaceId, '/api/execution/execution-releases'),
    getRelease: (id) =>
      request(
        baseUrl,
        workspaceId,
        `/api/execution/execution-releases/${encodeURIComponent(id)}`
      ),
    evaluateRelease: (id) =>
      request(
        baseUrl,
        workspaceId,
        `/api/execution/execution-releases/${encodeURIComponent(id)}/evaluate`,
        'POST',
        {}
      ),
    updateAssignment: (id, command) =>
      request(
        baseUrl,
        workspaceId,
        `/api/execution/execution-releases/${encodeURIComponent(id)}/assignment`,
        'PATCH',
        { expectedVersion: command.expectedVersion }
      ),
    release: (id, command) => {
      const { idempotencyKey, rationale } = command;
      return request(
        baseUrl,
        workspaceId,
        `/api/execution/execution-releases/${encodeURIComponent(id)}/release`,
        'POST',
        { rationale },
        idempotencyKey
      );
    },
    withdrawRelease: (id) =>
      request(
        baseUrl,
        workspaceId,
        `/api/execution/execution-releases/${encodeURIComponent(id)}/withdraw`,
        'POST',
        {}
      ),
    getTaskDraft: (id) =>
      request(
        baseUrl,
        workspaceId,
        `/api/execution/filing-task-drafts/${encodeURIComponent(id)}`
      ),
    getTaskDraftForRelease: (id) =>
      request(
        baseUrl,
        workspaceId,
        `/api/execution/execution-releases/${encodeURIComponent(id)}/filing-task-draft`
      )
  };
}
