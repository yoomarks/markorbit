export const matterIntelligenceReviewOutcomes = [
  'CONFIRMED_AS_PRESENTED',
  'OVERRIDDEN',
  'INCONCLUSIVE'
] as const;
export type MatterIntelligenceReviewOutcome = (typeof matterIntelligenceReviewOutcomes)[number];

export const matterIntelligenceReviewReasonCodes = [
  'INDEPENDENT_REVIEW_CONFIRMED',
  'METHOD_OUTPUT_INCORRECT',
  'APPLICABILITY_MISMATCH',
  'INPUT_FACT_INCORRECT',
  'SOURCE_DATA_OR_REFERENCE_STALE',
  'PRODUCT_OR_WORKFLOW_PREFERENCE',
  'INSUFFICIENT_EVIDENCE'
] as const;
export type MatterIntelligenceReviewReasonCode =
  (typeof matterIntelligenceReviewReasonCodes)[number];

export type MatterIntelligenceReviewId = `matter-intelligence-review_${string}`;
export type MatterIntelligenceObservationId = `matter-intelligence-observation_${string}`;

export interface MarkRegMatterIntelligenceReviewSourceAssertionV1 {
  schemaVersion: 1;
  source: Readonly<{
    owner: 'MARKREG';
    kind: 'MATTER_INTELLIGENCE_REVIEW';
    sourceId: MatterIntelligenceReviewId;
    sourceVersion: 1;
    sourceFingerprintSha256: string;
    observedAt: string;
  }>;
  workspaceId: string;
  formalMatter: Readonly<{
    id: string;
    version: number;
  }>;
  reviewedObservation: Readonly<{
    id: MatterIntelligenceObservationId;
    fingerprintSha256: string;
    outputFingerprintSha256: string;
  }>;
  review: Readonly<{
    outcome: MatterIntelligenceReviewOutcome;
    reasonCode: MatterIntelligenceReviewReasonCode;
    rationale?: string;
    reviewerPrincipalId: string;
    reviewerMembershipId: string;
    reviewedAt: string;
  }>;
  production: Readonly<{
    capability: Readonly<{
      id: string;
      version: string;
      returnId: string;
      sessionReceiptId: string;
    }>;
    methodPackageRef: string;
    methodRef: string;
    methodVersionRef: string;
    evaluationRef: string;
    researchDatasetRef: string;
    inputFingerprintSha256: string;
    outputFingerprintSha256: string;
    evidenceFingerprintSha256: string;
  }>;
}

export class MethodOutcomeEvidenceContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'MethodOutcomeEvidenceContractError';
  }
}

type RecordValue = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/;

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new MethodOutcomeEvidenceContractError(`${field} must be an object.`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[], field: string): void {
  const supported = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !supported.has(key));
  if (unknown.length)
    throw new MethodOutcomeEvidenceContractError(
      `${field} contains unsupported fields: ${unknown.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new MethodOutcomeEvidenceContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new MethodOutcomeEvidenceContractError(
      `${field} must contain between 1 and ${maximum} characters.`
    );
  return cleaned;
}

function timestamp(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()))
    throw new MethodOutcomeEvidenceContractError(`${field} must be an ISO timestamp.`);
  return parsed.toISOString();
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new MethodOutcomeEvidenceContractError(`${field} must be a positive integer.`);
  return Number(value);
}

function sha256(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned))
    throw new MethodOutcomeEvidenceContractError(`${field} must be a lowercase SHA-256.`);
  return cleaned;
}

function prefixed<T extends string>(value: unknown, prefix: string, field: string): T {
  const cleaned = text(value, field, 500);
  if (!cleaned.startsWith(prefix) || cleaned === prefix)
    throw new MethodOutcomeEvidenceContractError(`${field} must start with ${prefix}.`);
  return cleaned as T;
}

export function assertMatterIntelligenceReviewTaxonomy(
  outcome: MatterIntelligenceReviewOutcome,
  reasonCode: MatterIntelligenceReviewReasonCode
): void {
  const valid =
    (outcome === 'CONFIRMED_AS_PRESENTED' && reasonCode === 'INDEPENDENT_REVIEW_CONFIRMED') ||
    (outcome === 'INCONCLUSIVE' && reasonCode === 'INSUFFICIENT_EVIDENCE') ||
    (outcome === 'OVERRIDDEN' &&
      [
        'METHOD_OUTPUT_INCORRECT',
        'APPLICABILITY_MISMATCH',
        'INPUT_FACT_INCORRECT',
        'SOURCE_DATA_OR_REFERENCE_STALE',
        'PRODUCT_OR_WORKFLOW_PREFERENCE'
      ].includes(reasonCode));
  if (!valid)
    throw new MethodOutcomeEvidenceContractError(
      `Review outcome ${outcome} cannot use reason ${reasonCode}.`
    );
}

function reviewOutcome(value: unknown): MatterIntelligenceReviewOutcome {
  if (
    typeof value !== 'string' ||
    !(matterIntelligenceReviewOutcomes as readonly string[]).includes(value)
  )
    throw new MethodOutcomeEvidenceContractError('review.outcome is invalid.');
  return value as MatterIntelligenceReviewOutcome;
}

function reviewReason(value: unknown): MatterIntelligenceReviewReasonCode {
  if (
    typeof value !== 'string' ||
    !(matterIntelligenceReviewReasonCodes as readonly string[]).includes(value)
  )
    throw new MethodOutcomeEvidenceContractError('review.reasonCode is invalid.');
  return value as MatterIntelligenceReviewReasonCode;
}

export function parseMarkRegMatterIntelligenceReviewSourceAssertionV1(
  value: unknown
): MarkRegMatterIntelligenceReviewSourceAssertionV1 {
  const root = record(value, 'assertion');
  exactKeys(
    root,
    ['schemaVersion', 'source', 'workspaceId', 'formalMatter', 'reviewedObservation', 'review', 'production'],
    'assertion'
  );
  if (root.schemaVersion !== 1)
    throw new MethodOutcomeEvidenceContractError('assertion.schemaVersion must be 1.');

  const source = record(root.source, 'source');
  exactKeys(
    source,
    ['owner', 'kind', 'sourceId', 'sourceVersion', 'sourceFingerprintSha256', 'observedAt'],
    'source'
  );
  if (
    source.owner !== 'MARKREG' ||
    source.kind !== 'MATTER_INTELLIGENCE_REVIEW' ||
    source.sourceVersion !== 1
  )
    throw new MethodOutcomeEvidenceContractError(
      'source must identify a MARKREG MATTER_INTELLIGENCE_REVIEW version 1.'
    );

  const formalMatter = record(root.formalMatter, 'formalMatter');
  exactKeys(formalMatter, ['id', 'version'], 'formalMatter');
  const reviewedObservation = record(root.reviewedObservation, 'reviewedObservation');
  exactKeys(
    reviewedObservation,
    ['id', 'fingerprintSha256', 'outputFingerprintSha256'],
    'reviewedObservation'
  );
  const review = record(root.review, 'review');
  exactKeys(
    review,
    ['outcome', 'reasonCode', 'rationale', 'reviewerPrincipalId', 'reviewerMembershipId', 'reviewedAt'],
    'review'
  );
  const outcome = reviewOutcome(review.outcome);
  const reasonCode = reviewReason(review.reasonCode);
  assertMatterIntelligenceReviewTaxonomy(outcome, reasonCode);
  const rationale =
    review.rationale === undefined ? undefined : text(review.rationale, 'review.rationale', 2000);

  const production = record(root.production, 'production');
  exactKeys(
    production,
    [
      'capability',
      'methodPackageRef',
      'methodRef',
      'methodVersionRef',
      'evaluationRef',
      'researchDatasetRef',
      'inputFingerprintSha256',
      'outputFingerprintSha256',
      'evidenceFingerprintSha256'
    ],
    'production'
  );
  const capability = record(production.capability, 'production.capability');
  exactKeys(
    capability,
    ['id', 'version', 'returnId', 'sessionReceiptId'],
    'production.capability'
  );

  const reviewedOutputFingerprint = sha256(
    reviewedObservation.outputFingerprintSha256,
    'reviewedObservation.outputFingerprintSha256'
  );
  const productionOutputFingerprint = sha256(
    production.outputFingerprintSha256,
    'production.outputFingerprintSha256'
  );
  if (reviewedOutputFingerprint !== productionOutputFingerprint)
    throw new MethodOutcomeEvidenceContractError(
      'reviewed observation and production output fingerprints must match.'
    );

  return {
    schemaVersion: 1,
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId: prefixed<MatterIntelligenceReviewId>(
        source.sourceId,
        'matter-intelligence-review_',
        'source.sourceId'
      ),
      sourceVersion: 1,
      sourceFingerprintSha256: sha256(
        source.sourceFingerprintSha256,
        'source.sourceFingerprintSha256'
      ),
      observedAt: timestamp(source.observedAt, 'source.observedAt')
    },
    workspaceId: text(root.workspaceId, 'workspaceId', 300),
    formalMatter: {
      id: text(formalMatter.id, 'formalMatter.id', 300),
      version: positiveInteger(formalMatter.version, 'formalMatter.version')
    },
    reviewedObservation: {
      id: prefixed<MatterIntelligenceObservationId>(
        reviewedObservation.id,
        'matter-intelligence-observation_',
        'reviewedObservation.id'
      ),
      fingerprintSha256: sha256(
        reviewedObservation.fingerprintSha256,
        'reviewedObservation.fingerprintSha256'
      ),
      outputFingerprintSha256: reviewedOutputFingerprint
    },
    review: {
      outcome,
      reasonCode,
      ...(rationale ? { rationale } : {}),
      reviewerPrincipalId: text(review.reviewerPrincipalId, 'review.reviewerPrincipalId', 300),
      reviewerMembershipId: text(review.reviewerMembershipId, 'review.reviewerMembershipId', 300),
      reviewedAt: timestamp(review.reviewedAt, 'review.reviewedAt')
    },
    production: {
      capability: {
        id: text(capability.id, 'production.capability.id', 300),
        version: text(capability.version, 'production.capability.version', 120),
        returnId: text(capability.returnId, 'production.capability.returnId', 300),
        sessionReceiptId: text(
          capability.sessionReceiptId,
          'production.capability.sessionReceiptId',
          300
        )
      },
      methodPackageRef: prefixed<string>(
        production.methodPackageRef,
        'brain-method-package:',
        'production.methodPackageRef'
      ),
      methodRef: prefixed<string>(production.methodRef, 'brain-method:', 'production.methodRef'),
      methodVersionRef: prefixed<string>(
        production.methodVersionRef,
        'brain-method-version:',
        'production.methodVersionRef'
      ),
      evaluationRef: prefixed<string>(
        production.evaluationRef,
        'brain-method-evaluation:',
        'production.evaluationRef'
      ),
      researchDatasetRef: prefixed<string>(
        production.researchDatasetRef,
        'research-dataset:',
        'production.researchDatasetRef'
      ),
      inputFingerprintSha256: sha256(
        production.inputFingerprintSha256,
        'production.inputFingerprintSha256'
      ),
      outputFingerprintSha256: productionOutputFingerprint,
      evidenceFingerprintSha256: sha256(
        production.evidenceFingerprintSha256,
        'production.evidenceFingerprintSha256'
      )
    }
  };
}
