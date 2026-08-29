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
  ExecutableMethodCapabilityExecutorV1,
  type ExecutableMethodPackageRunnerInputV1,
  type ExecutableMethodPackageRunnerV1
} from './executable-method-runtime.js';

export const CN_DURATION_ANALYTICAL_CAPABILITY_ID =
  'analytics.cn-filing-to-prelim-duration' as const;
export const CN_DURATION_ANALYTICAL_CAPABILITY_VERSION = '1.0.0' as const;
export const CN_DURATION_ANALYTICAL_INPUT_SCHEMA =
  'brain-input.cn-filing-to-prelim-duration.descriptive.v1' as const;
export const CN_DURATION_ANALYTICAL_OUTPUT_SCHEMA =
  'brain.cn-filing-to-prelim-duration.descriptive.v1' as const;
export const CN_DURATION_ANALYTICAL_EXECUTABLE_KIND = 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION' as const;

const PHASE3_EVIDENCE_SHA256 = 'de407eb5e5c0704c7e2817cf8ce67f14c381d1a587fb986a664425d8a3eb411c';
const REQUIRED_DATA = [
  'CN_CASE_CURRENT',
  'FILING_DATE',
  'PRELIM_PUB_DATE',
  'SOURCE_LINEAGE'
] as const;

export interface CnDurationAnalyticalInputV1 {
  jurisdiction: 'CN';
  authority: 'CNIPA';
  objectType: 'TRADEMARK_APPLICATION';
  operation: 'DESCRIPTIVE_DURATION_RESEARCH';
  procedure: 'FILING_TO_PRELIMINARY_PUBLICATION';
  stage: 'HISTORICAL_FACT_RESEARCH';
  filingBasis: 'ANY';
  segment: 'FILING_TO_PRELIM_PUBLICATION';
  availableData: readonly string[];
  acceptedResearchDatasetRef: string;
}

export interface CnDurationAnalyticalOutputV1 {
  schemaVersion: 1;
  kind: typeof CN_DURATION_ANALYTICAL_EXECUTABLE_KIND;
  jurisdiction: 'CN';
  procedure: 'FILING_TO_PRELIMINARY_PUBLICATION';
  datasetRefId: string;
  quantileMethod: 'NEAREST_RANK';
  statistics: Readonly<{
    count: number;
    min_days: number;
    p25_days: number;
    median_days: number;
    p75_days: number;
    max_days: number;
  }>;
  limitations: readonly string[];
  objectiveOnly: true;
  legalConclusion: false;
  predictiveClaim: false;
  rawPopulationRowsReadByCapability: false;
}

export const CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION: Readonly<RuntimeCapabilityDefinition> =
  Object.freeze({
    schemaVersion: 1,
    runtimeCapabilityDefinitionId: 'runtime-capability_cn-duration-analytical-v1',
    version: 1,
    capabilityId: CN_DURATION_ANALYTICAL_CAPABILITY_ID,
    capabilityVersion: CN_DURATION_ANALYTICAL_CAPABILITY_VERSION,
    title: 'CN filing-to-preliminary-publication descriptive distribution',
    description:
      'Executes one explicitly activated, precompiled descriptive empirical distribution without Brain Research or Data Engine population access.',
    lineage: {
      capabilityId: CN_DURATION_ANALYTICAL_CAPABILITY_ID
    },
    canonReference: {
      canonId: 'brain-cn-duration-phase3-real-acceptance',
      canonVersion: '1',
      sourceFingerprintSha256: PHASE3_EVIDENCE_SHA256
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-08-29T00:00:00.000Z'
  });

export const CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE: Readonly<ImplementationProfile> =
  Object.freeze({
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_cn-duration-analytical-v1',
    version: 1,
    capabilityId: CN_DURATION_ANALYTICAL_CAPABILITY_ID,
    capabilityVersion: CN_DURATION_ANALYTICAL_CAPABILITY_VERSION,
    kind: 'DETERMINISTIC_SERVICE',
    status: 'APPROVED',
    implementationKey: 'brain-method-package-runtime.cn-duration-descriptive.v1',
    inputSchemaId: CN_DURATION_ANALYTICAL_INPUT_SCHEMA,
    outputSchemaId: CN_DURATION_ANALYTICAL_OUTPUT_SCHEMA,
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'LOW',
    timeoutMs: 1000,
    maxAttempts: 1,
    approvalPolicyVersion: 'phase4-cn-duration-analytical-pilot.v1',
    createdAt: '2026-08-29T00:00:00.000Z'
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

export function parseCnDurationAnalyticalInputV1(value: unknown): CnDurationAnalyticalInputV1 {
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
      'acceptedResearchDatasetRef'
    ]) ||
    input.jurisdiction !== 'CN' ||
    input.authority !== 'CNIPA' ||
    input.objectType !== 'TRADEMARK_APPLICATION' ||
    input.operation !== 'DESCRIPTIVE_DURATION_RESEARCH' ||
    input.procedure !== 'FILING_TO_PRELIMINARY_PUBLICATION' ||
    input.stage !== 'HISTORICAL_FACT_RESEARCH' ||
    input.filingBasis !== 'ANY' ||
    input.segment !== 'FILING_TO_PRELIM_PUBLICATION' ||
    !exactRequiredData(input.availableData) ||
    typeof input.acceptedResearchDatasetRef !== 'string' ||
    !input.acceptedResearchDatasetRef.startsWith('research-dataset_')
  ) {
    throw new TypeError('CN duration analytical input is outside the accepted pilot contract.');
  }
  return {
    jurisdiction: 'CN',
    authority: 'CNIPA',
    objectType: 'TRADEMARK_APPLICATION',
    operation: 'DESCRIPTIVE_DURATION_RESEARCH',
    procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
    stage: 'HISTORICAL_FACT_RESEARCH',
    filingBasis: 'ANY',
    segment: 'FILING_TO_PRELIM_PUBLICATION',
    availableData: [...input.availableData] as string[],
    acceptedResearchDatasetRef: input.acceptedResearchDatasetRef
  };
}

export function validateCnDurationAnalyticalInputV1(value: unknown): boolean {
  try {
    parseCnDurationAnalyticalInputV1(value);
    return true;
  } catch {
    return false;
  }
}

function statistics(value: unknown): CnDurationAnalyticalOutputV1['statistics'] {
  const parsed = record(value);
  if (
    !parsed ||
    !exactKeys(parsed, ['count', 'min_days', 'p25_days', 'median_days', 'p75_days', 'max_days'])
  ) {
    throw new TypeError('CN duration executable statistics are invalid.');
  }
  const fields = ['count', 'min_days', 'p25_days', 'median_days', 'p75_days', 'max_days'] as const;
  for (const field of fields) {
    if (!Number.isSafeInteger(parsed[field]) || (parsed[field] as number) < 0) {
      throw new TypeError(`CN duration executable ${field} is invalid.`);
    }
  }
  if ((parsed.count as number) < 1) throw new TypeError('CN duration executable count is invalid.');
  if (
    (parsed.min_days as number) > (parsed.p25_days as number) ||
    (parsed.p25_days as number) > (parsed.median_days as number) ||
    (parsed.median_days as number) > (parsed.p75_days as number) ||
    (parsed.p75_days as number) > (parsed.max_days as number)
  ) {
    throw new TypeError('CN duration executable quantiles are not monotonic.');
  }
  return {
    count: parsed.count as number,
    min_days: parsed.min_days as number,
    p25_days: parsed.p25_days as number,
    median_days: parsed.median_days as number,
    p75_days: parsed.p75_days as number,
    max_days: parsed.max_days as number
  };
}

export function validateCnDurationAnalyticalOutputV1(value: unknown): boolean {
  const output = record(value);
  if (
    !output ||
    !exactKeys(output, [
      'schemaVersion',
      'kind',
      'jurisdiction',
      'procedure',
      'datasetRefId',
      'quantileMethod',
      'statistics',
      'limitations',
      'objectiveOnly',
      'legalConclusion',
      'predictiveClaim',
      'rawPopulationRowsReadByCapability'
    ]) ||
    output.schemaVersion !== 1 ||
    output.kind !== CN_DURATION_ANALYTICAL_EXECUTABLE_KIND ||
    output.jurisdiction !== 'CN' ||
    output.procedure !== 'FILING_TO_PRELIMINARY_PUBLICATION' ||
    typeof output.datasetRefId !== 'string' ||
    output.quantileMethod !== 'NEAREST_RANK' ||
    !Array.isArray(output.limitations) ||
    output.limitations.length === 0 ||
    !output.limitations.every((item) => typeof item === 'string' && item.length > 0) ||
    output.objectiveOnly !== true ||
    output.legalConclusion !== false ||
    output.predictiveClaim !== false ||
    output.rawPopulationRowsReadByCapability !== false
  ) {
    return false;
  }
  try {
    statistics(output.statistics);
    return true;
  } catch {
    return false;
  }
}

export class CnDurationMethodSelectionContextResolverV1 {
  resolve(request: Readonly<CapabilityRequestV2>): Readonly<{
    methodFamily: 'STATISTICAL_ANALYSIS';
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
    const input = parseCnDurationAnalyticalInputV1(request.input);
    return {
      methodFamily: 'STATISTICAL_ANALYSIS',
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

export class CnDurationDescriptiveDistributionRunnerV1 implements ExecutableMethodPackageRunnerV1 {
  private readonly decision: Readonly<ExecutableMethodPackageActivationDecisionV1>;

  constructor(decisionValue: unknown) {
    this.decision = parseExecutableMethodPackageActivationDecisionV1(decisionValue);
    if (this.decision.decision !== 'APPROVED') {
      throw new TypeError('CN duration runner requires an APPROVED activation decision.');
    }
  }

  run(
    input: Readonly<ExecutableMethodPackageRunnerInputV1>
  ): Promise<{ output: CnDurationAnalyticalOutputV1; evidenceRefs: readonly string[] }> {
    const requestInput = parseCnDurationAnalyticalInputV1(input.request.input);
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
        'CN duration ACTIVE package does not match the governed activation decision.'
      );
    }

    const executable = record(pkg.executable);
    if (
      !executable ||
      executable.kind !== CN_DURATION_ANALYTICAL_EXECUTABLE_KIND ||
      executable.quantileMethod !== 'NEAREST_RANK' ||
      executable.legalConclusion !== false ||
      executable.predictiveClaim !== false ||
      typeof executable.datasetRefId !== 'string'
    ) {
      throw new TypeError('CN duration executable is outside the accepted descriptive pilot.');
    }
    const dataset = pkg.lineage.researchDatasets[0];
    if (
      pkg.lineage.knowledgeSources.length !== 0 ||
      pkg.lineage.researchDatasets.length !== 1 ||
      !dataset ||
      dataset.dataset_ref_id !== executable.datasetRefId ||
      dataset.dataset_ref_id !== requestInput.acceptedResearchDatasetRef
    ) {
      throw new TypeError('CN duration request/package dataset lineage does not match exactly.');
    }

    const output: CnDurationAnalyticalOutputV1 = {
      schemaVersion: 1,
      kind: CN_DURATION_ANALYTICAL_EXECUTABLE_KIND,
      jurisdiction: 'CN',
      procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
      datasetRefId: dataset.dataset_ref_id,
      quantileMethod: 'NEAREST_RANK',
      statistics: statistics(executable.statistics),
      limitations: [...pkg.limitations],
      objectiveOnly: true,
      legalConclusion: false,
      predictiveClaim: false,
      rawPopulationRowsReadByCapability: false
    };
    return Promise.resolve({
      output,
      evidenceRefs: [
        executableMethodActivationEvidenceRefV1(this.decision),
        `phase3-real-evidence-sha256:${PHASE3_EVIDENCE_SHA256}`,
        'capability-runtime:brain-research-hot-path=absent',
        'capability-runtime:data-engine-population-read=absent'
      ]
    });
  }
}

export function createCnDurationAnalyticalCapabilityExecutorV1(
  activePackage: Readonly<ExecutableMethodPackageV1>,
  activationDecision: unknown
): ExecutableMethodCapabilityExecutorV1 {
  const runner = new CnDurationDescriptiveDistributionRunnerV1(activationDecision);
  return new ExecutableMethodCapabilityExecutorV1({
    packages: {
      list: () => Promise.resolve([activePackage])
    },
    selectionContext: new CnDurationMethodSelectionContextResolverV1(),
    runners: {
      resolve: (kind) => (kind === CN_DURATION_ANALYTICAL_EXECUTABLE_KIND ? runner : undefined)
    }
  });
}
