import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  parseReadyPackageContentExportV1,
  serializeReadyPackageContentExportV1
} from '../src/knowledge-content-export.js';

async function fixture() {
  return JSON.parse(
    await readFile(
      new URL('../fixtures/ready-package-content-export-v1.json', import.meta.url),
      'utf8'
    )
  ) as Record<string, unknown>;
}

function governedFixture(kind: 'STANDARD_SOURCE' | 'GLOBAL_REFERENCE' = 'STANDARD_SOURCE') {
  return fixture().then((legacy) => {
    const sourceId = (legacy.provenance as { sourceId: string }).sourceId;
    return {
      ...legacy,
      contractVersion: '1.1',
      sourceGovernance:
        kind === 'STANDARD_SOURCE'
          ? { snapshotVersion: '1.0', kind, sourceId }
          : {
              snapshotVersion: '1.0',
              kind,
              sourceId,
              referenceProtocolVersion: '1.0',
              sourceRole: 'TM_PRACTICE_GUIDE',
              authorityTier: 'B_PLUS',
              intendedUses: ['TRADEMARK_PROFILE'],
              factEligibility: 'SECONDARY',
              verification: {
                policy: 'REQUIRED',
                verifyAgainstSourceIds: ['official-fixture'],
                verifyAgainstJurisdictionOfficialSource: true
              },
              contentReusePolicy: 'FACT_EXTRACTION_WITH_PROVENANCE'
            }
    };
  });
}

describe('ReadyPackage Content Export consumer contract', () => {
  it('keeps accepting and deterministically serializing frozen V1 requests', async () => {
    const parsed = parseReadyPackageContentExportV1(await fixture());
    expect(parsed).not.toBeNull();
    expect(parsed?.contractVersion).toBe('1.0');
    expect(parsed?.stagingDocument.content).toBe('# Canonical knowledge\n');
    expect(serializeReadyPackageContentExportV1(parsed!)).toBe(
      serializeReadyPackageContentExportV1(parsed!)
    );
  });

  it.each(['STANDARD_SOURCE', 'GLOBAL_REFERENCE'] as const)(
    'accepts governed V1.1 %s exports and preserves governance in serialization',
    async (kind) => {
      const parsed = parseReadyPackageContentExportV1(await governedFixture(kind));
      expect(parsed).not.toBeNull();
      expect(parsed?.contractVersion).toBe('1.1');
      expect(parsed?.sourceGovernance?.kind).toBe(kind);
      expect(JSON.parse(serializeReadyPackageContentExportV1(parsed!))).toMatchObject({
        contractVersion: '1.1',
        sourceGovernance: { kind }
      });
    }
  );

  it('rejects V1.1 governance whose Source identity differs from provenance', async () => {
    const value = await governedFixture();
    value.sourceGovernance.sourceId = 'src_01ARZ3NDEKTSV4RRFFQ69G5FAA';
    expect(parseReadyPackageContentExportV1(value)).toBe(null);
  });

  it('rejects Global Reference governance with an unknown content reuse policy', async () => {
    const value = await governedFixture('GLOBAL_REFERENCE');
    (value.sourceGovernance as Record<string, unknown>).contentReusePolicy = 'COPY_VERBATIM';
    expect(parseReadyPackageContentExportV1(value)).toBe(null);
  });

  it.each([
    (value: Record<string, unknown>) => ({ ...value, unexpected: true }),
    (value: Record<string, unknown>) => ({ ...value, contractVersion: '2.0' }),
    (value: Record<string, unknown>) => ({
      ...value,
      provenance: { ...(value.provenance as object), legalTruthVerified: true }
    }),
    (value: Record<string, unknown>) => ({
      ...value,
      stagingDocument: { ...(value.stagingDocument as object), mediaType: 'text/plain' }
    })
  ])('rejects data outside the governed content-export shapes', async (change) => {
    expect(parseReadyPackageContentExportV1(change(await fixture()))).toBe(null);
  });
});
