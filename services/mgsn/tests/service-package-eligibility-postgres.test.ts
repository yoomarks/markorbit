import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProviderExecutionSourceSnapshot } from '@markorbit/contracts/provider-execution';
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
  MGSN_ELIGIBILITY_POLICY_VERSION,
  ServicePackageEligibilityService,
  servicePackageEligibilityAuthorityConsequences,
  type ExecutionSourceVerification
} from '../src/service-package-eligibility.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_SERVICE_PACKAGE_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_SERVICE_PACKAGE_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceA = '11111111-1111-4111-8111-111111111111';
const actor = 'user_mgsn_operator';
const correlationId = 'correlation_wp04' as const;
const executionFingerprint = 'a'.repeat(64);

suite('M4-WP-04 durable Service Package and deterministic Eligibility', () => {
  const namespace = 'mgsn_service_package_wp04_test';
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
  let clock = '2026-08-09T07:00:00.000Z';
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
      () => `provider_wp04_${++providerSequence}`,
      () => `provider-supply-capability_wp04_${++capabilitySequence}`
    );
  const servicePackageRepository = () =>
    new PostgresServicePackageEligibilityRepository(database, database.getPool());
  const service = () =>
    new ServicePackageEligibilityService(
      servicePackageRepository(),
      providerRepository(),
      {
        verifyCurrentSource: () => Promise.resolve(structuredClone(sourceVerification))
      },
      () => clock,
      () => `service-package_wp04_${++packageSequence}`,
      () => `eligibility-evaluation_wp04_${++evaluationSequence}`
    );

  const source = (): ProviderExecutionSourceSnapshot => ({
    schemaVersion: 1,
    workspaceId: workspaceA,
    formalMatter: { id: 'formal-matter_wp04', version: 1 },
    preparationLock: { id: 'preparation-lock_wp04', version: 1 },
    filingAuthorization: { id: 'filing-authorization_wp04', version: 1 },
    executionRelease: { id: 'execution-release_wp04', version: 1 },
    filingExecutionTaskDraft: { id: 'filing-task-draft_wp04', version: 1 },
    jurisdiction: 'US',
    serviceType: 'TRADEMARK_FILING',
    serviceScope: ['CLASS_25', 'NEW_APPLICATION'],
    documentReferences: ['document_package_wp04'],
    instructionReferences: ['instruction_ledger_wp04'],
    executionWindow: {
      startsAt: '2026-08-10T09:00:00.000Z',
      endsAt: '2026-08-10T17:00:00.000Z'
    },
    channel: 'INTERNAL_OPERATIONS',
    relationshipModel: 'CO_DELIVERY',
    sourceFingerprintSha256: executionFingerprint,
    correlationId,
    capturedAt: '2026-08-09T06:59:00.000Z'
  });

  const createProviderAndCapability = async () => {
    const registry = providerService();
    const provider = await registry.createProvider({
      providerWorkspaceId: workspaceA,
      displayName: 'Orbit Provider A',
      actorId: actor,
      idempotencyKey: 'provider-create'
    });
    const capability = await registry.createSupplyCapability({
      providerId: provider.providerId,
      jurisdictions: ['US', 'TH'],
      serviceTypes: ['TRADEMARK_FILING', 'OFFICE_ACTION'],
      effectiveFrom: '2026-08-01T00:00:00.000Z',
      effectiveUntil: '2026-12-31T23:59:59.000Z',
      capacityUnits: 10,
      availabilityUnits: 6,
      evidenceReferences: ['supply_evidence_wp04'],
      verificationState: 'VERIFIED_FOR_SUPPLY',
      actorId: actor,
      idempotencyKey: 'supply-create'
    });
    return { registry, provider, capability };
  };

  const admit = (value = service(), key = 'package-admit') =>
    value.admitServicePackage({
      workspaceId: workspaceA,
      source: source(),
      actorId: actor,
      idempotencyKey: key,
      correlationId
    });

  const evaluate = async (
    capability: Awaited<ReturnType<typeof createProviderAndCapability>>['capability'],
    value = service(),
    key = 'eligibility-evaluate'
  ) => {
    const servicePackage = await admit(value);
    return value.evaluateProviderEligibility({
      workspaceId: workspaceA,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: capability.version,
      expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      actorId: actor,
      idempotencyKey: key,
      correlationId
    });
  };

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
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
    clock = '2026-08-09T07:00:00.000Z';
    sourceVerification = {
      status: 'CURRENT',
      exactSourceFingerprintSha256: executionFingerprint
    };
    core.clear();
    core.set(workspaceA, { workspaceId: workspaceA, status: 'ACTIVE' });
    await database.getPool().query(
      `TRUNCATE
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

  it('owns and verifies MGSN migrations 0028 and 0029 in one owner database', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual([
      '0028_mgsn_provider_registry',
      '0029_mgsn_service_package_eligibility'
    ]);
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('admits only an exact current governed Execution source and preserves immutable lineage', async () => {
    const servicePackage = await admit();
    expect(servicePackage).toMatchObject({
      workspaceId: workspaceA,
      version: 1,
      status: 'ADMITTED',
      jurisdiction: 'US',
      serviceType: 'TRADEMARK_FILING',
      createdBy: actor,
      updatedBy: actor
    });
    expect(servicePackage.source).toMatchObject({
      preparationLock: { id: 'preparation-lock_wp04', version: 1 },
      filingAuthorization: { id: 'filing-authorization_wp04', version: 1 },
      executionRelease: { id: 'execution-release_wp04', version: 1 },
      filingExecutionTaskDraft: { id: 'filing-task-draft_wp04', version: 1 },
      sourceFingerprintSha256: executionFingerprint
    });
    expect(servicePackage.servicePackageFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(admit(service(), 'package-admit')).resolves.toEqual(servicePackage);
  });

  it('fails closed before admission for stale, missing or fingerprint-mismatched Execution source', async () => {
    sourceVerification = { status: 'STALE', reason: 'Execution Release version changed.' };
    await expect(admit(service(), 'stale-package')).rejects.toMatchObject({
      code: 'STALE_SOURCE',
      status: 409
    });
    sourceVerification = { status: 'MISSING', reason: 'Execution source not found.' };
    await expect(admit(service(), 'missing-package')).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    sourceVerification = {
      status: 'CURRENT',
      exactSourceFingerprintSha256: 'b'.repeat(64)
    };
    await expect(admit(service(), 'fingerprint-package')).rejects.toMatchObject({
      code: 'SOURCE_FINGERPRINT_MISMATCH'
    });
    expect(await servicePackageRepository().findReplay(
      `service-package:${workspaceA}:${executionFingerprint}`,
      'stale-package'
    )).toBeUndefined();
  });

  it('produces explainable deterministic ELIGIBLE truth without allocating a provider', async () => {
    const { capability } = await createProviderAndCapability();
    const evaluation = await evaluate(capability);
    expect(evaluation).toMatchObject({
      version: 1,
      policyVersion: MGSN_ELIGIBILITY_POLICY_VERSION,
      outcome: 'ELIGIBLE',
      providerSupplyCapability: {
        id: capability.providerSupplyCapabilityId,
        version: 1
      },
      providerVersion: 1,
      createdBy: actor
    });
    expect(evaluation.checks.map((item) => [item.code, item.status])).toEqual([
      ['SOURCE_CURRENT', 'PASS'],
      ['PROVIDER_MATCH', 'PASS'],
      ['PROVIDER_ACTIVE', 'PASS'],
      ['SUPPLY_ACTIVE', 'PASS'],
      ['SUPPLY_VERIFIED', 'PASS'],
      ['JURISDICTION_MATCH', 'PASS'],
      ['SERVICE_TYPE_MATCH', 'PASS'],
      ['EFFECTIVE_WINDOW', 'PASS'],
      ['AVAILABILITY', 'PASS']
    ]);
    expect(evaluation.deterministicFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(servicePackageEligibilityAuthorityConsequences).toMatchObject({
      eligibilityEvaluated: true,
      providerAllocated: false,
      providerAccepted: false,
      legalProfessionalAppointmentCreated: false,
      paymentCreated: false,
      filingSubmitted: false,
      formalMatterCompletedAutomatically: false,
      userCapabilityVerifiedAutomatically: false,
      officialTruthCreated: false
    });
  });

  it('records deterministic INELIGIBLE checks for suspended provider state', async () => {
    const { registry, provider, capability } = await createProviderAndCapability();
    await registry.setProviderOperationalStatus({
      providerId: provider.providerId,
      expectedVersion: 1,
      operationalStatus: 'SUSPENDED',
      actorId: actor,
      idempotencyKey: 'provider-suspend'
    });
    const evaluation = await evaluate(capability, service(), 'suspended-evaluation');
    expect(evaluation.outcome).toBe('INELIGIBLE');
    expect(evaluation.providerVersion).toBe(2);
    expect(evaluation.checks.find((item) => item.code === 'PROVIDER_ACTIVE')).toMatchObject({
      status: 'FAIL',
      blocking: true
    });
  });

  it('uses only the current exact Supply Capability version and fails closed on stale lineage', async () => {
    const { registry, capability } = await createProviderAndCapability();
    const revised = await registry.reviseSupplyCapability({
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedVersion: 1,
      status: 'ACTIVE',
      jurisdictions: ['US'],
      serviceTypes: ['TRADEMARK_FILING'],
      effectiveFrom: '2026-08-01T00:00:00.000Z',
      effectiveUntil: '2026-12-31T23:59:59.000Z',
      capacityUnits: 10,
      availabilityUnits: 0,
      evidenceReferences: ['supply_evidence_wp04'],
      verificationState: 'VERIFIED_FOR_SUPPLY',
      actorId: actor,
      idempotencyKey: 'supply-revise-zero'
    });
    const servicePackage = await admit();
    await expect(
      service().evaluateProviderEligibility({
        workspaceId: workspaceA,
        servicePackageId: servicePackage.servicePackageId,
        expectedServicePackageVersion: servicePackage.version,
        expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
        providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
        expectedProviderSupplyCapabilityVersion: capability.version,
        expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
        actorId: actor,
        idempotencyKey: 'stale-capability-evaluation',
        correlationId
      })
    ).rejects.toMatchObject({ code: 'SOURCE_VERSION_MISMATCH', status: 409 });
    const evaluation = await service().evaluateProviderEligibility({
      workspaceId: workspaceA,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerSupplyCapabilityId: revised.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: revised.version,
      expectedProviderSupplyCapabilityFingerprintSha256: revised.sourceFingerprintSha256,
      actorId: actor,
      idempotencyKey: 'current-capability-evaluation',
      correlationId
    });
    expect(evaluation.outcome).toBe('INELIGIBLE');
    expect(evaluation.checks.find((item) => item.code === 'AVAILABILITY')).toMatchObject({
      status: 'FAIL'
    });
  });

  it('rechecks exact Execution source at evaluation and permits identical replay only', async () => {
    const { capability } = await createProviderAndCapability();
    const value = service();
    const servicePackage = await admit(value);
    const command = {
      workspaceId: workspaceA,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: capability.version,
      expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      actorId: actor,
      idempotencyKey: 'durable-evaluation',
      correlationId
    } as const;
    const first = await value.evaluateProviderEligibility(command);
    sourceVerification = { status: 'STALE', reason: 'Execution task changed.' };
    await expect(service().evaluateProviderEligibility(command)).resolves.toEqual(first);
    await expect(
      service().evaluateProviderEligibility({ ...command, idempotencyKey: 'fresh-after-stale' })
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    await expect(
      service().evaluateProviderEligibility({
        ...command,
        expectedProviderSupplyCapabilityFingerprintSha256: 'c'.repeat(64)
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('returns bounded private candidate/evaluation lists without public ranking semantics', async () => {
    const { capability } = await createProviderAndCapability();
    const value = service();
    const servicePackage = await admit(value);
    expect(await value.listCandidateSupplyCapabilities(servicePackage.servicePackageId, 10)).toEqual([
      capability
    ]);
    await value.evaluateProviderEligibility({
      workspaceId: workspaceA,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: 1,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: 1,
      expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      actorId: actor,
      idempotencyKey: 'review-list-evaluation',
      correlationId
    });
    const evaluations = await value.listEligibilityEvaluations(servicePackage.servicePackageId, 10);
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]).not.toHaveProperty('rank');
    expect(evaluations[0]).not.toHaveProperty('score');
  });

  it('keeps Service Package and Eligibility audit append-only', async () => {
    const { capability } = await createProviderAndCapability();
    await evaluate(capability);
    const pool = database.getPool();
    const audit = await pool.query<{ audit_id: string; action: string }>(
      'SELECT audit_id::text,action FROM mgsn_service_package_audit ORDER BY audit_id'
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'SERVICE_PACKAGE_ADMITTED',
      'ELIGIBILITY_ELIGIBLE'
    ]);
    await expect(
      pool.query('UPDATE mgsn_service_package_audit SET action=$2 WHERE audit_id=$1', [
        audit.rows[0]!.audit_id,
        'MUTATED'
      ])
    ).rejects.toThrow(/append-only/);
    await expect(
      pool.query('DELETE FROM mgsn_service_package_audit WHERE audit_id=$1', [
        audit.rows[0]!.audit_id
      ])
    ).rejects.toThrow(/append-only/);
  });
});
