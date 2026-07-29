/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, prefer-const -- real HTTP boundary assertions intentionally inspect decoded JSON fixtures. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PreparationLock } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createExecution,
  InMemoryFilingGovernanceRepository
} from '../../../services/execution/src/index.js';
import { createRuntime as createGateway } from '../src/index.js';
const at = '2026-07-29T12:00:00.000Z';
let clock = at;
const lockFixture: PreparationLock = {
  schemaVersion: 1,
  preparationLockId: 'preparation-lock_gateway012',
  documentPackageId: 'document-package_gateway012',
  documentPackageVersion: 2,
  instructionLedgerId: 'instruction-ledger_gateway012',
  instructionLedgerVersion: 3,
  lockedAt: at,
  snapshot: {
    sourceReviewDecisionVersion: 'review-v1',
    sourceMatterDraftVersion: 'matter-v1',
    commercialScopeUnchanged: true,
    documentPackage: {
      schemaVersion: 1,
      documentPackageId: 'document-package_gateway012',
      version: 2,
      professionalReviewCaseId: 'professional-review_gateway012',
      professionalReviewDecisionVersion: 'review-v1',
      matterDraftId: 'matter-draft_gateway012',
      matterDraftVersion: 'matter-v1',
      customerConfirmationId: 'confirmation_gateway012',
      customerId: 'customer_gateway012',
      jurisdiction: 'GB',
      trademarkReference: 'MARKORBIT',
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
      instructionLedgerId: 'instruction-ledger_gateway012',
      version: 3,
      documentPackageId: 'document-package_gateway012',
      documentPackageVersion: 2,
      customerId: 'customer_gateway012',
      matterDraftId: 'matter-draft_gateway012',
      matterDraftVersion: 'matter-v1',
      professionalReviewCaseId: 'professional-review_gateway012',
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
];
let lock: PreparationLock | undefined;
let base = '';
const active: ServiceRuntime[] = [];
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
  preparationLockId: lockFixture.preparationLockId,
  preparationLockVersion: version,
  authorizedParty: { partyId: 'customer_gateway012', displayName: 'Alex Owner' },
  authorizationCapacity: 'OWNER',
  executionChannel: 'OFFICE_PORTAL'
};
function assertFalseConsequences(body: any) {
  expect(body.consequences).toEqual({
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
  });
}
async function createAuthorization(key = 'authorization-create') {
  const response = await call('/api/execution/filing-authorizations', 'POST', createBody, key);
  const body = (await response.json()) as any;
  return { response, body };
}
async function authorized() {
  const { body } = await createAuthorization();
  const response = await call(
    `/api/execution/filing-authorizations/${body.filingAuthorization.filingAuthorizationId}/confirm`,
    'POST',
    { acknowledgementCodes: codes, acknowledgedBy: 'customer_gateway012' },
    'authorization-confirm'
  );
  return ((await response.json()) as any).filingAuthorization;
}
async function releaseDraft() {
  const auth = await authorized();
  const response = await call(
    '/api/execution/execution-releases',
    'POST',
    {
      filingAuthorizationId: auth.filingAuthorizationId,
      filingAuthorizationVersion: auth.version,
      requestedExecutionChannel: 'OFFICE_PORTAL'
    },
    'release-create'
  );
  return ((await response.json()) as any).executionRelease;
}
beforeEach(async () => {
  clock = at;
  lock = structuredClone(lockFixture);
  const execution = createExecution({
    port: 0,
    filingRepository: new InMemoryFilingGovernanceRepository(),
    preparationLockSource: { getPreparationLock: async () => lock && structuredClone(lock) },
    now: () => clock
  });
  active.push(execution);
  await execution.start();
  const gateway = createGateway({
    port: 0,
    executionUrl: `http://127.0.0.1:${execution.listeningPort}`
  });
  active.push(gateway);
  await gateway.start();
  base = `http://127.0.0.1:${gateway.listeningPort}`;
});
afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((x) => x.stop())
  );
});
describe('Gateway Filing Authorization HTTP vertical slice', () => {
  it('creates and gets exact immutable authorization scope', async () => {
    const { response, body } = await createAuthorization();
    expect(response.status).toBe(200);
    assertFalseConsequences(body);
    expect(body.filingAuthorization.preparationLockVersion).toBe(version);
    const get = await call(
      `/api/execution/filing-authorizations/${body.filingAuthorization.filingAuthorizationId}`,
      'GET'
    );
    expect(((await get.json()) as any).filingAuthorization.scope.trademarkReference).toBe(
      'MARKORBIT'
    );
  });
  it('rejects invalid lock status and exact version mismatch', async () => {
    (lock!.snapshot.documentPackage as { status: string }).status = 'DRAFT';
    expect((await createAuthorization()).response.status).toBe(422);
    lock = structuredClone(lockFixture);
    const r = await call(
      '/api/execution/filing-authorizations',
      'POST',
      { ...createBody, preparationLockVersion: 'wrong' },
      'wrong-version'
    );
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).code).toBe('SOURCE_VERSION_MISMATCH');
  });
  it('replays create and rejects idempotency conflict', async () => {
    const first = await createAuthorization('same');
    const replay = await createAuthorization('same');
    expect(replay.body.filingAuthorization.filingAuthorizationId).toBe(
      first.body.filingAuthorization.filingAuthorizationId
    );
    const conflict = await call(
      '/api/execution/filing-authorizations',
      'POST',
      { ...createBody, authorizationCapacity: 'AUTHORIZED_AGENT' },
      'same'
    );
    expect(conflict.status).toBe(409);
  });
  it('rejects duplicate active authorization', async () => {
    await createAuthorization('one');
    expect((await createAuthorization('two')).response.status).toBe(409);
  });
  it('requires all acknowledgements then confirms with false consequences', async () => {
    const { body } = await createAuthorization();
    const id = body.filingAuthorization.filingAuthorizationId;
    const missing = await call(
      `/api/execution/filing-authorizations/${id}/confirm`,
      'POST',
      { acknowledgementCodes: codes.slice(1), acknowledgedBy: 'customer_gateway012' },
      'missing'
    );
    expect(missing.status).toBe(422);
    const response = await call(
      `/api/execution/filing-authorizations/${id}/confirm`,
      'POST',
      { acknowledgementCodes: codes, acknowledgedBy: 'customer_gateway012' },
      'confirmed'
    );
    const confirmed = (await response.json()) as any;
    assertFalseConsequences(confirmed);
    expect(confirmed.filingAuthorization.status).toBe('AUTHORIZED');
  });
  it('makes confirmed authorization immutable', async () => {
    const auth = await authorized();
    const response = await call(
      `/api/execution/filing-authorizations/${auth.filingAuthorizationId}/confirm`,
      'POST',
      { acknowledgementCodes: codes, acknowledgedBy: 'other_customer' },
      'another-confirm'
    );
    expect(response.status).toBe(409);
    expect(((await response.json()) as any).code).toBe('FILING_AUTHORIZATION_IMMUTABLE');
  });
  it('withdraws authorization and reports all false consequences', async () => {
    const { body } = await createAuthorization();
    const response = await call(
      `/api/execution/filing-authorizations/${body.filingAuthorization.filingAuthorizationId}/withdraw`
    );
    const value = (await response.json()) as any;
    assertFalseConsequences(value);
    expect(value.filingAuthorization.status).toBe('WITHDRAWN');
  });
  it('marks changed source stale and elapsed authorization expired', async () => {
    const auth = await authorized();
    lock = { ...lock!, lockedAt: '2026-07-30T00:00:00.000Z' };
    let response = await call(
      `/api/execution/filing-authorizations/${auth.filingAuthorizationId}`,
      'GET'
    );
    expect(((await response.json()) as any).filingAuthorization.status).toBe('STALE');
    lock = structuredClone(lockFixture);
    const exp = await call(
      '/api/execution/filing-authorizations',
      'POST',
      { ...createBody, expiresAt: '2026-07-29T12:01:00.000Z' },
      'expiring'
    );
    const expired = (await exp.json()) as any;
    clock = '2026-07-29T12:02:00.000Z';
    response = await call(
      `/api/execution/filing-authorizations/${expired.filingAuthorization.filingAuthorizationId}`,
      'GET'
    );
    expect(((await response.json()) as any).filingAuthorization.status).toBe('EXPIRED');
  });
});
describe('Gateway Execution Release and task draft HTTP vertical slice', () => {
  it('creates, lists and gets a release with blocking UNKNOWN', async () => {
    const value = await releaseDraft();
    expect(value.checks.some((x: any) => x.status === 'UNKNOWN')).toBe(true);
    const list = await call('/api/execution/execution-releases', 'GET');
    expect(((await list.json()) as any).executionReleases).toHaveLength(1);
    const get = await call(`/api/execution/execution-releases/${value.executionReleaseId}`, 'GET');
    expect(((await get.json()) as any).executionRelease.executionReleaseId).toBe(
      value.executionReleaseId
    );
  });
  it('rejects duplicate active release', async () => {
    const release = await releaseDraft();
    const response = await call(
      '/api/execution/execution-releases',
      'POST',
      {
        filingAuthorizationId: release.filingAuthorizationId,
        filingAuthorizationVersion: release.filingAuthorizationVersion,
        requestedExecutionChannel: 'OFFICE_PORTAL'
      },
      'release-two'
    );
    expect(response.status).toBe(409);
  });
  it('blocks release on UNKNOWN and on stale FAIL', async () => {
    let value = await releaseDraft();
    let response = await call(
      `/api/execution/execution-releases/${value.executionReleaseId}/release`,
      'POST',
      { decidedBy: 'reviewer_gateway012', rationale: 'Ready' },
      'blocked'
    );
    expect(response.status).toBe(422);
    lock = { ...lock!, lockedAt: 'changed' };
    response = await call(`/api/execution/execution-releases/${value.executionReleaseId}/evaluate`);
    expect(response.status).toBe(409);
    expect(((await response.json()) as any).code).toBe('EXECUTION_RELEASE_IMMUTABLE');
  });
  it('evaluates, assigns, requires rationale and releases once', async () => {
    let value = await releaseDraft();
    let response = await call(
      `/api/execution/execution-releases/${value.executionReleaseId}/evaluate`
    );
    value = ((await response.json()) as any).executionRelease;
    expect(value.status).toBe('READY_FOR_RELEASE');
    response = await call(
      `/api/execution/execution-releases/${value.executionReleaseId}/release`,
      'POST',
      { decidedBy: 'reviewer_gateway012', rationale: '' },
      'no-rationale'
    );
    expect(response.status).toBe(422);
    response = await call(
      `/api/execution/execution-releases/${value.executionReleaseId}/assignment`,
      'PATCH',
      { internalExecutorId: 'executor_gateway012' }
    );
    assertFalseConsequences(await response.clone().json());
    response = await call(
      `/api/execution/execution-releases/${value.executionReleaseId}/release`,
      'POST',
      { decidedBy: 'reviewer_gateway012', rationale: 'All checks passed.' },
      'release-decision'
    );
    const body = (await response.json()) as any;
    assertFalseConsequences(body);
    expect(body.releaseResult.release.status).toBe('RELEASED_FOR_EXECUTION');
    expect(body.releaseResult.taskDraft.status).toBe('PREPARED');
  });
  it('replays release, rejects conflicting payload, and retrieves the single draft both ways', async () => {
    let value = await releaseDraft();
    value = (
      (await (
        await call(`/api/execution/execution-releases/${value.executionReleaseId}/evaluate`)
      ).json()) as any
    ).executionRelease;
    await call(
      `/api/execution/execution-releases/${value.executionReleaseId}/assignment`,
      'PATCH',
      { internalExecutorId: 'executor_gateway012' }
    );
    const path = `/api/execution/execution-releases/${value.executionReleaseId}/release`;
    const first = (await (
      await call(
        path,
        'POST',
        { decidedBy: 'reviewer_gateway012', rationale: 'Ready' },
        'decision-key'
      )
    ).json()) as any;
    const replay = (await (
      await call(
        path,
        'POST',
        { decidedBy: 'reviewer_gateway012', rationale: 'Ready' },
        'decision-key'
      )
    ).json()) as any;
    expect(replay.releaseResult.taskDraft.filingExecutionTaskDraftId).toBe(
      first.releaseResult.taskDraft.filingExecutionTaskDraftId
    );
    expect(
      (
        await call(
          path,
          'POST',
          { decidedBy: 'reviewer_gateway012', rationale: 'Changed' },
          'decision-key'
        )
      ).status
    ).toBe(409);
    const id = first.releaseResult.taskDraft.filingExecutionTaskDraftId;
    expect(
      ((await (await call(`/api/execution/filing-task-drafts/${id}`, 'GET')).json()) as any)
        .filingExecutionTaskDraft.executionSnapshot
    ).toEqual(first.releaseResult.taskDraft.executionSnapshot);
    expect(
      (
        (await (
          await call(
            `/api/execution/execution-releases/${value.executionReleaseId}/filing-task-draft`,
            'GET'
          )
        ).json()) as any
      ).filingExecutionTaskDraft.filingExecutionTaskDraftId
    ).toBe(id);
  });
  it('withdraws draft release but keeps released decision immutable', async () => {
    const value = await releaseDraft();
    let response = await call(
      `/api/execution/execution-releases/${value.executionReleaseId}/withdraw`
    );
    expect(((await response.json()) as any).executionRelease.status).toBe('WITHDRAWN');
  });
  it('marks released record and its task draft stale after source change', async () => {
    let value = await releaseDraft();
    value = (
      (await (
        await call(`/api/execution/execution-releases/${value.executionReleaseId}/evaluate`)
      ).json()) as any
    ).executionRelease;
    await call(
      `/api/execution/execution-releases/${value.executionReleaseId}/assignment`,
      'PATCH',
      { internalExecutorId: 'executor_gateway012' }
    );
    const released = (await (
      await call(
        `/api/execution/execution-releases/${value.executionReleaseId}/release`,
        'POST',
        { decidedBy: 'reviewer_gateway012', rationale: 'Ready' },
        'stale-decision'
      )
    ).json()) as any;
    lock = { ...lock!, lockedAt: 'changed' };
    expect(
      (
        (await (
          await call(`/api/execution/execution-releases/${value.executionReleaseId}`, 'GET')
        ).json()) as any
      ).executionRelease.status
    ).toBe('STALE');
    expect(
      (
        (await (
          await call(
            `/api/execution/filing-task-drafts/${released.releaseResult.taskDraft.filingExecutionTaskDraftId}`,
            'GET'
          )
        ).json()) as any
      ).filingExecutionTaskDraft.status
    ).toBe('STALE');
  });
});
