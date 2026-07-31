import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ConfirmationAcknowledgement, Quote } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime as createGateway } from '../src/index.js';
import {
  createRuntime as createMarkReg,
  InMemoryMarkRegRepository,
  InMemoryMatterFlowRepository
} from '../../../services/markreg/src/index.js';
const active: ServiceRuntime[] = [];
const now = '2026-07-29T12:00:00.000Z';
const quote = (
  status: Quote['status'] = 'READY',
  validUntil = '2026-08-29T00:00:00.000Z'
): Quote => ({
  quoteId: 'quote_gateway',
  intakeId: 'intake_gateway',
  recommendationId: 'recommendation_gateway',
  selectedOptionCode: 'B',
  pricingRuleVersion: 'quote-v1',
  status,
  currency: 'USD',
  lines: [
    {
      code: 'SERVICE',
      description: 'Service',
      category: 'SERVICE_FEE',
      amount: { amountMinor: 90000, currency: 'USD' }
    }
  ],
  subtotal: { amountMinor: 90000, currency: 'USD' },
  estimatedOfficialFees: { amountMinor: 0, currency: 'USD' },
  estimatedServiceFees: { amountMinor: 90000, currency: 'USD' },
  estimatedDisbursements: { amountMinor: 0, currency: 'USD' },
  estimatedTaxes: { amountMinor: 0, currency: 'USD' },
  total: { amountMinor: 90000, currency: 'USD' },
  assumptions: [],
  limitations: [],
  validUntil,
  fixtureOnly: true,
  createdAt: now
});
const acknowledgements: ConfirmationAcknowledgement[] = (
  [
    'NO_FILING',
    'NO_PROFESSIONAL_APPOINTMENT',
    'REVIEW_MAY_BE_REQUIRED',
    'SCOPE_CHANGE_REQUOTE'
  ] as const
).map((code) => ({ code, acknowledged: true, acknowledgedAt: now }));
const command = {
  quoteId: 'quote_gateway',
  quoteVersion: 'quote-v1',
  planId: 'plan_gateway',
  planVersion: 'plan-v1',
  customerId: 'customer_gateway',
  termsVersion: 'terms-v1',
  acknowledgements,
  actor: {
    actorId: 'actor_gateway',
    workplaceId: 'workplace_gateway',
    product: 'MARKREG_COM',
    purpose: 'Gateway integration'
  },
  idempotencyKey: 'confirmation-key',
  confirmedTotalMinor: 1
};
let url = '',
  quotes: InMemoryMarkRegRepository;
async function start(seed = quote()) {
  quotes = new InMemoryMarkRegRepository();
  quotes.saveQuote(seed);
  const matter = new InMemoryMatterFlowRepository();
  const markreg = createMarkReg({
    port: 0,
    repository: quotes,
    matterFlowRepository: matter,
    milestoneTestRuntime: true,
    now: () => now
  });
  active.push(markreg);
  await markreg.start();
  const gateway = createGateway({
    port: 0,
    markRegUrl: `http://127.0.0.1:${markreg.listeningPort}`,
    milestoneTestRuntime: true
  });
  active.push(gateway);
  await gateway.start();
  url = `http://127.0.0.1:${gateway.listeningPort}`;
}
async function request(path: string, method = 'POST', body: unknown = {}, key?: string) {
  return fetch(`${url}${path}`, {
    method,
    headers: {
      ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
      ...(key ? { 'idempotency-key': key } : {})
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
  });
}
async function confirm(body: Record<string, unknown> = command, key = command.idempotencyKey) {
  return request(
    '/api/markreg/customer-confirmations',
    'POST',
    { ...body, idempotencyKey: key },
    key
  );
}
async function confirmed() {
  const response = await confirm();
  return (await response.json()) as {
    confirmation: { confirmationId: string; quoteSnapshot: { totalMinor: number } };
    consequences: Record<string, boolean>;
  };
}
afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
});
beforeEach(() => {
  url = '';
});
describe('Gateway Customer Confirmation routes', () => {
  it('returns the fixture receipt contract and proceeds to Prepare Matter Draft', async () => {
    await start();
    const value = await confirmed();
    expect(value.confirmation.confirmationId).toMatch(/^confirmation_/);
    expect(value.confirmation.quoteSnapshot.totalMinor).toBe(90000);
    expect(value.consequences).toEqual({
      orderCreated: false,
      paymentCreated: false,
      professionalAppointed: false,
      filingCreated: false
    });
    const get = await request(
      `/api/markreg/customer-confirmations/${value.confirmation.confirmationId}`,
      'GET'
    );
    expect(get.status).toBe(200);
    expect(await get.json()).toMatchObject({
      confirmation: { confirmationId: value.confirmation.confirmationId }
    });
    const prepared = await request('/api/markreg/matter-drafts', 'POST', {
      confirmationId: value.confirmation.confirmationId
    });
    expect(prepared.status).toBe(200);
    expect(await prepared.json()).toMatchObject({
      matterDraft: { confirmationId: value.confirmation.confirmationId }
    });
  });
  it('verifies the exact Quote version', async () => {
    await start();
    expect((await confirm({ ...command, quoteVersion: 'quote-v2' }, 'version')).status).toBe(409);
  });
  it.each([
    ['SUPERSEDED', '2026-08-29T00:00:00.000Z'],
    ['READY', '2026-07-01T00:00:00.000Z']
  ] as const)('rejects non-confirmable or expired Quotes', async (status, expiry) => {
    await start(quote(status, expiry));
    expect((await confirm()).status).toBe(409);
  });
  it('requires every active acknowledgement', async () => {
    await start();
    expect(
      (await confirm({ ...command, acknowledgements: acknowledgements.slice(1) })).status
    ).toBe(422);
  });
  it('returns the same confirmation for the same key and typed conflict for changed payload', async () => {
    await start();
    const first = await confirmed();
    const same = await confirmed();
    expect(same.confirmation.confirmationId).toBe(first.confirmation.confirmationId);
    const conflict = await confirm({ ...command, termsVersion: 'terms-v2' });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('withdraws idempotently and retrieves WITHDRAWN', async () => {
    await start();
    const value = await confirmed();
    const path = `/api/markreg/customer-confirmations/${value.confirmation.confirmationId}/withdraw`;
    expect((await request(path)).status).toBe(200);
    expect((await request(path)).status).toBe(200);
    const get = await request(
      `/api/markreg/customer-confirmations/${value.confirmation.confirmationId}`,
      'GET'
    );
    expect(await get.json()).toMatchObject({ confirmation: { status: 'WITHDRAWN' } });
  });
});
describe('Gateway Matter Draft routes', () => {
  async function draft() {
    const value = await confirmed();
    const response = await request('/api/markreg/matter-drafts', 'POST', {
      confirmationId: value.confirmation.confirmationId
    });
    return (await response.json()) as {
      matterDraft: {
        matterDraftId: string;
        status: string;
        readiness: { checks: { code: string; status: string }[] };
      };
      consequences: Record<string, boolean>;
    };
  }
  it('creates and retrieves an incomplete draft without authority side effects', async () => {
    await start();
    const value = await draft();
    expect(value.matterDraft.status).toBe('NEEDS_INFORMATION');
    expect(value.consequences.filingCreated).toBe(false);
    const get = await request(
      `/api/markreg/matter-drafts/${value.matterDraft.matterDraftId}`,
      'GET'
    );
    expect(get.status).toBe(200);
  });
  it('rejects creation from a withdrawn confirmation', async () => {
    await start();
    const value = await confirmed();
    await request(
      `/api/markreg/customer-confirmations/${value.confirmation.confirmationId}/withdraw`
    );
    const response = await request('/api/markreg/matter-drafts', 'POST', {
      confirmationId: value.confirmation.confirmationId
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CONFIRMATION_WITHDRAWN' });
  });
  it('updates preparation and exposes blocking FAIL and UNKNOWN checks', async () => {
    await start();
    const value = await draft();
    const id = value.matterDraft.matterDraftId;
    const patch = await request(`/api/markreg/matter-drafts/${id}`, 'PATCH', {
      applicantName: 'Orbit Ltd'
    });
    expect(patch.status).toBe(200);
    const evaluated = await request(`/api/markreg/matter-drafts/${id}/evaluate-readiness`);
    const body = (await evaluated.json()) as typeof value;
    expect(body.matterDraft.readiness.checks.some((x) => x.status === 'FAIL')).toBe(true);
    expect(body.matterDraft.readiness.checks.some((x) => x.status === 'UNKNOWN')).toBe(true);
  });
  it('transitions to READY_FOR_PROFESSIONAL_REVIEW and rejects later mutation', async () => {
    await start();
    const value = await draft();
    const id = value.matterDraft.matterDraftId;
    await request(`/api/markreg/matter-drafts/${id}`, 'PATCH', {
      applicantName: 'Orbit Ltd',
      applicantAddress: '1 Orbit Way',
      trademark: 'ORBIT',
      targetJurisdiction: 'US',
      classes: [9],
      goodsServices: 'Software',
      filingBasis: 'INTENT_TO_USE',
      representativeRequired: true,
      documentReferences: ['document_gateway'],
      commercialScopeUnchanged: true
    });
    const evaluated = await request(`/api/markreg/matter-drafts/${id}/evaluate-readiness`);
    expect(await evaluated.json()).toMatchObject({
      matterDraft: { status: 'READY_FOR_PROFESSIONAL_REVIEW' },
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        professionalAppointed: false,
        filingCreated: false
      }
    });
    const changed = await request(`/api/markreg/matter-drafts/${id}`, 'PATCH', {
      goodsServices: 'Changed scope',
      commercialScopeUnchanged: false
    });
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ code: 'MATTER_DRAFT_IMMUTABLE' });
  });
  it('invalidates changed commercial scope before readiness', async () => {
    await start();
    const value = await draft();
    const id = value.matterDraft.matterDraftId;
    await request(`/api/markreg/matter-drafts/${id}`, 'PATCH', { commercialScopeUnchanged: false });
    const evaluated = await request(`/api/markreg/matter-drafts/${id}/evaluate-readiness`);
    expect(await evaluated.json()).toMatchObject({ matterDraft: { status: 'NEEDS_INFORMATION' } });
  });
});
