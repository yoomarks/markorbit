import { describe, expect, it } from 'vitest';

import {
  CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_V1,
  CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1,
  CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_KIND,
  CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1,
  CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS,
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_REASON_CODES,
  CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA,
  parseCnTrademarkLifecycleHistoryExecutableV1,
  parseCnTrademarkLifecycleHistoryMethodCandidateV1
} from '../src/brain-cn-trademark-lifecycle-history.js';
import { selectExecutableMethodPackageV1 } from '../src/brain-method.js';
import { CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION } from '../src/data-engine-discovery.js';

function candidateClone(): Record<string, unknown> {
  return structuredClone(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1) as unknown as Record<
    string,
    unknown
  >;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('expected object');
  }
  return value as Record<string, unknown>;
}

describe('CN trademark lifecycle source-recorded history Method candidate', () => {
  it('freezes the exact applicability, schemas, executable semantics and observation-record inputs', () => {
    const parsed = parseCnTrademarkLifecycleHistoryMethodCandidateV1(
      structuredClone(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1)
    );

    expect(parsed.method.methodFamily).toBe('TEMPORAL_RESOLUTION');
    expect(parsed.method.lifecycle).toBe('VALIDATED');
    expect(parsed.package.lifecycle).toBe('VALIDATED');
    expect(parsed.package.activatedAt).toBeUndefined();
    expect(parsed.method.applicability).toEqual({
      jurisdictions: ['CN'],
      authorities: ['CNIPA'],
      objectTypes: ['TRADEMARK_APPLICATION'],
      operations: ['PROJECT_TRADEMARK_LIFECYCLE'],
      procedures: ['FILING_TO_PRELIMINARY_PUBLICATION'],
      stages: ['SOURCE_RECORDED_COMPLETED_HISTORY'],
      filingBases: ['ANY'],
      segments: ['SOURCE_RECORDED_COMPLETED_HISTORY'],
      requiredData: [
        'CNIPA_SOURCE_READ_STATE',
        'FILING_DATE_OBSERVATION_RECORD',
        'PRELIMINARY_PUBLICATION_DATE_OBSERVATION_RECORD'
      ],
      effectiveFrom: '2026-10-10T00:00:00.000Z'
    });
    expect(parsed.package.requiredData).toEqual(CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA);
    expect(parsed.package.requiredData).not.toContain('FILING_DATE');
    expect(parsed.package.requiredData).not.toContain('PRELIMINARY_PUBLICATION_DATE');
    expect(parsed.package.inputSchemaId).toBe(CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID);
    expect(parsed.package.outputSchemaId).toBe(CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID);
    expect(parsed.method.outputSchemaId).toBe(CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID);
    expect(parsed.package.selectionPriority).toBe(0);
    expect(parsed.package.referenceDependencies).toEqual([
      CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION,
      'EXECUTABLE_METHOD_PACKAGE_ACTIVATION_DECISION_V1',
      'TRADEMARK_LIFECYCLE_COMPUTATION_INPUT_V1',
      'TRADEMARK_LIFECYCLE_COMPUTATION_RESULT_V1'
    ]);
    expect(parsed.package.referenceDependencies).not.toContain(
      'TRADEMARK_LIFECYCLE_COMPUTATION_OUTPUT_V1'
    );
    expect(parsed.package.executable).toEqual(CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1);
    expect(parsed.package.executable).toMatchObject({
      kind: CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_KIND,
      computedAtSource: 'CAPABILITY_REQUEST_RECEIVED_AT',
      acceptedSourceReadStates: ['OBSERVED', 'NOT_OBSERVED', 'NOT_COVERED', 'UNAVAILABLE'],
      rejectedSourceReadStates: ['EMPTY'],
      currentPositionInference: false,
      futurePathInference: false,
      deadlineCalculation: false,
      gracePeriodCalculation: false,
      prediction: false,
      recommendation: false,
      destinationOrCtaAuthority: false,
      persistenceAuthority: false
    });
    expect(parsed.package.reasonCodes).toEqual(CN_TRADEMARK_LIFECYCLE_HISTORY_REASON_CODES);
    expect(
      typeof parsed.package.reasonCodes.SOURCE_FACT_NOT_OBSERVED_WITHOUT_COMPLETE_SCOPE_EVIDENCE
    ).toBe('string');
    expect(typeof parsed.package.reasonCodes.SOURCE_SCOPE_NOT_COVERED).toBe('string');
    expect(typeof parsed.package.reasonCodes.SOURCE_READ_UNAVAILABLE).toBe('string');
    expect(typeof parsed.package.reasonCodes.SOURCE_DEPENDENCY_UNAVAILABLE).toBe('string');
    expect(parsed.package.reasonCodes).not.toHaveProperty('SOURCE_READ_NOT_OBSERVED');
    expect(parsed.package.limitations).toEqual(CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS);
    expect(parsed.method.limitations).toEqual(CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS);
    expect(parsed.package.limitations).toContain(
      'NOT_OBSERVED, NOT_COVERED and UNAVAILABLE produce the strict TrademarkLifecycleComputationResultV1 NOT_COMPUTED branch with their exact closed semantics; EMPTY is not accepted by the lifecycle computation boundary.'
    );
    expect(parsed.package.limitations).toContain(
      'This V1 candidate requires exactly one exact-scope DATA_ENGINE source read.'
    );
    expect(parsed.package.limitations).toContain(
      'AVAILABLE completed-history facts cannot occur after input.asOf; paired filing and preliminary-publication facts must use the same precision and time zone and cannot be chronologically inverted.'
    );
    expect(parsed.package.limitations).toContain(
      'This package is VALIDATED candidate evidence only; it is not ACTIVE, carries no activation decision and is not eligible for ordinary runtime selection.'
    );
    expect(parsed.method.evaluation).toEqual({
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
    });
    expect(parsed.package.evaluation).toEqual(parsed.method.evaluation);
  });

  it('binds deterministic applicability, Method and package fingerprints', () => {
    const replay = parseCnTrademarkLifecycleHistoryMethodCandidateV1(
      structuredClone(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1)
    );
    expect(replay.applicabilityFingerprintSha256).toBe(
      CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256
    );
    expect(replay.methodFingerprintSha256).toBe(
      CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256
    );
    expect(replay.packageFingerprintSha256).toBe(
      CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256
    );
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256).toMatch(
      /^[0-9a-f]{64}$/
    );
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed on applicability, schema, executable-kind or executable-shape drift', () => {
    const applicabilityDrift = candidateClone();
    record(record(applicabilityDrift.method).applicability).authorities = ['OTHER'];
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(applicabilityDrift)).toThrow();

    const schemaDrift = candidateClone();
    record(schemaDrift.package).inputSchemaId = 'brain-input.cn-trademark-lifecycle-history.v2';
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(schemaDrift)).toThrow(
      'fixed candidate contract'
    );

    const kindDrift = candidateClone();
    record(record(kindDrift.package).executable).kind = 'GENERIC_TEMPORAL_RESOLUTION';
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(kindDrift)).toThrow(
      'fixed V1 contract'
    );

    expect(() =>
      parseCnTrademarkLifecycleHistoryExecutableV1({
        ...CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_V1,
        unsupportedField: true
      })
    ).toThrow('exactly the V1 fields');
  });

  it('fails closed on Method, evaluation, dependency, limitation or package-priority drift', () => {
    const methodSchemaDrift = candidateClone();
    record(methodSchemaDrift.method).outputSchemaId = 'brain.cn-trademark-lifecycle-history.v2';
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(methodSchemaDrift)).toThrow(
      'fixed candidate contract'
    );

    const dependencyDrift = candidateClone();
    record(dependencyDrift.package).referenceDependencies = [
      'TRADEMARK_LIFECYCLE_COMPUTATION_OUTPUT_V1'
    ];
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(dependencyDrift)).toThrow(
      'fixed candidate contract'
    );

    const methodEvaluationDrift = candidateClone();
    record(record(methodEvaluationDrift.method).evaluation).baseline = 'drifted-baseline';
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(methodEvaluationDrift)).toThrow(
      'fixed candidate contract'
    );

    const packageEvaluationDrift = candidateClone();
    record(record(packageEvaluationDrift.package).evaluation).evidenceSummary =
      'Drifted evaluation evidence.';
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(packageEvaluationDrift)).toThrow(
      'fixed candidate contract'
    );

    const methodLimitationDrift = candidateClone();
    record(methodLimitationDrift.method).limitations = ['Widened beyond the fixed candidate.'];
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(methodLimitationDrift)).toThrow(
      'fixed candidate contract'
    );

    const packageLimitationDrift = candidateClone();
    record(packageLimitationDrift.package).limitations = ['Widened beyond the fixed candidate.'];
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(packageLimitationDrift)).toThrow(
      'fixed candidate contract'
    );

    const priorityDrift = candidateClone();
    record(priorityDrift.package).selectionPriority = 1;
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(priorityDrift)).toThrow(
      'fixed candidate contract'
    );
  });

  it('rejects any checked-in ACTIVE Method/package and carries no activation decision', () => {
    const active = candidateClone();
    record(active.method).lifecycle = 'ACTIVE';
    record(active.package).lifecycle = 'ACTIVE';
    record(active.package).activatedAt = '2026-10-10T01:00:00.000Z';

    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(active)).toThrow(
      'must remain VALIDATED'
    );
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package.activatedAt).toBeUndefined();
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package.selectionPriority).toBe(0);
    expect(Object.keys(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1)).not.toContain(
      'activationDecision'
    );

    const activatedValidatedPackage = candidateClone();
    record(activatedValidatedPackage.package).activatedAt = '2026-10-10T01:00:00.000Z';
    expect(() =>
      parseCnTrademarkLifecycleHistoryMethodCandidateV1(activatedValidatedPackage)
    ).toThrow('must not carry activatedAt');

    const embeddedDecision = candidateClone();
    embeddedDecision.activationDecision = { decision: 'APPROVED' };
    expect(() => parseCnTrademarkLifecycleHistoryMethodCandidateV1(embeddedDecision)).toThrow(
      'exactly the V1 fields'
    );
  });

  it('is deliberately invisible to the generic selector while it remains VALIDATED', () => {
    const selection = selectExecutableMethodPackageV1(
      [CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package],
      {
        methodFamily: 'TEMPORAL_RESOLUTION',
        jurisdiction: 'CN',
        authority: 'CNIPA',
        objectType: 'TRADEMARK_APPLICATION',
        operation: 'PROJECT_TRADEMARK_LIFECYCLE',
        procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
        stage: 'SOURCE_RECORDED_COMPLETED_HISTORY',
        filingBasis: 'ANY',
        segment: 'SOURCE_RECORDED_COMPLETED_HISTORY',
        availableData: [...CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA],
        asOf: '2026-10-10T00:00:00.000Z'
      }
    );

    expect(selection).toEqual({
      status: 'NOT_APPLICABLE',
      reason: 'No ACTIVE executable method package matches the request scope and available data.'
    });
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_V1).toEqual(
      CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package.applicability
    );
  });
});
