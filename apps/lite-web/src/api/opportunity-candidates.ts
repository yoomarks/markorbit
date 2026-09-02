import type {
  OpportunityCandidate,
  OpportunityCandidateId,
  OpportunityQualificationDecision,
  OpportunityQualificationOutcome
} from '@markorbit/contracts/product-loop';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export interface OpportunityCandidatePage {
  readonly items: readonly Readonly<OpportunityCandidate>[];
  readonly nextCursor: OpportunityCandidateId | null;
}

export interface OpportunityQualificationInput {
  readonly candidateVersion: number;
  readonly expectedCandidateFingerprintSha256: string;
  readonly outcome: OpportunityQualificationOutcome;
  readonly rationale: string;
}

export interface OpportunityQualificationDisposition {
  readonly decision: Readonly<OpportunityQualificationDecision>;
  readonly currentCandidate: Readonly<OpportunityCandidate>;
}

export interface OpportunityCandidateClient {
  list(input?: Readonly<{ cursor?: string; limit?: number }>): Promise<OpportunityCandidatePage>;
  load(opportunityCandidateId: OpportunityCandidateId): Promise<OpportunityCandidate>;
  loadQualification(
    opportunityCandidateId: OpportunityCandidateId
  ): Promise<OpportunityQualificationDecision | null>;
  qualify(
    opportunityCandidateId: OpportunityCandidateId,
    input: Readonly<OpportunityQualificationInput>,
    idempotencyKey: string
  ): Promise<OpportunityQualificationDisposition>;
}

export class OpportunityCandidateHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'OpportunityCandidateHttpError';
  }
}

async function request<T>(
  path: string,
  workspaceId: string,
  init?: Readonly<{
    method: 'POST';
    body: unknown;
    csrfToken: string;
    idempotencyKey: string;
  }>
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        ...(init
          ? {
              'x-markorbit-csrf-token': init.csrfToken,
              'idempotency-key': init.idempotencyKey
            }
          : {})
      },
      ...(init ? { method: init.method, body: JSON.stringify(init.body) } : {})
    });
  } catch {
    throw new OpportunityCandidateHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Candidate Review is temporarily unavailable.',
      true
    );
  }
  const parsed = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  if (!response.ok)
    throw new OpportunityCandidateHttpError(
      response.status,
      parsed.code ?? 'OPPORTUNITY_CANDIDATE_REQUEST_FAILED',
      parsed.message ?? 'Candidate Review request failed.',
      parsed.retryable ?? response.status >= 500
    );
  return parsed;
}

async function currentCsrfToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  } catch {
    throw new OpportunityCandidateHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'The authenticated session could not be loaded.',
      true
    );
  }
  const parsed = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !parsed.csrfToken)
    throw new OpportunityCandidateHttpError(
      response.ok ? 401 : response.status,
      parsed.code ?? 'AUTHENTICATION_REQUIRED',
      parsed.message ?? 'An authenticated session is required for Qualification.'
    );
  return parsed.csrfToken;
}

function listPath(input?: Readonly<{ cursor?: string; limit?: number }>) {
  const query = new URLSearchParams();
  if (input?.cursor) query.set('cursor', input.cursor);
  if (input?.limit !== undefined) query.set('limit', String(input.limit));
  const suffix = query.toString();
  return `/api/lite/opportunity-candidates${suffix ? `?${suffix}` : ''}`;
}

export function createOpportunityCandidateClient(workspaceId: string): OpportunityCandidateClient {
  return {
    list: (input) => request<OpportunityCandidatePage>(listPath(input), workspaceId),
    load: (opportunityCandidateId) =>
      request<OpportunityCandidate>(
        `/api/lite/opportunity-candidates/${encodeURIComponent(opportunityCandidateId)}`,
        workspaceId
      ),
    loadQualification: (opportunityCandidateId) =>
      request<OpportunityQualificationDecision | null>(
        `/api/lite/opportunity-candidates/${encodeURIComponent(opportunityCandidateId)}/qualification`,
        workspaceId
      ),
    qualify: async (opportunityCandidateId, input, idempotencyKey) => {
      const csrfToken = await currentCsrfToken();
      return request<OpportunityQualificationDisposition>(
        `/api/lite/opportunity-candidates/${encodeURIComponent(opportunityCandidateId)}/qualification`,
        workspaceId,
        {
          method: 'POST',
          body: input,
          csrfToken,
          idempotencyKey
        }
      );
    }
  };
}
