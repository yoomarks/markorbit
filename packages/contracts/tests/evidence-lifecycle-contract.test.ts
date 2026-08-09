import { describe, expect, it } from 'vitest';
import type { FormalMatter } from '../src/index.js';
import type { ProviderReturn } from '../src/provider-execution.js';
import {
  evidenceLifecycleAiAuthority,
  evidenceLifecycleErrorCodes,
  evidenceReviewAuthorityConsequences,
  evidenceReviewOutcomes,
  lifecycleProjectionAuthorityConsequences,
  lifecycleProjectionStates,
  recommendedActionAuthorityConsequences,
  recommendedActionStatuses,
  reviewedSourceAdmissionAuthorityConsequences,
  type CurrentLifecycleView,
  type EvidenceReviewDecision,
  type EvidenceReviewSource,
  type LifecycleEventProjection,
  type RecommendedAction,
  type RecordEvidenceReviewDecisionCommand,
  type ReviewedSourceAdmissionEnvelope
} from '../src/evidence-lifecycle.js';

const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);
const shaC = 'c'.repeat(64);
const workspaceId = 'workspace_customer-01';
const correlationId = 'correlation_m5-01' as const;

const source = {
  schemaVersion: 1,
  workspaceId,
  evidenceReceipt: { id: 'evidence-receipt_contract-01', version: 3 },
  evidenceReceiptFingerprintSha256: shaA,
  evidenceHandoffId: 'evidence-handoff_contract-01',
  providerReturn: { id: 'provider-return_contract-01', version: 2 },
  providerReturnFingerprintSha256: shaB,
  providerId: 'provider_contract-01',
  correlationId,
  capturedAt: '2026-08-10T00:00:00.000Z'
} as const satisfies EvidenceReviewSource;

const decision = {
  schemaVersion: 1,
  evidenceReviewDecisionId: 'evidence-review-decision_contract-01',
  workspaceId,
  version: 1,
  source,
  outcome: 'ADMITTED_FOR_INTERNAL_USE',
  reviewerPrincipalId: 'principal_reviewer-01',
  rationale: 'Evidence is sufficient for bounded internal lifecycle use.',
  correctionReasons: [],
  decisionFingerprintSha256: shaC,
  reviewedAt: '2026-08-10T00:05:00.000Z',
  correlationId
} as const satisfies EvidenceReviewDecision;

const admission = {
  schemaVersion: 1,
  reviewedSourceAdmissionId: 'reviewed-source-admission_contract-01',
  workspaceId,
  version: 1,
  formalMatter: { id: 'formal-matter_contract-01', version: 4 },
  reviewDecision: { id: decision.evidenceReviewDecisionId, version: decision.version },
  reviewDecisionFingerprintSha256: decision.decisionFingerprintSha256,
  evidenceSource: source,
  admittedEvidenceReferences: ['artifact:provider-receipt'],
  admissionFingerprintSha256: shaA,
  admittedAt: '2026-08-10T00:06:00.000Z',
  correlationId
} as const satisfies ReviewedSourceAdmissionEnvelope;

const event = {
  schemaVersion: 1,
  lifecycleEventId: 'lifecycle-event_contract-01',
  workspaceId,
  formalMatter: admission.formalMatter,
  version: 1,
  source: {
    reviewedSourceAdmission: { id: admission.reviewedSourceAdmissionId, version: admission.version },
    admissionFingerprintSha256: admission.admissionFingerprintSha256,
    evidenceReviewDecision: { id: decision.evidenceReviewDecisionId, version: decision.version },
    evidenceReceipt: source.evidenceReceipt,
    providerReturn: source.providerReturn,
    formalMatter: admission.formalMatter
  },
  state: 'REVIEWED_PROVIDER_EVIDENCE',
  eventCode: 'PROVIDER_EVIDENCE_REVIEWED_FOR_INTERNAL_USE',
  customerSafeLabel: 'Evidence reviewed',
  customerSafeSummary: 'Evidence has been reviewed for internal workflow use.',
  occurredAt: decision.reviewedAt,
  projectedAt: '2026-08-10T00:07:00.000Z',
  lifecycleEventFingerprintSha256: shaB,
  officialStatusVerified: false,
  correlationId
} as const satisfies LifecycleEventProjection;

const view = {
  schemaVersion: 1,
  lifecycleViewId: 'lifecycle-view_contract-01',
  workspaceId,
  formalMatter: admission.formalMatter,
  version: 1,
  currentEvent: { id: event.lifecycleEventId, version: event.version },
  currentEventFingerprintSha256: event.lifecycleEventFingerprintSha256,
  state: event.state,
  customerSafeLabel: event.customerSafeLabel,
  customerSafeSummary: event.customerSafeSummary,
  lifecycleViewFingerprintSha256: shaC,
  officialStatusVerified: false,
  updatedAt: event.projectedAt
} as const satisfies CurrentLifecycleView;

describe('Milestone 5 evidence lifecycle contract', () => {
  it('locks bounded vocabulary', () => {
    expect(evidenceReviewOutcomes).toEqual(['ADMITTED_FOR_INTERNAL_USE', 'CORRECTION_REQUIRED', 'REJECTED']);
    expect(lifecycleProjectionStates).toEqual(['INTERNAL_PROCESSING', 'REVIEWED_PROVIDER_EVIDENCE', 'CUSTOMER_ACTION_NEEDED', 'WAITING_NO_ACTION', 'CORRECTION_OR_REVIEW_ISSUE']);
    expect(recommendedActionStatuses).toEqual(['OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'SUPPRESSED']);
    const vocabulary = [...evidenceReviewOutcomes, ...lifecycleProjectionStates, ...recommendedActionStatuses];
    for (const state of ['FILED', 'OFFICIAL', 'PAID', 'INVOICED', 'EXECUTED']) expect(vocabulary).not.toContain(state);
  });

  it('preserves exact M4 evidence lineage with a distinct review receipt identity', () => {
    const providerReturnId: ProviderReturn['providerReturnId'] = source.providerReturn.id;
    expect(providerReturnId).toBe('provider-return_contract-01');
    expect(source.evidenceReceipt.id).not.toBe(source.providerReturn.id);
    expect(source.evidenceReceiptFingerprintSha256).toHaveLength(64);
  });

  it('binds review to exact evidence and authenticated reviewer record', () => {
    const command = {
      workspaceId,
      evidenceReceiptId: source.evidenceReceipt.id,
      expectedEvidenceReceiptVersion: source.evidenceReceipt.version,
      expectedEvidenceReceiptFingerprintSha256: source.evidenceReceiptFingerprintSha256,
      outcome: decision.outcome,
      rationale: decision.rationale,
      correctionReasons: [],
      idempotencyKey: 'review:decision:1',
      correlationId
    } satisfies RecordEvidenceReviewDecisionCommand;
    expect(command).not.toHaveProperty('reviewerPrincipalId');
    expect(decision.reviewerPrincipalId).toBe('principal_reviewer-01');
    expect(decision).not.toHaveProperty('officialApplicationNumber');
  });

  it('requires admitted review lineage before Matter lifecycle projection', () => {
    const matterId: FormalMatter['formalMatterId'] = admission.formalMatter.id;
    expect(matterId).toBe('formal-matter_contract-01');
    expect(admission.reviewDecision.id).toBe(decision.evidenceReviewDecisionId);
    expect(event.source.reviewedSourceAdmission.id).toBe(admission.reviewedSourceAdmissionId);
    expect(event.officialStatusVerified).toBe(false);
    expect(view.officialStatusVerified).toBe(false);
  });

  it('keeps Recommended Action non-executing', () => {
    const action = {
      schemaVersion: 1,
      recommendedActionId: 'recommended-action_contract-01',
      workspaceId,
      formalMatter: admission.formalMatter,
      version: 1,
      sourceLifecycleView: { id: view.lifecycleViewId, version: view.version },
      sourceLifecycleViewFingerprintSha256: view.lifecycleViewFingerprintSha256,
      policyVersion: 'm5-policy-v1',
      actionCode: 'NO_ACTION_CURRENTLY_REQUIRED',
      title: 'No action currently required',
      explanation: 'The current governed lifecycle view does not require customer action.',
      status: 'OPEN',
      recommendedActionFingerprintSha256: shaA,
      executionAuthorized: false,
      createdAt: '2026-08-10T00:08:00.000Z',
      updatedAt: '2026-08-10T00:08:00.000Z'
    } as const satisfies RecommendedAction;
    expect(action.executionAuthorized).toBe(false);
  });

  it('locks controlled failure vocabulary', () => {
    expect(evidenceLifecycleErrorCodes).toEqual(['STALE_SOURCE', 'SOURCE_VERSION_MISMATCH', 'SOURCE_FINGERPRINT_MISMATCH', 'PERMISSION_DENIED', 'POLICY_DENIED', 'IDEMPOTENCY_CONFLICT', 'VERSION_CONFLICT', 'REVIEW_DECISION_NOT_ADMISSIBLE', 'LIFECYCLE_SOURCE_NOT_ADMITTED', 'RECOMMENDATION_SOURCE_STALE', 'PERSISTENCE_UNAVAILABLE', 'DEPENDENCY_UNAVAILABLE']);
  });

  it('keeps all internal stages outside external authority', () => {
    expect(evidenceReviewAuthorityConsequences).toMatchObject({ evidenceReviewDecisionRecorded: true, reviewedSourceAdmitted: false, filingSubmitted: false });
    expect(reviewedSourceAdmissionAuthorityConsequences).toMatchObject({ reviewedSourceAdmitted: true, lifecycleProjectionCreated: false, trademarkOfficeAcceptance: false });
    expect(lifecycleProjectionAuthorityConsequences).toMatchObject({ lifecycleProjectionCreated: true, recommendedActionCreated: false, formalMatterCompletedAutomatically: false });
    expect(recommendedActionAuthorityConsequences).toMatchObject({ recommendedActionCreated: true, recommendedActionExecutedAutomatically: false, paymentCreated: false, invoiceCreated: false, filingSubmitted: false, userCapabilityVerifiedAutomatically: false });
  });

  it('freezes AI as assistance only', () => {
    expect(evidenceLifecycleAiAuthority.maySummarizeEvidence).toBe(true);
    expect(evidenceLifecycleAiAuthority.maySuggestRecommendedActionCandidates).toBe(true);
    expect(evidenceLifecycleAiAuthority.mayRecordAuthoritativeReviewDecision).toBe(false);
    expect(evidenceLifecycleAiAuthority.mayExecuteRecommendedAction).toBe(false);
    expect(evidenceLifecycleAiAuthority.mayCreateOfficialTruth).toBe(false);
  });
});
