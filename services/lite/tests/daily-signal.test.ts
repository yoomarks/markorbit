import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CoreKnowledgeDailySourceProjection } from '@markorbit/contracts/daily-source';
import { DailySignalImportError, deriveDailySignal } from '../src/daily-signal.js';

const workspaceId = '71717171-7171-4717-8717-717171717171';
const markdown = `# USPTO trademark fee rule update

The USPTO announced a trademark fee rule update effective next month.

- Applicants should review the new fee schedule.
- The notice includes an effective date and filing guidance.
`;
const sha256 = (value: string) => createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');

function projection(content = markdown): CoreKnowledgeDailySourceProjection {
  return {
    schemaVersion: 1,
    readyPackageId: 'rdp_m9-wp02-uspto',
    source: {
      schemaVersion: 1,
      owner: 'CORE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: 'rdp_m9-wp02-uspto',
      sourceVersion: 'CORE_CONTENT_V1',
      sourceFingerprintSha256: 'a'.repeat(64),
      observedAt: '2026-08-18T01:00:00.000Z'
    },
    content: {
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      sha256: sha256(content),
      content,
      originalName: 'uspto-update.md',
      capturedAt: '2026-08-18T00:50:00.000Z',
      legalTruthVerified: false
    }
  };
}

describe('M9-WP-02 Daily Signal derivation', () => {
  it('derives bounded explainable metadata from exact governed Markdown', () => {
    const signal = deriveDailySignal(workspaceId, projection(), {
      id: 'daily-signal_m9-wp02',
      createdAt: '2026-08-18T01:01:00.000Z'
    });
    expect(signal.title).toBe('USPTO trademark fee rule update');
    expect(signal.summary).toContain('USPTO announced');
    expect(signal.keyFacts).toEqual([
      'Applicants should review the new fee schedule.',
      'The notice includes an effective date and filing guidance.'
    ]);
    expect(signal.jurisdictions).toEqual(['US']);
    expect(signal.institution).toBe('USPTO');
    expect(signal.topicTags).toContain('trademark');
    expect(signal.changeType).toBe('FEE_CHANGE');
    expect(signal.timeSensitivity).toBe('HIGH');
    expect(signal.legalTruthVerified).toBe(false);
    expect(signal.recommendationCreatedAutomatically).toBe(false);
    expect(signal.source.owner).toBe('CORE');
    expect(signal.dailySignalFingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('does not invent jurisdiction or institution when the source has no marker', () => {
    const content = '# Professional update\n\nA general industry update was published.\n';
    const signal = deriveDailySignal(workspaceId, projection(content), {
      id: 'daily-signal_m9-wp02-generic'
    });
    expect(signal.jurisdictions).toEqual([]);
    expect(signal.institution).toBeUndefined();
    expect(signal.topicTags).toEqual(['professional-update']);
    expect(signal.changeType).toBe('INDUSTRY_NEWS');
    expect(signal.timeSensitivity).toBe('LOW');
  });

  it('fails closed when the Markdown bytes do not match their digest', () => {
    const value = projection();
    value.content.sha256 = 'f'.repeat(64);
    expect(() => deriveDailySignal(workspaceId, value)).toThrowError(DailySignalImportError);
  });

  it('fails closed when source identity and ReadyPackage identity diverge', () => {
    const value = projection();
    value.source.sourceId = 'rdp_other';
    expect(() => deriveDailySignal(workspaceId, value)).toThrowError(
      expect.objectContaining({ code: 'SOURCE_FINGERPRINT_MISMATCH' })
    );
  });
});
