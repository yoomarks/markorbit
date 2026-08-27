import { describe, expect, it } from 'vitest';
import type {
  BrainGap,
  BrainGapRegistryRecord,
  BrainGapType,
  BrainSelfAuditResult
} from '@markorbit/contracts/brain-gap';
import {
  BrainGapRegistryError,
  InMemoryBrainGapRegistry,
  brainGapIdentityFingerprint
} from '../src/brain-gap-registry.js';

function gap(
  type: BrainGapType,
  detectedAt: string,
  overrides: Partial<BrainGap> = {}
): BrainGap {
  const base: BrainGap = {
    schemaVersion: 1,
    brainGapId: 'brain-gap_pending',
    fingerprintSha256: '0'.repeat(64),
    gapType: type,
    severity: type === 'STALE_EVIDENCE' ? 'MEDIUM' : 'HIGH',
    businessImpact: 'HIGH',
    status: 'OPEN',
    detectionSource: 'BUILD_RUN',
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'brain.gap.registry.test'
    },
    targetModule: type === 'INSUFFICIENT_SAMPLE' ? 'DATA_ENGINE' : 'KNOWLEDGE',
    reasonCode: type === 'STALE_EVIDENCE' ? 'FRESHNESS_BELOW_TRUSTED_THRESHOLD' : type,
    explanation: `Detected ${type}.`,
    remediationHint: 'Acquire governed evidence and recompute.',
    evidenceRefs: [
      {
        sourceOwner: 'KNOWLEDGE',
        sourceObjectId: `source-${type}`,
        sourceVersion: '2026-08',
        sourceFingerprintSha256: 'a'.repeat(64),
        observedAt: detectedAt
      }
    ],
    relatedBrainBuildRunId: `brain-build-run_${detectedAt.replaceAll(/\W/gu, '')}`,
    detectedAt,
    ...overrides
  };
  const fingerprintSha256 = brainGapIdentityFingerprint(base);
  return {
    ...base,
    brainGapId: `brain-gap_${fingerprintSha256}`,
    fingerprintSha256
  };
}

function audit(gaps: BrainGap[], auditedAt: string): BrainSelfAuditResult {
  return { schemaVersion: 1, gaps, auditedAt };
}

function expectRegistryError(action: () => unknown, code: BrainGapRegistryError['code']): void {
  try {
    action();
    throw new Error('Expected BrainGapRegistryError.');
  } catch (error) {
    expect(error).toBeInstanceOf(BrainGapRegistryError);
    expect((error as BrainGapRegistryError).code).toBe(code);
  }
}

describe('InMemoryBrainGapRegistry', () => {
  it('deduplicates exact audit replay but counts a distinct later occurrence on the same identity', () => {
    const registry = new InMemoryBrainGapRegistry();
    const firstGap = gap('STALE_EVIDENCE', '2026-08-27T00:00:00.000Z');
    const first = registry.admit(firstGap);
    const replay = registry.admit(structuredClone(firstGap));
    const laterGap = gap('STALE_EVIDENCE', '2026-08-28T00:00:00.000Z', {
      relatedBrainBuildRunId: 'brain-build-run_later'
    });
    const later = registry.admit(laterGap);

    expect(replay).toEqual(first);
    expect(replay.occurrenceCount).toBe(1);
    expect(later.brainGapRegistryKey).toBe(first.brainGapRegistryKey);
    expect(later.occurrenceCount).toBe(2);
    expect(later.firstDetectedAt).toBe('2026-08-27T00:00:00.000Z');
    expect(later.lastDetectedAt).toBe('2026-08-28T00:00:00.000Z');
    expect(later.latestGap.relatedBrainBuildRunId).toBe('brain-build-run_later');
  });

  it('reopens RESOLVED on a later objective recurrence and preserves the original first detection', () => {
    const registry = new InMemoryBrainGapRegistry();
    const initial = registry.admit(gap('MISSING_EVIDENCE', '2026-08-27T00:00:00.000Z'));
    const resolved = registry.transition({
      brainGapRegistryKey: initial.brainGapRegistryKey,
      toStatus: 'RESOLVED',
      occurredAt: '2026-08-27T12:00:00.000Z',
      reason: 'New authoritative evidence was acquired and the cognition was recomputed.'
    });
    const recurrence = registry.admit(
      gap('MISSING_EVIDENCE', '2026-08-29T00:00:00.000Z', {
        relatedBrainBuildRunId: 'brain-build-run_recurrence'
      })
    );

    expect(resolved.status).toBe('RESOLVED');
    expect(recurrence.status).toBe('OPEN');
    expect(recurrence.firstDetectedAt).toBe(initial.firstDetectedAt);
    expect(recurrence.occurrenceCount).toBe(2);
    expect(recurrence.latestDisposition).toMatchObject({
      status: 'OPEN',
      source: 'RECURRENCE',
      occurredAt: '2026-08-29T00:00:00.000Z'
    });
  });

  it('keeps an identical DISMISSED gap dismissed when it is observed again', () => {
    const registry = new InMemoryBrainGapRegistry();
    const initial = registry.admit(gap('STALE_EVIDENCE', '2026-08-27T00:00:00.000Z'));
    registry.transition({
      brainGapRegistryKey: initial.brainGapRegistryKey,
      toStatus: 'DISMISSED',
      occurredAt: '2026-08-27T06:00:00.000Z',
      reason: 'This exact governed gap is accepted for the current operating scope.'
    });
    const observedAgain = registry.admit(
      gap('STALE_EVIDENCE', '2026-08-30T00:00:00.000Z', {
        relatedBrainBuildRunId: 'brain-build-run_dismissed-recurrence'
      })
    );

    expect(observedAgain.status).toBe('DISMISSED');
    expect(observedAgain.occurrenceCount).toBe(2);
    expect(observedAgain.latestDisposition?.source).toBe('MANUAL');
  });

  it('enforces the frozen manual transition graph and monotonic disposition time', () => {
    const registry = new InMemoryBrainGapRegistry();
    const record = registry.admit(gap('MISSING_EVIDENCE', '2026-08-27T00:00:00.000Z'));

    expectRegistryError(
      () =>
        registry.transition({
          brainGapRegistryKey: record.brainGapRegistryKey,
          toStatus: 'OPEN',
          occurredAt: '2026-08-27T01:00:00.000Z',
          reason: 'No-op transitions are not valid governance events.'
        }),
      'INVALID_TRANSITION'
    );

    registry.transition({
      brainGapRegistryKey: record.brainGapRegistryKey,
      toStatus: 'ACKNOWLEDGED',
      occurredAt: '2026-08-27T02:00:00.000Z',
      reason: 'An operator acknowledged the cognitive gap.'
    });

    expectRegistryError(
      () =>
        registry.transition({
          brainGapRegistryKey: record.brainGapRegistryKey,
          toStatus: 'RESOLVING',
          occurredAt: '2026-08-27T01:00:00.000Z',
          reason: 'This event would move governance time backwards.'
        }),
      'INVALID_COMMAND'
    );
  });

  it('validates an audit batch before mutation so one invalid gap cannot partially admit the batch', () => {
    const registry = new InMemoryBrainGapRegistry();
    const valid = gap('MISSING_EVIDENCE', '2026-08-27T00:00:00.000Z');
    const invalid: BrainGap = {
      ...gap('STALE_EVIDENCE', '2026-08-27T01:00:00.000Z'),
      fingerprintSha256: 'f'.repeat(64)
    };

    expectRegistryError(
      () => registry.admitAudit(audit([valid, invalid], '2026-08-27T02:00:00.000Z')),
      'IDENTITY_CONFLICT'
    );
    expect(registry.query()).toEqual([]);
  });

  it('filters with stable ordering and never exposes mutable internal records', () => {
    const registry = new InMemoryBrainGapRegistry();
    registry.admit(
      gap('INSUFFICIENT_SAMPLE', '2026-08-27T01:00:00.000Z', {
        scope: { domain: 'TRADEMARK', jurisdiction: 'CA', concept: 'timeline' },
        targetModule: 'DATA_ENGINE',
        reasonCode: 'STATISTICAL_COVERAGE_BELOW_THRESHOLD'
      })
    );
    registry.admit(
      gap('MISSING_EVIDENCE', '2026-08-27T00:00:00.000Z', {
        scope: { domain: 'TRADEMARK', jurisdiction: 'US', concept: 'fee' },
        targetModule: 'KNOWLEDGE',
        reasonCode: 'NO_APPLICABLE_EVIDENCE'
      })
    );

    const all = registry.query();
    expect(all.map((record) => record.brainGapRegistryKey)).toEqual(
      [...all.map((record) => record.brainGapRegistryKey)].sort()
    );
    const usKnowledge = registry.query({
      status: 'OPEN',
      targetModule: 'KNOWLEDGE',
      domain: 'TRADEMARK',
      jurisdiction: 'us',
      concept: 'fee'
    });
    expect(usKnowledge).toHaveLength(1);
    const leaked = usKnowledge[0] as BrainGapRegistryRecord;
    (leaked as { occurrenceCount: number }).occurrenceCount = 999;
    expect(registry.get(leaked.brainGapRegistryKey)?.occurrenceCount).toBe(1);
  });
});
