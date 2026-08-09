/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- exact fixture identifiers intentionally exercise contract-branded IDs. */
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  providerReturnAuthorityConsequences,
  type EvidenceHandoffReference,
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
import { PostgresProviderReturnRepository } from '../src/provider-return-postgres.js';
import { ProviderReturnService } from '../src/provider-return.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_PROVIDER_RETURN_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_PROVIDER_RETURN_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '11111111-1111-4111-8111-111111111111';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const otherProviderWorkspaceId = '33333333-3333-4333-8333-333333333333';
const operator = 'user_mgsn_operator';
const providerActor = 'user_provider_actor';
const correlationId = 'correlation_wp06' as const;
const executionFingerprint = 'a'.repeat(64);

suite('M4-WP-06 durable Provider Return and exact evidence handoff', () => {
  const namespace = 'mgsn_provider_return_wp06_test';
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
  let returnSequence = 0;
  let handoffSequence = 0;
  let clock = '2026-08-09T11:00:00.000Z';
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
        getWorkspace: (id) =>
          Promise.resolve(core.get(id) ? structuredClone(core.get(id)) : undefined)
      },
      () => clock,
      () => `provider_wp06_${++providerSequence}`,
      () => `provider-supply-capability_wp06_${++capabilitySequence}`
    );
  const packageRepository = () =>
    new PostgresServicePackageEligibilityRepository(database, database.getPool());
  const eligibilityService = () =>
    new ServicePackageEligibilityService(
      packageRepository(),
      providerRepository(),
      { verifyCurrentSource: () => Promise.resolve(structuredClone(sourceVerification)) },
      () => clock,
      () => `service-package_wp06_${++packageSequence}`,
      () => `eligibility-evaluation_wp06_${++evaluationSequence}`
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
      () => `allocation_wp06_${++allocationSequence}`,
      () => `provider-acceptance_wp06_${++acceptanceSequence}`
    );
  const returnRepository = () => new PostgresProviderReturnRepository(database, database.getPool());
  const evidenceHandoff = {
    handoffProviderReturnEvidence: (input: {
      command: {
        workspaceId: string;
        providerReturnId: `provider-return_${string}`;
        expectedProviderReturnVersion: number;
        expectedProviderReturnFingerprintSha256: string;
        executionReleaseId: `execution-release_${string}`;
        expectedExecutionReleaseVersion: number;
        filingExecutionTaskDraftId: `filing-task-draft_${string}`;
        expectedFilingExecutionTaskDraftVersion: number | string;
        idempotencyKey: string;
        correlationId: typeof correlationId;
      };
      providerReturn: { providerReturnId: `provider-return_${string}`; version: number };
    }): Promise<EvidenceHandoffReference> => {
      handoffSequence += 1;
      return Promise.resolve({
        schemaVersion: 1,
        evidenceHandoffId: `evidence-handoff_wp06_${handoffSequence}`,
        workspaceId: input.command.workspaceId,
        providerReturn: {
          id: input.providerReturn.providerReturnId,
          version: input.providerReturn.version
        },
        providerReturnFingerprintSha256: input.command.expectedProviderReturnFingerprintSha256,
        executionRelease: {
          id: input.command.executionReleaseId,
          version: input.command.expectedExecutionReleaseVersion
        },
        filingExecutionTaskDraft: {
          id: input.command.filingExecutionTaskDraftId,
          version: input.command.expectedFilingExecutionTaskDraftVersion
        },
        correlationId: input.command.correlationId,
        handedOffAt: clock
      });
    }
  };
  const returnService = () =>
    new ProviderReturnService(
      returnRepository(),
      allocationRepository(),
      packageRepository(),
      providerRepository(),
      evidenceHandoff,
      () => clock,
      () => `provider-return_wp06_${++returnSequence}`
    );

  const source = (): ProviderExecutionSourceSnapshot => ({
    schemaVersion: 1,
    workspaceId,
    formalMatter: { id: 'formal-matter_wp06', version: 1 },
    preparationLock: { id: 'preparation-lock_wp06', version: 1 },
    filingAuthorization: { id: 'filing-authorization_wp06', version: 2 },
    executionRelease: { id: 'execution-release_wp06', version: 3 },
    filingExecutionTaskDraft: { id: 'filing-task-draft_wp06', version: 1 },
    jurisdiction: 'US',
    serviceType: 'TRADEMARK_FILING',
    serviceScope: ['CLASS_25', 'NEW_APPLICATION'],
    documentReferences: ['document_package_wp06'],
    instructionReferences: ['instruction_ledger_wp06'],
    executionWindow: {
      startsAt: '2026-08-10T09:00:00.000Z',
      endsAt: '2026-08-10T17:00:00.000Z'
    },
    channel: 'INTERNAL_OPERATIONS',
    relationshipModel: 'CO_DELIVERY',
    sourceFingerprintSha256: executionFingerprint,
    correlationId,
    capturedAt: '2026-08-09T10:59:00.000Z'
  });

  const accepted = async () => {
    const registry = providerService();
    const provider = await registry.createProvider({
      providerWorkspaceId,
      displayName: 'Orbit Provider WP06',
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
      evidenceReferences: ['supply_evidence_wp06'],
      verificationState: 'VERIFIED_FOR_SUPPLY',
      actorId: operator,
      idempotencyKey: 'supply-create'
    });
    const eligibility = eligibilityService();
    const servicePackage = await eligibility.admitServicePackage({
      workspaceId,
      source: source(),
      actorId: operator,
      idempotencyKey: 'package-admit',
      correlationId
    });
    const evaluation = await eligibility.evaluateProviderEligibility({
      workspaceId,
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
    const allocation = await allocationService().allocateProvider({
      workspaceId,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      eligibilityEvaluationId: evaluation.eligibilityEvaluationId,
      expectedEligibilityEvaluationVersion: evaluation.version,
      expectedEligibilityFingerprintSha256: evaluation.deterministicFingerprintSha256,
      providerId: provider.providerId,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: capability.version,
      rationale: 'Exact eligible provider selected for WP06.',
      actorId: operator,
      idempotencyKey: 'allocation-create',
      correlationId
    });
    const acceptance = await allocationService().respondToAllocation({
      workspaceId,
      allocationId: allocation.allocationId,
      expectedAllocationVersion: allocation.version,
      decision: 'ACCEPTED',
      acknowledgement: 'Provider accepts the governed service package.',
      principal: { actorId: providerActor, providerWorkspaceId },
      idempotencyKey: 'acceptance-create',
      correlationId
    });
    return { provider, servicePackage, allocation, acceptance };
  };

  const createReturn = async (
    value: Awaited<ReturnType<typeof accepted>>,
    key = 'return-create',
    supersedes?: { id: `provider-return_${string}`; version: number },
    principalWorkspaceId = providerWorkspaceId
  ) =>
    returnService().createProviderReturn({
      workspaceId,
      allocationId: value.allocation.allocationId,
      expectedAllocationVersion: value.allocation.version,
      providerAcceptanceId: value.acceptance.providerAcceptanceId,
      expectedProviderAcceptanceVersion: value.acceptance.version,
      servicePackageId: value.servicePackage.servicePackageId,
      expectedServicePackageVersion: value.servicePackage.version,
      workStatusClaim: supersedes
        ? 'Corrected provider work-status claim; evidence remains pending review.'
        : 'Provider claims work completed; evidence remains pending review.',
      artifacts: [
        {
          reference: supersedes ? 'artifact://wp06/corrected.pdf' : 'artifact://wp06/return.pdf',
          fileName: supersedes ? 'corrected.pdf' : 'return.pdf',
          mediaType: 'application/pdf',
          sha256: supersedes ? 'c'.repeat(64) : 'b'.repeat(64)
        }
      ],
      assertions: [
        {
          code: 'PROVIDER_CLAIMS_EXTERNAL_ACTION_OCCURRED',
          value: true,
          evidenceReferences: [
            supersedes ? 'artifact://wp06/corrected.pdf' : 'artifact://wp06/return.pdf'
          ]
        }
      ],
      ...(supersedes ? { supersedes } : {}),
      principal: { actorId: providerActor, providerWorkspaceId: principalWorkspaceId },
      idempotencyKey: key,
      correlationId
    });

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
         mgsn_provider_return_audit,
         mgsn_provider_return_commands,
         mgsn_provider_returns,
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
    await pool.query(
      'DROP FUNCTION IF EXISTS reject_mgsn_provider_return_audit_mutation() CASCADE'
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
    returnSequence = 0;
    handoffSequence = 0;
    clock = '2026-08-09T11:00:00.000Z';
    sourceVerification = {
      status: 'CURRENT',
      exactSourceFingerprintSha256: executionFingerprint
    };
    core.clear();
    core.set(providerWorkspaceId, { workspaceId: providerWorkspaceId, status: 'ACTIVE' });
    core.set(otherProviderWorkspaceId, { workspaceId: otherProviderWorkspaceId, status: 'ACTIVE' });
    await database.getPool().query(
      `TRUNCATE
         mgsn_provider_return_audit,
         mgsn_provider_return_commands,
         mgsn_provider_returns,
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

  it('owns and verifies MGSN Provider Return migration', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual(
      expect.arrayContaining([
        '0028_mgsn_provider_registry',
        '0029_mgsn_service_package_eligibility',
        '0030_mgsn_allocation_provider_acceptance',
        '0031_mgsn_provider_return'
      ])
    );
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('creates an authenticated evidence-only return and replays identically', async () => {
    const value = await accepted();
    const created = await createReturn(value);
    const replay = await createReturn(value);
    expect(replay).toEqual(created);
    expect(created).toMatchObject({
      version: 1,
      workspaceId,
      allocation: { id: value.allocation.allocationId, version: 1 },
      providerAcceptance: { id: value.acceptance.providerAcceptanceId, version: 1 },
      providerId: value.provider.providerId,
      providerWorkspaceId,
      providerActorId: providerActor,
      status: 'CURRENT'
    });
    expect(providerReturnAuthorityConsequences.providerReturnCreated).toBe(true);
    expect(providerReturnAuthorityConsequences.executionEvidenceHandedOff).toBe(false);
    expect(providerReturnAuthorityConsequences.paymentCreated).toBe(false);
    expect(providerReturnAuthorityConsequences.filingSubmitted).toBe(false);
    expect(providerReturnAuthorityConsequences.officialApplicationCreated).toBe(false);
  });

  it('retains historical return versions and requires explicit supersession for correction', async () => {
    const value = await accepted();
    const first = await createReturn(value);
    clock = '2026-08-09T11:10:00.000Z';
    const corrected = await createReturn(value, 'return-correct', {
      id: first.providerReturnId,
      version: first.version
    });
    expect(corrected.providerReturnId).toBe(first.providerReturnId);
    expect(corrected.version).toBe(2);
    expect(corrected.supersedes).toEqual({ id: first.providerReturnId, version: 1 });
    expect(await returnRepository().findProviderReturn(first.providerReturnId, 1)).toEqual(first);
    expect(await returnRepository().findProviderReturn(first.providerReturnId)).toEqual(corrected);
    await expect(createReturn(value, 'return-without-supersedes')).rejects.toMatchObject({
      code: 'VERSION_CONFLICT'
    });
  });

  it('rejects provider identity spoofing and stale exact return handoff', async () => {
    const value = await accepted();
    await expect(
      createReturn(value, 'return-spoof', undefined, otherProviderWorkspaceId)
    ).rejects.toMatchObject({ code: 'PROVIDER_IDENTITY_MISMATCH', status: 403 });
    const first = await createReturn(value, 'return-first');
    clock = '2026-08-09T11:10:00.000Z';
    const corrected = await createReturn(value, 'return-correct', {
      id: first.providerReturnId,
      version: first.version
    });
    await expect(
      returnService().handoffProviderReturnEvidence({
        workspaceId,
        providerReturnId: first.providerReturnId,
        expectedProviderReturnVersion: 1,
        expectedProviderReturnFingerprintSha256: first.returnFingerprintSha256,
        executionReleaseId: 'execution-release_wp06',
        expectedExecutionReleaseVersion: 3,
        filingExecutionTaskDraftId: 'filing-task-draft_wp06',
        expectedFilingExecutionTaskDraftVersion: 1,
        idempotencyKey: 'handoff-stale',
        correlationId
      })
    ).rejects.toMatchObject({ code: 'RETURN_SUPERSEDED' });
    const handoff = await returnService().handoffProviderReturnEvidence({
      workspaceId,
      providerReturnId: corrected.providerReturnId,
      expectedProviderReturnVersion: corrected.version,
      expectedProviderReturnFingerprintSha256: corrected.returnFingerprintSha256,
      executionReleaseId: 'execution-release_wp06',
      expectedExecutionReleaseVersion: 3,
      filingExecutionTaskDraftId: 'filing-task-draft_wp06',
      expectedFilingExecutionTaskDraftVersion: 1,
      idempotencyKey: 'handoff-current',
      correlationId
    });
    expect(handoff.providerReturn).toEqual({ id: corrected.providerReturnId, version: 2 });
  });

  it('keeps Provider Return audit append-only', async () => {
    const value = await accepted();
    await createReturn(value, 'return-audit');
    await expect(
      database
        .getPool()
        .query("UPDATE mgsn_provider_return_audit SET action='PROVIDER_RETURN_CREATED'")
    ).rejects.toThrow(/append-only/);
  });
});
