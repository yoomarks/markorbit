import { describe, expect, it } from 'vitest';
/* eslint-disable @typescript-eslint/require-await -- the source fixture intentionally implements an asynchronous boundary. */
import type { MatterDraftReviewSnapshot } from '@markorbit/contracts';
import {
  InMemoryProfessionalReviewRepository,
  ProfessionalReviewService
} from '../src/professional-review.js';
const snapshot: MatterDraftReviewSnapshot = {
  schemaVersion: 1,
  matterDraftId: 'matter-draft_009',
  matterDraftVersion: 'v1',
  confirmationId: 'confirmation_009',
  customerId: 'customer_009',
  status: 'READY_FOR_PROFESSIONAL_REVIEW',
  preparation: {
    classes: [9],
    documentReferences: ['doc'],
    applicantName: 'A',
    trademark: 'MARK',
    targetJurisdiction: 'EU',
    goodsServices: 'software'
  },
  readiness: { evaluatedAt: '2026-07-29T00:00:00Z', readyForProfessionalReview: true, checks: [] },
  readinessTimestamp: '2026-07-29T00:00:00Z'
};
function setup(source: MatterDraftReviewSnapshot = snapshot) {
  let current = source;
  const service = new ProfessionalReviewService(
    new InMemoryProfessionalReviewRepository(),
    { getMatterDraft: async () => structuredClone(current) },
    () => '2026-07-29T12:00:00Z'
  );
  return { service, set: (v: MatterDraftReviewSnapshot) => (current = v) };
}
const command = {
  matterDraftId: 'matter-draft_009' as const,
  matterDraftVersion: 'v1',
  idempotencyKey: 'key-1',
  requestedBy: 'actor_requester' as const
};
async function claimed() {
  const x = setup();
  const value = await x.service.create(command);
  await x.service.claim(value.reviewCaseId, 'actor_reviewer');
  return { ...x, id: value.reviewCaseId };
}
describe('professional review', () => {
  it('creates a queued case from the exact ready snapshot', async () =>
    expect((await setup().service.create(command)).status).toBe('QUEUED'));
  it('rejects a source draft that is not ready', async () =>
    await expect(
      setup({ ...snapshot, status: 'NEEDS_INFORMATION' }).service.create(command)
    ).rejects.toMatchObject({ code: 'SOURCE_NOT_READY' }));
  it('rejects a source version mismatch', async () =>
    await expect(
      setup().service.create({ ...command, matterDraftVersion: 'v2' })
    ).rejects.toMatchObject({ code: 'SOURCE_VERSION_MISMATCH' }));
  it('replays the same idempotent creation', async () => {
    const s = setup().service;
    expect((await s.create(command)).reviewCaseId).toBe((await s.create(command)).reviewCaseId);
  });
  it('rejects an idempotency conflict', async () => {
    const s = setup().service;
    await s.create(command);
    await expect(s.create({ ...command, requestedBy: 'actor_other' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    });
  });
  it('rejects a duplicate active case', async () => {
    const s = setup().service;
    await s.create(command);
    await expect(s.create({ ...command, idempotencyKey: 'key-2' })).rejects.toMatchObject({
      code: 'ACTIVE_REVIEW_CASE_EXISTS'
    });
  });
  it('claims a queued case once without appointment', async () => {
    const c = await claimed();
    const v = await c.service.get(c.id);
    expect(v.assignment).toMatchObject({
      claimedBy: 'actor_reviewer',
      professionalAppointed: false
    });
  });
  it('rejects duplicate claim', async () => {
    const c = await claimed();
    await expect(c.service.claim(c.id, 'actor_other')).rejects.toMatchObject({
      code: 'CASE_NOT_CLAIMABLE'
    });
  });
  it('rejects reviewer mismatch', async () => {
    const c = await claimed();
    await expect(
      c.service.complete(c.id, 'actor_other', 'MARK_READY_FOR_NEXT_STEP', 'ok')
    ).rejects.toMatchObject({ code: 'REVIEWER_MISMATCH' });
  });
  it('rejects blocking UNKNOWN', async () => {
    const c = await claimed();
    await expect(
      c.service.complete(c.id, 'actor_reviewer', 'MARK_READY_FOR_NEXT_STEP', 'ok')
    ).rejects.toMatchObject({ code: 'BLOCKING_CHECKLIST_ITEMS' });
  });
  it('rejects blocking FAIL', async () => {
    const c = await claimed();
    await c.service.updateChecklist(c.id, 'actor_reviewer', [
      { code: 'SOURCE_MATTER_DRAFT_CURRENT', status: 'FAIL' }
    ]);
    await expect(
      c.service.complete(c.id, 'actor_reviewer', 'MARK_READY_FOR_NEXT_STEP', 'ok')
    ).rejects.toMatchObject({ code: 'BLOCKING_CHECKLIST_ITEMS' });
  });
  it('prepares information without sending a message', async () => {
    const c = await claimed();
    const v = await c.service.requestInformation(c.id, 'actor_reviewer', {
      requestedFields: ['authority'],
      reason: 'Clarify'
    });
    expect(v.informationRequest?.sent).toBe(false);
  });
  it('marks a case stale when the source changes', async () => {
    const c = await claimed();
    c.set({ ...snapshot, matterDraftVersion: 'v2' });
    expect((await c.service.get(c.id)).status).toBe('STALE');
  });
  it('rejects stale completion', async () => {
    const c = await claimed();
    c.set({ ...snapshot, matterDraftVersion: 'v2' });
    await expect(
      c.service.complete(c.id, 'actor_reviewer', 'MARK_READY_FOR_NEXT_STEP', 'ok')
    ).rejects.toMatchObject({ code: 'STALE_PROFESSIONAL_REVIEW' });
  });
  it('completes only when every blocking item passes and records no consequences', async () => {
    const c = await claimed();
    const v = await c.service.get(c.id);
    await c.service.updateChecklist(
      c.id,
      'actor_reviewer',
      v.checklist.map((x) => ({ code: x.code, status: 'PASS' }))
    );
    const done = await c.service.complete(
      c.id,
      'actor_reviewer',
      'MARK_READY_FOR_NEXT_STEP',
      'Evidence supports next step'
    );
    expect(done.decision?.consequences).toEqual({
      orderCreated: false,
      paymentCreated: false,
      formalMatterCreated: false,
      providerAppointed: false,
      filingCreated: false,
      customerMessageSent: false
    });
  });
  it('makes a completed decision immutable', async () => {
    const c = await claimed();
    const v = await c.service.get(c.id);
    await c.service.updateChecklist(
      c.id,
      'actor_reviewer',
      v.checklist.map((x) => ({ code: x.code, status: 'PASS' }))
    );
    await c.service.complete(c.id, 'actor_reviewer', 'MARK_READY_FOR_NEXT_STEP', 'ok');
    await expect(c.service.withdraw(c.id)).rejects.toMatchObject({ code: 'DECISION_IMMUTABLE' });
  });
  it('allows exactly one concurrent writer for an exact version', async () => {
    const c = await claimed();
    const version = (await c.service.get(c.id)).version;
    const results = await Promise.allSettled([
      c.service.updateChecklist(c.id, 'actor_reviewer', [], version),
      c.service.updateChecklist(c.id, 'actor_reviewer', [], version)
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
  it('returns the immutable result for an identical completion retry', async () => {
    const c = await claimed();
    const review = await c.service.get(c.id);
    const draft = await c.service.updateChecklist(
      c.id,
      'actor_reviewer',
      review.checklist.map((item) => ({ code: item.code, status: 'PASS' })),
      review.version
    );
    const completed = await c.service.complete(
      c.id,
      'actor_reviewer',
      'MARK_READY_FOR_NEXT_STEP',
      'Exact evidence accepted',
      draft.version
    );
    const replay = await c.service.complete(
      c.id,
      'actor_reviewer',
      'MARK_READY_FOR_NEXT_STEP',
      'Exact evidence accepted',
      draft.version
    );
    expect(replay).toEqual(completed);
  });
  it('withdraws an uncompleted case and prevents review', async () => {
    const c = await claimed();
    await c.service.withdraw(c.id);
    await expect(c.service.updateChecklist(c.id, 'actor_reviewer', [])).rejects.toMatchObject({
      code: 'CASE_WITHDRAWN'
    });
  });
});
