import { describe, expect, it } from 'vitest';
import {
  noTrustEvidenceAuthorityConsequences,
  outcomeTrustEvidenceFixtureAtV1,
  outcomeTrustEvidenceFixtureContextV1,
  outcomeTrustEvidenceFixtureProviderIdV1,
  trustEvidenceItemFingerprintV1,
  trustEvidenceVisibilityProjectionFingerprintV1,
  type OutcomeEvidenceReferenceV1,
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
const participationId = 'network-participation_fixture-trust-717-review' as const;
const providerReturnId = 'provider-return_fixture-trust-717-review' as const;
const policyAuthorizationReference = 'visibility:trust-717-review';
const hash = (digit: string) => digit.repeat(64);

const participation: NetworkParticipationVersionRecord = {
  schemaVersion: 1,
  networkParticipationId: participationId,
  workspaceId,
  providerId,
  version: 1,
  state: 'ACTIVE',
  authorizationReference: 'participation:trust-717-review',
  reason: 'Trust exposure review fixture.',
  actorId: 'actor_trust_717_review',
  correlationId: 'correlation_trust_717_review',
  occurredAt: now,
  createdAt: now
};

const policy: NetworkVisibilityPolicyVersionRecord = {
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
      authorityReferences: ['visibility-grant:trust-717-review']
    }
  ],
  authorizationReference: policyAuthorizationReference,
  reason: 'Bounded network Trust explanation review fixture.',
  actorId: 'actor_trust_717_review',
  correlationId: 'correlation_trust_717_review',
  updatedAt: now,
  createdAt: now
};

const provider = {
  schemaVersion: 1,
  providerId,
  providerWorkspaceId: workspaceId,
  displayName: 'Trust Provider 717 Review',
  operationalStatus: 'ACTIVE',
  version: 1,
  createdBy: 'actor_trust_717_review',
  updatedBy: 'actor_trust_717_review',
  createdAt: now,
  updatedAt: now
} as ProviderRegistryRecord;

const providerReturn = {
  schemaVersion: 1,
  providerReturnId,
  workspaceId,
  version: 1,
  servicePackage: { id: 'service-package_fixture-trust-717-review', version: 1 },
  allocation: { id: 'allocation_fixture-trust-717-review', version: 1 },
  providerAcceptance: { id: 'provider-acceptance_fixture-trust-717-review', version: 1 },
  providerId,
  providerWorkspaceId: workspaceId,
  providerActorId: 'actor_trust_717_review',
  workStatusClaim: 'Evidence prepared.',
  artifacts: [],
  assertions: [{ code: 'TRUST_REVIEW_FIXTURE', value: true, evidenceReferences: [] }],
  returnFingerprintSha256: hash('1'),
  status: 'CURRENT',
  submittedAt: now,
  correlationId: 'correlation_trust_717_review'
} as unknown as ProviderReturnRecord;

const responsibilityAssessment = {
  schemaVersion: 1,
  provider: { providerId, providerWorkspaceId: workspaceId },
  profile: {
    providerResponsibilityProfileId: 'provider-responsibility_fixture-trust-717-review',
    version: 2,
    profileFingerprintSha256: hash('7')
  },
  state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
  directExecutorEstablished: true,
  profileAuthorityState: 'CURRENT',
  finalExecutionProviderId: providerId,
  finalExecutionProviderWorkspaceId: workspaceId,
  legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false },
  evidenceReferences: ['provider-responsibility-evidence:trust-717-review'],
  checkedAt: now,
  assessmentPolicyVersion: 'mgsn-provider-responsibility-v1',
  assessmentFingerprintSha256: hash('8'),
  hiddenIntermediaryAllowed: false,
  currentAuthorityRevalidationRequiredBeforeUse: true,
  authorityConsequences: noProviderResponsibilityAuthorityConsequences
} as const;

type ResponsibilityAssessment = Awaited<
  ReturnType<TrustEvidenceResponsibilitySource['assessCurrent']>
>['assessment'];

function networkSource(
  overrides: {
    historicalParticipation?: NetworkParticipationVersionRecord | undefined;
    currentParticipation?: NetworkParticipationVersionRecord | undefined;
    currentPolicy?: NetworkVisibilityPolicyVersionRecord | undefined;
  } = {}
): TrustEvidenceNetworkAuthoritySource {
  const historicalParticipation =
    'historicalParticipation' in overrides ? overrides.historicalParticipation : participation;
  const currentParticipation =
    'currentParticipation' in overrides ? overrides.currentParticipation : participation;
  const currentPolicy = 'currentPolicy' in overrides ? overrides.currentPolicy : policy;
  return {
    findLatestParticipation: () => Promise.resolve(historicalParticipation),
    findCurrentParticipation: () => Promise.resolve(currentParticipation),
    findCurrentVisibilityPolicy: () => Promise.resolve(currentPolicy)
  };
}

function returnSource(current: ProviderReturnRecord | undefined): TrustEvidenceProviderReturnSource {
  return { findProviderReturn: () => Promise.resolve(current) };
}

const providerSource: TrustEvidenceProviderSource = {
  findProviderById: () => Promise.resolve(provider)
};

function responsibilitySource(
  assessment: ResponsibilityAssessment
): TrustEvidenceResponsibilitySource {
  return {
    assessCurrent: () =>
      Promise.resolve({
        state: assessment?.state ?? 'UNKNOWN_OR_UNPROVEN',
        assessment
      })
  };
}

function authority(
  network: TrustEvidenceNetworkAuthoritySource = networkSource(),
  returns: TrustEvidenceProviderReturnSource = returnSource(providerReturn),
  providers: TrustEvidenceProviderSource = providerSource,
  responsibility: TrustEvidenceResponsibilitySource = responsibilitySource(
    responsibilityAssessment
  )
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
      claimReference: 'provider-claim:trust-717-review',
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

function establishedExecutorItem(): TrustEvidenceItemV1 {
  return providerClaimItem({
    context: {
      ...outcomeTrustEvidenceFixtureContextV1,
      contextFingerprintSha256: hash('9'),
      executorAttribution: {
        state: 'ESTABLISHED',
        assessmentState: responsibilityAssessment.state,
        assessmentReference: 'provider-responsibility-assessment:trust-717-review',
        assessmentFingerprintSha256: responsibilityAssessment.assessmentFingerprintSha256,
        profile: responsibilityAssessment.profile,
        finalExecutionProviderId: providerId,
        checkedAt: now,
        currentAuthorityRevalidationRequiredBeforeUse: true
      }
    }
  });
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
      trustProjectionAuthorizationReference: 'trust-projection:trust-717-review',
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

const throwingReturns: TrustEvidenceProviderReturnSource = {
  findProviderReturn: () => Promise.reject(new Error('provider return must not be read'))
};

const throwingResponsibility: TrustEvidenceResponsibilitySource = {
  assessCurrent: () => Promise.reject(new Error('responsibility must not be read'))
};

describe('MGSN #717 design/technical review current-authority matrix', () => {
  it('keeps a known Participation denial deterministic without consulting later dependencies', async () => {
    const paused = { ...participation, version: 2, state: 'PAUSED' as const };
    await expect(
      validation(
        authority(
          networkSource({ currentParticipation: paused }),
          throwingReturns,
          providerSource,
          throwingResponsibility
        ),
        [providerClaimItem()]
      )
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'PARTICIPATION_NOT_ACTIVE' });
  });

  it('denies missing or revoked current Participation before source checks', async () => {
    await expect(
      validation(authority(networkSource({ currentParticipation: undefined }), throwingReturns), [
        providerClaimItem()
      ])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'PARTICIPATION_NOT_ACTIVE' });

    const revoked = { ...participation, version: 2, state: 'REVOKED' as const };
    await expect(
      validation(authority(networkSource({ currentParticipation: revoked }), throwingReturns), [
        providerClaimItem()
      ])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'PARTICIPATION_NOT_ACTIVE' });
  });

  it('keeps Visibility denial deterministic for authorization-reference replacement and PRIVATE policy', async () => {
    const changedReference = {
      ...policy,
      authorizationReference: 'visibility:replacement-same-version-717-review'
    };
    await expect(
      validation(authority(networkSource({ currentPolicy: changedReference }), throwingReturns), [
        providerClaimItem()
      ])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'VISIBILITY_NOT_AUTHORIZED' });

    const privatePolicy: NetworkVisibilityPolicyVersionRecord = {
      schemaVersion: 1,
      networkParticipationId: policy.networkParticipationId,
      participationVersion: policy.participationVersion,
      version: policy.version,
      scope: 'PRIVATE',
      grants: [],
      authorizationReference: policy.authorizationReference,
      reason: policy.reason,
      actorId: policy.actorId,
      correlationId: policy.correlationId,
      updatedAt: policy.updatedAt,
      createdAt: policy.createdAt
    };
    await expect(
      validation(authority(networkSource({ currentPolicy: privatePolicy }), throwingReturns), [
        providerClaimItem()
      ])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'VISIBILITY_NOT_AUTHORIZED' });
  });

  it('denies missing, wrong-Provider and fingerprint-mismatched Provider Returns', async () => {
    await expect(
      validation(authority(networkSource(), returnSource(undefined)), [providerClaimItem()])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'SOURCE_NOT_CURRENT' });

    const wrongProvider = {
      ...providerReturn,
      providerId: 'provider_wrong_717_review'
    } as ProviderReturnRecord;
    await expect(
      validation(authority(networkSource(), returnSource(wrongProvider)), [providerClaimItem()])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'SOURCE_NOT_CURRENT' });

    const wrongFingerprint = {
      ...providerReturn,
      returnFingerprintSha256: hash('2')
    } as ProviderReturnRecord;
    await expect(
      validation(authority(networkSource(), returnSource(wrongFingerprint)), [providerClaimItem()])
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'SOURCE_NOT_CURRENT' });
  });

  it('keeps embedded evidence references fail-closed without granting artifact authority', async () => {
    const evidenceReference: OutcomeEvidenceReferenceV1 = {
      evidenceReference: 'unsupported-owner-evidence:717-review',
      sourceOwner: 'EXECUTION',
      sourceType: 'EXECUTION_EVIDENCE',
      sourceId: 'execution-evidence_717_review',
      sourceVersion: 1,
      sourceFingerprintSha256: hash('3'),
      recordedAt: now,
      authorityState: 'CURRENT',
      checkedAt: now,
      artifactAccessAuthorized: false,
      currentArtifactAuthorizationRequired: true
    };
    await expect(
      validation(authority(), [providerClaimItem({ evidenceReferences: [evidenceReference] })])
    ).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'SOURCE_NOT_CURRENT',
      artifactAccessAuthorized: false
    });
  });

  it('fails closed when established Direct Executor authority is inactive, absent or unavailable', async () => {
    const item = establishedExecutorItem();
    const inactiveProvider = {
      ...provider,
      operationalStatus: 'SUSPENDED'
    } as ProviderRegistryRecord;
    const inactiveProviderSource: TrustEvidenceProviderSource = {
      findProviderById: () => Promise.resolve(inactiveProvider)
    };
    await expect(
      validation(
        authority(
          networkSource(),
          returnSource(providerReturn),
          inactiveProviderSource,
          responsibilitySource(responsibilityAssessment)
        ),
        [item]
      )
    ).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'EXECUTOR_ATTRIBUTION_NOT_ESTABLISHED'
    });

    const noAssessment: TrustEvidenceResponsibilitySource = {
      assessCurrent: () => Promise.resolve({ state: 'UNKNOWN_OR_UNPROVEN', assessment: null })
    };
    await expect(
      validation(
        authority(networkSource(), returnSource(providerReturn), providerSource, noAssessment),
        [item]
      )
    ).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'EXECUTOR_ATTRIBUTION_NOT_ESTABLISHED'
    });

    const unavailable: TrustEvidenceResponsibilitySource = {
      assessCurrent: () => Promise.reject(new Error('responsibility unavailable'))
    };
    await expect(
      validation(
        authority(networkSource(), returnSource(providerReturn), providerSource, unavailable),
        [item]
      )
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'AUTHORITY_UNAVAILABLE' });
  });

  it('reports context mismatch without substituting a different Provider/context', async () => {
    const item = providerClaimItem();
    const mismatched = {
      ...projection([item]),
      contextFingerprintSha256: hash('6')
    } as TrustEvidenceVisibilityProjectionV1;
    await expect(
      authority().evaluateCurrentAuthority({ projection: mismatched, evidenceItems: [item] })
    ).resolves.toMatchObject({
      authorityAvailable: true,
      sourceAuthoritiesCurrent: true,
      contextMatches: false
    });
  });

  it('memoizes an exact Provider Return only within one current-authority evaluation', async () => {
    const item = providerClaimItem();
    let reads = 0;
    const countingReturns: TrustEvidenceProviderReturnSource = {
      findProviderReturn: () => {
        reads += 1;
        return Promise.resolve(providerReturn);
      }
    };
    await expect(
      authority(networkSource(), countingReturns).evaluateCurrentAuthority({
        projection: projection([item]),
        evidenceItems: [item, item]
      })
    ).resolves.toMatchObject({
      authorityAvailable: true,
      sourceAuthoritiesCurrent: true
    });
    expect(reads).toBe(1);
  });
});
