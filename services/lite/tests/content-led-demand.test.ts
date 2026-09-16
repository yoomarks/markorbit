import {
  businessAttributionFingerprintSha256V1,
  noBusinessAttributionAuthorityConsequencesV1,
  type BusinessAttributionLinkV1,
  type BusinessAttributionReferenceV1
} from '@markorbit/contracts/business-attribution';
import type {
  ContentDraft,
  ContentOpportunity,
  ContentReviewDecision,
  ProductLoopUseFeedback,
  PublishPackage
} from '@markorbit/contracts/product-loop';
import { describe, expect, it, vi } from 'vitest';
import {
  ContentLedDemandAttributionService,
  type ContentLedDemandAttributionStore,
  type ContentLedDemandFeedbackReader,
  type ContentLedDemandLineageReader
} from '../src/content-led-demand.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const at = '2026-09-17T01:00:00.000Z';
const source = {
  schemaVersion: 1 as const,
  owner: 'KNOWLEDGE' as const,
  kind: 'KNOWLEDGE_READY_PACKAGE' as const,
  sourceId: 'ready-package_fee-update',
  sourceVersion: 1,
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: at
};
const opportunity: ContentOpportunity = {
  schemaVersion: 1,
  contentOpportunityId: 'content-opportunity_fee-update',
  workspaceId,
  version: 1,
  sourceRecommendation: { id: 'today-recommendation_fee-update', version: 1 },
  sources: [source],
  title: 'Fee update explainer',
  rationale: 'Exact accepted Knowledge evidence supports editorial review.',
  status: 'ACCEPTED_FOR_PREPARATION',
  contentOpportunityFingerprintSha256: 'b'.repeat(64),
  publishAuthorized: false,
  formalBusinessOpportunityCreated: false,
  createdAt: at,
  updatedAt: at
};
const draft: ContentDraft = {
  schemaVersion: 1,
  contentDraftId: 'content-draft_fee-update',
  workspaceId,
  version: 1,
  contentOpportunity: { id: opportunity.contentOpportunityId, version: 1 },
  sources: [source],
  title: 'Fee update explained',
  body: 'Reviewed source-grounded copy.',
  status: 'READY_FOR_HUMAN_REVIEW',
  contentDraftFingerprintSha256: 'c'.repeat(64),
  humanReviewRequired: true,
  published: false,
  createdAt: at,
  updatedAt: at
};
const review: ContentReviewDecision = {
  schemaVersion: 1,
  contentReviewDecisionId: 'content-review-decision_fee-update',
  workspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: draft.version },
  expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
  outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
  reviewerPrincipalId: 'user_editor',
  rationale: 'Approved for a canonical package only.',
  reviewedAt: at,
  publishesExternally: false
};
const publishPackage: PublishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_fee-update',
  workspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: 1 },
  contentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
  reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
  title: draft.title,
  body: draft.body,
  publishPackageFingerprintSha256: 'd'.repeat(64),
  status: 'PREPARED',
  externalPublishExecuted: false,
  createdAt: at
};
const feedback: ProductLoopUseFeedback = {
  schemaVersion: 1,
  productLoopFeedbackId: 'product-loop-feedback_manual-use',
  workspaceId,
  version: 1,
  publishPackage: { id: publishPackage.publishPackageId, version: 1 },
  outcome: 'USER_REPORTED_PUBLISHED',
  externalReference: 'https://example.test/posts/fee-update',
  recordedByPrincipalId: 'user_editor',
  recordedAt: at,
  externalActionExecutedByMarkOrbit: false,
  externalOutcomeVerifiedByMarkOrbit: false
};
const downstream: BusinessAttributionReferenceV1 = {
  owner: 'MARKREG',
  kind: 'FORMAL_MATTER',
  id: 'formal-matter_content-inbound',
  version: 1,
  fingerprintSha256: 'e'.repeat(64),
  observedAt: at
};

function siteInbound(packageFingerprint = publishPackage.publishPackageFingerprintSha256) {
  const value = {
    schemaVersion: 1 as const,
    businessAttributionLinkId: 'business-attribution_site-content' as const,
    workspaceId,
    version: 1 as const,
    motionKind: 'SITE_INBOUND' as const,
    sourceRefs: [
      {
        owner: 'LITE',
        kind: 'PUBLISH_PACKAGE',
        id: publishPackage.publishPackageId,
        version: 1,
        fingerprintSha256: packageFingerprint,
        observedAt: at
      }
    ],
    touchpointRefs: [],
    downstreamRef: downstream,
    attributionState: 'ATTRIBUTED' as const,
    evidenceBasis: 'EXACT_LINEAGE' as const,
    evaluatedAt: at,
    recordedByPrincipalId: 'user_operator',
    authorityConsequences: noBusinessAttributionAuthorityConsequencesV1
  };
  return {
    ...value,
    businessAttributionFingerprintSha256: businessAttributionFingerprintSha256V1(value)
  } satisfies BusinessAttributionLinkV1;
}

function setup(overrides?: {
  feedback?: ProductLoopUseFeedback;
  siteLink?: BusinessAttributionLinkV1;
}) {
  const lineage: ContentLedDemandLineageReader = {
    find: vi.fn(() => Promise.resolve({ opportunity, draft, review, publishPackage }))
  };
  const feedbackReader: ContentLedDemandFeedbackReader = {
    findByPackage: vi.fn(() => Promise.resolve(overrides?.feedback ?? feedback)),
    sourceReference: vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1 as const,
        owner: 'LITE' as const,
        kind: 'CONTENT_USE_FEEDBACK' as const,
        sourceId: feedback.productLoopFeedbackId,
        sourceVersion: 1,
        sourceFingerprintSha256: 'f'.repeat(64),
        observedAt: at
      })
    )
  };
  const create = vi.fn<ContentLedDemandAttributionStore['create']>(() =>
    Promise.resolve({ motionKind: 'CONTENT_LED_DEMAND' } as BusinessAttributionLinkV1)
  );
  const attribution: ContentLedDemandAttributionStore = {
    find: vi.fn(() => Promise.resolve(overrides?.siteLink ?? siteInbound())),
    create
  };
  return {
    service: new ContentLedDemandAttributionService(lineage, feedbackReader, attribution),
    create
  };
}

function command() {
  const inbound = siteInbound();
  return {
    workspaceId,
    actorPrincipalId: 'user_operator',
    idempotencyKey: 'content-led-demand-1',
    publishPackage: {
      id: publishPackage.publishPackageId,
      version: 1,
      fingerprintSha256: publishPackage.publishPackageFingerprintSha256
    },
    useFeedback: { id: feedback.productLoopFeedbackId, version: 1 },
    siteInboundAttribution: {
      id: inbound.businessAttributionLinkId,
      version: 1,
      fingerprintSha256: inbound.businessAttributionFingerprintSha256
    }
  } as const;
}

describe('G5 content-led demand attribution', () => {
  it('re-reads exact reviewed content, manual-use feedback and Site inbound truth before linking the MarkReg outcome', async () => {
    const { service, create } = setup();
    await service.record(command());
    const recorded = create.mock.calls[0]?.[0];
    expect(recorded).toMatchObject({
      workspaceId,
      actorPrincipalId: 'user_operator',
      idempotencyKey: 'content-led-demand-1',
      motionKind: 'CONTENT_LED_DEMAND',
      downstreamRef: downstream,
      attributionState: 'ATTRIBUTED',
      evidenceBasis: 'EXACT_LINEAGE',
      evaluatedAt: at
    });
    expect(recorded?.sourceRefs).toEqual([
      expect.objectContaining({ owner: 'KNOWLEDGE', id: source.sourceId }),
      expect.objectContaining({
        owner: 'LITE',
        kind: 'PUBLISH_PACKAGE',
        id: publishPackage.publishPackageId,
        fingerprintSha256: publishPackage.publishPackageFingerprintSha256
      })
    ]);
    expect(recorded?.touchpointRefs.map((reference) => reference.kind)).toEqual([
      'CONTENT_OPPORTUNITY',
      'CONTENT_USE_FEEDBACK',
      'SITE_INBOUND_ATTRIBUTION'
    ]);
  });

  it('fails closed when Site inbound does not carry the exact PublishPackage fingerprint', async () => {
    const mismatched = siteInbound('9'.repeat(64));
    const { service, create } = setup({ siteLink: mismatched });
    const value = command();
    await expect(
      service.record({
        ...value,
        siteInboundAttribution: {
          ...value.siteInboundAttribution,
          fingerprintSha256: mismatched.businessAttributionFingerprintSha256
        }
      })
    ).rejects.toMatchObject({ code: 'LINEAGE_MISMATCH' });
    expect(create).not.toHaveBeenCalled();
  });

  it('does not treat an explicit NOT_USED report as a distribution outcome', async () => {
    const { service, create } = setup({ feedback: { ...feedback, outcome: 'NOT_USED' } });
    await expect(service.record(command())).rejects.toMatchObject({ code: 'LINEAGE_MISMATCH' });
    expect(create).not.toHaveBeenCalled();
  });
});
