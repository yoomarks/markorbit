export type BrainMethodId = `brain-method_${string}`;
export type BrainMethodVersionId = `brain-method-version_${string}`;
export type ExecutableMethodPackageId = `executable-method-package_${string}`;
export type BrainResearchMissionId = `brain-research-mission_${string}`;

export const brainMethodFamilies = [
  'RETRIEVAL',
  'SOURCE_RESOLUTION',
  'TEMPORAL_RESOLUTION',
  'CLASSIFICATION',
  'ENTITY_RESOLUTION',
  'RELATIONSHIP_INFERENCE',
  'AGGREGATION',
  'STATISTICAL_ANALYSIS',
  'SCORING',
  'RANKING',
  'RISK',
  'OPPORTUNITY',
  'EVALUATION_CALIBRATION',
  'METHOD_SELECTION'
] as const;
export type BrainMethodFamily = (typeof brainMethodFamilies)[number];

export const brainMethodLifecycleStates = [
  'DRAFT',
  'CANDIDATE',
  'VALIDATED',
  'ACTIVE',
  'DEGRADED',
  'RETIRED'
] as const;
export type BrainMethodLifecycleState = (typeof brainMethodLifecycleStates)[number];

export interface KnowledgeContentObjectRefV1 {
  protocolVersion: '1.0';
  objectType: 'CONTENT_OBJECT_REF';
  objectId: string;
  objectKind: string;
  workspaceId: string;
}

/**
 * Consumer-side lineage into the existing MarkOrbit Knowledge retrieval boundary.
 * This is not a second Knowledge source registry or authority.
 */
export interface KnowledgeRetrievalLineageRefV1 {
  schemaVersion: 1;
  sourceSystem: 'MARKORBIT_KNOWLEDGE';
  content: Readonly<KnowledgeContentObjectRefV1>;
  chunkId: string;
  contentSha256: string;
  indexedAt: string;
  indexMode: string;
  headingPath: readonly string[];
  retrievalRationale: string;
}

/** Exact consumer mirror of Data Engine ResearchDatasetRefV1 wire identity. */
export interface ResearchDatasetRefV1 {
  contract_version: 1;
  dataset_ref_id: `research-dataset_${string}`;
  engine_version: string;
  fact_schema_version: string;
  jurisdictions: readonly string[];
  resource_kinds: readonly string[];
  query: Readonly<Record<string, unknown>>;
  as_of: string | null;
  watermark: string | null;
  completeness: 'COMPLETE_BOUNDED' | 'COMPLETE_TO_WATERMARK' | 'PAGE_STREAM';
  pagination: Readonly<Record<string, unknown>> | null;
  aggregation: Readonly<Record<string, unknown>> | null;
  sampling: (Readonly<Record<string, unknown>> & { strategy: string; seed: number }) | null;
  partition: Readonly<Record<string, unknown>> | null;
  row_count: number;
  generated_at: string;
  query_fingerprint_sha256: string;
  integrity_sha256: string;
}

export interface MethodApplicabilityV1 {
  jurisdictions: readonly string[];
  authorities: readonly string[];
  objectTypes: readonly string[];
  operations: readonly string[];
  procedures: readonly string[];
  stages: readonly string[];
  filingBases: readonly string[];
  segments: readonly string[];
  requiredData: readonly string[];
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface BrainMethodEvaluationV1 {
  evaluationId: string;
  evaluatedAt: string;
  status: 'PASSED' | 'FAILED' | 'CONDITIONAL';
  baseline: string;
  metrics: Readonly<Record<string, number>>;
  evidenceSummary: string;
}

export interface BrainMethodFallbackV1 {
  behavior: 'NOT_APPLICABLE' | 'METHOD';
  fallbackMethodId?: BrainMethodId;
}

export interface BrainMethodLineageV1 {
  knowledgeSources: readonly Readonly<KnowledgeRetrievalLineageRefV1>[];
  researchDatasets: readonly Readonly<ResearchDatasetRefV1>[];
}

export interface BrainResearchMissionV1 {
  schemaVersion: 1;
  missionId: BrainResearchMissionId;
  capabilityDemand: string;
  problem: string;
  targetMethodFamily: BrainMethodFamily;
  applicabilityTarget: Readonly<MethodApplicabilityV1>;
  knowledgeResearchPlan: readonly string[];
  dataEngineResearchPlan: readonly string[];
  hypotheses: readonly string[];
  featurePlan: readonly string[];
  evaluationPlan: readonly string[];
  successMetrics: readonly string[];
  baselineMetrics: readonly string[];
  createdAt: string;
}

export interface BrainMethodContractV1 {
  schemaVersion: 1;
  methodId: BrainMethodId;
  methodVersionId: BrainMethodVersionId;
  methodFamily: BrainMethodFamily;
  version: number;
  purpose: string;
  targetObjectType: string;
  applicability: Readonly<MethodApplicabilityV1>;
  requiredInputs: readonly string[];
  featureDefinitions: readonly string[];
  algorithm: Readonly<Record<string, unknown>>;
  outputSchemaId: string;
  limitations: readonly string[];
  coverage: string;
  evaluation: Readonly<BrainMethodEvaluationV1>;
  fallback: Readonly<BrainMethodFallbackV1>;
  lineage: Readonly<BrainMethodLineageV1>;
  lifecycle: BrainMethodLifecycleState;
  supersedesMethodVersionIds: readonly BrainMethodVersionId[];
  createdAt: string;
  validatedAt?: string;
}

export interface ExecutableMethodPackageV1 {
  schemaVersion: 1;
  packageId: ExecutableMethodPackageId;
  packageVersion: number;
  methodId: BrainMethodId;
  methodVersionId: BrainMethodVersionId;
  methodFamily: BrainMethodFamily;
  lifecycle: BrainMethodLifecycleState;
  selectionPriority: number;
  applicability: Readonly<MethodApplicabilityV1>;
  inputSchemaId: string;
  outputSchemaId: string;
  executable: Readonly<Record<string, unknown>>;
  requiredData: readonly string[];
  referenceDependencies: readonly string[];
  reasonCodes: Readonly<Record<string, string>>;
  fallback: Readonly<BrainMethodFallbackV1>;
  evaluation: Readonly<BrainMethodEvaluationV1>;
  lineage: Readonly<BrainMethodLineageV1>;
  limitations: readonly string[];
  createdAt: string;
  activatedAt?: string;
}

export interface MethodSelectionContextV1 {
  methodFamily: BrainMethodFamily;
  jurisdiction: string;
  authority: string;
  objectType: string;
  operation: string;
  procedure: string;
  stage: string;
  filingBasis: string;
  segment: string;
  availableData: readonly string[];
  asOf: string;
}

export type MethodSelectionResultV1 =
  | {
      status: 'SELECTED';
      package: Readonly<ExecutableMethodPackageV1>;
      reason: string;
    }
  | {
      status: 'NOT_APPLICABLE';
      reason: string;
    }
  | {
      status: 'AMBIGUOUS';
      reason: string;
      packageIds: readonly ExecutableMethodPackageId[];
    };

export class BrainMethodContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'BrainMethodContractError';
  }
}

const SHA256 = /^[0-9a-f]{64}$/;

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BrainMethodContractError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function nullableRecord(value: unknown, field: string): Record<string, unknown> | null {
  return value === null ? null : record(value, field);
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allowedKeys = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unsupported.length) {
    throw new BrainMethodContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
  }
}

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string') throw new BrainMethodContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new BrainMethodContractError(`${field} must contain 1 to ${maximum} characters.`);
  }
  return cleaned;
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  if (Number.isNaN(Date.parse(cleaned))) {
    throw new BrainMethodContractError(`${field} must be an ISO date/time.`);
  }
  return cleaned;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    throw new BrainMethodContractError(`${field} is invalid.`);
  }
  return value as T;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new BrainMethodContractError(`${field} must be a positive safe integer.`);
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new BrainMethodContractError(`${field} must be a non-negative safe integer.`);
  }
  return value as number;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BrainMethodContractError(`${field} must be a finite number.`);
  }
  return value;
}

function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new BrainMethodContractError(`${field} must be a safe integer.`);
  }
  return value as number;
}

function prefixedId<T extends string>(value: unknown, prefix: string, field: string): T {
  const cleaned = text(value, field, 300);
  if (!cleaned.startsWith(prefix) || cleaned === prefix) {
    throw new BrainMethodContractError(`${field} must start with ${prefix}.`);
  }
  return cleaned as T;
}

function stringArray(
  value: unknown,
  field: string,
  options: { nonEmpty?: boolean; uppercase?: boolean } = {}
): string[] {
  if (!Array.isArray(value)) throw new BrainMethodContractError(`${field} must be an array.`);
  if (options.nonEmpty && value.length === 0) {
    throw new BrainMethodContractError(`${field} must not be empty.`);
  }
  const items = value.map((item, index) => text(item, `${field}[${index}]`, 500));
  const normalized = options.uppercase ? items.map((item) => item.toUpperCase()) : items;
  if (new Set(normalized).size !== normalized.length) {
    throw new BrainMethodContractError(`${field} must not contain duplicates.`);
  }
  return [...normalized].sort();
}

function sha256(value: unknown, field: string): string {
  const digest = text(value, field, 64).toLowerCase();
  if (!SHA256.test(digest)) {
    throw new BrainMethodContractError(`${field} must be a SHA-256 fingerprint.`);
  }
  return digest;
}

function parseKnowledgeContentObjectRefV1(value: unknown): KnowledgeContentObjectRefV1 {
  const content = record(value, 'knowledgeRetrievalLineage.content');
  exactKeys(
    content,
    ['protocolVersion', 'objectType', 'objectId', 'objectKind', 'workspaceId'],
    'knowledgeRetrievalLineage.content'
  );
  if (content.protocolVersion !== '1.0' || content.objectType !== 'CONTENT_OBJECT_REF') {
    throw new BrainMethodContractError(
      'knowledgeRetrievalLineage.content must be a Knowledge CONTENT_OBJECT_REF v1.0.'
    );
  }
  return {
    protocolVersion: '1.0',
    objectType: 'CONTENT_OBJECT_REF',
    objectId: text(content.objectId, 'knowledgeRetrievalLineage.content.objectId', 500),
    objectKind: text(content.objectKind, 'knowledgeRetrievalLineage.content.objectKind', 100),
    workspaceId: text(content.workspaceId, 'knowledgeRetrievalLineage.content.workspaceId', 500)
  };
}

export function parseKnowledgeRetrievalLineageRefV1(
  value: unknown
): KnowledgeRetrievalLineageRefV1 {
  const source = record(value, 'knowledgeRetrievalLineage');
  exactKeys(
    source,
    [
      'schemaVersion',
      'sourceSystem',
      'content',
      'chunkId',
      'contentSha256',
      'indexedAt',
      'indexMode',
      'headingPath',
      'retrievalRationale'
    ],
    'knowledgeRetrievalLineage'
  );
  if (source.schemaVersion !== 1 || source.sourceSystem !== 'MARKORBIT_KNOWLEDGE') {
    throw new BrainMethodContractError(
      'knowledgeRetrievalLineage must identify MARKORBIT_KNOWLEDGE schemaVersion 1.'
    );
  }
  return {
    schemaVersion: 1,
    sourceSystem: 'MARKORBIT_KNOWLEDGE',
    content: parseKnowledgeContentObjectRefV1(source.content),
    chunkId: text(source.chunkId, 'knowledgeRetrievalLineage.chunkId', 500),
    contentSha256: sha256(source.contentSha256, 'knowledgeRetrievalLineage.contentSha256'),
    indexedAt: instant(source.indexedAt, 'knowledgeRetrievalLineage.indexedAt'),
    indexMode: text(source.indexMode, 'knowledgeRetrievalLineage.indexMode', 300),
    headingPath: stringArray(source.headingPath, 'knowledgeRetrievalLineage.headingPath'),
    retrievalRationale: text(
      source.retrievalRationale,
      'knowledgeRetrievalLineage.retrievalRationale',
      1000
    )
  };
}

export function parseResearchDatasetRefV1(value: unknown): ResearchDatasetRefV1 {
  const dataset = record(value, 'researchDatasetRef');
  exactKeys(
    dataset,
    [
      'contract_version',
      'dataset_ref_id',
      'engine_version',
      'fact_schema_version',
      'jurisdictions',
      'resource_kinds',
      'query',
      'as_of',
      'watermark',
      'completeness',
      'pagination',
      'aggregation',
      'sampling',
      'partition',
      'row_count',
      'generated_at',
      'query_fingerprint_sha256',
      'integrity_sha256'
    ],
    'researchDatasetRef'
  );
  if (dataset.contract_version !== 1) {
    throw new BrainMethodContractError('researchDatasetRef.contract_version must be 1.');
  }

  const queryFingerprint = sha256(
    dataset.query_fingerprint_sha256,
    'researchDatasetRef.query_fingerprint_sha256'
  );
  const datasetRefId = prefixedId<`research-dataset_${string}`>(
    dataset.dataset_ref_id,
    'research-dataset_',
    'researchDatasetRef.dataset_ref_id'
  );
  if (datasetRefId !== `research-dataset_${queryFingerprint}`) {
    throw new BrainMethodContractError(
      'researchDatasetRef.dataset_ref_id must match query_fingerprint_sha256.'
    );
  }

  const asOf = dataset.as_of === null ? null : instant(dataset.as_of, 'researchDatasetRef.as_of');
  const watermark =
    dataset.watermark === null
      ? null
      : text(dataset.watermark, 'researchDatasetRef.watermark', 500);
  if ((asOf === null) === (watermark === null)) {
    throw new BrainMethodContractError(
      'researchDatasetRef requires exactly one of as_of or watermark.'
    );
  }

  const samplingRecord = nullableRecord(dataset.sampling, 'researchDatasetRef.sampling');
  let sampling: ResearchDatasetRefV1['sampling'] = null;
  if (samplingRecord) {
    const strategy = text(samplingRecord.strategy, 'researchDatasetRef.sampling.strategy', 300);
    const seed = integer(samplingRecord.seed, 'researchDatasetRef.sampling.seed');
    sampling = { ...samplingRecord, strategy, seed };
  }

  return {
    contract_version: 1,
    dataset_ref_id: datasetRefId,
    engine_version: text(dataset.engine_version, 'researchDatasetRef.engine_version', 200),
    fact_schema_version: text(
      dataset.fact_schema_version,
      'researchDatasetRef.fact_schema_version',
      200
    ),
    jurisdictions: stringArray(dataset.jurisdictions, 'researchDatasetRef.jurisdictions', {
      nonEmpty: true,
      uppercase: true
    }),
    resource_kinds: stringArray(dataset.resource_kinds, 'researchDatasetRef.resource_kinds', {
      nonEmpty: true
    }),
    query: record(dataset.query, 'researchDatasetRef.query'),
    as_of: asOf,
    watermark,
    completeness: enumValue(
      dataset.completeness,
      ['COMPLETE_BOUNDED', 'COMPLETE_TO_WATERMARK', 'PAGE_STREAM'] as const,
      'researchDatasetRef.completeness'
    ),
    pagination: nullableRecord(dataset.pagination, 'researchDatasetRef.pagination'),
    aggregation: nullableRecord(dataset.aggregation, 'researchDatasetRef.aggregation'),
    sampling,
    partition: nullableRecord(dataset.partition, 'researchDatasetRef.partition'),
    row_count: nonNegativeInteger(dataset.row_count, 'researchDatasetRef.row_count'),
    generated_at: instant(dataset.generated_at, 'researchDatasetRef.generated_at'),
    query_fingerprint_sha256: queryFingerprint,
    integrity_sha256: sha256(dataset.integrity_sha256, 'researchDatasetRef.integrity_sha256')
  };
}

export function parseMethodApplicabilityV1(value: unknown): MethodApplicabilityV1 {
  const applicability = record(value, 'applicability');
  exactKeys(
    applicability,
    [
      'jurisdictions',
      'authorities',
      'objectTypes',
      'operations',
      'procedures',
      'stages',
      'filingBases',
      'segments',
      'requiredData',
      'effectiveFrom',
      'effectiveTo'
    ],
    'applicability'
  );
  const effectiveFrom = instant(applicability.effectiveFrom, 'applicability.effectiveFrom');
  const effectiveTo =
    applicability.effectiveTo === undefined
      ? undefined
      : instant(applicability.effectiveTo, 'applicability.effectiveTo');
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
    throw new BrainMethodContractError('applicability.effectiveTo must be after effectiveFrom.');
  }
  return {
    jurisdictions: stringArray(applicability.jurisdictions, 'applicability.jurisdictions', {
      nonEmpty: true,
      uppercase: true
    }),
    authorities: stringArray(applicability.authorities, 'applicability.authorities', {
      nonEmpty: true,
      uppercase: true
    }),
    objectTypes: stringArray(applicability.objectTypes, 'applicability.objectTypes', {
      nonEmpty: true,
      uppercase: true
    }),
    operations: stringArray(applicability.operations, 'applicability.operations', {
      nonEmpty: true,
      uppercase: true
    }),
    procedures: stringArray(applicability.procedures, 'applicability.procedures', {
      nonEmpty: true,
      uppercase: true
    }),
    stages: stringArray(applicability.stages, 'applicability.stages', {
      nonEmpty: true,
      uppercase: true
    }),
    filingBases: stringArray(applicability.filingBases, 'applicability.filingBases', {
      nonEmpty: true,
      uppercase: true
    }),
    segments: stringArray(applicability.segments, 'applicability.segments', {
      nonEmpty: true,
      uppercase: true
    }),
    requiredData: stringArray(applicability.requiredData, 'applicability.requiredData'),
    effectiveFrom,
    ...(effectiveTo ? { effectiveTo } : {})
  };
}

export function parseBrainMethodEvaluationV1(value: unknown): BrainMethodEvaluationV1 {
  const evaluation = record(value, 'evaluation');
  exactKeys(
    evaluation,
    ['evaluationId', 'evaluatedAt', 'status', 'baseline', 'metrics', 'evidenceSummary'],
    'evaluation'
  );
  const metrics = record(evaluation.metrics, 'evaluation.metrics');
  if (!Object.keys(metrics).length) {
    throw new BrainMethodContractError('evaluation.metrics must not be empty.');
  }
  const parsedMetrics: Record<string, number> = {};
  for (const [key, metric] of Object.entries(metrics)) {
    parsedMetrics[text(key, 'evaluation.metrics key', 200)] = finiteNumber(
      metric,
      `evaluation.metrics.${key}`
    );
  }
  return {
    evaluationId: text(evaluation.evaluationId, 'evaluation.evaluationId', 500),
    evaluatedAt: instant(evaluation.evaluatedAt, 'evaluation.evaluatedAt'),
    status: enumValue(
      evaluation.status,
      ['PASSED', 'FAILED', 'CONDITIONAL'] as const,
      'evaluation.status'
    ),
    baseline: text(evaluation.baseline, 'evaluation.baseline', 1000),
    metrics: parsedMetrics,
    evidenceSummary: text(evaluation.evidenceSummary, 'evaluation.evidenceSummary', 2000)
  };
}

export function parseBrainMethodFallbackV1(value: unknown): BrainMethodFallbackV1 {
  const fallback = record(value, 'fallback');
  exactKeys(fallback, ['behavior', 'fallbackMethodId'], 'fallback');
  const behavior = enumValue(
    fallback.behavior,
    ['NOT_APPLICABLE', 'METHOD'] as const,
    'fallback.behavior'
  );
  if (behavior === 'METHOD') {
    return {
      behavior,
      fallbackMethodId: prefixedId<BrainMethodId>(
        fallback.fallbackMethodId,
        'brain-method_',
        'fallback.fallbackMethodId'
      )
    };
  }
  if (fallback.fallbackMethodId !== undefined) {
    throw new BrainMethodContractError(
      'fallback.fallbackMethodId is only allowed when behavior is METHOD.'
    );
  }
  return { behavior };
}

export function parseBrainMethodLineageV1(value: unknown): BrainMethodLineageV1 {
  const lineage = record(value, 'lineage');
  exactKeys(lineage, ['knowledgeSources', 'researchDatasets'], 'lineage');
  if (!Array.isArray(lineage.knowledgeSources) || !Array.isArray(lineage.researchDatasets)) {
    throw new BrainMethodContractError('lineage sources must be arrays.');
  }
  const knowledgeSources = lineage.knowledgeSources.map(parseKnowledgeRetrievalLineageRefV1);
  const researchDatasets = lineage.researchDatasets.map(parseResearchDatasetRefV1);
  if (!knowledgeSources.length && !researchDatasets.length) {
    throw new BrainMethodContractError(
      'lineage requires at least one Knowledge or Data Engine source.'
    );
  }
  return { knowledgeSources, researchDatasets };
}

export function parseBrainResearchMissionV1(value: unknown): BrainResearchMissionV1 {
  const mission = record(value, 'brainResearchMission');
  exactKeys(
    mission,
    [
      'schemaVersion',
      'missionId',
      'capabilityDemand',
      'problem',
      'targetMethodFamily',
      'applicabilityTarget',
      'knowledgeResearchPlan',
      'dataEngineResearchPlan',
      'hypotheses',
      'featurePlan',
      'evaluationPlan',
      'successMetrics',
      'baselineMetrics',
      'createdAt'
    ],
    'brainResearchMission'
  );
  if (mission.schemaVersion !== 1) {
    throw new BrainMethodContractError('brainResearchMission.schemaVersion must be 1.');
  }
  const knowledgeResearchPlan = stringArray(
    mission.knowledgeResearchPlan,
    'brainResearchMission.knowledgeResearchPlan'
  );
  const dataEngineResearchPlan = stringArray(
    mission.dataEngineResearchPlan,
    'brainResearchMission.dataEngineResearchPlan'
  );
  if (!knowledgeResearchPlan.length && !dataEngineResearchPlan.length) {
    throw new BrainMethodContractError(
      'brainResearchMission requires a Knowledge and/or Data Engine research plan.'
    );
  }
  return {
    schemaVersion: 1,
    missionId: prefixedId<BrainResearchMissionId>(
      mission.missionId,
      'brain-research-mission_',
      'brainResearchMission.missionId'
    ),
    capabilityDemand: text(mission.capabilityDemand, 'brainResearchMission.capabilityDemand', 1000),
    problem: text(mission.problem, 'brainResearchMission.problem', 2000),
    targetMethodFamily: enumValue(
      mission.targetMethodFamily,
      brainMethodFamilies,
      'brainResearchMission.targetMethodFamily'
    ),
    applicabilityTarget: parseMethodApplicabilityV1(mission.applicabilityTarget),
    knowledgeResearchPlan,
    dataEngineResearchPlan,
    hypotheses: stringArray(mission.hypotheses, 'brainResearchMission.hypotheses', {
      nonEmpty: true
    }),
    featurePlan: stringArray(mission.featurePlan, 'brainResearchMission.featurePlan'),
    evaluationPlan: stringArray(mission.evaluationPlan, 'brainResearchMission.evaluationPlan', {
      nonEmpty: true
    }),
    successMetrics: stringArray(mission.successMetrics, 'brainResearchMission.successMetrics', {
      nonEmpty: true
    }),
    baselineMetrics: stringArray(mission.baselineMetrics, 'brainResearchMission.baselineMetrics', {
      nonEmpty: true
    }),
    createdAt: instant(mission.createdAt, 'brainResearchMission.createdAt')
  };
}

function parseMethodCore(
  value: Record<string, unknown>
): Pick<
  BrainMethodContractV1,
  | 'methodId'
  | 'methodVersionId'
  | 'methodFamily'
  | 'version'
  | 'purpose'
  | 'targetObjectType'
  | 'applicability'
  | 'requiredInputs'
  | 'featureDefinitions'
  | 'algorithm'
  | 'outputSchemaId'
  | 'limitations'
  | 'coverage'
  | 'evaluation'
  | 'fallback'
  | 'lineage'
  | 'lifecycle'
  | 'supersedesMethodVersionIds'
  | 'createdAt'
  | 'validatedAt'
> {
  const lifecycle = enumValue(value.lifecycle, brainMethodLifecycleStates, 'brainMethod.lifecycle');
  const evaluation = parseBrainMethodEvaluationV1(value.evaluation);
  const validatedAt =
    value.validatedAt === undefined
      ? undefined
      : instant(value.validatedAt, 'brainMethod.validatedAt');
  if (['VALIDATED', 'ACTIVE', 'DEGRADED'].includes(lifecycle)) {
    if (!validatedAt) {
      throw new BrainMethodContractError(`${lifecycle} Brain methods require validatedAt.`);
    }
    if (evaluation.status === 'FAILED') {
      throw new BrainMethodContractError(
        `${lifecycle} Brain methods cannot carry FAILED evaluation.`
      );
    }
  }
  const algorithm = record(value.algorithm, 'brainMethod.algorithm');
  if (!Object.keys(algorithm).length) {
    throw new BrainMethodContractError('brainMethod.algorithm must not be empty.');
  }
  return {
    methodId: prefixedId<BrainMethodId>(value.methodId, 'brain-method_', 'brainMethod.methodId'),
    methodVersionId: prefixedId<BrainMethodVersionId>(
      value.methodVersionId,
      'brain-method-version_',
      'brainMethod.methodVersionId'
    ),
    methodFamily: enumValue(value.methodFamily, brainMethodFamilies, 'brainMethod.methodFamily'),
    version: positiveInteger(value.version, 'brainMethod.version'),
    purpose: text(value.purpose, 'brainMethod.purpose', 2000),
    targetObjectType: text(
      value.targetObjectType,
      'brainMethod.targetObjectType',
      300
    ).toUpperCase(),
    applicability: parseMethodApplicabilityV1(value.applicability),
    requiredInputs: stringArray(value.requiredInputs, 'brainMethod.requiredInputs', {
      nonEmpty: true
    }),
    featureDefinitions: stringArray(value.featureDefinitions, 'brainMethod.featureDefinitions'),
    algorithm,
    outputSchemaId: text(value.outputSchemaId, 'brainMethod.outputSchemaId', 300),
    limitations: stringArray(value.limitations, 'brainMethod.limitations', { nonEmpty: true }),
    coverage: text(value.coverage, 'brainMethod.coverage', 2000),
    evaluation,
    fallback: parseBrainMethodFallbackV1(value.fallback),
    lineage: parseBrainMethodLineageV1(value.lineage),
    lifecycle,
    supersedesMethodVersionIds: stringArray(
      value.supersedesMethodVersionIds,
      'brainMethod.supersedesMethodVersionIds'
    ).map((item) =>
      prefixedId<BrainMethodVersionId>(
        item,
        'brain-method-version_',
        'brainMethod.supersedesMethodVersionIds[]'
      )
    ),
    createdAt: instant(value.createdAt, 'brainMethod.createdAt'),
    ...(validatedAt ? { validatedAt } : {})
  };
}

export function parseBrainMethodContractV1(value: unknown): BrainMethodContractV1 {
  const method = record(value, 'brainMethod');
  exactKeys(
    method,
    [
      'schemaVersion',
      'methodId',
      'methodVersionId',
      'methodFamily',
      'version',
      'purpose',
      'targetObjectType',
      'applicability',
      'requiredInputs',
      'featureDefinitions',
      'algorithm',
      'outputSchemaId',
      'limitations',
      'coverage',
      'evaluation',
      'fallback',
      'lineage',
      'lifecycle',
      'supersedesMethodVersionIds',
      'createdAt',
      'validatedAt'
    ],
    'brainMethod'
  );
  if (method.schemaVersion !== 1) {
    throw new BrainMethodContractError('brainMethod.schemaVersion must be 1.');
  }
  return { schemaVersion: 1, ...parseMethodCore(method) };
}

export function parseExecutableMethodPackageV1(value: unknown): ExecutableMethodPackageV1 {
  const pkg = record(value, 'executableMethodPackage');
  exactKeys(
    pkg,
    [
      'schemaVersion',
      'packageId',
      'packageVersion',
      'methodId',
      'methodVersionId',
      'methodFamily',
      'lifecycle',
      'selectionPriority',
      'applicability',
      'inputSchemaId',
      'outputSchemaId',
      'executable',
      'requiredData',
      'referenceDependencies',
      'reasonCodes',
      'fallback',
      'evaluation',
      'lineage',
      'limitations',
      'createdAt',
      'activatedAt'
    ],
    'executableMethodPackage'
  );
  if (pkg.schemaVersion !== 1) {
    throw new BrainMethodContractError('executableMethodPackage.schemaVersion must be 1.');
  }
  const lifecycle = enumValue(
    pkg.lifecycle,
    brainMethodLifecycleStates,
    'executableMethodPackage.lifecycle'
  );
  const activatedAt =
    pkg.activatedAt === undefined
      ? undefined
      : instant(pkg.activatedAt, 'executableMethodPackage.activatedAt');
  if (lifecycle === 'ACTIVE' && !activatedAt) {
    throw new BrainMethodContractError('ACTIVE executable method packages require activatedAt.');
  }
  const executable = record(pkg.executable, 'executableMethodPackage.executable');
  if (!Object.keys(executable).length) {
    throw new BrainMethodContractError('executableMethodPackage.executable must not be empty.');
  }
  const reasonCodes = record(pkg.reasonCodes, 'executableMethodPackage.reasonCodes');
  if (!Object.keys(reasonCodes).length) {
    throw new BrainMethodContractError('executableMethodPackage.reasonCodes must not be empty.');
  }
  const parsedReasonCodes: Record<string, string> = {};
  for (const [key, reason] of Object.entries(reasonCodes)) {
    parsedReasonCodes[text(key, 'executableMethodPackage.reasonCode key', 200)] = text(
      reason,
      `executableMethodPackage.reasonCodes.${key}`,
      1000
    );
  }
  return {
    schemaVersion: 1,
    packageId: prefixedId<ExecutableMethodPackageId>(
      pkg.packageId,
      'executable-method-package_',
      'executableMethodPackage.packageId'
    ),
    packageVersion: positiveInteger(pkg.packageVersion, 'executableMethodPackage.packageVersion'),
    methodId: prefixedId<BrainMethodId>(
      pkg.methodId,
      'brain-method_',
      'executableMethodPackage.methodId'
    ),
    methodVersionId: prefixedId<BrainMethodVersionId>(
      pkg.methodVersionId,
      'brain-method-version_',
      'executableMethodPackage.methodVersionId'
    ),
    methodFamily: enumValue(
      pkg.methodFamily,
      brainMethodFamilies,
      'executableMethodPackage.methodFamily'
    ),
    lifecycle,
    selectionPriority: nonNegativeInteger(
      pkg.selectionPriority,
      'executableMethodPackage.selectionPriority'
    ),
    applicability: parseMethodApplicabilityV1(pkg.applicability),
    inputSchemaId: text(pkg.inputSchemaId, 'executableMethodPackage.inputSchemaId', 300),
    outputSchemaId: text(pkg.outputSchemaId, 'executableMethodPackage.outputSchemaId', 300),
    executable,
    requiredData: stringArray(pkg.requiredData, 'executableMethodPackage.requiredData'),
    referenceDependencies: stringArray(
      pkg.referenceDependencies,
      'executableMethodPackage.referenceDependencies'
    ),
    reasonCodes: parsedReasonCodes,
    fallback: parseBrainMethodFallbackV1(pkg.fallback),
    evaluation: parseBrainMethodEvaluationV1(pkg.evaluation),
    lineage: parseBrainMethodLineageV1(pkg.lineage),
    limitations: stringArray(pkg.limitations, 'executableMethodPackage.limitations', {
      nonEmpty: true
    }),
    createdAt: instant(pkg.createdAt, 'executableMethodPackage.createdAt'),
    ...(activatedAt ? { activatedAt } : {})
  };
}

function normalized(value: string): string {
  return value.trim().toUpperCase();
}

function includesNormalized(values: readonly string[], value: string): boolean {
  return values.includes(normalized(value));
}

function effectiveAt(applicability: Readonly<MethodApplicabilityV1>, asOf: string): boolean {
  const timestamp = Date.parse(asOf);
  if (Number.isNaN(timestamp))
    throw new BrainMethodContractError('selectionContext.asOf must be an ISO date/time.');
  const from = Date.parse(applicability.effectiveFrom);
  const to = applicability.effectiveTo
    ? Date.parse(applicability.effectiveTo)
    : Number.POSITIVE_INFINITY;
  return from <= timestamp && timestamp < to;
}

function applicable(
  pkg: Readonly<ExecutableMethodPackageV1>,
  context: Readonly<MethodSelectionContextV1>
): boolean {
  const scope = pkg.applicability;
  const available = new Set(context.availableData.map((item) => normalized(item)));
  return (
    pkg.lifecycle === 'ACTIVE' &&
    pkg.methodFamily === context.methodFamily &&
    effectiveAt(scope, context.asOf) &&
    includesNormalized(scope.jurisdictions, context.jurisdiction) &&
    includesNormalized(scope.authorities, context.authority) &&
    includesNormalized(scope.objectTypes, context.objectType) &&
    includesNormalized(scope.operations, context.operation) &&
    includesNormalized(scope.procedures, context.procedure) &&
    includesNormalized(scope.stages, context.stage) &&
    includesNormalized(scope.filingBases, context.filingBasis) &&
    includesNormalized(scope.segments, context.segment) &&
    scope.requiredData.every((item) => available.has(normalized(item))) &&
    pkg.requiredData.every((item) => available.has(normalized(item)))
  );
}

export function selectExecutableMethodPackageV1(
  packages: readonly unknown[],
  contextValue: Readonly<MethodSelectionContextV1>
): MethodSelectionResultV1 {
  const context: MethodSelectionContextV1 = {
    methodFamily: enumValue(
      contextValue.methodFamily,
      brainMethodFamilies,
      'selectionContext.methodFamily'
    ),
    jurisdiction: text(
      contextValue.jurisdiction,
      'selectionContext.jurisdiction',
      100
    ).toUpperCase(),
    authority: text(contextValue.authority, 'selectionContext.authority', 200).toUpperCase(),
    objectType: text(contextValue.objectType, 'selectionContext.objectType', 200).toUpperCase(),
    operation: text(contextValue.operation, 'selectionContext.operation', 200).toUpperCase(),
    procedure: text(contextValue.procedure, 'selectionContext.procedure', 200).toUpperCase(),
    stage: text(contextValue.stage, 'selectionContext.stage', 200).toUpperCase(),
    filingBasis: text(contextValue.filingBasis, 'selectionContext.filingBasis', 200).toUpperCase(),
    segment: text(contextValue.segment, 'selectionContext.segment', 200).toUpperCase(),
    availableData: stringArray(contextValue.availableData, 'selectionContext.availableData', {
      uppercase: true
    }),
    asOf: instant(contextValue.asOf, 'selectionContext.asOf')
  };
  const parsed = packages.map(parseExecutableMethodPackageV1);
  const candidates = parsed.filter((pkg) => applicable(pkg, context));
  if (!candidates.length) {
    return {
      status: 'NOT_APPLICABLE',
      reason: 'No ACTIVE executable method package matches the request scope and available data.'
    };
  }
  const highestPriority = Math.max(...candidates.map((pkg) => pkg.selectionPriority));
  const top = candidates.filter((pkg) => pkg.selectionPriority === highestPriority);
  if (top.length > 1) {
    return {
      status: 'AMBIGUOUS',
      reason: 'Multiple applicable ACTIVE packages share the highest explicit selection priority.',
      packageIds: top.map((pkg) => pkg.packageId).sort()
    };
  }
  return {
    status: 'SELECTED',
    package: top[0]!,
    reason:
      'Selected the only applicable ACTIVE package at the highest explicit selection priority.'
  };
}
