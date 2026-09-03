import { describe, expect, it } from 'vitest';
import {
  noTrustEvidenceAuthorityConsequences,
  outcomeTrustEvidenceFixtureAtV1,
  outcomeTrustEvidenceFixtureContextV1,
  outcomeTrustEvidenceFixtureProviderIdV1,
  trustEvidenceItemFingerprintV1,
  trustEvidenceVisibilityProjectionFingerprintV1,
  type TrustEvidenceItemV1,
  type TrustEvidenceVisibilityProjectionV1
} from '@markorbit/contracts/outcome-trust-evidence';
import { noProviderResponsibilityAuthorityConsequences } from '@markorbit/contracts/provider-responsibility';
import type {
  NetworkParticipationVersionRecord,
  NetworkVisibilityPolicyVersionRecord
} from '../src/network-participation.js';
import {
  MgsnTrustEvidenceCurrentAuthoritySource,
  type TrustEvidenceNetworkAuthoritySource,
  type TrustEvidenceProviderReturnSource,
  type TrustEvidenceProviderSource,
  type TrustEvidenceResponsibilitySource
} from '../src/outcome-trust-evidence-current-authority.js';
import {
  InMemoryOutcomeTrustEvidenceRepository,
  OutcomeTrustEvidenceService
} from '../src/outcome-trust-evidence.js';
import type { ProviderRegistryRecord } from '../src/provider-registry.js';
import type { ProviderReturnRecord } from '../src/provider-return.js';

const now = outcomeTrustEvidenceFixtureAtV1;
const providerId = outcomeTrustEvidenceFixtureProviderIdV1;
const workspaceId = '71700000-0000-4000-8000-000000000001';
const participationId = 'network-participation_fixture-trust-717' as const;
const providerReturnId = 'provider-return_fixture-trust-717' as const;
const policyAuthorizationReference = 'visibility:trust-717';
const hash = (digit: string) => digit.repeat(64);

const participation = {
  schemaVersion: 1,
  networkParticipationId: participationId,
  workspaceId,
  providerId,
  version: 1,
  state: 'ACTIVE',
  authorizationReference: 'participation:trust-717',
  reason: 'Trust exposure fixture.',
  actorId: 'actor_trust_717',
  correlationId: 'correlation_trust_717',
  occurredAt: now,
  createdAt: now
} as NetworkParticipationVersionRecord;

const policy = {
  schemaVersion: 1,
  networkParticipationId: participationId,
  participationVersion: 1,
  version: 1,
  scope: 'BOUNDED_PUBLIC',
  grants: [
    {
      dataClass: 'PROVIDER_REFERENCE',
      fields: ['providerId'],
      scope: 'BOUNDED_PUBLIC',
      audience: { kind: 'BOUNDED_NETWORK' },
      purpose: 'PROVIDER_DISCOVERY',
      authorityReferences: ['visibility-grant:trust-717']
    }
  ],
  authorizationReference: policyAuthorizationReference,
  reason: 'Bounded network Trust explanation fixture.',
  actorId: 'actor_trust_717',
  correlationId: 'correlation_trust_717',
  updatedAt: now,
  createdAt: now
} as NetworkVisibilityPolicyVersionRecord;

const provider = {
  schemaVersion: 1,
  providerId,
  providerWorkspaceId: workspaceId,
  displayName: 'Trust Provider 717',
  operationalStatus: 'ACTIVE',
  version: 1,
  createdBy: 'actor_trust_717',
  updatedBy: 'actor_trust_717',
  createdAt: now,
  updatedAt: now
} as ProviderRegistryRecord;

const providerReturn = {
  schemaVersion: 1,
  providerReturnId,
  workspaceId,
  version: 1,
  servicePackage: { id: 'service-package_fixture-trust-717', version: 1 },
  allocation: { id: 'allocation_fixture-trust-717', version: 1 },
  providerAcceptance: { id: 'provider-acceptance_fixture-trust-717', version: 1 },
  providerId,
  providerWorkspaceId: workspaceId,
  providerActorId: 'actor_trust_717',
  workStatusClaim: 'Evidence prepared.',
  artifacts: [],
  assertions: [{ code: 'TRUST_FIXTURE', value: true, evidenceReferences: [] }],
  returnFingerprintSha256: hash('1'),
  status: 'CURRENT',
  submittedAt: now,
  correlationId: 'correlation_trust_717'
} as unknown as ProviderReturnRecord;

const responsibilityAssessment = {
  schemaVersion: 1,
  provider: { providerId, providerWorkspaceId: workspaceId },
  profile: {
    providerResponsibilityProfileId: 'provider-responsibility_fixture-trust-717',
    version: 2,
    profileFingerprintSha256: hash('7')
  },
  state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
  directExecutorEstablished: true,
  profileAuthorityState: 'CURRENT',
  finalExecutionProviderId: providerId,
  finalExecutionProviderWorkspaceId: workspaceId,
  legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false },
  evidenceReferences: ['provider-responsibility-evidence:trust-717'],
  checkedAt: now,
  assessmentPolicyVersion: 'mgsn-provider-responsibility-v1',
  assessmentFingerprintSha256: hash('8'),
  hiddenIntermediaryAllowed: false,
  currentAuthorityRevalidationRequiredBeforeUse: true,
  authorityConsequences: noProviderResponsibilityAuthorityConsequences
} as const;

function networkSource(
  overrides: {
    currentParticipation?: NetworkParticipationVersionRecord | undefined;
    currentPolicy?: NetworkVisibilityPolicyVersionRecord | undefined;
    throwOnRead?: boolean;
  } = {}
): TrustEvidenceNetworkAuthoritySource {
  const currentParticipation =
    'currentParticipation' in overrides ? overrides.currentParticipation : participation;
  const currentPolicy = 'currentPolicy' in overrides ? overrides.currentPolicy : policy;
  return {
    findLatestParticipation: async () => {
      if (overrides.throwOnRead) throw new Error('network unavailable');
      return participation;
    },
    findCurrentParticipation: async () => {
      if (overrides.throwOnRead) throw new Error('network unavailable');
      return currentParticipation;
    },
    findCurrentVisibilityPolicy: async () => {
      if (overrides.throwOnRead) throw new Error('network unavailable');
      return currentPolicy;
    }
  };
}

function returnSource(
  current: ProviderReturnRecord | undefined = providerReturn
): TrustEvidenceProviderReturnSource {
  return { findProviderReturn: async () => current };
}

const providerSource: TrustEvidenceProviderSource = {
  findProviderById: async () => provider
};

type ResponsibilityAssessment = Awaited<
  ReturnType<TrustEvidenceResponsibilitySource['assessCurrent']>
>['assessment'];

function responsibilitySource(
  assessment: ResponsibilityAssessment = responsibilityAssessment
): TrustEvidenceResponsibilitySource {
  return {
    assessCurrent: async () => ({
      state: assessment?.state ?? 'UNKNOWN_OR_UNPROVEN',
      assessment
    })
  } as TrustEvidenceResponsibilitySource;
}

function authority(
  network: TrustEvidenceNetworkAuthoritySource = networkSource(),
  returns: TrustEvidenceProviderReturnSource = returnSource(),
  providers: TrustEvidenceProviderSource = providerSource,
  responsibility: TrustEvidenceResponsibilitySource = responsibilitySource()
) {
  return new MgsnTrustEvidenceCurrentAuthoritySource(network, returns, providers, responsibility);
}

function providerClaimItem(overrides: Partial<TrustEvidenceItemV1> = {}): TrustEvidenceItemV1 {
  const base = {
    schemaVersion: 1 as const,
    version: 1,
    providerId,
    lifecycleState: 'CURRENT' as const,
    context: outcomeTrustEvidenceFixtureContextV1,
    source: {
      kind: 'PROVIDER_CLAIM' as const,
      owner: 'MGSN' as const,
      providerReturnId,
      providerReturnVersion: 1,
      providerReturnFingerprintSha256: providerReturn.returnFingerprintSha256,
      providerReturnStatus: 'CURRENT' as const,
      claimKind: 'STRUCTURED_ASSERTION' as const,
      claimReference: 'provider-claim:trust-717',
      submittedAt: now,
      verifiedOutcomeEstablished: false as const,
      officialTruthEstablished: false as const
    },
    sourceAuthority: {
      sourceClass: 'PROVIDER_CLAIM' as const,
      authorityState: 'CURRENT' as const,
      checkedAt: now,
      currentSourceRevalidationRequiredBeforeUse: true as const,
      historicalSourceDoesNotEstablishCurrentSuitability: true as const,
      universalPerformanceInferenceAuthorized: false as const
    },
    evidenceReferences: [],
    freshness: {
      state: 'CURRENT_FOR_CONTEXT' as const,
      policyVersion: 'trust-freshness-v1',
      checkedAt: now,
      currentSuitabilityEstablished: false as const
    },
    lineage: [],
    contradictions: [],
    limitations: [],
    currentExposureAuthorizationRequired: true as const,
    authorityConsequences: noTrustEvidenceAuthorityConsequences
  };
  const merged = { ...base, ...overrides } as Omit<
    TrustEvidenceItemV1,
    'trustEvidenceItemId' | 'trustEvidenceItemFingerprintSha256' | 'createdAt'
  >;
  const fingerprint = trustEvidenceItemFingerprintV1(merged);
  return {
    ...merged,
    trustEvidenceItemId: `trust-evidence-item_${fingerprint}`,
    trustEvidenceItemFingerprintSha256: fingerprint,
    createdAt: now
  };
}

function projection(
  items: readonly TrustEvidenceItemV1[],
  overrides: Partial<TrustEvidenceVisibilityProjectionV1> = {}
): TrustEvidenceVisibilityProjectionV1 {
  const contextFingerprintSha256 =
    items[0]?.context.contextFingerprintSha256 ??
    outcomeTrustEvidenceFixtureContextV1.contextFingerprintSha256;
  const base = {
    schemaVersion: 1 as const,
    providerId,
    purpose: 'PROVIDER_DISCOVERY_TRUST_EXPLANATION' as const,
    audience: { kind: 'BOUNDED_NETWORK' as const },
    contextFingerprintSha256,
    evidenceItems: items.map((item) => ({
      trustEvidenceItemId: item.trustEvidenceItemId,
      version: item.version,
      trustEvidenceItemFingerprintSha256: item.trustEvidenceItemFingerprintSha256
    })),
    projectedFields: [
      'CONTEXT',
      'SOURCE_CLASS',
      'SOURCE_AUTHORITY_STATE',
      'FRESHNESS',
      'LIMITATIONS',
      'CONTRADICTION_STATE',
      'EXECUTOR_ATTRIBUTION_STATE'
    ] as const,
    historicalAuthorization: {
      kind: 'NETWORK_VISIBILITY' as const,
      networkParticipationId: participationId,
      participationVersion: 1,
      visibilityPolicyVersion: 1,
      visibilityAuthorizationReference: policyAuthorizationReference,
      networkPurpose: 'PROVIDER_DISCOVERY' as const,
      trustProjectionAuthorizationReference: 'trust-projection:trust-717',
      evaluatedAt: now,
      currentAuthorityRevalidationRequiredBeforeServe: true as const
    },
    artifactAccessAuthorized: false as const,
    rawEvidenceDisclosureAuthorized: false as const,
    relationshipGraphDisclosureAuthorized: false as const,
    clientDataDisclosureAuthorized: false as const,
    commercialDataDisclosureAuthorized: false as const,
    currentAuthorityRevalidationRequiredBeforeServe: true as const,
    authorityConsequences: noTrustEvidenceAuthorityConsequences
  };
  const merged = { ...base, ...overrides } as Omit<
    TrustEvidenceVisibilityProjectionV1,
    'trustEvidenceVisibilityProjectionId' | 'projectionFingerprintSha256' | 'createdAt'
  >;
  const fingerprint = trustEvidenceVisibilityProjectionFingerprintV1(merged);
  return {
    ...merged,
    trustEvidenceVisibilityProjectionId: `trust-evidence-projection_${fingerprint}`,
    projectionFingerprintSha256: fingerprint,
    createdAt: now
  };
}

async function validation(
  currentAuthority: MgsnTrustEvidenceCurrentAuthoritySource,
  items: readonly TrustEvidenceItemV1[]
) {
  const repository = new InMemoryOutcomeTrustEvidenceRepository();
  const service = new OutcomeTrustEvidenceService(repository, currentAuthority, () => now);
  for (const item of items) await service.recordEvidenceItem(item);
  const projected = await service.recordVisibilityProjection(projection(items));
  return service.validateCurrentExposure(projected.trustEvidenceVisibilityProjectionId);
}

describe('MGSN #717 current Outcome & Trust Evidence authority', () => {
  it('authorizes only exact current bounded-network visibility plus exact current Provider Return', async () => {
    await expect(validation(authority(), [providerClaimItem()])).resolves.toMatchObject({
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION',
      providerId,
      artifactAccessAuthorized: false,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    });
  });

  it('fails closed when Participation or the exact historical Visibility Policy changes', async () => {
    const paused = { ...participation, version: 2, state: 'PAUSED' as const };
    await expect(
      validation(authority(networkSource({ currentParticipation: paused })), [providerClaimItem()])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'PARTICIPATION_NOT_ACTIVE' });

    const replacedPolicy = {
      ...policy,
      version: 2,
      authorizationReference: 'visibility:replacement-717'
    };
    await expect(
      validation(authority(networkSource({ currentPolicy: replacedPolicy })), [providerClaimItem()])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'VISIBILITY_NOT_AUTHORIZED' });
  });

  it('does not reuse bounded-network authority for a trusted relationship audience', async () => {
    const item = providerClaimItem();
    const projected = projection([item], {
      audience: {
        kind: 'TRUSTED_RELATIONSHIP',
        relationshipAuthorityReference: 'relationship:trust-717'
      }
    });
    const repository = new InMemoryOutcomeTrustEvidenceRepository();
    const service = new OutcomeTrustEvidenceService(repository, authority(), () => now);
    await service.recordEvidenceItem(item);
    await service.recordVisibilityProjection(projected);
    await expect(
      service.validateCurrentExposure(projected.trustEvidenceVisibilityProjectionId)
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'VISIBILITY_NOT_AUTHORIZED' });
  });

  it('denies a superseded or fingerprint-mismatched Provider Return as non-current source truth', async () => {
    const superseded = { ...providerReturn, version: 2, status: 'CURRENT' as const };
    await expect(
      validation(authority(networkSource(), returnSource(superseded)), [providerClaimItem()])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'SOURCE_NOT_CURRENT' });
  });

  it('keeps unsupported owner facts fail-closed without upgrading Payment to performance truth', async () => {
    const claim = providerClaimItem();
    const ownerFact = providerClaimItem({
      source: {
        kind: 'CANONICAL_OWNER_FACT',
        owner: 'PAYMENT',
        factKind: 'PAYMENT_LIFECYCLE',
        sourceId: 'payment_fact_717',
        sourceVersion: 1,
        sourceFingerprintSha256: hash('2'),
        recordedAt: now,
        performanceTruthEstablished: false,
        officialTruthEstablished: false
      },
      sourceAuthority: {
        sourceClass: 'CANONICAL_OWNER_FACT',
        authorityState: 'CURRENT',
        checkedAt: now,
        currentSourceRevalidationRequiredBeforeUse: true,
        historicalSourceDoesNotEstablishCurrentSuitability: true,
        universalPerformanceInferenceAuthorized: false
      }
    });
    await expect(validation(authority(), [claim, ownerFact])).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'SOURCE_NOT_CURRENT'
    });
  });

  it('revalidates established Direct Executor attribution against the exact current responsibility profile', async () => {
    const context = {
      ...outcomeTrustEvidenceFixtureContextV1,
      contextFingerprintSha256: hash('9'),
      executorAttribution: {
        state: 'ESTABLISHED' as const,
        assessmentState: responsibilityAssessment.state,
        assessmentReference: 'provider-responsibility-assessment:trust-717',
        assessmentFingerprintSha256: responsibilityAssessment.assessmentFingerprintSha256,
        profile: responsibilityAssessment.profile,
        finalExecutionProviderId: providerId,
        checkedAt: now,
        currentAuthorityRevalidationRequiredBeforeUse: true as const
      }
    };
    const item = providerClaimItem({ context });
    await expect(validation(authority(), [item])).resolves.toMatchObject({
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION'
    });

    const changedAssessment = {
      ...responsibilityAssessment,
      profile: { ...responsibilityAssessment.profile, version: 3 }
    };
    await expect(
      validation(
        authority(
          networkSource(),
          returnSource(),
          providerSource,
          responsibilitySource(changedAssessment)
        ),
        [item]
      )
    ).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'EXECUTOR_ATTRIBUTION_NOT_ESTABLISHED'
    });
  });

  it('allows an empty current projection to remain insufficient evidence without creating a negative Provider inference', async () => {
    await expect(validation(authority(), [])).resolves.toMatchObject({
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION',
      validatedEvidenceItems: []
    });
  });

  it('turns an owner-source outage into authority unavailable and never grants artifact retrieval', async () => {
    const item = providerClaimItem();
    await expect(
      validation(authority(networkSource({ throwOnRead: true })), [item])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'AUTHORITY_UNAVAILABLE' });

    const repository = new InMemoryOutcomeTrustEvidenceRepository();
    const service = new OutcomeTrustEvidenceService(repository, authority(), () => now);
    await service.recordEvidenceItem(item);
    const projected = await service.recordVisibilityProjection(projection([item]));
    await expect(
      service.validateCurrentExposure(projected.trustEvidenceVisibilityProjectionId, {
        artifactRetrievalRequested: true
      })
    ).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'ARTIFACT_AUTHORITY_NOT_ESTABLISHED',
      artifactAccessAuthorized: false
    });
  });
});
