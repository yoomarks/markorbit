import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate
} from '../packages/persistence/dist/index.js';
import {
  AuthenticationService,
  PostgresMembershipRepository,
  PostgresSessionRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/dist/index.js';
import {
  createDurableExecutionProviderRoutes,
  createRuntime as createExecution,
  providerExecutionSourceFingerprint
} from '../services/execution/dist/index.js';
import {
  createDurableMgsnServices,
  createRuntime as createMgsn
} from '../services/mgsn/dist/index.js';
import {
  HttpCoreAuthenticationClient,
  PROVIDER_WORKSPACE_HEADER_NAME,
  createRuntime as createGateway,
  csrfToken
} from '../apps/gateway/dist/index.js';

const coreUrl = process.env.M4_RUNTIME_CORE_DATABASE_URL;
const executionUrl = process.env.M4_RUNTIME_EXECUTION_DATABASE_URL;
const mgsnUrl = process.env.M4_RUNTIME_MGSN_DATABASE_URL;
const required = process.env.M4_RUNTIME_INTEGRATION_REQUIRED === '1';
if (required && (!coreUrl || !executionUrl || !mgsnUrl))
  throw new Error(
    'M4_RUNTIME_CORE_DATABASE_URL, M4_RUNTIME_EXECUTION_DATABASE_URL and M4_RUNTIME_MGSN_DATABASE_URL are required.'
  );
const suite = coreUrl && executionUrl && mgsnUrl ? describe : describe.skip;

const secret = 'm4-runtime-internal-secret-32-bytes-minimum';
const csrfSecret = 'm4-runtime-csrf-secret-32-bytes-minimum';
const origin = 'https://m4-runtime.markorbit.test';
const customerWorkspaceId = '11111111-1111-4111-8111-111111111111';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const operatorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const providerUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const operatorMembershipId = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
const providerMembershipId = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
const preparationLockId = 'preparation-lock_m4-runtime' as const;
const filingAuthorizationId = 'filing-authorization_m4-runtime' as const;
const executionReleaseId = 'execution-release_m4-runtime' as const;
const taskId = 'filing-task-draft_m4-runtime' as const;
const correlationId = 'correlation_m4-runtime' as const;
const preparationLockVersion = '1:1:2026-08-09T15:00:00.000Z';
const window = {
  startsAt: '2026-08-10T09:00:00.000Z',
  endsAt: '2026-08-10T17:00:00.000Z'
};

function database(url: string, applicationName: string, migrationNamespace: string) {
  return new ManagedDatabase({
    connection: { url },
    applicationName,
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace
  });
}

suite.sequential('M4 zero-interception durable provider runtime', () => {
  const coreDatabase = database(coreUrl!, 'm4-runtime-core', 'm4_runtime_core');
  const executionDatabase = database(executionUrl!, 'm4-runtime-execution', 'm4_runtime_execution');
  const mgsnDatabase = database(mgsnUrl!, 'm4-runtime-mgsn', 'm4_runtime_mgsn');
  let core: ReturnType<typeof createCore>;
  let execution: ReturnType<typeof createExecution>;
  let mgsn: ReturnType<typeof createMgsn>;
  let gateway: ReturnType<typeof createGateway>;
  let operatorToken = '';
  let operatorCsrf = '';
  let providerToken = '';
  let providerCsrf = '';

  async function resetOwner(
    value: ManagedDatabase,
    owner: '@markorbit/core-service' | '@markorbit/execution-service' | '@markorbit/mgsn-service',
    namespace: string
  ) {
    await value.start();
    const pool = value.getPool();
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
    const migrations = await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      owner
    );
    await migrate(pool, namespace, migrations);
  }

  async function seedExecutionSource() {
    const authorization = {
      schemaVersion: 1,
      version: 2,
      filingAuthorizationId,
      preparationLockId,
      preparationLockVersion,
      preparationSnapshot: {
        documentPackage: {},
        instructionLedger: {},
        sourceReviewDecisionVersion: 'review-v1',
        sourceMatterDraftVersion: 'matter-v1',
        commercialScopeUnchanged: true
      },
      professionalReviewCaseId: 'professional-review_m4-runtime',
      professionalReviewVersion: 'review-v1',
      customerId: 'customer_m4-runtime',
      authorizedParty: { partyId: 'party_owner', displayName: 'M4 Runtime Owner' },
      authorizationCapacity: 'OWNER',
      jurisdiction: 'US',
      applicantOwnerReference: 'owner_m4-runtime',
      trademarkReference: 'MARK ORBIT',
      classes: ['25'],
      goodsServices: ['clothing'],
      filingBasis: '1(b)',
      representativeRequirement: 'REVIEW_REQUIRED',
      scope: {
        jurisdiction: 'US',
        applicantOwnerReference: 'owner_m4-runtime',
        trademarkReference: 'MARK ORBIT',
        classes: ['25'],
        goodsServices: ['clothing'],
        filingBasis: '1(b)',
        useLockedDocuments: true,
        representativeUse: 'PERMITTED_WHERE_REQUIRED',
        permittedFilingChannel: 'INTERNAL_MANUAL_PREPARATION',
        permittedExecutionWindow: window
      },
      termsVersion: 'terms-v1',
      acknowledgements: [],
      evidence: [],
      status: 'AUTHORIZED',
      authorizedAt: '2026-08-09T15:02:00.000Z',
      createdAt: '2026-08-09T15:00:00.000Z',
      updatedAt: '2026-08-09T15:02:00.000Z'
    };
    const release = {
      schemaVersion: 1,
      version: 3,
      executionReleaseId,
      filingAuthorizationId,
      filingAuthorizationVersion: 2,
      preparationLockId,
      preparationLockVersion,
      professionalReviewCaseId: 'professional-review_m4-runtime',
      professionalReviewVersion: 'review-v1',
      customerId: 'customer_m4-runtime',
      jurisdiction: 'US',
      requestedExecutionChannel: 'INTERNAL_MANUAL_PREPARATION',
      checks: [],
      assignment: {},
      decision: {
        decision: 'RELEASE',
        decidedBy: 'user_execution-manager',
        rationale: 'Explicitly released for governed provider execution.',
        decidedAt: '2026-08-09T15:05:00.000Z'
      },
      evidence: [],
      status: 'RELEASED_FOR_EXECUTION',
      createdAt: '2026-08-09T15:03:00.000Z',
      updatedAt: '2026-08-09T15:05:00.000Z',
      releasedAt: '2026-08-09T15:05:00.000Z'
    };
    const task = {
      schemaVersion: 1,
      filingExecutionTaskDraftId: taskId,
      executionReleaseId,
      filingAuthorizationId,
      preparationLockId,
      executionSnapshot: authorization.scope,
      jurisdiction: 'US',
      applicant: 'M4 Runtime Applicant',
      trademark: 'MARK ORBIT',
      classes: ['25'],
      goodsServices: ['clothing'],
      filingBasis: '1(b)',
      documentReferences: ['document_m4-runtime'],
      instructionReferences: ['instruction_m4-runtime'],
      representativeRequirement: 'REVIEW_REQUIRED',
      executionChannel: 'INTERNAL_MANUAL_PREPARATION',
      status: 'PREPARED',
      createdAt: '2026-08-09T15:05:00.000Z'
    };
    const pool = executionDatabase.getPool();
    await pool.query(
      `INSERT INTO filing_authorizations(
         filing_authorization_id,workspace_id,preparation_lock_id,preparation_lock_version,status,version,
         authorization_record,created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,$3,$4,'AUTHORIZED',2,$5::jsonb,$6,$6,$7,$8)`,
      [
        filingAuthorizationId,
        customerWorkspaceId,
        preparationLockId,
        preparationLockVersion,
        JSON.stringify(authorization),
        operatorUserId,
        authorization.createdAt,
        authorization.updatedAt
      ]
    );
    await pool.query(
      `INSERT INTO execution_releases(
         execution_release_id,workspace_id,filing_authorization_id,filing_authorization_version,status,version,
         release_record,created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,$3,2,'RELEASED_FOR_EXECUTION',3,$4::jsonb,$5,$5,$6,$7)`,
      [
        executionReleaseId,
        customerWorkspaceId,
        filingAuthorizationId,
        JSON.stringify(release),
        operatorUserId,
        release.createdAt,
        release.updatedAt
      ]
    );
    await pool.query(
      `INSERT INTO filing_execution_task_drafts(
         filing_execution_task_draft_id,workspace_id,execution_release_id,filing_authorization_id,status,
         task_record,created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,$3,$4,'PREPARED',$5::jsonb,$6,$6,$7,$7)`,
      [
        taskId,
        customerWorkspaceId,
        executionReleaseId,
        filingAuthorizationId,
        JSON.stringify(task),
        operatorUserId,
        task.createdAt
      ]
    );
  }

  function browserHeaders(
    token: string,
    csrf: string,
    workspaceId: string,
    key?: string,
    provider = false
  ) {
    return {
      cookie: `mo_session=${token}`,
      ...(provider
        ? { [PROVIDER_WORKSPACE_HEADER_NAME]: workspaceId }
        : { 'x-markorbit-workspace-id': workspaceId }),
      ...(key
        ? {
            origin,
            'x-markorbit-csrf-token': csrf,
            'idempotency-key': key,
            'content-type': 'application/json'
          }
        : {})
    };
  }

  async function post(
    pathname: string,
    body: unknown,
    key: string,
    provider = false
  ): Promise<{ status: number; body: Record<string, any> }> {
    const response = await fetch(`http://127.0.0.1:${gateway.listeningPort}${pathname}`, {
      method: 'POST',
      headers: browserHeaders(
        provider ? providerToken : operatorToken,
        provider ? providerCsrf : operatorCsrf,
        provider ? providerWorkspaceId : customerWorkspaceId,
        key,
        provider
      ),
      body: JSON.stringify(body)
    });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  }

  beforeAll(async () => {
    await resetOwner(coreDatabase, '@markorbit/core-service', 'm4_runtime_core');
    await resetOwner(executionDatabase, '@markorbit/execution-service', 'm4_runtime_execution');
    await resetOwner(mgsnDatabase, '@markorbit/mgsn-service', 'm4_runtime_mgsn');

    const corePool = coreDatabase.getPool();
    const users = new PostgresUserRepository(corePool);
    const workspaces = new PostgresWorkspaceRepository(corePool);
    const memberships = new PostgresMembershipRepository(corePool);
    const sessions = new PostgresSessionRepository(corePool);
    const authentication = new AuthenticationService({ users, workspaces, memberships, sessions });
    await workspaces.create({
      workspaceId: customerWorkspaceId,
      name: 'M4 Customer Workspace',
      slug: 'm4-customer-workspace'
    });
    await workspaces.create({
      workspaceId: providerWorkspaceId,
      name: 'M4 Provider Workspace',
      slug: 'm4-provider-workspace'
    });
    await users.create({
      userId: operatorUserId,
      email: 'operator@m4-runtime.test',
      displayName: 'M4 Operator'
    });
    await users.create({
      userId: providerUserId,
      email: 'provider@m4-runtime.test',
      displayName: 'M4 Provider'
    });
    await memberships.create({
      membershipId: operatorMembershipId,
      workspaceId: customerWorkspaceId,
      userId: operatorUserId,
      role: 'WORKSPACE_ADMIN'
    });
    await memberships.create({
      membershipId: providerMembershipId,
      workspaceId: providerWorkspaceId,
      userId: providerUserId,
      role: 'WORKSPACE_ADMIN'
    });
    const operatorSession = await authentication.issueSession(operatorUserId);
    operatorToken = operatorSession.rawToken;
    operatorCsrf = csrfToken(operatorSession.session.sessionId, csrfSecret);
    const providerSession = await authentication.issueSession(providerUserId);
    providerToken = providerSession.rawToken;
    providerCsrf = csrfToken(providerSession.session.sessionId, csrfSecret);

    core = createCore({
      port: 0,
      authentication,
      workspaces,
      internalServiceSecret: secret
    });
    await core.start();

    await seedExecutionSource();
    execution = createExecution({
      port: 0,
      internalServiceSecret: secret,
      providerExecutionRoutes: createDurableExecutionProviderRoutes({
        database: executionDatabase,
        internalServiceSecret: secret
      })
    });
    await execution.start();

    const mgsnServices = createDurableMgsnServices({
      database: mgsnDatabase,
      coreUrl: `http://127.0.0.1:${core.listeningPort}`,
      executionUrl: `http://127.0.0.1:${execution.listeningPort}`,
      internalServiceSecret: secret
    });
    mgsn = createMgsn({ port: 0, internalServiceSecret: secret, services: mgsnServices });
    await mgsn.start();

    gateway = createGateway({
      port: 0,
      mgsnUrl: `http://127.0.0.1:${mgsn.listeningPort}`,
      coreUrl: `http://127.0.0.1:${core.listeningPort}`,
      authenticationClient: new HttpCoreAuthenticationClient(
        `http://127.0.0.1:${core.listeningPort}`,
        secret
      ),
      internalServiceSecret: secret,
      csrfSecret,
      allowedOrigins: [origin]
    });
    await gateway.start();
  });

  afterAll(async () => {
    await Promise.allSettled([gateway?.stop(), mgsn?.stop(), execution?.stop(), core?.stop()]);
    await Promise.allSettled([
      mgsnDatabase.close(),
      executionDatabase.close(),
      coreDatabase.close()
    ]);
  });

  it('runs the exact authenticated provider loop into a durable PENDING_REVIEW Execution receipt', async () => {
    const providerResult = await post(
      '/api/mgsn/providers',
      { providerWorkspaceId, displayName: 'M4 Runtime Provider' },
      'm4-provider-create'
    );
    expect(providerResult.status).toBe(201);
    const provider = providerResult.body.provider;

    const capabilityResult = await post(
      `/api/mgsn/providers/${provider.providerId}/supply-capabilities`,
      {
        jurisdictions: ['US'],
        serviceTypes: ['TRADEMARK_FILING'],
        effectiveFrom: '2026-08-01T00:00:00.000Z',
        effectiveUntil: '2026-12-31T23:59:59.000Z',
        capacityUnits: 5,
        availabilityUnits: 5,
        evidenceReferences: ['evidence_m4-runtime-provider-capability'],
        verificationState: 'VERIFIED_FOR_SUPPLY'
      },
      'm4-capability-create'
    );
    expect(capabilityResult.status).toBe(201);
    const capability = capabilityResult.body.supplyCapability;

    const unsignedSource = {
      schemaVersion: 1 as const,
      workspaceId: customerWorkspaceId,
      preparationLock: { id: preparationLockId, version: preparationLockVersion },
      filingAuthorization: { id: filingAuthorizationId, version: 2 },
      executionRelease: { id: executionReleaseId, version: 3 },
      filingExecutionTaskDraft: { id: taskId, version: 1 },
      jurisdiction: 'US',
      serviceType: 'TRADEMARK_FILING',
      serviceScope: ['CLASS_25', 'NEW_APPLICATION'],
      documentReferences: ['document_m4-runtime'],
      instructionReferences: ['instruction_m4-runtime'],
      executionWindow: window,
      channel: 'INTERNAL_OPERATIONS' as const,
      relationshipModel: 'CO_DELIVERY' as const,
      correlationId,
      capturedAt: '2026-08-09T15:10:00.000Z'
    };
    const source = {
      ...unsignedSource,
      sourceFingerprintSha256: providerExecutionSourceFingerprint(unsignedSource)
    };
    const packageResult = await post(
      '/api/mgsn/service-packages',
      { workspaceId: customerWorkspaceId, source, correlationId },
      'm4-service-package'
    );
    expect(packageResult.status).toBe(201);
    const servicePackage = packageResult.body.servicePackage;

    const eligibilityResult = await post(
      `/api/mgsn/service-packages/${servicePackage.servicePackageId}/evaluate-provider`,
      {
        workspaceId: customerWorkspaceId,
        expectedServicePackageVersion: servicePackage.version,
        expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
        providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
        expectedProviderSupplyCapabilityVersion: capability.version,
        expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
        correlationId
      },
      'm4-eligibility'
    );
    expect(eligibilityResult.status).toBe(201);
    const eligibility = eligibilityResult.body.eligibilityEvaluation;
    expect(eligibility.outcome).toBe('ELIGIBLE');

    const allocationResult = await post(
      '/api/mgsn/allocations',
      {
        workspaceId: customerWorkspaceId,
        servicePackageId: servicePackage.servicePackageId,
        expectedServicePackageVersion: servicePackage.version,
        expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
        eligibilityEvaluationId: eligibility.eligibilityEvaluationId,
        expectedEligibilityEvaluationVersion: eligibility.version,
        expectedEligibilityFingerprintSha256: eligibility.deterministicFingerprintSha256,
        providerId: provider.providerId,
        providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
        expectedProviderSupplyCapabilityVersion: capability.version,
        rationale: 'Explicit operator allocation after deterministic eligibility.',
        correlationId
      },
      'm4-allocation'
    );
    expect(allocationResult.status).toBe(201);
    const allocation = allocationResult.body.allocation;

    const acceptanceResult = await post(
      `/api/provider/allocations/${allocation.allocationId}/respond`,
      {
        workspaceId: customerWorkspaceId,
        expectedAllocationVersion: allocation.version,
        decision: 'ACCEPTED',
        acknowledgement: 'Authenticated provider accepts this exact allocation.',
        correlationId
      },
      'm4-acceptance',
      true
    );
    expect(acceptanceResult.status).toBe(201);
    const acceptance = acceptanceResult.body.providerAcceptance;
    expect(acceptance.providerWorkspaceId).toBe(providerWorkspaceId);

    const returnResult = await post(
      '/api/provider/returns',
      {
        workspaceId: customerWorkspaceId,
        allocationId: allocation.allocationId,
        expectedAllocationVersion: allocation.version,
        providerAcceptanceId: acceptance.providerAcceptanceId,
        expectedProviderAcceptanceVersion: acceptance.version,
        servicePackageId: servicePackage.servicePackageId,
        expectedServicePackageVersion: servicePackage.version,
        workStatusClaim: 'Provider reports work completed; evidence awaits Execution review.',
        artifacts: [{ reference: 'artifact://m4-runtime/provider-return.pdf' }],
        assertions: [
          {
            code: 'PROVIDER_CLAIMS_WORK_COMPLETED',
            value: true,
            evidenceReferences: ['artifact://m4-runtime/provider-return.pdf']
          }
        ],
        correlationId
      },
      'm4-provider-return',
      true
    );
    expect(returnResult.status).toBe(201);
    const providerReturn = returnResult.body.providerReturn;
    expect(providerReturn.providerWorkspaceId).toBe(providerWorkspaceId);

    const handoffResult = await post(
      `/api/mgsn/provider-returns/${providerReturn.providerReturnId}/handoff`,
      {
        workspaceId: customerWorkspaceId,
        expectedProviderReturnVersion: providerReturn.version,
        expectedProviderReturnFingerprintSha256: providerReturn.returnFingerprintSha256,
        executionReleaseId,
        expectedExecutionReleaseVersion: 3,
        filingExecutionTaskDraftId: taskId,
        expectedFilingExecutionTaskDraftVersion: 1,
        correlationId
      },
      'm4-evidence-handoff'
    );
    expect(handoffResult.status).toBe(201);
    const handoff = handoffResult.body.evidenceHandoff;

    const receiptResponse = await fetch(
      `http://127.0.0.1:${execution.listeningPort}/internal/provider-return-evidence/${handoff.evidenceHandoffId}`,
      {
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-workspace-id': customerWorkspaceId
        }
      }
    );
    expect(receiptResponse.status).toBe(200);
    const receiptBody = (await receiptResponse.json()) as Record<string, any>;
    expect(receiptBody.receipt).toMatchObject({
      reviewStatus: 'PENDING_REVIEW',
      providerWorkspaceId,
      authorityConsequences: {
        providerReturnCreated: true,
        executionEvidenceHandedOff: true,
        paymentCreated: false,
        invoiceCreated: false,
        professionalLegallyAppointedAutomatically: false,
        filingSubmitted: false,
        officialApplicationCreated: false,
        officialApplicationNumberReceived: false,
        trademarkOfficeAcceptance: false,
        trademarkOfficeContactedAsVerifiedTruth: false,
        formalMatterCompletedAutomatically: false,
        userCapabilityVerifiedAutomatically: false
      }
    });
  });
});
