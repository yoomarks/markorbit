import type {
  ContentDraft,
  ContentOpportunity,
  ContentReviewDecision,
  ProductLoopUseFeedback,
  PublishPackage
} from '@markorbit/contracts/product-loop';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export type ContentStudioWarning = 'VISUAL_HISTORY_NOT_DISCOVERABLE';

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
}

async function request<T>(path: string, workspaceId: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: { 'x-markorbit-workspace-id': workspaceId }
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
      )
  };
}
