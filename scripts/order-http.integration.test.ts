import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CommercialSourceSnapshot } from '@markorbit/contracts/order';
import { ManagedDatabase } from '../packages/persistence/dist/index.js';
import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/dist/index.js';
import {
  InMemoryOrderCommercialSourceProvider,
  OrderService,
  PostgresOrderMatterConversionService,
  PostgresOrderRepository,
  createRuntime as createMarkReg
} from '../services/markreg/dist/index.js';
import {
  HttpCoreAuthenticationClient,
  createRuntime as createGateway,
  csrfToken
} from '../apps/gateway/dist/index.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from '../services/markreg/tests/support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_ORDER_HTTP_REQUIRED === '1';
if (required && !url) throw new Error('MARKREG_TEST_DATABASE_URL is required in Order HTTP mode.');
const suite = url ? describe : describe.skip;
const internalKey = 'x'.repeat(40);
const csrfKey = 'y'.repeat(40);
const origin = 'https://order.markorbit.test';
const workspaceId = '45454545-4545-4454-8545-454545454545';
const otherWorkspaceId = '56565656-5656-4565-8565-565656565656';
const SOURCE_AT = '2026-08-09T00:00:00.000Z';

suite.sequential('M3-WP-05 authenticated Order HTTP boundary', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'm3-wp05-order-http',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  const sessions = new InMemorySessionRepository();
  const authentication = new AuthenticationService({ users, workspaces, memberships, sessions });
  const core = createCore({ port: 0, authentication, internalServiceSecret: internalKey });
  const sources = new InMemoryOrderCommercialSourceProvider();
  let repository!: PostgresOrderRepository;
  let tick = 0;
  let orderSequence = 0;
  let matterSequence = 0;
  const now = () => new Date(Date.parse(SOURCE_AT) + tick++ * 60_000).toISOString();
  let markreg!: ReturnType<typeof createMarkReg>;
  let gateway: ReturnType<typeof createGateway>;
  let managerToken = '';
  let managerCsrf = '';
  let readerToken = '';
  let readerCsrf = '';

  const commercialSource = (suffix: string): CommercialSourceSnapshot => ({
    schemaVersion: 1,
    quote: {
      quoteId: `quote_wp05-${suffix}`,
      quoteVersion: 'quote-v5',
      currency: 'USD',
      totalMinor: 96000
    },
    customerConfirmation: {
      confirmationId: `confirmation_wp05-${suffix}`,
      confirmationVersion: 3,
      status: 'CONFIRMED'
    },
    customerId: `customer_wp05-${suffix}`,
    channel: 'MARKREG_DIRECT',
    relationshipModel: 'DIRECT',
    commercialScope: {
      applicantReference: `applicant:${suffix}`,
      trademarkReference: `mark:${suffix}`,
      jurisdictionReference: 'US',
      classNumbers: [9, 42],
      goodsServices: ['downloadable software', 'software as a service'],
      selectedPlanId: `plan_wp05-${suffix}`,
      selectedPlanVersion: 'plan-v3'
    },
    relationshipReferences: {
      contractingParty: { referenceId: 'party_markreg' },
      paymentReceiver: { referenceId: 'party_receiver' },
      deliveryOwner: { referenceId: 'team_delivery' },
      communicationOwner: { referenceId: 'team_care' },
      customerFacingBrand: { referenceId: 'brand_markreg' }
    },
    sourceCorrelationId: `correlation_wp05-${suffix}`,
    sourceSha256: 'a'.repeat(64),
    capturedAt: SOURCE_AT
  });

  async function seed(value: CommercialSourceSnapshot) {
    await database.getPool().query(
      `INSERT INTO customer_confirmations(
        confirmation_id,workspace_id,source_quote_id,source_quote_version,status,version,
        snapshot_schema_version,source_snapshot,source_snapshot_hash,accepted_at,updated_at,withdrawn_at
      ) VALUES($1,$2,$3,$4,'CONFIRMED',$5,1,$6::jsonb,$7,$8,$8,NULL)`,
      [
        value.customerConfirmation.confirmationId,
        workspaceId,
        value.quote.quoteId,
        value.quote.quoteVersion,
        value.customerConfirmation.confirmationVersion,
        JSON.stringify({
          schemaVersion: 1,
          quoteId: value.quote.quoteId,
          quoteVersion: value.quote.quoteVersion,
          planId: value.commercialScope.selectedPlanId,
          planVersion: value.commercialScope.selectedPlanVersion,
          currency: value.quote.currency,
          totalMinor: value.quote.totalMinor,
          lineItems: [],
          termsVersion: 'terms-v1',
          acknowledgementCodes: ['SCOPE_CONFIRMED'],
          selectedOptionCode: 'B',
          recommendationId: `recommendation_${value.quote.quoteId}`,
          assumptions: [],
          limitations: []
        }),
        'b'.repeat(64),
        SOURCE_AT
      ]
    );
    await database.getPool().query(
      `INSERT INTO matter_drafts(
        matter_draft_id,workspace_id,customer_confirmation_id,customer_confirmation_version,
        source_quote_id,source_quote_version,preparation,instruction_completeness,document_readiness,
        readiness,missing_information,status,version,created_at,updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'COMPLETE','READY',$8::jsonb,'[]'::jsonb,
        'READY_FOR_PROFESSIONAL_REVIEW',7,$9,$9)`,
      [
        `matter-draft_wp05-${value.customerId}`,
        workspaceId,
        value.customerConfirmation.confirmationId,
        value.customerConfirmation.confirmationVersion,
        value.quote.quoteId,
        value.quote.quoteVersion,
        JSON.stringify({
          applicantName: `Applicant ${value.customerId}`,
          applicantAddress: '1 Orbit Way',
          trademark: value.commercialScope.trademarkReference,
          targetJurisdiction: value.commercialScope.jurisdictionReference,
          classes: [...value.commercialScope.classNumbers],
          goodsServices: value.commercialScope.goodsServices.join('; '),
          filingBasis: 'INTENT_TO_USE',
          representativeRequired: false,
          documentReferences: ['document_scope-confirmation'],
          commercialScopeUnchanged: true
        }),
        JSON.stringify({ evaluatedAt: SOURCE_AT, checks: [], readyForProfessionalReview: true }),
        SOURCE_AT
      ]
    );
    sources.put(workspaceId, value);
  }

  const request = (
    token: string | undefined,
    csrf: string | undefined,
    method: 'GET' | 'POST',
    pathname: string,
    body?: unknown,
    key?: string,
    workspace = workspaceId
  ) =>
    fetch(`http://127.0.0.1:${gateway.listeningPort}${pathname}`, {
      method,
      headers: {
        ...(token ? { cookie: `mo_session=${token}` } : {}),
        'x-markorbit-workspace-id': workspace,
        ...(method === 'POST'
          ? {
              origin,
              ...(csrf ? { 'x-markorbit-csrf-token': csrf } : {}),
              ...(key ? { 'idempotency-key': key } : {}),
              'content-type': 'application/json'
            }
          : {})
      },
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {})
    });

  async function readyOrder(suffix: string) {
    const source = commercialSource(suffix);
    await seed(source);
    const create = await request(
      managerToken,
      managerCsrf,
      'POST',
      '/api/markreg/orders',
      {
        workspaceId,
        orderType: 'TrademarkFiling',
        quoteId: source.quote.quoteId,
        expectedQuoteVersion: source.quote.quoteVersion,
        customerConfirmationId: source.customerConfirmation.confirmationId,
        expectedCustomerConfirmationVersion: source.customerConfirmation.confirmationVersion,
        channel: source.channel,
        relationshipModel: source.relationshipModel
      },
      `create-${suffix}`
    );
    const createBody = (await create.json()) as {
      orderId?: string;
      version?: number;
      code?: string;
      message?: string;
    };
    expect({ status: create.status, body: createBody }).toMatchObject({
      status: 201,
      body: { orderId: expect.any(String), version: 1 }
    });
    const draft = createBody as { orderId: string; version: number };
    const pending = await request(
      managerToken,
      managerCsrf,
      'POST',
      `/api/markreg/orders/${draft.orderId}/request-confirmation`,
      { workspaceId, expectedVersion: draft.version },
      `pending-${suffix}`
    );
    const pendingBody = (await pending.json()) as { version: number };
    const confirmed = await request(
      managerToken,
      managerCsrf,
      'POST',
      `/api/markreg/orders/${draft.orderId}/confirm`,
      { workspaceId, expectedVersion: pendingBody.version },
      `confirm-${suffix}`
    );
    const confirmedBody = (await confirmed.json()) as { version: number };
    const ready = await request(
      managerToken,
      managerCsrf,
      'POST',
      `/api/markreg/orders/${draft.orderId}/evaluate-readiness`,
      { workspaceId, expectedVersion: confirmedBody.version },
      `ready-${suffix}`
    );
    expect(ready.status).toBe(200);
    return (await ready.json()) as {
      orderId: string;
      version: number;
      status: string;
      source: { snapshotSha256: string };
    };
  }

  beforeAll(async () => {
    await database.start();
    repository = new PostgresOrderRepository(database, database.getPool());
    const orderService = new OrderService(
      repository,
      sources,
      now,
      () => `order_wp05-${++orderSequence}` as never
    );
    const conversionService = new PostgresOrderMatterConversionService(
      database,
      database.getPool(),
      now,
      () => `formal-matter_wp05-${++matterSequence}` as never
    );
    markreg = createMarkReg({
      port: 0,
      internalServiceSecret: internalKey,
      orderService,
      orderMatterConversionService: conversionService
    });
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory: path.resolve('infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('infrastructure/persistence/migration-owners.json')
    });
    await workspaces.create({ workspaceId, name: 'Order Workspace', slug: 'order-workspace' });
    await workspaces.create({
      workspaceId: otherWorkspaceId,
      name: 'Other Workspace',
      slug: 'other-order-workspace'
    });
    const managerId = '11111111-1111-4111-8111-111111111111';
    const readerId = '22222222-2222-4222-8222-222222222222';
    await users.create({ userId: managerId, email: 'manager@order.test', displayName: 'Manager' });
    await users.create({ userId: readerId, email: 'reader@order.test', displayName: 'Reader' });
    await memberships.create({
      membershipId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      workspaceId,
      userId: managerId,
      role: 'MATTER_MANAGER'
    });
    await memberships.create({
      membershipId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      workspaceId: otherWorkspaceId,
      userId: managerId,
      role: 'MATTER_MANAGER'
    });
    await memberships.create({
      membershipId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      workspaceId,
      userId: readerId,
      role: 'READ_ONLY'
    });
    const managerSession = await authentication.issueSession(managerId);
    managerToken = managerSession.rawToken;
    managerCsrf = csrfToken(managerSession.session.sessionId, csrfKey);
    const readerSession = await authentication.issueSession(readerId);
    readerToken = readerSession.rawToken;
    readerCsrf = csrfToken(readerSession.session.sessionId, csrfKey);
    await core.start();
    await markreg.start();
    gateway = createGateway({
      port: 0,
      markRegUrl: `http://127.0.0.1:${markreg.listeningPort}`,
      authenticationClient: new HttpCoreAuthenticationClient(
        `http://127.0.0.1:${core.listeningPort}`,
        internalKey
      ),
      internalServiceSecret: internalKey,
      csrfSecret: csrfKey,
      allowedOrigins: [origin]
    });
    await gateway.start();
  });

  afterAll(async () => {
    await Promise.allSettled([gateway?.stop(), markreg.stop(), core.stop()]);
    await database.close();
  });

  it('persists the authenticated Draft-to-MatterCreated path and replay', async () => {
    const ready = await readyOrder('forward');
    expect(ready.status).toBe('ReadyForMatter');
    expect(
      (await request(managerToken, undefined, 'GET', `/api/markreg/orders/${ready.orderId}`)).status
    ).toBe(200);
    expect(
      (await request(managerToken, undefined, 'GET', '/api/markreg/orders?page=1&pageSize=10'))
        .status
    ).toBe(200);
    const body = {
      workspaceId,
      expectedOrderVersion: ready.version,
      expectedCommercialSourceSha256: ready.source.snapshotSha256
    };
    const converted = await request(
      managerToken,
      managerCsrf,
      'POST',
      `/api/markreg/orders/${ready.orderId}/create-matter`,
      body,
      'convert-forward'
    );
    expect(converted.status).toBe(200);
    const first = (await converted.json()) as {
      orderStatus: string;
      orderVersion: number;
      linkKind: string;
      linkedAt: string;
    };
    expect(first).toMatchObject({
      orderStatus: 'MatterCreated',
      orderVersion: 5,
      linkKind: 'CREATED_FROM_ORDER'
    });
    expect(Number.isFinite(Date.parse(first.linkedAt))).toBe(true);
    const replay = await request(
      managerToken,
      managerCsrf,
      'POST',
      `/api/markreg/orders/${ready.orderId}/create-matter`,
      body,
      'convert-forward'
    );
    expect(await replay.json()).toEqual(first);
  });

  it('enforces typed auth, spoof, tenant and conflict boundaries', async () => {
    expect((await request(undefined, undefined, 'GET', '/api/markreg/orders')).status).toBe(401);
    const value = commercialSource('negative');
    await seed(value);
    const base = {
      workspaceId,
      orderType: 'TrademarkFiling',
      quoteId: value.quote.quoteId,
      expectedQuoteVersion: value.quote.quoteVersion,
      customerConfirmationId: value.customerConfirmation.confirmationId,
      expectedCustomerConfirmationVersion: value.customerConfirmation.confirmationVersion,
      channel: value.channel,
      relationshipModel: value.relationshipModel
    };
    expect(
      (
        await request(
          managerToken,
          managerCsrf,
          'POST',
          '/api/markreg/orders',
          { ...base, workspaceId: otherWorkspaceId },
          'wrong-workspace'
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(
          managerToken,
          managerCsrf,
          'POST',
          '/api/markreg/orders',
          { ...base, actorId: 'forged' },
          'spoof'
        )
      ).status
    ).toBe(400);
    expect(
      (await request(readerToken, readerCsrf, 'POST', '/api/markreg/orders', base, 'reader')).status
    ).toBe(403);
    expect(
      (await request(managerToken, undefined, 'GET', '/api/markreg/orders/order_wp05-missing'))
        .status
    ).toBe(404);
    const ready = await readyOrder('tenant');
    expect(
      (
        await request(
          managerToken,
          undefined,
          'GET',
          `/api/markreg/orders/${ready.orderId}`,
          undefined,
          undefined,
          otherWorkspaceId
        )
      ).status
    ).toBe(404);
    const conflict = await request(
      managerToken,
      managerCsrf,
      'POST',
      `/api/markreg/orders/${ready.orderId}/cancel`,
      { workspaceId, expectedVersion: 1, reason: 'stale browser state' },
      'cancel-stale'
    );
    expect(conflict.status).toBe(409);
  });

  it('maps MarkReg outage to a safe 503', async () => {
    await markreg.stop();
    const response = await request(managerToken, undefined, 'GET', '/api/markreg/orders');
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/iu);
  });
});
