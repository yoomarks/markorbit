import { describe, expect, it } from 'vitest';
import type { ExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import {
  InMemoryOfficialFeeReferenceStore,
  OFFICIAL_FEE_PILOT_OPERATION,
  OfficialFeeReferenceStoreError,
  type OfficialFeeMaterializationInputV1,
  type OfficialFeeReferenceStoreErrorCode
} from '../src/official-fee-reference-store.js';

const sha = (character: string) => character.repeat(64);

function methodPackage(
  sourceSha = sha('a'),
  overrides: Partial<ExecutableMethodPackageV1> = {}
): ExecutableMethodPackageV1 {
  return {
    schemaVersion: 1,
    packageId: 'executable-method-package_official-fee-v1',
    packageVersion: 1,
    methodId: 'brain-method_official-fee-resolution',
    methodVersionId: 'brain-method-version_official-fee-resolution-v1',
    methodFamily: 'SOURCE_RESOLUTION',
    lifecycle: 'ACTIVE',
    selectionPriority: 100,
    applicability: {
      jurisdictions: ['US'],
      authorities: ['USPTO'],
      objectTypes: ['TRADEMARK_APPLICATION'],
      operations: [OFFICIAL_FEE_PILOT_OPERATION],
      procedures: ['ELECTRONIC_FILING'],
      stages: ['NEW_APPLICATION'],
      filingBases: ['SECTION_1', 'SECTION_44'],
      segments: ['BASE_FEE'],
      requiredData: ['FILING_BASIS', 'CLASS_COUNT'],
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    inputSchemaId: 'brain-input.official-fee.v1',
    outputSchemaId: 'brain-output.official-fee.v1',
    executable: { strategy: 'authoritative-current-source' },
    requiredData: ['FILING_BASIS', 'CLASS_COUNT'],
    referenceDependencies: [],
    reasonCodes: { RESOLVED: 'Current official primary source resolved.' },
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation: {
      evaluationId: 'evaluation_official-fee-v1',
      evaluatedAt: '2026-08-27T00:00:00.000Z',
      status: 'PASSED',
      baseline: 'official-primary-source',
      metrics: { precision: 1 },
      evidenceSummary: 'Synthetic contract fixture only; no production fee value.'
    },
    lineage: {
      knowledgeSources: [
        {
          schemaVersion: 1,
          sourceSystem: 'MARKORBIT_KNOWLEDGE',
          content: {
            protocolVersion: '1.0',
            objectType: 'CONTENT_OBJECT_REF',
            objectId: 'knowledge-content_uspto-fee-schedule',
            objectKind: 'OFFICIAL_FEE_SCHEDULE',
            workspaceId: 'workspace_phase2-pilot'
          },
          chunkId: 'chunk_official-fee-base-application',
          contentSha256: sourceSha,
          indexedAt: '2026-08-27T00:00:00.000Z',
          indexMode: 'EXACT_CHUNK',
          headingPath: ['Trademark fees', 'Application filing fees'],
          retrievalRationale: 'Exact official fee schedule chunk for the frozen pilot.'
        }
      ],
      researchDatasets: []
    },
    limitations: ['Frozen to one official-fee pilot operation.'],
    createdAt: '2026-08-27T00:00:00.000Z',
    activatedAt: '2026-08-27T00:00:00.000Z',
    ...overrides
  };
}

function dataEngineOnlyLineage(): ExecutableMethodPackageV1['lineage'] {
  const queryFingerprint = sha('d');
  return {
    knowledgeSources: [],
    researchDatasets: [
      {
        contract_version: 1,
        dataset_ref_id: `research-dataset_${queryFingerprint}`,
        engine_version: 'test-engine-v1',
        fact_schema_version: 'test-fact-v1',
        jurisdictions: ['US'],
        resource_kinds: ['TRADEMARK_APPLICATION'],
        query: { operation: 'official-fee-test-fixture' },
        as_of: '2026-08-27T00:00:00.000Z',
        watermark: null,
        completeness: 'COMPLETE_BOUNDED',
        pagination: null,
        aggregation: null,
        sampling: null,
        partition: null,
        row_count: 1,
        generated_at: '2026-08-27T00:00:00.000Z',
        query_fingerprint_sha256: queryFingerprint,
        integrity_sha256: sha('e')
      }
    ]
  };
}

function input(
  sourceSha = sha('a'),
  amountMinor = 12345,
  overrides: Partial<OfficialFeeMaterializationInputV1> = {}
): OfficialFeeMaterializationInputV1 {
  return {
    package: methodPackage(sourceSha),
    currency: 'usd',
    amountMinor,
    unit: 'PER_CLASS',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    materializedAt: '2026-08-27T01:00:00.000Z',
    ...overrides
  };
}

function expectStoreError(action: () => unknown, code: OfficialFeeReferenceStoreErrorCode): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(OfficialFeeReferenceStoreError);
    if (!(error instanceof OfficialFeeReferenceStoreError)) throw error;
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`Expected OfficialFeeReferenceStoreError with code ${code}.`);
}

const query = {
  operation: OFFICIAL_FEE_PILOT_OPERATION,
  jurisdiction: 'US' as const,
  authority: 'USPTO' as const,
  asOf: '2026-08-28T00:00:00.000Z'
};

describe('Official Fee Reference materializer/store', () => {
  it('materializes deterministically and replays idempotently without Knowledge access', () => {
    const store = new InMemoryOfficialFeeReferenceStore();
    const first = store.materialize(input());
    const replay = store.materialize(input());

    expect(replay).toEqual(first);
    expect(first.currency).toBe('USD');
    expect(first.amountMinor).toBe(12345);
    expect(first.referenceId).toBe(`official-fee-ref_${first.materializationFingerprintSha256}`);
    expect(store.resolveCurrent(query)).toEqual(first);
  });

  it('fails closed when the same source/method replay identity changes payload', () => {
    const store = new InMemoryOfficialFeeReferenceStore();
    store.materialize(input());

    expectStoreError(() => store.materialize(input(sha('a'), 54321)), 'CONFLICT');
  });

  it('stales the prior reference when exact source lineage changes', () => {
    const store = new InMemoryOfficialFeeReferenceStore();
    const oldReference = store.materialize(input(sha('a'), 12345));
    const current = store.materialize(
      input(sha('b'), 23456, { materializedAt: '2026-08-28T01:00:00.000Z' })
    );

    expect(store.get(oldReference.referenceId)?.status).toBe('STALE');
    expect(store.resolveCurrent(query)).toEqual(current);
    expect(current.sourceIdentityFingerprintSha256).not.toBe(
      oldReference.sourceIdentityFingerprintSha256
    );
  });

  it('rejects inactive, out-of-scope and Knowledge-lineage-free packages', () => {
    const store = new InMemoryOfficialFeeReferenceStore();
    expectStoreError(
      () =>
        store.materialize(
          input(sha('a'), 12345, { package: methodPackage(sha('a'), { lifecycle: 'VALIDATED' }) })
        ),
      'PACKAGE_NOT_ACTIVE'
    );

    expectStoreError(
      () =>
        store.materialize(
          input(sha('a'), 12345, {
            package: methodPackage(sha('a'), {
              applicability: { ...methodPackage().applicability, jurisdictions: ['CA'] }
            })
          })
        ),
      'PACKAGE_OUT_OF_SCOPE'
    );

    expectStoreError(
      () =>
        store.materialize(
          input(sha('a'), 12345, {
            package: methodPackage(sha('a'), { lineage: dataEngineOnlyLineage() })
          })
        ),
      'MISSING_KNOWLEDGE_LINEAGE'
    );
  });

  it('fails closed outside temporal coverage', () => {
    const store = new InMemoryOfficialFeeReferenceStore();
    store.materialize(
      input(sha('a'), 12345, {
        effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveTo: '2027-01-01T00:00:00.000Z'
      })
    );

    expectStoreError(() => store.resolveCurrent(query), 'NO_CURRENT_REFERENCE');
  });
});
