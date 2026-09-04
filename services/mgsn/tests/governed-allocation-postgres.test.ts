import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  controlledHandoffContractFixtureV1,
  type ControlledHandoffEnvelopeV1
} from '@markorbit/contracts/controlled-privacy-handoff';
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
import { PostgresProviderWorkReadRepository } from '../src/provider-work-read-model-postgres.js';
import { ProviderWorkReadModelService } from '../src/provider-work-read-model.js';
import {
  GovernedProviderWorkReadModelService,
  PostgresProviderWorkIncomingAuthorityRepository
} from '../src/provider-work-incoming-authority.js';
import {
  ControlledPrivacyHandoffService,
  type ControlledHandoffCurrentAuthoritySnapshot,
  type ControlledHandoffPrincipal
} from '../src/controlled-privacy-handoff.js';
import { PostgresControlledHandoffRepository } from '../src/controlled-privacy-handoff-postgres.js';
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
const handoffFixture = controlledHandoffContractFixtureV1;
const handoffSnapshot: ControlledHandoffCurrentAuthoritySnapshot = {
  authorityAvailable: true,
  selectionCurrent: true,
  selectionScopeMatch: true,
  sourceVersionsMatch: true,
  sourceAccessCurrent: true,
  participationActive: true,
  visibilityAuthorized: true,
  directExecutorEstablished: true,
  hiddenIntermediaryDetected: false,
  evidenceArtifactAccessAuthorized: false,
  checkedAuthorityReferences: ['authority:governed-handoff-716']
};
const handoffAuthority = handoffFixture.authorizeCommand.trustedHumanAuthority;
const handoffPrincipal: ControlledHandoffPrincipal = {
  workspaceId: handoffAuthority.originatingWorkspaceId,
  actorId: handoffAuthority.authorizingActorId,
  actorKind: 'HUMAN_USER',
  principalReference: handoffAuthority.principalReference,
  workspaceMembershipReference: handoffAuthority.workspaceMembershipReference,
  handoffAuthorityReference: handoffAuthority.handoffAuthorityReference,
  handoffAuthorityVersion: handoffAuthority.handoffAuthorityVersion,
  authenticatedAt: handoffAuthority.authenticatedAt,
  affirmativeHumanActionEvidenceReference: handoffAuthority.affirmativeHumanActionEvidenceReference
};

function legacyStableSerializeForTest(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => legacyStableSerializeForTest(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${legacyStableSerializeForTest(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

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
  const handoffRepository = () =>
    new PostgresControlledHandoffRepository(database, database.getPool());
  const handoffService = () =>
    new ControlledPrivacyHandoffService(
      handoffRepository(),
      { evaluateCurrentAuthority: () => Promise.resolve(structuredClone(handoffSnapshot)) },
      () => at,
      () => 'controlled-handoff_governed-716'
    );

  async function seedExactHandoff() {
    const authorize: Parameters<ControlledPrivacyHandoffService['authorizeOrReplace']>[1] = {
      ...structuredClone(handoffFixture.authorizeCommand),
      validFrom: '2026-09-04T14:00:00.000Z',
      validUntil: '2026-09-05T15:00:00.000Z',
      idempotencyKey: 'controlled-handoff:governed-716',
      commandFingerprintSha256: 'b'.repeat(64),
      correlationId: 'correlation_controlled-handoff_governed-716'
    };
    return handoffService().authorizeOrReplace(handoffPrincipal, authorize);
  }

  const principal: ProviderSelectionPrincipal = {
    workspaceId: fixture.createCommand.trustedHumanAuthority.requesterWorkspaceId,
    actorId: fixture.createCommand.trustedHumanAuthority.selectingActorId,
    actorKind: 'HUMAN_USER',
    principalReference: fixture.createCommand.trustedHumanAuthority.principalReference,
    workspaceMembershipReference:
      fixture.createCommand.trustedHumanAuthority.workspaceMembershipReference,
    selectionAuthorityReference:
      fixture.createCommand.trustedHumanAuthority.selectionAuthorityReference,
    selectionAuthorityVersion:
      fixture.createCommand.trustedHumanAuthority.selectionAuthorityVersion,
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

  function exactCommand(
    seeded: Awaited<ReturnType<typeof seedProviderSelectionAndEligiblePackage>>,
    envelope: ControlledHandoffEnvelopeV1,
    key = 'governed-allocation-exact-handoff-716'
  ): GovernedAllocationCommand {
    return {
      ...command(seeded, key),
      handoffBinding: {
        mode: 'EXACT',
        handoff: {
          controlledHandoffId: envelope.controlledHandoffId,
          version: envelope.version
        },
        envelopeFingerprintSha256: envelope.envelopeFingerprintSha256,
        purposeFingerprintSha256: envelope.purpose.purposeFingerprintSha256,
        projectionFingerprintSha256: envelope.authorizedProjection.projectionFingerprintSha256,
        sourceSetFingerprintSha256: envelope.authorizedProjection.sourceSetFingerprintSha256
      }
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

  function exactGovernedService(repository = governedRepository()) {
    const planner = new ExactM4GovernedAllocationPlanner(
      allocationRepository(),
      packageRepository(),
      providerRepository(),
      executionSource,
      () => at,
      () => `allocation_governed-exact-716-${++allocationSequence}`
    );
    return new GovernedAllocationService(
      planner,
      repository,
      selectionRepository(),
      selectionService(),
      handoffRepository(),
      handoffService(),
      directExecutor,
      () => at,
      () => `allocation-admission-lineage_governed-exact-716-${++lineageSequence}`
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
        mgsn_controlled_handoff_owner_audit_events,
        mgsn_controlled_handoff_command_replays,
        mgsn_controlled_handoff_slot_state,
        mgsn_controlled_handoff_versions,
        mgsn_controlled_handoff_identities,
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
    const governedCommand = command(seeded);
    const result = await governedService().allocate(governedCommand);

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
        .then((value) => Number((value.rows[0] as { count: number }).count))
    ).toBe(0);

    const legacyReplay = await database
      .getPool()
      .query('SELECT request_fingerprint FROM mgsn_allocation_commands WHERE target_id=$1', [
        result.allocation.allocationId
      ]);
    const legacyFingerprint = String(
      (legacyReplay.rows[0] as { request_fingerprint: string }).request_fingerprint
    );
    const expectedLegacyFingerprint = createHash('sha256')
      .update(
        legacyStableSerializeForTest({
          command: 'ALLOCATE_PROVIDER',
          workspaceId: governedCommand.workspaceId.toLowerCase(),
          servicePackageId: governedCommand.servicePackageId,
          expectedServicePackageVersion: governedCommand.expectedServicePackageVersion,
          expectedPackageFingerprint: governedCommand.expectedServicePackageFingerprintSha256,
          eligibilityEvaluationId: governedCommand.eligibilityEvaluationId,
          expectedEligibilityEvaluationVersion:
            governedCommand.expectedEligibilityEvaluationVersion,
          expectedEligibilityFingerprint: governedCommand.expectedEligibilityFingerprintSha256,
          providerId: governedCommand.providerId,
          providerSupplyCapabilityId: governedCommand.providerSupplyCapabilityId,
          expectedProviderSupplyCapabilityVersion:
            governedCommand.expectedProviderSupplyCapabilityVersion,
          rationale: governedCommand.rationale,
          actorId: governedCommand.actorId,
          correlationId: governedCommand.correlationId
        })
      )
      .digest('hex');
    expect(legacyFingerprint).toBe(expectedLegacyFingerprint);
    expect(legacyFingerprint).not.toBe(result.requestFingerprintSha256);

    const providerWork = new GovernedProviderWorkReadModelService(
      new ProviderWorkReadModelService(
        new PostgresProviderWorkReadRepository(database.getPool()),
        providerRepository(),
        () => at
      ),
      new PostgresProviderWorkIncomingAuthorityRepository(database.getPool()),
      { validateCurrent: vi.fn() } as never
    );
    const currentRead = await providerWork.read(
      {
        workspaceId: seeded.provider.providerWorkspaceId,
        userId: 'provider-user_governed-716',
        membershipId: 'provider-membership_governed-716'
      },
      result.allocation.allocationId
    );
    expect(currentRead.decision).toBe('AUTHORIZED');
    if (currentRead.decision !== 'AUTHORIZED') throw new Error('Provider Work must be readable.');
    expect(currentRead.item.incomingDataAuthority).toMatchObject({
      state: 'KNOWN_ABSENT',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    });
  });

  it('replays the exact committed Allocation and lineage after repository recreation', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const governedCommand = command(seeded);
    const first = await governedService().allocate(governedCommand);
    const replay = await governedService().allocate(governedCommand);

    expect(replay).toEqual(first);

    const changedSelectionLineage = structuredClone(governedCommand);
    changedSelectionLineage.selection = {
      ...changedSelectionLineage.selection,
      version: changedSelectionLineage.selection.version + 1
    };
    await expect(governedService().allocate(changedSelectionLineage)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409
    });
    expect(await allocationCounts()).toEqual({
      allocations: 1,
      legacy_replays: 1,
      legacy_audits: 1,
      lineages: 1,
      governed_replays: 1,
      lineage_audits: 1
    });
  });

  it('deterministically replays one commit for concurrent copies of the same governed command', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const governedCommand = command(seeded);
    const [left, right] = await Promise.all([
      governedService().allocate(governedCommand),
      governedService().allocate(governedCommand)
    ]);

    expect(right).toEqual(left);
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
              return values ? client.query(text, [...values]) : client.query(text);
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
    expect(
      (results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason
    ).toMatchObject({ code: 'ACTIVE_ALLOCATION_EXISTS' });
    expect(await allocationCounts()).toEqual({
      allocations: 1,
      legacy_replays: 1,
      legacy_audits: 1,
      lineages: 1,
      governed_replays: 1,
      lineage_audits: 1
    });
  });

  it('persists, replays and freshly revalidates exact Handoff authority without projecting private values', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const authorizedHandoff = await seedExactHandoff();
    const exact = exactCommand(seeded, authorizedHandoff.envelope);

    const first = await exactGovernedService().allocate(exact);
    expect(first.lineage.handoffBindingState).toBe('EXACT_CONTROLLED_HANDOFF');
    expect(first.lineage.handoff).toMatchObject({
      envelope: {
        controlledHandoffId: authorizedHandoff.envelope.controlledHandoffId,
        version: authorizedHandoff.envelope.version
      },
      validation: {
        purpose: 'HANDOFF_CONSUMPTION',
        decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
        currentlyUsable: true,
        currentExactDisclosurePermitted: true,
        publicReason: 'Historical admission validation was positive at governed Allocation commit.'
      }
    });

    const replay = await exactGovernedService().allocate(exact);
    expect(replay).toEqual(first);

    const changedLineage = structuredClone(exact);
    if (changedLineage.handoffBinding.mode !== 'EXACT')
      throw new Error('Exact Handoff fixture required.');
    changedLineage.handoffBinding = {
      ...changedLineage.handoffBinding,
      sourceSetFingerprintSha256: '0'.repeat(64)
    };
    await expect(exactGovernedService().allocate(changedLineage)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409
    });

    const providerWork = new GovernedProviderWorkReadModelService(
      new ProviderWorkReadModelService(
        new PostgresProviderWorkReadRepository(database.getPool()),
        providerRepository(),
        () => at
      ),
      new PostgresProviderWorkIncomingAuthorityRepository(database.getPool()),
      handoffService()
    );
    const principal = {
      workspaceId: seeded.provider.providerWorkspaceId,
      userId: 'provider-user_exact-716',
      membershipId: 'provider-membership_exact-716'
    };
    const currentRead = await providerWork.read(principal, first.allocation.allocationId);
    expect(currentRead.decision).toBe('AUTHORIZED');
    if (currentRead.decision !== 'AUTHORIZED')
      throw new Error('Exact Provider Work must be readable.');
    expect(currentRead.item.incomingDataAuthority).toMatchObject({
      state: 'CURRENTLY_USABLE',
      handoff: {
        controlledHandoffId: authorizedHandoff.envelope.controlledHandoffId,
        version: authorizedHandoff.envelope.version
      },
      currentExactProjectionMayBeResolvedSeparately: true,
      embeddedPrivateFieldValues: false
    });
    expect('incomingFieldsVisible' in currentRead.item.incomingDataAuthority).toBe(false);

    const revoke: Parameters<ControlledPrivacyHandoffService['revoke']>[1] = {
      ...structuredClone(handoffFixture.revokeCommand),
      target: {
        controlledHandoffId: authorizedHandoff.envelope.controlledHandoffId,
        version: authorizedHandoff.envelope.version
      },
      idempotencyKey: 'controlled-handoff:governed-716:revoke',
      commandFingerprintSha256: 'e'.repeat(64),
      correlationId: 'correlation_controlled-handoff_governed-716-revoke'
    };
    await handoffService().revoke(handoffPrincipal, revoke);

    const deniedRead = await providerWork.read(principal, first.allocation.allocationId);
    expect(deniedRead.decision).toBe('AUTHORIZED');
    if (deniedRead.decision !== 'AUTHORIZED')
      throw new Error('Denied Provider Work must remain readable.');
    expect(deniedRead.item.incomingDataAuthority).toMatchObject({
      state: 'DENIED',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
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
    expect(Number((lineageCount.rows[0] as { count: number }).count)).toBe(0);

    const providerWork = new GovernedProviderWorkReadModelService(
      new ProviderWorkReadModelService(
        new PostgresProviderWorkReadRepository(database.getPool()),
        providerRepository(),
        () => at
      ),
      new PostgresProviderWorkIncomingAuthorityRepository(database.getPool()),
      { validateCurrent: vi.fn() } as never
    );
    const legacyRead = await providerWork.read(
      {
        workspaceId: seeded.provider.providerWorkspaceId,
        userId: 'provider-user_legacy-716',
        membershipId: 'provider-membership_legacy-716'
      },
      'allocation_legacy-716'
    );
    expect(legacyRead.decision).toBe('AUTHORIZED');
    if (legacyRead.decision !== 'AUTHORIZED')
      throw new Error('Legacy Provider Work must be readable.');
    expect(legacyRead.item.incomingDataAuthority).toMatchObject({
      state: 'UNKNOWN',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    });
  });
});
