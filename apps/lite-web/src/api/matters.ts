import type { FormalMatter, FormalMatterListResponse } from '@markorbit/contracts';

function parseGatewayUrl(value: unknown): string {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

const baseUrl = parseGatewayUrl(
  import.meta.env.VITE_LITE_GATEWAY_URL ?? import.meta.env.VITE_GATEWAY_URL
);

export class MatterWorkspaceHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = status >= 500
  ) {
    super(message);
    this.name = 'MatterWorkspaceHttpError';
  }
}

export interface MatterListQuery {
  readonly search?: string;
  readonly status?: string;
  readonly type?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface MatterReviewCaseReference {
  readonly reviewCaseId: string;
  readonly version: number;
}

export interface MatterWorkspaceClient {
  list(query: MatterListQuery, signal?: AbortSignal): Promise<FormalMatterListResponse>;
  load(formalMatterId: string, signal?: AbortSignal): Promise<FormalMatter>;
  startProfessionalReview(matter: Readonly<FormalMatter>): Promise<MatterReviewCaseReference>;
}

async function parsedResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    message?: string;
  };
  if (!response.ok)
    throw new MatterWorkspaceHttpError(
      response.status,
      body.code ?? 'MATTER_WORKSPACE_REQUEST_FAILED',
      body.message ?? fallbackMessage
    );
  return body;
}

async function csrfToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  } catch {
    throw new MatterWorkspaceHttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
      true
    );
  }
  const body = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !body.csrfToken)
    throw new MatterWorkspaceHttpError(
      response.status || 503,
      body.code ?? 'AUTHENTICATION_REQUIRED',
      body.message ?? 'An authenticated session is required.'
    );
  return body.csrfToken;
}

async function read<T>(path: string, workspaceId: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: {
        'x-markorbit-workspace-id': workspaceId,
        'x-correlation-id': crypto.randomUUID()
      },
      ...(signal ? { signal } : {})
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new MatterWorkspaceHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Matter data is unavailable.',
      true
    );
  }
  return parsedResponse<T>(response, 'Matter data is unavailable.');
}

export function createMatterWorkspaceClient(workspaceId: string): MatterWorkspaceClient {
  return {
    list: (query, signal) => {
      const search = new URLSearchParams({
        ...(query.search ? { search: query.search } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        page: String(query.page ?? 1),
        pageSize: String(query.pageSize ?? 20)
      });
      return read<FormalMatterListResponse>(
        `/api/markreg/formal-matters?${search}`,
        workspaceId,
        signal
      );
    },
    load: async (formalMatterId, signal) => {
      const response = await read<{ formalMatter: FormalMatter }>(
        `/api/markreg/formal-matters/${encodeURIComponent(formalMatterId)}`,
        workspaceId,
        signal
      );
      return response.formalMatter;
    },
    startProfessionalReview: async (matter) => {
      const csrf = await csrfToken();
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/lite/professional-review-cases`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': `professional-review:${matter.formalMatterId}`,
            'x-markorbit-workspace-id': workspaceId,
            'x-markorbit-csrf-token': csrf
          },
          body: JSON.stringify({
            formalMatterId: matter.formalMatterId,
            sourceFormalMatterVersion: matter.version,
            sourceSnapshotSha256: matter.snapshotSha256,
            matterDraftId: matter.sourceMatterDraftId,
            matterDraftVersion: String(matter.sourceMatterDraftVersion)
          })
        });
      } catch {
        throw new MatterWorkspaceHttpError(
          503,
          'DOWNSTREAM_UNAVAILABLE',
          'Professional Review could not be started.',
          true
        );
      }
      const body = await parsedResponse<{
        reviewCase?: { reviewCaseId?: string; version?: number };
      }>(response, 'Professional Review could not be started.');
      if (!body.reviewCase?.reviewCaseId)
        throw new MatterWorkspaceHttpError(
          503,
          'MALFORMED_REVIEW_RESPONSE',
          'Professional Review returned an invalid response.',
          true
        );
      return {
        reviewCaseId: body.reviewCase.reviewCaseId,
        version: body.reviewCase.version ?? 1
      };
    }
  };
}
