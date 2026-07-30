/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- deterministic semantic fixtures seed public in-memory repository adapters. */
import fs from 'node:fs';
import type { Quote } from '@markorbit/contracts';
import { noAuthorizationAuthorityConsequences } from '@markorbit/contracts';
import {
  InMemoryMarkRegRepository,
  InMemoryMatterFlowRepository,
  InMemoryPreparationRepository,
  MatterFlowService,
  PreparationService,
  type MatterFlowError,
  type PreparationError
} from '../../services/markreg/src/index.js';

export const markregSemanticCaseIds = [
  'NP-001',
  'NP-002',
  'NP-003',
  'NP-004',
  'NP-005',
  'NP-008',
  'NP-009',
  'NP-010',
  'NP-011'
] as const;
export type MarkregSemanticCaseId = (typeof markregSemanticCaseIds)[number];

export const negativePathDescriptors = JSON.parse(
  fs.readFileSync(new URL('./milestone-001-negative-path-matrix.json', import.meta.url), 'utf8')
) as Array<{
  caseId: string;
  stage: string;
  expectedDomainErrorCode: string;
  expectedGatewayHttpStatus: number;
  expectedGatewayErrorCode: string;
}>;

export const descriptor = (caseId: MarkregSemanticCaseId) => {
  const value = negativePathDescriptors.find((candidate) => candidate.caseId === caseId);
  if (!value) throw new Error(`Descriptor ${caseId} is missing.`);
  return value;
};

const at = '2026-07-29T12:00:00.000Z';
const future = '2026-08-20T00:00:00.000Z';
const quote = (caseId: MarkregSemanticCaseId): Quote => ({
  quoteId: `quote_milestone-${caseId.toLowerCase()}`,
  intakeId: `intake_milestone-${caseId.toLowerCase()}`,
  recommendationId: `recommendation_milestone-${caseId.toLowerCase()}`,
  selectedOptionCode: 'B',
  pricingRuleVersion: 'quote-v1',
  status: caseId === 'NP-001' ? 'SUPERSEDED' : 'READY',
  currency: 'USD',
  lines: [],
  subtotal: { amountMinor: 0, currency: 'USD' },
  estimatedOfficialFees: { amountMinor: 0, currency: 'USD' },
  estimatedServiceFees: { amountMinor: 0, currency: 'USD' },
  estimatedDisbursements: { amountMinor: 0, currency: 'USD' },
  estimatedTaxes: { amountMinor: 0, currency: 'USD' },
  total: { amountMinor: 0, currency: 'USD' },
  assumptions: [],
  limitations: [],
  validUntil: caseId === 'NP-002' ? '2026-01-01T00:00:00.000Z' : future,
  fixtureOnly: true,
  createdAt: at
});
const acknowledgements = (
  [
    'NO_FILING',
    'NO_PROFESSIONAL_APPOINTMENT',
    'REVIEW_MAY_BE_REQUIRED',
    'SCOPE_CHANGE_REQUOTE'
  ] as const
).map((code) => ({ code, acknowledged: true as const, acknowledgedAt: at }));

export function assertAuthorityConsequencesFalse() {
  const values = Object.values(noAuthorizationAuthorityConsequences);
  if (values.length !== 13 || values.some((value) => value !== false))
    throw new Error('Expected all 13 authority consequences to be false.');
}

export function createMarkregSemanticFixture(caseId: MarkregSemanticCaseId) {
  const repository = new InMemoryMarkRegRepository();
  const matterRepository = new InMemoryMatterFlowRepository();
  const preparationRepository = new InMemoryPreparationRepository();
  const events: unknown[] = [];
  const publisher = {
    publish: (event: unknown) => {
      events.push(event);
      return Promise.resolve();
    }
  };
  const q = quote(caseId);
  repository.saveQuote(q);
  const matterFlow = new MatterFlowService(
    matterRepository,
    (id) => Promise.resolve(repository.getQuote(id)),
    () => at
  );
  const preparation = new PreparationService(
    preparationRepository,
    {
      getReview: async () => undefined,
      getMatterDraft: async () => undefined,
      getConfirmation: async () => undefined
    },
    () => at
  );
  const confirmationId = `confirmation_milestone-${caseId.toLowerCase()}` as const;
  const matterDraftId = `matter-draft_milestone-${caseId.toLowerCase()}` as const;
  const packageId = `document-package_milestone-${caseId.toLowerCase()}` as const;
  const ledgerId = `instruction-ledger_milestone-${caseId.toLowerCase()}` as const;
  const lockId = `preparation-lock_milestone-${caseId.toLowerCase()}` as const;
  const confirmation = {
    schemaVersion: 1,
    confirmationId,
    customerId: `customer_milestone-${caseId.toLowerCase()}`,
    quoteSnapshot: {
      quoteId: q.quoteId,
      quoteVersion: 'quote-v1',
      planId: 'plan_fixture',
      planVersion: 'plan-v1',
      currency: 'USD',
      totalMinor: 0,
      lineItems: []
    },
    confirmedBy: 'actor_fixture',
    confirmedAt: at,
    termsVersion: 'terms-v1',
    acknowledgements,
    status: caseId === 'NP-004' ? 'WITHDRAWN' : 'CONFIRMED',
    createdAt: at,
    updatedAt: at
  } as any;
  if (['NP-003', 'NP-004', 'NP-005'].includes(caseId))
    void matterRepository.createConfirmation(`seed-${caseId}`, `fp-${caseId}`, confirmation);
  if (caseId === 'NP-005')
    void matterRepository.createMatterDraft({
      schemaVersion: 1,
      matterDraftId,
      confirmationId,
      customerId: confirmation.customerId,
      preparation: { classes: [], documentReferences: [] },
      instructionCompleteness: 'INCOMPLETE',
      documentReadiness: 'MISSING',
      readiness: {
        evaluatedAt: at,
        readyForProfessionalReview: false,
        checks: [
          {
            code: 'FILING_BASIS_PRESENT_OR_NOT_REQUIRED',
            status: 'UNKNOWN',
            explanation: 'Fixture UNKNOWN',
            blocking: true
          }
        ]
      },
      missingInformation: ['FILING_BASIS_PRESENT_OR_NOT_REQUIRED'],
      status: 'NEEDS_INFORMATION',
      createdAt: at,
      updatedAt: at
    } as any);
  if (['NP-008', 'NP-009', 'NP-010', 'NP-011'].includes(caseId)) {
    const documentItems =
      caseId === 'NP-009'
        ? [{ documentItemId: 'document-item_superseded', status: 'SUPERSEDED' }]
        : [];
    const packageValue = {
      schemaVersion: 1,
      documentPackageId: packageId,
      version: 1,
      missingRequirements: caseId === 'NP-008' ? ['APPLICANT_IDENTITY_EVIDENCE'] : [],
      documentItems,
      status: caseId === 'NP-008' ? 'NEEDS_DOCUMENTS' : 'READY_FOR_CUSTOMER_CONFIRMATION',
      professionalReviewCaseId: 'professional-review_fixture',
      professionalReviewDecisionVersion: 'review-v1',
      matterDraftVersion: 'matter-v1'
    } as any;
    const ledgerValue = {
      schemaVersion: 1,
      instructionLedgerId: ledgerId,
      documentPackageId: packageId,
      version: 1,
      entries: [],
      status: caseId === 'NP-010' ? 'DRAFT' : 'CONFIRMED'
    } as any;
    void preparationRepository.createPackage(packageValue, `package-key-${caseId}`, `fp-${caseId}`);
    void preparationRepository.createLedger(ledgerValue);
    if (caseId === 'NP-011') {
      void preparationRepository.createLock({
        schemaVersion: 1,
        preparationLockId: lockId,
        documentPackageId: packageId,
        documentPackageVersion: 1,
        instructionLedgerId: ledgerId,
        instructionLedgerVersion: 1,
        lockedAt: at,
        snapshot: { documentPackage: packageValue, instructionLedger: ledgerValue },
        nextPermittedAction: 'GOVERNED_FILING_AUTHORITY_REVIEW',
        consequences: noAuthorizationAuthorityConsequences
      } as any);
      void preparationRepository.savePackage({ ...packageValue, version: 2 });
    }
  }
  const command = {
    quoteId: q.quoteId,
    quoteVersion: 'quote-v1',
    planId: 'plan_fixture' as const,
    planVersion: 'plan-v1',
    customerId: `customer_milestone-${caseId.toLowerCase()}` as const,
    termsVersion: 'terms-v1',
    acknowledgements,
    actor: {
      actorId: 'actor_fixture' as const,
      workplaceId: 'workplace_fixture' as const,
      product: 'MARKREG_COM' as const,
      purpose: `milestone-${caseId.toLowerCase()}`
    },
    idempotencyKey: `key-${caseId.toLowerCase()}`
  };
  const state = () =>
    structuredClone({
      commercial: repository.snapshotSemanticState(),
      matter: matterRepository.snapshotSemanticState(),
      preparation: preparationRepository.snapshotSemanticState(),
      events
    });
  const invoke = async () => {
    if (caseId === 'NP-001' || caseId === 'NP-002') return matterFlow.confirm(command);
    if (caseId === 'NP-003') return matterFlow.createDraft(confirmationId, 'confirmation-v0');
    if (caseId === 'NP-004') return matterFlow.createDraft(confirmationId);
    if (caseId === 'NP-005') return matterFlow.progressDraft(matterDraftId);
    if (caseId === 'NP-011') return preparation.validateLockCurrent(lockId);
    return preparation.lock(packageId, ledgerId);
  };
  const http = () => {
    if (caseId === 'NP-001' || caseId === 'NP-002')
      return {
        method: 'POST',
        path: '/api/markreg/customer-confirmations',
        body: command,
        key: command.idempotencyKey
      };
    if (caseId === 'NP-003')
      return {
        method: 'POST',
        path: '/api/markreg/matter-drafts',
        body: { confirmationId, confirmationVersion: 'confirmation-v0' }
      };
    if (caseId === 'NP-004')
      return { method: 'POST', path: '/api/markreg/matter-drafts', body: { confirmationId } };
    if (caseId === 'NP-005')
      return {
        method: 'POST',
        path: `/api/markreg/matter-drafts/${matterDraftId}/progress`,
        body: {}
      };
    if (caseId === 'NP-011')
      return {
        method: 'POST',
        path: `/api/markreg/preparation-locks/${lockId}/validate-current`,
        body: {}
      };
    return {
      method: 'POST',
      path: '/api/markreg/preparation-locks',
      body: { documentPackageId: packageId, instructionLedgerId: ledgerId }
    };
  };
  return {
    caseId,
    descriptor: descriptor(caseId),
    repository,
    matterRepository,
    preparationRepository,
    publisher,
    events,
    state,
    invoke,
    http
  };
}

export type MarkregSemanticError = MatterFlowError | PreparationError;
