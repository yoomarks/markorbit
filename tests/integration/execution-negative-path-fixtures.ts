/* eslint-disable @typescript-eslint/no-explicit-any -- deterministic fixtures seed the public in-memory persistence adapters. */
import fs from 'node:fs';
import { noAuthorizationAuthorityConsequences } from '@markorbit/contracts';
import {
  FilingGovernanceService,
  InMemoryFilingGovernanceRepository,
  InMemoryProfessionalReviewRepository,
  ProfessionalReviewService,
  type FilingGovernanceError,
  type ProfessionalReviewError
} from '../../services/execution/src/index.js';

export const executionSemanticCaseIds = [
  'NP-006',
  'NP-007',
  'NP-012',
  'NP-013',
  'NP-014',
  'NP-015',
  'NP-016',
  'NP-017'
] as const;
export type ExecutionSemanticCaseId = (typeof executionSemanticCaseIds)[number];
export type ExecutionSemanticError = FilingGovernanceError | ProfessionalReviewError;
const descriptors = JSON.parse(
  fs.readFileSync(new URL('./milestone-001-negative-path-matrix.json', import.meta.url), 'utf8')
) as Array<{
  caseId: string;
  stage: string;
  expectedDomainErrorCode: string;
  expectedGatewayHttpStatus: number;
  expectedGatewayErrorCode: string;
}>;
const descriptor = (caseId: ExecutionSemanticCaseId) => {
  const value = descriptors.find((candidate) => candidate.caseId === caseId);
  if (!value) throw new Error(`Descriptor ${caseId} is missing.`);
  return value;
};
const at = '2026-07-29T12:00:00.000Z';
const expired = '2026-01-01T00:00:00.000Z';
const version = '2:3:2026-07-29T12:00:00.000Z';
const acknowledgementCodes = [
  'APPLICANT_OWNER_CONFIRMED',
  'MARK_CONFIRMED',
  'JURISDICTION_CLASSES_GOODS_CONFIRMED',
  'LOCKED_DOCUMENT_USE_AUTHORIZED',
  'FILING_INSTRUCTION_PREPARATION_AUTHORIZED',
  'AUTHORIZATION_IS_NOT_SUBMISSION',
  'REPRESENTATIVE_APPOINTMENT_MAY_BE_REQUIRED',
  'SCOPE_CHANGE_REQUIRES_REAUTHORIZATION',
  'OFFICE_ACCEPTANCE_NOT_GUARANTEED'
] as const;
const lock = (caseId: ExecutionSemanticCaseId) =>
  ({
    schemaVersion: 1,
    preparationLockId: `preparation-lock_milestone-${caseId.toLowerCase()}`,
    documentPackageId: `document-package_milestone-${caseId.toLowerCase()}`,
    documentPackageVersion: 2,
    instructionLedgerId: `instruction-ledger_milestone-${caseId.toLowerCase()}`,
    instructionLedgerVersion: 3,
    lockedAt: at,
    snapshot: {
      sourceReviewDecisionVersion: 'review-v1',
      sourceMatterDraftVersion: 'matter-v1',
      commercialScopeUnchanged: true,
      documentPackage: {
        schemaVersion: 1,
        documentPackageId: `document-package_milestone-${caseId.toLowerCase()}`,
        version: 2,
        professionalReviewCaseId: `professional-review_milestone-${caseId.toLowerCase()}`,
        professionalReviewDecisionVersion: 'review-v1',
        matterDraftId: `matter-draft_milestone-${caseId.toLowerCase()}`,
        matterDraftVersion: 'matter-v1',
        customerConfirmationId: `confirmation_milestone-${caseId.toLowerCase()}`,
        customerId: `customer_milestone-${caseId.toLowerCase()}`,
        jurisdiction: 'GB',
        trademarkReference: 'MARK ORBIT',
        requirements: [],
        documentItems: [],
        validationChecks: [],
        missingRequirements: [],
        status: 'LOCKED_FOR_PREPARATION',
        createdAt: at,
        updatedAt: at,
        lockedAt: at
      },
      instructionLedger: {
        schemaVersion: 1,
        instructionLedgerId: `instruction-ledger_milestone-${caseId.toLowerCase()}`,
        version: 3,
        documentPackageId: `document-package_milestone-${caseId.toLowerCase()}`,
        documentPackageVersion: 2,
        customerId: `customer_milestone-${caseId.toLowerCase()}`,
        matterDraftId: `matter-draft_milestone-${caseId.toLowerCase()}`,
        matterDraftVersion: 'matter-v1',
        professionalReviewCaseId: `professional-review_milestone-${caseId.toLowerCase()}`,
        professionalReviewDecisionVersion: 'review-v1',
        entries: [],
        acknowledgements: [],
        status: 'LOCKED_FOR_PREPARATION',
        currentEffectiveInstructionSet: {},
        createdAt: at,
        updatedAt: at,
        lockedAt: at
      }
    },
    nextPermittedAction: 'GOVERNED_FILING_AUTHORITY_REVIEW',
    consequences: noAuthorizationAuthorityConsequences
  }) as any;

export function assertExecutionAuthorityConsequencesFalse() {
  const values = Object.values(noAuthorizationAuthorityConsequences);
  if (values.length !== 13 || values.some((value) => value !== false))
    throw new Error('Expected all 13 authority consequences to be false.');
}

export async function createExecutionSemanticFixture(caseId: ExecutionSemanticCaseId) {
  const reviewRepository = new InMemoryProfessionalReviewRepository();
  const filingRepository = new InMemoryFilingGovernanceRepository();
  const sourceDraft = {
    matterDraftId: `matter-draft_milestone-${caseId.toLowerCase()}`,
    matterDraftVersion: 'matter-v1',
    customerId: `customer_milestone-${caseId.toLowerCase()}`,
    confirmationId: `confirmation_milestone-${caseId.toLowerCase()}`,
    status: 'READY_FOR_PROFESSIONAL_REVIEW'
  } as any;
  const review = new ProfessionalReviewService(
    reviewRepository,
    { getMatterDraft: async () => structuredClone(sourceDraft) },
    () => at
  );
  const preparationLock = lock(caseId);
  const filing = new FilingGovernanceService(
    filingRepository as never,
    filingRepository as never,
    filingRepository as never,
    { getPreparationLock: async () => structuredClone(preparationLock) },
    () => at
  );
  const reviewCaseId = `professional-review_milestone-${caseId.toLowerCase()}` as any;
  let taskId: string | undefined;
  if (caseId === 'NP-006' || caseId === 'NP-007') {
    const value = {
      schemaVersion: 1,
      reviewCaseId,
      source: sourceDraft,
      status: caseId === 'NP-007' ? 'STALE' : 'QUEUED',
      priority: 'NORMAL',
      requestedBy: 'actor_fixture',
      createdAt: at,
      updatedAt: at,
      assignment:
        caseId === 'NP-007'
          ? { claimedBy: 'reviewer_fixture', status: 'CLAIMED', professionalAppointed: false }
          : { status: 'UNASSIGNED', professionalAppointed: false },
      checklist: [],
      evidence: []
    } as any;
    await reviewRepository.create(value, `seed-${caseId}`, `fingerprint-${caseId}`);
  } else {
    const auth = await filing.createAuthorization({
      preparationLockId: preparationLock.preparationLockId,
      preparationLockVersion: version,
      authorizedParty: { partyId: 'customer_fixture', displayName: 'Fixture Owner' },
      authorizationCapacity: 'OWNER',
      executionChannel: 'OFFICE_PORTAL',
      idempotencyKey: `authorization-${caseId}`
    });
    if (caseId !== 'NP-012') {
      const confirmed = await filing.confirmAuthorization(auth.filingAuthorizationId, {
        acknowledgementCodes: [...acknowledgementCodes],
        acknowledgedBy: 'customer_fixture',
        idempotencyKey: `confirm-${caseId}`
      });
      if (caseId === 'NP-013')
        await filingRepository.confirm(
          { ...confirmed, expiresAt: expired } as any,
          `seed-expired-${caseId}`,
          `fingerprint-expired-${caseId}`
        );
      if (caseId !== 'NP-013') {
        const release = await filing.createRelease({
          filingAuthorizationId: confirmed.filingAuthorizationId,
          filingAuthorizationVersion: confirmed.version,
          requestedExecutionChannel: 'OFFICE_PORTAL',
          idempotencyKey: `release-${caseId}`
        });
        if (caseId === 'NP-014' || caseId === 'NP-015') {
          await filingRepository.evaluateChecks({
            ...release,
            status: 'BLOCKED',
            checks: release.checks.map((check, index) =>
              index === 0
                ? { ...check, status: caseId === 'NP-014' ? 'FAIL' : 'UNKNOWN' }
                : { ...check, status: 'PASS' }
            )
          } as any);
        }
        if (caseId === 'NP-016') {
          /* the created DRAFT is the existing active release */
        }
        if (caseId === 'NP-017') {
          await filingRepository.evaluateChecks({
            ...release,
            status: 'READY_FOR_RELEASE',
            checks: release.checks.map((check) => ({ ...check, status: 'PASS' }))
          } as any);
          await filing.assign(release.executionReleaseId, {
            internalExecutorId: 'executor_fixture'
          });
          const released = await filing.release(release.executionReleaseId, {
            decidedBy: 'reviewer_fixture',
            rationale: 'Fixture release.',
            idempotencyKey: `decision-${caseId}`
          });
          taskId = released.taskDraft!.filingExecutionTaskDraftId;
          await filingRepository.markStale({ ...confirmed, status: 'STALE' } as any);
        }
      }
    }
  }
  const state = async () =>
    structuredClone({
      reviews: await reviewRepository.list(),
      filing: await filingRepository.snapshot(),
      reviewIdempotency: reviewRepository.snapshotIdempotencyCount(),
      filingIdempotency: filingRepository.snapshotIdempotencyCount()
    });
  const invoke = async () => {
    if (caseId === 'NP-006')
      return review.create({
        matterDraftId: sourceDraft.matterDraftId,
        matterDraftVersion: sourceDraft.matterDraftVersion,
        idempotencyKey: 'duplicate-new-key',
        requestedBy: 'actor_fixture'
      });
    if (caseId === 'NP-007')
      return review.complete(
        reviewCaseId,
        'reviewer_fixture',
        'MARK_READY_FOR_NEXT_STEP',
        'Stale attempt'
      );
    const snapshot = await filingRepository.snapshot();
    const auth = snapshot.filingAuthorizations[0]!;
    const release = snapshot.executionReleases[0];
    if (caseId === 'NP-012')
      return filing.confirmAuthorization(auth.filingAuthorizationId, {
        acknowledgementCodes: acknowledgementCodes.slice(1),
        acknowledgedBy: 'customer_fixture',
        idempotencyKey: 'missing-ack'
      });
    if (caseId === 'NP-013')
      return filing.createRelease({
        filingAuthorizationId: auth.filingAuthorizationId,
        filingAuthorizationVersion: auth.version,
        requestedExecutionChannel: 'OFFICE_PORTAL',
        idempotencyKey: 'expired-release'
      });
    if (caseId === 'NP-016')
      return filing.createRelease({
        filingAuthorizationId: auth.filingAuthorizationId,
        filingAuthorizationVersion: auth.version,
        requestedExecutionChannel: 'OFFICE_PORTAL',
        idempotencyKey: 'duplicate-release'
      });
    if (caseId === 'NP-017') return filing.validateTaskCurrent(taskId as any);
    return filing.release(release!.executionReleaseId, {
      decidedBy: 'reviewer_fixture',
      rationale: 'Blocked attempt',
      idempotencyKey: `blocked-${caseId}`
    });
  };
  const http = async () => {
    const snapshot = await filingRepository.snapshot();
    if (caseId === 'NP-006')
      return {
        method: 'POST',
        path: '/api/lite/professional-review-cases',
        body: {
          matterDraftId: sourceDraft.matterDraftId,
          matterDraftVersion: sourceDraft.matterDraftVersion,
          requestedBy: 'actor_fixture'
        },
        key: 'duplicate-new-key'
      };
    if (caseId === 'NP-007')
      return {
        method: 'POST',
        path: `/api/lite/professional-review-cases/${reviewCaseId}/complete`,
        body: {
          reviewerId: 'reviewer_fixture',
          code: 'MARK_READY_FOR_NEXT_STEP',
          rationale: 'Stale attempt'
        }
      };
    const auth = snapshot.filingAuthorizations[0]!;
    const release = snapshot.executionReleases[0];
    if (caseId === 'NP-012')
      return {
        method: 'POST',
        path: `/api/execution/filing-authorizations/${auth.filingAuthorizationId}/confirm`,
        body: {
          acknowledgementCodes: acknowledgementCodes.slice(1),
          acknowledgedBy: 'customer_fixture'
        },
        key: 'missing-ack'
      };
    if (caseId === 'NP-013' || caseId === 'NP-016')
      return {
        method: 'POST',
        path: '/api/execution/execution-releases',
        body: {
          filingAuthorizationId: auth.filingAuthorizationId,
          filingAuthorizationVersion: auth.version,
          requestedExecutionChannel: 'OFFICE_PORTAL'
        },
        key: caseId === 'NP-013' ? 'expired-release' : 'duplicate-release'
      };
    if (caseId === 'NP-017')
      return {
        method: 'POST',
        path: `/api/execution/filing-task-drafts/${taskId}/validate-current`,
        body: {}
      };
    return {
      method: 'POST',
      path: `/api/execution/execution-releases/${release!.executionReleaseId}/release`,
      body: { decidedBy: 'reviewer_fixture', rationale: 'Blocked attempt' },
      key: `blocked-${caseId}`
    };
  };
  return {
    caseId,
    descriptor: descriptor(caseId),
    reviewRepository,
    filingRepository,
    preparationLock,
    review,
    filing,
    state,
    invoke,
    http,
    expectedPostState: async (before: Awaited<ReturnType<typeof state>>) =>
      caseId === 'NP-017'
        ? {
            ...before,
            filing: {
              ...before.filing,
              filingExecutionTaskDrafts: before.filing.filingExecutionTaskDrafts.map((task) => ({
                ...task,
                status: 'STALE'
              }))
            }
          }
        : before
  };
}
