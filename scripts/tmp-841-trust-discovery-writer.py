from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one target, found {count}')
    target.write_text(text.replace(old, new, 1))


replace_once(
    'services/mgsn/src/outcome-trust-evidence.ts',
    "export interface OutcomeTrustEvidenceRepository {\n",
    "export interface TrustEvidenceDiscoveryContextLookup {\n  providerId: TrustEvidenceItemV1['providerId'];\n  contextReference: string;\n  jurisdiction: string;\n  serviceType: string;\n  taskType: string;\n  collaborationScope: string;\n}\n\nexport interface OutcomeTrustEvidenceRepository {\n",
)
replace_once(
    'services/mgsn/src/outcome-trust-evidence.ts',
    "  findProjection(\n    projectionId: TrustEvidenceVisibilityProjectionIdV1\n  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined>;\n",
    "  findProjection(\n    projectionId: TrustEvidenceVisibilityProjectionIdV1\n  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined>;\n  findLatestDiscoveryProjectionForContext(\n    input: Readonly<TrustEvidenceDiscoveryContextLookup>\n  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined>;\n",
)
replace_once(
    'services/mgsn/src/outcome-trust-evidence.ts',
    "  findProjection(\n    projectionId: TrustEvidenceVisibilityProjectionIdV1\n  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined> {\n    return Promise.resolve(clone(this.projections.get(projectionId)));\n  }\n\n  putExplanation",
    "  findProjection(\n    projectionId: TrustEvidenceVisibilityProjectionIdV1\n  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined> {\n    return Promise.resolve(clone(this.projections.get(projectionId)));\n  }\n\n  findLatestDiscoveryProjectionForContext(\n    input: Readonly<TrustEvidenceDiscoveryContextLookup>\n  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined> {\n    const exactContextFingerprints = new Set(\n      [...this.items.values()]\n        .filter(\n          (item) =>\n            item.providerId === input.providerId &&\n            item.context.contextReference === input.contextReference &&\n            item.context.jurisdiction === input.jurisdiction &&\n            item.context.serviceType === input.serviceType &&\n            item.context.taskType === input.taskType &&\n            item.context.collaborationScope === input.collaborationScope\n        )\n        .map((item) => item.context.contextFingerprintSha256)\n    );\n    if (exactContextFingerprints.size === 0) return Promise.resolve(undefined);\n    const projection = [...this.projections.values()]\n      .filter(\n        (candidate) =>\n          candidate.providerId === input.providerId &&\n          candidate.purpose === 'PROVIDER_DISCOVERY_TRUST_EXPLANATION' &&\n          exactContextFingerprints.has(candidate.contextFingerprintSha256)\n      )\n      .sort(\n        (left, right) =>\n          right.createdAt.localeCompare(left.createdAt) ||\n          right.trustEvidenceVisibilityProjectionId.localeCompare(\n            left.trustEvidenceVisibilityProjectionId\n          )\n      )[0];\n    return Promise.resolve(clone(projection));\n  }\n\n  putExplanation",
)

replace_once(
    'services/mgsn/src/outcome-trust-evidence-postgres.ts',
    "  type OutcomeTrustEvidenceRepository\n} from './outcome-trust-evidence.js';",
    "  type OutcomeTrustEvidenceRepository,\n  type TrustEvidenceDiscoveryContextLookup\n} from './outcome-trust-evidence.js';",
)
replace_once(
    'services/mgsn/src/outcome-trust-evidence-postgres.ts',
    "  async putExplanation(value: Readonly<TrustExplanationV1>): Promise<void> {",
    "  async findLatestDiscoveryProjectionForContext(\n    input: Readonly<TrustEvidenceDiscoveryContextLookup>\n  ): Promise<Readonly<TrustEvidenceVisibilityProjectionV1> | undefined> {\n    try {\n      const result = await this.query.query(\n        `SELECT projection.*\n         FROM mgsn_trust_evidence_visibility_projections projection\n         WHERE projection.provider_id=$1\n           AND projection.purpose='PROVIDER_DISCOVERY_TRUST_EXPLANATION'\n           AND EXISTS (\n             SELECT 1\n             FROM mgsn_trust_evidence_items item\n             WHERE item.provider_id=projection.provider_id\n               AND item.context_fingerprint_sha256=projection.context_fingerprint_sha256\n               AND item.item_record #>> '{context,contextReference}'=$2\n               AND item.item_record #>> '{context,jurisdiction}'=$3\n               AND item.item_record #>> '{context,serviceType}'=$4\n               AND item.item_record #>> '{context,taskType}'=$5\n               AND item.item_record #>> '{context,collaborationScope}'=$6\n           )\n         ORDER BY projection.created_at DESC,\n                  projection.trust_evidence_visibility_projection_id DESC\n         LIMIT 1`,\n        [\n          input.providerId,\n          input.contextReference,\n          input.jurisdiction,\n          input.serviceType,\n          input.taskType,\n          input.collaborationScope\n        ]\n      );\n      return result.rows[0] ? this.projectionFromRow(result.rows[0] as Row) : undefined;\n    } catch (cause) {\n      throw unavailable(cause);\n    }\n  }\n\n  async putExplanation(value: Readonly<TrustExplanationV1>): Promise<void> {",
)

Path('services/mgsn/src/provider-discovery-trust.ts').write_text("""import { noProviderDiscoveryAuthorityConsequences } from '@markorbit/contracts/provider-discovery';
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

    let validation: Awaited<ReturnType<ProviderDiscoveryTrustEvidenceSource['validateCurrentExposure']>>;
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
""")

replace_once(
    'services/mgsn/src/durable-runtime.ts',
    "import { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';\n",
    "import { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';\nimport { ProviderDiscoveryTrustService } from './provider-discovery-trust.js';\n",
)
replace_once(
    'services/mgsn/src/durable-runtime.ts',
    "  providerDiscovery: ProviderDiscoveryCurrentResponsibilityService;\n",
    "  providerDiscovery: ProviderDiscoveryTrustService;\n",
)
replace_once(
    'services/mgsn/src/durable-runtime.ts',
    "  const governedAllocation = new GovernedAllocationService(\n",
    "  const outcomeTrustEvidence = new OutcomeTrustEvidenceService(\n    outcomeTrustEvidenceRepository,\n    options.trustEvidenceCurrentAuthoritySource ?? trustEvidenceCurrentAuthority\n  );\n  const currentProviderDiscovery = new ProviderDiscoveryCurrentResponsibilityService(\n    new ProviderDiscoveryService(providerDiscoveryRepository),\n    providerResponsibility\n  );\n  const providerDiscovery = new ProviderDiscoveryTrustService(\n    currentProviderDiscovery,\n    outcomeTrustEvidenceRepository,\n    outcomeTrustEvidence\n  );\n  const governedAllocation = new GovernedAllocationService(\n",
)
replace_once(
    'services/mgsn/src/durable-runtime.ts',
    "    providerDiscovery: new ProviderDiscoveryCurrentResponsibilityService(\n      new ProviderDiscoveryService(providerDiscoveryRepository),\n      providerResponsibility\n    ),\n",
    "    providerDiscovery,\n",
)
replace_once(
    'services/mgsn/src/durable-runtime.ts',
    "    outcomeTrustEvidence: new OutcomeTrustEvidenceService(\n      outcomeTrustEvidenceRepository,\n      options.trustEvidenceCurrentAuthoritySource ?? trustEvidenceCurrentAuthority\n    ),\n",
    "    outcomeTrustEvidence,\n",
)

Path('services/mgsn/tests/provider-discovery-trust.test.ts').write_text("""import { describe, expect, it, vi } from 'vitest';
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

async function harness(
  currentAuthority: TrustEvidenceCurrentAuthoritySnapshot = authority()
) {
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
    const context = await harness();
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
    if (support.state !== 'TRUST_EVIDENCE_AVAILABLE') throw new Error('Trust evidence expected');
    expect(support.currentExposureValidation.decision).toBe(
      'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION'
    );
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
    const context = await harness();
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
    const context = await harness(authority({ authorityAvailable: false }));
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
    const context = await harness();
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
    const context = await harness();
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
    const context = await harness();
    await expect(
      context.runtime.evaluateWithTrust(context.principal, context.result.request, {
        ...context.request,
        trustRequestFingerprintSha256: hash('f')
      })
    ).rejects.toThrow(/Trust request fingerprint/u);
  });
});
""")

replace_once(
    'services/mgsn/tests/outcome-trust-evidence-postgres.test.ts',
    "  it('rejects divergent immutable writes and all append-only UPDATE/DELETE mutation attempts', async () => {",
    "  it('resolves Discovery Trust projection only from exact canonical context fields', async () => {\n    const runtime = service();\n    const item = providerClaimItem();\n    const projected = projection([item]);\n    await runtime.recordEvidenceItem(item);\n    await runtime.recordVisibilityProjection(projected);\n\n    const exact = {\n      providerId: item.providerId,\n      contextReference: item.context.contextReference,\n      jurisdiction: item.context.jurisdiction,\n      serviceType: item.context.serviceType,\n      taskType: item.context.taskType,\n      collaborationScope: item.context.collaborationScope\n    };\n    await expect(repository().findLatestDiscoveryProjectionForContext(exact)).resolves.toEqual(\n      projected\n    );\n    await expect(\n      repository().findLatestDiscoveryProjectionForContext({ ...exact, taskType: 'DIFFERENT_TASK' })\n    ).resolves.toBeUndefined();\n  });\n\n  it('rejects divergent immutable writes and all append-only UPDATE/DELETE mutation attempts', async () => {",
)
