import type {
  CurrentDiscoveryEvidenceReferenceV1,
  DiscoveryCurrentSourceVersionV1,
  ProviderDiscoveryCandidateV1,
  ProviderDiscoveryResultV1
} from '@markorbit/contracts/provider-discovery';
import type { ProviderDiscoveryService } from './provider-discovery.js';
import { providerDiscoveryFingerprint } from './provider-discovery.js';
import type { ProviderResponsibilityService } from './provider-responsibility.js';

export type ProviderDiscoveryEvaluationSource = Pick<ProviderDiscoveryService, 'evaluate'>;
export type ProviderDiscoveryResponsibilitySource = Pick<
  ProviderResponsibilityService,
  'assessCurrent'
>;

function evidenceReferencesAuthorized(candidate: Readonly<ProviderDiscoveryCandidateV1>): boolean {
  return candidate.authorizedProjection.fields.some(
    (field) =>
      field.dataClass === 'PROVIDER_EVIDENCE_REFERENCE' && field.field === 'evidenceReferences'
  );
}

function isPositiveDirectExecutorAssessment(
  assessment: Awaited<
    ReturnType<ProviderDiscoveryResponsibilitySource['assessCurrent']>
  >['assessment']
): assessment is NonNullable<
  Awaited<ReturnType<ProviderDiscoveryResponsibilitySource['assessCurrent']>>['assessment']
> {
  return Boolean(
    assessment?.directExecutorEstablished === true &&
      (assessment.state === 'DIRECT_FINAL_EXECUTOR_ESTABLISHED' ||
        assessment.state === 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED') &&
      assessment.profileAuthorityState === 'CURRENT' &&
      assessment.evidenceReferences.length > 0
  );
}

function responsibilitySourceVersion(
  assessment: NonNullable<
    Awaited<ReturnType<ProviderDiscoveryResponsibilitySource['assessCurrent']>>['assessment']
  >
): DiscoveryCurrentSourceVersionV1 {
  return {
    owner: 'MGSN',
    sourceType: 'PROVIDER_RESPONSIBILITY_PROFILE',
    sourceId: assessment.profile.providerResponsibilityProfileId,
    version: assessment.profile.version,
    fingerprintSha256: assessment.profile.profileFingerprintSha256,
    checkedAt: assessment.checkedAt,
    authorityState: 'CURRENT'
  };
}

function responsibilityEvidence(
  assessment: NonNullable<
    Awaited<ReturnType<ProviderDiscoveryResponsibilitySource['assessCurrent']>>['assessment']
  >,
  source: DiscoveryCurrentSourceVersionV1
): CurrentDiscoveryEvidenceReferenceV1[] {
  return assessment.evidenceReferences.map((evidenceReference) => ({
    evidenceReference,
    kind: 'DIRECT_EXECUTOR_DISCLOSURE',
    source,
    authorityClass: 'CANONICAL_OWNER_REFERENCE',
    artifactAccessAuthorized: false
  }));
}

function uniqueReferences(references: readonly string[]): string[] {
  return [...new Set(references)];
}

/**
 * Owner-local composition over Provider Discovery V1.
 *
 * The base Discovery evaluator deliberately remains fail-closed and candidate-only. This layer may
 * enrich a candidate with bounded Direct Executor evidence only when the canonical current Provider
 * Responsibility owner assessment is positive and evidence-reference projection was independently
 * authorized. It never turns the disclosure into Selection, Allocation, contact, Handoff, Filing,
 * Payment or Official Truth authority.
 */
export class ProviderDiscoveryCurrentResponsibilityService {
  constructor(
    private readonly discovery: ProviderDiscoveryEvaluationSource,
    private readonly responsibility: ProviderDiscoveryResponsibilitySource
  ) {}

  async evaluate(
    ...input: Parameters<ProviderDiscoveryEvaluationSource['evaluate']>
  ): Promise<ProviderDiscoveryResultV1> {
    const result = await this.discovery.evaluate(...input);
    if (result.status !== 'CANDIDATES') return result;

    const candidates: ProviderDiscoveryCandidateV1[] = [];
    for (const candidate of result.candidates)
      candidates.push(await this.enrichCandidate(candidate, result.evaluatedAt));

    const candidateTuple = candidates as [
      ProviderDiscoveryCandidateV1,
      ...ProviderDiscoveryCandidateV1[]
    ];
    return {
      ...result,
      candidates: candidateTuple,
      resultFingerprintSha256: providerDiscoveryFingerprint({
        requestFingerprintSha256: result.request.requestFingerprintSha256,
        evaluatedAt: result.evaluatedAt,
        status: 'CANDIDATES',
        candidates: candidateTuple.map((candidate) => ({
          providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
          candidateFingerprintSha256: candidate.candidateFingerprintSha256
        }))
      })
    };
  }

  private async enrichCandidate(
    candidate: Readonly<ProviderDiscoveryCandidateV1>,
    checkedAt: string
  ): Promise<ProviderDiscoveryCandidateV1> {
    if (!evidenceReferencesAuthorized(candidate)) return candidate;

    let assessmentResult: Awaited<
      ReturnType<ProviderDiscoveryResponsibilitySource['assessCurrent']>
    >;
    try {
      assessmentResult = await this.responsibility.assessCurrent(
        candidate.providerId,
        candidate.providerWorkspaceId,
        checkedAt
      );
    } catch {
      return candidate;
    }
    if (!isPositiveDirectExecutorAssessment(assessmentResult.assessment)) return candidate;

    const assessment = assessmentResult.assessment;
    const sourceVersion = responsibilitySourceVersion(assessment);
    const directExecutorEvidence = responsibilityEvidence(assessment, sourceVersion);
    const { candidateFingerprintSha256: _historicalFingerprint, ...historicalCandidate } =
      candidate;
    const withoutFingerprint = {
      ...historicalCandidate,
      suitabilityEvidence: [...candidate.suitabilityEvidence, ...directExecutorEvidence],
      directExecutorDisclosure: {
        state: 'INDEPENDENT_EVIDENCE_REFERENCED' as const,
        evidenceReferences: [...assessment.evidenceReferences],
        requiresIndependentCurrentVerification: true as const
      },
      sourceVersions: [...candidate.sourceVersions, sourceVersion],
      explanation: {
        ...candidate.explanation,
        evidenceReferences: uniqueReferences([
          ...candidate.explanation.evidenceReferences,
          ...assessment.evidenceReferences
        ]),
        limitations: candidate.explanation.limitations.filter(
          (limitation) => limitation.code !== 'DIRECT_EXECUTOR_NOT_ESTABLISHED'
        )
      }
    } satisfies Omit<ProviderDiscoveryCandidateV1, 'candidateFingerprintSha256'>;

    return {
      ...withoutFingerprint,
      candidateFingerprintSha256: providerDiscoveryFingerprint(withoutFingerprint)
    };
  }
}
