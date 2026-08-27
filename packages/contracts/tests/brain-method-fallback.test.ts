import { describe, expect, it } from 'vitest';
import { resolveExplicitMethodFallbackV1 } from '../src/brain-method-fallback.js';

const sha = 'b'.repeat(64);

const lineage = {
  knowledgeSources: [],
  researchDatasets: [
    {
      schemaVersion: 1,
      datasetRefId: 'research-dataset_fallback-test',
      engineVersion: 'M1.7',
      factSchemaVersion: 'history-v1',
      jurisdictions: ['US'],
      resourceKinds: ['application_history'],
      queryFingerprintSha256: sha,
      temporalBoundary: { kind: 'WATERMARK', value: 'fixture:1' },
      completeness: 'COMPLETE_BOUNDED',
      rowCount: 10,
      integritySha256: sha
    }
  ]
} as const;

const evaluation = {
  evaluationId: 'evaluation_fallback-v1',
  evaluatedAt: '2026-08-27T00:00:00.000Z',
  status: 'PASSED',
  baseline: 'baseline-v1',
  metrics: { accuracy: 0.9 },
  evidenceSummary: 'Bounded validation.'
} as const;

function applicability(jurisdiction = 'US') {
  return {
    jurisdictions: [jurisdiction],
    authorities: ['USPTO'],
    objectTypes: ['TRADEMARK_APPLICATION'],
    operations: ['RISK_ASSESSMENT'],
    procedures: ['EXAMINATION'],
    stages: ['PENDING'],
    filingBases: ['1B'],
    segments: ['DEFAULT'],
    requiredData: ['APPLICATION_FACTS'],
    effectiveFrom: '2026-01-01T00:00:00.000Z'
  };
}

function pkg(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    packageId: 'executable-method-package_primary',
    packageVersion: 1,
    methodId: 'brain-method_primary',
    methodVersionId: 'brain-method-version_primary-v1',
    methodFamily: 'RISK',
    lifecycle: 'ACTIVE',
    selectionPriority: 100,
    applicability: applicability(),
    inputSchemaId: 'input.v1',
    outputSchemaId: 'output.v1',
    executable: { kind: 'RULESET' },
    requiredData: ['APPLICATION_FACTS'],
    referenceDependencies: [],
    reasonCodes: { MATCH: 'Matched.' },
    fallback: { behavior: 'METHOD', fallbackMethodId: 'brain-method_fallback' },
    evaluation,
    lineage,
    limitations: ['Bounded scope only.'],
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

describe('explicit Brain Method fallback resolution', () => {
  it('selects only the explicitly referenced fallback method after its own applicability check', () => {
    const fallback = pkg({
      packageId: 'executable-method-package_fallback',
      methodId: 'brain-method_fallback',
      methodVersionId: 'brain-method-version_fallback-v1',
      selectionPriority: 50,
      fallback: { behavior: 'NOT_APPLICABLE' }
    });
    const unrelated = pkg({
      packageId: 'executable-method-package_unrelated',
      methodId: 'brain-method_unrelated',
      methodVersionId: 'brain-method-version_unrelated-v1',
      selectionPriority: 999
    });

    const result = resolveExplicitMethodFallbackV1(pkg(), [unrelated, fallback], context);
    expect(result.status).toBe('FALLBACK_SELECTED');
    if (result.status === 'FALLBACK_SELECTED') {
      expect(result.fallback.packageId).toBe('executable-method-package_fallback');
    }
  });

  it('fails closed when the explicit fallback exists but is out of scope', () => {
    const fallback = pkg({
      packageId: 'executable-method-package_fallback-ca',
      methodId: 'brain-method_fallback',
      methodVersionId: 'brain-method-version_fallback-ca-v1',
      applicability: applicability('CA'),
      fallback: { behavior: 'NOT_APPLICABLE' }
    });
    expect(resolveExplicitMethodFallbackV1(pkg(), [fallback], context).status).toBe(
      'NOT_APPLICABLE'
    );
  });

  it('honors an explicit NOT_APPLICABLE primary fallback without guessing alternatives', () => {
    const primary = pkg({ fallback: { behavior: 'NOT_APPLICABLE' } });
    const result = resolveExplicitMethodFallbackV1(primary, [], context);
    expect(result.status).toBe('NOT_APPLICABLE');
  });

  it('returns AMBIGUOUS for equal-priority applicable packages of the referenced fallback method', () => {
    const first = pkg({
      packageId: 'executable-method-package_fallback-a',
      methodId: 'brain-method_fallback',
      methodVersionId: 'brain-method-version_fallback-a-v1',
      fallback: { behavior: 'NOT_APPLICABLE' }
    });
    const second = pkg({
      packageId: 'executable-method-package_fallback-b',
      methodId: 'brain-method_fallback',
      methodVersionId: 'brain-method-version_fallback-b-v1',
      fallback: { behavior: 'NOT_APPLICABLE' }
    });
    const result = resolveExplicitMethodFallbackV1(pkg(), [first, second], context);
    expect(result.status).toBe('AMBIGUOUS');
  });
});
