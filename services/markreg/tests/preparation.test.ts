import { describe, expect, it } from 'vitest';
/* eslint-disable @typescript-eslint/require-await -- Fixture source methods implement the asynchronous public source boundary. */
import type {
  CustomerConfirmation,
  MatterDraft,
  ProfessionalReviewCase
} from '@markorbit/contracts';
import {
  InMemoryPreparationRepository,
  PreparationError,
  PreparationService
} from '../src/preparation.js';

const at = '2026-07-29T12:00:00.000Z';
const confirmation: CustomerConfirmation = {
  schemaVersion: 1,
  confirmationId: 'confirmation_c1',
  customerId: 'customer_c1',
  quoteSnapshot: {
    quoteId: 'quote_q1',
    quoteVersion: 'v1',
    planId: 'plan_p1',
    planVersion: 'v1',
    currency: 'USD',
    totalMinor: 1,
    lineItems: []
  },
  confirmedBy: 'customer_c1',
  confirmedAt: at,
  termsVersion: 'v1',
  acknowledgements: [],
  status: 'CONFIRMED',
  createdAt: at,
  updatedAt: at
};
const matter: MatterDraft = {
  schemaVersion: 1,
  matterDraftId: 'matter-draft_m1',
  confirmationId: confirmation.confirmationId,
  customerId: confirmation.customerId,
  preparation: {
    applicantName: 'Ada Ltd',
    applicantAddress: '1 Main St',
    trademark: 'ORBIT',
    targetJurisdiction: 'US',
    classes: [9],
    goodsServices: 'Software',
    filingBasis: 'INTENT_TO_USE',
    representativeRequired: false,
    documentReferences: [],
    commercialScopeUnchanged: true
  },
  instructionCompleteness: 'COMPLETE',
  documentReadiness: 'READY',
  readiness: { evaluatedAt: at, checks: [], readyForProfessionalReview: true },
  missingInformation: [],
  status: 'READY_FOR_PROFESSIONAL_REVIEW',
  createdAt: at,
  updatedAt: at
};
const review: ProfessionalReviewCase = {
  schemaVersion: 1,
  reviewCaseId: 'professional-review_r1',
  source: {
    schemaVersion: 1,
    matterDraftId: matter.matterDraftId,
    matterDraftVersion: 'matter-v1',
    confirmationId: confirmation.confirmationId,
    customerId: confirmation.customerId,
    status: matter.status,
    preparation: matter.preparation,
    readiness: matter.readiness,
    readinessTimestamp: at
  },
  status: 'REVIEWED_READY_FOR_NEXT_STEP',
  priority: 'NORMAL',
  requestedBy: 'customer_c1',
  createdAt: at,
  updatedAt: at,
  assignment: { status: 'CLAIMED', professionalAppointed: false },
  checklist: [],
  evidence: [],
  decision: {
    code: 'MARK_READY_FOR_NEXT_STEP',
    reviewerId: 'reviewer_r1',
    decidedAt: 'decision-v1',
    rationale: 'Ready',
    checklistSnapshot: [],
    evidenceReferences: [],
    sourceMatterDraftVersion: 'matter-v1',
    consequences: {
      orderCreated: false,
      paymentCreated: false,
      formalMatterCreated: false,
      providerAppointed: false,
      filingCreated: false,
      customerMessageSent: false
    }
  }
};
function setup(overrides: Partial<ProfessionalReviewCase> = {}) {
  const repo = new InMemoryPreparationRepository();
  const service = new PreparationService(
    repo,
    {
      getReview: async () => ({ ...review, ...overrides }),
      getMatterDraft: async () => matter,
      getConfirmation: async () => confirmation
    },
    () => at
  );
  return { service, repo };
}
const command = {
  professionalReviewCaseId: review.reviewCaseId,
  professionalReviewDecisionVersion: 'decision-v1',
  matterDraftVersion: 'matter-v1',
  idempotencyKey: 'key-1'
};
const reference = {
  fileName: 'identity.pdf',
  contentType: 'application/pdf',
  byteSize: 100,
  checksum: 'sha256:fixture',
  uploadedAt: at,
  uploadedBy: 'customer_c1' as const,
  source: 'FIXTURE' as const,
  originalOrCopy: 'COPY' as const,
  language: 'en',
  signatureStatus: 'NOT_REQUIRED' as const,
  notarizationStatus: 'NOT_REQUIRED' as const,
  legalizationStatus: 'NOT_REQUIRED' as const
};

describe('governed preparation', () => {
  it('creates a package with server-derived illustrative requirements', async () => {
    const p = await setup().service.createPackage(command);
    expect(p.status).toBe('NEEDS_DOCUMENTS');
    expect(p.requirements).toHaveLength(2);
    expect(
      p.requirements.every(
        (x) => x.fixtureOnly && x.reason.includes('not authoritative legal advice')
      )
    ).toBe(true);
  });
  it('rejects a review that is not complete', async () => {
    await expect(
      setup({ status: 'IN_REVIEW' }).service.createPackage(command)
    ).rejects.toMatchObject({ code: 'SOURCE_REVIEW_NOT_READY' });
  });
  it('requires the exact review decision version', async () => {
    await expect(
      setup().service.createPackage({ ...command, professionalReviewDecisionVersion: 'wrong' })
    ).rejects.toMatchObject({ code: 'REVIEW_DECISION_VERSION_MISMATCH' });
  });
  it('replays an idempotent create and rejects conflicting reuse', async () => {
    const s = setup().service;
    const first = await s.createPackage(command);
    expect((await s.createPackage(command)).documentPackageId).toBe(first.documentPackageId);
    await expect(
      s.createPackage({ ...command, matterDraftVersion: 'other' })
    ).rejects.toBeInstanceOf(PreparationError);
  });
  it('requires explicit supersession instead of silent replacement', async () => {
    const s = setup().service,
      p = await s.createPackage(command);
    const item = await s.addDocument(p.documentPackageId, {
      requirementCode: 'APPLICANT_IDENTITY_EVIDENCE',
      documentType: 'IDENTITY',
      documentReference: reference,
      suppliedBy: 'customer_c1'
    });
    await expect(
      s.addDocument(p.documentPackageId, {
        requirementCode: 'APPLICANT_IDENTITY_EVIDENCE',
        documentType: 'IDENTITY',
        documentReference: reference,
        suppliedBy: 'customer_c1'
      })
    ).rejects.toMatchObject({ code: 'DOCUMENT_REPLACEMENT_REQUIRES_SUPERSEDE' });
    const replacement = await s.supersedeDocument(p.documentPackageId, item.documentItemId, {
      documentType: 'IDENTITY',
      documentReference: { ...reference, fileName: 'identity-v2.pdf' },
      suppliedBy: 'customer_c1'
    });
    expect(replacement).toMatchObject({
      version: 2,
      supersedesDocumentItemId: item.documentItemId
    });
  });
  it('does not treat missing or blocking checks as ready', async () => {
    const s = setup().service,
      p = await s.createPackage(command);
    expect((await s.evaluate(p.documentPackageId)).status).toBe('NEEDS_DOCUMENTS');
  });
  it('keeps confirmed instruction history immutable and append-only', async () => {
    const s = setup().service,
      p = await s.createPackage(command),
      l = await s.createLedger(p.documentPackageId);
    const e = await s.appendInstruction(l.instructionLedgerId, {
      type: 'APPLICANT_IDENTITY',
      structuredValue: { name: 'Ada Ltd' }
    });
    await s.confirmInstruction(l.instructionLedgerId, e.instructionEntryId);
    const next = await s.appendInstruction(l.instructionLedgerId, {
      type: 'APPLICANT_IDENTITY',
      structuredValue: { name: 'Ada LLC' },
      supersedesInstructionEntryId: e.instructionEntryId
    });
    const current = await s.getLedger(l.instructionLedgerId);
    expect(current.entries).toHaveLength(2);
    expect(current.entries[0]?.status).toBe('SUPERSEDED');
    expect(next.supersedesInstructionEntryId).toBe(e.instructionEntryId);
  });
  it('creates an immutable lock with every authority consequence false', async () => {
    const s = setup().service,
      initial = await s.createPackage(command);
    for (const requirement of initial.requirements)
      await s.addDocument(initial.documentPackageId, {
        requirementCode: requirement.code,
        documentType: requirement.code,
        documentReference: { ...reference, fileName: `${requirement.code}.pdf` },
        suppliedBy: 'customer_c1'
      });
    const ready = await s.evaluate(initial.documentPackageId);
    const ledger = await s.createLedger(ready.documentPackageId);
    const entry = await s.appendInstruction(ledger.instructionLedgerId, {
      type: 'DOCUMENT_USE_AUTHORIZATION',
      structuredValue: { authorized: true }
    });
    await s.confirmInstruction(ledger.instructionLedgerId, entry.instructionEntryId);
    const codes = [
      'APPLICANT_OWNER',
      'MARK_REPRESENTATION',
      'SCOPE',
      'DOCUMENT_USE',
      'NO_SUBMISSION',
      'CHANGE_REVIEW_OR_QUOTE'
    ] as const;
    await s.confirmLedger(
      ledger.instructionLedgerId,
      codes.map((code) => ({
        code,
        acknowledged: true,
        acknowledgedBy: 'customer_c1',
        acknowledgedAt: at,
        evidenceReference: `fixture:${code}`
      }))
    );
    const lock = await s.lock(ready.documentPackageId, ledger.instructionLedgerId);
    expect(Object.values(lock.consequences).every((value) => value === false)).toBe(true);
    expect(lock.snapshot.documentPackage.status).toBe('LOCKED_FOR_PREPARATION');
    await expect(
      s.addDocument(ready.documentPackageId, {
        requirementCode: 'APPLICANT_IDENTITY_EVIDENCE',
        documentType: 'x',
        documentReference: reference,
        suppliedBy: 'customer_c1'
      })
    ).rejects.toMatchObject({ code: 'PACKAGE_IMMUTABLE' });
  });
});
