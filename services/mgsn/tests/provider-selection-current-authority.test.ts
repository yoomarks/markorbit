import { describe, expect, it, vi } from 'vitest';
import type { ProviderDirectExecutorAssessmentV1 } from '@markorbit/contracts/provider-responsibility';
import { noProviderResponsibilityAuthorityConsequences } from '@markorbit/contracts/provider-responsibility';
import type { ProviderId, ProviderSupplyCapabilityId } from '@markorbit/contracts/provider-execution';
import type {
  ProviderSelectionSourceLineageV1,
  ProviderSelectionTrustedHumanAuthorityV1
} from '@markorbit/contracts/provider-selection';
import type {
  NetworkParticipationId,
  NetworkVisibilityPolicyVersionRecord
} from '../src/network-participation.js';
import type { NetworkParticipationVersionRecord } from '../src/network-participation.js';
import {
  PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION,
  providerDiscoveryFingerprint
} from '../src/provider-discovery.js';
import type {
  ProviderRegistryRecord,
  ProviderSupplyCapabilityRecord
} from '../src/provider-registry.js';
import {
  MgsnProviderSelectionCurrentAuthoritySource,
  type CoreCurrentWorkspaceAuthoritySource,
  type SelectionNetworkAuthoritySource,
  type SelectionProviderAuthoritySource,
  type SelectionResponsibilityAuthoritySource
} from '../src/provider-selection-current-authority.js';

const at = '2026-09-04T09:30:00.000Z';
const workspaceId = '018f0000-0000-7000-8000-000000000715';
const userId = '018f0000-0000-7000-8000-000000000716';
const membershipId = '018f0000-0000-7000-8000-000000000717';
const providerWorkspaceId = '018f0000-0000-7000-8000-000000000718';
const providerId = 'provider_selection-715' as ProviderId;
const supplyId = 'provider-supply-capability_selection-715' as ProviderSupplyCapabilityId;
const participationId = 'network-participation_selection-715' as NetworkParticipationId;
const profileId = 'provider-responsibility_selection-715' as const;
const supplyFingerprint = 'a'.repeat(64);
const profileFingerprint = 'b'.repeat(64);
const responsibilityEvidence = ['responsibility-evidence:selection-715'];

const provider: ProviderRegistryRecord = {
  schemaVersion: 1,
  providerId,
  providerWorkspaceId,
  displayName: 'Selection 715 Provider',
  operationalStatus: 'ACTIVE',
  version: 2,
  createdBy: 'system',
  updatedBy: 'system',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z'
};

const supply: ProviderSupplyCapabilityRecord = {
  schemaVersion: 1,
  providerSupplyCapabilityId: supplyId,
  provider: {
    providerId,
    providerWorkspaceId,
    displayName: provider.displayName,
    operationalStatus: 'ACTIVE'
  },
  version: 3,
  status: 'ACTIVE',
  jurisdictions: ['US'],
  serviceTypes: ['TRADEMARK_APPLICATION'],
  effectivePeriod: {
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: '2027-01-01T00:00:00.000Z'
  },
  capacityUnits: 10,
  availabilityUnits: 2,
  verificationState: 'VERIFIED_FOR_SUPPLY',
  evidenceReferences: [],
  sourceFingerprintSha256: supplyFingerprint,
  createdBy: 'system',
  updatedBy: 'system',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z'
};

const participation: NetworkParticipationVersionRecord = {
  schemaVersion: 1,
  networkParticipationId: participationId,
  workspaceId: providerWorkspaceId,
  providerId,
  version: 4,
  state: 'ACTIVE',
  authorizationReference: 'participation-authority:selection-715',
  reason: 'Selection current-authority test',
  actorId: 'actor_selection-715',
  correlationId: 'correlation_selection-715',
  occurredAt: '2026-09-02T00:00:00.000Z',
  createdAt: '2026-09-02T00:00:00.000Z'
};

function boundedPublicPolicy(): NetworkVisibilityPolicyVersionRecord {
  return {
    schemaVersion: 1,
    networkParticipationId: participationId,
    participationVersion: participation.version,
    version: 5,
    scope: 'BOUNDED_PUBLIC',
    grants: [
      {
        dataClass: 'PROVIDER_REFERENCE',
        fields: ['providerId'],
        scope: 'BOUNDED_PUBLIC',
        audience: { kind: 'BOUNDED_NETWORK' },
        purpose: 'PROVIDER_DISCOVERY',
        authorityReferences: ['visibility-authority:selection-715']
      }
    ],
    authorizationReference: 'visibility-authority:selection-715',
    updatedAt: '2026-09-02T01:00:00.000Z',
    reason: 'Selection current-authority test',
    actorId: 'actor_selection-715',
    correlationId: 'correlation_selection-715',
    createdAt: '2026-09-02T01:00:00.000Z'
  };
}

function providerFingerprint(current = provider): string {
  return providerDiscoveryFingerprint({
    providerId: current.providerId,
    providerWorkspaceId: current.providerWorkspaceId,
    operationalStatus: current.operationalStatus,
    version: current.version,
    updatedAt: current.updatedAt
  });
}

function participationFingerprint(current = participation): string {
  return providerDiscoveryFingerprint({
    networkParticipationId: current.networkParticipationId,
    participationVersion: current.version,
    state: current.state,
    occurredAt: current.occurredAt
  });
}

function visibilityFingerprint(current: NetworkVisibilityPolicyVersionRecord): string {
  return providerDiscoveryFingerprint({
    networkParticipationId: current.networkParticipationId,
    version: current.version,
    scope: current.scope,
    updatedAt: current.updatedAt
  });
}

function assessment(): ProviderDirectExecutorAssessmentV1 {
  return {
    schemaVersion: 1,
    provider: { providerId, providerWorkspaceId },
    profile: {
      providerResponsibilityProfileId: profileId,
      version: 6,
      profileFingerprintSha256: profileFingerprint
    },
    state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
    directExecutorEstablished: true,
    profileAuthorityState: 'CURRENT',
    finalExecutionProviderId: providerId,
    finalExecutionProviderWorkspaceId: providerWorkspaceId,
    legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false },
    evidenceReferences: responsibilityEvidence,
    checkedAt: at,
    assessmentPolicyVersion: 'mgsn-provider-responsibility-assessment-v1',
    assessmentFingerprintSha256: 'c'.repeat(64),
    hiddenIntermediaryAllowed: false,
    currentAuthorityRevalidationRequiredBeforeUse: true,
    authorityConsequences: noProviderResponsibilityAuthorityConsequences
  };
}

function trustedAuthority(
  overrides: Partial<ProviderSelectionTrustedHumanAuthorityV1> = {}
): ProviderSelectionTrustedHumanAuthorityV1 {
  return {
    source: 'CORE_WORKSPACE_PRINCIPAL',
    requesterWorkspaceId: workspaceId,
    selectingActorId: userId,
    principalReference: 'core-principal:selection-715',
    workspaceMembershipReference: membershipId,
    selectionAuthorityReference: 'selection-authority:selection-715',
    selectionAuthorityVersion: 1,
    authenticatedAt: at,
    affirmativeHumanActionEvidenceReference: 'human-action:selection-715',
    payloadIdentityAuthoritative: false,
    ...overrides
  };
}

function sourceLineage(
  policy = boundedPublicPolicy(),
  overrides: Partial<ProviderSelectionSourceLineageV1> = {}
): ProviderSelectionSourceLineageV1 {
  const currentProviderFingerprint = providerFingerprint();
  const currentParticipationFingerprint = participationFingerprint();
  const currentVisibilityFingerprint = visibilityFingerprint(policy);
  const requestFingerprintSha256 = '1'.repeat(64);
  const identityFingerprint = providerDiscoveryFingerprint({
    requestFingerprintSha256,
    providerId,
    providerWorkspaceId,
    providerVersion: provider.version,
    providerFingerprintSha256: currentProviderFingerprint,
    providerSupplyCapabilityId: supplyId,
    supplyVersion: supply.version,
    supplyFingerprintSha256: supplyFingerprint,
    participationId,
    participationVersion: participation.version,
    visibilityPolicyVersion: policy.version,
    evaluationPolicyVersion: PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION,
    evaluatedAt: at
  });
  const base: ProviderSelectionSourceLineageV1 = {
    discoveryRequest: {
      providerDiscoveryRequestId: 'provider-discovery-request_selection-715',
      requesterWorkspaceId: workspaceId,
      requestFingerprintSha256,
      needReference: 'need:selection-715',
      needVersion: 1,
      needFingerprintSha256: '2'.repeat(64),
      purpose: 'PROVIDER_DISCOVERY',
      contextReference: 'context:selection-715'
    },
    discoveryResult: {
      resultFingerprintSha256: '3'.repeat(64),
      evaluatedAt: at
    },
    discoveryCandidate: {
      providerDiscoveryCandidateId: `provider-discovery-candidate_${identityFingerprint}`,
      candidateFingerprintSha256: '4'.repeat(64),
      generatedAt: at,
      evaluationPolicyVersion: PROVIDER_DISCOVERY_EVALUATION_POLICY_VERSION
    },
    provider: { providerId, providerWorkspaceId },
    providerSupplyCapability: {
      id: supplyId,
      version: supply.version,
      fingerprintSha256: supplyFingerprint
    },
    visibilityAuthorizationAtReview: {
      networkParticipationId: participationId,
      participationVersion: participation.version,
      visibilityPolicyVersion: policy.version,
      evaluatedAt: at,
      currentAuthorityRevalidationRequiredBeforeServe: true
    },
    historicalSourceVersions: [
      {
        owner: 'MGSN',
        sourceType: 'PROVIDER',
        sourceId: providerId,
        version: provider.version,
        fingerprintSha256: currentProviderFingerprint,
        checkedAt: at,
        authorityState: 'CURRENT'
      },
      {
        owner: 'MGSN',
        sourceType: 'PROVIDER_SUPPLY_CAPABILITY',
        sourceId: supplyId,
        version: supply.version,
        fingerprintSha256: supplyFingerprint,
        effectiveFrom: supply.effectivePeriod.effectiveFrom,
        effectiveUntil: supply.effectivePeriod.effectiveUntil,
        checkedAt: at,
        authorityState: 'CURRENT'
      },
      {
        owner: 'MGSN',
        sourceType: 'NETWORK_PARTICIPATION',
        sourceId: participationId,
        version: participation.version,
        fingerprintSha256: currentParticipationFingerprint,
        checkedAt: at,
        authorityState: 'CURRENT'
      },
      {
        owner: 'MGSN',
        sourceType: 'NETWORK_VISIBILITY_POLICY',
        sourceId: participationId,
        version: policy.version,
        fingerprintSha256: currentVisibilityFingerprint,
        checkedAt: at,
        authorityState: 'CURRENT'
      },
      {
        owner: 'MGSN',
        sourceType: 'PROVIDER_RESPONSIBILITY_PROFILE',
        sourceId: profileId,
        version: 6,
        fingerprintSha256: profileFingerprint,
        checkedAt: at,
        authorityState: 'CURRENT'
      }
    ],
    directExecutorDisclosureAtReview: {
      state: 'INDEPENDENT_EVIDENCE_REFERENCED',
      evidenceReferences: responsibilityEvidence
    },
    currentAuthorityRevalidationRequiredBeforeSelectionCommit: true,
    currentAuthorityRevalidationRequiredBeforeDownstreamUse: true
  };
  return { ...base, ...overrides };
}

function harness(options: {
  core?: Awaited<ReturnType<CoreCurrentWorkspaceAuthoritySource['validateCurrent']>>;
  currentProvider?: ProviderRegistryRecord | undefined;
  currentSupply?: ProviderSupplyCapabilityRecord | undefined;
  currentParticipation?: NetworkParticipationVersionRecord | undefined;
  policy?: NetworkVisibilityPolicyVersionRecord | undefined;
  currentAssessment?: ProviderDirectExecutorAssessmentV1 | null;
} = {}) {
  const currentProvider = options.currentProvider === undefined ? provider : options.currentProvider;
  const currentSupply = options.currentSupply === undefined ? supply : options.currentSupply;
  const currentParticipation =
    options.currentParticipation === undefined ? participation : options.currentParticipation;
  const currentPolicy = options.policy === undefined ? boundedPublicPolicy() : options.policy;
  const currentAssessment = options.currentAssessment === undefined ? assessment() : options.currentAssessment;
  const core: CoreCurrentWorkspaceAuthoritySource = {
    validateCurrent: vi.fn(() =>
      Promise.resolve(
        options.core ?? {
          authorityAvailable: true,
          current: true,
          authorityReferences: [
            `core-workspace:${workspaceId}:v1`,
            `core-user:${userId}:v1`,
            `core-membership:${membershipId}:v1`
          ]
        }
      )
    )
  };
  const network: SelectionNetworkAuthoritySource = {
    findLatestParticipation: vi.fn(() => Promise.resolve(currentParticipation)),
    findCurrentParticipation: vi.fn(() => Promise.resolve(currentParticipation)),
    findCurrentVisibilityPolicy: vi.fn(() => Promise.resolve(currentPolicy))
  };
  const providers: SelectionProviderAuthoritySource = {
    findProviderById: vi.fn(() => Promise.resolve(currentProvider)),
    findSupplyCapability: vi.fn(() => Promise.resolve(currentSupply))
  };
  const responsibility: SelectionResponsibilityAuthoritySource = {
    assessCurrent: vi.fn(() =>
      Promise.resolve({
        state: currentAssessment?.state ?? 'UNKNOWN_OR_UNPROVEN',
        assessment: currentAssessment
      })
    )
  };
  return {
    core,
    source: new MgsnProviderSelectionCurrentAuthoritySource(
      core,
      network,
      providers,
      responsibility
    )
  };
}

function input(lineage = sourceLineage(), authority = trustedAuthority()) {
  return {
    requesterWorkspaceId: workspaceId,
    selectingActorId: userId,
    scope: {
      owner: 'LITE' as const,
      reference: 'need:selection-715',
      version: 1,
      fingerprintSha256: '5'.repeat(64)
    },
    sourceLineage: lineage,
    trustedHumanAuthority: authority,
    purpose: 'SELECTION_COMMIT' as const,
    checkedAt: at
  };
}

describe('MGSN current Human Selection authority', () => {
  it('authorizes only exact Core identity + current candidate/source/network/Direct Executor truth', async () => {
    const { source } = harness();

    await expect(source.evaluateCurrentAuthority(input())).resolves.toMatchObject({
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
      sourceVersionsMatch: true
    });
  });

  it('never interprets an opaque historical membership reference as a Core membership id', async () => {
    const { source, core } = harness();
    const authority = trustedAuthority({
      workspaceMembershipReference: 'workspace-membership:historical-reference'
    });

    await expect(source.evaluateCurrentAuthority(input(sourceLineage(), authority))).resolves.toMatchObject({
      authorityAvailable: true,
      requesterAuthorityCurrent: false,
      actorAuthorityCurrent: false
    });
    expect(core.validateCurrent).not.toHaveBeenCalled();
  });

  it('fails closed when Core current authority is unavailable or denied', async () => {
    const unavailable = harness({
      core: { authorityAvailable: false, current: false, authorityReferences: [] }
    });
    const denied = harness({
      core: { authorityAvailable: true, current: false, authorityReferences: [] }
    });

    await expect(unavailable.source.evaluateCurrentAuthority(input())).resolves.toMatchObject({
      authorityAvailable: false
    });
    await expect(denied.source.evaluateCurrentAuthority(input())).resolves.toMatchObject({
      authorityAvailable: true,
      requesterAuthorityCurrent: false,
      actorAuthorityCurrent: false
    });
  });

  it('denies changed Supply and changed Visibility before later authority can rescue them', async () => {
    const changedSupply: ProviderSupplyCapabilityRecord = {
      ...supply,
      sourceFingerprintSha256: '9'.repeat(64)
    };
    const changedPolicy: NetworkVisibilityPolicyVersionRecord = {
      ...boundedPublicPolicy(),
      version: 6
    };

    await expect(
      harness({ currentSupply: changedSupply }).source.evaluateCurrentAuthority(input())
    ).resolves.toMatchObject({ supplyCurrent: false, participationActive: false });
    await expect(
      harness({ policy: changedPolicy }).source.evaluateCurrentAuthority(input())
    ).resolves.toMatchObject({
      participationActive: true,
      visibilityAuthorized: false,
      directExecutorEstablished: false
    });
  });

  it('recomputes immutable candidate identity instead of trusting the stored candidate id', async () => {
    const lineage = sourceLineage();
    const tampered: ProviderSelectionSourceLineageV1 = {
      ...lineage,
      discoveryCandidate: {
        ...lineage.discoveryCandidate,
        providerDiscoveryCandidateId: 'provider-discovery-candidate_tampered'
      }
    };

    await expect(harness().source.evaluateCurrentAuthority(input(tampered))).resolves.toMatchObject({
      candidateCurrent: false,
      sourceVersionsMatch: true
    });
  });

  it('requires the exact current Responsibility profile and independent evidence', async () => {
    const changedAssessment: ProviderDirectExecutorAssessmentV1 = {
      ...assessment(),
      profile: {
        ...assessment().profile,
        profileFingerprintSha256: '8'.repeat(64)
      }
    };

    await expect(
      harness({ currentAssessment: changedAssessment }).source.evaluateCurrentAuthority(input())
    ).resolves.toMatchObject({
      directExecutorEstablished: false,
      sourceVersionsMatch: false,
      candidateCurrent: false
    });
  });

  it('keeps exact TRUSTED visibility fail-closed without current relationship authority', async () => {
    const policy: NetworkVisibilityPolicyVersionRecord = {
      ...boundedPublicPolicy(),
      scope: 'TRUSTED',
      grants: [
        {
          dataClass: 'PROVIDER_REFERENCE',
          fields: ['providerId'],
          scope: 'TRUSTED',
          audience: {
            kind: 'TRUSTED_RELATIONSHIP',
            relationshipAuthorityReference: 'relationship-authority:selection-715'
          },
          purpose: 'PROVIDER_DISCOVERY',
          authorityReferences: ['visibility-authority:selection-715']
        }
      ]
    };
    const lineage = sourceLineage(policy);

    await expect(
      harness({ policy }).source.evaluateCurrentAuthority(input(lineage))
    ).resolves.toMatchObject({
      visibilityAuthorized: true,
      trustedRelationshipRequired: true,
      trustedRelationshipCurrent: false,
      sourceVersionsMatch: true,
      candidateCurrent: true
    });
  });

  it('fails source-version currentness closed for unsupported owner lineage', async () => {
    const lineage = sourceLineage();
    const unsupported: ProviderSelectionSourceLineageV1 = {
      ...lineage,
      historicalSourceVersions: [
        ...lineage.historicalSourceVersions,
        {
          owner: 'OTHER_CANONICAL_OWNER',
          sourceType: 'EXTERNAL_SOURCE',
          sourceId: 'external:selection-715',
          version: 1,
          fingerprintSha256: '7'.repeat(64),
          checkedAt: at,
          authorityState: 'CURRENT'
        }
      ]
    };

    await expect(harness().source.evaluateCurrentAuthority(input(unsupported))).resolves.toMatchObject({
      sourceVersionsMatch: false,
      candidateCurrent: false
    });
  });
});
