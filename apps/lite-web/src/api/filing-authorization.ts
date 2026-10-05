import type {
  AuthorizationAuthorityConsequences,
  AuthorizationCapacity,
  FilingAuthorization,
  FilingAuthorizationAcknowledgementCode,
  FilingExecutionChannel,
  MarkOrbitId
} from '@markorbit/contracts';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export interface FilingAuthorizationResponse {
  filingAuthorization: FilingAuthorization;
  consequences: AuthorizationAuthorityConsequences;
}

export class FilingAuthorizationHttpError extends Error {
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
): Promise<FilingAuthorizationResponse> {
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
  const value = (await response.json()) as FilingAuthorizationResponse & {
    code?: string;
    message?: string;
  };
  if (!response.ok)
    throw new FilingAuthorizationHttpError(
      response.status,
      value.code ?? 'FILING_AUTHORIZATION_REQUEST_FAILED',
      value.message ?? 'Filing Authorization request failed.'
    );
  return value;
}

export interface FilingAuthorizationClient {
  create(input: {
    preparationLockId: string;
    preparationLockVersion: string;
    authorizedParty: { partyId: MarkOrbitId; displayName: string };
    authorizationCapacity: AuthorizationCapacity;
    executionChannel: FilingExecutionChannel;
  }): Promise<FilingAuthorizationResponse>;
  get(filingAuthorizationId: string): Promise<FilingAuthorizationResponse>;
  confirm(
    filingAuthorizationId: string,
    acknowledgementCodes: FilingAuthorizationAcknowledgementCode[]
  ): Promise<FilingAuthorizationResponse>;
}

export const createFilingAuthorizationClient = (
  workspaceId: string
): FilingAuthorizationClient => ({
  create: (input) =>
    request(
      '/api/execution/filing-authorizations',
      workspaceId,
      'POST',
      input,
      `filing-authorization:${input.preparationLockId}:${input.preparationLockVersion}`
    ),
  get: (id) =>
    request(`/api/execution/filing-authorizations/${encodeURIComponent(id)}`, workspaceId, 'GET'),
  confirm: (id, acknowledgementCodes) =>
    request(
      `/api/execution/filing-authorizations/${encodeURIComponent(id)}/confirm`,
      workspaceId,
      'POST',
      { acknowledgementCodes },
      `filing-authorization-confirm:${id}`
    )
});
