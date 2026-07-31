import type {
  MarkOrbitId,
  ProfessionalReviewCase,
  ProfessionalReviewChecklistItem
} from '@markorbit/contracts';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';
async function request<T>(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
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
  claim(id: string, reviewerId: MarkOrbitId): Promise<{ reviewCase: ProfessionalReviewCase }>;
  checklist(
    id: string,
    reviewerId: MarkOrbitId,
    updates: Partial<ProfessionalReviewChecklistItem>[]
  ): Promise<{ reviewCase: ProfessionalReviewCase }>;
  complete(
    id: string,
    reviewerId: MarkOrbitId,
    rationale: string
  ): Promise<{ reviewCase: ProfessionalReviewCase }>;
}
export function createProfessionalReviewClient(): ProfessionalReviewClient {
  return {
    list: () => request('/api/lite/professional-review-cases'),
    get: (id) => request(`/api/lite/professional-review-cases/${encodeURIComponent(id)}`),
    claim: (id, reviewerId) =>
      request(`/api/lite/professional-review-cases/${encodeURIComponent(id)}/claim`, 'POST', {
        reviewerId
      }),
    checklist: (id, reviewerId, updates) =>
      request(`/api/lite/professional-review-cases/${encodeURIComponent(id)}/checklist`, 'PATCH', {
        reviewerId,
        updates
      }),
    complete: (id, reviewerId, rationale) =>
      request(`/api/lite/professional-review-cases/${encodeURIComponent(id)}/complete`, 'POST', {
        reviewerId,
        code: 'MARK_READY_FOR_NEXT_STEP',
        rationale
      })
  };
}
