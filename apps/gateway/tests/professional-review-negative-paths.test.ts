/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- HTTP boundary fixtures are decoded and asserted immediately. */
import { afterEach, describe, expect, it } from 'vitest';
import type { MatterDraftReviewSnapshot } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime as createExecution } from '../../../services/execution/src/index.js';
import { createRuntime as createGateway } from '../src/index.js';

const snapshot: MatterDraftReviewSnapshot = {
  schemaVersion: 1,
  matterDraftId: 'matter-draft_matrix',
  matterDraftVersion: 'v1',
  confirmationId: 'confirmation_matrix',
  customerId: 'customer_matrix',
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
const active: ServiceRuntime[] = [];
afterEach(async () =>
  Promise.all(
    active
      .splice(0)
      .reverse()
      .map((x) => x.stop())
  )
);
async function start(runtime: ServiceRuntime) {
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}
async function stack() {
  let source = structuredClone(snapshot);
  const execution = createExecution({
    port: 0,
    matterDraftSource: { getMatterDraft: async () => structuredClone(source) }
  });
  const executionUrl = await start(execution);
  const gateway = createGateway({ port: 0, executionUrl, milestoneTestRuntime: true });
  const base = await start(gateway);
  const call = (path: string, method = 'GET', body?: unknown, key?: string) =>
    fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) })
    });
  return {
    call,
    setSource: (value: MatterDraftReviewSnapshot) => (source = structuredClone(value))
  };
}
const command = {
  matterDraftId: snapshot.matterDraftId,
  matterDraftVersion: 'v1',
  requestedBy: 'actor_matrix'
};
describe('professional-review negative paths through the real Gateway HTTP boundary', () => {
  it('preserves ACTIVE_REVIEW_CASE_EXISTS for a duplicate Professional Review Case', async () => {
    const { call } = await stack();
    await call('/api/lite/professional-review-cases', 'POST', command, 'review-key-1');
    const response = await call(
      '/api/lite/professional-review-cases',
      'POST',
      command,
      'review-key-2'
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'ACTIVE_REVIEW_CASE_EXISTS' });
  });
  it('preserves STALE_PROFESSIONAL_REVIEW and the unchanged record for stale Professional Review completion', async () => {
    const { call, setSource } = await stack();
    const created = (await (
      await call('/api/lite/professional-review-cases', 'POST', command, 'review-key-1')
    ).json()) as any;
    const id = created.reviewCase.reviewCaseId;
    await call(`/api/lite/professional-review-cases/${id}/claim`, 'POST', {
      reviewerId: 'reviewer_matrix'
    });
    setSource({ ...snapshot, matterDraftVersion: 'v2' });
    const before = (await (await call(`/api/lite/professional-review-cases/${id}`)).json()) as any;
    const response = await call(`/api/lite/professional-review-cases/${id}/complete`, 'POST', {
      reviewerId: 'reviewer_matrix',
      code: 'MARK_READY_FOR_NEXT_STEP',
      rationale: 'must not complete'
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'STALE_PROFESSIONAL_REVIEW' });
    const after = (await (await call(`/api/lite/professional-review-cases/${id}`)).json()) as any;
    expect(after.reviewCase).toEqual(before.reviewCase);
    expect(after.reviewCase.status).toBe('STALE');
  });
});
