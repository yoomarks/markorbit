import { createHash } from 'node:crypto';
import {
  noProviderDiscoveryAuthorityConsequences,
  type ProviderDiscoveryCandidateId,
  type ProviderDiscoveryRequestReferenceV1,
  type ProviderDiscoveryResultV1
} from './provider-discovery.js';
import type { ProviderId } from './provider-execution.js';
import {
  parseTrustEvidenceCurrentExposureValidationV1,
  trustEvidenceFreshnessStates,
  trustEvidenceLifecycleStates,
  trustEvidenceLimitationCodes,
  trustEvidenceSourceAuthorityStates,
  trustExplanationResults,
  type TrustEvidenceCurrentExposureValidationV1,
  type TrustEvidenceFreshnessStateV1,
  type TrustEvidenceLifecycleStateV1,
  type TrustEvidenceLimitationCodeV1,
  type TrustEvidenceSourceAuthorityStateV1,
  type TrustEvidenceSourceReferenceV1,
  type TrustEvidenceVisibilityProjectionIdV1,
  type TrustExplanationIdV1,
  type TrustExplanationResultV1
} from './outcome-trust-evidence.js';

/**
 * Additive Phase-2 decision support for Provider Discovery. The underlying Discovery result remains
 * candidate-only and this contract never creates Selection, Allocation, Acceptance or other authority.
 */
export interface ProviderDiscoveryTrustContextIntentV1 {
  schemaVersion: 1;
  contextReference: string;
  jurisdiction: string;
  serviceType: string;
  taskType: string;
  collaborationScope: string;
  contextScopeFingerprintSha256: string;
}

export interface ProviderDiscoveryTrustRequestLinkV1 {
  schemaVersion: 1;
  providerDiscoveryRequestId: ProviderDiscoveryRequestReferenceV1['providerDiscoveryRequestId'];
  requestFingerprintSha256: string;
  context: Readonly<ProviderDiscoveryTrustContextIntentV1>;
  trustRequestFingerprintSha256: string;
}

export interface ProviderDiscoveryTrustEvidenceSummaryV1 {
  trustEvidenceItemId: `trust-evidence-item_${string}`;
  version: number;
  trustEvidenceItemFingerprintSha256: string;
  sourceClass: TrustEvidenceSourceReferenceV1['kind'];
  sourceAuthorityState: TrustEvidenceSourceAuthorityStateV1;
  freshnessState: TrustEvidenceFreshnessStateV1;
  lifecycleState: TrustEvidenceLifecycleStateV1;
  limitationCodes: readonly TrustEvidenceLimitationCodeV1[];
  contradictionCount: number;
  evidenceReferenceCount: number;
  executorAttributionState: 'ESTABLISHED' | 'NOT_ESTABLISHED';
  artifactAccessAuthorized: false;
}

export const providerDiscoveryTrustUnavailableReasons = [
  'NO_CURRENT_TRUST_PROJECTION',
  'CURRENT_TRUST_AUTHORITY_DENIED',
  'CURRENT_TRUST_AUTHORITY_UNAVAILABLE',
  'CURRENT_TRUST_SOURCE_UNAVAILABLE'
] as const;
export type ProviderDiscoveryTrustUnavailableReasonV1 =
  (typeof providerDiscoveryTrustUnavailableReasons)[number];

interface ProviderDiscoveryTrustDecisionSupportBaseV1 {
  schemaVersion: 1;
  providerDiscoveryCandidateId: ProviderDiscoveryCandidateId;
  providerId: ProviderId;
  trustRequestFingerprintSha256: string;
  contextFingerprintSha256: string;
  artifactAccessAuthorized: false;
  universalScoreCreated: false;
  rankCreated: false;
  winnerCreated: false;
  qualityJudgmentCreated: false;
}

export type ProviderDiscoveryTrustDecisionSupportV1 = Readonly<
  ProviderDiscoveryTrustDecisionSupportBaseV1 &
    (
      | {
          state: 'TRUST_EVIDENCE_AVAILABLE';
          visibilityProjection: Readonly<{
            trustEvidenceVisibilityProjectionId: TrustEvidenceVisibilityProjectionIdV1;
            projectionFingerprintSha256: string;
          }>;
          explanation: Readonly<{
            trustExplanationId: TrustExplanationIdV1;
            trustExplanationFingerprintSha256: string;
            result: TrustExplanationResultV1;
          }>;
          currentExposureValidation: Extract<
            TrustEvidenceCurrentExposureValidationV1,
            { decision: 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION' }
          >;
          evidenceSummaries: ReadonlyArray<Readonly<ProviderDiscoveryTrustEvidenceSummaryV1>>;
        }
      | {
          state: 'TRUST_EVIDENCE_UNAVAILABLE';
          reason: ProviderDiscoveryTrustUnavailableReasonV1;
          explanation: null;
          evidenceSummaries: readonly [];
        }
    )
>;

export interface ProviderDiscoveryTrustComparisonV1 {
  schemaVersion: 1;
  requested: true;
  request: Readonly<ProviderDiscoveryTrustRequestLinkV1>;
  candidates: ReadonlyArray<Readonly<ProviderDiscoveryTrustDecisionSupportV1>>;
  generatedAt: string;
  comparisonFingerprintSha256: string;
  artifactAccessAuthorized: false;
  universalScoreCreated: false;
  rankCreated: false;
  winnerCreated: false;
  authorityConsequences: Readonly<typeof noProviderDiscoveryAuthorityConsequences>;
}

export type ProviderDiscoveryResultWithTrustDecisionSupportV1 = Readonly<
  ProviderDiscoveryResultV1 & {
    trustDecisionSupport: Readonly<ProviderDiscoveryTrustComparisonV1>;
  }
>;

export class ProviderDiscoveryTrustContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderDiscoveryTrustContractError';
  }
}

type RecordValue = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/u;
const SOURCE_CLASSES = new Set<string>([
  'CANONICAL_OWNER_FACT',
  'PROVIDER_CLAIM',
  'AUTHORIZED_OUTCOME_OBSERVATION'
]);
const SOURCE_AUTHORITY_STATES = new Set<string>(trustEvidenceSourceAuthorityStates);
const FRESHNESS_STATES = new Set<string>(trustEvidenceFreshnessStates);
const LIFECYCLE_STATES = new Set<string>(trustEvidenceLifecycleStates);
const LIMITATION_CODES = new Set<string>(trustEvidenceLimitationCodes);
const EXPLANATION_RESULTS = new Set<string>(trustExplanationResults);
const UNAVAILABLE_REASONS = new Set<string>(providerDiscoveryTrustUnavailableReasons);

function invalid(message: string): never {
  throw new ProviderDiscoveryTrustContractError(message);
}

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(`${field} must be an object.`);
  }
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[], field: string): void {
  const accepted = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !accepted.has(key));
  if (unknown.length) invalid(`${field} contains unsupported fields: ${unknown.join(', ')}.`);
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    return invalid(`${field} must contain between 1 and ${maximum} characters.`);
  }
  return cleaned;
}

function sha256(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned)) return invalid(`${field} must be a lowercase SHA-256 digest.`);
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    return invalid(`${field} must be a positive integer.`);
  }
  return Number(value);
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    return invalid(`${field} must be a non-negative integer.`);
  }
  return Number(value);
}

function falseOnly(value: unknown, field: string): false {
  if (value !== false) return invalid(`${field} must be false.`);
  return false;
}

function trueOnly(value: unknown, field: string): true {
  if (value !== true) return invalid(`${field} must be true.`);
  return true;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function providerId(value: unknown, field: string): ProviderId {
  const cleaned = text(value, field, 300);
  if (!cleaned.startsWith('provider_') || cleaned === 'provider_') {
    return invalid(`${field} must be a Provider identifier.`);
  }
  return cleaned as ProviderId;
}

function candidateId(value: unknown): ProviderDiscoveryCandidateId {
  const cleaned = text(value, 'trustDecisionSupport.providerDiscoveryCandidateId', 300);
  if (!cleaned.startsWith('provider-discovery-candidate_')) {
    return invalid('trustDecisionSupport.providerDiscoveryCandidateId is invalid.');
  }
  return cleaned as ProviderDiscoveryCandidateId;
}

export function providerDiscoveryTrustContextScopeFingerprintV1(
  value: Omit<ProviderDiscoveryTrustContextIntentV1, 'schemaVersion' | 'contextScopeFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function providerDiscoveryTrustRequestFingerprintV1(
  value: Omit<ProviderDiscoveryTrustRequestLinkV1, 'schemaVersion' | 'trustRequestFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function providerDiscoveryTrustComparisonFingerprintV1(
  value: Omit<ProviderDiscoveryTrustComparisonV1, 'generatedAt' | 'comparisonFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function parseProviderDiscoveryTrustContextIntentV1(
  value: unknown,
  discoveryRequest: Readonly<ProviderDiscoveryRequestReferenceV1>
): ProviderDiscoveryTrustContextIntentV1 {
  const context = record(value, 'providerDiscoveryTrustContext');
  exactKeys(
    context,
    [
      'schemaVersion',
      'contextReference',
      'jurisdiction',
      'serviceType',
      'taskType',
      'collaborationScope',
      'contextScopeFingerprintSha256'
    ],
    'providerDiscoveryTrustContext'
  );
  if (context.schemaVersion !== 1) {
    invalid('providerDiscoveryTrustContext.schemaVersion must be 1.');
  }
  const base = {
    contextReference: text(
      context.contextReference,
      'providerDiscoveryTrustContext.contextReference'
    ),
    jurisdiction: text(context.jurisdiction, 'providerDiscoveryTrustContext.jurisdiction', 120),
    serviceType: text(context.serviceType, 'providerDiscoveryTrustContext.serviceType', 200),
    taskType: text(context.taskType, 'providerDiscoveryTrustContext.taskType', 200),
    collaborationScope: text(
      context.collaborationScope,
      'providerDiscoveryTrustContext.collaborationScope',
      500
    )
  };
  if (base.contextReference !== discoveryRequest.contextReference) {
    invalid('Trust contextReference must match the exact Discovery request contextReference.');
  }
  if (base.jurisdiction !== discoveryRequest.need.jurisdiction) {
    invalid('Trust jurisdiction must match the exact Discovery Need jurisdiction.');
  }
  if (base.serviceType !== discoveryRequest.need.serviceType) {
    invalid('Trust serviceType must match the exact Discovery Need serviceType.');
  }
  const contextScopeFingerprintSha256 = sha256(
    context.contextScopeFingerprintSha256,
    'providerDiscoveryTrustContext.contextScopeFingerprintSha256'
  );
  if (contextScopeFingerprintSha256 !== providerDiscoveryTrustContextScopeFingerprintV1(base)) {
    invalid('Trust context scope fingerprint does not match its exact bounded fields.');
  }
  return { schemaVersion: 1, ...base, contextScopeFingerprintSha256 };
}

export function parseProviderDiscoveryTrustRequestLinkV1(
  value: unknown,
  discoveryRequest: Readonly<ProviderDiscoveryRequestReferenceV1>
): ProviderDiscoveryTrustRequestLinkV1 {
  const link = record(value, 'providerDiscoveryTrustRequest');
  exactKeys(
    link,
    [
      'schemaVersion',
      'providerDiscoveryRequestId',
      'requestFingerprintSha256',
      'context',
      'trustRequestFingerprintSha256'
    ],
    'providerDiscoveryTrustRequest'
  );
  if (link.schemaVersion !== 1) invalid('providerDiscoveryTrustRequest.schemaVersion must be 1.');
  if (link.providerDiscoveryRequestId !== discoveryRequest.providerDiscoveryRequestId) {
    invalid('Trust request must bind the exact Provider Discovery request id.');
  }
  const requestFingerprintSha256 = sha256(
    link.requestFingerprintSha256,
    'providerDiscoveryTrustRequest.requestFingerprintSha256'
  );
  if (requestFingerprintSha256 !== discoveryRequest.requestFingerprintSha256) {
    invalid('Trust request must bind the exact Provider Discovery request fingerprint.');
  }
  const context = parseProviderDiscoveryTrustContextIntentV1(link.context, discoveryRequest);
  const base = {
    providerDiscoveryRequestId: discoveryRequest.providerDiscoveryRequestId,
    requestFingerprintSha256,
    context
  };
  const trustRequestFingerprintSha256 = sha256(
    link.trustRequestFingerprintSha256,
    'providerDiscoveryTrustRequest.trustRequestFingerprintSha256'
  );
  if (trustRequestFingerprintSha256 !== providerDiscoveryTrustRequestFingerprintV1(base)) {
    invalid('Trust request fingerprint does not match its exact Discovery/context linkage.');
  }
  return { schemaVersion: 1, ...base, trustRequestFingerprintSha256 };
}

function parseEvidenceSummary(value: unknown): ProviderDiscoveryTrustEvidenceSummaryV1 {
  const summary = record(value, 'trustDecisionSupport.evidenceSummary');
  exactKeys(
    summary,
    [
      'trustEvidenceItemId',
      'version',
      'trustEvidenceItemFingerprintSha256',
      'sourceClass',
      'sourceAuthorityState',
      'freshnessState',
      'lifecycleState',
      'limitationCodes',
      'contradictionCount',
      'evidenceReferenceCount',
      'executorAttributionState',
      'artifactAccessAuthorized'
    ],
    'trustDecisionSupport.evidenceSummary'
  );
  const id = text(
    summary.trustEvidenceItemId,
    'trustDecisionSupport.evidenceSummary.trustEvidenceItemId'
  );
  if (!id.startsWith('trust-evidence-item_')) invalid('Trust Evidence item id is invalid.');
  if (typeof summary.sourceClass !== 'string' || !SOURCE_CLASSES.has(summary.sourceClass)) {
    invalid('Trust Evidence sourceClass is invalid.');
  }
  if (
    typeof summary.sourceAuthorityState !== 'string' ||
    !SOURCE_AUTHORITY_STATES.has(summary.sourceAuthorityState)
  ) {
    invalid('Trust Evidence sourceAuthorityState is invalid.');
  }
  if (typeof summary.freshnessState !== 'string' || !FRESHNESS_STATES.has(summary.freshnessState)) {
    invalid('Trust Evidence freshnessState is invalid.');
  }
  if (typeof summary.lifecycleState !== 'string' || !LIFECYCLE_STATES.has(summary.lifecycleState)) {
    invalid('Trust Evidence lifecycleState is invalid.');
  }
  if (!Array.isArray(summary.limitationCodes)) {
    invalid('Trust Evidence limitationCodes must be an array.');
  }
  const limitationCodes = summary.limitationCodes.map((code) => {
    if (typeof code !== 'string' || !LIMITATION_CODES.has(code)) {
      return invalid('Trust Evidence limitationCodes contains an invalid code.');
    }
    return code as TrustEvidenceLimitationCodeV1;
  });
  if (new Set(limitationCodes).size !== limitationCodes.length) {
    invalid('Trust Evidence limitationCodes must not contain duplicates.');
  }
  if (
    summary.executorAttributionState !== 'ESTABLISHED' &&
    summary.executorAttributionState !== 'NOT_ESTABLISHED'
  ) {
    invalid('Trust Evidence executorAttributionState is invalid.');
  }
  return {
    trustEvidenceItemId: id as `trust-evidence-item_${string}`,
    version: positiveInteger(summary.version, 'trustDecisionSupport.evidenceSummary.version'),
    trustEvidenceItemFingerprintSha256: sha256(
      summary.trustEvidenceItemFingerprintSha256,
      'trustDecisionSupport.evidenceSummary.trustEvidenceItemFingerprintSha256'
    ),
    sourceClass: summary.sourceClass as TrustEvidenceSourceReferenceV1['kind'],
    sourceAuthorityState: summary.sourceAuthorityState as TrustEvidenceSourceAuthorityStateV1,
    freshnessState: summary.freshnessState as TrustEvidenceFreshnessStateV1,
    lifecycleState: summary.lifecycleState as TrustEvidenceLifecycleStateV1,
    limitationCodes,
    contradictionCount: nonNegativeInteger(
      summary.contradictionCount,
      'trustDecisionSupport.evidenceSummary.contradictionCount'
    ),
    evidenceReferenceCount: nonNegativeInteger(
      summary.evidenceReferenceCount,
      'trustDecisionSupport.evidenceSummary.evidenceReferenceCount'
    ),
    executorAttributionState: summary.executorAttributionState,
    artifactAccessAuthorized: falseOnly(
      summary.artifactAccessAuthorized,
      'trustDecisionSupport.evidenceSummary.artifactAccessAuthorized'
    )
  };
}

function parseDecisionSupport(
  value: unknown,
  candidate: { providerDiscoveryCandidateId: ProviderDiscoveryCandidateId; providerId: ProviderId },
  request: ProviderDiscoveryTrustRequestLinkV1
): ProviderDiscoveryTrustDecisionSupportV1 {
  const support = record(value, 'trustDecisionSupport');
  const commonKeys = [
    'schemaVersion',
    'providerDiscoveryCandidateId',
    'providerId',
    'trustRequestFingerprintSha256',
    'contextFingerprintSha256',
    'artifactAccessAuthorized',
    'universalScoreCreated',
    'rankCreated',
    'winnerCreated',
    'qualityJudgmentCreated'
  ];
  if (support.schemaVersion !== 1) invalid('trustDecisionSupport.schemaVersion must be 1.');
  const parsedCandidateId = candidateId(support.providerDiscoveryCandidateId);
  if (parsedCandidateId !== candidate.providerDiscoveryCandidateId) {
    invalid('Trust decision support must bind the exact Discovery candidate id.');
  }
  const parsedProviderId = providerId(support.providerId, 'trustDecisionSupport.providerId');
  if (parsedProviderId !== candidate.providerId) {
    invalid('Trust decision support must bind the exact candidate Provider.');
  }
  const trustRequestFingerprintSha256 = sha256(
    support.trustRequestFingerprintSha256,
    'trustDecisionSupport.trustRequestFingerprintSha256'
  );
  if (trustRequestFingerprintSha256 !== request.trustRequestFingerprintSha256) {
    invalid('Trust decision support must bind the exact Trust request fingerprint.');
  }
  const base = {
    schemaVersion: 1 as const,
    providerDiscoveryCandidateId: parsedCandidateId,
    providerId: parsedProviderId,
    trustRequestFingerprintSha256,
    contextFingerprintSha256: sha256(
      support.contextFingerprintSha256,
      'trustDecisionSupport.contextFingerprintSha256'
    ),
    artifactAccessAuthorized: falseOnly(
      support.artifactAccessAuthorized,
      'trustDecisionSupport.artifactAccessAuthorized'
    ),
    universalScoreCreated: falseOnly(
      support.universalScoreCreated,
      'trustDecisionSupport.universalScoreCreated'
    ),
    rankCreated: falseOnly(support.rankCreated, 'trustDecisionSupport.rankCreated'),
    winnerCreated: falseOnly(support.winnerCreated, 'trustDecisionSupport.winnerCreated'),
    qualityJudgmentCreated: falseOnly(
      support.qualityJudgmentCreated,
      'trustDecisionSupport.qualityJudgmentCreated'
    )
  };

  if (support.state === 'TRUST_EVIDENCE_UNAVAILABLE') {
    exactKeys(
      support,
      [...commonKeys, 'state', 'reason', 'explanation', 'evidenceSummaries'],
      'trustDecisionSupport'
    );
    if (typeof support.reason !== 'string' || !UNAVAILABLE_REASONS.has(support.reason)) {
      invalid('Trust unavailable reason is invalid.');
    }
    if (support.explanation !== null) {
      invalid('Unavailable Trust decision support cannot carry an explanation.');
    }
    if (!Array.isArray(support.evidenceSummaries) || support.evidenceSummaries.length !== 0) {
      invalid('Unavailable Trust decision support must not carry evidence summaries.');
    }
    return {
      ...base,
      state: 'TRUST_EVIDENCE_UNAVAILABLE',
      reason: support.reason as ProviderDiscoveryTrustUnavailableReasonV1,
      explanation: null,
      evidenceSummaries: []
    };
  }

  if (support.state !== 'TRUST_EVIDENCE_AVAILABLE') {
    invalid('trustDecisionSupport.state is invalid.');
  }
  exactKeys(
    support,
    [
      ...commonKeys,
      'state',
      'visibilityProjection',
      'explanation',
      'currentExposureValidation',
      'evidenceSummaries'
    ],
    'trustDecisionSupport'
  );
  const projection = record(support.visibilityProjection, 'trustDecisionSupport.visibilityProjection');
  exactKeys(
    projection,
    ['trustEvidenceVisibilityProjectionId', 'projectionFingerprintSha256'],
    'trustDecisionSupport.visibilityProjection'
  );
  const visibilityProjection = {
    trustEvidenceVisibilityProjectionId: text(
      projection.trustEvidenceVisibilityProjectionId,
      'trustDecisionSupport.visibilityProjection.trustEvidenceVisibilityProjectionId'
    ) as TrustEvidenceVisibilityProjectionIdV1,
    projectionFingerprintSha256: sha256(
      projection.projectionFingerprintSha256,
      'trustDecisionSupport.visibilityProjection.projectionFingerprintSha256'
    )
  };
  if (!visibilityProjection.trustEvidenceVisibilityProjectionId.startsWith('trust-evidence-projection_')) {
    invalid('Trust visibility projection id is invalid.');
  }
  const explanation = record(support.explanation, 'trustDecisionSupport.explanation');
  exactKeys(
    explanation,
    ['trustExplanationId', 'trustExplanationFingerprintSha256', 'result'],
    'trustDecisionSupport.explanation'
  );
  const trustExplanationId = text(
    explanation.trustExplanationId,
    'trustDecisionSupport.explanation.trustExplanationId'
  ) as TrustExplanationIdV1;
  if (!trustExplanationId.startsWith('trust-explanation_')) {
    invalid('Trust explanation id is invalid.');
  }
  if (typeof explanation.result !== 'string' || !EXPLANATION_RESULTS.has(explanation.result)) {
    invalid('Trust explanation result is invalid.');
  }
  const currentExposureValidation = parseTrustEvidenceCurrentExposureValidationV1(
    support.currentExposureValidation
  );
  if (currentExposureValidation.decision !== 'AUTHORIZED_FOR_BOUNDED_TRUST_EXPLANATION') {
    invalid('Available Trust decision support requires current positive exposure validation.');
  }
  if (
    currentExposureValidation.providerId !== base.providerId ||
    currentExposureValidation.contextFingerprintSha256 !== base.contextFingerprintSha256
  ) {
    invalid('Trust exposure validation must match the exact candidate Provider/context.');
  }
  if (
    currentExposureValidation.projection.trustEvidenceVisibilityProjectionId !==
      visibilityProjection.trustEvidenceVisibilityProjectionId ||
    currentExposureValidation.projection.projectionFingerprintSha256 !==
      visibilityProjection.projectionFingerprintSha256
  ) {
    invalid('Trust exposure validation must bind the exact visibility projection.');
  }
  if (!Array.isArray(support.evidenceSummaries)) {
    invalid('Available Trust decision support evidenceSummaries must be an array.');
  }
  return {
    ...base,
    state: 'TRUST_EVIDENCE_AVAILABLE',
    visibilityProjection,
    explanation: {
      trustExplanationId,
      trustExplanationFingerprintSha256: sha256(
        explanation.trustExplanationFingerprintSha256,
        'trustDecisionSupport.explanation.trustExplanationFingerprintSha256'
      ),
      result: explanation.result as TrustExplanationResultV1
    },
    currentExposureValidation,
    evidenceSummaries: support.evidenceSummaries.map((item) => parseEvidenceSummary(item))
  };
}

export function parseProviderDiscoveryTrustComparisonV1(
  value: unknown,
  discoveryResult: Readonly<ProviderDiscoveryResultV1>
): ProviderDiscoveryTrustComparisonV1 {
  const comparison = record(value, 'providerDiscoveryTrustComparison');
  exactKeys(
    comparison,
    [
      'schemaVersion',
      'requested',
      'request',
      'candidates',
      'generatedAt',
      'comparisonFingerprintSha256',
      'artifactAccessAuthorized',
      'universalScoreCreated',
      'rankCreated',
      'winnerCreated',
      'authorityConsequences'
    ],
    'providerDiscoveryTrustComparison'
  );
  if (comparison.schemaVersion !== 1) {
    invalid('providerDiscoveryTrustComparison.schemaVersion must be 1.');
  }
  const requested = trueOnly(comparison.requested, 'providerDiscoveryTrustComparison.requested');
  const request = parseProviderDiscoveryTrustRequestLinkV1(
    comparison.request,
    discoveryResult.request
  );
  if (!Array.isArray(comparison.candidates)) {
    invalid('providerDiscoveryTrustComparison.candidates must be an array.');
  }
  const disclosed = discoveryResult.status === 'CANDIDATES' ? discoveryResult.candidates : [];
  if (comparison.candidates.length !== disclosed.length) {
    invalid('Trust comparison must contain exactly the Providers already disclosed by Discovery.');
  }
  const candidates = comparison.candidates.map((entry, index) =>
    parseDecisionSupport(
      entry,
      {
        providerDiscoveryCandidateId: disclosed[index]!.providerDiscoveryCandidateId,
        providerId: disclosed[index]!.providerId
      },
      request
    )
  );
  if (
    JSON.stringify(canonicalize(comparison.authorityConsequences)) !==
    JSON.stringify(canonicalize(noProviderDiscoveryAuthorityConsequences))
  ) {
    invalid('Trust comparison must preserve the frozen Discovery no-authority consequences.');
  }
  const base = {
    schemaVersion: 1 as const,
    requested,
    request,
    candidates,
    artifactAccessAuthorized: falseOnly(
      comparison.artifactAccessAuthorized,
      'providerDiscoveryTrustComparison.artifactAccessAuthorized'
    ),
    universalScoreCreated: falseOnly(
      comparison.universalScoreCreated,
      'providerDiscoveryTrustComparison.universalScoreCreated'
    ),
    rankCreated: falseOnly(comparison.rankCreated, 'providerDiscoveryTrustComparison.rankCreated'),
    winnerCreated: falseOnly(
      comparison.winnerCreated,
      'providerDiscoveryTrustComparison.winnerCreated'
    ),
    authorityConsequences: noProviderDiscoveryAuthorityConsequences
  };
  const comparisonFingerprintSha256 = sha256(
    comparison.comparisonFingerprintSha256,
    'providerDiscoveryTrustComparison.comparisonFingerprintSha256'
  );
  if (comparisonFingerprintSha256 !== providerDiscoveryTrustComparisonFingerprintV1(base)) {
    invalid('Trust comparison fingerprint does not match its exact bounded contents.');
  }
  return {
    ...base,
    generatedAt: text(comparison.generatedAt, 'providerDiscoveryTrustComparison.generatedAt', 64),
    comparisonFingerprintSha256
  };
}
