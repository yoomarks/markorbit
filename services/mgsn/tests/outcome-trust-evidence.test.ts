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
import {
  InMemoryOutcomeTrustEvidenceRepository,
  OutcomeTrustEvidenceService,
  type TrustEvidenceCurrentAuthoritySnapshot
} from '../src/outcome-trust-evidence.js';

const now = outcomeTrustEvidenceFixtureAtV1;
const hash = (digit: string) => digit.repeat(64);

function authority(
  overrides: Partial<TrustEvidenceCurrentAuthoritySnapshot> = {}
): TrustEvidenceCurrentAuthoritySnapshot {
  return {
    authorityAvailable: true,
    participationActive: true,
    visibilityAuthorized: true,
    relationshipAuthorityCurrent: true,
    sourceAuthoritiesCurrent: true,
    contextMatches: true,
    executorAttributionCurrent: true,
    authorityReferences: ['authority:trust:current'],
    ...overrides
  };
}

function service(snapshot = authority()) {
  return new OutcomeTrustEvidenceService(
    new InMemoryOutcomeTrustEvidenceRepository(),
    { evaluateCurrentAuthority: () => Promise.resolve(snapshot) },
    () => now
  );
}

function providerClaimItem(overrides: Partial<TrustEvidenceItemV1> = {}): TrustEvidenceItemV1 {
  const base = {
    schemaVersion: 1 as const,
    version: 1,
    providerId: outcomeTrustEvidenceFixtureProviderIdV1,
    lifecycleState: 'CURRENT' as const,
    context: outcomeTrustEvidenceFixtureContextV1,
    source: {
      kind: 'PROVIDER_CLAIM' as const,
      owner: 'MGSN' as const,
      providerReturnId: 'provider-return_fixture-trust-616' as const,
      providerReturnVersion: 1,
      providerReturnFingerprintSha256: hash('1'),
      providerReturnStatus: 'CURRENT' as const,
      claimKind: 'STRUCTURED_ASSERTION' as const,
      claimReference: 'provider-claim:fixture-616',
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

function paymentItem(): TrustEvidenceItemV1 {
  const base: Omit<
    TrustEvidenceItemV1,
    'trustEvidenceItemId' | 'trustEvidenceItemFingerprintSha256' | 'createdAt'
  > = {
    schemaVersion: 1,
    version: 1,
    providerId: outcomeTrustEvidenceFixtureProviderIdV1,
    lifecycleState: 'CURRENT',
    context: outcomeTrustEvidenceFixtureContextV1,
    source: {
      kind: 'CANONICAL_OWNER_FACT',
      owner: 'PAYMENT',
      factKind: 'PAYMENT_LIFECYCLE',
      sourceId: 'payment_fact_616',
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
    },
    evidenceReferences: [],
    freshness: {
      state: 'CURRENT_FOR_CONTEXT',
      policyVersion: 'trust-freshness-v1',
      checkedAt: now,
      currentSuitabilityEstablished: false
    },
    lineage: [],
    contradictions: [],
    limitations: [],
    currentExposureAuthorizationRequired: true,
    authorityConsequences: noTrustEvidenceAuthorityConsequences
  };
  const fingerprint = trustEvidenceItemFingerprintV1(base);
  return {
    ...base,
    trustEvidenceItemId: `trust-evidence-item_${fingerprint}`,
    trustEvidenceItemFingerprintSha256: fingerprint,
    createdAt: now
  };
}

function reference(item: TrustEvidenceItemV1) {
  return {
    trustEvidenceItemId: item.trustEvidenceItemId,
    version: item.version,
    trustEvidenceItemFingerprintSha256: item.trustEvidenceItemFingerprintSha256
  };
}

function projection(items: TrustEvidenceItemV1[]): TrustEvidenceVisibilityProjectionV1 {
  const base: Omit<
    TrustEvidenceVisibilityProjectionV1,
    'trustEvidenceVisibilityProjectionId' | 'projectionFingerprintSha256' | 'createdAt'
  > = {
    schemaVersion: 1,
    providerId: outcomeTrustEvidenceFixtureProviderIdV1,
    purpose: 'PROVIDER_DISCOVERY_TRUST_EXPLANATION',
    audience: { kind: 'BOUNDED_NETWORK' },
    contextFingerprintSha256: outcomeTrustEvidenceFixtureContextV1.contextFingerprintSha256,
    evidenceItems: items.map(reference),
    projectedFields: [
      'CONTEXT',
      'SOURCE_CLASS',
      'SOURCE_AUTHORITY_STATE',
      'FRESHNESS',
      'LIMITATIONS',
      'CONTRADICTION_STATE',
      'EXECUTOR_ATTRIBUTION_STATE'
    ],
    historicalAuthorization: {
      kind: 'NETWORK_VISIBILITY',
      networkParticipationId: 'network-participation_fixture-trust-616',
      participationVersion: 1,
      visibilityPolicyVersion: 1,
      visibilityAuthorizationReference: 'visibility:fixture-616',
      networkPurpose: 'PROVIDER_DISCOVERY',
      trustProjectionAuthorizationReference: 'trust-projection:fixture-616',
      evaluatedAt: now,
      currentAuthorityRevalidationRequiredBeforeServe: true
    },
    artifactAccessAuthorized: false,
    rawEvidenceDisclosureAuthorized: false,
    relationshipGraphDisclosureAuthorized: false,
    clientDataDisclosureAuthorized: false,
    commercialDataDisclosureAuthorized: false,
    currentAuthorityRevalidationRequiredBeforeServe: true,
    authorityConsequences: noTrustEvidenceAuthorityConsequences
  };
  const fingerprint = trustEvidenceVisibilityProjectionFingerprintV1(base);
  return {
    ...base,
    trustEvidenceVisibilityProjectionId: `trust-evidence-projection_${fingerprint}`,
    projectionFingerprintSha256: fingerprint,
    createdAt: now
  };
}

async function seed(service: OutcomeTrustEvidenceService, items: TrustEvidenceItemV1[]) {
  for (const item of items) await service.recordEvidenceItem(item);
  return service.recordVisibilityProjection(projection(items));
}

describe('OutcomeTrustEvidenceService Phase A', () => {
  it('keeps Provider Return evidence as a claim and never promotes it to verified outcome truth', async () => {
    const runtime = service();
    const item = providerClaimItem();
    const projected = await seed(runtime, [item]);
    const explanation = await runtime.explain(projected.trustEvidenceVisibilityProjectionId);

    expect(explanation.result).toBe('EVIDENCE_AVAILABLE');
    expect(explanation.limitations).toContainEqual(
      expect.objectContaining({ code: 'CLAIM_NOT_VERIFIED_OUTCOME' })
    );
    expect(item.source).toMatchObject({
      kind: 'PROVIDER_CLAIM',
      verifiedOutcomeEstablished: false,
      officialTruthEstablished: false
    });
    expect(explanation.universalScoreCreated).toBe(false);
    expect(explanation.rankCreated).toBe(false);
    expect(explanation.winnerCreated).toBe(false);
    expect(explanation.authorityConsequences).toEqual(noTrustEvidenceAuthorityConsequences);
  });

  it('keeps Payment lifecycle evidence commercial-only rather than performance truth', async () => {
    const runtime = service();
    const item = paymentItem();
    const projected = await seed(runtime, [item]);
    const explanation = await runtime.explain(projected.trustEvidenceVisibilityProjectionId);

    expect(explanation.limitations).toContainEqual(
      expect.objectContaining({ code: 'PAYMENT_IS_COMMERCIAL_FACT_ONLY' })
    );
    expect(item.source).toMatchObject({
      kind: 'CANONICAL_OWNER_FACT',
      factKind: 'PAYMENT_LIFECYCLE',
      performanceTruthEstablished: false,
      officialTruthEstablished: false
    });
  });

  it('treats no evidence as insufficient evidence rather than a negative Provider judgement', async () => {
    const runtime = service();
    const projected = await seed(runtime, []);
    const explanation = await runtime.explain(projected.trustEvidenceVisibilityProjectionId);

    expect(explanation.result).toBe('INSUFFICIENT_EVIDENCE');
    expect(explanation.evidenceItems).toEqual([]);
    expect(explanation.summary).toContain('no negative Provider inference');
  });

  it('keeps explicit contradictions visible without consensus averaging', async () => {
    const second = paymentItem();
    const first = providerClaimItem({
      contradictions: [
        {
          ...reference(second),
          contradictionReference: 'contradiction:fixture-616'
        }
      ]
    });
    const runtime = service();
    const projected = await seed(runtime, [first, second]);
    const explanation = await runtime.explain(projected.trustEvidenceVisibilityProjectionId);

    expect(explanation.result).toBe('CONTRADICTORY_EVIDENCE');
    expect(explanation.contradictions).toHaveLength(1);
    expect(explanation.summary).toContain('no consensus');
    expect(explanation.universalScoreCreated).toBe(false);
  });

  it('fails current bounded exposure closed for stale sources, inactive visibility and artifact retrieval', async () => {
    const staleRuntime = service();
    const stale = providerClaimItem({
      sourceAuthority: {
        sourceClass: 'PROVIDER_CLAIM',
        authorityState: 'STALE',
        checkedAt: now,
        currentSourceRevalidationRequiredBeforeUse: true,
        historicalSourceDoesNotEstablishCurrentSuitability: true,
        universalPerformanceInferenceAuthorized: false
      },
      freshness: {
        state: 'STALE',
        policyVersion: 'trust-freshness-v1',
        checkedAt: now,
        currentSuitabilityEstablished: false
      }
    });
    const staleProjection = await seed(staleRuntime, [stale]);
    await expect(
      staleRuntime.validateCurrentExposure(staleProjection.trustEvidenceVisibilityProjectionId)
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'SOURCE_NOT_CURRENT' });

    const hiddenRuntime = service(authority({ participationActive: false }));
    const currentProjection = await seed(hiddenRuntime, [providerClaimItem()]);
    await expect(
      hiddenRuntime.validateCurrentExposure(currentProjection.trustEvidenceVisibilityProjectionId)
    ).resolves.toMatchObject({ decision: 'DENY', reason: 'PARTICIPATION_NOT_ACTIVE' });

    await expect(
      hiddenRuntime.validateCurrentExposure(currentProjection.trustEvidenceVisibilityProjectionId, {
        artifactRetrievalRequested: true
      })
    ).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'ARTIFACT_AUTHORITY_NOT_ESTABLISHED',
      artifactAccessAuthorized: false
    });
  });

  it('revalidates exact current authority and authorizes only bounded advisory explanation', async () => {
    const runtime = service();
    const projected = await seed(runtime, [providerClaimItem()]);
    const validation = await runtime.validateCurrentExposure(
      projected.trustEvidenceVisibilityProjectionId
    );

    expect(validation).toMatchObject({
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION',
      providerId: outcomeTrustEvidenceFixtureProviderIdV1,
      artifactAccessAuthorized: false,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    });
  });
});
