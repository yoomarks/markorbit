import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  allocationAuthorityConsequences,
  providerAcceptanceAuthorityConsequences,
  type ProviderExecutionSourceSnapshot
} from '@markorbit/contracts/provider-execution';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import {
  ProviderRegistryService,
  type CoreWorkspaceIdentityReference
} from '../src/provider-registry.js';
import { PostgresServicePackageEligibilityRepository } from '../src/service-package-eligibility-postgres.js';
import {
  ServicePackageEligibilityService,
  type ExecutionSourceVerification
} from '../src/service-package-eligibility.js';
import { PostgresAllocationProviderAcceptanceRepository } from '../src/allocation-provider-acceptance-postgres.js';
import { AllocationProviderAcceptanceService } from '../src/allocation-provider-acceptance.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_ALLOCATION_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('MGSN_TEST_DATABASE_URL is required when MGSN_ALLOCATION_POSTGRES_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const workspaceA = '11111111-1111-4111-8111-111111111111';
const providerWorkspace = '22222222-2222-4222-8222-222222222222';
const otherProviderWorkspace = '33333333-3333-4333-8333-333333333333';
const operator = 'user_mgsn_operator';
const providerActor = 'user_provider_actor';
const correlationId = 'correlation_wp05' as const;
const executionFingerprint = 'a'.repeat(64);

suite('M4-WP-05 durable Allocation and authenticated Provider Acceptance', () => {
  const namespace = 'mgsn_allocation_wp05_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  const core = new Map<string, CoreWorkspaceIdentityReference>();
  let providerSequence = 0;
  let capabilitySequence = 0;
  let packageSequence = 0;
  let evaluationSequence = 0;
  let allocationSequence = 0;
  let acceptanceSequence = 0;
  let clock = '2026-08-09T08:00:00.000Z';
  let sourceVerification: ExecutionSourceVerification = {
    status: 'CURRENT',
    exactSourceFingerprintSha256: executionFingerprint
  };
  const migrations = () =>
    loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/mgsn-service'
    );
  const providerRepository = () =>
    new PostgresProviderRegistryRepository(database, database.getPool());
  const providerService = () =>
    new ProviderRegistryService(
      providerRepository(),
      {
        getWorkspace: (workspaceId) => {
          const value = core.get(workspaceId);
          return Promise.resolve(value ? structuredClone(value) : undefined);
        }
      },
      () => clock,
      () => `provider_wp05_${++providerSequence}`,
      () => `provider-supply-capability_wp05_${++capabilitySequence}`
    );
  const packageRepository = () =>
    new PostgresServicePackageEligibilityRepository(database, database.getPool());
  const eligibilityService = () =>
    new ServicePackageEligibilityService(
      packageRepository(),
      providerRepository(),
      { verifyCurrentSource: () => Promise.resolve(structuredClone(sourceVerification)) },
      () => clock,
      () => `service-package_wp05_${++packageSequence}`,
      () => `eligibility-evaluation_wp05_${++evaluationSequence}`
    );
  const allocationRepository = () =>
    new PostgresAllocationProviderAcceptanceRepository(database, database.getPool());
  const allocationService = () =>
    new AllocationProviderAcceptanceService(
      allocationRepository(),
      packageRepository(),
      providerRepository(),
      { verifyCurrentSource: () => Promise.resolve(structuredClone(sourceVerification)) },
      () => clock,
      () => `allocation_wp05_${++allocationSequence}`,
      () => `provider-acceptance_wp05_${++acceptanceSequence}`
    );

  const source = (): ProviderExecutionSourceSnapshot => ({
    schemaVersion: 1,
    workspaceId: workspaceA,
    formalMatter: { id: 'formal-matter_wp05', version: 1 },
    preparationLock: { id: 'preparation-lock_wp05', version: 1 },
    filingAuthorization: { id: 'filing-authorization_wp05', version: 1 },
    executionRelease: { id: 'execution-release_wp05', version: 1 },
    filingExecutionTaskDraft: { id: 'filing-task-draft_wp05', version: 1 },
    jurisdiction: 'US',
    serviceType: 'TRADEMARK_FILING',
    serviceScope: ['CLASS_25', 'NEW_APPLICATION'],
    documentReferences: ['document_package_wp05'],
    instructionReferences: ['instruction_ledger_wp05'],
    executionWindow: {
      startsAt: '2026-08-10T09:00:00.000Z',
      endsAt: '2026-08-10T17:00:00.000Z'
    },
    channel: 'INTERNAL_OPERATIONS',
    relationshipModel: 'CO_DELIVERY',
    sourceFingerprintSha256: executionFingerprint,
    correlationId,
    capturedAt: '2026-08-09T07:59:00.000Z'
  });

  const createProviderAndCapability = async () => {
    const registry = providerService();
    const provider = await registry.createProvider({
      providerWorkspaceId: providerWorkspace,
      displayName: 'Orbit Provider A',
      actorId: operator,
      idempotencyKey: 'provider-create'
    });
    const capability = await registry.createSupplyCapability({
      providerId: provider.providerId,
      jurisdictions: ['US'],
      serviceTypes: ['TRADEMARK_FILING'],
      effectiveFrom: '2026-08-01T00:00:00.000Z',
      effectiveUntil: '2026-12-31T23:59:59.000Z',
      capacityUnits: 10,
      availabilityUnits: 6,
      evidenceReferences: ['supply_evidence_wp05'],
      verificationState: 'VERIFIED_FOR_SUPPLY',
      actorId: operator,
      idempotencyKey: 'supply-create'
    });
    return { registry, provider, capability };
  };

  const createEligibleSource = async () => {
    const { registry, provider, capability } = await createProviderAndCapability();
    const eligibility = eligibilityService();
    const servicePackage = await eligibility.admitServicePackage({
      workspaceId: workspaceA,
      source: source(),
      actorId: operator,
      idempotencyKey: 'package-admit',
      correlationId
    });
    const evaluation = await eligibility.evaluateProviderEligibility({
      workspaceId: workspaceA,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: capability.version,
      expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      actorId: operator,
      idempotencyKey: 'eligibility-evaluate',
      correlationId
    });
    expect(evaluation.outcome).toBe('ELIGIBLE');
    return { registry, provider, capability, servicePackage, evaluation };
  };

  const allocate = async (
    sourceValue: Awaited<ReturnType<typeof createEligibleSource>>,
    key = 'allocation-create',
    value = allocationService()
  ) =>
    value.allocateProvider({
      workspaceId: workspaceA,
      servicePackageId: sourceValue.servicePackage.servicePackageId,
      expectedServicePackageVersion: sourceValue.servicePackage.version,
      expectedServicePackageFingerprintSha256:
        sourceValue.servicePackage.servicePackageFingerprintSha256,
      eligibilityEvaluationId: sourceValue.evaluation.eligibilityEvaluationId,
      expectedEligibilityEvaluationVersion: sourceValue.evaluation.version,
      expectedEligibilityFingerprintSha256: sourceValue.evaluation.deterministicFingerprintSha256,
      providerId: sourceValue.provider.providerId,
      providerSupplyCapabilityId: sourceValue.capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: sourceValue.capability.version,
      rationale: 'Exact eligible provider selected by authorized operations.',
      actorId: operator,
      idempotencyKey: key,
      correlationId
    });

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
         mgsn_allocation_audit,
         mgsn_allocation_commands,
         mgsn_provider_acceptances,
         mgsn_allocations,
         mgsn_service_package_audit,
         mgsn_service_package_commands,
         mgsn_eligibility_evaluations,
         mgsn_service_packages,
         mgsn_provider_registry_audit,
         mgsn_provider_registry_commands,
         mgsn_provider_supply_capabilities,
         mgsn_providers
       CASCADE`
    );
    await pool.query('DROP FUNCTION IF EXISTS reject_mgsn_allocation_audit_mutation() CASCADE');
    await pool.query(
      'DROP FUNCTION IF EXISTS reject_mgsn_service_package_audit_mutation() CASCADE'
    );
    await pool.query(
      'DROP FUNCTION IF EXISTS reject_mgsn_provider_registry_audit_mutation() CASCADE'
    );
    const history = await pool.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await pool.query('DELETE FROM markorbit_persistence.migration_history WHERE namespace=$1', [
        namespace
      ]);
    await migrate(pool, namespace, await migrations());
  });

  beforeEach(async () => {
    providerSequence = 0;
    capabilitySequence = 0;
    packageSequence = 0;
    evaluationSequence = 0;
    allocationSequence = 0;
    acceptanceSequence = 0;
    clock = '2026-08-09T08:00:00.000Z';
    sourceVerification = {
      status: 'CURRENT',
      exactSourceFingerprintSha256: executionFingerprint
    };
    core.clear();
    core.set(providerWorkspace, { workspaceId: providerWorkspace, status: 'ACTIVE' });
    core.set(otherProviderWorkspace, { workspaceId: otherProviderWorkspace, status: 'ACTIVE' });
    await database.getPool().query(
      `TRUNCATE
         mgsn_allocation_audit,
         mgsn_allocation_commands,
         mgsn_provider_acceptances,
         mgsn_allocations,
         mgsn_service_package_audit,
         mgsn_service_package_commands,
         mgsn_eligibility_evaluations,
         mgsn_service_packages,
         mgsn_provider_registry_audit,
         mgsn_provider_registry_commands,
         mgsn_provider_supply_capabilities,
         mgsn_providers
       RESTART IDENTITY CASCADE`
    );
  });

  afterAll(() => database.close());

  it('owns and verifies MGSN migrations 0028 through 0030', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual([
      '0028_mgsn_provider_registry',
      '0029_mgsn_service_package_eligibility',
      '0030_mgsn_allocation_provider_acceptance'
    ]);
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('creates one explicit Allocation only from exact current ELIGIBLE truth and replays identically', async () => {
    const sourceValue = await createEligibleSource();
    const allocation = await allocate(sourceValue);
    expect(allocation).toMatchObject({
      version: 1,
      workspaceId: workspaceA,
      status: 'ACTIVE',
      provider: { providerId: sourceValue.provider.providerId },
      providerVersion: sourceValue.provider.version,
      providerSupplyCapability: {
        id: sourceValue.capability.providerSupplyCapabilityId,
        version: sourceValue.capability.version
      },
      allocatedBy: operator
    });
    expect(allocation.eligibilityFingerprintSha256).toBe(
      sourceValue.evaluation.deterministicFingerprintSha256
    );
    await expect(allocate(sourceValue, 'allocation-create', allocationService())).resolves.toEqual(
      allocation
    );
    expect(allocationAuthorityConsequences).toMatchObject({
      providerAllocated: true,
      providerAccepted: false,
      legalProfessionalAppointmentCreated: false,
      paymentCreated: false,
      invoiceCreated: false,
      filingSubmitted: false,
      officialTruthCreated: false
    });
    expect(providerAcceptanceAuthorityConsequences).toMatchObject({
      providerAllocated: true,
      providerAccepted: true,
      legalProfessionalAppointmentCreated: false,
      paymentCreated: false,
      invoiceCreated: false,
      filingSubmitted: false,
      officialTruthCreated: false
    });
  });

  it('fails closed when Execution source becomes stale after Eligibility Evaluation', async () => {
    const sourceValue = await createEligibleSource();
    sourceVerification = {
      status: 'STALE',
      reason: 'Execution Release changed after Eligibility Evaluation.'
    };
    await expect(allocate(sourceValue, 'allocation-after-source-stale')).rejects.toMatchObject({
      code: 'STALE_SOURCE',
      status: 409
    });
    expect(
      await allocationRepository().findActiveAllocation(sourceValue.servicePackage.servicePackageId)
    ).toBeUndefined();
  });

  it('fails closed when current Provider or Supply truth changed after eligibility', async () => {
    const sourceValue = await createEligibleSource();
    await sourceValue.registry.setProviderOperationalStatus({
      providerId: sourceValue.provider.providerId,
      expectedVersion: sourceValue.provider.version,
      operationalStatus: 'SUSPENDED',
      actorId: operator,
      idempotencyKey: 'provider-suspend'
    });
    await expect(allocate(sourceValue, 'allocation-after-suspend')).rejects.toMatchObject({
      code: 'PROVIDER_SUSPENDED',
      status: 409
    });
  });

  it('serializes concurrent competing Allocation commands so only one becomes active', async () => {
    const sourceValue = await createEligibleSource();
    const results = await Promise.allSettled([
      allocate(sourceValue, 'allocation-race-a', allocationService()),
      allocate(sourceValue, 'allocation-race-b', allocationService())
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'ACTIVE_ALLOCATION_EXISTS'
    });
    const active = await allocationRepository().findActiveAllocation(
      sourceValue.servicePackage.servicePackageId
    );
    expect(active?.status).toBe('ACTIVE');
  });

  it('binds Provider response to authenticated Provider Workspace identity and rejects spoofing', async () => {
    const sourceValue = await createEligibleSource();
    const allocation = await allocate(sourceValue);
    await expect(
      allocationService().respondToAllocation({
        workspaceId: workspaceA,
        allocationId: allocation.allocationId,
        expectedAllocationVersion: allocation.version,
        decision: 'ACCEPTED',
        acknowledgement: 'Accepted by provider.',
        principal: { actorId: 'user_wrong_provider', providerWorkspaceId: otherProviderWorkspace },
        idempotencyKey: 'spoofed-response',
        correlationId
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_IDENTITY_MISMATCH', status: 403 });
  });

  it('records authenticated ACCEPTED response idempotently without creating external authority', async () => {
    const sourceValue = await createEligibleSource();
    const allocation = await allocate(sourceValue);
    const command = {
      workspaceId: workspaceA,
      allocationId: allocation.allocationId,
      expectedAllocationVersion: allocation.version,
      decision: 'ACCEPTED' as const,
      acknowledgement: 'Capacity reserved and assignment accepted.',
      principal: { actorId: providerActor, providerWorkspaceId: providerWorkspace },
      idempotencyKey: 'provider-accept',
      correlationId
    };
    const acceptance = await allocationService().respondToAllocation(command);
    expect(acceptance).toMatchObject({
      version: 1,
      allocation: { id: allocation.allocationId, version: 1 },
      providerId: sourceValue.provider.providerId,
      providerWorkspaceId: providerWorkspace,
      providerActorId: providerActor,
      decision: 'ACCEPTED'
    });
    expect(acceptance.responseFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(allocationService().respondToAllocation(command)).resolves.toEqual(acceptance);
    expect((await allocationRepository().findAllocation(allocation.allocationId))?.status).toBe(
      'ACTIVE'
    );
    await expect(allocate(sourceValue, 'allocation-after-accept')).rejects.toMatchObject({
      code: 'ACTIVE_ALLOCATION_EXISTS'
    });
  });

  it('records DECLINED, preserves the exact historical Allocation version and permits governed reallocation', async () => {
    const sourceValue = await createEligibleSource();
    const first = await allocate(sourceValue);
    const declined = await allocationService().respondToAllocation({
      workspaceId: workspaceA,
      allocationId: first.allocationId,
      expectedAllocationVersion: 1,
      decision: 'DECLINED',
      acknowledgement: 'Unable to take this matter in the requested window.',
      principal: { actorId: providerActor, providerWorkspaceId: providerWorkspace },
      idempotencyKey: 'provider-decline',
      correlationId
    });
    expect(declined.decision).toBe('DECLINED');
    expect(await allocationRepository().findAllocation(first.allocationId, 1)).toEqual(first);
    expect(await allocationRepository().findAllocation(first.allocationId)).toMatchObject({
      version: 2,
      status: 'SUPERSEDED'
    });
    clock = '2026-08-09T08:05:00.000Z';
    const replacement = await allocate(sourceValue, 'allocation-replacement');
    expect(replacement).toMatchObject({ version: 1, status: 'ACTIVE' });
    expect(replacement.allocationId).not.toBe(first.allocationId);
  });

  it('survives repository recreation and keeps Allocation audit append-only', async () => {
    const sourceValue = await createEligibleSource();
    const allocation = await allocate(sourceValue);
    const acceptance = await allocationService().respondToAllocation({
      workspaceId: workspaceA,
      allocationId: allocation.allocationId,
      expectedAllocationVersion: 1,
      decision: 'ACCEPTED',
      acknowledgement: 'Accepted durably.',
      principal: { actorId: providerActor, providerWorkspaceId: providerWorkspace },
      idempotencyKey: 'durable-provider-accept',
      correlationId
    });
    expect(await allocationService().getAllocation(allocation.allocationId)).toEqual(allocation);
    expect(
      await allocationService().getProviderAcceptance(acceptance.providerAcceptanceId)
    ).toEqual(acceptance);

    const audit = await database
      .getPool()
      .query<{ audit_id: string; action: string }>(
        'SELECT audit_id::text,action FROM mgsn_allocation_audit ORDER BY audit_id'
      );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'PROVIDER_ALLOCATED',
      'PROVIDER_ACCEPTED'
    ]);
    await expect(
      database
        .getPool()
        .query('UPDATE mgsn_allocation_audit SET action=$2 WHERE audit_id=$1', [
          audit.rows[0]!.audit_id,
          'PROVIDER_DECLINED'
        ])
    ).rejects.toThrow(/append-only/);
    await expect(
      database
        .getPool()
        .query('DELETE FROM mgsn_allocation_audit WHERE audit_id=$1', [audit.rows[0]!.audit_id])
    ).rejects.toThrow(/append-only/);
  });
});
