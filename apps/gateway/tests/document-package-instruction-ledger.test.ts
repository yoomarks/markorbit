/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- HTTP integration fixtures intentionally inspect runtime JSON at the public boundary. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CustomerConfirmation,
  MatterDraft,
  ProfessionalReviewCase
} from '@markorbit/contracts';
import { createRuntime as createGateway } from '../src/index.js';
import {
  createRuntime as createMarkReg,
  InMemoryPreparationRepository
} from '../../../services/markreg/src/index.js';
import type { ServiceRuntime as Runtime } from '@markorbit/service-kit';

const now = '2026-07-29T12:00:00.000Z';
const confirmation = {
  schemaVersion: 1,
  confirmationId: 'confirmation_gateway011',
  customerId: 'customer_gateway011',
  quoteSnapshot: {
    quoteId: 'quote_gateway011',
    quoteVersion: 'v1',
    planId: 'plan_gateway011',
    planVersion: 'v1',
    currency: 'USD',
    totalMinor: 100,
    lineItems: []
  },
  confirmedBy: 'customer_gateway011',
  confirmedAt: now,
  termsVersion: 'terms-v1',
  acknowledgements: [],
  status: 'CONFIRMED',
  createdAt: now,
  updatedAt: now
} satisfies CustomerConfirmation;
const matter = {
  schemaVersion: 1,
  matterDraftId: 'matter-draft_gateway011',
  confirmationId: confirmation.confirmationId,
  customerId: confirmation.customerId,
  preparation: {
    applicantName: 'Orbit Ltd',
    applicantAddress: '1 Orbit Way',
    trademark: 'ORBIT',
    targetJurisdiction: 'US',
    classes: [9],
    goodsServices: 'Long governed software description',
    filingBasis: 'INTENT_TO_USE',
    representativeRequired: false,
    documentReferences: [],
    commercialScopeUnchanged: true
  },
  instructionCompleteness: 'COMPLETE',
  documentReadiness: 'READY',
  readiness: { evaluatedAt: now, checks: [], readyForProfessionalReview: true },
  missingInformation: [],
  status: 'READY_FOR_PROFESSIONAL_REVIEW',
  createdAt: now,
  updatedAt: now
} satisfies MatterDraft;
const review = {
  schemaVersion: 1,
  reviewCaseId: 'professional-review_gateway011',
  source: {
    schemaVersion: 1,
    matterDraftId: matter.matterDraftId,
    matterDraftVersion: 'matter-v1',
    confirmationId: confirmation.confirmationId,
    customerId: confirmation.customerId,
    status: matter.status,
    preparation: matter.preparation,
    readiness: matter.readiness,
    readinessTimestamp: now
  },
  status: 'REVIEWED_READY_FOR_NEXT_STEP',
  priority: 'NORMAL',
  requestedBy: confirmation.customerId,
  createdAt: now,
  updatedAt: now,
  assignment: { status: 'CLAIMED', professionalAppointed: false },
  checklist: [],
  evidence: [],
  decision: {
    code: 'MARK_READY_FOR_NEXT_STEP',
    reviewerId: 'reviewer_gateway011',
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
} satisfies ProfessionalReviewCase;
const active: Runtime[] = [];
let base = '';
let sourceReview: ProfessionalReviewCase;
async function start() {
  const markreg = createMarkReg({
    port: 0,
    preparationRepository: new InMemoryPreparationRepository(),
    preparationSources: {
      getReview: async () => sourceReview,
      getMatterDraft: async () => matter,
      getConfirmation: async () => confirmation
    },
    now: () => now
  });
  active.push(markreg);
  await markreg.start();
  const gateway = createGateway({
    port: 0,
    markRegUrl: `http://127.0.0.1:${markreg.listeningPort}`
  });
  active.push(gateway);
  await gateway.start();
  base = `http://127.0.0.1:${gateway.listeningPort}`;
}
async function call(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'POST',
  body: unknown = {},
  key?: string
) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
      ...(key ? { 'idempotency-key': key } : {})
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
  });
}
const createBody = {
  professionalReviewCaseId: review.reviewCaseId,
  professionalReviewDecisionVersion: 'decision-v1',
  matterDraftVersion: 'matter-v1'
};
async function create(key = 'package-key') {
  const r = await call('/api/markreg/document-packages', 'POST', createBody, key);
  return { response: r, body: (await r.json()) as any };
}
const reference = (language?: string) => ({
  fileName: `very-${'long-'.repeat(20)}document.pdf`,
  contentType: 'application/pdf',
  byteSize: 100,
  checksum: 'sha256:fixture',
  uploadedAt: now,
  uploadedBy: confirmation.customerId,
  source: 'FIXTURE',
  originalOrCopy: 'COPY',
  ...(language ? { language } : {})
});
async function readyPackage() {
  const { body: p } = await create();
  for (const requirement of p.requirements)
    await call(`/api/markreg/document-packages/${p.documentPackageId}/documents`, 'POST', {
      requirementCode: requirement.code,
      documentType: requirement.code,
      suppliedBy: confirmation.customerId,
      documentReference: reference('en')
    });
  const e = await call(`/api/markreg/document-packages/${p.documentPackageId}/evaluate`);
  return (await e.json()) as any;
}
const ackCodes = [
  'APPLICANT_OWNER',
  'MARK_REPRESENTATION',
  'SCOPE',
  'DOCUMENT_USE',
  'NO_SUBMISSION',
  'CHANGE_REVIEW_OR_QUOTE'
] as const;
async function confirmedLedger(p: any) {
  const l = (await (
    await call('/api/markreg/instruction-ledgers', 'POST', {
      documentPackageId: p.documentPackageId
    })
  ).json()) as any;
  const entry = (await (
    await call(`/api/markreg/instruction-ledgers/${l.instructionLedgerId}/entries`, 'POST', {
      type: 'DOCUMENT_USE_AUTHORIZATION',
      structuredValue: { authorized: true }
    })
  ).json()) as any;
  await call(
    `/api/markreg/instruction-ledgers/${l.instructionLedgerId}/entries/${entry.instructionEntryId}/confirm`
  );
  return (await (
    await call(`/api/markreg/instruction-ledgers/${l.instructionLedgerId}/confirm`, 'POST', {
      acknowledgements: ackCodes.map((code) => ({
        code,
        acknowledged: true,
        acknowledgedBy: confirmation.customerId,
        acknowledgedAt: now,
        evidenceReference: `gateway:${code}`
      }))
    })
  ).json()) as any;
}
beforeEach(async () => {
  sourceReview = structuredClone(review);
  await start();
});
afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((x) => x.stop())
  );
});

describe('Gateway Document Package vertical slice', () => {
  it('creates, gets and lists a package with server-derived requirements', async () => {
    const { response, body } = await create();
    expect(response.status).toBe(200);
    expect(body.requirements.every((x: any) => x.fixtureOnly)).toBe(true);
    expect(
      (await call(`/api/markreg/document-packages/${body.documentPackageId}`, 'GET')).status
    ).toBe(200);
    const list = (await (await call('/api/markreg/document-packages', 'GET')).json()) as any;
    expect(list.documentPackages).toHaveLength(1);
  });
  it('rejects incomplete review and exact decision mismatch with typed errors', async () => {
    sourceReview = { ...review, status: 'IN_REVIEW' };
    const r = await create('not-ready');
    expect(r.response.status).toBe(409);
    expect(r.body.code).toBe('SOURCE_REVIEW_NOT_READY');
    sourceReview = review;
    const mismatch = await call(
      '/api/markreg/document-packages',
      'POST',
      { ...createBody, professionalReviewDecisionVersion: 'wrong' },
      'wrong'
    );
    expect(await mismatch.json()).toMatchObject({ code: 'REVIEW_DECISION_VERSION_MISMATCH' });
  });
  it('supports replay, rejects conflicting idempotency and duplicate active packages', async () => {
    const a = await create();
    const b = await create();
    expect(b.body.documentPackageId).toBe(a.body.documentPackageId);
    const conflict = await call(
      '/api/markreg/document-packages',
      'POST',
      { ...createBody, matterDraftVersion: 'other' },
      'package-key'
    );
    expect(await conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect((await create('different-key')).body.code).toBe('ACTIVE_PACKAGE_EXISTS');
  });
  it('adds, patches and explicitly supersedes document metadata', async () => {
    const { body: p } = await create();
    const added = (await (
      await call(`/api/markreg/document-packages/${p.documentPackageId}/documents`, 'POST', {
        requirementCode: p.requirements[0].code,
        documentType: 'IDENTITY',
        suppliedBy: confirmation.customerId,
        documentReference: reference()
      })
    ).json()) as any;
    expect(
      (
        await call(
          `/api/markreg/document-packages/${p.documentPackageId}/documents/${added.documentItemId}`,
          'PATCH',
          { documentReference: { language: 'en' } }
        )
      ).status
    ).toBe(200);
    const next = (await (
      await call(
        `/api/markreg/document-packages/${p.documentPackageId}/documents/${added.documentItemId}/supersede`,
        'POST',
        {
          documentType: 'IDENTITY',
          suppliedBy: confirmation.customerId,
          documentReference: reference('en')
        }
      )
    ).json()) as any;
    expect(next.supersedesDocumentItemId).toBe(added.documentItemId);
  });
  it('reports blocking FAIL, then UNKNOWN, and becomes ready only after metadata completion', async () => {
    const { body: p } = await create();
    let evaluated = (await (
      await call(`/api/markreg/document-packages/${p.documentPackageId}/evaluate`)
    ).json()) as any;
    expect(evaluated.validationChecks.some((x: any) => x.blocking && x.status === 'FAIL')).toBe(
      true
    );
    for (const requirement of p.requirements)
      await call(`/api/markreg/document-packages/${p.documentPackageId}/documents`, 'POST', {
        requirementCode: requirement.code,
        documentType: requirement.code,
        suppliedBy: confirmation.customerId,
        documentReference: reference()
      });
    evaluated = (await (
      await call(`/api/markreg/document-packages/${p.documentPackageId}/evaluate`)
    ).json()) as any;
    expect(evaluated.validationChecks.some((x: any) => x.blocking && x.status === 'UNKNOWN')).toBe(
      true
    );
  });
  it('withdraws and rejects locking a withdrawn package', async () => {
    const p = await readyPackage();
    const l = (await (
      await call('/api/markreg/instruction-ledgers', 'POST', {
        documentPackageId: p.documentPackageId
      })
    ).json()) as any;
    expect(
      (await call(`/api/markreg/document-packages/${p.documentPackageId}/withdraw`)).status
    ).toBe(200);
    const lock = await call('/api/markreg/preparation-locks', 'POST', {
      documentPackageId: p.documentPackageId,
      instructionLedgerId: l.instructionLedgerId
    });
    expect(lock.status).toBe(409);
  });
});
describe('Gateway Instruction Ledger and Preparation Lock', () => {
  it('creates, gets, appends, confirms and preserves superseded history', async () => {
    const p = await readyPackage();
    const l = (await (
      await call('/api/markreg/instruction-ledgers', 'POST', {
        documentPackageId: p.documentPackageId
      })
    ).json()) as any;
    const first = (await (
      await call(`/api/markreg/instruction-ledgers/${l.instructionLedgerId}/entries`, 'POST', {
        type: 'GOODS_SERVICES',
        structuredValue: { text: 'Old' }
      })
    ).json()) as any;
    await call(
      `/api/markreg/instruction-ledgers/${l.instructionLedgerId}/entries/${first.instructionEntryId}/confirm`
    );
    await call(
      `/api/markreg/instruction-ledgers/${l.instructionLedgerId}/entries/${first.instructionEntryId}/supersede`,
      'POST',
      { type: 'GOODS_SERVICES', structuredValue: { text: 'Current' } }
    );
    const got = (await (
      await call(`/api/markreg/instruction-ledgers/${l.instructionLedgerId}`, 'GET')
    ).json()) as any;
    expect(got.entries).toHaveLength(2);
    expect(got.entries[0].status).toBe('SUPERSEDED');
  });
  it('rejects confirmation mutation and supports ledger withdrawal', async () => {
    const p = await readyPackage();
    const result = await confirmedLedger(p);
    const mutation = await call(
      `/api/markreg/instruction-ledgers/${result.instructionLedger.instructionLedgerId}/entries`,
      'POST',
      { type: 'FILING_TIMING', structuredValue: { timing: 'NOW' } }
    );
    expect(await mutation.json()).toMatchObject({ code: 'LEDGER_IMMUTABLE' });
    const withdraw = await call(
      `/api/markreg/instruction-ledgers/${result.instructionLedger.instructionLedgerId}/withdraw`
    );
    expect(await withdraw.json()).toMatchObject({ status: 'WITHDRAWN' });
  });
  it('rejects locks for incomplete documents and incomplete instructions', async () => {
    const { body: p } = await create();
    const l = (await (
      await call('/api/markreg/instruction-ledgers', 'POST', {
        documentPackageId: p.documentPackageId
      })
    ).json()) as any;
    expect(
      await (
        await call('/api/markreg/preparation-locks', 'POST', {
          documentPackageId: p.documentPackageId,
          instructionLedgerId: l.instructionLedgerId
        })
      ).json()
    ).toMatchObject({ code: 'DOCUMENTS_NOT_READY' });
    const ready = await readyPackage();
    const draft = (await (
      await call('/api/markreg/instruction-ledgers', 'POST', {
        documentPackageId: ready.documentPackageId
      })
    ).json()) as any;
    expect(
      await (
        await call('/api/markreg/preparation-locks', 'POST', {
          documentPackageId: ready.documentPackageId,
          instructionLedgerId: draft.instructionLedgerId
        })
      ).json()
    ).toMatchObject({ code: 'INSTRUCTIONS_NOT_CONFIRMED' });
  });
  it('locks, retrieves an immutable snapshot, and returns every false authority consequence', async () => {
    const p = await readyPackage();
    const confirmed = await confirmedLedger(p);
    const lock = (await (
      await call('/api/markreg/preparation-locks', 'POST', {
        documentPackageId: p.documentPackageId,
        instructionLedgerId: confirmed.instructionLedger.instructionLedgerId
      })
    ).json()) as any;
    expect(lock.snapshot.documentPackage.status).toBe('LOCKED_FOR_PREPARATION');
    expect(Object.values(lock.consequences).every((x) => x === false)).toBe(true);
    expect(lock.consequences).toEqual({
      orderCreated: false,
      paymentCreated: false,
      formalMatterCreated: false,
      professionalAppointed: false,
      filingCreated: false,
      filingSubmitted: false,
      customerMessageSent: false,
      externalDocumentSent: false,
      trademarkOfficeContacted: false
    });
    const got = (await (
      await call(`/api/markreg/preparation-locks/${lock.preparationLockId}`, 'GET')
    ).json()) as any;
    expect(got.snapshot).toEqual(lock.snapshot);
  });
});
