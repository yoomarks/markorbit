import type {
  ContentDraft,
  ContentOpportunity,
  ContentReviewDecision,
  ProductLoopFeedbackOutcome,
  ProductLoopUseFeedback,
  PublishPackage
} from '@markorbit/contracts/product-loop';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export type ContentStudioWarning = 'VISUAL_HISTORY_NOT_DISCOVERABLE';
export type ContentStudioFeedbackOutcome = Extract<
  ProductLoopFeedbackOutcome,
  'USER_REPORTED_PUBLISHED' | 'USER_REPORTED_USED' | 'NOT_USED'
>;

export interface ContentStudioWorkSummary {
  contentOpportunity: { id: ContentOpportunity['contentOpportunityId']; version: number };
  title: string;
  rationale: string;
  sources: ContentOpportunity['sources'];
  createdAt: string;
  updatedAt: string;
  latestDraft: Pick<
    ContentDraft,
    'contentDraftId' | 'version' | 'status' | 'title' | 'updatedAt'
  > | null;
  latestDraftReview: ContentReviewDecision | null;
  latestPublishPackage: Omit<PublishPackage, 'body'> | null;
  latestPackageFeedback: ProductLoopUseFeedback | null;
}

export interface ContentStudioWorkList {
  schemaVersion: 1;
  workspaceId: string;
  items: ContentStudioWorkSummary[];
  nextAfter: string | null;
  partial: true;
  warnings: readonly ContentStudioWarning[];
}

export interface ContentStudioWorkDetail {
  schemaVersion: 1;
  workspaceId: string;
  opportunity: ContentOpportunity;
  drafts: ContentDraft[];
  reviewedDrafts: ContentDraft[];
  reviews: ContentReviewDecision[];
  publishPackages: PublishPackage[];
  feedback: ProductLoopUseFeedback[];
  partial: true;
  warnings: readonly ContentStudioWarning[];
}

export class ContentStudioHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ContentStudioHttpError';
  }
}

export interface ContentStudioClient {
  list(after?: string): Promise<ContentStudioWorkList>;
  find(contentOpportunityId: string): Promise<ContentStudioWorkDetail>;
  recordUseFeedback(
    publishPackage: Readonly<PublishPackage>,
    outcome: ContentStudioFeedbackOutcome
  ): Promise<ProductLoopUseFeedback>;
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const value = (await response.json().catch(() => ({}))) as {
    csrfToken?: string;
    code?: string;
    message?: string;
  };
  if (!response.ok || !value.csrfToken)
    throw new ContentStudioHttpError(
      response.status || 503,
      value.code ?? 'AUTHENTICATION_REQUIRED',
      value.message ?? 'An authenticated session is required.'
    );
  return value.csrfToken;
}

async function request<T>(
  path: string,
  workspaceId: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  idempotencyKey?: string
): Promise<T> {
  const csrf = method === 'GET' ? '' : await csrfToken();
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
      ...(method === 'GET'
        ? {}
        : { body: JSON.stringify({ workspaceId, ...(body as Record<string, unknown>) }) })
    });
  } catch (cause) {
    throw new ContentStudioHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      cause instanceof Error ? cause.message : 'Content Studio is temporarily unavailable.'
    );
  }
  const value = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new ContentStudioHttpError(
      response.status || 503,
      value.code ?? 'CONTENT_STUDIO_REQUEST_FAILED',
      value.message ?? 'Content Studio request failed.'
    );
  }
  return value;
}

export function createContentStudioClient(workspaceId: string): ContentStudioClient {
  return {
    list: (after) => {
      const query = new URLSearchParams({ limit: '20' });
      if (after) query.set('after', after);
      return request<ContentStudioWorkList>(
        `/api/lite/content-studio/works?${query.toString()}`,
        workspaceId
      );
    },
    find: (contentOpportunityId) =>
      request<ContentStudioWorkDetail>(
        `/api/lite/content-studio/works/${encodeURIComponent(contentOpportunityId)}`,
        workspaceId
      ),
    recordUseFeedback: (publishPackage, outcome) =>
      request<ProductLoopUseFeedback>(
        `/api/lite/publish-packages/${encodeURIComponent(publishPackage.publishPackageId)}/use-feedback`,
        workspaceId,
        'POST',
        {
          publishPackageVersion: publishPackage.version,
          expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
          outcome
        },
        `feedback:${publishPackage.publishPackageId}:${publishPackage.version}`
      )
  };
}
