import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  compileUsptoOfficialFeeMethodPackageV1
} from '@markorbit/contracts/brain-official-fee-method';
import {
  InMemoryOfficialFeeReferenceStore,
  OFFICIAL_FEE_PILOT_OPERATION
} from '../src/official-fee-reference-store.js';

type AcceptanceEvidence = {
  schemaVersion: 1;
  operation: typeof OFFICIAL_FEE_PILOT_OPERATION;
  jurisdiction: 'US';
  authority: 'USPTO';
  resolvedFee: {
    currency: string;
    amountMinor: number;
    unit: 'PER_CLASS';
    numericAuthority: {
      role: 'NUMERIC_AUTHORITY';
      canonicalUri: string;
      regulation: string;
      feeCode: string;
      label: string;
      knowledgeDocumentId: string;
      knowledgeDocumentContentSha256: string;
      knowledgeChunkId: string;
      knowledgeChunkContentSha256: string;
      knowledgeAcceptedMainSha: string;
    };
  };
  temporalResolution: {
    status: 'RESOLVED';
    effectiveFrom: string;
    authorityUri: string;
    authorityStatement: string;
    evidenceRef: string;
  };
  conflictResolution: {
    status: 'NONE';
    applicabilityAuthorityUri: string;
    knowledgeDocumentId: string;
    knowledgeDocumentContentSha256: string;
    knowledgeChunkId: string;
    knowledgeChunkContentSha256: string;
    evidenceRef: string;
  };
  observedAt: string;
  notes: string[];
};

function evidence(): AcceptanceEvidence {
  return JSON.parse(
    readFileSync(
      new URL('./fixtures/uspto-official-fee-phase2-acceptance.json', import.meta.url),
      'utf8'
    )
  ) as AcceptanceEvidence;
}

function sourceIdentity(source: (typeof USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE)[number]) {
  return {
    documentId: source.content.objectId,
    chunkId: source.chunkId,
    chunkContentSha256: source.contentSha256
  };
}

describe('Phase 2 Official Fee final acceptance', () => {
  it('materializes one real evidence-backed CURRENT reference and replays without Knowledge access', () => {
    const accepted = evidence();
    expect(accepted.operation).toBe(OFFICIAL_FEE_PILOT_OPERATION);
    expect(accepted.resolvedFee.numericAuthority.role).toBe('NUMERIC_AUTHORITY');
    expect(accepted.resolvedFee.numericAuthority.feeCode).toBe('7017');
    expect(accepted.resolvedFee.numericAuthority.regulation).toBe('37_CFR_2_6_A_1_III');

    const lineageIdentities = USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE.map(sourceIdentity);
    expect(lineageIdentities).toContainEqual({
      documentId: accepted.resolvedFee.numericAuthority.knowledgeDocumentId,
      chunkId: accepted.resolvedFee.numericAuthority.knowledgeChunkId,
      chunkContentSha256: accepted.resolvedFee.numericAuthority.knowledgeChunkContentSha256
    });
    expect(lineageIdentities).toContainEqual({
      documentId: accepted.conflictResolution.knowledgeDocumentId,
      chunkId: accepted.conflictResolution.knowledgeChunkId,
      chunkContentSha256: accepted.conflictResolution.knowledgeChunkContentSha256
    });

    const compiled = compileUsptoOfficialFeeMethodPackageV1({
      knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
      temporalResolution: {
        status: 'RESOLVED',
        effectiveFrom: accepted.temporalResolution.effectiveFrom,
        evidenceRef: accepted.temporalResolution.evidenceRef
      },
      conflictResolution: {
        status: 'NONE',
        evidenceRef: accepted.conflictResolution.evidenceRef
      }
    });
    expect(compiled.status).toBe('READY');
    if (compiled.status !== 'READY') return;

    expect(compiled.package.executable).toEqual(
      expect.objectContaining({
        temporalResolutionEvidenceRef: accepted.temporalResolution.evidenceRef,
        conflictResolutionEvidenceRef: accepted.conflictResolution.evidenceRef
      })
    );

    const store = new InMemoryOfficialFeeReferenceStore();
    const input = {
      package: compiled.package,
      currency: accepted.resolvedFee.currency,
      amountMinor: accepted.resolvedFee.amountMinor,
      unit: accepted.resolvedFee.unit,
      effectiveFrom: accepted.temporalResolution.effectiveFrom,
      materializedAt: accepted.observedAt
    };
    const first = store.materialize(input);
    const replay = store.materialize(input);

    expect(replay).toEqual(first);
    expect(first.status).toBe('CURRENT');
    expect(first.currency).toBe('USD');
    expect(first.amountMinor).toBe(accepted.resolvedFee.amountMinor);
    expect(first.effectiveFrom).toBe(accepted.temporalResolution.effectiveFrom);
    expect(first.knowledgeSources).toHaveLength(2);
    expect(
      store.resolveCurrent({
        operation: OFFICIAL_FEE_PILOT_OPERATION,
        jurisdiction: 'US',
        authority: 'USPTO',
        asOf: '2026-08-28T00:00:00.000Z'
      })
    ).toEqual(first);
  });

  it('keeps temporal normalization separate from crawl/index metadata and fails closed when removed', () => {
    const accepted = evidence();
    expect(accepted.temporalResolution.authorityUri).not.toBe(
      accepted.resolvedFee.numericAuthority.canonicalUri
    );
    expect(accepted.temporalResolution.effectiveFrom).not.toBe(
      USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE[0]?.indexedAt
    );

    expect(
      compileUsptoOfficialFeeMethodPackageV1({
        knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
        temporalResolution: { status: 'UNRESOLVED' },
        conflictResolution: {
          status: 'NONE',
          evidenceRef: accepted.conflictResolution.evidenceRef
        }
      })
    ).toEqual({ status: 'REJECTED', reason: 'TEMPORAL_UNRESOLVED' });
  });

  it('keeps the live monetary value out of Brain/Core production source', () => {
    const coreSource = readFileSync(
      new URL('../src/official-fee-reference-store.ts', import.meta.url),
      'utf8'
    );
    const brainSource = readFileSync(
      new URL('../../../packages/contracts/src/brain-official-fee-method.ts', import.meta.url),
      'utf8'
    );
    for (const source of [coreSource, brainSource]) {
      expect(source).not.toContain('35000');
      expect(source).not.toContain('$350');
    }
  });
});
