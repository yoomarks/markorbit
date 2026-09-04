import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { providerSelectionContractFixtureV1 } from '@markorbit/contracts/provider-selection';
import type { ProviderExecutionSourceSnapshot } from '@markorbit/contracts/provider-execution';
import { ManagedDatabase } from '@markorbit/persistence';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import type {
  ProviderRegistryRecord,
  ProviderSupplyCapabilityRecord
} from '../src/provider-registry.js';
import { PostgresServicePackageEligibilityRepository } from '../src/service-package-eligibility-postgres.js';
import {
  ServicePackageEligibilityService,
  type ExecutionSourceVerification
} from '../src/service-package-eligibility.js';
import { PostgresAllocationProviderAcceptanceRepository } from '../src/allocation-provider-acceptance-postgres.js';
import { AllocationProviderAcceptanceService } from '../src/allocation-provider-acceptance.js';
import { PostgresProviderSelectionRepository } from '../src/provider-selection-postgres.js';
import {
  ProviderSelectionService,
  type ProviderSelectionCurrentAuthoritySnapshot,
  type ProviderSelectionPrincipal
} from '../src/provider-selection.js';
import { PostgresGovernedAllocationRepository } from '../src/governed-allocation-postgres.js';
import {
  GovernedAllocationService,
  type GovernedAllocationCommand
} from '../src/governed-allocation.js';
import { ExactM4GovernedAllocationPlanner } from '../src/governed-allocation-runtime.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_GOVERNED_ALLOCATION_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_GOVERNED_ALLOCATION_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const fixture = providerSelectionContractFixtureV1;
const lineage = fixture.createCommand.sourceLineage;
const providerRef = lineage.provider;
const supplyRef = lineage.providerSupplyCapability;
const operator = fixture.createCommand.trustedHumanAuthority.selectingActorId;
const at = '2026-09-04T14:40:00.000Z';
const executionFingerprint = '8'.repeat(64);
const correlationId = 'correlation_governed_716' as const;

suite('MGSN P0 #716 governed Allocation PostgreSQL durability', () => {
  const namespace = 'mgsn_governed_allocation_716_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 12,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  let allocationSequence = 0;
  let lineageSequence = 0;
  let sourceVerification: ExecutionSourceVerification = {
    status: 'CURRENT',
    exactSourceFingerprintSha256: executionFingerprint
  };

  const providerRepository = () =>
    new PostgresProviderRegistryRepository(database, database.getPool());
  const packageRepository = () =>
    new PostgresServicePackageEligibilityRepository(database, database.getPool());
  const allocationRepository = () =>
    new PostgresAllocationProviderAcceptanceRepository(database, database.getPool());
  const selectionRepository = () =>
    new PostgresProviderSelectionRepository(database, database.getPool());
  const governedRepository = () =>
    new PostgresGovernedAllocationRepository(database, database.getPool());
  const executionSource = {
    verifyCurrentSource: () => Promise.resolve(structuredClone(sourceVerification))
  };
  const selectionSnapshot: ProviderSelectionCurrentAuthoritySnapshot = {
    authorityAvailable: true,
    requesterAuthorityCurrent: true,
    actorAuthorityCurrent: true,
    candidateCurrent: true,
    participationActive: true,
    visibilityAuthorized: true,
    trustedRelationshipRequired: false,
    trustedRelationshipCurrent: true,
    providerOperational: true,
    supplyCurrent: true,
    directExecutorEstablished: true,
    sourceVersionsMatch: true,
    checkedAuthorityReferences: ['authority:governed-allocation-716']
  };
  const selectionService = () =>
    new ProviderSelectionService(
      selectionRepository(),
      { evaluateCurrentAuthority: () => Promise.resolve(structuredClone(selectionSnapshot)) },
      () => at,
      () => fixture.currentSelection.providerSelectionId
    );
  const principal: ProviderSelectionPrincipal = {
    workspaceId: fixture.createCommand.trustedHumanAuthority.requesterWorkspaceId,
    actorId: fixture.createCommand.trustedHumanAuthority.selectingActorId,
    actorKind: 'HUMAN_USER',
    principalReference: fixture.createCommand.trustedHumanAuthority.principalReference,
    workspaceMembershipReference:
      fixture.createCommand.trustedHumanAuthority.workspaceMembershipReference,
    selectionAuthorityReference:
      fixture.createCommand.trustedHumanAuthority.selectionAuthorityReference,
    selectionAuthorityVersion: fixture.createCommand.trustedHumanAuthority.selectionAuthorityVersion,
    authenticatedAt: fixture.createCommand.trustedHumanAuthority.authenticatedAt,
    affirmativeHumanActionEvidenceReference:
      fixture.createCommand.trustedHumanAuthority.affirmativeHumanActionEvidenceReference
  };

  const source = (): ProviderExecutionSourceSnapshot => ({
    schemaVersion: 1,
    workspaceId: fixture.currentSelection.requesterWorkspaceId,
    formalMatter: { id: 'formal-matter_governed-716', version: 1 },
    preparationLock: { id: 'preparation-lock_governed-716', version: 1 },
    filingAuthorization: { id: 'filing-authorization_governed-716', version: 1 },
    executionRelease: { id: 'execution-release_governed-716', version: 1 },
    filingExecutionTaskDraft: { id: 'filing-task-draft_governed-716', version: 1 },
    jurisdiction: 'US',
    serviceType: 'TRADEMARK_FILING',
    serviceScope: ['CLASS_25', 'NEW_APPLICATION'],
    documentReferences: ['document_package_governed-716'],
    instructionReferences: ['instruction_ledger_governed-716'],
    executionWindow: {
      startsAt: '2026-09-05T09:00:00.000Z',
      endsAt: '2026-09-05T17:00:00.000Z'
    },
    channel: 'INTERNAL_OPERATIONS',
    relationshipModel: 'CO_DELIVERY',
    sourceFingerprintSha256: executionFingerprint,
    correlationId,
    capturedAt: '2026-09-04T14:39:00.000Z'
  });

  async function seedProviderSelectionAndEligiblePackage() {
    const provider: ProviderRegistryRecord = {
      schemaVersion: 1,
      providerId: providerRef.providerId,
      providerWorkspaceId: providerRef.providerWorkspaceId,
      displayName: 'Governed Provider 716',
      operationalStatus: 'ACTIVE',
      version: 2,
      createdBy: operator,
      updatedBy: operator,
      createdAt: at,
      updatedAt: at
    };
    const capability: ProviderSupplyCapabilityRecord = {
      schemaVersion: 1,
      providerSupplyCapabilityId: supplyRef.id,
      provider,
      version: supplyRef.version,
      status: 'ACTIVE',
      jurisdictions: ['US'],
      serviceTypes: ['TRADEMARK_FILING'],
      effectivePeriod: {
        effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveUntil: '2026-12-31T23:59:59.000Z'
      },
      capacityUnits: 10,
      availabilityUnits: 6,
      evidenceReferences: ['supply-evidence:governed-716'],
      sourceFingerprintSha256: supplyRef.fingerprintSha256,
      verificationState: 'VERIFIED_FOR_SUPPLY',
      createdBy: operator,
      updatedBy: operator,
      createdAt: at,
      updatedAt: at
    };
    await providerRepository().createProvider(
      provider,
      `provider-workspace:${provider.providerWorkspaceId}`,
      'seed-provider-716',
      '2'.repeat(64)
    );
    await providerRepository().createSupplyCapability(
      capability,
      `supply-capability:${capability.providerSupplyCapabilityId}`,
      'seed-supply-716',
      '4'.repeat(64)
    );

    const visibility = lineage.visibilityAuthorizationAtReview;
    await database.getPool().query(
      `INSERT INTO mgsn_network_participations(
        network_participation_id,version,is_current,workspace_id,provider_id,state,
        authorization_reference,reason,actor_id,correlation_id,occurred_at,created_at
      ) VALUES($1,$2,true,$3,$4,'ACTIVE','authority:governed-716','Governed allocation fixture.',
        $5,$6,$7,$7)`,
      [
        visibility.networkParticipationId,
        visibility.participationVersion,
        provider.providerWorkspaceId,
        provider.providerId,
        operator,
        correlationId,
        at
      ]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_network_visibility_policies(
        network_participation_id,version,participation_version,is_current,scope,grants,
        authorization_reference,reason,actor_id,correlation_id,updated_at,created_at
      ) VALUES($1,$2,$3,true,'PRIVATE','[]'::jsonb,'authority:governed-716',
        'Governed allocation fixture.',$4,$5,$6,$6)`,
      [
        visibility.networkParticipationId,
        visibility.visibilityPolicyVersion,
        visibility.participationVersion,
        operator,
        correlationId,
        at
      ]
    );

    const selected = await selectionService().createOrReplace(
      principal,
      structuredClone(fixture.createCommand)
    );
    const eligibility = new ServicePackageEligibilityService(
      packageRepository(),
      providerRepository(),
      executionSource,
      () => at,
      () => 'service-package_governed-716',
      () => 'eligibility-evaluation_governed-716'
    );
    const servicePackage = await eligibility.admitServicePackage({
      workspaceId: fixture.currentSelection.requesterWorkspaceId,
      source: source(),
      actorId: operator,
      idempotencyKey: 'package-admit-716',
      correlationId
    });
    const evaluation = await eligibility.evaluateProviderEligibility({
      workspaceId: fixture.currentSelection.requesterWorkspaceId,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: capability.version,
      expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      actorId: operator,
      idempotencyKey: 'eligibility-evaluate-716',
      correlationId
    });
    expect(evaluation.outcome).toBe('ELIGIBLE');
    return { provider, capability, selected: selected.selection, servicePackage, evaluation };
  }

  function command(
    seeded: Awaited<ReturnType<typeof seedProviderSelectionAndEligiblePackage>>,
    key = 'governed-allocation-716'
  ): GovernedAllocationCommand {
    return {
      workspaceId: seeded.selected.requesterWorkspaceId,
      actorId: operator,
      servicePackageId: seeded.servicePackage.servicePackageId,
      expectedServicePackageVersion: seeded.servicePackage.version,
      expectedServicePackageFingerprintSha256:
        seeded.servicePackage.servicePackageFingerprintSha256,
      eligibilityEvaluationId: seeded.evaluation.eligibilityEvaluationId,
      expectedEligibilityEvaluationVersion: seeded.evaluation.version,
      expectedEligibilityFingerprintSha256: seeded.evaluation.deterministicFingerprintSha256,
      providerId: seeded.provider.providerId,
      providerSupplyCapabilityId: seeded.capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: seeded.capability.version,
      rationale: 'Explicit current Human Provider Selection reviewed for governed Allocation.',
      idempotencyKey: key,
      correlationId,
      selection: {
        providerSelectionId: seeded.selected.providerSelectionId,
        version: seeded.selected.version,
        scopeVersion: seeded.selected.scopeVersion
      },
      selectionScope: seeded.selected.scope,
      handoffBinding: { mode: 'NONE_EXPLICIT' }
    };
  }

  const directExecutor = {
    assessCurrent: () =>
      Promise.resolve({
        established: true as const,
        providerId: providerRef.providerId,
        providerWorkspaceId: providerRef.providerWorkspaceId,
        authorityReference: 'provider-responsibility:governed-716',
        authorityVersion: 1,
        checkedAt: at,
        validationFingerprintSha256: 'a'.repeat(64)
      })
  };

  function governedService(repository = governedRepository()) {
    const planner = new ExactM4GovernedAllocationPlanner(
      allocationRepository(),
      packageRepository(),
      providerRepository(),
      executionSource,
      () => at,
      () => `allocation_governed-716-${++allocationSequence}`
    );
    return new GovernedAllocationService(
      planner,
      repository,
      selectionRepository(),
      selectionService(),
      { findLatest: vi.fn() } as never,
      { validateCurrent: vi.fn() } as never,
      directExecutor,
      () => at,
      () => `allocation-admission-lineage_governed-716-${++lineageSequence}`
    );
  }

  async function allocationCounts() {
    const result = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM mgsn_allocations) AS allocations,
        (SELECT count(*)::int FROM mgsn_allocation_commands) AS legacy_replays,
        (SELECT count(*)::int FROM mgsn_allocation_audit) AS legacy_audits,
        (SELECT count(*)::int FROM mgsn_allocation_admission_lineages) AS lineages,
        (SELECT count(*)::int FROM mgsn_allocation_admission_lineage_replays) AS governed_replays,
        (SELECT count(*)::int FROM mgsn_allocation_admission_lineage_audit) AS lineage_audits`
    );
    return result.rows[0] as {
      allocations: number;
      legacy_replays: number;
      legacy_audits: number;
      lineages: number;
      governed_replays: number;
      lineage_audits: number;
    };
  }

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMgsnTestDatabase({
      pool: database.getPool(),
      namespace,
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  beforeEach(async () => {
    allocationSequence = 0;
    lineageSequence = 0;
    sourceVerification = {
      status: 'CURRENT',
      exactSourceFingerprintSha256: executionFingerprint
    };
    vi.clearAllMocks();
    await database.getPool().query(
      `TRUNCATE
        mgsn_allocation_admission_lineage_audit,
        mgsn_allocation_admission_lineage_replays,
        mgsn_allocation_admission_lineages,
        mgsn_allocation_audit,
        mgsn_allocation_commands,
        mgsn_provider_acceptances,
        mgsn_allocations,
        mgsn_provider_selection_owner_audit_events,
        mgsn_provider_selection_command_replays,
        mgsn_provider_selection_scope_state,
        mgsn_provider_selection_versions,
        mgsn_provider_selection_identities,
        mgsn_service_package_audit,
        mgsn_service_package_commands,
        mgsn_eligibility_evaluations,
        mgsn_service_packages,
        mgsn_network_participation_audit,
        mgsn_network_participation_commands,
        mgsn_network_visibility_policies,
        mgsn_network_participations,
        mgsn_provider_registry_audit,
        mgsn_provider_registry_commands,
        mgsn_provider_supply_capabilities,
        mgsn_providers
       RESTART IDENTITY CASCADE`
    );
  });

  afterAll(() => database.close());

  it('commits NONE_EXPLICIT Allocation, legacy M4 truth and #712 lineage in one durable transaction', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const result = await governedService().allocate(command(seeded));

    expect(result.lineage).toMatchObject({
      allocationId: result.allocation.allocationId,
      allocationVersion: 1,
      providerSelectionId: seeded.selected.providerSelectionId,
      handoffBindingState: 'NO_CONTROLLED_HANDOFF_BY_DESIGN'
    });
    expect(await allocationCounts()).toEqual({
      allocations: 1,
      legacy_replays: 1,
      legacy_audits: 1,
      lineages: 1,
      governed_replays: 1,
      lineage_audits: 1
    });
    expect(
      await database
        .getPool()
        .query('SELECT count(*)::int AS count FROM mgsn_provider_acceptances')
        .then((value) => value.rows[0]!.count)
    ).toBe(0);
  });

  it('replays the exact committed Allocation and lineage after repository recreation', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const first = await governedService().allocate(command(seeded));
    const replay = await governedService().allocate(command(seeded));

    expect(replay).toEqual(first);
    expect(await allocationCounts()).toEqual({
      allocations: 1,
      legacy_replays: 1,
      legacy_audits: 1,
      lineages: 1,
      governed_replays: 1,
      lineage_audits: 1
    });
  });

  it('rolls back Allocation, both replay ledgers and both audits when a late governed replay write fails', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const failingHost = {
      transact: <T>(work: (client: unknown) => Promise<T>) =>
        database.transact((client) =>
          work({
            query: (text: string, values?: readonly unknown[]) => {
              if (text.includes('INSERT INTO mgsn_allocation_admission_lineage_replays')) {
                return Promise.reject(new Error('injected late governed replay failure'));
              }
              return client.query(text, values);
            }
          })
        )
    };
    const repository = new PostgresGovernedAllocationRepository(
      failingHost as never,
      database.getPool()
    );

    await expect(governedService(repository).allocate(command(seeded))).rejects.toMatchObject({
      code: 'AUTHORITY_UNAVAILABLE',
      status: 503
    });
    expect(await allocationCounts()).toEqual({
      allocations: 0,
      legacy_replays: 0,
      legacy_audits: 0,
      lineages: 0,
      governed_replays: 0,
      lineage_audits: 0
    });
  });

  it('serializes competing governed Allocations for the same Service Package with one active winner', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const results = await Promise.allSettled([
      governedService().allocate(command(seeded, 'governed-allocation-716-left')),
      governedService().allocate(command(seeded, 'governed-allocation-716-right'))
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason)
      .toMatchObject({ code: 'ACTIVE_ALLOCATION_EXISTS' });
    expect(await allocationCounts()).toEqual({
      allocations: 1,
      legacy_replays: 1,
      legacy_audits: 1,
      lineages: 1,
      governed_replays: 1,
      lineage_audits: 1
    });
  });

  it('keeps the legacy M4 allocateProvider path valid without inferring #712 lineage', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const legacy = new AllocationProviderAcceptanceService(
      allocationRepository(),
      packageRepository(),
      providerRepository(),
      executionSource,
      () => at,
      () => 'allocation_legacy-716',
      () => 'provider-acceptance_legacy-716'
    );
    await legacy.allocateProvider({
      workspaceId: seeded.selected.requesterWorkspaceId,
      servicePackageId: seeded.servicePackage.servicePackageId,
      expectedServicePackageVersion: seeded.servicePackage.version,
      expectedServicePackageFingerprintSha256:
        seeded.servicePackage.servicePackageFingerprintSha256,
      eligibilityEvaluationId: seeded.evaluation.eligibilityEvaluationId,
      expectedEligibilityEvaluationVersion: seeded.evaluation.version,
      expectedEligibilityFingerprintSha256: seeded.evaluation.deterministicFingerprintSha256,
      providerId: seeded.provider.providerId,
      providerSupplyCapabilityId: seeded.capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: seeded.capability.version,
      rationale: 'Legacy M4 Allocation remains unchanged.',
      actorId: operator,
      idempotencyKey: 'legacy-allocation-716',
      correlationId
    });

    const lineageCount = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM mgsn_allocation_admission_lineages');
    expect(lineageCount.rows[0]!.count).toBe(0);
  });
});
