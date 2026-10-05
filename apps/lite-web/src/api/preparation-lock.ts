import type { DurablePreparationLockView } from '@markorbit/contracts';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export class PreparationLockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function request(
  path: string,
  workspaceId: string,
  method: 'GET' | 'POST',
  body?: unknown,
  idempotencyKey?: string
): Promise<DurablePreparationLockView> {
  let csrf = '';
  if (method === 'POST') {
    const session = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
    csrf = String(((await session.json()) as { csrfToken?: string }).csrfToken ?? '');
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-markorbit-workspace-id': workspaceId,
      ...(csrf ? { 'x-markorbit-csrf-token': csrf } : {}),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
    },
    ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {})
  });
  const value = (await response.json()) as DurablePreparationLockView & {
    code?: string;
    message?: string;
  };
  if (!response.ok)
    throw new PreparationLockHttpError(
      response.status,
      value.code ?? 'PREPARATION_LOCK_REQUEST_FAILED',
      value.message ?? 'Preparation Lock request failed.'
    );
  return value;
}

export interface PreparationLockClient {
  create(input: {
    documentPackageId: string;
    expectedDocumentPackageVersion: number;
    expectedCanonicalEvidenceHash: string;
  }): Promise<DurablePreparationLockView>;
  get(preparationLockId: string): Promise<DurablePreparationLockView>;
  validateCurrent(preparationLockId: string): Promise<DurablePreparationLockView>;
}

export const createPreparationLockClient = (workspaceId: string): PreparationLockClient => ({
  create: (input) =>
    request(
      '/api/markreg/preparation-locks',
      workspaceId,
      'POST',
      input,
      `preparation-lock:${input.documentPackageId}:${input.expectedDocumentPackageVersion}:${input.expectedCanonicalEvidenceHash}`
    ),
  get: (id) =>
    request(`/api/markreg/preparation-locks/${encodeURIComponent(id)}`, workspaceId, 'GET'),
  validateCurrent: (id) =>
    request(
      `/api/markreg/preparation-locks/${encodeURIComponent(id)}/validate-current`,
      workspaceId,
      'POST'
    )
});
