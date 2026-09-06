import { noProviderDiscoveryAuthorityConsequences } from '@markorbit/contracts/provider-discovery';
import {
  parseProviderDiscoveryTrustComparisonV1,
  parseProviderDiscoveryTrustRequestLinkV1,
  providerDiscoveryTrustComparisonFingerprintV1,
  type ProviderDiscoveryResultWithTrustDecisionSupportV1,
  type ProviderDiscoveryTrustDecisionSupportV1,
  type ProviderDiscoveryTrustEvidenceSummaryV1,
  type ProviderDiscoveryTrustRequestLinkV1,
  type ProviderDiscoveryTrustUnavailableReasonV1
} from '@markorbit/contracts/provider-discovery-trust';
import type {
  TrustEvidenceExposureDenialReasonV1,
  TrustEvidenceItemV1,
  TrustEvidenceVisibilityProjectionV1
} from '@markorbit/contracts/outcome-trust-evidence';
import type { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';
import type {
  OutcomeTrustEvidenceRepository,
  OutcomeTrustEvidenceService,
  TrustEvidenceDiscoveryContextLookup
} from './outcome-trust-evidence.js';

export type ProviderDiscoveryTrustEvaluationSource = Pick<
  ProviderDiscoveryCurrentResponsibilityService,
  'evaluate'
>;
export type ProviderDiscoveryTrustRepositorySource = Pick<
  OutcomeTrustEvidenceRepository,
  'findLatestDiscoveryProjectionForContext' | 'findEvidenceItem'
>;
export type ProviderDiscoveryTrustEvidenceSource = Pick<
  OutcomeTrustEvidenceService,
  'validateCurrentExposure' | 'explain'
>;

function exposureUnavailableReason(
  reason: TrustEvidenceExposureDenialReasonV1
): ProviderDiscoveryTrustUnavailableReasonV1 {
  if (reason === 'AUTHORITY_UNAVAILABLE') return 'CURRENT_TRUST_AUTHORITY_UNAVAILABLE';
  if (
    reason === 'SOURCE_NOT_CURRENT' ||
    reason === 'EVIDENCE_SUPERSEDED' ||
    reason === 'EVIDENCE_REVOKED' ||
    reason === 'EVIDENCE_DISPUTED'
  ) {
    return 'CURRENT_TRUST_SOURCE_UNAVAILABLE';
  }
  return 'CURRENT_TRUST_AUTHORITY_DENIED';
}

function evidenceSummary(
  item: Readonly<TrustEvidenceItemV1>
): Readonly<ProviderDiscoveryTrustEvidenceSummaryV1> {
  return {
    trustEvidenceItemId: item.trustEvidenceItemId,
    version: item.version,
    trustEvidenceItemFingerprintSha256: item.trustEvidenceItemFingerprintSha256,
    sourceClass: item.source.kind,
    sourceAuthorityState: item.sourceAuthority.authorityState,
    freshnessState: item.freshness.state,
    lifecycleState: item.lifecycleState,
    limitationCodes: [...new Set(item.limitations.map((limitation) => limitation.code))],
    contradictionCount: item.contradictions.length,
    evidenceReferenceCount: item.evidenceReferences.length,
    executorAttributionState: item.context.executorAttribution.state,
    artifactAccessAuthorized: false
  };
}

/**
 * Additive Phase-2 Trust composition over the already-governed Provider Discovery result.
 * Trust changes neither candidate inclusion nor ordering and grants no downstream action authority.
 */
export class ProviderDiscoveryTrustService {
  constructor(
    private readonly discovery: ProviderDiscoveryTrustEvaluationSource,
    private readonly repository: ProviderDiscoveryTrustRepositorySource,
    private readonly trustEvidence: ProviderDiscoveryTrustEvidenceSource
  ) {}

  evaluate(
    ...input: Parameters<ProviderDiscoveryTrustEvaluationSource['evaluate']>
  ): ReturnType<ProviderDiscoveryTrustEvaluationSource['evaluate']> {
    return this.discovery.evaluate(...input);
  }

  async evaluateWithTrust(
    principal: Parameters<ProviderDiscoveryTrustEvaluationSource['evaluate']>[0],
    request: Parameters<ProviderDiscoveryTrustEvaluationSource['evaluate']>[1],
    trustRequestValue: unknown
  ): Promise<ProviderDiscoveryResultWithTrustDecisionSupportV1> {
    const discoveryResult = await this.discovery.evaluate(principal, request);
    const trustRequest = parseProviderDiscoveryTrustRequestLinkV1(
      trustRequestValue,
      discoveryResult.request
    );
    const candidates: ProviderDiscoveryTrustDecisionSupportV1[] = [];
    if (discoveryResult.status === 'CANDIDATES') {
      for (const candidate of discoveryResult.candidates) {
        candidates.push(await this.supportCandidate(candidate, trustRequest));
      }
    }

    const base = {
      schemaVersion: 1 as const,
      requested: true as const,
      request: trustRequest,
      candidates,
      artifactAccessAuthorized: false as const,
      universalScoreCreated: false as const,
      rankCreated: false as const,
      winnerCreated: false as const,
      authorityConsequences: noProviderDiscoveryAuthorityConsequences
    };
    const comparison = parseProviderDiscoveryTrustComparisonV1(
      {
        ...base,
        generatedAt: discoveryResult.evaluatedAt,
        comparisonFingerprintSha256: providerDiscoveryTrustComparisonFingerprintV1(base)
      },
      discoveryResult
    );
    return { ...discoveryResult, trustDecisionSupport: comparison };
  }

  private unavailable(
    candidate: Readonly<{
      providerDiscoveryCandidateId: ProviderDiscoveryTrustDecisionSupportV1['providerDiscoveryCandidateId'];
      providerId: ProviderDiscoveryTrustDecisionSupportV1['providerId'];
    }>,
    request: Readonly<ProviderDiscoveryTrustRequestLinkV1>,
    reason: ProviderDiscoveryTrustUnavailableReasonV1,
    contextFingerprintSha256 = request.context.contextScopeFingerprintSha256
  ): ProviderDiscoveryTrustDecisionSupportV1 {
    return {
      schemaVersion: 1,
      state: 'TRUST_EVIDENCE_UNAVAILABLE',
      providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
      providerId: candidate.providerId,
      trustRequestFingerprintSha256: request.trustRequestFingerprintSha256,
      contextFingerprintSha256,
      reason,
      explanation: null,
      evidenceSummaries: [],
      artifactAccessAuthorized: false,
      universalScoreCreated: false,
      rankCreated: false,
      winnerCreated: false,
      qualityJudgmentCreated: false
    };
  }

  private async supportCandidate(
    candidate: Readonly<{
      providerDiscoveryCandidateId: ProviderDiscoveryTrustDecisionSupportV1['providerDiscoveryCandidateId'];
      providerId: ProviderDiscoveryTrustDecisionSupportV1['providerId'];
    }>,
    request: Readonly<ProviderDiscoveryTrustRequestLinkV1>
  ): Promise<ProviderDiscoveryTrustDecisionSupportV1> {
    const lookup: TrustEvidenceDiscoveryContextLookup = {
      providerId: candidate.providerId,
      contextReference: request.context.contextReference,
      jurisdiction: request.context.jurisdiction,
      serviceType: request.context.serviceType,
      taskType: request.context.taskType,
      collaborationScope: request.context.collaborationScope
    };

    let projection: Readonly<TrustEvidenceVisibilityProjectionV1> | undefined;
    try {
      projection = await this.repository.findLatestDiscoveryProjectionForContext(lookup);
    } catch {
      return this.unavailable(candidate, request, 'CURRENT_TRUST_SOURCE_UNAVAILABLE');
    }
    if (!projection) {
      return this.unavailable(candidate, request, 'NO_CURRENT_TRUST_PROJECTION');
    }

    let validation: Awaited<
      ReturnType<ProviderDiscoveryTrustEvidenceSource['validateCurrentExposure']>
    >;
    try {
      validation = await this.trustEvidence.validateCurrentExposure(
        projection.trustEvidenceVisibilityProjectionId
      );
    } catch {
      return this.unavailable(
        candidate,
        request,
        'CURRENT_TRUST_AUTHORITY_UNAVAILABLE',
        projection.contextFingerprintSha256
      );
    }
    if (validation.decision !== 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION') {
      return this.unavailable(
        candidate,
        request,
        exposureUnavailableReason(validation.reason),
        projection.contextFingerprintSha256
      );
    }

    try {
      const explanation = await this.trustEvidence.explain(
        projection.trustEvidenceVisibilityProjectionId
      );
      const items: TrustEvidenceItemV1[] = [];
      for (const reference of validation.validatedEvidenceItems) {
        const item = await this.repository.findEvidenceItem(reference);
        if (!item) {
          return this.unavailable(
            candidate,
            request,
            'CURRENT_TRUST_SOURCE_UNAVAILABLE',
            projection.contextFingerprintSha256
          );
        }
        items.push(item);
      }
      return {
        schemaVersion: 1,
        state: 'TRUST_EVIDENCE_AVAILABLE',
        providerDiscoveryCandidateId: candidate.providerDiscoveryCandidateId,
        providerId: candidate.providerId,
        trustRequestFingerprintSha256: request.trustRequestFingerprintSha256,
        contextFingerprintSha256: projection.contextFingerprintSha256,
        visibilityProjection: {
          trustEvidenceVisibilityProjectionId: projection.trustEvidenceVisibilityProjectionId,
          projectionFingerprintSha256: projection.projectionFingerprintSha256
        },
        explanation: {
          trustExplanationId: explanation.trustExplanationId,
          trustExplanationFingerprintSha256: explanation.trustExplanationFingerprintSha256,
          result: explanation.result
        },
        currentExposureValidation: validation,
        evidenceSummaries: items.map(evidenceSummary),
        artifactAccessAuthorized: false,
        universalScoreCreated: false,
        rankCreated: false,
        winnerCreated: false,
        qualityJudgmentCreated: false
      };
    } catch {
      return this.unavailable(
        candidate,
        request,
        'CURRENT_TRUST_SOURCE_UNAVAILABLE',
        projection.contextFingerprintSha256
      );
    }
  }
}
