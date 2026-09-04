import type { ContentStudioWorkSummary } from '../../api/content-studio.js';

export type ContentWorkState =
  | 'NEEDS_FIRST_DRAFT'
  | 'DRAFTING'
  | 'READY_FOR_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'READY_FOR_PACKAGE'
  | 'PACKAGE_PREPARED'
  | 'NO_CURRENT_ACTION';

export type ContentTriageFilter =
  | 'NEEDS_ATTENTION'
  | 'NEEDS_FIRST_DRAFT'
  | 'DRAFTING'
  | 'READY_FOR_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'READY_FOR_PACKAGE'
  | 'PACKAGE_PREPARED'
  | 'NO_CURRENT_ACTION'
  | 'ALL';

export interface ContentWorkTriage {
  state: ContentWorkState;
  label: string;
  nextFocus: string;
  activityAt: string;
  needsAttention: boolean;
}

function exactCurrentReview(work: Readonly<ContentStudioWorkSummary>) {
  const draft = work.latestDraft;
  const review = work.latestDraftReview;
  if (
    !draft ||
    !review ||
    review.contentDraft.id !== draft.contentDraftId ||
    Number(review.contentDraft.version) !== draft.version
  ) {
    return null;
  }
  return review;
}

function exactCurrentPackage(
  work: Readonly<ContentStudioWorkSummary>,
  review: ReturnType<typeof exactCurrentReview>
) {
  const draft = work.latestDraft;
  const publishPackage = work.latestPublishPackage;
  if (
    !draft ||
    !review ||
    !publishPackage ||
    publishPackage.contentDraft.id !== draft.contentDraftId ||
    Number(publishPackage.contentDraft.version) !== draft.version ||
    publishPackage.reviewDecision.id !== review.contentReviewDecisionId ||
    Number(publishPackage.reviewDecision.version) !== review.version
  ) {
    return null;
  }
  return publishPackage;
}

function exactCurrentPackageFeedbackAt(
  work: Readonly<ContentStudioWorkSummary>,
  publishPackage: NonNullable<ContentStudioWorkSummary['latestPublishPackage']> | null
): string | undefined {
  const feedback = work.latestPackageFeedback;
  if (
    !publishPackage ||
    !feedback ||
    feedback.publishPackage.id !== publishPackage.publishPackageId ||
    Number(feedback.publishPackage.version) !== publishPackage.version
  ) {
    return undefined;
  }
  return feedback.recordedAt;
}

function latestActivityAt(work: Readonly<ContentStudioWorkSummary>): string {
  const review = exactCurrentReview(work);
  const publishPackage = exactCurrentPackage(work, review);
  const candidates = [
    work.updatedAt,
    work.latestDraft?.updatedAt,
    review?.reviewedAt,
    publishPackage?.createdAt,
    exactCurrentPackageFeedbackAt(work, publishPackage)
  ].filter((value): value is string => Boolean(value));

  return candidates.reduce((latest, candidate) =>
    Date.parse(candidate) > Date.parse(latest) ? candidate : latest
  );
}

export function deriveContentWorkTriage(
  work: Readonly<ContentStudioWorkSummary>
): ContentWorkTriage {
  const activityAt = latestActivityAt(work);
  const draft = work.latestDraft;

  if (!draft) {
    return {
      state: 'NEEDS_FIRST_DRAFT',
      label: 'Needs first Draft',
      nextFocus: 'Create the first Draft',
      activityAt,
      needsAttention: true
    };
  }

  const review = exactCurrentReview(work);
  if (review?.outcome === 'CHANGES_REQUIRED') {
    return {
      state: 'CHANGES_REQUIRED',
      label: 'Changes required',
      nextFocus: 'Revise the current Draft',
      activityAt,
      needsAttention: true
    };
  }
  if (review?.outcome === 'REJECTED') {
    return {
      state: 'NO_CURRENT_ACTION',
      label: 'Draft rejected',
      nextFocus: 'No preparation action available',
      activityAt,
      needsAttention: false
    };
  }
  if (review?.outcome === 'APPROVED_FOR_PUBLISH_PACKAGE') {
    if (exactCurrentPackage(work, review)) {
      return {
        state: 'PACKAGE_PREPARED',
        label: 'Package prepared',
        nextFocus: 'PublishPackage prepared',
        activityAt,
        needsAttention: false
      };
    }
    return {
      state: 'READY_FOR_PACKAGE',
      label: 'Ready to prepare package',
      nextFocus: 'Prepare PublishPackage',
      activityAt,
      needsAttention: true
    };
  }

  switch (draft.status) {
    case 'DRAFT':
      return {
        state: 'DRAFTING',
        label: 'Drafting',
        nextFocus: 'Continue drafting or mark ready for human review',
        activityAt,
        needsAttention: false
      };
    case 'READY_FOR_HUMAN_REVIEW':
      return {
        state: 'READY_FOR_REVIEW',
        label: 'Ready for human review',
        nextFocus: 'Human review required',
        activityAt,
        needsAttention: true
      };
    case 'CHANGES_REQUIRED':
      return {
        state: 'CHANGES_REQUIRED',
        label: 'Changes required',
        nextFocus: 'Revise the current Draft',
        activityAt,
        needsAttention: true
      };
    case 'REVIEWED_READY_FOR_PACKAGE':
      return {
        state: 'NO_CURRENT_ACTION',
        label: 'Review truth unavailable',
        nextFocus: 'Open current work to inspect owner lineage',
        activityAt,
        needsAttention: false
      };
    case 'REJECTED':
      return {
        state: 'NO_CURRENT_ACTION',
        label: 'Draft rejected',
        nextFocus: 'No preparation action available',
        activityAt,
        needsAttention: false
      };
    case 'SUPERSEDED':
      return {
        state: 'NO_CURRENT_ACTION',
        label: 'Read-only historical state',
        nextFocus: 'No current preparation action',
        activityAt,
        needsAttention: false
      };
  }
}

export function matchesContentTriageFilter(
  triage: Readonly<ContentWorkTriage>,
  filter: ContentTriageFilter
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'NEEDS_ATTENTION') return triage.needsAttention;
  return triage.state === filter;
}
