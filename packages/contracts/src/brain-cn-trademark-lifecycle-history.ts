import {
  BrainMethodContractError,
  parseBrainMethodContractV1,
  parseExecutableMethodPackageV1,
  parseMethodApplicabilityV1,
  type BrainMethodContractV1,
  type ExecutableMethodPackageV1,
  type MethodApplicabilityV1
} from './brain-method.js';
import {
  brainMethodFingerprintV1,
  executableMethodPackageFingerprintV1
} from './brain-method-activation.js';
import { CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION } from './data-engine-discovery.js';
import {
  trademarkLifecycleRulePackApplicabilityFingerprintSha256V1,
  type TrademarkLifecycleComputationInputV1,
  type TrademarkLifecycleComputationResultV1
} from './trademark-lifecycle.js';

export const CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_KIND =
  'CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_CANDIDATE_V1' as const;
export const CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FAMILY = 'TEMPORAL_RESOLUTION' as const;
export const CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_KIND =
  'CN_SOURCE_RECORDED_COMPLETED_HISTORY_TEMPORAL_RESOLUTION_V1' as const;
export const CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID =
  'brain-input.cn-trademark-lifecycle-history.v1' as const;
export const CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID =
  'brain.cn-trademark-lifecycle-history.v1' as const;
export const CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_ID =
  'brain-method_cn-trademark-lifecycle-source-recorded-history' as const;
export const CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_VERSION_ID =
  'brain-method-version_cn-trademark-lifecycle-source-recorded-history-v1' as const;
export const CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_ID =
  'executable-method-package_cn-lifecycle-observed-history-candidate-v1' as const;

export const CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA = [
  'CNIPA_SOURCE_READ_STATE',
  'FILING_DATE_OBSERVATION_RECORD',
  'PRELIMINARY_PUBLICATION_DATE_OBSERVATION_RECORD'
] as const;

export const CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_V1: Readonly<MethodApplicabilityV1> =
  parseMethodApplicabilityV1({
    jurisdictions: ['CN'],
    authorities: ['CNIPA'],
    objectTypes: ['TRADEMARK_APPLICATION'],
    operations: ['PROJECT_TRADEMARK_LIFECYCLE'],
    procedures: ['FILING_TO_PRELIMINARY_PUBLICATION'],
    stages: ['SOURCE_RECORDED_COMPLETED_HISTORY'],
    filingBases: ['ANY'],
    segments: ['SOURCE_RECORDED_COMPLETED_HISTORY'],
    requiredData: CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA,
    effectiveFrom: '2026-10-10T00:00:00.000Z'
  });

export const CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256 =
  trademarkLifecycleRulePackApplicabilityFingerprintSha256V1(
    CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_V1
  );

export const CN_TRADEMARK_LIFECYCLE_HISTORY_REASON_CODES = {
  SOURCE_RECORDED_HISTORY_COMPUTED:
    'Exact owner-observed filing or preliminary-publication facts produced source-recorded historical nodes only.',
  PARTIAL_SOURCE_RECORDED_HISTORY:
    'Only one of the two source-recorded historical dates is available; the missing observation remains explicit.',
  FILING_DATE_NOT_AVAILABLE:
    'The filing-date observation record does not carry one unconflicted AVAILABLE owner-observed value.',
  PRELIMINARY_PUBLICATION_DATE_NOT_AVAILABLE:
    'The preliminary-publication-date observation record does not carry one unconflicted AVAILABLE owner-observed value.',
  CURRENT_POSITION_NOT_INFERRED:
    'Source-recorded completed history does not establish the application current position.',
  NO_SOURCE_RECORDED_DATE_AVAILABLE:
    'No available source-recorded filing or preliminary-publication date was present in the exact normalized input.',
  SOURCE_OBSERVATION_CONFLICT:
    'Conflicting owner observations remain explicit and do not produce a preferred historical date.',
  SOURCE_OBSERVATION_STALE:
    'Owner-observed history is stale at the exact computation time and remains visibly stale.',
  SOURCE_FACT_NOT_OBSERVED_WITHOUT_COMPLETE_SCOPE_EVIDENCE:
    'The source owner did not observe the exact scope; this is not an empty or negative fact.',
  SOURCE_SCOPE_NOT_COVERED: 'The source owner does not cover the exact requested scope.',
  SOURCE_READ_UNAVAILABLE:
    'The exact source read was unavailable, so this computation cannot produce source-backed lifecycle history.',
  SOURCE_DEPENDENCY_UNAVAILABLE:
    'The exact source dependency was unavailable and no history may be inferred.',
  EMPTY_NOT_ADMITTED:
    'Lifecycle EMPTY remains unavailable until separately admitted complete exact-scope source evidence exists.',
  NOT_APPLICABLE:
    'The request is outside the exact CN/CNIPA source-recorded completed-history applicability.'
} as const;

export const CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS = [
  'AVAILABLE completed-history facts cannot occur after input.asOf; paired filing and preliminary-publication facts must use the same precision and time zone and cannot be chronologically inverted.',
  'Applies only to CN / CNIPA / TRADEMARK_APPLICATION / PROJECT_TRADEMARK_LIFECYCLE / FILING_TO_PRELIMINARY_PUBLICATION / ANY / SOURCE_RECORDED_COMPLETED_HISTORY.',
  'Knowledge lineage identifies the frozen A2a computation-contract source only; it is not source-owner evidence, Method activation, Capability admission or professional review.',
  'NOT_OBSERVED, NOT_COVERED and UNAVAILABLE produce the strict TrademarkLifecycleComputationResultV1 NOT_COMPUTED branch with their exact closed semantics; EMPTY is not accepted by the lifecycle computation boundary.',
  'Only exact owner-observed facts admitted by TrademarkLifecycleComputationInputV1 may produce OCCURRED historical nodes and source-recorded time assertions.',
  'Required data names bind source-read state plus filing-date and preliminary-publication-date observation records; neither date is required to have an AVAILABLE value.',
  'The Data Engine V3 receipt contract validates structure and integrity but does not authenticate its external issuer or prove production source admission.',
  'The method does not infer current position, a future path, legal deadline, grace period, probability, prediction, recommendation, destination, CTA, work state or execution authority.',
  'This V1 candidate requires exactly one exact-scope DATA_ENGINE source read.',
  'This package is VALIDATED candidate evidence only; it is not ACTIVE, carries no activation decision and is not eligible for ordinary runtime selection.',
  'computedAt is supplied by the enclosing Capability request receivedAt; the executable does not read a wall clock.'
] as const;

export const CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1 = {
  kind: CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_KIND,
  inputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID,
  outputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID,
  applicabilityFingerprintSha256: CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256,
  sourceReadReceiptContractVersion: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION,
  sourceReadOwner: 'DATA_ENGINE',
  acceptedSourceReadStates: ['OBSERVED', 'NOT_OBSERVED', 'NOT_COVERED', 'UNAVAILABLE'],
  rejectedSourceReadStates: ['EMPTY'],
  observationMappings: [
    {
      factCode: 'FILING_DATE',
      stageCode: 'FILING',
      milestoneCode: 'APPLICATION_FILED'
    },
    {
      factCode: 'PRELIMINARY_PUBLICATION_DATE',
      stageCode: 'PRELIMINARY_PUBLICATION',
      milestoneCode: 'PRELIMINARY_PUBLICATION_RECORDED'
    }
  ],
  computedAtSource: 'CAPABILITY_REQUEST_RECEIVED_AT',
  emittedNodeState: 'OCCURRED',
  emittedTimeClass: 'SOURCE_RECORDED',
  emittedTimePresentationMeaning: 'RECORDED_FACT',
  legalDeadlineCertified: false,
  currentPositionInference: false,
  futurePathInference: false,
  deadlineCalculation: false,
  gracePeriodCalculation: false,
  prediction: false,
  recommendation: false,
  destinationOrCtaAuthority: false,
  persistenceAuthority: false
} as const;

export type CnTrademarkLifecycleHistoryExecutableV1 =
  typeof CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1;

const evaluation = {
  evaluationId: 'evaluation_cn-trademark-lifecycle-source-recorded-history-candidate-v1',
  evaluatedAt: '2026-10-10T00:00:00.000Z',
  status: 'PASSED',
  baseline: 'exact-observed-history-contract-v1 / no-inference-no-authority-v1',
  metrics: {
    exactApplicabilityContractRate: 1,
    deterministicSchemaBindingRate: 1,
    sourceRecordedHistoricalOnlyRate: 1,
    currentPositionInferenceRate: 0,
    futureOrDeadlineClaimRate: 0,
    recommendationOrActionAuthorityRate: 0,
    persistenceAuthorityRate: 0
  },
  evidenceSummary:
    'Candidate-level contract and fixture validation binds the exact CN observed-history slice to the existing lifecycle computation input and COMPUTED | NOT_COMPUTED result schemas. This evaluation is not Method activation, Capability admission, source promotion or production evidence.'
} as const;

const lineage = {
  knowledgeSources: [
    {
      schemaVersion: 1,
      sourceSystem: 'MARKORBIT_KNOWLEDGE',
      content: {
        protocolVersion: '1.0',
        objectType: 'CONTENT_OBJECT_REF',
        objectId: 'knowledge-content_mo-trademark-lifecycle-lcr-a2a-computation-contract',
        objectKind: 'REPOSITORY_CANONICAL_RECORD',
        workspaceId: 'markorbit-product-canon'
      },
      chunkId: 'lcr-a2a-computation-contract/full-document',
      contentSha256: '00e517902d1d65f3a28d641e91d9884a4b4239f7494ca334d8035baac27ab04a',
      indexedAt: '2026-10-10T00:00:00.000Z',
      indexMode: 'EXACT_DOCUMENT_SNAPSHOT',
      headingPath: ['LCR-A2a computation contract'],
      retrievalRationale:
        'Bind the candidate to the frozen transient lifecycle computation contract; this lineage does not claim source-owner or governance authority.'
    }
  ],
  researchDatasets: []
} as const;

export const CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_V1: Readonly<BrainMethodContractV1> =
  parseBrainMethodContractV1({
    schemaVersion: 1,
    methodId: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_ID,
    methodVersionId: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_VERSION_ID,
    methodFamily: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FAMILY,
    version: 1,
    purpose:
      'Map exact owner-observed CN filing and preliminary-publication dates to transient source-recorded completed history without inferring current or future lifecycle state.',
    targetObjectType: 'TRADEMARK_APPLICATION',
    applicability: CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_V1,
    requiredInputs: [
      'TrademarkLifecycleComputationInputV1',
      'CapabilityRequestV2.receivedAt',
      ...CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA
    ],
    featureDefinitions: [
      'exact Data Engine source-read state retained without collapsing NOT_OBSERVED, NOT_COVERED or UNAVAILABLE',
      'FILING_DATE observation record with AVAILABLE, UNKNOWN or CONFLICTING value state',
      'PRELIMINARY_PUBLICATION_DATE observation record with AVAILABLE, UNKNOWN or CONFLICTING value state',
      'exact owner source references retained by each emitted historical node',
      'deterministic computation time supplied by CapabilityRequestV2.receivedAt'
    ],
    algorithm: CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1,
    outputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID,
    limitations: CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS,
    coverage:
      'CN / CNIPA / trademark application / filing to preliminary publication / basis ANY / source-recorded completed history only.',
    evaluation,
    fallback: { behavior: 'NOT_APPLICABLE' },
    lineage,
    lifecycle: 'VALIDATED',
    supersedesMethodVersionIds: [],
    createdAt: evaluation.evaluatedAt,
    validatedAt: evaluation.evaluatedAt
  });

export const CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_V1: Readonly<ExecutableMethodPackageV1> =
  parseExecutableMethodPackageV1({
    schemaVersion: 1,
    packageId: CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_ID,
    packageVersion: 1,
    methodId: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_ID,
    methodVersionId: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_VERSION_ID,
    methodFamily: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FAMILY,
    lifecycle: 'VALIDATED',
    selectionPriority: 0,
    applicability: CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_V1,
    inputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID,
    outputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID,
    executable: CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1,
    requiredData: CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA,
    referenceDependencies: [
      CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION,
      'TRADEMARK_LIFECYCLE_COMPUTATION_INPUT_V1',
      'TRADEMARK_LIFECYCLE_COMPUTATION_RESULT_V1',
      'EXECUTABLE_METHOD_PACKAGE_ACTIVATION_DECISION_V1'
    ],
    reasonCodes: CN_TRADEMARK_LIFECYCLE_HISTORY_REASON_CODES,
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation,
    lineage,
    limitations: CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS,
    createdAt: evaluation.evaluatedAt
  });

export const CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256 = brainMethodFingerprintV1(
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_V1
);
export const CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256 =
  executableMethodPackageFingerprintV1(CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_V1);

export interface CnTrademarkLifecycleHistoryMethodCandidateV1 {
  schemaVersion: 1;
  candidateKind: typeof CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_KIND;
  applicabilityFingerprintSha256: string;
  methodFingerprintSha256: string;
  packageFingerprintSha256: string;
  method: Readonly<BrainMethodContractV1>;
  package: Readonly<ExecutableMethodPackageV1>;
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BrainMethodContractError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  field: string
): void {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) {
    throw new BrainMethodContractError(`${field} must contain exactly the V1 fields.`);
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function sha256(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new BrainMethodContractError(`${field} must be a lowercase SHA-256 hex digest.`);
  }
  return value;
}

export function parseCnTrademarkLifecycleHistoryExecutableV1(
  value: unknown
): CnTrademarkLifecycleHistoryExecutableV1 {
  const executable = object(value, 'cnTrademarkLifecycleHistoryExecutable');
  exactKeys(
    executable,
    Object.keys(CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1),
    'cnTrademarkLifecycleHistoryExecutable'
  );
  if (!sameValue(executable, CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1)) {
    throw new BrainMethodContractError(
      'CN trademark lifecycle history executable does not match the fixed V1 contract.'
    );
  }
  return CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1;
}

export function parseCnTrademarkLifecycleHistoryMethodCandidateV1(
  value: unknown
): CnTrademarkLifecycleHistoryMethodCandidateV1 {
  const candidate = object(value, 'cnTrademarkLifecycleHistoryMethodCandidate');
  exactKeys(
    candidate,
    [
      'schemaVersion',
      'candidateKind',
      'applicabilityFingerprintSha256',
      'methodFingerprintSha256',
      'packageFingerprintSha256',
      'method',
      'package'
    ],
    'cnTrademarkLifecycleHistoryMethodCandidate'
  );
  if (
    candidate.schemaVersion !== 1 ||
    candidate.candidateKind !== CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_KIND
  ) {
    throw new BrainMethodContractError(
      'CN trademark lifecycle history candidate must use the fixed V1 identity.'
    );
  }

  const method = parseBrainMethodContractV1(candidate.method);
  const pkg = parseExecutableMethodPackageV1(candidate.package);
  if (method.lifecycle !== 'VALIDATED' || pkg.lifecycle !== 'VALIDATED') {
    throw new BrainMethodContractError(
      'Checked-in CN trademark lifecycle history Method and package must remain VALIDATED.'
    );
  }
  if (pkg.activatedAt !== undefined) {
    throw new BrainMethodContractError(
      'Checked-in CN trademark lifecycle history package must not carry activatedAt.'
    );
  }
  parseCnTrademarkLifecycleHistoryExecutableV1(method.algorithm);
  parseCnTrademarkLifecycleHistoryExecutableV1(pkg.executable);
  if (
    !sameValue(method, CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_V1) ||
    !sameValue(pkg, CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_V1)
  ) {
    throw new BrainMethodContractError(
      'CN trademark lifecycle history Method/package does not match the fixed candidate contract.'
    );
  }

  const applicabilityFingerprintSha256 = sha256(
    candidate.applicabilityFingerprintSha256,
    'cnTrademarkLifecycleHistoryMethodCandidate.applicabilityFingerprintSha256'
  );
  const methodFingerprintSha256 = sha256(
    candidate.methodFingerprintSha256,
    'cnTrademarkLifecycleHistoryMethodCandidate.methodFingerprintSha256'
  );
  const packageFingerprintSha256 = sha256(
    candidate.packageFingerprintSha256,
    'cnTrademarkLifecycleHistoryMethodCandidate.packageFingerprintSha256'
  );
  if (
    applicabilityFingerprintSha256 !==
      trademarkLifecycleRulePackApplicabilityFingerprintSha256V1(method.applicability) ||
    applicabilityFingerprintSha256 !==
      trademarkLifecycleRulePackApplicabilityFingerprintSha256V1(pkg.applicability) ||
    applicabilityFingerprintSha256 !==
      CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256
  ) {
    throw new BrainMethodContractError(
      'CN trademark lifecycle history applicability fingerprint does not bind the exact Method/package scope.'
    );
  }
  if (
    methodFingerprintSha256 !== brainMethodFingerprintV1(method) ||
    methodFingerprintSha256 !== CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256
  ) {
    throw new BrainMethodContractError(
      'CN trademark lifecycle history Method fingerprint does not bind the exact candidate.'
    );
  }
  if (
    packageFingerprintSha256 !== executableMethodPackageFingerprintV1(pkg) ||
    packageFingerprintSha256 !== CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256
  ) {
    throw new BrainMethodContractError(
      'CN trademark lifecycle history package fingerprint does not bind the exact candidate.'
    );
  }

  return {
    schemaVersion: 1,
    candidateKind: CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_KIND,
    applicabilityFingerprintSha256,
    methodFingerprintSha256,
    packageFingerprintSha256,
    method,
    package: pkg
  };
}

export const CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1 =
  parseCnTrademarkLifecycleHistoryMethodCandidateV1({
    schemaVersion: 1,
    candidateKind: CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_KIND,
    applicabilityFingerprintSha256: CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256,
    methodFingerprintSha256: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256,
    packageFingerprintSha256: CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256,
    method: CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_V1,
    package: CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_V1
  });

/** Compile-time assertion that the fixed schema IDs bind the existing lifecycle contracts. */
export type CnTrademarkLifecycleHistoryInputV1 = TrademarkLifecycleComputationInputV1;
export type CnTrademarkLifecycleHistoryOutputV1 = TrademarkLifecycleComputationResultV1;
