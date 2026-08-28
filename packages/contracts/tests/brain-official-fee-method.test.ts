import { describe, expect, it } from 'vitest';
import {
  selectExecutableMethodPackageV1,
  type KnowledgeRetrievalLineageRefV1
} from '../src/brain-method.js';
import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  USPTO_OFFICIAL_FEE_PILOT_OPERATION,
  compileUsptoOfficialFeeMethodPackageV1,
  type CompileUsptoOfficialFeeMethodInputV1
} from '../src/brain-official-fee-method.js';

function resolvedInput(): CompileUsptoOfficialFeeMethodInputV1 {
  return {
    knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
    temporalResolution: {
      status: 'RESOLVED',
      effectiveFrom: '2025-01-18T00:00:00.000Z',
      evidenceRef: 'USPTO_FY2025_TRADEMARK_FEE_APPLICABILITY'
    },
    conflictResolution: {
      status: 'NONE',
      evidenceRef: 'USPTO_DUAL_SOURCE_AUTHORITY_RECONCILIATION'
    }
  };
}

describe('USPTO Official Fee Brain Method compiler', () => {
  it('compiles one ACTIVE package bound to the exact accepted Knowledge lineage without a fee amount', () => {
    const result = compileUsptoOfficialFeeMethodPackageV1(resolvedInput());
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;

    expect(result.package.lifecycle).toBe('ACTIVE');
    expect(result.package.lineage.knowledgeSources).toHaveLength(2);
    expect(result.package.lineage.knowledgeSources.map((source) => source.chunkId).sort()).toEqual(
      USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE.map((source) => source.chunkId).sort()
    );
    expect(JSON.stringify(result)).not.toContain('350');
    expect(JSON.stringify(result)).not.toContain('amountMinor');
  });

  it('fails closed when temporal applicability or source conflict is unresolved', () => {
    expect(
      compileUsptoOfficialFeeMethodPackageV1({
        ...resolvedInput(),
        temporalResolution: { status: 'UNRESOLVED' }
      })
    ).toEqual({ status: 'REJECTED', reason: 'TEMPORAL_UNRESOLVED' });

    expect(
      compileUsptoOfficialFeeMethodPackageV1({
        ...resolvedInput(),
        conflictResolution: { status: 'UNRESOLVED' }
      })
    ).toEqual({ status: 'REJECTED', reason: 'CONFLICT_UNRESOLVED' });
  });

  it('rejects missing or tampered accepted lineage', () => {
    const missing = resolvedInput();
    missing.knowledgeSources = missing.knowledgeSources.slice(0, 1);
    expect(compileUsptoOfficialFeeMethodPackageV1(missing)).toEqual({
      status: 'REJECTED',
      reason: 'LINEAGE_MISMATCH'
    });

    const [acceptedSource] = USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE;
    if (!acceptedSource) throw new Error('Expected accepted Knowledge lineage fixture.');
    const source: KnowledgeRetrievalLineageRefV1 = structuredClone(acceptedSource);
    const tampered = resolvedInput();
    tampered.knowledgeSources = [
      {
        ...source,
        contentSha256: 'a'.repeat(64)
      },
      ...tampered.knowledgeSources.slice(1)
    ];
    expect(compileUsptoOfficialFeeMethodPackageV1(tampered)).toEqual({
      status: 'REJECTED',
      reason: 'LINEAGE_MISMATCH'
    });
  });

  it('is deterministic for the same evidence resolution and rejects out-of-scope selection', () => {
    const first = compileUsptoOfficialFeeMethodPackageV1(resolvedInput());
    const replay = compileUsptoOfficialFeeMethodPackageV1(resolvedInput());
    expect(replay).toEqual(first);
    if (first.status !== 'READY') throw new Error('Expected READY package.');

    const baseContext = {
      methodFamily: 'SOURCE_RESOLUTION' as const,
      jurisdiction: 'US',
      authority: 'USPTO',
      objectType: 'TRADEMARK_APPLICATION',
      operation: USPTO_OFFICIAL_FEE_PILOT_OPERATION,
      procedure: 'ELECTRONIC_FILING',
      stage: 'NEW_APPLICATION',
      filingBasis: 'SECTION_1',
      segment: 'BASE_FEE',
      availableData: ['FILING_BASIS', 'CLASS_COUNT', 'RESOLVED_OFFICIAL_FEE_VALUE'],
      asOf: '2026-08-28T00:00:00.000Z'
    };
    expect(selectExecutableMethodPackageV1([first.package], baseContext).status).toBe('SELECTED');
    expect(
      selectExecutableMethodPackageV1([first.package], {
        ...baseContext,
        jurisdiction: 'CA'
      })
    ).toEqual({ status: 'NOT_APPLICABLE', reason: 'No ACTIVE method package is applicable.' });
  });
});
