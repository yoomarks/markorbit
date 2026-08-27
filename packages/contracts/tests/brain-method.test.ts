import { describe, expect, it } from 'vitest';
import {
  BrainMethodContractError,
  parseBrainMethodContractV1,
  parseBrainResearchMissionV1,
  parseExecutableMethodPackageV1,
  selectExecutableMethodPackageV1
} from '../src/brain-method.js';

const sha = 'a'.repeat(64);

const applicability = {
  jurisdictions: ['US'],
  authorities: ['USPTO'],
  objectTypes: ['TRADEMARK_APPLICATION'],
  operations: ['RISK_ASSESSMENT'],
  procedures: ['EXAMINATION'],
  stages: ['PENDING'],
  filingBases: ['1B'],
  segments: ['DEFAULT'],
  requiredData: ['APPLICATION_FACTS'],
  effectiveFrom: '2026-01-01T00:00:00.000Z'
} as const;

const evaluation = {
  evaluationId: 'evaluation_us-risk-v1',
  evaluatedAt: '2026-08-27T00:00:00.000Z',
  status: 'PASSED',
  baseline: 'rules-baseline-v1',
  metrics: { precision: 0.82, recall: 0.74 },
  evidenceSummary: 'Validated on a reproducible bounded historical cohort.'
} as const;

const lineage = {
  knowledgeSources: [
    {
      schemaVersion: 1,
      documentId: 'knowledge_doc_us_exam_rule',
      documentVersion: 'v3',
      contentSha256: sha,
      chunkId: 'chunk_exam_1',
      authority: 'USPTO',
      observedAt: '2026-08-26T00:00:00.000Z',
      retrievalRationale: 'Authoritative examination rule source.'
    }
  ],
  researchDatasets: [
    {
      schemaVersion: 1,
      datasetRefId: 'research-dataset_example',
      engineVersion: 'M1.7',
      factSchemaVersion: 'us-case-history-v1',
      jurisdictions: ['US'],
      resourceKinds: ['application_history'],
      queryFingerprintSha256: sha,
      temporalBoundary: { kind: 'WATERMARK', value: 'us-history:2026-08-26' },
      completeness: 'COMPLETE_TO_WATERMARK',
      rowCount: 1200,
      integritySha256: sha
    }
  ]
} as const;

function activeMethod() {
  return {
    schemaVersion: 1,
    methodId: 'brain-method_us-application-risk',
    methodVersionId: 'brain-method-version_us-application-risk-v1',
    methodFamily: 'RISK',
    version: 1,
    purpose: 'Estimate examination risk for a bounded US pending-application scope.',
    targetObjectType: 'TRADEMARK_APPLICATION',
    applicability,
    requiredInputs: ['applicationId'],
    featureDefinitions: ['status history', 'filing basis'],
    algorithm: { kind: 'RULESET', artifactId: 'risk-rules-v1' },
    outputSchemaId: 'brain.application-risk.v1',
    limitations: ['Not valid outside USPTO pending examination.'],
    coverage: 'USPTO pending 1(b) applications in the validated segment.',
    evaluation,
    fallback: { behavior: 'NOT_APPLICABLE' },
    lineage,
    lifecycle: 'ACTIVE',
    supersedesMethodVersionIds: [],
    createdAt: '2026-08-26T00:00:00.000Z',
    validatedAt: '2026-08-27T00:00:00.000Z'
  } as const;
}

function activePackage(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    packageId: 'executable-method-package_us-risk-v1',
    packageVersion: 1,
    methodId: 'brain-method_us-application-risk',
    methodVersionId: 'brain-method-version_us-application-risk-v1',
    methodFamily: 'RISK',
    lifecycle: 'ACTIVE',
    selectionPriority: 100,
    applicability,
    inputSchemaId: 'capability.application-risk.input.v1',
    outputSchemaId: 'brain.application-risk.v1',
    executable: { kind: 'RULESET', artifactId: 'risk-rules-v1' },
    requiredData: ['APPLICATION_FACTS'],
    referenceDependencies: ['reference_us_exam_rules'],
    reasonCodes: { HIGH_HISTORY_SIGNAL: 'Historical feature threshold matched.' },
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation,
    lineage,
    limitations: ['Not valid outside the declared applicability contract.'],
    createdAt: '2026-08-27T00:00:00.000Z',
    activatedAt: '2026-08-27T01:00:00.000Z',
    ...overrides
  };
}

const context = {
  methodFamily: 'RISK',
  jurisdiction: 'US',
  authority: 'USPTO',
  objectType: 'TRADEMARK_APPLICATION',
  operation: 'RISK_ASSESSMENT',
  procedure: 'EXAMINATION',
  stage: 'PENDING',
  filingBasis: '1B',
  segment: 'DEFAULT',
  availableData: ['APPLICATION_FACTS'],
  asOf: '2026-08-28T00:00:00.000Z'
} as const;

describe('Brain Method V1 contracts', () => {
  it('parses an ACTIVE method with explicit applicability, evaluation, lineage, limitations and fallback', () => {
    const parsed = parseBrainMethodContractV1(activeMethod());
    expect(parsed.lifecycle).toBe('ACTIVE');
    expect(parsed.applicability.jurisdictions).toEqual(['US']);
    expect(parsed.lineage.researchDatasets[0]?.engineVersion).toBe('M1.7');
  });

  it('rejects production-ready methods without limitations', () => {
    expect(() =>
      parseBrainMethodContractV1({ ...activeMethod(), limitations: [] })
    ).toThrow('limitations must not be empty');
  });

  it('rejects methods without research lineage', () => {
    expect(() =>
      parseBrainMethodContractV1({
        ...activeMethod(),
        lineage: { knowledgeSources: [], researchDatasets: [] }
      })
    ).toThrow('lineage requires at least one');
  });

  it('rejects ACTIVE methods with failed evaluation', () => {
    expect(() =>
      parseBrainMethodContractV1({
        ...activeMethod(),
        evaluation: { ...evaluation, status: 'FAILED' }
      })
    ).toThrow('ACTIVE Brain methods cannot carry FAILED evaluation');
  });

  it('rejects unsupported method fields rather than accepting authority drift', () => {
    expect(() =>
      parseBrainMethodContractV1({ ...activeMethod(), autonomousPromotion: true })
    ).toThrow('unsupported fields');
  });

  it('requires a research mission to identify a Knowledge and/or Data Engine plan', () => {
    const mission = {
      schemaVersion: 1,
      missionId: 'brain-research-mission_us-risk-v1',
      capabilityDemand: 'Application risk capability',
      problem: 'Research a bounded USPTO risk method.',
      targetMethodFamily: 'RISK',
      applicabilityTarget: applicability,
      knowledgeResearchPlan: ['Retrieve authoritative examination rules with exact source identity.'],
      dataEngineResearchPlan: ['Build reproducible application-history cohort.'],
      hypotheses: ['Status history contains reusable risk signal.'],
      featurePlan: ['Evaluate status-transition features.'],
      evaluationPlan: ['Backtest against held-out bounded cohort.'],
      successMetrics: ['precision'],
      baselineMetrics: ['rules-baseline-v1'],
      createdAt: '2026-08-28T00:00:00.000Z'
    } as const;
    expect(parseBrainResearchMissionV1(mission).targetMethodFamily).toBe('RISK');
    expect(() =>
      parseBrainResearchMissionV1({
        ...mission,
        knowledgeResearchPlan: [],
        dataEngineResearchPlan: []
      })
    ).toThrow('requires a Knowledge and/or Data Engine research plan');
  });

  it('requires ACTIVE executable packages to carry activation evidence', () => {
    expect(() =>
      parseExecutableMethodPackageV1({ ...activePackage(), activatedAt: undefined })
    ).toThrow('ACTIVE executable method packages require activatedAt');
  });

  it('selects the only applicable ACTIVE package at the highest explicit priority', () => {
    const result = selectExecutableMethodPackageV1(
      [
        activePackage({
          packageId: 'executable-method-package_us-risk-low-priority',
          selectionPriority: 10
        }),
        activePackage()
      ],
      context
    );
    expect(result.status).toBe('SELECTED');
    if (result.status === 'SELECTED') {
      expect(result.package.packageId).toBe('executable-method-package_us-risk-v1');
    }
  });

  it('fails closed as NOT_APPLICABLE outside declared scope', () => {
    const result = selectExecutableMethodPackageV1([activePackage()], {
      ...context,
      jurisdiction: 'CA'
    });
    expect(result.status).toBe('NOT_APPLICABLE');
  });

  it('fails closed as AMBIGUOUS instead of silently tie-breaking equal-priority packages', () => {
    const result = selectExecutableMethodPackageV1(
      [
        activePackage(),
        activePackage({ packageId: 'executable-method-package_us-risk-v1-alt' })
      ],
      context
    );
    expect(result.status).toBe('AMBIGUOUS');
    if (result.status === 'AMBIGUOUS') {
      expect(result.packageIds).toEqual([
        'executable-method-package_us-risk-v1',
        'executable-method-package_us-risk-v1-alt'
      ]);
    }
  });

  it('does not select a package when required factual data is unavailable', () => {
    const result = selectExecutableMethodPackageV1([activePackage()], {
      ...context,
      availableData: []
    });
    expect(result.status).toBe('NOT_APPLICABLE');
  });

  it('rejects malformed fallback contracts', () => {
    expect(() =>
      parseExecutableMethodPackageV1(
        activePackage({ fallback: { behavior: 'METHOD' } })
      )
    ).toThrow(BrainMethodContractError);
    expect(() =>
      parseExecutableMethodPackageV1(
        activePackage({
          fallback: {
            behavior: 'NOT_APPLICABLE',
            fallbackMethodId: 'brain-method_hidden-fallback'
          }
        })
      )
    ).toThrow('only allowed when behavior is METHOD');
  });
});
