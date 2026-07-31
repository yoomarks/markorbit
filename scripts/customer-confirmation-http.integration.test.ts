import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/dist/index.js';
import {
  createRuntime as createGateway,
  HttpCoreAuthenticationClient
} from '../apps/gateway/dist/index.js';
import {
  createRuntime as createMarkReg,
  InMemoryMarkRegRepository,
  InMemoryCustomerConfirmationRepository,
  InMemoryMatterDraftRepository
} from '../services/markreg/dist/index.js';

const secret = 'task-020-http-internal-service-secret';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const quoteId = 'quote_http';
describe('authenticated durable Customer Confirmation HTTP boundary', () => {
  const users = new InMemoryUserRepository(),
    workspaces = new InMemoryWorkspaceRepository(),
    memberships = new InMemoryMembershipRepository(users, workspaces),
    sessions = new InMemorySessionRepository();
  const auth = new AuthenticationService({ users, workspaces, memberships, sessions });
  const core = createCore({ port: 0, authentication: auth, internalServiceSecret: secret });
  const quotes = new InMemoryMarkRegRepository();
  const confirmations = new InMemoryCustomerConfirmationRepository();
  const drafts = new InMemoryMatterDraftRepository();
  const markreg = createMarkReg({
    port: 0,
    repository: quotes,
    customerConfirmationRepository: confirmations,
    matterDraftRepository: drafts,
    internalServiceSecret: secret,
    now: () => '2026-07-31T12:00:00.000Z'
  });
  let gateway: ReturnType<typeof createGateway>,
    base = '',
    markregBase = '',
    cookie = '';
  beforeAll(async () => {
    await users.create({
      userId: '11111111-1111-4111-8111-111111111112',
      email: 'admin@example.test',
      displayName: 'Admin'
    });
    await workspaces.create({ workspaceId, name: 'HTTP Workspace', slug: 'http-workspace' });
    await memberships.create({
      membershipId: '11111111-1111-4111-8111-111111111113',
      workspaceId,
      userId: '11111111-1111-4111-8111-111111111112',
      role: 'WORKSPACE_ADMIN'
    });
    quotes.saveQuote({
      quoteId,
      intakeId: 'intake_http',
      recommendationId: 'recommendation_http',
      selectedOptionCode: 'A',
      pricingRuleVersion: 'quote-v1',
      status: 'READY',
      currency: 'USD',
      lines: [
        {
          code: 'SERVICE',
          description: 'Service fee',
          category: 'SERVICE_FEE',
          amount: { amountMinor: 100, currency: 'USD' }
        }
      ],
      subtotal: { amountMinor: 100, currency: 'USD' },
      estimatedOfficialFees: { amountMinor: 0, currency: 'USD' },
      estimatedServiceFees: { amountMinor: 100, currency: 'USD' },
      estimatedDisbursements: { amountMinor: 0, currency: 'USD' },
      estimatedTaxes: { amountMinor: 0, currency: 'USD' },
      total: { amountMinor: 100, currency: 'USD' },
      assumptions: [{ code: 'SCOPE', text: 'Scope unchanged' }],
      limitations: ['Acceptance is not filing.'],
      validUntil: '2030-01-01T00:00:00.000Z',
      fixtureOnly: true,
      createdAt: '2026-07-31T00:00:00.000Z'
    });
    await core.start();
    await markreg.start();
    markregBase = `http://127.0.0.1:${markreg.listeningPort}`;
    gateway = createGateway({
      port: 0,
      markRegUrl: markregBase,
      authenticationClient: new HttpCoreAuthenticationClient(
        `http://127.0.0.1:${core.listeningPort}`,
        secret
      ),
      internalServiceSecret: secret,
      milestoneTestRuntime: true,
      fixtureUsers: { admin: '11111111-1111-4111-8111-111111111112' },
      csrfSecret: 'csrf-secret-task-020',
      allowedOrigins: ['https://test.markorbit.local']
    });
    await gateway.start();
    base = `http://127.0.0.1:${gateway.listeningPort}`;
    const boot = await fetch(`${base}/__test/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fixture: 'admin' })
    });
    cookie = boot.headers.get('set-cookie')!;
  });
  afterAll(async () => {
    await gateway.stop();
    await markreg.stop();
    await core.stop();
  });
  it('rejects direct MarkReg calls without internal service identity', async () => {
    expect(
      (
        await fetch(`${markregBase}/v1/customer-confirmations/${quoteId}`, {
          headers: { 'x-markorbit-workspace-id': workspaceId }
        })
      ).status
    ).toBe(401);
  });
  it('creates, reads and withdraws through real Core, Gateway and MarkReg listeners', async () => {
    const body = {
      workspaceId,
      quoteId,
      quoteVersion: 'quote-v1',
      planId: 'plan_http',
      planVersion: 'plan-v1',
      termsVersion: 'terms-v1',
      acknowledgements: [{ code: 'NO_FILING', acknowledged: true }]
    };
    const created = await fetch(`${base}/api/markreg/customer-confirmations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body)
    });
    expect(created.status).toBe(200);
    const value = (await created.json()) as {
      confirmation: { confirmationId: string; sourceSnapshotHash: string };
    };
    const read = await fetch(
      `${base}/api/markreg/customer-confirmations/${value.confirmation.confirmationId}`,
      { headers: { cookie, 'x-markorbit-workspace-id': workspaceId } }
    );
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      confirmation: {
        sourceSnapshotHash: value.confirmation.sourceSnapshotHash,
        status: 'CONFIRMED'
      }
    });
    const session = await fetch(`${base}/api/auth/session`, { headers: { cookie } });
    const csrf = ((await session.json()) as { csrfToken: string }).csrfToken;
    const mutationHeaders = {
      'content-type': 'application/json',
      cookie,
      origin: 'https://test.markorbit.local',
      'x-markorbit-csrf-token': csrf,
      'x-markorbit-workspace-id': workspaceId
    };
    const createdDraft = await fetch(`${base}/api/markreg/matter-drafts`, {
      method: 'POST',
      headers: mutationHeaders,
      body: JSON.stringify({
        workspaceId,
        confirmationId: value.confirmation.confirmationId,
        confirmationVersion: 1
      })
    });
    expect(createdDraft.status).toBe(200);
    const draft = (await createdDraft.json()) as {
      matterDraft: { matterDraftId: string; version: number };
    };
    const edited = await fetch(
      `${base}/api/markreg/matter-drafts/${draft.matterDraft.matterDraftId}`,
      {
        method: 'PATCH',
        headers: mutationHeaders,
        body: JSON.stringify({
          workspaceId,
          expectedVersion: 1,
          preparation: { applicantName: 'HTTP Orbit Ltd' }
        })
      }
    );
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({
      matterDraft: { version: 2, preparation: { applicantName: 'HTTP Orbit Ltd' } }
    });
    const stale = await fetch(
      `${base}/api/markreg/matter-drafts/${draft.matterDraft.matterDraftId}`,
      {
        method: 'PATCH',
        headers: mutationHeaders,
        body: JSON.stringify({
          workspaceId,
          expectedVersion: 1,
          preparation: { applicantName: 'Stale loser' }
        })
      }
    );
    expect(stale.status).toBe(409);
    const reloaded = await fetch(
      `${base}/api/markreg/matter-drafts/${draft.matterDraft.matterDraftId}`,
      { headers: { cookie, 'x-markorbit-workspace-id': workspaceId } }
    );
    expect(await reloaded.json()).toMatchObject({
      matterDraft: { version: 2, preparation: { applicantName: 'HTTP Orbit Ltd' } }
    });
    const withdrawn = await fetch(
      `${base}/api/markreg/customer-confirmations/${value.confirmation.confirmationId}/withdraw`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          origin: 'https://test.markorbit.local',
          'x-markorbit-csrf-token': csrf
        },
        body: JSON.stringify({ workspaceId, expectedVersion: 1 })
      }
    );
    expect(withdrawn.status).toBe(200);
    expect(await withdrawn.json()).toMatchObject({
      confirmation: { status: 'WITHDRAWN', version: 2 }
    });
    const evaluated = await fetch(
      `${base}/api/markreg/matter-drafts/${draft.matterDraft.matterDraftId}/evaluate-readiness`,
      {
        method: 'POST',
        headers: mutationHeaders,
        body: JSON.stringify({ workspaceId, expectedVersion: 2 })
      }
    );
    expect(await evaluated.json()).toMatchObject({
      matterDraft: {
        readiness: {
          checks: expect.arrayContaining([
            expect.objectContaining({ code: 'CUSTOMER_CONFIRMATION_VALID', status: 'FAIL' })
          ])
        }
      }
    });
  });
  it('rejects anonymous, missing source, stale source and duplicate creation', async () => {
    const path = `${base}/api/markreg/customer-confirmations`;
    const input = {
      workspaceId,
      quoteId,
      quoteVersion: 'old',
      planId: 'plan_http',
      planVersion: 'v1',
      termsVersion: 'v1',
      acknowledgements: []
    };
    expect(
      (
        await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input)
        })
      ).status
    ).toBe(401);
    expect(
      (
        await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify(input)
        })
      ).status
    ).toBe(409);
    expect(
      (
        await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ ...input, quoteId: 'quote_missing', quoteVersion: 'v1' })
        })
      ).status
    ).toBe(404);
    expect(
      (
        await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ ...input, quoteVersion: 'quote-v1' })
        })
      ).status
    ).toBe(409);
  });
});
