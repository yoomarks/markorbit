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
  ) as unknown;
}

describe('ReadyPackage Content Export V1 consumer contract', () => {
  it('accepts the frozen Knowledge fixture and serializes deterministically', async () => {
    const parsed = parseReadyPackageContentExportV1(await fixture());
    expect(parsed).not.toBeNull();
    expect(parsed?.stagingDocument.content).toBe('# Canonical knowledge\n');
    expect(serializeReadyPackageContentExportV1(parsed!)).toBe(
      serializeReadyPackageContentExportV1(parsed!)
    );
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
  ])('rejects data outside the frozen V1 shape', async (change) => {
    expect(
      parseReadyPackageContentExportV1(change((await fixture()) as Record<string, unknown>))
    ).toBe(null);
  });
});
