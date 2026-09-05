import type {
  AuthorizationAuthorityConsequences,
  ExecutionRelease,
  FilingAuthorizationId,
  FilingExecutionChannel,
  FilingExecutionTaskDraft
} from '@markorbit/contracts';

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
    command: { expectedVersion: number }
  ): Promise<{
    executionRelease: ExecutionRelease;
    consequences: AuthorizationAuthorityConsequences;
  }>;
  release(
    id: string,
    command: { rationale: string; idempotencyKey: string }
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
async function request<T>(
  baseUrl: string,
  workspaceId: string,
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
  key?: string
): Promise<T> {
  let csrf = '';
  if (method !== 'GET') {
    const session = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
    const authentication = (await session.json()) as { csrfToken?: string; message?: string };
    if (!session.ok || !authentication.csrfToken)
      throw new Error(authentication.message ?? 'Authentication is required.');
    csrf = authentication.csrfToken;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-markorbit-workspace-id': workspaceId,
      ...(csrf ? { 'x-markorbit-csrf-token': csrf } : {}),
      ...(key ? { 'idempotency-key': key } : {})
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) })
  });
  const value = (await response.json()) as T | { error?: { message?: string } };
  if (!response.ok)
    throw new Error(
      'error' in (value as object)
        ? ((value as { error?: { message?: string } }).error?.message ??
            'Execution request failed.')
        : 'Execution request failed.'
    );
  return value as T;
}
export function createLiteExecutionClient(
  workspaceId = new URLSearchParams(window.location.search).get('workspaceId') ?? '',
  baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000'
): LiteExecutionClient {
  return {
    createRelease: (c) => {
      const { idempotencyKey, ...body } = c;
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
      request(baseUrl, workspaceId, `/api/execution/execution-releases/${encodeURIComponent(id)}`),
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
        command
      ),
    release: (id, c) => {
      const { idempotencyKey, ...body } = c;
      return request(
        baseUrl,
        workspaceId,
        `/api/execution/execution-releases/${encodeURIComponent(id)}/release`,
        'POST',
        body,
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
      request(baseUrl, workspaceId, `/api/execution/filing-task-drafts/${encodeURIComponent(id)}`),
    getTaskDraftForRelease: (id) =>
      request(
        baseUrl,
        workspaceId,
        `/api/execution/execution-releases/${encodeURIComponent(id)}/filing-task-draft`
      )
  };
}
