import type {
  MarkOrbitId,
  ProfessionalReviewCase,
  ProfessionalReviewChecklistItem
} from '@markorbit/contracts';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';
async function request<T>(
  path: string,
  workspaceId: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
  idempotencyKey?: string
) {
  let csrf = '';
  if (workspaceId && method !== 'GET') {
    const session = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
    csrf = String(((await session.json()) as { csrfToken?: string }).csrfToken ?? '');
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(workspaceId ? { 'x-markorbit-workspace-id': workspaceId } : {}),
      ...(csrf ? { 'x-markorbit-csrf-token': csrf } : {}),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) })
  });
  const value = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    const message =
      typeof value === 'object' && value !== null && 'message' in value ? value.message : undefined;
    throw new Error(typeof message === 'string' ? message : 'Professional Review failed.');
  }
  return value as T;
}
export interface ProfessionalReviewClient {
  list(): Promise<{ reviewCases: ProfessionalReviewCase[] }>;
  get(id: string): Promise<{ reviewCase: ProfessionalReviewCase }>;
  claim(
    id: string,
    reviewerId: MarkOrbitId,
    expectedVersion: number
  ): Promise<{ reviewCase: ProfessionalReviewCase }>;
  checklist(
    id: string,
    reviewerId: MarkOrbitId,
    updates: Partial<ProfessionalReviewChecklistItem>[],
    expectedVersion: number
  ): Promise<{ reviewCase: ProfessionalReviewCase }>;
  complete(
    id: string,
    reviewerId: MarkOrbitId,
    rationale: string,
    expectedVersion: number
  ): Promise<{ reviewCase: ProfessionalReviewCase }>;
}
export function createProfessionalReviewClient(workspaceId = ''): ProfessionalReviewClient {
  return {
    list: () => request('/api/lite/professional-review-cases', workspaceId),
    get: (id) =>
      request(`/api/lite/professional-review-cases/${encodeURIComponent(id)}`, workspaceId),
    claim: (id, reviewerId, expectedVersion) =>
      request(
        `/api/lite/professional-review-cases/${encodeURIComponent(id)}/claim`,
        workspaceId,
        'POST',
        {
          reviewerId,
          expectedVersion
        }
      ),
    checklist: (id, reviewerId, updates, expectedVersion) =>
      request(
        `/api/lite/professional-review-cases/${encodeURIComponent(id)}/checklist`,
        workspaceId,
        'PATCH',
        {
          reviewerId,
          updates,
          expectedVersion
        }
      ),
    complete: (id, reviewerId, rationale, expectedVersion) =>
      request(
        `/api/lite/professional-review-cases/${encodeURIComponent(id)}/complete`,
        workspaceId,
        'POST',
        {
          reviewerId,
          code: 'MARK_READY_FOR_NEXT_STEP',
          rationale,
          expectedVersion
        },
        `professional-review-complete:${id}`
      )
  };
}
