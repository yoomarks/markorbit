import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { CommercialSourceSnapshot } from '@markorbit/contracts/order';
import { ManagedDatabase } from '../packages/persistence/src/index.js';
import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/src/index.js';
import {
  InMemoryOrderCommercialSourceProvider,
  OrderService,
  PostgresCustomerConfirmationRepository,
  PostgresFormalMatterRepository,
  PostgresMatterDraftRepository,
  PostgresOrderMatterConversionService,
  PostgresOrderRepository,
  createRuntime as createMarkReg
} from '../services/markreg/src/index.js';
import {
  hashSnapshot,
  type AcceptedQuoteSnapshot
} from '../services/markreg/src/customer-confirmation.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from '../services/markreg/tests/support/markreg-test-database.js';
import {
  HttpCoreAuthenticationClient,
  createRuntime as createGateway
} from '../apps/gateway/src/index.js';

const databaseUrl = process.env.MARKREG_TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('MARKREG_TEST_DATABASE_URL is required for the M3 Order journey runtime.');

const internalSecret = 'm3-wp06-internal-service-secret-xxxxxxxx';
const csrfSecret = 'm3-wp06-csrf-secret-yyyyyyyyyyyyyyyyyyyy';
const origin = 'http://127.0.0.1:4474';
const at = '2026-08-09T00:00:00.000Z';
process.env.WEB_ORIGINS = origin;

const scenarios = [
  {
    name: 'desktop',
    fixture: 'm3Wp06Desktop',
    workspaceId: '61616161-6161-4616-8616-616161616161',
    otherWorkspaceId: '62626262-6262-4626-8626-626262626262',
    userId: 'user_m3_wp06_desktop'
  },
  {
    name: 'mobile',
    fixture: 'm3Wp06Mobile',
    workspaceId: '63636363-6363-4636-8636-636363636363',
    otherWorkspaceId: '64646464-6464-4646-8646-646464646464',
    userId: 'user_m3_wp06_mobile'
  }
] as const;

const database = new ManagedDatabase({
  connection: { url: databaseUrl },
  applicationName: 'm3-wp06-order-journey',
  poolMaximum: 12,
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
const core = createCore({ port: 4401, authentication, internalServiceSecret: internalSecret });
const sources = new InMemoryOrderCommercialSourceProvider();
let markreg: ReturnType<typeof createMarkReg>;
let gateway: ReturnType<typeof createGateway>;
let vite: ChildProcess;
let tick = 0;
let orderSequence = 0;
let matterSequence = 0;
const now = () => new Date(Date.parse(at) + tick++ * 60_000).toISOString();

function sourceFor(name: string): CommercialSourceSnapshot {
  return {
    schemaVersion: 1,
    quote: {
      quoteId: `quote_wp06-${name}`,
      quoteVersion: 'quote-v6',
      currency: 'USD',
      totalMinor: 96000
    },
    customerConfirmation: {
      confirmationId: `confirmation_wp06-${name}`,
      confirmationVersion: 3,
      status: 'CONFIRMED'
    },
    customerId: `customer_wp06-${name}`,
    channel: 'MARKREG_DIRECT',
    relationshipModel: 'DIRECT',
    commercialScope: {
      applicantReference: `applicant:wp06-${name}`,
      trademarkReference: `MARK ORBIT WP06 ${name.toUpperCase()}`,
      jurisdictionReference: 'US',
      classNumbers: [9, 42],
      goodsServices: ['downloadable software', 'software as a service'],
      selectedPlanId: `plan_wp06-${name}`,
      selectedPlanVersion: 'plan-v6'
    },
    relationshipReferences: {
      contractingParty: { referenceId: 'party_markreg' },
      paymentReceiver: { referenceId: 'party_receiver' },
      deliveryOwner: { referenceId: 'team_delivery' },
      communicationOwner: { referenceId: 'team_care' },
      customerFacingBrand: { referenceId: 'brand_markreg' }
    },
    sourceCorrelationId: `correlation_wp06-${name}`,
    sourceSha256: 'a'.repeat(64),
    capturedAt: at
  };
}

async function seedCommercialSource(
  workspaceId: string,
  source: CommercialSourceSnapshot
): Promise<void> {
  const pool = database.getPool();
  const snapshot: AcceptedQuoteSnapshot = {
    schemaVersion: 1,
    quoteId: source.quote.quoteId,
    quoteVersion: source.quote.quoteVersion,
    planId: source.commercialScope.selectedPlanId,
    planVersion: source.commercialScope.selectedPlanVersion,
    currency: source.quote.currency,
    totalMinor: source.quote.totalMinor,
    lineItems: [
      {
        code: 'SERVICE',
        description: 'Governed trademark service',
        category: 'SERVICE_FEE',
        amountMinor: source.quote.totalMinor
      }
    ],
    termsVersion: 'terms-v1',
    acknowledgementCodes: ['NO_FILING'],
    selectedOptionCode: 'B',
    recommendationId: `recommendation_${source.quote.quoteId}`,
    assumptions: [],
    limitations: ['No external filing is created by confirmation.']
  };
  await pool.query(
    `INSERT INTO customer_confirmations(
      confirmation_id,workspace_id,source_quote_id,source_quote_version,status,version,
      snapshot_schema_version,source_snapshot,source_snapshot_hash,accepted_at,updated_at,withdrawn_at
    ) VALUES($1,$2,$3,$4,'CONFIRMED',$5,1,$6::jsonb,$7,$8,$8,NULL)`,
    [
      source.customerConfirmation.confirmationId,
      workspaceId,
      source.quote.quoteId,
      source.quote.quoteVersion,
      source.customerConfirmation.confirmationVersion,
      JSON.stringify(snapshot),
      hashSnapshot(snapshot),
      at
    ]
  );
  await pool.query(
    `INSERT INTO matter_drafts(
      matter_draft_id,workspace_id,customer_confirmation_id,customer_confirmation_version,
      source_quote_id,source_quote_version,preparation,instruction_completeness,document_readiness,
      readiness,missing_information,status,version,created_at,updated_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'COMPLETE','READY',$8::jsonb,'[]'::jsonb,
      'READY_FOR_PROFESSIONAL_REVIEW',7,$9,$9)`,
    [
      `matter-draft_wp06-${source.customerId}`,
      workspaceId,
      source.customerConfirmation.confirmationId,
      source.customerConfirmation.confirmationVersion,
      source.quote.quoteId,
      source.quote.quoteVersion,
      JSON.stringify({
        applicantName: `Applicant ${source.customerId}`,
        applicantAddress: '1 Orbit Way',
        trademark: source.commercialScope.trademarkReference,
        targetJurisdiction: source.commercialScope.jurisdictionReference,
        classes: [...source.commercialScope.classNumbers],
        goodsServices: source.commercialScope.goodsServices.join('; '),
        filingBasis: 'INTENT_TO_USE',
        representativeRequired: false,
        documentReferences: [`document_${source.customerId}`],
        commercialScopeUnchanged: true
      }),
      JSON.stringify({ evaluatedAt: at, checks: [], readyForProfessionalReview: true }),
      at
    ]
  );
  sources.put(workspaceId, source);
}

async function main() {
  await database.start();
  await resetAndMigrateMarkRegTestDatabase({
    pool: database.getPool(),
    migrationsDirectory: path.resolve('infrastructure/persistence/migrations'),
    migrationOwners: path.resolve('infrastructure/persistence/migration-owners.json')
  });

  for (const scenario of scenarios) {
    await workspaces.create({
      workspaceId: scenario.workspaceId,
      name: `M3 WP06 ${scenario.name}`,
      slug: `m3-wp06-${scenario.name}`
    });
    await workspaces.create({
      workspaceId: scenario.otherWorkspaceId,
      name: `M3 WP06 other ${scenario.name}`,
      slug: `m3-wp06-other-${scenario.name}`
    });
    await users.create({
      userId: scenario.userId,
      email: `${scenario.name}.wp06@markorbit.test`,
      displayName: `WP06 ${scenario.name}`
    });
    await memberships.create({
      membershipId: `membership_wp06_${scenario.name}`,
      workspaceId: scenario.workspaceId,
      userId: scenario.userId,
      role: 'MATTER_MANAGER'
    });
    await memberships.create({
      membershipId: `membership_wp06_other_${scenario.name}`,
      workspaceId: scenario.otherWorkspaceId,
      userId: scenario.userId,
      role: 'READ_ONLY'
    });
    await seedCommercialSource(scenario.workspaceId, sourceFor(scenario.name));
  }

  const repository = new PostgresOrderRepository(database, database.getPool());
  const orderService = new OrderService(
    repository,
    sources,
    now,
    () => `order_wp06-${++orderSequence}` as never
  );
  const conversionService = new PostgresOrderMatterConversionService(
    database,
    database.getPool(),
    now,
    () => `formal-matter_wp06-${++matterSequence}` as never
  );
  const confirmations = new PostgresCustomerConfirmationRepository(database.getPool());
  const drafts = new PostgresMatterDraftRepository(database.getPool());
  const formalMatters = new PostgresFormalMatterRepository(database, database.getPool());

  await core.start();
  markreg = createMarkReg({
    port: 4405,
    internalServiceSecret: internalSecret,
    customerConfirmationRepository: confirmations,
    matterDraftRepository: drafts,
    formalMatterRepository: formalMatters,
    orderService,
    orderMatterConversionService: conversionService,
    now
  });
  await markreg.start();
  gateway = createGateway({
    port: 4400,
    markRegUrl: 'http://127.0.0.1:4405',
    authenticationClient: new HttpCoreAuthenticationClient('http://127.0.0.1:4401', internalSecret),
    internalServiceSecret: internalSecret,
    csrfSecret,
    allowedOrigins: [origin],
    milestoneTestRuntime: true,
    fixtureUsers: Object.fromEntries(
      scenarios.map((scenario) => [scenario.fixture, scenario.userId])
    )
  });
  await gateway.start();
  vite = spawn(
    'pnpm',
    [
      '--filter',
      '@markorbit/markreg-web',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      '4474',
      '--strictPort'
    ],
    {
      env: { ...process.env, VITE_MARKREG_GATEWAY_URL: 'http://127.0.0.1:4400' },
      stdio: 'inherit'
    }
  );
  process.stdout.write(
    `M3_WP06_READY ${JSON.stringify({
      scenarios: scenarios.map((scenario) => ({
        ...scenario,
        confirmationId: sourceFor(scenario.name).customerConfirmation.confirmationId,
        confirmationVersion: sourceFor(scenario.name).customerConfirmation.confirmationVersion
      }))
    })}\n`
  );
}

async function stop() {
  vite?.kill('SIGTERM');
  await gateway?.stop();
  await markreg?.stop();
  await core.stop();
  await database.close();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void stop().finally(() => process.exit(0)));
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
