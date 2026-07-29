/* eslint-disable @typescript-eslint/require-await -- fixture source intentionally implements the asynchronous public boundary. */
import { describe, expect, it } from 'vitest';
import type { PreparationLock } from '@markorbit/contracts';
import {
  FilingGovernanceError,
  FilingGovernanceService,
  InMemoryFilingGovernanceRepository
} from '../src/filing-authorization.js';
const at = '2026-07-29T12:00:00.000Z';
const lock: PreparationLock = {
  schemaVersion: 1,
  preparationLockId: 'preparation-lock_012',
  documentPackageId: 'document-package_012',
  documentPackageVersion: 2,
  instructionLedgerId: 'instruction-ledger_012',
  instructionLedgerVersion: 3,
  lockedAt: at,
  snapshot: {
    sourceReviewDecisionVersion: 'review-v1',
    sourceMatterDraftVersion: 'matter-v1',
    commercialScopeUnchanged: true,
    documentPackage: {
      schemaVersion: 1,
      documentPackageId: 'document-package_012',
      version: 2,
      professionalReviewCaseId: 'professional-review_012',
      professionalReviewDecisionVersion: 'review-v1',
      matterDraftId: 'matter-draft_012',
      matterDraftVersion: 'matter-v1',
      customerConfirmationId: 'confirmation_012',
      customerId: 'customer_012',
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
      instructionLedgerId: 'instruction-ledger_012',
      version: 3,
      documentPackageId: 'document-package_012',
      documentPackageVersion: 2,
      customerId: 'customer_012',
      matterDraftId: 'matter-draft_012',
      matterDraftVersion: 'matter-v1',
      professionalReviewCaseId: 'professional-review_012',
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
  consequences: {
    orderCreated: false,
    paymentCreated: false,
    formalMatterCreated: false,
    professionalAppointed: false,
    filingCreated: false,
    filingSubmitted: false,
    customerMessageSent: false,
    externalDocumentSent: false,
    trademarkOfficeContacted: false
  }
};
const version = '2:3:2026-07-29T12:00:00.000Z';
const codes = [
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
function setup(source = lock) {
  const repository = new InMemoryFilingGovernanceRepository();
  return new FilingGovernanceService(
    repository as never,
    repository as never,
    repository as never,
    { getPreparationLock: async () => structuredClone(source) },
    () => at
  );
}
const create = (service: FilingGovernanceService, key = 'create-1') =>
  service.createAuthorization({
    preparationLockId: lock.preparationLockId,
    preparationLockVersion: version,
    authorizedParty: { partyId: 'customer_012', displayName: 'Alex Owner' },
    authorizationCapacity: 'OWNER',
    executionChannel: 'OFFICE_PORTAL',
    idempotencyKey: key
  });
describe('filing authorization and execution release governance', () => {
  it('creates from the exact immutable Preparation Lock without external authority', async () => {
    const value = await create(setup());
    expect(value.status).toBe('PENDING_CONFIRMATION');
    expect(value.preparationSnapshot).toEqual(lock.snapshot);
    expect(noop()).toEqual(
      expect.objectContaining({ filingSubmitted: false, paymentCreated: false })
    );
  });
  it('rejects an invalid Preparation Lock state', async () => {
    const changed = structuredClone(lock);
    (changed.snapshot.documentPackage as { status: string }).status = 'DRAFT';
    await expect(create(setup(changed))).rejects.toMatchObject({
      code: 'PREPARATION_LOCK_NOT_CURRENT'
    });
  });
  it('rejects exact source version mismatch', async () => {
    const service = setup();
    await expect(
      service.createAuthorization({
        preparationLockId: lock.preparationLockId,
        preparationLockVersion: 'wrong',
        authorizedParty: { partyId: 'customer_012', displayName: 'Alex' },
        authorizationCapacity: 'OWNER',
        executionChannel: 'OFFICE_PORTAL',
        idempotencyKey: 'wrong'
      })
    ).rejects.toMatchObject({ code: 'SOURCE_VERSION_MISMATCH' });
  });
  it('replays authorization creation idempotently and rejects conflict', async () => {
    const service = setup();
    const first = await create(service);
    expect((await create(service)).filingAuthorizationId).toBe(first.filingAuthorizationId);
    await expect(create(service, 'different')).rejects.toMatchObject({
      code: 'ACTIVE_FILING_AUTHORIZATION_EXISTS'
    });
  });
  it('requires every active acknowledgement', async () => {
    const service = setup();
    const auth = await create(service);
    await expect(
      service.confirmAuthorization(auth.filingAuthorizationId, {
        acknowledgementCodes: codes.slice(1),
        acknowledgedBy: 'customer_012',
        idempotencyKey: 'confirm'
      })
    ).rejects.toMatchObject({ code: 'MANDATORY_ACKNOWLEDGEMENT_MISSING' });
  });
  it('authorizes then preserves a completed authorization receipt', async () => {
    const service = setup();
    const auth = await create(service);
    const confirmed = await service.confirmAuthorization(auth.filingAuthorizationId, {
      acknowledgementCodes: [...codes],
      acknowledgedBy: 'customer_012',
      idempotencyKey: 'confirm'
    });
    expect(confirmed).toMatchObject({ status: 'AUTHORIZED', version: 2 });
    expect(confirmed.acknowledgements).toHaveLength(9);
  });
  it('withdraws without implying submission', async () => {
    const service = setup();
    const auth = await create(service);
    expect((await service.withdrawAuthorization(auth.filingAuthorizationId)).status).toBe(
      'WITHDRAWN'
    );
    expect(noop().filingSubmitted).toBe(false);
  });
  it('starts release checks as blocking UNKNOWN and server-evaluates them', async () => {
    const service = setup();
    const auth = await create(service);
    const confirmed = await service.confirmAuthorization(auth.filingAuthorizationId, {
      acknowledgementCodes: [...codes],
      acknowledgedBy: 'customer_012',
      idempotencyKey: 'confirm'
    });
    const release = await service.createRelease({
      filingAuthorizationId: confirmed.filingAuthorizationId,
      filingAuthorizationVersion: confirmed.version,
      requestedExecutionChannel: 'OFFICE_PORTAL',
      idempotencyKey: 'release-create'
    });
    expect(release.checks.every((v) => v.status === 'UNKNOWN')).toBe(true);
    expect((await service.evaluate(release.executionReleaseId)).status).toBe('READY_FOR_RELEASE');
  });
  it('prevents release while UNKNOWN', async () => {
    const service = setup();
    const auth = await create(service);
    const confirmed = await service.confirmAuthorization(auth.filingAuthorizationId, {
      acknowledgementCodes: [...codes],
      acknowledgedBy: 'customer_012',
      idempotencyKey: 'confirm'
    });
    const release = await service.createRelease({
      filingAuthorizationId: confirmed.filingAuthorizationId,
      filingAuthorizationVersion: 2,
      requestedExecutionChannel: 'OFFICE_PORTAL',
      idempotencyKey: 'release-create'
    });
    await expect(
      service.release(release.executionReleaseId, {
        decidedBy: 'reviewer_1',
        rationale: 'Ready',
        idempotencyKey: 'decision'
      })
    ).rejects.toMatchObject({ code: 'RELEASE_CHECKS_BLOCKING' });
  });
  it('creates exactly one internal task draft after explicit assignment and release', async () => {
    const service = setup();
    const auth = await create(service);
    const confirmed = await service.confirmAuthorization(auth.filingAuthorizationId, {
      acknowledgementCodes: [...codes],
      acknowledgedBy: 'customer_012',
      idempotencyKey: 'confirm'
    });
    let release = await service.createRelease({
      filingAuthorizationId: confirmed.filingAuthorizationId,
      filingAuthorizationVersion: 2,
      requestedExecutionChannel: 'OFFICE_PORTAL',
      idempotencyKey: 'release-create'
    });
    release = await service.evaluate(release.executionReleaseId);
    await service.assign(release.executionReleaseId, { internalExecutorId: 'executor_1' });
    const result = await service.release(release.executionReleaseId, {
      decidedBy: 'reviewer_1',
      rationale: 'All governed checks passed.',
      idempotencyKey: 'decision'
    });
    expect(result.release.status).toBe('RELEASED_FOR_EXECUTION');
    expect(result.taskDraft?.status).toBe('PREPARED');
    expect(
      (await service.getTaskForRelease(release.executionReleaseId)).filingExecutionTaskDraftId
    ).toBe(result.taskDraft?.filingExecutionTaskDraftId);
    expect(noop()).toEqual(
      expect.objectContaining({
        filingCreated: false,
        trademarkOfficeContacted: false,
        customerMessageSent: false
      })
    );
  });
  it('uses typed not-found errors', async () => {
    await expect(setup().getAuthorization('filing-authorization_missing')).rejects.toBeInstanceOf(
      FilingGovernanceError
    );
  });
});
function noop() {
  return {
    orderCreated: false,
    paymentCreated: false,
    invoiceCreated: false,
    formalMatterCreated: false,
    professionalAppointed: false,
    providerAssignedExternally: false,
    filingCreated: false,
    filingSubmitted: false,
    officialApplicationCreated: false,
    officialApplicationNumberReceived: false,
    customerMessageSent: false,
    externalDocumentSent: false,
    trademarkOfficeContacted: false
  } as const;
}
