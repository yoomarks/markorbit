import { describe, expect, it } from 'vitest';
import type { RecommendedAction } from '../src/evidence-lifecycle.js';
import {
  assertClientNotificationPreparedActionConfirmationV1,
  clientNotificationConfirmationFingerprintSha256V1,
  clientNotificationReviewedContentFingerprintSha256V1,
  ClientNotificationHandoffContractError,
  contentDraftStatuses,
  contentOpportunityStatuses,
  contentReviewOutcomes,
  noAutomaticProductLoopConsequences,
  noClientNotificationPreparationAuthorityConsequencesV1,
  opportunityCandidateStatuses,
  opportunityQualificationOutcomes,
  parseClientNotificationHandoffPlanV1,
  preparedActionKinds,
  productLoopAiAuthority,
  productLoopErrorCodes,
  productLoopFeedbackOutcomes,
  productLoopHandoffTargets,
  productLoopSourceKinds,
  productLoopSourceOwners,
  todayRecommendationKinds,
  todayRecommendationStatuses,
  type ClientNotificationHandoffPlanV1,
  type ContentDraft,
  type ContentOpportunity,
  type ContentReviewDecision,
  type FormalTrademarkServiceOpportunity,
  type MarkRegIntakeHandoff,
  type OpportunityCandidate,
  type OpportunityQualificationDecision,
  type PreparedAction,
  type PreparedActionConfirmation,
  type ProductLoopUseFeedback,
  type PublishPackage,
  type TodayRecommendation
} from '../src/product-loop.js';

const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);
const workspaceId = 'workspace_plc-01';
const correlationId = 'correlation_plc-01' as const;
const principalId = 'principal_plc-reviewer' as const;

const source = {
  schemaVersion: 1,
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'rdp_contract-01',
  sourceVersion: '1.0',
  sourceFingerprintSha256: shaA,
  observedAt: '2026-08-11T07:45:00.000Z',
  correlationId
} as const;

const recommendation = {
  schemaVersion: 1,
  todayRecommendationId: 'today-recommendation_contract-01',
  workspaceId,
  version: 1,
  kind: 'CONTENT_PREPARATION',
  title: 'Prepare a client-relevant trademark update',
  explanation: 'A governed ReadyPackage contains a change relevant to the current Workspace.',
  sources: [source],
  status: 'OPEN',
  recommendationFingerprintSha256: shaB,
  executionAuthorized: false,
  createdAt: '2026-08-11T07:46:00.000Z',
  updatedAt: '2026-08-11T07:46:00.000Z'
} as const satisfies TodayRecommendation;

const preparedAction = {
  schemaVersion: 1,
  preparedActionId: 'prepared-action_contract-01',
  workspaceId,
  version: 1,
  recommendation: { id: recommendation.todayRecommendationId, version: recommendation.version },
  recommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
  kind: 'PREPARE_CONTENT',
  summary: 'Prepare a bounded content draft for human review.',
  confirmationEffect: 'Creates only Lite-owned preparation state.',
  handoffTarget: 'LITE_CONTENT_PREPARATION',
  sources: [source],
  preparedActionFingerprintSha256: shaA,
  confirmationRequired: true,
  executionAuthorized: false,
  createdAt: '2026-08-11T07:47:00.000Z',
  updatedAt: '2026-08-11T07:47:00.000Z'
} as const satisfies PreparedAction;

function makeClientNotificationPlan(): ClientNotificationHandoffPlanV1 {
  const base = {
    schemaVersion: 1 as const,
    kind: 'CLIENT_NOTIFICATION_HANDOFF' as const,
    workspaceId,
    sourceDraft: {
      owner: 'LITE' as const,
      kind: 'TRADEMARK_SERVICE_COMMUNICATION_DRAFT' as const,
      workPackage: { id: 'trademark-service-work-package_contract-01', version: 2 },
      preparationId: 'trademark-service-preparation_contract-01',
      draftKind: 'CLIENT_INFORMATION_REQUEST' as const,
      draftFingerprintSha256: shaA
    },
    accountRef: 'graph-account_contract-01',
    channel: 'EMAIL' as const,
    sender: { role: 'SENDER' as const, address: 'agent@example.com', displayName: 'Agent' },
    recipients: [
      {
        participant: { role: 'TO' as const, address: 'client@example.com', displayName: 'Client' },
        source: {
          kind: 'WORKSPACE_DIRECTORY_CONTACT' as const,
          directoryEntry: {
            owner: 'LITE' as const,
            kind: 'WORKSPACE_DIRECTORY_ENTRY' as const,
            workspaceId,
            workspaceDirectoryEntryId: 'workspace-directory-entry_contract-01' as const,
            version: 3
          },
          contactPoint: {
            kind: 'EMAIL' as const,
            value: 'client@example.com',
            label: 'client',
            provenance: {
              sourceKind: 'WORKSPACE_USER' as const,
              sourceReference: 'workspace-user_contact-01',
              capturedAt: '2026-08-11T07:46:30.000Z'
            }
          }
        }
      },
      {
        participant: { role: 'CC' as const, address: 'copy@example.com' },
        source: { kind: 'MANUAL_ENTRY' as const }
      }
    ],
    subject: 'Information needed for the trademark matter',
    body: 'Please provide the requested information.',
    attachments: [
      {
        attachmentRef: 'attachment_contract-01',
        fileName: 'request.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 42,
        sha256: shaB
      }
    ],
    relatedWorkItem: {
      owner: 'LITE' as const,
      kind: 'WORK_ITEM' as const,
      workspaceId,
      workItemId: 'work-item_contract-01',
      version: 5
    },
    relatedBusinessRefs: [
      {
        targetKind: 'TRADEMARK_ASSET' as const,
        owner: 'LITE' as const,
        workspaceId,
        trademarkAssetId: 'trademark-asset_contract-01' as const,
        version: 4
      }
    ]
  };
  const reviewedContentFingerprintSha256 = clientNotificationReviewedContentFingerprintSha256V1({
    subject: base.subject,
    body: base.body,
    attachments: base.attachments
  });
  const confirmable: Omit<
    ClientNotificationHandoffPlanV1,
    'confirmationFingerprintSha256' | 'authorityConsequences'
  > = { ...base, reviewedContentFingerprintSha256 };
  return {
    ...confirmable,
    confirmationFingerprintSha256: clientNotificationConfirmationFingerprintSha256V1(confirmable),
    authorityConsequences: noClientNotificationPreparationAuthorityConsequencesV1
  };
}

function withCurrentClientNotificationFingerprint(
  plan: ClientNotificationHandoffPlanV1
): ClientNotificationHandoffPlanV1 {
  const { confirmationFingerprintSha256: _ignored, authorityConsequences, ...confirmable } = plan;
  void _ignored;
  return {
    ...plan,
    confirmationFingerprintSha256: clientNotificationConfirmationFingerprintSha256V1(confirmable),
    authorityConsequences
  };
}

function makeClientNotificationPreparedAction(
  plan: ClientNotificationHandoffPlanV1 = makeClientNotificationPlan()
): PreparedAction {
  return {
    ...preparedAction,
    preparedActionId: 'prepared-action_client-notification-01',
    kind: 'PREPARE_CLIENT_NOTIFICATION',
    handoffTarget: 'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION',
    clientNotificationPlan: plan,
    preparedActionFingerprintSha256: shaB
  };
}

function makeClientNotificationConfirmation(action: PreparedAction): PreparedActionConfirmation {
  const plan = action.clientNotificationPlan;
  if (!plan) throw new TypeError('clientNotificationPlan is required.');
  return {
    schemaVersion: 1,
    preparedAction: { id: action.preparedActionId, version: action.version },
    expectedPreparedActionFingerprintSha256: action.preparedActionFingerprintSha256,
    confirmedByPrincipalId: principalId,
    confirmedAt: '2026-08-11T07:47:30.000Z',
    acknowledgedEffect: 'Send this exact reviewed email through Managed Communication.',
    expectedClientNotificationPlanFingerprintSha256: plan.confirmationFingerprintSha256,
    protectedActionAuthorized: false
  };
}

const contentOpportunity = {
  schemaVersion: 1,
  contentOpportunityId: 'content-opportunity_contract-01',
  workspaceId,
  version: 1,
  sourceRecommendation: {
    id: recommendation.todayRecommendationId,
    version: recommendation.version
  },
  sources: [source],
  title: 'Client-facing update opportunity',
  rationale: 'The source is useful enough to prepare content but does not authorize publication.',
  status: 'ACCEPTED_FOR_PREPARATION',
  contentOpportunityFingerprintSha256: shaA,
  publishAuthorized: false,
  formalBusinessOpportunityCreated: false,
  createdAt: '2026-08-11T07:48:00.000Z',
  updatedAt: '2026-08-11T07:48:00.000Z'
} as const satisfies ContentOpportunity;

const draft = {
  schemaVersion: 1,
  contentDraftId: 'content-draft_contract-01',
  workspaceId,
  version: 2,
  contentOpportunity: { id: contentOpportunity.contentOpportunityId, version: 1 },
  sources: [source],
  title: 'Trademark update',
  body: 'Prepared content body.',
  status: 'READY_FOR_HUMAN_REVIEW',
  contentDraftFingerprintSha256: shaB,
  humanReviewRequired: true,
  published: false,
  createdAt: '2026-08-11T07:49:00.000Z',
  updatedAt: '2026-08-11T07:50:00.000Z'
} as const satisfies ContentDraft;

const review = {
  schemaVersion: 1,
  contentReviewDecisionId: 'content-review-decision_contract-01',
  workspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: draft.version },
  expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
  outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
  reviewerPrincipalId: principalId,
  rationale: 'Approved for package preparation only.',
  reviewedAt: '2026-08-11T07:51:00.000Z',
  publishesExternally: false
} as const satisfies ContentReviewDecision;

const publishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_contract-01',
  workspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: draft.version },
  contentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
  reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
  title: draft.title,
  body: draft.body,
  publishPackageFingerprintSha256: shaA,
  status: 'PREPARED',
  externalPublishExecuted: false,
  createdAt: '2026-08-11T07:52:00.000Z'
} as const satisfies PublishPackage;

const candidate = {
  schemaVersion: 1,
  opportunityCandidateId: 'opportunity-candidate_contract-01',
  workspaceId,
  version: 1,
  kind: 'TRADEMARK_SERVICE',
  customerId: 'customer_contract-01',
  title: 'Potential Canada filing need',
  serviceNeedSummary: 'A user-reported content interaction suggests a possible Canada filing need.',
  sources: [source],
  status: 'UNDER_REVIEW',
  opportunityCandidateFingerprintSha256: shaB,
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-08-11T07:53:00.000Z',
  updatedAt: '2026-08-11T07:53:00.000Z'
} as const satisfies OpportunityCandidate;

const qualification = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_contract-01',
  workspaceId,
  version: 1,
  candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
  expectedCandidateFingerprintSha256: candidate.opportunityCandidateFingerprintSha256,
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: principalId,
  rationale: 'Relevant enough to create a formal MarkReg trademark-service opportunity.',
  decidedAt: '2026-08-11T07:54:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
} as const satisfies OpportunityQualificationDecision;

const formalOpportunity = {
  schemaVersion: 1,
  formalTrademarkServiceOpportunityId: 'trademark-service-opportunity_contract-01',
  workspaceId,
  version: 1,
  owningService: 'MARKREG',
  sourceCandidate: { id: candidate.opportunityCandidateId, version: candidate.version },
  sourceQualificationDecision: {
    id: qualification.opportunityQualificationDecisionId,
    version: qualification.version
  },
  customerId: candidate.customerId,
  serviceNeedSummary: candidate.serviceNeedSummary,
  relationshipModel: 'DIRECT',
  status: 'QUALIFIED',
  formalOpportunityFingerprintSha256: shaA,
  orderCreated: false,
  matterCreated: false,
  paymentCreated: false,
  filingSubmitted: false,
  customerContactedByCreation: false,
  createdAt: '2026-08-11T07:55:00.000Z',
  updatedAt: '2026-08-11T07:55:00.000Z'
} as const satisfies FormalTrademarkServiceOpportunity;

describe('PLC-WP-01 Product loop contract', () => {
  it('locks the Today-driven Product vocabulary without protected-action shortcut states', () => {
    expect(todayRecommendationKinds).toEqual([
      'CONTENT_PREPARATION',
      'OPPORTUNITY_REVIEW',
      'MARKREG_HANDOFF',
      'WORK_FOLLOW_UP'
    ]);
    expect(todayRecommendationStatuses).toEqual([
      'OPEN',
      'ACKNOWLEDGED',
      'DISMISSED',
      'SUPERSEDED'
    ]);
    expect(preparedActionKinds).toContain('START_MARKREG_INTAKE');
    expect(preparedActionKinds).toContain('PREPARE_CLIENT_NOTIFICATION');
    expect(productLoopHandoffTargets).toEqual([
      'LITE_CONTENT_PREPARATION',
      'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      'MARKREG_INTAKE',
      'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION'
    ]);
    expect(productLoopSourceOwners).toContain('KNOWLEDGE');
    expect(productLoopSourceKinds).toContain('KNOWLEDGE_READY_PACKAGE');

    const vocabulary = [
      ...todayRecommendationStatuses,
      ...contentOpportunityStatuses,
      ...contentDraftStatuses,
      ...opportunityCandidateStatuses
    ];
    for (const state of ['PUBLISHED', 'CONTACTED', 'ORDERED', 'FILED', 'PAID', 'APPOINTED'])
      expect(vocabulary).not.toContain(state);
  });

  it('keeps a Today Recommendation broader than lifecycle-specific MarkReg RecommendedAction', () => {
    expect(recommendation.executionAuthorized).toBe(false);
    expect(recommendation.sources[0]?.kind).toBe('KNOWLEDGE_READY_PACKAGE');

    const lifecycleSpecific = {} as RecommendedAction;
    expect('formalMatter' in lifecycleSpecific).toBe(false);
    expect(recommendation).not.toHaveProperty('formalMatter');
    expect(recommendation).not.toHaveProperty('sourceLifecycleView');
  });

  it('separates preparation, human review, package creation and external publication', () => {
    expect(preparedAction.confirmationRequired).toBe(true);
    expect(preparedAction.executionAuthorized).toBe(false);
    expect(contentOpportunity.publishAuthorized).toBe(false);
    expect(draft.humanReviewRequired).toBe(true);
    expect(draft.published).toBe(false);
    expect(contentReviewOutcomes).toEqual([
      'APPROVED_FOR_PUBLISH_PACKAGE',
      'CHANGES_REQUIRED',
      'REJECTED'
    ]);
    expect(review.publishesExternally).toBe(false);
    expect(publishPackage.status).toBe('PREPARED');
    expect(publishPackage.externalPublishExecuted).toBe(false);
  });

  it('binds one reviewed client-notification plan without granting send authority', () => {
    const plan = makeClientNotificationPlan();
    const parsed = parseClientNotificationHandoffPlanV1(plan);
    const action = makeClientNotificationPreparedAction(plan);
    const confirmation = makeClientNotificationConfirmation(action);

    expect(parsed.accountRef).toBe('graph-account_contract-01');
    expect(parsed.recipients[0]?.source.kind).toBe('WORKSPACE_DIRECTORY_CONTACT');
    expect(parsed.authorityConsequences.externalMessageSent).toBe(false);
    expect(parsed.authorityConsequences.customerContactAuthorized).toBe(false);
    expect(parsed.authorityConsequences.legalNoticeEffective).toBe(false);
    expect(parsed.authorityConsequences.productLoop.officialTruthCreated).toBe(false);
    expect(action.executionAuthorized).toBe(false);
    expect(confirmation.protectedActionAuthorized).toBe(false);
    expect(assertClientNotificationPreparedActionConfirmationV1(action, confirmation)).toEqual(
      parsed
    );
  });

  it('fails closed on unsupported keys, wildcard recipients and authoritative consequences', () => {
    const plan = makeClientNotificationPlan();
    expect(() =>
      parseClientNotificationHandoffPlanV1({ ...plan, unsupportedAuthority: true })
    ).toThrow(ClientNotificationHandoffContractError);

    const wildcardRecipient = {
      ...plan,
      recipients: [
        {
          participant: { role: 'TO' as const, address: '*@example.com' },
          source: { kind: 'MANUAL_ENTRY' as const }
        }
      ]
    };
    expect(() => parseClientNotificationHandoffPlanV1(wildcardRecipient)).toThrow(
      ClientNotificationHandoffContractError
    );

    const authoritative = {
      ...plan,
      authorityConsequences: {
        ...plan.authorityConsequences,
        externalMessageSent: true
      }
    };
    expect(() => parseClientNotificationHandoffPlanV1(authoritative)).toThrow(
      ClientNotificationHandoffContractError
    );
  });

  it('invalidates frozen content, account, recipient and business-reference drift', () => {
    const plan = makeClientNotificationPlan();
    const directoryRecipient = plan.recipients[0]!;
    if (directoryRecipient.source.kind !== 'WORKSPACE_DIRECTORY_CONTACT') {
      throw new Error('Expected a Workspace Directory recipient fixture.');
    }

    const driftedPlans = [
      { ...plan, subject: `${plan.subject} changed` },
      { ...plan, accountRef: 'graph-account_contract-02' },
      {
        ...plan,
        recipients: [
          {
            ...directoryRecipient,
            participant: { ...directoryRecipient.participant, address: 'changed@example.com' },
            source: {
              ...directoryRecipient.source,
              contactPoint: {
                ...directoryRecipient.source.contactPoint,
                value: 'changed@example.com'
              }
            }
          },
          ...plan.recipients.slice(1)
        ]
      },
      {
        ...plan,
        relatedBusinessRefs: [
          {
            targetKind: 'TRADEMARK_ASSET' as const,
            owner: 'LITE' as const,
            workspaceId,
            trademarkAssetId: 'trademark-asset_contract-01' as const,
            version: 5
          }
        ]
      }
    ];

    for (const drifted of driftedPlans) {
      expect(() => parseClientNotificationHandoffPlanV1(drifted)).toThrow(
        ClientNotificationHandoffContractError
      );
    }
  });

  it('requires human confirmation to match the exact current client-notification plan', () => {
    const originalPlan = makeClientNotificationPlan();
    const originalAction = makeClientNotificationPreparedAction(originalPlan);
    const originalConfirmation = makeClientNotificationConfirmation(originalAction);
    const changedPlan = withCurrentClientNotificationFingerprint({
      ...originalPlan,
      accountRef: 'graph-account_contract-02'
    });
    const changedAction = makeClientNotificationPreparedAction(changedPlan);

    expect(() => parseClientNotificationHandoffPlanV1(changedPlan)).not.toThrow();
    expect(() =>
      assertClientNotificationPreparedActionConfirmationV1(changedAction, originalConfirmation)
    ).toThrow(ClientNotificationHandoffContractError);
  });

  it('records manual use feedback without fabricating external execution or verification', () => {
    const feedback = {
      schemaVersion: 1,
      productLoopFeedbackId: 'product-loop-feedback_contract-01',
      workspaceId,
      version: 1,
      publishPackage: { id: publishPackage.publishPackageId, version: publishPackage.version },
      outcome: 'USER_REPORTED_PUBLISHED',
      externalReference: 'https://example.invalid/user-reported-post',
      recordedByPrincipalId: principalId,
      recordedAt: '2026-08-11T07:56:00.000Z',
      externalActionExecutedByMarkOrbit: false,
      externalOutcomeVerifiedByMarkOrbit: false
    } as const satisfies ProductLoopUseFeedback;

    expect(productLoopFeedbackOutcomes).toContain(feedback.outcome);
    expect(feedback.externalActionExecutedByMarkOrbit).toBe(false);
    expect(feedback.externalOutcomeVerifiedByMarkOrbit).toBe(false);
  });

  it('requires explicit qualification before a separate MarkReg-owned formal Opportunity', () => {
    expect(opportunityQualificationOutcomes).toEqual([
      'QUALIFIED_FOR_MARKREG',
      'REJECTED',
      'DEFERRED'
    ]);
    expect(candidate.formalOpportunityCreated).toBe(false);
    expect(qualification.formalOpportunityCreated).toBe(false);
    expect(formalOpportunity.owningService).toBe('MARKREG');
    expect(formalOpportunity.sourceCandidate.id).toBe(candidate.opportunityCandidateId);
    expect(formalOpportunity.sourceQualificationDecision.id).toBe(
      qualification.opportunityQualificationDecisionId
    );
    expect(formalOpportunity.orderCreated).toBe(false);
    expect(formalOpportunity.matterCreated).toBe(false);
  });

  it('prepares an explicit MarkReg intake handoff without creating the intake or downstream state', () => {
    const handoff = {
      schemaVersion: 1,
      workspaceId,
      formalOpportunity: {
        id: formalOpportunity.formalTrademarkServiceOpportunityId,
        version: formalOpportunity.version
      },
      expectedFormalOpportunityFingerprintSha256:
        formalOpportunity.formalOpportunityFingerprintSha256,
      target: 'MARKREG_INTAKE',
      channel: 'LITE_PROFESSIONAL',
      relationshipModel: formalOpportunity.relationshipModel,
      customerIntent: {
        brandName: 'NORTHWIND',
        applicantCountry: 'US',
        targetJurisdictions: ['CA'],
        goodsServicesDescription: 'Outdoor apparel and related retail services.'
      },
      confirmedByPrincipalId: principalId,
      confirmedAt: '2026-08-11T07:57:00.000Z',
      intakeCreated: false,
      orderCreated: false,
      matterCreated: false
    } as const satisfies MarkRegIntakeHandoff;

    expect(handoff.target).toBe('MARKREG_INTAKE');
    expect(handoff.channel).toBe('LITE_PROFESSIONAL');
    expect(handoff.intakeCreated).toBe(false);
    expect(handoff.orderCreated).toBe(false);
    expect(handoff.matterCreated).toBe(false);
  });

  it('keeps automatic authority consequences false and AI assistive only', () => {
    expect(
      Object.values(noAutomaticProductLoopConsequences).every((value) => value === false)
    ).toBe(true);
    expect(productLoopAiAuthority.mayExplain).toBe(true);
    expect(productLoopAiAuthority.mayDraftContent).toBe(true);
    expect(productLoopAiAuthority.mayConfirmForUser).toBe(false);
    expect(productLoopAiAuthority.mayApproveContent).toBe(false);
    expect(productLoopAiAuthority.mayPublishExternally).toBe(false);
    expect(productLoopAiAuthority.mayQualifyOpportunity).toBe(false);
    expect(productLoopAiAuthority.mayCreateFormalOpportunity).toBe(false);
    expect(productLoopAiAuthority.mayExecuteProtectedAction).toBe(false);
  });

  it('freezes stale, review, authority, concurrency and dependency failures', () => {
    expect(productLoopErrorCodes).toEqual([
      'STALE_SOURCE',
      'SOURCE_VERSION_MISMATCH',
      'SOURCE_FINGERPRINT_MISMATCH',
      'PERMISSION_DENIED',
      'POLICY_DENIED',
      'CONFIRMATION_REQUIRED',
      'HUMAN_REVIEW_REQUIRED',
      'CANDIDATE_NOT_QUALIFIED',
      'IDEMPOTENCY_CONFLICT',
      'VERSION_CONFLICT',
      'PERSISTENCE_UNAVAILABLE',
      'DEPENDENCY_UNAVAILABLE'
    ]);
  });
});
