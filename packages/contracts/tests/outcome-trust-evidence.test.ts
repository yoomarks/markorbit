import { describe, expect, it } from 'vitest';
import {
  noTrustEvidenceAuthorityConsequences,
  outcomeTrustEvidenceFixtureAtV1,
  outcomeTrustEvidenceFixtureContextV1,
  outcomeTrustEvidenceFixtureProviderIdV1,
  parseOutcomeEvidenceReferenceV1,
  parseOutcomeObservationReferenceV1,
  parseTrustEvidenceCurrentExposureValidationV1,
  parseTrustEvidenceItemV1,
  parseTrustEvidenceVisibilityProjectionV1,
  parseTrustExplanationV1,
  trustEvidenceItemFingerprintV1,
  trustEvidenceVisibilityProjectionFingerprintV1,
  trustExplanationFingerprintV1,
  type TrustEvidenceItemReferenceV1
} from '../src/outcome-trust-evidence.js';

const AT = outcomeTrustEvidenceFixtureAtV1;
const PROVIDER = outcomeTrustEvidenceFixtureProviderIdV1;
const CONTEXT_FP = outcomeTrustEvidenceFixtureContextV1.contextFingerprintSha256;
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_D = 'd'.repeat(64);

function evidenceReference(overrides: Record<string, unknown> = {}) {
  return {
    evidenceReference: 'evidence:fixture-439',
    sourceOwner: 'MGSN',
    sourceType: 'PROVIDER_RETURN_REFERENCE',
    sourceId: 'provider-return_fixture-439',
    sourceVersion: 1,
    sourceFingerprintSha256: SHA_A,
    recordedAt: AT,
    authorityState: 'CURRENT',
    checkedAt: AT,
    artifactAccessAuthorized: false,
    currentArtifactAuthorizationRequired: true,
    ...overrides
  };
}

function claimSource(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'PROVIDER_CLAIM',
    owner: 'MGSN',
    providerReturnId: 'provider-return_fixture-439',
    providerReturnVersion: 1,
    providerReturnFingerprintSha256: SHA_B,
    providerReturnStatus: 'CURRENT',
    claimKind: 'WORK_STATUS_CLAIM',
    claimReference: 'provider-return-claim:work-status',
    submittedAt: AT,
    verifiedOutcomeEstablished: false,
    officialTruthEstablished: false,
    ...overrides
  };
}

function ownerFactSource(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'CANONICAL_OWNER_FACT',
    owner: 'EXECUTION',
    factKind: 'EXECUTION_EVIDENCE_REVIEW',
    sourceId: 'evidence-review-decision_fixture-439',
    sourceVersion: 2,
    sourceFingerprintSha256: SHA_C,
    recordedAt: AT,
    performanceTruthEstablished: false,
    officialTruthEstablished: false,
    ...overrides
  };
}

function sourceAuthority(sourceClass: string, overrides: Record<string, unknown> = {}) {
  return {
    sourceClass,
    authorityState: 'CURRENT',
    checkedAt: AT,
    currentSourceRevalidationRequiredBeforeUse: true,
    historicalSourceDoesNotEstablishCurrentSuitability: true,
    universalPerformanceInferenceAuthorized: false,
    ...overrides
  };
}

function freshness(overrides: Record<string, unknown> = {}) {
  return {
    state: 'CURRENT_FOR_CONTEXT',
    policyVersion: 'trust-freshness-v1',
    checkedAt: AT,
    currentSuitabilityEstablished: false,
    ...overrides
  };
}

function claimItem(overrides: Record<string, unknown> = {}) {
  const source = claimSource();
  const base = {
    schemaVersion: 1 as const,
    version: 1,
    providerId: PROVIDER,
    lifecycleState: 'CURRENT' as const,
    context: outcomeTrustEvidenceFixtureContextV1,
    source,
    sourceAuthority: sourceAuthority('PROVIDER_CLAIM'),
    evidenceReferences: [evidenceReference()],
    freshness: freshness(),
    lineage: [],
    contradictions: [],
    limitations: [
      {
        code: 'CLAIM_NOT_VERIFIED_OUTCOME',
        explanation: 'Provider-submitted work status remains a claim.'
      }
    ],
    currentExposureAuthorizationRequired: true as const,
    authorityConsequences: noTrustEvidenceAuthorityConsequences,
    ...overrides
  };
  const trustEvidenceItemFingerprintSha256 = trustEvidenceItemFingerprintV1(base as never);
  return {
    ...base,
    trustEvidenceItemId: `trust-evidence-item_${trustEvidenceItemFingerprintSha256}`,
    trustEvidenceItemFingerprintSha256,
    createdAt: AT
  };
}

function ownerFactItem(overrides: Record<string, unknown> = {}) {
  const source = ownerFactSource();
  const base = {
    schemaVersion: 1 as const,
    version: 1,
    providerId: PROVIDER,
    lifecycleState: 'CURRENT' as const,
    context: outcomeTrustEvidenceFixtureContextV1,
    source,
    sourceAuthority: sourceAuthority('CANONICAL_OWNER_FACT'),
    evidenceReferences: [evidenceReference({ sourceOwner: 'EXECUTION' })],
    freshness: freshness(),
    lineage: [],
    contradictions: [],
    limitations: [
      {
        code: 'INTERNAL_REVIEW_ONLY',
        explanation: 'Execution review proves only the internal evidence-review decision.'
      }
    ],
    currentExposureAuthorizationRequired: true as const,
    authorityConsequences: noTrustEvidenceAuthorityConsequences,
    ...overrides
  };
  const trustEvidenceItemFingerprintSha256 = trustEvidenceItemFingerprintV1(base as never);
  return {
    ...base,
    trustEvidenceItemId: `trust-evidence-item_${trustEvidenceItemFingerprintSha256}`,
    trustEvidenceItemFingerprintSha256,
    createdAt: AT
  };
}

function itemReference(item = claimItem()): TrustEvidenceItemReferenceV1 {
  return {
    trustEvidenceItemId: item.trustEvidenceItemId as TrustEvidenceItemReferenceV1['trustEvidenceItemId'],
    version: item.version,
    trustEvidenceItemFingerprintSha256: item.trustEvidenceItemFingerprintSha256
  };
}

function projection(overrides: Record<string, unknown> = {}) {
  const evidenceItems = [itemReference()];
  const base = {
    schemaVersion: 1 as const,
    providerId: PROVIDER,
    purpose: 'PROVIDER_DISCOVERY_TRUST_EXPLANATION' as const,
    audience: { kind: 'BOUNDED_NETWORK' as const },
    contextFingerprintSha256: CONTEXT_FP,
    evidenceItems,
    projectedFields: [
      'CONTEXT',
      'SOURCE_CLASS',
      'SOURCE_AUTHORITY_STATE',
      'FRESHNESS',
      'LIMITATIONS',
      'EVIDENCE_REFERENCE_COUNT',
      'CONTRADICTION_STATE',
      'EXECUTOR_ATTRIBUTION_STATE'
    ] as const,
    historicalAuthorization: {
      kind: 'NETWORK_VISIBILITY' as const,
      networkParticipationId: 'network-participation_fixture-439',
      participationVersion: 3,
      visibilityPolicyVersion: 2,
      visibilityAuthorizationReference: 'visibility-authorization:fixture-439',
      networkPurpose: 'PROVIDER_DISCOVERY' as const,
      trustProjectionAuthorizationReference: 'trust-projection-authorization:fixture-439',
      evaluatedAt: AT,
      currentAuthorityRevalidationRequiredBeforeServe: true as const
    },
    artifactAccessAuthorized: false as const,
    rawEvidenceDisclosureAuthorized: false as const,
    relationshipGraphDisclosureAuthorized: false as const,
    clientDataDisclosureAuthorized: false as const,
    commercialDataDisclosureAuthorized: false as const,
    currentAuthorityRevalidationRequiredBeforeServe: true as const,
    authorityConsequences: noTrustEvidenceAuthorityConsequences,
    ...overrides
  };
  const projectionFingerprintSha256 = trustEvidenceVisibilityProjectionFingerprintV1(base as never);
  return {
    ...base,
    trustEvidenceVisibilityProjectionId: `trust-evidence-projection_${projectionFingerprintSha256}`,
    projectionFingerprintSha256,
    createdAt: AT
  };
}

function explanation(overrides: Record<string, unknown> = {}) {
  const visible = projection();
  const base = {
    schemaVersion: 1 as const,
    providerId: PROVIDER,
    contextFingerprintSha256: CONTEXT_FP,
    result: 'EVIDENCE_AVAILABLE' as const,
    evidenceItems: [itemReference()],
    contradictions: [],
    limitations: [
      {
        code: 'CURRENT_VISIBILITY_REVALIDATION_REQUIRED',
        explanation: 'Historical projection authorization is not current serve permission.'
      }
    ],
    summary: 'Attributable evidence exists for this bounded context; it is not a universal Provider score.',
    visibilityProjection: {
      trustEvidenceVisibilityProjectionId: visible.trustEvidenceVisibilityProjectionId,
      projectionFingerprintSha256: visible.projectionFingerprintSha256
    },
    currentExposureValidationRequiredBeforeServe: true as const,
    universalScoreCreated: false as const,
    rankCreated: false as const,
    winnerCreated: false as const,
    authorityConsequences: noTrustEvidenceAuthorityConsequences,
    ...overrides
  };
  const trustExplanationFingerprintSha256 = trustExplanationFingerprintV1(base as never);
  return {
    ...base,
    trustExplanationId: `trust-explanation_${trustExplanationFingerprintSha256}`,
    trustExplanationFingerprintSha256,
    createdAt: AT
  };
}

describe('Outcome & Trust Evidence V1 shared contract', () => {
  it('keeps Provider Return work status as an attributable claim rather than verified outcome truth', () => {
    const parsed = parseTrustEvidenceItemV1(claimItem());
    expect(parsed.source.kind).toBe('PROVIDER_CLAIM');
    if (parsed.source.kind !== 'PROVIDER_CLAIM') throw new Error('expected claim source');
    expect(parsed.source.verifiedOutcomeEstablished).toBe(false);
    expect(parsed.source.officialTruthEstablished).toBe(false);
    expect(parsed.authorityConsequences.officialTruthCreated).toBe(false);
    expect(parsed.authorityConsequences.matterCompleted).toBe(false);
  });

  it('does not allow raw Provider claim values to leak into generic Trust Evidence', () => {
    const item = claimItem({ source: claimSource({ claimValue: 'WORK_COMPLETED' }) });
    expect(() => parseTrustEvidenceItemV1(item)).toThrow(/unsupported fields/u);
  });

  it('admits only audited narrow owner fact kinds and rejects operational/verification/payment-amount shortcuts', () => {
    expect(parseTrustEvidenceItemV1(ownerFactItem()).source.kind).toBe('CANONICAL_OWNER_FACT');
    for (const factKind of ['PROVIDER_OPERATIONAL_STATUS', 'SUPPLY_VERIFICATION_STATE', 'ELIGIBILITY', 'PAYMENT_AMOUNT']) {
      const item = ownerFactItem({
        source: ownerFactSource({ owner: factKind === 'PAYMENT_AMOUNT' ? 'PAYMENT' : 'MGSN', factKind })
      });
      expect(() => parseTrustEvidenceItemV1(item)).toThrow(/factKind|own/u);
    }
  });

  it('keeps Payment lifecycle as commercial owner fact only and forbids performance promotion', () => {
    const source = ownerFactSource({
      owner: 'PAYMENT',
      factKind: 'PAYMENT_LIFECYCLE',
      sourceId: 'payment_payment-fixture-439',
      performanceTruthEstablished: false
    });
    const parsed = parseTrustEvidenceItemV1(
      ownerFactItem({
        source,
        sourceAuthority: sourceAuthority('CANONICAL_OWNER_FACT'),
        limitations: [
          {
            code: 'PAYMENT_IS_COMMERCIAL_FACT_ONLY',
            explanation: 'Payment success does not establish professional performance.'
          }
        ]
      })
    );
    expect(parsed.source.kind).toBe('CANONICAL_OWNER_FACT');
    expect(parsed.authorityConsequences.paymentAuthorizedByTrustEvidence).toBe(false);
    const promoted = ownerFactItem({ source: { ...source, performanceTruthEstablished: true } });
    expect(() => parseTrustEvidenceItemV1(promoted)).toThrow(/must be false/u);
  });

  it('keeps evidence reference visibility separate from artifact retrieval authority', () => {
    const parsed = parseOutcomeEvidenceReferenceV1(evidenceReference());
    expect(parsed.artifactAccessAuthorized).toBe(false);
    expect(parsed.currentArtifactAuthorizationRequired).toBe(true);
    expect(() =>
      parseOutcomeEvidenceReferenceV1(evidenceReference({ artifactAccessAuthorized: true }))
    ).toThrow(/must be false/u);
  });

  it('represents future observations with exact observer authority and dispute lineage without public-review or Official Truth promotion', () => {
    const observation = parseOutcomeObservationReferenceV1({
      schemaVersion: 1,
      outcomeObservationId: 'outcome-observation_fixture-439',
      observationOwner: 'ORIGINATING_WORKSPACE',
      observerReference: 'observer:fixture-439',
      observerAuthorityReference: 'observer-authority:fixture-439',
      providerId: PROVIDER,
      contextFingerprintSha256: CONTEXT_FP,
      observationType: 'BOUNDED_COLLABORATION_OBSERVATION',
      version: 2,
      observationFingerprintSha256: SHA_D,
      lifecycleState: 'DISPUTED',
      observedAt: AT,
      evidenceReferences: [evidenceReference()],
      publicReviewCreated: false,
      officialTruthCreated: false
    });
    expect(observation.lifecycleState).toBe('DISPUTED');
    expect(observation.publicReviewCreated).toBe(false);
    expect(observation.officialTruthCreated).toBe(false);
  });

  it('rejects client, relationship and commercial fields from the contextual Trust item', () => {
    for (const [field, value] of [
      ['customerId', 'customer_private'],
      ['clientEmail', 'private@example.com'],
      ['originatingWorkspaceId', 'workspace_private'],
      ['marginMinor', 5000],
      ['partnerRelationshipGraph', ['workspace_private']]
    ] as const) {
      const item = claimItem({ context: { ...outcomeTrustEvidenceFixtureContextV1, [field]: value } });
      expect(() => parseTrustEvidenceItemV1(item)).toThrow(/unsupported fields/u);
    }
  });

  it('keeps missing Direct-to-Executor proof UNKNOWN/fail-closed and rejects positive attribution without a positive #375 state', () => {
    const parsed = parseTrustEvidenceItemV1(claimItem());
    expect(parsed.context.executorAttribution.state).toBe('NOT_ESTABLISHED');
    const invalidExecutor = {
      state: 'ESTABLISHED',
      assessmentState: 'REBROKERING_OR_SUBAGENT_DISCLOSED',
      assessmentReference: 'provider-responsibility-assessment:fixture-439',
      assessmentFingerprintSha256: SHA_A,
      profile: {
        providerResponsibilityProfileId: 'provider-responsibility_fixture-439',
        version: 1,
        profileFingerprintSha256: SHA_B
      },
      finalExecutionProviderId: PROVIDER,
      checkedAt: AT,
      currentAuthorityRevalidationRequiredBeforeUse: true
    };
    const item = claimItem({
      context: { ...outcomeTrustEvidenceFixtureContextV1, executorAttribution: invalidExecutor }
    });
    expect(() => parseTrustEvidenceItemV1(item)).toThrow(/positive #375/u);
  });

  it('does not present stale or unavailable owner evidence as current for context', () => {
    const stale = claimItem({
      sourceAuthority: sourceAuthority('PROVIDER_CLAIM', { authorityState: 'STALE' }),
      freshness: freshness({ state: 'STALE' })
    });
    expect(parseTrustEvidenceItemV1(stale).freshness.state).toBe('STALE');
    const falselyCurrent = claimItem({
      sourceAuthority: sourceAuthority('PROVIDER_CLAIM', { authorityState: 'STALE' }),
      freshness: freshness({ state: 'CURRENT_FOR_CONTEXT' })
    });
    expect(() => parseTrustEvidenceItemV1(falselyCurrent)).toThrow(/requires CURRENT/u);
    const unavailable = claimItem({
      sourceAuthority: sourceAuthority('PROVIDER_CLAIM', { authorityState: 'UNAVAILABLE' }),
      freshness: freshness({ state: 'SOURCE_UNAVAILABLE' })
    });
    expect(parseTrustEvidenceItemV1(unavailable).freshness.state).toBe('SOURCE_UNAVAILABLE');
  });

  it('preserves superseded claim history and requires exact superseded Provider Return lineage', () => {
    const old = claimItem({
      lifecycleState: 'SUPERSEDED',
      source: claimSource({ providerReturnStatus: 'SUPERSEDED' }),
      freshness: freshness({ state: 'STALE' })
    });
    expect(parseTrustEvidenceItemV1(old).lifecycleState).toBe('SUPERSEDED');
    const inconsistent = claimItem({ lifecycleState: 'SUPERSEDED' });
    expect(() => parseTrustEvidenceItemV1(inconsistent)).toThrow(/SUPERSEDED Provider Claim/u);
  });

  it('preserves correction/dispute/contradiction references without averaging them into consensus', () => {
    const left = claimItem();
    const right = ownerFactItem();
    const disputed = claimItem({
      lifecycleState: 'DISPUTED',
      lineage: [
        {
          ...itemReference(left),
          relation: 'DISPUTES'
        }
      ],
      contradictions: [
        {
          ...itemReference(right),
          contradictionReference: 'contradiction:fixture-439'
        }
      ],
      limitations: [
        {
          code: 'CONTRADICTORY_EVIDENCE',
          explanation: 'Attributable sources disagree; no consensus is invented.'
        }
      ]
    });
    const parsed = parseTrustEvidenceItemV1(disputed);
    expect(parsed.lifecycleState).toBe('DISPUTED');
    expect(parsed.contradictions).toHaveLength(1);
    expect(parsed.authorityConsequences.providerSelected).toBe(false);
  });

  it('creates only a bounded visibility projection and requires a separate Trust authorization plus current revalidation', () => {
    const parsed = parseTrustEvidenceVisibilityProjectionV1(projection());
    expect(parsed.historicalAuthorization.kind).toBe('NETWORK_VISIBILITY');
    expect(parsed.currentAuthorityRevalidationRequiredBeforeServe).toBe(true);
    expect(parsed.artifactAccessAuthorized).toBe(false);
    expect(parsed.rawEvidenceDisclosureAuthorized).toBe(false);
    expect(parsed.relationshipGraphDisclosureAuthorized).toBe(false);
    expect(parsed.clientDataDisclosureAuthorized).toBe(false);
    expect(parsed.commercialDataDisclosureAuthorized).toBe(false);

    const legacyOnly = projection({
      historicalAuthorization: {
        kind: 'OWNER_OR_RELATIONSHIP_AUTHORITY',
        authorityReference: 'old-visibility-only',
        authorityVersion: 1,
        authorityFingerprintSha256: SHA_A,
        evaluatedAt: AT,
        currentAuthorityRevalidationRequiredBeforeServe: true
      }
    });
    expect(() => parseTrustEvidenceVisibilityProjectionV1(legacyOnly)).toThrow(/requires Network Visibility provenance/u);
  });

  it('fails closed when current visibility or relationship authority is no longer valid', () => {
    const visible = parseTrustEvidenceVisibilityProjectionV1(projection());
    const denied = parseTrustEvidenceCurrentExposureValidationV1({
      schemaVersion: 1,
      decision: 'DENY',
      providerId: PROVIDER,
      purpose: visible.purpose,
      contextFingerprintSha256: CONTEXT_FP,
      projection: {
        trustEvidenceVisibilityProjectionId: visible.trustEvidenceVisibilityProjectionId,
        projectionFingerprintSha256: visible.projectionFingerprintSha256
      },
      reason: 'VISIBILITY_NOT_AUTHORIZED',
      checkedAt: AT,
      artifactAccessAuthorized: false,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    });
    expect(denied.decision).toBe('DENY');
    expect(denied.artifactAccessAuthorized).toBe(false);
  });

  it('requires current authority references for a positive bounded-explanation exposure validation', () => {
    const visible = parseTrustEvidenceVisibilityProjectionV1(projection());
    const candidate = {
      schemaVersion: 1,
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION',
      providerId: PROVIDER,
      purpose: visible.purpose,
      contextFingerprintSha256: CONTEXT_FP,
      projection: {
        trustEvidenceVisibilityProjectionId: visible.trustEvidenceVisibilityProjectionId,
        projectionFingerprintSha256: visible.projectionFingerprintSha256
      },
      validatedEvidenceItems: visible.evidenceItems,
      authorityReferences: ['current-network-visibility:fixture-439', 'current-trust-projection:fixture-439'],
      checkedAt: AT,
      artifactAccessAuthorized: false,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    };
    const allowed = parseTrustEvidenceCurrentExposureValidationV1(candidate);
    expect(allowed.decision).toBe('AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION');
    expect(() =>
      parseTrustEvidenceCurrentExposureValidationV1({ ...candidate, authorityReferences: [] })
    ).toThrow(/requires current authority references/u);
  });

  it('represents lack of evidence as INSUFFICIENT rather than a negative Provider score', () => {
    const visible = projection({ evidenceItems: [] });
    const base = {
      schemaVersion: 1 as const,
      providerId: PROVIDER,
      contextFingerprintSha256: CONTEXT_FP,
      result: 'INSUFFICIENT_EVIDENCE' as const,
      evidenceItems: [],
      contradictions: [],
      limitations: [
        {
          code: 'INSUFFICIENT_EVIDENCE',
          explanation: 'No attributable evidence is currently available for this context.'
        }
      ],
      summary: 'Evidence is insufficient; this is not a low rating or disqualification.',
      visibilityProjection: {
        trustEvidenceVisibilityProjectionId: visible.trustEvidenceVisibilityProjectionId,
        projectionFingerprintSha256: visible.projectionFingerprintSha256
      },
      currentExposureValidationRequiredBeforeServe: true as const,
      universalScoreCreated: false as const,
      rankCreated: false as const,
      winnerCreated: false as const,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    };
    const fp = trustExplanationFingerprintV1(base as never);
    const parsed = parseTrustExplanationV1({
      ...base,
      trustExplanationId: `trust-explanation_${fp}`,
      trustExplanationFingerprintSha256: fp,
      createdAt: AT
    });
    expect(parsed.result).toBe('INSUFFICIENT_EVIDENCE');
    expect(parsed.evidenceItems).toHaveLength(0);
    expect(parsed.universalScoreCreated).toBe(false);
    expect(parsed.rankCreated).toBe(false);
    expect(parsed.winnerCreated).toBe(false);
  });

  it('requires explicit contradictory item references and never creates a consensus/winner', () => {
    const left = claimItem();
    const right = ownerFactItem();
    const visible = projection({ evidenceItems: [itemReference(left), itemReference(right)] });
    const base = {
      schemaVersion: 1 as const,
      providerId: PROVIDER,
      contextFingerprintSha256: CONTEXT_FP,
      result: 'CONTRADICTORY_EVIDENCE' as const,
      evidenceItems: [itemReference(left), itemReference(right)],
      contradictions: [
        {
          left: itemReference(left),
          right: itemReference(right),
          explanation: 'The Provider claim and owner review record do not establish one consensus outcome.'
        }
      ],
      limitations: [
        {
          code: 'CONTRADICTORY_EVIDENCE',
          explanation: 'Contradiction is preserved and explained.'
        }
      ],
      summary: 'Sources disagree; no averaging, score or winner is produced.',
      visibilityProjection: {
        trustEvidenceVisibilityProjectionId: visible.trustEvidenceVisibilityProjectionId,
        projectionFingerprintSha256: visible.projectionFingerprintSha256
      },
      currentExposureValidationRequiredBeforeServe: true as const,
      universalScoreCreated: false as const,
      rankCreated: false as const,
      winnerCreated: false as const,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    };
    const fp = trustExplanationFingerprintV1(base as never);
    const parsed = parseTrustExplanationV1({
      ...base,
      trustExplanationId: `trust-explanation_${fp}`,
      trustExplanationFingerprintSha256: fp,
      createdAt: AT
    });
    expect(parsed.result).toBe('CONTRADICTORY_EVIDENCE');
    expect(parsed.contradictions).toHaveLength(1);
    expect(parsed.winnerCreated).toBe(false);
  });

  it('rejects score/rank/winner fields and any authority escalation by exact-key and frozen consequence rules', () => {
    expect(() => parseTrustEvidenceItemV1({ ...claimItem(), trustScore: 98 })).toThrow(/unsupported fields/u);
    expect(() => parseTrustEvidenceVisibilityProjectionV1({ ...projection(), rank: 1 })).toThrow(/unsupported fields/u);
    expect(() => parseTrustExplanationV1({ ...explanation(), winnerProviderId: PROVIDER })).toThrow(/unsupported fields/u);
    expect(() =>
      parseTrustEvidenceItemV1({
        ...claimItem(),
        authorityConsequences: {
          ...noTrustEvidenceAuthorityConsequences,
          providerSelected: true
        }
      })
    ).toThrow(/no-downstream-authority/u);
  });

  it('rejects tampered Trust Evidence, projection and explanation fingerprints', () => {
    expect(() =>
      parseTrustEvidenceItemV1({ ...claimItem(), trustEvidenceItemFingerprintSha256: SHA_A })
    ).toThrow(/fingerprint/u);
    expect(() =>
      parseTrustEvidenceVisibilityProjectionV1({ ...projection(), projectionFingerprintSha256: SHA_B })
    ).toThrow(/fingerprint/u);
    expect(() =>
      parseTrustExplanationV1({ ...explanation(), trustExplanationFingerprintSha256: SHA_C })
    ).toThrow(/fingerprint/u);
  });
});
