import { describe, expect, it } from 'vitest';
import {
  noProviderDiscoveryAuthorityConsequences,
  providerDiscoveryContractFixtureV1
} from '../src/provider-discovery.js';
import { noTrustEvidenceAuthorityConsequences } from '../src/outcome-trust-evidence.js';
import {
  parseProviderDiscoveryTrustComparisonV1,
  parseProviderDiscoveryTrustContextIntentV1,
  parseProviderDiscoveryTrustRequestLinkV1,
  providerDiscoveryTrustComparisonFingerprintV1,
  providerDiscoveryTrustContextScopeFingerprintV1,
  providerDiscoveryTrustRequestFingerprintV1
} from '../src/provider-discovery-trust.js';

const discovery = providerDiscoveryContractFixtureV1.candidateResult;
const candidate = discovery.candidates[0];
const AT = discovery.evaluatedAt;
const CONTEXT_FP = 'a'.repeat(64);
const PROJECTION_FP = 'b'.repeat(64);
const EXPLANATION_FP = 'c'.repeat(64);
const ITEM_FP = 'd'.repeat(64);

function trustContext(overrides: Record<string, unknown> = {}) {
  const base = {
    contextReference: discovery.request.contextReference,
    jurisdiction: discovery.request.need.jurisdiction,
    serviceType: discovery.request.need.serviceType,
    taskType: 'TRADEMARK_APPLICATION_PREPARATION',
    collaborationScope: 'bounded-discovery-comparison:fixture-854',
    ...overrides
  };
  return {
    schemaVersion: 1,
    ...base,
    contextScopeFingerprintSha256: providerDiscoveryTrustContextScopeFingerprintV1(
      base as {
        contextReference: string;
        jurisdiction: string;
        serviceType: string;
        taskType: string;
        collaborationScope: string;
      }
    )
  };
}

function trustRequest() {
  const context = trustContext();
  const base = {
    providerDiscoveryRequestId: discovery.request.providerDiscoveryRequestId,
    requestFingerprintSha256: discovery.request.requestFingerprintSha256,
    context
  };
  return {
    schemaVersion: 1,
    ...base,
    trustRequestFingerprintSha256: providerDiscoveryTrustRequestFingerprintV1(base)
  };
}

function currentValidation() {
  return {
    schemaVersion: 1,
    decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION',
    providerId: candidate.providerId,
    purpose: 'PROVIDER_DISCOVERY_TRUST_EXPLANATION',
    contextFingerprintSha256: CONTEXT_FP,
    projection: {
      trustEvidenceVisibilityProjectionId: 'trust-evidence-projection_fixture-854',
      projectionFingerprintSha256: PROJECTION_FP
    },
    checkedAt: AT,
    artifactAccessAuthorized: false,
    authorityConsequences: noTrustEvidenceAuthorityConsequences,
    validatedEvidenceItems: [],
    authorityReferences: ['network-visibility:fixture-854']
  } as const;
}

function availableSupport() {
  return {
    schemaVersion: 1,
    providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
    providerId: candidate.providerId,
    trustRequestFingerprintSha256: trustRequest().trustRequestFingerprintSha256,
    contextFingerprintSha256: CONTEXT_FP,
    artifactAccessAuthorized: false,
    universalScoreCreated: false,
    rankCreated: false,
    winnerCreated: false,
    qualityJudgmentCreated: false,
    state: 'TRUST_EVIDENCE_AVAILABLE',
    visibilityProjection: {
      trustEvidenceVisibilityProjectionId: 'trust-evidence-projection_fixture-854',
      projectionFingerprintSha256: PROJECTION_FP
    },
    explanation: {
      trustExplanationId: 'trust-explanation_fixture-854',
      trustExplanationFingerprintSha256: EXPLANATION_FP,
      result: 'EVIDENCE_AVAILABLE'
    },
    currentExposureValidation: currentValidation(),
    evidenceSummaries: [
      {
        trustEvidenceItemId: 'trust-evidence-item_fixture-854',
        version: 1,
        trustEvidenceItemFingerprintSha256: ITEM_FP,
        sourceClass: 'PROVIDER_CLAIM',
        sourceAuthorityState: 'CURRENT',
        freshnessState: 'CURRENT_FOR_CONTEXT',
        lifecycleState: 'CURRENT',
        limitationCodes: ['CLAIM_NOT_VERIFIED_OUTCOME'],
        contradictionCount: 0,
        evidenceReferenceCount: 1,
        executorAttributionState: 'NOT_ESTABLISHED',
        artifactAccessAuthorized: false
      }
    ]
  } as const;
}

function comparisonFor(support: ReturnType<typeof availableSupport> | Record<string, unknown>) {
  const base = {
    schemaVersion: 1 as const,
    requested: true as const,
    request: trustRequest(),
    candidates: [support],
    artifactAccessAuthorized: false as const,
    universalScoreCreated: false as const,
    rankCreated: false as const,
    winnerCreated: false as const,
    authorityConsequences: noProviderDiscoveryAuthorityConsequences
  };
  return {
    ...base,
    generatedAt: AT,
    comparisonFingerprintSha256: providerDiscoveryTrustComparisonFingerprintV1(base)
  };
}

describe('Provider Discovery Trust decision-support contract', () => {
  it('binds exact Discovery request context without inferring missing task/collaboration scope', () => {
    const parsedContext = parseProviderDiscoveryTrustContextIntentV1(
      trustContext(),
      discovery.request
    );
    expect(parsedContext).toMatchObject({
      contextReference: discovery.request.contextReference,
      jurisdiction: 'US',
      serviceType: 'TRADEMARK_APPLICATION',
      taskType: 'TRADEMARK_APPLICATION_PREPARATION'
    });

    const parsedRequest = parseProviderDiscoveryTrustRequestLinkV1(
      trustRequest(),
      discovery.request
    );
    expect(parsedRequest.providerDiscoveryRequestId).toBe(
      discovery.request.providerDiscoveryRequestId
    );
    expect(parsedRequest.requestFingerprintSha256).toBe(discovery.request.requestFingerprintSha256);
  });

  it('rejects Trust context drift from the exact Discovery Need instead of guessing linkage', () => {
    const wrong = trustContext({ jurisdiction: 'EU' });
    expect(() => parseProviderDiscoveryTrustContextIntentV1(wrong, discovery.request)).toThrow(
      /jurisdiction must match/
    );
  });

  it('represents currently authorized contextual evidence without score/rank/winner authority', () => {
    const parsed = parseProviderDiscoveryTrustComparisonV1(
      comparisonFor(availableSupport()),
      discovery
    );
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]).toMatchObject({
      providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
      providerId: candidate.providerId,
      state: 'TRUST_EVIDENCE_AVAILABLE',
      artifactAccessAuthorized: false,
      universalScoreCreated: false,
      rankCreated: false,
      winnerCreated: false,
      qualityJudgmentCreated: false
    });
    const support = parsed.candidates[0];
    expect(support?.state).toBe('TRUST_EVIDENCE_AVAILABLE');
    if (support?.state !== 'TRUST_EVIDENCE_AVAILABLE') {
      throw new Error('fixture must be available');
    }
    expect(support.explanation.result).toBe('EVIDENCE_AVAILABLE');
    expect(parsed.authorityConsequences).toEqual(noProviderDiscoveryAuthorityConsequences);
  });

  it('keeps Provider Claim visibly attributable and artifact access denied', () => {
    const parsed = parseProviderDiscoveryTrustComparisonV1(
      comparisonFor(availableSupport()),
      discovery
    );
    const support = parsed.candidates[0];
    expect(support?.state).toBe('TRUST_EVIDENCE_AVAILABLE');
    if (support?.state !== 'TRUST_EVIDENCE_AVAILABLE') {
      throw new Error('fixture must be available');
    }
    expect(support.evidenceSummaries[0]).toMatchObject({
      sourceClass: 'PROVIDER_CLAIM',
      limitationCodes: ['CLAIM_NOT_VERIFIED_OUTCOME'],
      artifactAccessAuthorized: false
    });
  });

  it('represents unavailable Trust evidence as unknown, never a negative quality judgment', () => {
    const unavailable = {
      schemaVersion: 1,
      providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
      providerId: candidate.providerId,
      trustRequestFingerprintSha256: trustRequest().trustRequestFingerprintSha256,
      contextFingerprintSha256: CONTEXT_FP,
      artifactAccessAuthorized: false,
      universalScoreCreated: false,
      rankCreated: false,
      winnerCreated: false,
      qualityJudgmentCreated: false,
      state: 'TRUST_EVIDENCE_UNAVAILABLE',
      reason: 'NO_CURRENT_TRUST_PROJECTION',
      explanation: null,
      evidenceSummaries: []
    } as const;
    const parsed = parseProviderDiscoveryTrustComparisonV1(comparisonFor(unavailable), discovery);
    expect(parsed.candidates[0]).toMatchObject({
      state: 'TRUST_EVIDENCE_UNAVAILABLE',
      reason: 'NO_CURRENT_TRUST_PROJECTION',
      qualityJudgmentCreated: false,
      evidenceSummaries: []
    });
  });

  it('cannot substitute Trust evidence for another disclosed Provider/candidate', () => {
    const wrongProvider = {
      ...availableSupport(),
      providerId: 'provider_other-854'
    };
    expect(() =>
      parseProviderDiscoveryTrustComparisonV1(comparisonFor(wrongProvider), discovery)
    ).toThrow(/exact candidate Provider/);
  });

  it('rejects score/rank/winner fields instead of silently accepting ranking semantics', () => {
    const ranked = {
      ...availableSupport(),
      score: 94
    };
    expect(() => parseProviderDiscoveryTrustComparisonV1(comparisonFor(ranked), discovery)).toThrow(
      /unsupported fields/
    );
  });

  it('keeps existing non-Trust Provider Discovery fixtures backward compatible', () => {
    expect(discovery.status).toBe('CANDIDATES');
    expect(discovery.candidates[0]).not.toHaveProperty('trustDecisionSupport');
    expect(discovery.candidates[0]).not.toHaveProperty('rank');
    expect(discovery.candidates[0]).not.toHaveProperty('score');
    expect(discovery.candidates[0]).not.toHaveProperty('winner');
  });
});
