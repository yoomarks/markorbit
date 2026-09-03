import { describe, expect, it, vi } from 'vitest';
import {
  noProviderDiscoveryAuthorityConsequences,
  providerDiscoveryContractFixtureV1,
  type ProviderDiscoveryResultV1
} from '@markorbit/contracts/provider-discovery';
import {
  noProviderResponsibilityAuthorityConsequences,
  type ProviderDirectExecutorAssessmentV1
} from '@markorbit/contracts/provider-responsibility';
import {
  ProviderDiscoveryCurrentResponsibilityService,
  type ProviderDiscoveryEvaluationSource,
  type ProviderDiscoveryResponsibilitySource
} from '../src/provider-discovery-current-responsibility.js';

const fixture = () =>
  structuredClone(providerDiscoveryContractFixtureV1.candidateResult) as ProviderDiscoveryResultV1;

function discovery(result = fixture()): ProviderDiscoveryEvaluationSource {
  return {
    evaluate: vi.fn(() => Promise.resolve(structuredClone(result)))
  };
}

function positiveAssessment(
  state:
    | 'DIRECT_FINAL_EXECUTOR_ESTABLISHED'
    | 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED' = 'DIRECT_FINAL_EXECUTOR_ESTABLISHED'
): ProviderDirectExecutorAssessmentV1 {
  const candidateResult = fixture();
  if (candidateResult.status !== 'CANDIDATES') throw new Error('candidate fixture expected');
  const candidate = candidateResult.candidates[0];
  const common = {
    schemaVersion: 1 as const,
    provider: {
      providerId: candidate.providerId,
      providerWorkspaceId: candidate.providerWorkspaceId
    },
    profile: {
      providerResponsibilityProfileId: 'provider-responsibility_discovery-707',
      version: 4,
      profileFingerprintSha256: 'a'.repeat(64)
    },
    directExecutorEstablished: true as const,
    profileAuthorityState: 'CURRENT' as const,
    finalExecutionProviderId: candidate.providerId,
    finalExecutionProviderWorkspaceId: candidate.providerWorkspaceId,
    evidenceReferences: ['responsibility-evidence:independent-707'],
    checkedAt: candidateResult.evaluatedAt,
    assessmentPolicyVersion: 'mgsn-provider-responsibility-v1',
    hiddenIntermediaryAllowed: false as const,
    currentAuthorityRevalidationRequiredBeforeUse: true as const,
    authorityConsequences: noProviderResponsibilityAuthorityConsequences,
    assessmentFingerprintSha256: 'b'.repeat(64)
  };
  return state === 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED'
    ? {
        ...common,
        state,
        legallyRequiredDistinctSigner: {
          kind: 'REQUIRED',
          distinctSignerRequired: true,
          signerReference: 'signer:transparent-707',
          signerIdentityAuthorityReference: 'authority:signer-identity-707',
          legalBasisReference: 'legal-basis:signer-707',
          jurisdiction: 'US',
          function: 'SIGNING_OR_FILING_ONLY',
          transparentlyDisclosed: true,
          receivesHandoffDataByDefault: false,
          doesNotReplaceFinalExecutionProvider: true
        }
      }
    : {
        ...common,
        state,
        legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false }
      };
}

function responsibility(
  result: Awaited<ReturnType<ProviderDiscoveryResponsibilitySource['assessCurrent']>> | Error
): ProviderDiscoveryResponsibilitySource {
  return {
    assessCurrent: vi.fn((_providerId, _providerWorkspaceId, _checkedAt) =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
    )
  };
}

async function evaluate(
  currentResponsibility: ProviderDiscoveryResponsibilitySource,
  currentDiscovery = discovery()
) {
  const source = fixture();
  return new ProviderDiscoveryCurrentResponsibilityService(
    currentDiscovery,
    currentResponsibility
  ).evaluate(
    {
      workspaceId: source.request.requesterWorkspaceId,
      actorId: 'user_discovery_707'
    },
    source.request
  );
}

describe('MGSN P0 #707 Provider Discovery current responsibility composition', () => {
  it('keeps UNKNOWN/UNPROVEN candidate semantics when no current responsibility profile exists', async () => {
    const result = await evaluate(
      responsibility({ state: 'UNKNOWN_OR_UNPROVEN', assessment: null })
    );
    expect(result).toEqual(fixture());
  });

  it('fails closed for responsibility source failure without removing the candidate or leaking details', async () => {
    const result = await evaluate(responsibility(new Error('private responsibility failure: secret')));
    expect(result).toEqual(fixture());
    expect(JSON.stringify(result)).not.toContain('private responsibility failure');
  });

  it('maps current independently verified Direct Executor evidence into the authorized candidate', async () => {
    const assessment = positiveAssessment();
    const currentResponsibility = responsibility({ state: assessment.state, assessment });
    const result = await evaluate(currentResponsibility);
    if (result.status !== 'CANDIDATES') throw new Error('candidate expected');
    const candidate = result.candidates[0];

    expect(currentResponsibility.assessCurrent).toHaveBeenCalledWith(
      candidate.providerId,
      candidate.providerWorkspaceId,
      result.evaluatedAt
    );
    expect(candidate.directExecutorDisclosure).toEqual({
      state: 'INDEPENDENT_EVIDENCE_REFERENCED',
      evidenceReferences: ['responsibility-evidence:independent-707'],
      requiresIndependentCurrentVerification: true
    });
    expect(candidate.sourceVersions).toContainEqual({
      owner: 'MGSN',
      sourceType: 'PROVIDER_RESPONSIBILITY_PROFILE',
      sourceId: 'provider-responsibility_discovery-707',
      version: 4,
      fingerprintSha256: 'a'.repeat(64),
      checkedAt: result.evaluatedAt,
      authorityState: 'CURRENT'
    });
    expect(candidate.suitabilityEvidence).toContainEqual(
      expect.objectContaining({
        evidenceReference: 'responsibility-evidence:independent-707',
        kind: 'DIRECT_EXECUTOR_DISCLOSURE',
        authorityClass: 'CANONICAL_OWNER_REFERENCE',
        artifactAccessAuthorized: false
      })
    );
    expect(candidate.explanation.evidenceReferences).toContain(
      'responsibility-evidence:independent-707'
    );
    expect(candidate.explanation.limitations.map((item) => item.code)).not.toContain(
      'DIRECT_EXECUTOR_NOT_ESTABLISHED'
    );
    expect(candidate.explanation.limitations.map((item) => item.code)).toContain(
      'CURRENT_VISIBILITY_REVALIDATION_REQUIRED'
    );
    expect(candidate.explanation.limitations.map((item) => item.code)).toContain(
      'EVIDENCE_ARTIFACT_RETRIEVAL_NOT_AUTHORIZED'
    );
    expect(candidate.explanation.limitations.map((item) => item.code)).toContain(
      'NO_BOUNDED_AVAILABILITY_SIGNAL'
    );
    expect(candidate.candidateFingerprintSha256).not.toBe('7'.repeat(64));
    expect(result.resultFingerprintSha256).not.toBe('3'.repeat(64));
    expect(Object.values(candidate.authorityConsequences)).toEqual(
      Object.values(noProviderDiscoveryAuthorityConsequences)
    );
    expect(Object.values(candidate.authorityConsequences).every((value) => value === false)).toBe(
      true
    );
  });

  it('preserves Provider attribution for the transparent legally-required signer positive case', async () => {
    const assessment = positiveAssessment('DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED');
    const result = await evaluate(responsibility({ state: assessment.state, assessment }));
    if (result.status !== 'CANDIDATES') throw new Error('candidate expected');
    const serialized = JSON.stringify(result);
    expect(result.candidates[0].directExecutorDisclosure.state).toBe(
      'INDEPENDENT_EVIDENCE_REFERENCED'
    );
    expect(result.candidates[0].providerId).toBe(assessment.finalExecutionProviderId);
    expect(serialized).not.toContain('signer:transparent-707');
    expect(serialized).not.toContain('SIGNING_OR_FILING_ONLY');
  });

  it('does not expose positive responsibility proof when evidence-reference projection is not authorized', async () => {
    const base = fixture();
    if (base.status !== 'CANDIDATES') throw new Error('candidate expected');
    const candidate = base.candidates[0];
    const withoutEvidenceProjection: ProviderDiscoveryResultV1 = {
      ...base,
      candidates: [
        {
          ...candidate,
          authorizedProjection: {
            ...candidate.authorizedProjection,
            fields: candidate.authorizedProjection.fields.filter(
              (field) => field.dataClass !== 'PROVIDER_EVIDENCE_REFERENCE'
            )
          }
        }
      ]
    };
    const assessment = positiveAssessment();
    const currentResponsibility = responsibility({ state: assessment.state, assessment });
    const result = await evaluate(currentResponsibility, discovery(withoutEvidenceProjection));
    if (result.status !== 'CANDIDATES') throw new Error('candidate expected');
    expect(result.candidates[0].directExecutorDisclosure.state).toBe('UNPROVEN');
    expect(result.candidates[0].explanation.limitations.map((item) => item.code)).toContain(
      'DIRECT_EXECUTOR_NOT_ESTABLISHED'
    );
    expect(currentResponsibility.assessCurrent).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('responsibility-evidence:independent-707');
  });

  it('is deterministic for the exact Discovery result and current responsibility assessment', async () => {
    const assessment = positiveAssessment();
    const first = await evaluate(responsibility({ state: assessment.state, assessment }));
    const second = await evaluate(responsibility({ state: assessment.state, assessment }));
    expect(second).toEqual(first);
  });
});
