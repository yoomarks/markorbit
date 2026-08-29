import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityRequestV2,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  executableMethodActivationEvidenceRefV1,
  parseExecutableMethodPackageActivationDecisionV1,
  type ExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';
import type { ExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  CN_DURATION_BAND_ACCEPTED_ENGINE_VERSION,
  CN_DURATION_BAND_ACCEPTED_EVIDENCE_SHA256,
  CN_DURATION_BAND_ACCEPTED_INTEGRITY_SHA256,
  CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256,
  CN_DURATION_BAND_ACCEPTED_WATERMARK,
  CN_DURATION_BAND_EXECUTABLE_KIND,
  classifyCnCompletedDurationHistoricalBandV1,
  type CnCompletedDurationHistoricalBandV1,
  type CnDurationBandThresholdsV1
} from '@markorbit/contracts/brain-cn-duration-band-classification';

import {
  ExecutableMethodCapabilityExecutorV1,
  type ExecutableMethodPackageRunnerInputV1,
  type ExecutableMethodPackageRunnerV1
} from './executable-method-runtime.js';

export const CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_ID =
  'interpretation.cn-completed-duration-historical-band' as const;
export const CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_VERSION = '1.0.0' as const;
export const CN_DURATION_BAND_CLASSIFICATION_INPUT_SCHEMA =
  'brain-input.cn-completed-duration-historical-band.v1' as const;
export const CN_DURATION_BAND_CLASSIFICATION_OUTPUT_SCHEMA =
  'brain.cn-completed-duration-historical-band.v1' as const;

const REQUIRED_DATA = [
  'OBSERVED_COMPLETED_DURATION_DAYS',
  'ACCEPTED_CN_DURATION_DISTRIBUTION'
] as const;

export interface CnDurationBandClassificationInputV1 {
  jurisdiction: 'CN';
  authority: 'CNIPA';
  objectType: 'TRADEMARK_APPLICATION';
  operation: 'CLASSIFY_COMPLETED_DURATION_HISTORICAL_BAND';
  procedure: 'FILING_TO_PRELIMINARY_PUBLICATION';
  stage: 'COMPLETED_INTERVAL_INTERPRETATION';
  filingBasis: 'ANY';
  segment: 'FILING_TO_PRELIM_PUBLICATION';
  availableData: readonly string[];
  acceptedResearchDatasetRef: typeof CN_DURATION_BAND_ACCEPTED_DATASET_REF;
  observedCompletedDurationDays: number;
}

export interface CnDurationBandClassificationOutputV1 {
  schemaVersion: 1;
  kind: typeof CN_DURATION_BAND_EXECUTABLE_KIND;
  jurisdiction: 'CN';
  procedure: 'FILING_TO_PRELIMINARY_PUBLICATION';
  observedCompletedDurationDays: number;
  historicalBand: CnCompletedDurationHistoricalBandV1;
  datasetRefId: typeof CN_DURATION_BAND_ACCEPTED_DATASET_REF;
  thresholds: Readonly<CnDurationBandThresholdsV1>;
  semantics: 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION';
  descriptiveInterpretationOnly: true;
  legalConclusion: false;
  predictiveClaim: false;
  riskClaim: false;
  probabilityClaim: false;
  recommendation: false;
  currentCaseStatusInferred: false;
  productBusinessStateMutated: false;
}

export const CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_DEFINITION: Readonly<RuntimeCapabilityDefinition> =
  Object.freeze({
    schemaVersion: 1,
    runtimeCapabilityDefinitionId: 'runtime-capability_cn-duration-band-classification-v1',
    version: 1,
    capabilityId: CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_ID,
    capabilityVersion: CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_VERSION,
    title: 'CN completed-duration historical band classification',
    description:
      'Classifies one caller-supplied completed filing-to-preliminary-publication elapsed-day observation relative to the explicitly activated historical quartile-band method.',
    lineage: {
      capabilityId: CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_ID
    },
    canonReference: {
      canonId: 'brain-cn-duration-band-classification-phase4',
      canonVersion: '1',
      sourceFingerprintSha256: CN_DURATION_BAND_ACCEPTED_EVIDENCE_SHA256
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-08-29T08:20:00.000Z'
  });

export const CN_DURATION_BAND_CLASSIFICATION_IMPLEMENTATION_PROFILE: Readonly<ImplementationProfile> =
  Object.freeze({
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_cn-duration-band-classification-v1',
    version: 1,
    capabilityId: CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_ID,
    capabilityVersion: CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_VERSION,
    kind: 'DETERMINISTIC_SERVICE',
    status: 'APPROVED',
    implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1',
    inputSchemaId: CN_DURATION_BAND_CLASSIFICATION_INPUT_SCHEMA,
    outputSchemaId: CN_DURATION_BAND_CLASSIFICATION_OUTPUT_SCHEMA,
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'LOW',
    timeoutMs: 1000,
    maxAttempts: 1,
    approvalPolicyVersion: 'phase4-cn-duration-band-classification-pilot.v1',
    createdAt: '2026-08-29T08:20:00.000Z'
  });

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === expected.length &&
    [...expected].sort().every((expectedKey, index) => keys[index] === expectedKey)
  );
}

function exactRequiredData(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length === REQUIRED_DATA.length &&
    REQUIRED_DATA.every((item) => value.includes(item)) &&
    value.every((item) => typeof item === 'string')
  );
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function parseCnDurationBandClassificationInputV1(
  value: unknown
): CnDurationBandClassificationInputV1 {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, [
      'jurisdiction',
      'authority',
      'objectType',
      'operation',
      'procedure',
      'stage',
      'filingBasis',
      'segment',
      'availableData',
      'acceptedResearchDatasetRef',
      'observedCompletedDurationDays'
    ]) ||
    input.jurisdiction !== 'CN' ||
    input.authority !== 'CNIPA' ||
    input.objectType !== 'TRADEMARK_APPLICATION' ||
    input.operation !== 'CLASSIFY_COMPLETED_DURATION_HISTORICAL_BAND' ||
    input.procedure !== 'FILING_TO_PRELIMINARY_PUBLICATION' ||
    input.stage !== 'COMPLETED_INTERVAL_INTERPRETATION' ||
    input.filingBasis !== 'ANY' ||
    input.segment !== 'FILING_TO_PRELIM_PUBLICATION' ||
    !exactRequiredData(input.availableData) ||
    input.acceptedResearchDatasetRef !== CN_DURATION_BAND_ACCEPTED_DATASET_REF ||
    !nonNegativeSafeInteger(input.observedCompletedDurationDays)
  ) {
    throw new TypeError(
      'CN completed-duration historical band input is outside the accepted Phase 4 contract.'
    );
  }
  return {
    jurisdiction: 'CN',
    authority: 'CNIPA',
    objectType: 'TRADEMARK_APPLICATION',
    operation: 'CLASSIFY_COMPLETED_DURATION_HISTORICAL_BAND',
    procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
    stage: 'COMPLETED_INTERVAL_INTERPRETATION',
    filingBasis: 'ANY',
    segment: 'FILING_TO_PRELIM_PUBLICATION',
    availableData: [...input.availableData] as string[],
    acceptedResearchDatasetRef: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
    observedCompletedDurationDays: input.observedCompletedDurationDays as number
  };
}

export function validateCnDurationBandClassificationInputV1(value: unknown): boolean {
  try {
    parseCnDurationBandClassificationInputV1(value);
    return true;
  } catch {
    return false;
  }
}

function thresholds(value: unknown): CnDurationBandThresholdsV1 {
  const parsed = record(value);
  if (
    !parsed ||
    !exactKeys(parsed, ['p25Days', 'medianDays', 'p75Days']) ||
    parsed.p25Days !== 335 ||
    parsed.medianDays !== 336 ||
    parsed.p75Days !== 383
  ) {
    throw new TypeError('CN duration historical-band executable thresholds have drifted.');
  }
  return { p25Days: 335, medianDays: 336, p75Days: 383 };
}

export function validateCnDurationBandClassificationOutputV1(value: unknown): boolean {
  const output = record(value);
  if (
    !output ||
    !exactKeys(output, [
      'schemaVersion',
      'kind',
      'jurisdiction',
      'procedure',
      'observedCompletedDurationDays',
      'historicalBand',
      'datasetRefId',
      'thresholds',
      'semantics',
      'descriptiveInterpretationOnly',
      'legalConclusion',
      'predictiveClaim',
      'riskClaim',
      'probabilityClaim',
      'recommendation',
      'currentCaseStatusInferred',
      'productBusinessStateMutated'
    ]) ||
    output.schemaVersion !== 1 ||
    output.kind !== CN_DURATION_BAND_EXECUTABLE_KIND ||
    output.jurisdiction !== 'CN' ||
    output.procedure !== 'FILING_TO_PRELIMINARY_PUBLICATION' ||
    !nonNegativeSafeInteger(output.observedCompletedDurationDays) ||
    ![
      'LOWER_QUARTILE_OR_BELOW',
      'LOWER_INTERQUARTILE',
      'UPPER_INTERQUARTILE',
      'UPPER_QUARTILE'
    ].includes(output.historicalBand as string) ||
    output.datasetRefId !== CN_DURATION_BAND_ACCEPTED_DATASET_REF ||
    output.semantics !== 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION' ||
    output.descriptiveInterpretationOnly !== true ||
    output.legalConclusion !== false ||
    output.predictiveClaim !== false ||
    output.riskClaim !== false ||
    output.probabilityClaim !== false ||
    output.recommendation !== false ||
    output.currentCaseStatusInferred !== false ||
    output.productBusinessStateMutated !== false
  ) {
    return false;
  }
  try {
    thresholds(output.thresholds);
    return true;
  } catch {
    return false;
  }
}

export class CnDurationBandClassificationSelectionContextResolverV1 {
  resolve(request: Readonly<CapabilityRequestV2>): Readonly<{
    methodFamily: 'CLASSIFICATION';
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
  }> {
    const input = parseCnDurationBandClassificationInputV1(request.input);
    return {
      methodFamily: 'CLASSIFICATION',
      jurisdiction: input.jurisdiction,
      authority: input.authority,
      objectType: input.objectType,
      operation: input.operation,
      procedure: input.procedure,
      stage: input.stage,
      filingBasis: input.filingBasis,
      segment: input.segment,
      availableData: input.availableData,
      asOf: request.receivedAt
    };
  }
}

function exactResearchDatasetLineage(pkg: Readonly<ExecutableMethodPackageV1>): boolean {
  const dataset = pkg.lineage.researchDatasets[0];
  return (
    pkg.lineage.knowledgeSources.length === 0 &&
    pkg.lineage.researchDatasets.length === 1 &&
    dataset !== undefined &&
    dataset.dataset_ref_id === CN_DURATION_BAND_ACCEPTED_DATASET_REF &&
    dataset.engine_version === CN_DURATION_BAND_ACCEPTED_ENGINE_VERSION &&
    dataset.query_fingerprint_sha256 === CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256 &&
    dataset.integrity_sha256 === CN_DURATION_BAND_ACCEPTED_INTEGRITY_SHA256 &&
    dataset.watermark === CN_DURATION_BAND_ACCEPTED_WATERMARK &&
    dataset.row_count === 10000
  );
}

export class CnDurationBandClassificationRunnerV1 implements ExecutableMethodPackageRunnerV1 {
  private readonly decision: Readonly<ExecutableMethodPackageActivationDecisionV1>;

  constructor(decisionValue: unknown) {
    this.decision = parseExecutableMethodPackageActivationDecisionV1(decisionValue);
    if (this.decision.decision !== 'APPROVED') {
      throw new TypeError('CN duration historical-band runner requires an APPROVED activation decision.');
    }
  }

  run(
    input: Readonly<ExecutableMethodPackageRunnerInputV1>
  ): Promise<{ output: CnDurationBandClassificationOutputV1; evidenceRefs: readonly string[] }> {
    const requestInput = parseCnDurationBandClassificationInputV1(input.request.input);
    const pkg = input.package;
    if (
      pkg.lifecycle !== 'ACTIVE' ||
      pkg.packageId !== this.decision.predecessor.packageId ||
      pkg.packageVersion !== this.decision.target.packageVersion ||
      pkg.methodId !== this.decision.predecessor.methodId ||
      pkg.methodVersionId !== this.decision.predecessor.methodVersionId ||
      pkg.evaluation.evaluationId !== this.decision.predecessor.evaluationId ||
      pkg.activatedAt !== this.decision.approval.approvedAt
    ) {
      throw new TypeError(
        'CN duration historical-band ACTIVE package does not match the governed activation decision.'
      );
    }

    const executable = record(pkg.executable);
    if (
      !executable ||
      executable.kind !== CN_DURATION_BAND_EXECUTABLE_KIND ||
      executable.semantics !==
        'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION' ||
      executable.datasetRefId !== CN_DURATION_BAND_ACCEPTED_DATASET_REF ||
      executable.legalConclusion !== false ||
      executable.predictiveClaim !== false ||
      executable.riskClaim !== false ||
      executable.probabilityClaim !== false ||
      executable.recommendation !== false ||
      !exactResearchDatasetLineage(pkg)
    ) {
      throw new TypeError(
        'CN duration historical-band executable is outside the accepted Phase 4 classification pilot.'
      );
    }

    const acceptedThresholds = thresholds(executable.thresholds);
    const historicalBand = classifyCnCompletedDurationHistoricalBandV1(
      requestInput.observedCompletedDurationDays,
      acceptedThresholds
    );
    const output: CnDurationBandClassificationOutputV1 = {
      schemaVersion: 1,
      kind: CN_DURATION_BAND_EXECUTABLE_KIND,
      jurisdiction: 'CN',
      procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
      observedCompletedDurationDays: requestInput.observedCompletedDurationDays,
      historicalBand,
      datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
      thresholds: acceptedThresholds,
      semantics: 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION',
      descriptiveInterpretationOnly: true,
      legalConclusion: false,
      predictiveClaim: false,
      riskClaim: false,
      probabilityClaim: false,
      recommendation: false,
      currentCaseStatusInferred: false,
      productBusinessStateMutated: false
    };

    return Promise.resolve({
      output,
      evidenceRefs: [
        executableMethodActivationEvidenceRefV1(this.decision),
        `phase3-real-evidence-sha256:${CN_DURATION_BAND_ACCEPTED_EVIDENCE_SHA256}`,
        'capability-runtime:brain-research-hot-path=absent',
        'capability-runtime:data-engine-population-read=absent',
        'capability-runtime:current-case-status-inference=absent',
        'capability-runtime:product-business-state-write=absent'
      ]
    });
  }
}

export function createCnDurationBandClassificationCapabilityExecutorV1(
  activePackage: Readonly<ExecutableMethodPackageV1>,
  activationDecision: unknown
): ExecutableMethodCapabilityExecutorV1 {
  const runner = new CnDurationBandClassificationRunnerV1(activationDecision);
  return new ExecutableMethodCapabilityExecutorV1({
    packages: { list: () => Promise.resolve([activePackage]) },
    selectionContext: new CnDurationBandClassificationSelectionContextResolverV1(),
    runners: {
      resolve: (kind) => (kind === CN_DURATION_BAND_EXECUTABLE_KIND ? runner : undefined)
    }
  });
}
