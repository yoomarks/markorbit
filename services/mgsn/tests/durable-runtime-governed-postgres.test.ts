import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ProviderResponsibilityEvidenceReferenceV1 } from '@markorbit/contracts/provider-responsibility';
import { providerSelectionContractFixtureV1 } from '@markorbit/contracts/provider-selection';
import type { ProviderExecutionSourceSnapshot } from '@markorbit/contracts/provider-execution';
import { ManagedDatabase } from '@markorbit/persistence';
import { createDurableMgsnServices } from '../src/durable-runtime.js';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import type {
  ProviderRegistryRecord,
  ProviderSupplyCapabilityRecord
} from '../src/provider-registry.js';
import type {
  ProviderSelectionCurrentAuthoritySnapshot,
  ProviderSelectionPrincipal
} from '../src/provider-selection.js';
import type { GovernedAllocationCommand } from '../src/governed-allocation.js';
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
const executionFingerprint = '8'.repeat(64);
const correlationId = 'correlation_epic_358_runtime_e2e' as const;
const at = '2026-09-05T01:00:00.000Z';

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
  checkedAuthorityReferences: ['authority:epic-358-runtime-e2e']
};

const selectionPrincipal: ProviderSelectionPrincipal = {
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

function executionSource(): ProviderExecutionSourceSnapshot {
  return {
    schemaVersion: 1,
    workspaceId: fixture.currentSelection.requesterWorkspaceId,
    formalMatter: { id: 'formal-matter_epic-358-runtime-e2e', version: 1 },
    preparationLock: { id: 'preparation-lock_epic-358-runtime-e2e', version: 1 },
    filingAuthorization: { id: 'filing-authorization_epic-358-runtime-e2e', version: 1 },
    executionRelease: { id: 'execution-release_epic-358-runtime-e2e', version: 1 },
    filingExecutionTaskDraft: { id: 'filing-task-draft_epic-358-runtime-e2e', version: 1 },
    jurisdiction: 'US',
    serviceType: 'TRADEMARK_FILING',
    serviceScope: ['CLASS_25', 'NEW_APPLICATION'],
    documentReferences: ['document_package_epic-358-runtime-e2e'],
    instructionReferences: ['instruction_ledger_epic-358-runtime-e2e'],
    executionWindow: {
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-12-31T23:59:59.000Z'
    },
    channel: 'INTERNAL_OPERATIONS',
    relationshipModel: 'CO_DELIVERY',
    sourceFingerprintSha256: executionFingerprint,
    correlationId,
    capturedAt: at
  };
}

function providerEvidence(): ProviderResponsibilityEvidenceReferenceV1 {
  return {
    evidenceReference: 'provider-attestation:epic-358-runtime-e2e',
    sourceOwner: 'MGSN',
    sourceType: 'PROVIDER_RESPONSIBILITY_ATTESTATION',
    sourceId: 'attestation_epic-358-runtime-e2e',
    sourceVersion: 1,
    sourceFingerprintSha256: '1'.repeat(64),
    authorityClass: 'PROVIDER_ATTESTATION',
    verificationState: 'CLAIM_ONLY',
    observedAt: '2026-09-04T14:20:00.000Z',
    artifactAccessAuthorized: false
  };
}

function verifiedEvidence(): ProviderResponsibilityEvidenceReferenceV1 {
  return {
    evidenceReference: 'mgsn-verification:epic-358-runtime-e2e',
    sourceOwner: 'MGSN',
    sourceType: 'DIRECT_EXECUTOR_VERIFICATION',
    sourceId: 'verification_epic-358-runtime-e2e',
    sourceVersion: 1,
    sourceFingerprintSha256: '2'.repeat(64),
    authorityClass: 'MGSN_VERIFIED_REFERENCE',
    verificationState: 'INDEPENDENTLY_VERIFIED',
    observedAt: '2026-09-04T14:30:00.000Z',
    artifactAccessAuthorized: false
  };
}

suite('MGSN Epic #358 governed durable runtime PostgreSQL composition', () => {
  const namespace = 'mgsn_epic_358_governed_runtime_test';
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

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMgsnTestDatabase({
      pool: database.getPool(),
      namespace,
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => database.close());

  it('uses the production durable composition for exact Direct Executor -> governed Allocation -> Provider Work', async () => {
    const providerRepository = new PostgresProviderRegistryRepository(database, database.getPool());
    const provider: ProviderRegistryRecord = {
      schemaVersion: 1,
      providerId: providerRef.providerId,
      providerWorkspaceId: providerRef.providerWorkspaceId,
      displayName: 'Epic 358 Runtime Provider',
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
      evidenceReferences: ['supply-evidence:epic-358-runtime-e2e'],
      sourceFingerprintSha256: supplyRef.fingerprintSha256,
      verificationState: 'VERIFIED_FOR_SUPPLY',
      createdBy: operator,
      updatedBy: operator,
      createdAt: at,
      updatedAt: at
    };
    await providerRepository.createProvider(
      provider,
      `provider-workspace:${provider.providerWorkspaceId}`,
      'seed-provider-epic-358-runtime-e2e',
      '3'.repeat(64)
    );
    await providerRepository.createSupplyCapability(
      capability,
      `supply-capability:${capability.providerSupplyCapabilityId}`,
      'seed-supply-epic-358-runtime-e2e',
      '4'.repeat(64)
    );

    const visibility = lineage.visibilityAuthorizationAtReview;
    await database.getPool().query(
      `INSERT INTO mgsn_network_participations(
        network_participation_id,version,is_current,workspace_id,provider_id,state,
        authorization_reference,reason,actor_id,correlation_id,occurred_at,created_at
      ) VALUES($1,$2,true,$3,$4,'ACTIVE','authority:epic-358-runtime-e2e',
        'Epic 358 governed runtime fixture.',$5,$6,$7,$7)`,
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
      ) VALUES($1,$2,$3,true,'PRIVATE','[]'::jsonb,'authority:epic-358-runtime-e2e',
        'Epic 358 governed runtime fixture.',$4,$5,$6,$6)`,
      [
        visibility.networkParticipationId,
        visibility.visibilityPolicyVersion,
        visibility.participationVersion,
        operator,
        correlationId,
        at
      ]
    );

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const target = typeof input === 'string' ? input : input.toString();
      if (target.endsWith('/internal/provider-execution-source/verify')) {
        return new Response(
          JSON.stringify({
            status: 'CURRENT',
            exactSourceFingerprintSha256: executionFingerprint
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected external dependency call: ${target}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const runtime = createDurableMgsnServices({
      database,
      coreUrl: 'http://core.invalid',
      executionUrl: 'http://execution.test',
      internalServiceSecret: 'test-secret',
      providerSelectionCurrentAuthoritySource: {
        evaluateCurrentAuthority: () => Promise.resolve(structuredClone(selectionSnapshot))
      }
    });

    const responsibility = await runtime.providerResponsibility.createProfile(
      { workspaceId: provider.providerWorkspaceId, actorId: 'provider-user_epic-358' },
      {
        schemaVersion: 1,
        providerId: provider.providerId,
        finalExecutorStatus: 'PROVIDER_IS_FINAL_EXECUTOR',
        directResponsibilityStatus: 'ATTESTED',
        noRebrokeringCommitmentState: 'COMMITTED',
        intermediaryDisclosureState: 'NO_INTERMEDIARY_DISCLOSED',
        executionTeamReferences: [],
        legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false },
        evidenceReferences: [providerEvidence()],
        effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveUntil: '2026-12-31T23:59:59.000Z',
        idempotencyKey: 'responsibility-create-epic-358-runtime-e2e',
        correlationId
      }
    );
    const verified = await runtime.providerResponsibility.recordVerification(
      {
        actorId: 'mgsn-verifier_epic-358',
        verifierAuthorityReference: 'mgsn-authority:epic-358-runtime-e2e',
        authority: 'MGSN_INTERNAL_RESPONSIBILITY_VERIFIER'
      },
      {
        schemaVersion: 1,
        providerId: provider.providerId,
        providerWorkspaceId: provider.providerWorkspaceId,
        providerResponsibilityProfileId: responsibility.providerResponsibilityProfileId,
        expectedProfileVersion: responsibility.version,
        directResponsibilityStatus: 'VERIFIED',
        authorityState: 'CURRENT',
        evidenceReferences: [verifiedEvidence()],
        idempotencyKey: 'responsibility-verify-epic-358-runtime-e2e',
        correlationId
      }
    );
    expect(verified.directResponsibilityStatus).toBe('VERIFIED');
    await expect(
      runtime.providerResponsibility.assessCurrent(
        provider.providerId,
        provider.providerWorkspaceId,
        at
      )
    ).resolves.toMatchObject({
      state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
      assessment: { directExecutorEstablished: true }
    });

    const selected = await runtime.providerSelection.createOrReplace(
      selectionPrincipal,
      structuredClone(fixture.createCommand)
    );
    const servicePackage = await runtime.servicePackageEligibility.admitServicePackage({
      workspaceId: selected.selection.requesterWorkspaceId,
      source: executionSource(),
      actorId: operator,
      idempotencyKey: 'package-admit-epic-358-runtime-e2e',
      correlationId
    });
    const evaluation = await runtime.servicePackageEligibility.evaluateProviderEligibility({
      workspaceId: selected.selection.requesterWorkspaceId,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: capability.version,
      expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      actorId: operator,
      idempotencyKey: 'eligibility-evaluate-epic-358-runtime-e2e',
      correlationId
    });
    expect(evaluation.outcome).toBe('ELIGIBLE');

    const command: GovernedAllocationCommand = {
      workspaceId: selected.selection.requesterWorkspaceId,
      actorId: operator,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      eligibilityEvaluationId: evaluation.eligibilityEvaluationId,
      expectedEligibilityEvaluationVersion: evaluation.version,
      expectedEligibilityFingerprintSha256: evaluation.deterministicFingerprintSha256,
      providerId: provider.providerId,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: capability.version,
      rationale: 'Exact human Selection admitted through the production durable runtime.',
      idempotencyKey: 'governed-allocation-epic-358-runtime-e2e',
      correlationId,
      selection: {
        providerSelectionId: selected.selection.providerSelectionId,
        version: selected.selection.version,
        scopeVersion: selected.selection.scopeVersion
      },
      selectionScope: selected.selection.scope,
      handoffBinding: { mode: 'NONE_EXPLICIT' }
    };
    const allocated = await runtime.governedAllocation.allocate(command);
    expect(allocated.lineage).toMatchObject({
      allocationId: allocated.allocation.allocationId,
      providerSelectionId: selected.selection.providerSelectionId,
      providerId: provider.providerId,
      handoffBindingState: 'NO_CONTROLLED_HANDOFF_BY_DESIGN'
    });

    const providerWork = await runtime.providerWorkRead.read(
      {
        workspaceId: provider.providerWorkspaceId,
        userId: 'provider-user_epic-358',
        membershipId: 'provider-membership_epic-358'
      },
      allocated.allocation.allocationId
    );
    expect(providerWork.decision).toBe('AUTHORIZED');
    if (providerWork.decision !== 'AUTHORIZED') throw new Error('Provider Work must be readable.');
    expect(providerWork.item.incomingDataAuthority).toMatchObject({
      state: 'KNOWN_ABSENT',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    });
    expect(JSON.stringify(providerWork)).not.toContain('provider-attestation:epic-358-runtime-e2e');
    expect(fetchMock).toHaveBeenCalled();
  });
});
