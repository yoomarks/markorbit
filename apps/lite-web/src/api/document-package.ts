import type {
  DurableDocumentEvidenceInput,
  DurableDocumentPackageView,
  DurableInstructionInput
} from '@markorbit/contracts';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';
export class PackageHttpError extends Error {
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
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
  idempotencyKey?: string
) {
  let csrf = '';
  if (method !== 'GET') {
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
    ...(method === 'GET' ? {} : { body: JSON.stringify({ workspaceId, ...(body as object) }) })
  });
  const value = (await response.json()) as DurableDocumentPackageView & {
    code?: string;
    message?: string;
  };
  if (!response.ok)
    throw new PackageHttpError(
      response.status,
      value.code ?? 'PACKAGE_REQUEST_FAILED',
      value.message ?? 'Document Package request failed.'
    );
  return value;
}
const key = (action: string) => `${action}:${crypto.randomUUID()}`;
export const createDocumentPackageClient = (workspaceId: string) => ({
  create: (input: {
    professionalReviewCaseId: string;
    expectedReviewVersion: number;
    expectedCompletedDecisionId: string;
    expectedCompletedDecisionHash: string;
  }) =>
    request('/api/markreg/document-packages', workspaceId, 'POST', input, key('package-create')),
  get: (id: string) =>
    request(`/api/markreg/document-packages/${encodeURIComponent(id)}`, workspaceId),
  save: (id: string, expectedVersion: number, draft: Record<string, unknown>) =>
    request(
      `/api/markreg/document-packages/${encodeURIComponent(id)}`,
      workspaceId,
      'PATCH',
      { expectedVersion, draft },
      key('package-save')
    ),
  evidence: (id: string, expectedVersion: number, evidence: DurableDocumentEvidenceInput) =>
    request(
      `/api/markreg/document-packages/${encodeURIComponent(id)}/documents`,
      workspaceId,
      'POST',
      { expectedVersion, evidence },
      key('package-evidence')
    ),
  append: (id: string, expectedVersion: number, instruction: DurableInstructionInput) =>
    request(
      `/api/markreg/document-packages/${encodeURIComponent(id)}/instructions`,
      workspaceId,
      'POST',
      { expectedVersion, instruction },
      key('package-instruction')
    ),
  supersede: (
    id: string,
    entryId: string,
    expectedVersion: number,
    instruction: DurableInstructionInput
  ) =>
    request(
      `/api/markreg/document-packages/${encodeURIComponent(id)}/instructions/${encodeURIComponent(entryId)}/supersede`,
      workspaceId,
      'POST',
      { expectedVersion, instruction },
      key('package-supersede')
    ),
  ready: (id: string, expectedVersion: number) =>
    request(
      `/api/markreg/document-packages/${encodeURIComponent(id)}/mark-ready`,
      workspaceId,
      'POST',
      { expectedVersion },
      key('package-ready')
    )
});
