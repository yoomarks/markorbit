export const methodOutcomeEvidenceReviewOutcomes = [
  'CONFIRMED',
  'OVERRIDDEN',
  'INCONCLUSIVE'
] as const;
export type MethodOutcomeEvidenceReviewOutcome =
  (typeof methodOutcomeEvidenceReviewOutcomes)[number];

export const methodOutcomeEvidenceReasonCodes = [
  'METHOD_ERROR',
  'INPUT_DATA_ERROR',
  'APPLICABILITY_ERROR',
  'PRODUCT_USER_PREFERENCE',
  'INCONCLUSIVE_EVIDENCE'
] as const;
export type MethodOutcomeEvidenceReasonCode = (typeof methodOutcomeEvidenceReasonCodes)[number];

export type MethodOutcomeEvidenceId = `method-outcome-evidence_${string}`;
export type MethodOutcomeEvidenceReviewId = `matter-intelligence-review_${string}`;
export type MethodOutcomeEvidenceObservationId = `matter-intelligence-observation_${string}`;
export type MethodOutcomeEvidenceFormalMatterId = `formal-matter_${string}`;

export interface MethodOutcomeEvidenceAdmissionV1 {
  schemaVersion: 1;
  workspaceId: string;
  source: Readonly<{
    owner: 'MARKREG';
    kind: 'MATTER_INTELLIGENCE_REVIEW';
    sourceId: MethodOutcomeEvidenceReviewId;
    sourceVersion: number;
    sourceFingerprintSha256: string;
  }>;
  formalMatter: Readonly<{
    id: MethodOutcomeEvidenceFormalMatterId;
    version: number;
  }>;
  observation: Readonly<{
    id: MethodOutcomeEvidenceObservationId;
    fingerprintSha256: string;
    outputFingerprintSha256: string;
  }>;
  review: Readonly<{
    id: MethodOutcomeEvidenceReviewId;
    version: number;
    fingerprintSha256: string;
    outcome: MethodOutcomeEvidenceReviewOutcome;
    reason?: MethodOutcomeEvidenceReasonCode;
    reviewedByPrincipalId: string;
    reviewedAt: string;
  }>;
  capability: Readonly<{
    id: string;
    version: string;
    requestId: string;
    returnId: string;
    outcomeId: string;
    invocationId: string;
    sessionReceiptId: string;
  }>;
  implementation: Readonly<{
    id: string;
    version: number;
    key: string;
  }>;
  method: Readonly<{
    packageRef: string;
    methodRef: string;
    methodVersionRef: string;
    evaluationRef: string;
    researchDatasetRef: string;
    evidenceFingerprintSha256: string;
    inputFingerprintSha256: string;
    outputFingerprintSha256: string;
  }>;
}

export interface MethodOutcomeEvidenceV1 extends MethodOutcomeEvidenceAdmissionV1 {
  methodOutcomeEvidenceId: MethodOutcomeEvidenceId;
  admissionFingerprintSha256: string;
  admittedAt: string;
}

export class MethodOutcomeEvidenceContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'MethodOutcomeEvidenceContractError';
  }
}

type RecordValue = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

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
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned)
    throw new MethodOutcomeEvidenceContractError(`${field} must be a canonical ISO timestamp.`);
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new MethodOutcomeEvidenceContractError(`${field} must be a positive integer.`);
  return Number(value);
}

function sha256(value: unknown, field: string): string {
  const cleaned = text(value, field, 64);
  if (!SHA256.test(cleaned))
    throw new MethodOutcomeEvidenceContractError(`${field} must be a lowercase SHA-256.`);
  return cleaned;
}

function uuid(value: unknown, field: string): string {
  const cleaned = text(value, field, 36).toLowerCase();
  if (!UUID.test(cleaned))
    throw new MethodOutcomeEvidenceContractError(`${field} must be a canonical UUID.`);
  return cleaned;
}

function prefixed<T extends string>(value: unknown, prefix: string, field: string): T {
  const cleaned = text(value, field, 500);
  if (!cleaned.startsWith(prefix) || cleaned === prefix)
    throw new MethodOutcomeEvidenceContractError(`${field} must start with ${prefix}.`);
  return cleaned as T;
}

function reviewOutcome(value: unknown): MethodOutcomeEvidenceReviewOutcome {
  if (
    typeof value !== 'string' ||
    !(methodOutcomeEvidenceReviewOutcomes as readonly string[]).includes(value)
  )
    throw new MethodOutcomeEvidenceContractError('review.outcome is invalid.');
  return value as MethodOutcomeEvidenceReviewOutcome;
}

function reviewReason(value: unknown): MethodOutcomeEvidenceReasonCode {
  if (
    typeof value !== 'string' ||
    !(methodOutcomeEvidenceReasonCodes as readonly string[]).includes(value)
  )
    throw new MethodOutcomeEvidenceContractError('review.reason is invalid.');
  return value as MethodOutcomeEvidenceReasonCode;
}

export function assertMethodOutcomeEvidenceReviewTaxonomy(
  outcome: MethodOutcomeEvidenceReviewOutcome,
  reason?: MethodOutcomeEvidenceReasonCode
): void {
  const valid =
    (outcome === 'CONFIRMED' && reason === undefined) ||
    (outcome === 'INCONCLUSIVE' && reason === 'INCONCLUSIVE_EVIDENCE') ||
    (outcome === 'OVERRIDDEN' &&
      reason !== undefined &&
      ['METHOD_ERROR', 'INPUT_DATA_ERROR', 'APPLICABILITY_ERROR', 'PRODUCT_USER_PREFERENCE'].includes(
        reason
      ));
  if (!valid)
    throw new MethodOutcomeEvidenceContractError(
      `Review outcome ${outcome} cannot use reason ${String(reason)}.`
    );
}

function parseAdmissionRoot(root: RecordValue): MethodOutcomeEvidenceAdmissionV1 {
  if (root.schemaVersion !== 1)
    throw new MethodOutcomeEvidenceContractError('evidence.schemaVersion must be 1.');

  const source = record(root.source, 'source');
  exactKeys(
    source,
    ['owner', 'kind', 'sourceId', 'sourceVersion', 'sourceFingerprintSha256'],
    'source'
  );
  if (source.owner !== 'MARKREG' || source.kind !== 'MATTER_INTELLIGENCE_REVIEW')
    throw new MethodOutcomeEvidenceContractError(
      'source must identify a MARKREG MATTER_INTELLIGENCE_REVIEW.'
    );

  const formalMatter = record(root.formalMatter, 'formalMatter');
  exactKeys(formalMatter, ['id', 'version'], 'formalMatter');
  const observation = record(root.observation, 'observation');
  exactKeys(observation, ['id', 'fingerprintSha256', 'outputFingerprintSha256'], 'observation');
  const review = record(root.review, 'review');
  exactKeys(
    review,
    ['id', 'version', 'fingerprintSha256', 'outcome', 'reason', 'reviewedByPrincipalId', 'reviewedAt'],
    'review'
  );
  const capability = record(root.capability, 'capability');
  exactKeys(
    capability,
    ['id', 'version', 'requestId', 'returnId', 'outcomeId', 'invocationId', 'sessionReceiptId'],
    'capability'
  );
  const implementation = record(root.implementation, 'implementation');
  exactKeys(implementation, ['id', 'version', 'key'], 'implementation');
  const method = record(root.method, 'method');
  exactKeys(
    method,
    [
      'packageRef',
      'methodRef',
      'methodVersionRef',
      'evaluationRef',
      'researchDatasetRef',
      'evidenceFingerprintSha256',
      'inputFingerprintSha256',
      'outputFingerprintSha256'
    ],
    'method'
  );

  const sourceId = prefixed<MethodOutcomeEvidenceReviewId>(
    source.sourceId,
    'matter-intelligence-review_',
    'source.sourceId'
  );
  const sourceVersion = positiveInteger(source.sourceVersion, 'source.sourceVersion');
  const reviewId = prefixed<MethodOutcomeEvidenceReviewId>(
    review.id,
    'matter-intelligence-review_',
    'review.id'
  );
  const reviewVersion = positiveInteger(review.version, 'review.version');
  if (sourceId !== reviewId || sourceVersion !== reviewVersion)
    throw new MethodOutcomeEvidenceContractError(
      'source identity/version must exactly match the reviewed product record.'
    );

  const outcome = reviewOutcome(review.outcome);
  const reason = review.reason === undefined ? undefined : reviewReason(review.reason);
  assertMethodOutcomeEvidenceReviewTaxonomy(outcome, reason);
  const observationOutputFingerprint = sha256(
    observation.outputFingerprintSha256,
    'observation.outputFingerprintSha256'
  );
  const methodOutputFingerprint = sha256(
    method.outputFingerprintSha256,
    'method.outputFingerprintSha256'
  );
  if (observationOutputFingerprint !== methodOutputFingerprint)
    throw new MethodOutcomeEvidenceContractError(
      'observation and method output fingerprints must match.'
    );

  return {
    schemaVersion: 1,
    workspaceId: uuid(root.workspaceId, 'workspaceId'),
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId,
      sourceVersion,
      sourceFingerprintSha256: sha256(
        source.sourceFingerprintSha256,
        'source.sourceFingerprintSha256'
      )
    },
    formalMatter: {
      id: prefixed<MethodOutcomeEvidenceFormalMatterId>(
        formalMatter.id,
        'formal-matter_',
        'formalMatter.id'
      ),
      version: positiveInteger(formalMatter.version, 'formalMatter.version')
    },
    observation: {
      id: prefixed<MethodOutcomeEvidenceObservationId>(
        observation.id,
        'matter-intelligence-observation_',
        'observation.id'
      ),
      fingerprintSha256: sha256(observation.fingerprintSha256, 'observation.fingerprintSha256'),
      outputFingerprintSha256: observationOutputFingerprint
    },
    review: {
      id: reviewId,
      version: reviewVersion,
      fingerprintSha256: sha256(review.fingerprintSha256, 'review.fingerprintSha256'),
      outcome,
      ...(reason === undefined ? {} : { reason }),
      reviewedByPrincipalId: text(review.reviewedByPrincipalId, 'review.reviewedByPrincipalId', 300),
      reviewedAt: timestamp(review.reviewedAt, 'review.reviewedAt')
    },
    capability: {
      id: text(capability.id, 'capability.id', 300),
      version: text(capability.version, 'capability.version', 120),
      requestId: prefixed<string>(capability.requestId, 'capreq_', 'capability.requestId'),
      returnId: prefixed<string>(capability.returnId, 'capability-return_', 'capability.returnId'),
      outcomeId: prefixed<string>(capability.outcomeId, 'capability-outcome_', 'capability.outcomeId'),
      invocationId: prefixed<string>(
        capability.invocationId,
        'capability-invocation_',
        'capability.invocationId'
      ),
      sessionReceiptId: prefixed<string>(
        capability.sessionReceiptId,
        'session-receipt_',
        'capability.sessionReceiptId'
      )
    },
    implementation: {
      id: prefixed<string>(implementation.id, 'implementation-profile_', 'implementation.id'),
      version: positiveInteger(implementation.version, 'implementation.version'),
      key: text(implementation.key, 'implementation.key', 300)
    },
    method: {
      packageRef: prefixed<string>(method.packageRef, 'brain-method-package:', 'method.packageRef'),
      methodRef: prefixed<string>(method.methodRef, 'brain-method:', 'method.methodRef'),
      methodVersionRef: prefixed<string>(
        method.methodVersionRef,
        'brain-method-version:',
        'method.methodVersionRef'
      ),
      evaluationRef: prefixed<string>(
        method.evaluationRef,
        'brain-method-evaluation:',
        'method.evaluationRef'
      ),
      researchDatasetRef: prefixed<string>(
        method.researchDatasetRef,
        'research-dataset:',
        'method.researchDatasetRef'
      ),
      evidenceFingerprintSha256: sha256(
        method.evidenceFingerprintSha256,
        'method.evidenceFingerprintSha256'
      ),
      inputFingerprintSha256: sha256(
        method.inputFingerprintSha256,
        'method.inputFingerprintSha256'
      ),
      outputFingerprintSha256: methodOutputFingerprint
    }
  };
}

export function parseMethodOutcomeEvidenceAdmissionV1(
  value: unknown
): MethodOutcomeEvidenceAdmissionV1 {
  const root = record(value, 'evidence');
  exactKeys(
    root,
    [
      'schemaVersion',
      'workspaceId',
      'source',
      'formalMatter',
      'observation',
      'review',
      'capability',
      'implementation',
      'method'
    ],
    'evidence'
  );
  return parseAdmissionRoot(root);
}

export function parseMethodOutcomeEvidenceV1(value: unknown): MethodOutcomeEvidenceV1 {
  const root = record(value, 'evidence');
  exactKeys(
    root,
    [
      'schemaVersion',
      'workspaceId',
      'source',
      'formalMatter',
      'observation',
      'review',
      'capability',
      'implementation',
      'method',
      'methodOutcomeEvidenceId',
      'admissionFingerprintSha256',
      'admittedAt'
    ],
    'evidence'
  );
  const admission = parseAdmissionRoot(root);
  return {
    ...admission,
    methodOutcomeEvidenceId: prefixed<MethodOutcomeEvidenceId>(
      root.methodOutcomeEvidenceId,
      'method-outcome-evidence_',
      'methodOutcomeEvidenceId'
    ),
    admissionFingerprintSha256: sha256(
      root.admissionFingerprintSha256,
      'admissionFingerprintSha256'
    ),
    admittedAt: timestamp(root.admittedAt, 'admittedAt')
  };
}
