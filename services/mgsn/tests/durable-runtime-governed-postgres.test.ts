import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ProviderDiscoveryRequestReferenceV1 } from '@markorbit/contracts/provider-discovery';
import type { ProviderExecutionSourceSnapshot } from '@markorbit/contracts/provider-execution';
import type { ProviderResponsibilityEvidenceReferenceV1 } from '@markorbit/contracts/provider-responsibility';
import type {
  CreateOrReplaceProviderSelectionCommandV1,
  ProviderSelectionSourceLineageV1,
  ProviderSelectionTrustedHumanAuthorityV1
} from '@markorbit/contracts/provider-selection';
import { ManagedDatabase } from '@markorbit/persistence';
import { createDurableMgsnServices } from '../src/durable-runtime.js';
import type { GovernedAllocationCommand } from '../src/governed-allocation.js';
import { PostgresProviderRegistryRepository } from '../src/provider-registry-postgres.js';
import type {
  ProviderRegistryRecord,
  ProviderSupplyCapabilityRecord
} from '../src/provider-registry.js';
import type { ProviderSelectionPrincipal } from '../src/provider-selection.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_GOVERNED_ALLOCATION_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_GOVERNED_ALLOCATION_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const requesterWorkspaceId = '018f0000-0000-7000-8000-000000000381';
const requesterUserId = '018f0000-0000-7000-8000-000000000394';
const requesterMembershipId = '018f0000-0000-7000-8000-000000000395';
const providerWorkspaceId = '018f0000-0000-7000-8000-000000003810';
const providerId = 'provider_epic-358-runtime-e2e' as const;
const supplyId = 'provider-supply-capability_epic-358-runtime-e2e' as const;
const participationId = 'network-participation_epic-358-runtime-e2e';
const at = '2026-09-05T01:00:00.000Z';
const executionFingerprint = '8'.repeat(64);
const scopeFingerprint = '1'.repeat(64);
const supplyFingerprint = '4'.repeat(64);
const correlationId = 'correlation_epic_358_runtime_e2e' as const;

const selectionAuthority = Object.freeze({
  source: 'CORE_WORKSPACE_PRINCIPAL',
  requesterWorkspaceId,
  selectingActorId: requesterUserId,
  principalReference: 'principal:epic-358-runtime-e2e',
  workspaceMembershipReference: requesterMembershipId,
  selectionAuthorityReference: 'selection-authority:epic-358-runtime-e2e',
  selectionAuthorityVersion: 1,
  authenticatedAt: at,
  affirmativeHumanActionEvidenceReference: 'human-action:epic-358-runtime-e2e',
  payloadIdentityAuthoritative: false
}) satisfies Readonly<ProviderSelectionTrustedHumanAuthorityV1>;

const selectionPrincipal: ProviderSelectionPrincipal = {
  workspaceId: requesterWorkspaceId,
  actorId: requesterUserId,
  actorKind: 'HUMAN_USER',
  principalReference: selectionAuthority.principalReference,
  workspaceMembershipReference: selectionAuthority.workspaceMembershipReference,
  selectionAuthorityReference: selectionAuthority.selectionAuthorityReference,
  selectionAuthorityVersion: selectionAuthority.selectionAuthorityVersion,
  authenticatedAt: selectionAuthority.authenticatedAt,
  affirmativeHumanActionEvidenceReference:
    selectionAuthority.affirmativeHumanActionEvidenceReference
};

function executionSource(): ProviderExecutionSourceSnapshot {
  return {
    schemaVersion: 1,
    workspaceId: requesterWorkspaceId,
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

function discoveryRequest(): ProviderDiscoveryRequestReferenceV1 {
  return {
    schemaVersion: 1,
    providerDiscoveryRequestId: 'provider-discovery-request_epic-358-runtime-e2e',
    requesterWorkspaceId,
    need: {
      reference: 'need:epic-358-runtime-e2e',
      version: 1,
      fingerprintSha256: scopeFingerprint,
      jurisdiction: 'US',
      serviceType: 'TRADEMARK_FILING'
    },
    purpose: 'PROVIDER_DISCOVERY',
    audience: { kind: 'BOUNDED_NETWORK' },
    contextReference: 'context:epic-358-runtime-e2e',
    requestedDataClasses: [
      'PROVIDER_REFERENCE',
      'SUPPLY_PROFILE',
      'SERVICE_JURISDICTIONS',
      'PROVIDER_EVIDENCE_REFERENCE'
    ],
    requestedFields: [
      'providerId',
      'displayName',
      'serviceTypes',
      'jurisdictions',
      'evidenceReferences'
    ],
    requestedAt: at,
    requestFingerprintSha256: '5'.repeat(64),
    correlationId: 'correlation_discovery_epic_358_runtime_e2e'
  };
}

function providerEvidence(): ProviderResponsibilityEvidenceReferenceV1 {
  return {
    evidenceReference: 'provider-attestation:epic-358-runtime-e2e',
    sourceOwner: 'MGSN',
    sourceType: 'PROVIDER_RESPONSIBILITY_ATTESTATION',
    sourceId: 'attestation_epic-358-runtime-e2e',
    sourceVersion: 1,
    sourceFingerprintSha256: '2'.repeat(64),
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
    sourceFingerprintSha256: '3'.repeat(64),
    authorityClass: 'MGSN_VERIFIED_REFERENCE',
    verificationState: 'INDEPENDENTLY_VERIFIED',
    observedAt: '2026-09-04T14:30:00.000Z',
    artifactAccessAuthorized: false
  };
}

function visibilityGrants() {
  return [
    {
      dataClass: 'PROVIDER_REFERENCE',
      fields: ['providerId', 'displayName'],
      scope: 'BOUNDED_PUBLIC',
      audience: { kind: 'BOUNDED_NETWORK' },
      purpose: 'PROVIDER_DISCOVERY',
      authorityReferences: ['authority:provider-reference:epic-358']
    },
    {
      dataClass: 'SUPPLY_PROFILE',
      fields: ['serviceTypes'],
      scope: 'BOUNDED_PUBLIC',
      audience: { kind: 'BOUNDED_NETWORK' },
      purpose: 'PROVIDER_DISCOVERY',
      authorityReferences: ['authority:supply-profile:epic-358']
    },
    {
      dataClass: 'SERVICE_JURISDICTIONS',
      fields: ['jurisdictions'],
      scope: 'BOUNDED_PUBLIC',
      audience: { kind: 'BOUNDED_NETWORK' },
      purpose: 'PROVIDER_DISCOVERY',
      authorityReferences: ['authority:jurisdictions:epic-358']
    },
    {
      dataClass: 'PROVIDER_EVIDENCE_REFERENCE',
      fields: ['evidenceReferences'],
      scope: 'BOUNDED_PUBLIC',
      audience: { kind: 'BOUNDED_NETWORK' },
      purpose: 'PROVIDER_DISCOVERY',
      authorityReferences: ['authority:evidence-reference:epic-358']
    }
  ];
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

  it('runs current Discovery -> explicit Human Selection -> governed Allocation -> durable Provider Work', async () => {
    const providerRepository = new PostgresProviderRegistryRepository(database, database.getPool());
    const provider: ProviderRegistryRecord = {
      schemaVersion: 1,
      providerId,
      providerWorkspaceId,
      displayName: 'Epic 358 Runtime Provider',
      operationalStatus: 'ACTIVE',
      version: 1,
      createdBy: requesterUserId,
      updatedBy: requesterUserId,
      createdAt: at,
      updatedAt: at
    };
    const capability: ProviderSupplyCapabilityRecord = {
      schemaVersion: 1,
      providerSupplyCapabilityId: supplyId,
      provider,
      version: 1,
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
      sourceFingerprintSha256: supplyFingerprint,
      verificationState: 'VERIFIED_FOR_SUPPLY',
      createdBy: requesterUserId,
      updatedBy: requesterUserId,
      createdAt: at,
      updatedAt: at
    };
    await providerRepository.createProvider(
      provider,
      `provider-workspace:${provider.providerWorkspaceId}`,
      'seed-provider-epic-358-runtime-e2e',
      '6'.repeat(64)
    );
    await providerRepository.createSupplyCapability(
      capability,
      `supply-capability:${capability.providerSupplyCapabilityId}`,
      'seed-supply-epic-358-runtime-e2e',
      '7'.repeat(64)
    );

    await database.getPool().query(
      `INSERT INTO mgsn_network_participations(
        network_participation_id,version,is_current,workspace_id,provider_id,state,
        authorization_reference,reason,actor_id,correlation_id,occurred_at,created_at
      ) VALUES($1,1,true,$2,$3,'ACTIVE','authority:epic-358-runtime-e2e',
        'Epic 358 governed runtime fixture.',$4,$5,$6,$6)`,
      [participationId, providerWorkspaceId, providerId, requesterUserId, correlationId, at]
    );
    await database.getPool().query(
      `INSERT INTO mgsn_network_visibility_policies(
        network_participation_id,version,participation_version,is_current,scope,grants,
        authorization_reference,reason,actor_id,correlation_id,updated_at,created_at
      ) VALUES($1,1,1,true,'BOUNDED_PUBLIC',$2::jsonb,'authority:epic-358-runtime-e2e',
        'Epic 358 governed runtime fixture.',$3,$4,$5,$5)`,
      [participationId, JSON.stringify(visibilityGrants()), requesterUserId, correlationId, at]
    );

    const fetchMock = vi.fn((input: string | URL | Request) => {
      const target =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (target.endsWith('/internal/provider-execution-source/verify')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'CURRENT',
              exactSourceFingerprintSha256: executionFingerprint
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }
      if (target.endsWith('/internal/auth/workspace-authority/validate-current')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              authorityAvailable: true,
              workspaceCurrent: true,
              userCurrent: true,
              membershipCurrent: true,
              bindingMatches: true,
              permissionCurrent: null,
              requiredPermission: null,
              workspace: { workspaceId: requesterWorkspaceId, version: 1 },
              user: { userId: requesterUserId, version: 1 },
              membership: {
                membershipId: requesterMembershipId,
                workspaceId: requesterWorkspaceId,
                userId: requesterUserId,
                role: 'MEMBER',
                version: 1
              }
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        );
      }
      return Promise.reject(new Error(`Unexpected external dependency call: ${target}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const runtime = createDurableMgsnServices({
      database,
      coreUrl: 'http://core.test',
      executionUrl: 'http://execution.test',
      internalServiceSecret: 'test-secret'
    });

    const responsibility = await runtime.providerResponsibility.createProfile(
      { workspaceId: providerWorkspaceId, actorId: 'provider-user_epic-358' },
      {
        schemaVersion: 1,
        providerId,
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
        providerId,
        providerWorkspaceId,
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

    const discovery = await runtime.providerDiscovery.evaluate(
      { workspaceId: requesterWorkspaceId, actorId: requesterUserId },
      discoveryRequest()
    );
    expect(discovery.status).toBe('CANDIDATES');
    if (discovery.status !== 'CANDIDATES') throw new Error('Discovery must return a candidate.');
    const candidate = discovery.candidates[0];
    expect(candidate.providerId).toBe(providerId);
    expect(candidate.directExecutorDisclosure).toMatchObject({
      state: 'INDEPENDENT_EVIDENCE_REFERENCED',
      evidenceReferences: ['mgsn-verification:epic-358-runtime-e2e'],
      requiresIndependentCurrentVerification: true
    });
    expect(
      candidate.sourceVersions.some(
        (source) => source.sourceType === 'PROVIDER_RESPONSIBILITY_PROFILE'
      )
    ).toBe(true);
    if (candidate.directExecutorDisclosure.state !== 'INDEPENDENT_EVIDENCE_REFERENCED')
      throw new Error('Discovery must carry independently verified Direct Executor lineage.');

    const sourceLineage: ProviderSelectionSourceLineageV1 = {
      discoveryRequest: {
        providerDiscoveryRequestId: discovery.request.providerDiscoveryRequestId,
        requesterWorkspaceId: discovery.request.requesterWorkspaceId,
        requestFingerprintSha256: discovery.request.requestFingerprintSha256,
        needReference: discovery.request.need.reference,
        needVersion: discovery.request.need.version,
        needFingerprintSha256: discovery.request.need.fingerprintSha256,
        purpose: discovery.request.purpose,
        contextReference: discovery.request.contextReference
      },
      discoveryResult: {
        resultFingerprintSha256: discovery.resultFingerprintSha256,
        evaluatedAt: discovery.evaluatedAt
      },
      discoveryCandidate: {
        providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
        candidateFingerprintSha256: candidate.candidateFingerprintSha256,
        generatedAt: candidate.generatedAt,
        evaluationPolicyVersion: candidate.evaluationPolicyVersion
      },
      provider: {
        providerId: candidate.providerId,
        providerWorkspaceId: candidate.providerWorkspaceId
      },
      providerSupplyCapability: candidate.providerSupplyCapability,
      visibilityAuthorizationAtReview: candidate.visibilityAuthorization,
      historicalSourceVersions: candidate.sourceVersions,
      directExecutorDisclosureAtReview: {
        state: 'INDEPENDENT_EVIDENCE_REFERENCED',
        evidenceReferences: candidate.directExecutorDisclosure.evidenceReferences
      },
      currentAuthorityRevalidationRequiredBeforeSelectionCommit: true,
      currentAuthorityRevalidationRequiredBeforeDownstreamUse: true
    };
    const selectionCommand: CreateOrReplaceProviderSelectionCommandV1 = {
      schemaVersion: 1,
      requesterWorkspaceId,
      scope: {
        owner: 'LITE',
        reference: discovery.request.need.reference,
        version: discovery.request.need.version,
        fingerprintSha256: discovery.request.need.fingerprintSha256
      },
      sourceLineage,
      trustedHumanAuthority: selectionAuthority,
      acknowledgement: {
        affirmativeHumanAction: true,
        acknowledgementCode: 'HUMAN_PROVIDER_SELECTION_V1',
        acknowledgementTextVersion: 'v1',
        reviewedCandidateId: candidate.providerDiscoveryCandidateId,
        reviewedCandidateFingerprintSha256: candidate.candidateFingerprintSha256,
        reviewedScopeFingerprintSha256: discovery.request.need.fingerprintSha256,
        reviewedAt: at,
        reasonCode: 'EVIDENCE_AND_LIMITATIONS_REVIEWED',
        rationale: 'Reviewed the exact Discovery candidate and Direct Executor evidence.',
        containsCustomerDocuments: false,
        containsRawEvidenceArtifacts: false,
        containsEndClientRelationshipInformation: false,
        containsApplicantOwnerOfficialData: false,
        containsCommercialMarginOrProfit: false
      },
      expectedCurrent: { kind: 'ABSENT', expectedScopeVersion: 0 },
      idempotencyKey: 'provider-selection:create:epic-358-runtime-e2e',
      commandFingerprintSha256: 'a'.repeat(64),
      correlationId: 'correlation_selection_epic_358_runtime_e2e'
    };
    const selected = await runtime.providerSelection.createOrReplace(
      selectionPrincipal,
      selectionCommand
    );
    expect(selected.selection.sourceLineage.discoveryCandidate).toEqual(
      sourceLineage.discoveryCandidate
    );

    const servicePackage = await runtime.servicePackageEligibility.admitServicePackage({
      workspaceId: requesterWorkspaceId,
      source: executionSource(),
      actorId: requesterUserId,
      idempotencyKey: 'package-admit-epic-358-runtime-e2e',
      correlationId
    });
    const evaluation = await runtime.servicePackageEligibility.evaluateProviderEligibility({
      workspaceId: requesterWorkspaceId,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      providerSupplyCapabilityId: capability.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: capability.version,
      expectedProviderSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      actorId: requesterUserId,
      idempotencyKey: 'eligibility-evaluate-epic-358-runtime-e2e',
      correlationId
    });
    expect(evaluation.outcome).toBe('ELIGIBLE');

    const command: GovernedAllocationCommand = {
      workspaceId: requesterWorkspaceId,
      actorId: requesterUserId,
      servicePackageId: servicePackage.servicePackageId,
      expectedServicePackageVersion: servicePackage.version,
      expectedServicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      eligibilityEvaluationId: evaluation.eligibilityEvaluationId,
      expectedEligibilityEvaluationVersion: evaluation.version,
      expectedEligibilityFingerprintSha256: evaluation.deterministicFingerprintSha256,
      providerId,
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
      providerId,
      handoffBindingState: 'NO_CONTROLLED_HANDOFF_BY_DESIGN'
    });

    const restartedRuntime = createDurableMgsnServices({
      database,
      coreUrl: 'http://core.test',
      executionUrl: 'http://execution.test',
      internalServiceSecret: 'test-secret'
    });
    await expect(restartedRuntime.governedAllocation.allocate(command)).resolves.toEqual(allocated);
    const providerWork = await restartedRuntime.providerWorkRead.read(
      {
        workspaceId: providerWorkspaceId,
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
