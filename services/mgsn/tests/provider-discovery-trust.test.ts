import { describe, expect, it, vi } from 'vitest';
import {
  providerDiscoveryContractFixtureV1,
  type ProviderDiscoveryResultV1
} from '@markorbit/contracts/provider-discovery';
import {
  providerDiscoveryTrustContextScopeFingerprintV1,
  providerDiscoveryTrustRequestFingerprintV1,
  type ProviderDiscoveryTrustRequestLinkV1
} from '@markorbit/contracts/provider-discovery-trust';
import {
  noTrustEvidenceAuthorityConsequences,
  trustEvidenceItemFingerprintV1,
  trustEvidenceVisibilityProjectionFingerprintV1,
  type TrustEvidenceFreshnessStateV1,
  type TrustEvidenceItemV1,
  type TrustEvidenceSourceAuthorityStateV1,
  type TrustEvidenceVisibilityProjectionV1
} from '@markorbit/contracts/outcome-trust-evidence';
import {
  InMemoryOutcomeTrustEvidenceRepository,
  OutcomeTrustEvidenceService,
  type TrustEvidenceCurrentAuthoritySnapshot
} from '../src/outcome-trust-evidence.js';
import {
  ProviderDiscoveryTrustService,
  type ProviderDiscoveryTrustEvaluationSource
} from '../src/provider-discovery-trust.js';

const resultFixture = () =>
  structuredClone(providerDiscoveryContractFixtureV1.candidateResult) as ProviderDiscoveryResultV1;
const hash = (digit: string) => digit.repeat(64);

function discovery(result = resultFixture()): ProviderDiscoveryTrustEvaluationSource {
  return { evaluate: vi.fn(() => Promise.resolve(structuredClone(result))) };
}

function trustRequest(result = resultFixture()): ProviderDiscoveryTrustRequestLinkV1 {
  const contextBase = {
    contextReference: result.request.contextReference,
    jurisdiction: result.request.need.jurisdiction,
    serviceType: result.request.need.serviceType,
    taskType: 'EVIDENCE_PREPARATION',
    collaborationScope: 'bounded-work-package:phase2-841'
  };
  const context = {
    schemaVersion: 1 as const,
    ...contextBase,
    contextScopeFingerprintSha256: providerDiscoveryTrustContextScopeFingerprintV1(contextBase)
  };
  const requestBase = {
    providerDiscoveryRequestId: result.request.providerDiscoveryRequestId,
    requestFingerprintSha256: result.request.requestFingerprintSha256,
    context
  };
  return {
    schemaVersion: 1,
    ...requestBase,
    trustRequestFingerprintSha256: providerDiscoveryTrustRequestFingerprintV1(requestBase)
  };
}

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
    authorityReferences: ['authority:trust:phase2-841'],
    ...overrides
  };
}

function item(
  request: ProviderDiscoveryTrustRequestLinkV1,
  providerId: TrustEvidenceItemV1['providerId'],
  sourceAuthorityState: TrustEvidenceSourceAuthorityStateV1 = 'CURRENT',
  freshnessState: TrustEvidenceFreshnessStateV1 = 'CURRENT_FOR_CONTEXT'
): TrustEvidenceItemV1 {
  const now = resultFixture().evaluatedAt;
  const base: Omit<
    TrustEvidenceItemV1,
    'trustEvidenceItemId' | 'trustEvidenceItemFingerprintSha256' | 'createdAt'
  > = {
    schemaVersion: 1,
    version: 1,
    providerId,
    lifecycleState: 'CURRENT',
    context: {
      providerId,
      contextReference: request.context.contextReference,
      contextFingerprintSha256: hash('8'),
      jurisdiction: request.context.jurisdiction,
      serviceType: request.context.serviceType,
      taskType: request.context.taskType,
      collaborationScope: request.context.collaborationScope,
      executorAttribution: {
        state: 'NOT_ESTABLISHED',
        assessmentState: 'UNKNOWN_OR_UNPROVEN',
        finalExecutionProviderId: null,
        checkedAt: now,
        currentAuthorityRevalidationRequiredBeforeUse: true
      },
      clientIdentityEmbedded: false,
      relationshipIdentityEmbedded: false,
      commercialDataEmbedded: false
    },
    source: {
      kind: 'PROVIDER_CLAIM',
      owner: 'MGSN',
      providerReturnId: 'provider-return_phase2-841',
      providerReturnVersion: 1,
      providerReturnFingerprintSha256: hash('1'),
      providerReturnStatus: 'CURRENT',
      claimKind: 'STRUCTURED_ASSERTION',
      claimReference: 'provider-claim:phase2-841',
      submittedAt: now,
      verifiedOutcomeEstablished: false,
      officialTruthEstablished: false
    },
    sourceAuthority: {
      sourceClass: 'PROVIDER_CLAIM',
      authorityState: sourceAuthorityState,
      checkedAt: now,
      currentSourceRevalidationRequiredBeforeUse: true,
      historicalSourceDoesNotEstablishCurrentSuitability: true,
      universalPerformanceInferenceAuthorized: false
    },
    evidenceReferences: [],
    freshness: {
      state: freshnessState,
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

function projection(item: TrustEvidenceItemV1): TrustEvidenceVisibilityProjectionV1 {
  const now = resultFixture().evaluatedAt;
  const base: Omit<
    TrustEvidenceVisibilityProjectionV1,
    'trustEvidenceVisibilityProjectionId' | 'projectionFingerprintSha256' | 'createdAt'
  > = {
    schemaVersion: 1,
    providerId: item.providerId,
    purpose: 'PROVIDER_DISCOVERY_TRUST_EXPLANATION',
    audience: { kind: 'BOUNDED_NETWORK' },
    contextFingerprintSha256: item.context.contextFingerprintSha256,
    evidenceItems: [
      {
        trustEvidenceItemId: item.trustEvidenceItemId,
        version: item.version,
        trustEvidenceItemFingerprintSha256: item.trustEvidenceItemFingerprintSha256
      }
    ],
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
      networkParticipationId: 'network-participation_phase2-841',
      participationVersion: 1,
      visibilityPolicyVersion: 1,
      visibilityAuthorizationReference: 'visibility:phase2-841',
      networkPurpose: 'PROVIDER_DISCOVERY',
      trustProjectionAuthorizationReference: 'trust-projection:phase2-841',
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

function harness(currentAuthority: TrustEvidenceCurrentAuthoritySnapshot = authority()) {
  const result = resultFixture();
  if (result.status !== 'CANDIDATES') throw new Error('candidate fixture expected');
  const request = trustRequest(result);
  const repository = new InMemoryOutcomeTrustEvidenceRepository();
  const trustEvidence = new OutcomeTrustEvidenceService(
    repository,
    { evaluateCurrentAuthority: () => Promise.resolve(currentAuthority) },
    () => result.evaluatedAt
  );
  const runtime = new ProviderDiscoveryTrustService(discovery(result), repository, trustEvidence);
  const principal = {
    workspaceId: result.request.requesterWorkspaceId,
    actorId: 'user_phase2_841'
  };
  return { result, request, repository, trustEvidence, runtime, principal };
}

async function seed(
  context: Awaited<ReturnType<typeof harness>>,
  sourceAuthorityState: TrustEvidenceSourceAuthorityStateV1 = 'CURRENT',
  freshnessState: TrustEvidenceFreshnessStateV1 = 'CURRENT_FOR_CONTEXT'
) {
  if (context.result.status !== 'CANDIDATES') throw new Error('candidate fixture expected');
  const evidence = item(
    context.request,
    context.result.candidates[0].providerId,
    sourceAuthorityState,
    freshnessState
  );
  const projected = projection(evidence);
  await context.trustEvidence.recordEvidenceItem(evidence);
  await context.trustEvidence.recordVisibilityProjection(projected);
  return { evidence, projected };
}

describe('MGSN P0 #841 Trust-aware Provider Discovery composition', () => {
  it('adds exact current Trust evidence without ranking, quality judgment or downstream authority', async () => {
    const context = harness();
    const seeded = await seed(context);
    const output = await context.runtime.evaluateWithTrust(
      context.principal,
      context.result.request,
      context.request
    );
    if (output.status !== 'CANDIDATES') throw new Error('candidate expected');
    const support = output.trustDecisionSupport.candidates[0];

    expect(support).toMatchObject({
      state: 'TRUST_EVIDENCE_AVAILABLE',
      providerDiscoveryCandidateId: output.candidates[0].providerDiscoveryCandidateId,
      providerId: output.candidates[0].providerId,
      contextFingerprintSha256: seeded.projected.contextFingerprintSha256,
      artifactAccessAuthorized: false,
      universalScoreCreated: false,
      rankCreated: false,
      winnerCreated: false,
      qualityJudgmentCreated: false
    });
    if (!support || support.state !== 'TRUST_EVIDENCE_AVAILABLE')
      throw new Error('Trust evidence expected');
    expect(support.currentExposureValidation).toMatchObject({
      decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION'
    });
    expect(support.evidenceSummaries).toHaveLength(1);
    expect(support.evidenceSummaries[0]).toMatchObject({
      sourceClass: 'PROVIDER_CLAIM',
      executorAttributionState: 'NOT_ESTABLISHED',
      artifactAccessAuthorized: false
    });
    expect(output.trustDecisionSupport.candidates.map((entry) => entry.providerId)).toEqual(
      output.candidates.map((candidate) => candidate.providerId)
    );
    expect(Object.values(output.trustDecisionSupport.authorityConsequences).every(Boolean)).toBe(
      false
    );
  });

  it('treats no exact contextual projection as unknown rather than a negative quality judgment', async () => {
    const context = harness();
    const output = await context.runtime.evaluateWithTrust(
      context.principal,
      context.result.request,
      context.request
    );
    const support = output.trustDecisionSupport.candidates[0];
    expect(support).toMatchObject({
      state: 'TRUST_EVIDENCE_UNAVAILABLE',
      reason: 'NO_CURRENT_TRUST_PROJECTION',
      contextFingerprintSha256: context.request.context.contextScopeFingerprintSha256,
      explanation: null,
      evidenceSummaries: [],
      qualityJudgmentCreated: false
    });
  });

  it('maps unavailable current authority without exposing or inferring private authority detail', async () => {
    const context = harness(authority({ authorityAvailable: false }));
    await seed(context);
    const output = await context.runtime.evaluateWithTrust(
      context.principal,
      context.result.request,
      context.request
    );
    expect(output.trustDecisionSupport.candidates[0]).toMatchObject({
      state: 'TRUST_EVIDENCE_UNAVAILABLE',
      reason: 'CURRENT_TRUST_AUTHORITY_UNAVAILABLE',
      qualityJudgmentCreated: false
    });
  });

  it('maps stale canonical Trust source to source unavailable rather than poor Provider quality', async () => {
    const context = harness();
    await seed(context, 'STALE', 'STALE');
    const output = await context.runtime.evaluateWithTrust(
      context.principal,
      context.result.request,
      context.request
    );
    expect(output.trustDecisionSupport.candidates[0]).toMatchObject({
      state: 'TRUST_EVIDENCE_UNAVAILABLE',
      reason: 'CURRENT_TRUST_SOURCE_UNAVAILABLE',
      qualityJudgmentCreated: false
    });
  });

  it('matches only exact canonical context fields and never guesses an Outcome context fingerprint', async () => {
    const context = harness();
    const seeded = await seed(context);
    await expect(
      context.repository.findLatestDiscoveryProjectionForContext({
        providerId: seeded.evidence.providerId,
        contextReference: context.request.context.contextReference,
        jurisdiction: context.request.context.jurisdiction,
        serviceType: context.request.context.serviceType,
        taskType: 'DIFFERENT_TASK',
        collaborationScope: context.request.context.collaborationScope
      })
    ).resolves.toBeUndefined();
  });

  it('rejects malformed Trust request linkage before creating decision support', async () => {
    const context = harness();
    await expect(
      context.runtime.evaluateWithTrust(context.principal, context.result.request, {
        ...context.request,
        trustRequestFingerprintSha256: hash('f')
      })
    ).rejects.toThrow(/Trust request fingerprint/u);
  });
});
