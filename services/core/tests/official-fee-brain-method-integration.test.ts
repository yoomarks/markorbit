import { describe, expect, it } from 'vitest';
import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  compileUsptoOfficialFeeMethodPackageV1
} from '@markorbit/contracts/brain-official-fee-method';
import type { KnowledgeRetrievalLineageRefV1 } from '@markorbit/contracts/brain-method';
import {
  InMemoryOfficialFeeReferenceStore,
  OFFICIAL_FEE_PILOT_OPERATION
} from '../src/official-fee-reference-store.js';

function compiledPackage() {
  const result = compileUsptoOfficialFeeMethodPackageV1({
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
  });
  if (result.status !== 'READY') throw new Error(`Expected READY package, got ${result.reason}`);
  return result.package;
}

function canonicalLineage(
  sources: readonly Readonly<KnowledgeRetrievalLineageRefV1>[]
): Readonly<KnowledgeRetrievalLineageRefV1>[] {
  return sources
    .map((source) => structuredClone(source))
    .sort((left, right) => {
      const leftIdentity = `${left.content.objectId}:${left.chunkId}:${left.contentSha256}`;
      const rightIdentity = `${right.content.objectId}:${right.chunkId}:${right.contentSha256}`;
      return leftIdentity.localeCompare(rightIdentity);
    });
}

describe('Official Fee Brain Method -> Core Reference materializer', () => {
  it('materializes and replays the accepted package without rerunning Knowledge', () => {
    const store = new InMemoryOfficialFeeReferenceStore();
    const pkg = compiledPackage();
    const input = {
      package: pkg,
      currency: 'USD',
      amountMinor: 12345,
      unit: 'PER_CLASS' as const,
      effectiveFrom: pkg.applicability.effectiveFrom,
      materializedAt: '2026-08-28T00:00:00.000Z'
    };

    const first = store.materialize(input);
    const replay = store.materialize(input);

    expect(replay).toEqual(first);
    expect(first.packageId).toBe(pkg.packageId);
    expect(canonicalLineage(first.knowledgeSources)).toEqual(
      canonicalLineage(pkg.lineage.knowledgeSources)
    );
    expect(
      store.resolveCurrent({
        operation: OFFICIAL_FEE_PILOT_OPERATION,
        jurisdiction: 'US',
        authority: 'USPTO',
        asOf: '2026-08-28T00:00:00.000Z'
      })
    ).toEqual(first);
  });
});
