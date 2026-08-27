export type BrainAssetId = `brain-asset_${string}`;
export type BrainAssetVersionId = `brain-asset-version_${string}`;
export type BrainBuildRunId = `brain-build-run_${string}`;

export const brainAssetTypes = [
  'RESOLVED_VALUE',
  'STATISTICAL_ESTIMATE',
  'RULESET',
  'DECISION_GRAPH',
  'REASONING_METHOD',
  'CASE_PATTERN',
  'CASE_CLUSTER',
  'HEURISTIC',
  'STATISTICAL_PRIOR',
  'SCORING_MODEL',
  'RETRIEVAL_PROFILE',
  'EVALUATION_SET'
] as const;
export type BrainAssetType = (typeof brainAssetTypes)[number];

export const brainAssetStatuses = [
  'DRAFT',
  'CANDIDATE',
  'VALIDATED',
  'ACTIVE',
  'DEGRADED',
  'RETIRED'
] as const;
export type BrainAssetStatus = (typeof brainAssetStatuses)[number];

export const brainSourceOwners = [
  'KNOWLEDGE',
  'DATA_ENGINE',
  'MARKREG',
  'EXPERT',
  'BRAIN',
  'CORE'
] as const;
export type BrainSourceOwner = (typeof brainSourceOwners)[number];

export const brainOperationalResolutionStatuses = [
  'RESOLVED',
  'UNKNOWN',
  'INSUFFICIENT_EVIDENCE',
  'CONFLICTED'
] as const;
export type BrainOperationalResolutionStatus = (typeof brainOperationalResolutionStatuses)[number];

export const brainValueKinds = [
  'EXACT',
  'STATISTICAL_RANGE',
  'MODEL_ESTIMATE',
  'DERIVED',
  'UNKNOWN',
  'INSUFFICIENT_EVIDENCE',
  'CONFLICTED'
] as const;
export type BrainValueKind = (typeof brainValueKinds)[number];

export interface BrainEvidenceRef {
  sourceOwner: BrainSourceOwner;
  sourceObjectId: string;
  sourceVersion: string;
  sourceFingerprintSha256: string;
  observedAt?: string;
}

export interface BrainConfidenceFactors {
  authority: number;
  freshness: number;
  agreement: number;
  coverage: number;
  validation: number;
  methodQuality: number;
}

export interface BrainConfidence {
  score: number;
  band: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  factors: Readonly<BrainConfidenceFactors>;
}

export interface BrainAssetScope {
  domain: string;
  jurisdiction?: string;
  concept: string;
  inputSchemaId: string;
  outputSchemaId: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface BrainAssetVersion {
  schemaVersion: 1;
  brainAssetId: BrainAssetId;
  brainAssetVersionId: BrainAssetVersionId;
  version: number;
  assetType: BrainAssetType;
  status: BrainAssetStatus;
  scope: Readonly<BrainAssetScope>;
  evidenceRefs: readonly Readonly<BrainEvidenceRef>[];
  derivedFromBrainAssetVersionIds: readonly BrainAssetVersionId[];
  confidence: Readonly<BrainConfidence>;
  payload: unknown;
  createdAt: string;
  validatedAt?: string;
}

export interface BrainOperationalResolution {
  schemaVersion: 1;
  concept: string;
  jurisdiction?: string;
  asOf: string;
  status: BrainOperationalResolutionStatus;
  valueKind: BrainValueKind;
  value?: unknown;
  brainAssetVersionId?: BrainAssetVersionId;
  confidence?: Readonly<BrainConfidence>;
  evidenceRefs: readonly Readonly<BrainEvidenceRef>[];
  explanation: string;
}

export class BrainContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'BrainContractError';
  }
}

const SHA256 = /^[0-9a-f]{64}$/;

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new BrainContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allow = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allow.has(key));
  if (unsupported.length)
    throw new BrainContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') throw new BrainContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new BrainContractError(`${field} must contain 1 to ${maximum} characters.`);
  return cleaned;
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  if (Number.isNaN(Date.parse(cleaned)))
    throw new BrainContractError(`${field} must be an ISO date/time.`);
  return cleaned;
}

function score(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
    throw new BrainContractError(`${field} must be a number between 0 and 1.`);
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value))
    throw new BrainContractError(`${field} is invalid.`);
  return value as T;
}

function prefixedId<T extends string>(value: unknown, prefix: string, field: string): T {
  const cleaned = text(value, field, 300);
  if (!cleaned.startsWith(prefix) || cleaned.length === prefix.length)
    throw new BrainContractError(`${field} must start with ${prefix}.`);
  return cleaned as T;
}

export function parseBrainEvidenceRef(value: unknown): BrainEvidenceRef {
  const evidence = record(value, 'evidenceRef');
  exactKeys(
    evidence,
    ['sourceOwner', 'sourceObjectId', 'sourceVersion', 'sourceFingerprintSha256', 'observedAt'],
    'evidenceRef'
  );
  const fingerprint = text(
    evidence.sourceFingerprintSha256,
    'evidenceRef.sourceFingerprintSha256',
    64
  ).toLowerCase();
  if (!SHA256.test(fingerprint))
    throw new BrainContractError(
      'evidenceRef.sourceFingerprintSha256 must be a SHA-256 fingerprint.'
    );
  return {
    sourceOwner: enumValue(evidence.sourceOwner, brainSourceOwners, 'evidenceRef.sourceOwner'),
    sourceObjectId: text(evidence.sourceObjectId, 'evidenceRef.sourceObjectId', 500),
    sourceVersion: text(evidence.sourceVersion, 'evidenceRef.sourceVersion', 300),
    sourceFingerprintSha256: fingerprint,
    ...(evidence.observedAt === undefined
      ? {}
      : { observedAt: instant(evidence.observedAt, 'evidenceRef.observedAt') })
  };
}

export function parseBrainConfidence(value: unknown): BrainConfidence {
  const confidence = record(value, 'confidence');
  exactKeys(confidence, ['score', 'band', 'factors'], 'confidence');
  const factors = record(confidence.factors, 'confidence.factors');
  exactKeys(
    factors,
    ['authority', 'freshness', 'agreement', 'coverage', 'validation', 'methodQuality'],
    'confidence.factors'
  );
  const parsed: BrainConfidence = {
    score: score(confidence.score, 'confidence.score'),
    band: enumValue(
      confidence.band,
      ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const,
      'confidence.band'
    ),
    factors: {
      authority: score(factors.authority, 'confidence.factors.authority'),
      freshness: score(factors.freshness, 'confidence.factors.freshness'),
      agreement: score(factors.agreement, 'confidence.factors.agreement'),
      coverage: score(factors.coverage, 'confidence.factors.coverage'),
      validation: score(factors.validation, 'confidence.factors.validation'),
      methodQuality: score(factors.methodQuality, 'confidence.factors.methodQuality')
    }
  };
  return parsed;
}

export function parseBrainAssetVersion(value: unknown): BrainAssetVersion {
  const asset = record(value, 'brainAssetVersion');
  exactKeys(
    asset,
    [
      'schemaVersion',
      'brainAssetId',
      'brainAssetVersionId',
      'version',
      'assetType',
      'status',
      'scope',
      'evidenceRefs',
      'derivedFromBrainAssetVersionIds',
      'confidence',
      'payload',
      'createdAt',
      'validatedAt'
    ],
    'brainAssetVersion'
  );
  if (asset.schemaVersion !== 1) throw new BrainContractError('schemaVersion must be 1.');
  if (!Number.isSafeInteger(asset.version) || (asset.version as number) < 1)
    throw new BrainContractError('version must be a positive safe integer.');
  const scope = record(asset.scope, 'brainAssetVersion.scope');
  exactKeys(
    scope,
    [
      'domain',
      'jurisdiction',
      'concept',
      'inputSchemaId',
      'outputSchemaId',
      'effectiveFrom',
      'effectiveTo'
    ],
    'brainAssetVersion.scope'
  );
  const effectiveFrom = instant(scope.effectiveFrom, 'brainAssetVersion.scope.effectiveFrom');
  const effectiveTo =
    scope.effectiveTo === undefined
      ? undefined
      : instant(scope.effectiveTo, 'brainAssetVersion.scope.effectiveTo');
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom))
    throw new BrainContractError('scope.effectiveTo must be after scope.effectiveFrom.');
  if (!Array.isArray(asset.evidenceRefs))
    throw new BrainContractError('evidenceRefs must be an array.');
  const evidenceRefs = asset.evidenceRefs.map(parseBrainEvidenceRef);
  if (!Array.isArray(asset.derivedFromBrainAssetVersionIds))
    throw new BrainContractError('derivedFromBrainAssetVersionIds must be an array.');
  const derivedFromBrainAssetVersionIds = asset.derivedFromBrainAssetVersionIds.map((item) =>
    prefixedId<BrainAssetVersionId>(item, 'brain-asset-version_', 'derivedFromBrainAssetVersionId')
  );
  const status = enumValue(asset.status, brainAssetStatuses, 'status');
  const confidence = parseBrainConfidence(asset.confidence);
  const validatedAt =
    asset.validatedAt === undefined ? undefined : instant(asset.validatedAt, 'validatedAt');
  if (['VALIDATED', 'ACTIVE', 'DEGRADED'].includes(status)) {
    if (!evidenceRefs.length)
      throw new BrainContractError(`${status} Brain assets require at least one evidenceRef.`);
    if (!validatedAt) throw new BrainContractError(`${status} Brain assets require validatedAt.`);
    if (confidence.factors.validation <= 0)
      throw new BrainContractError(`${status} Brain assets require positive validation evidence.`);
  }
  return {
    schemaVersion: 1,
    brainAssetId: prefixedId<BrainAssetId>(asset.brainAssetId, 'brain-asset_', 'brainAssetId'),
    brainAssetVersionId: prefixedId<BrainAssetVersionId>(
      asset.brainAssetVersionId,
      'brain-asset-version_',
      'brainAssetVersionId'
    ),
    version: asset.version as number,
    assetType: enumValue(asset.assetType, brainAssetTypes, 'assetType'),
    status,
    scope: {
      domain: text(scope.domain, 'scope.domain', 200),
      ...(scope.jurisdiction === undefined
        ? {}
        : { jurisdiction: text(scope.jurisdiction, 'scope.jurisdiction', 100).toUpperCase() }),
      concept: text(scope.concept, 'scope.concept', 500),
      inputSchemaId: text(scope.inputSchemaId, 'scope.inputSchemaId', 300),
      outputSchemaId: text(scope.outputSchemaId, 'scope.outputSchemaId', 300),
      effectiveFrom,
      ...(effectiveTo ? { effectiveTo } : {})
    },
    evidenceRefs,
    derivedFromBrainAssetVersionIds,
    confidence,
    payload: structuredClone(asset.payload),
    createdAt: instant(asset.createdAt, 'createdAt'),
    ...(validatedAt ? { validatedAt } : {})
  };
}

export function parseBrainOperationalResolution(value: unknown): BrainOperationalResolution {
  const resolution = record(value, 'brainOperationalResolution');
  exactKeys(
    resolution,
    [
      'schemaVersion',
      'concept',
      'jurisdiction',
      'asOf',
      'status',
      'valueKind',
      'value',
      'brainAssetVersionId',
      'confidence',
      'evidenceRefs',
      'explanation'
    ],
    'brainOperationalResolution'
  );
  if (resolution.schemaVersion !== 1) throw new BrainContractError('schemaVersion must be 1.');
  const status = enumValue(
    resolution.status,
    brainOperationalResolutionStatuses,
    'brainOperationalResolution.status'
  );
  const valueKind = enumValue(
    resolution.valueKind,
    brainValueKinds,
    'brainOperationalResolution.valueKind'
  );
  if (!Array.isArray(resolution.evidenceRefs))
    throw new BrainContractError('brainOperationalResolution.evidenceRefs must be an array.');
  const evidenceRefs = resolution.evidenceRefs.map(parseBrainEvidenceRef);
  if (status === 'RESOLVED') {
    if (resolution.brainAssetVersionId === undefined || resolution.confidence === undefined)
      throw new BrainContractError('RESOLVED output requires asset attribution and confidence.');
    if (['UNKNOWN', 'INSUFFICIENT_EVIDENCE', 'CONFLICTED'].includes(valueKind))
      throw new BrainContractError('RESOLVED output requires a resolved value kind.');
  } else if (valueKind !== status) {
    throw new BrainContractError('Unresolved output status and valueKind must match.');
  }
  return {
    schemaVersion: 1,
    concept: text(resolution.concept, 'brainOperationalResolution.concept', 500),
    ...(resolution.jurisdiction === undefined
      ? {}
      : {
          jurisdiction: text(
            resolution.jurisdiction,
            'brainOperationalResolution.jurisdiction',
            100
          ).toUpperCase()
        }),
    asOf: instant(resolution.asOf, 'brainOperationalResolution.asOf'),
    status,
    valueKind,
    ...(resolution.value === undefined ? {} : { value: structuredClone(resolution.value) }),
    ...(resolution.brainAssetVersionId === undefined
      ? {}
      : {
          brainAssetVersionId: prefixedId<BrainAssetVersionId>(
            resolution.brainAssetVersionId,
            'brain-asset-version_',
            'brainOperationalResolution.brainAssetVersionId'
          )
        }),
    ...(resolution.confidence === undefined
      ? {}
      : { confidence: parseBrainConfidence(resolution.confidence) }),
    evidenceRefs,
    explanation: text(resolution.explanation, 'brainOperationalResolution.explanation', 4000)
  };
}
