import { createHash } from 'node:crypto';
import type {
  BrainGap,
  BrainGapDisposition,
  BrainGapRegistryKey,
  BrainGapRegistryQuery,
  BrainGapRegistryRecord,
  BrainGapStatus,
  BrainGapTransitionCommand,
  BrainSelfAuditResult
} from '@markorbit/contracts/brain-gap';

export type BrainGapRegistryErrorCode =
  | 'INVALID_GAP'
  | 'IDENTITY_CONFLICT'
  | 'RECORD_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'INVALID_COMMAND';

export class BrainGapRegistryError extends Error {
  constructor(
    readonly code: BrainGapRegistryErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'BrainGapRegistryError';
  }
}

type InternalRecord = {
  record: BrainGapRegistryRecord;
  occurrenceFingerprints: Set<string>;
};

const transitions: Readonly<Record<BrainGapStatus, readonly BrainGapStatus[]>> = {
  OPEN: ['ACKNOWLEDGED', 'RESOLVING', 'RESOLVED', 'DISMISSED'],
  ACKNOWLEDGED: ['RESOLVING', 'RESOLVED', 'DISMISSED', 'OPEN'],
  RESOLVING: ['RESOLVED', 'OPEN', 'DISMISSED'],
  RESOLVED: ['OPEN'],
  DISMISSED: ['OPEN']
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(',')}}`;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function normalized(value: string | undefined): string | undefined {
  return value?.trim().toUpperCase();
}

export function brainGapIdentityFingerprint(gap: Readonly<BrainGap>): string {
  return sha256({
    gapType: gap.gapType,
    domain: gap.scope.domain,
    jurisdiction: normalized(gap.scope.jurisdiction) ?? null,
    concept: gap.scope.concept,
    targetModule: gap.targetModule,
    reasonCode: gap.reasonCode
  });
}

function occurrenceFingerprint(gap: Readonly<BrainGap>): string {
  return sha256(gap);
}

function registryKey(fingerprint: string): BrainGapRegistryKey {
  return `brain-gap-key_${fingerprint}`;
}

function parseTime(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed))
    throw new BrainGapRegistryError('INVALID_GAP', `${field} must be an ISO date/time.`);
  return parsed;
}

function validateGap(gap: Readonly<BrainGap>): void {
  if (gap.schemaVersion !== 1)
    throw new BrainGapRegistryError('INVALID_GAP', 'BrainGap schemaVersion must be 1.');
  if (gap.status !== 'OPEN')
    throw new BrainGapRegistryError(
      'INVALID_GAP',
      'A detection occurrence admitted to the registry must have OPEN status.'
    );
  if (!/^[a-f0-9]{64}$/u.test(gap.fingerprintSha256))
    throw new BrainGapRegistryError('INVALID_GAP', 'BrainGap fingerprint must be sha256 hex.');
  if (gap.brainGapId !== `brain-gap_${gap.fingerprintSha256}`)
    throw new BrainGapRegistryError(
      'IDENTITY_CONFLICT',
      'BrainGap id must match its identity fingerprint.'
    );
  const expected = brainGapIdentityFingerprint(gap);
  if (expected !== gap.fingerprintSha256)
    throw new BrainGapRegistryError(
      'IDENTITY_CONFLICT',
      'BrainGap fingerprint does not match its governed longitudinal identity.',
      { expectedFingerprintSha256: expected, receivedFingerprintSha256: gap.fingerprintSha256 }
    );
  parseTime(gap.detectedAt, 'BrainGap.detectedAt');
}

function cloneRecord(record: BrainGapRegistryRecord): BrainGapRegistryRecord {
  return structuredClone(record);
}

function cloneState(source: Map<BrainGapRegistryKey, InternalRecord>): Map<BrainGapRegistryKey, InternalRecord> {
  return new Map(
    [...source.entries()].map(([key, value]) => [
      key,
      {
        record: cloneRecord(value.record),
        occurrenceFingerprints: new Set(value.occurrenceFingerprints)
      }
    ])
  );
}

function latestDispositionForRecurrence(gap: Readonly<BrainGap>): BrainGapDisposition {
  return {
    status: 'OPEN',
    occurredAt: gap.detectedAt,
    reason: 'A distinct detection occurrence objectively re-observed the resolved cognitive gap.',
    source: 'RECURRENCE'
  };
}

function admitOne(state: Map<BrainGapRegistryKey, InternalRecord>, gap: Readonly<BrainGap>): BrainGapRegistryRecord {
  validateGap(gap);
  const key = registryKey(gap.fingerprintSha256);
  const occurrence = occurrenceFingerprint(gap);
  const existing = state.get(key);

  if (!existing) {
    const record: BrainGapRegistryRecord = {
      schemaVersion: 1,
      brainGapRegistryKey: key,
      identityFingerprintSha256: gap.fingerprintSha256,
      status: 'OPEN',
      firstDetectedAt: gap.detectedAt,
      lastDetectedAt: gap.detectedAt,
      occurrenceCount: 1,
      latestGap: structuredClone(gap)
    };
    state.set(key, { record, occurrenceFingerprints: new Set([occurrence]) });
    return cloneRecord(record);
  }

  if (existing.record.identityFingerprintSha256 !== gap.fingerprintSha256)
    throw new BrainGapRegistryError(
      'IDENTITY_CONFLICT',
      'BrainGap registry key cannot be reused for a different identity.'
    );
  if (existing.occurrenceFingerprints.has(occurrence)) return cloneRecord(existing.record);

  const detectedAt = parseTime(gap.detectedAt, 'BrainGap.detectedAt');
  const firstDetectedAt = Math.min(
    parseTime(existing.record.firstDetectedAt, 'record.firstDetectedAt'),
    detectedAt
  );
  const previousLastDetectedAt = parseTime(existing.record.lastDetectedAt, 'record.lastDetectedAt');
  const laterThanLast = detectedAt > previousLastDetectedAt;
  let status = existing.record.status;
  let latestDisposition = existing.record.latestDisposition;

  if (
    status === 'RESOLVED' &&
    (!latestDisposition || detectedAt > parseTime(latestDisposition.occurredAt, 'disposition.occurredAt'))
  ) {
    status = 'OPEN';
    latestDisposition = latestDispositionForRecurrence(gap);
  }

  existing.occurrenceFingerprints.add(occurrence);
  existing.record = {
    ...existing.record,
    status,
    firstDetectedAt: new Date(firstDetectedAt).toISOString(),
    lastDetectedAt: new Date(Math.max(previousLastDetectedAt, detectedAt)).toISOString(),
    occurrenceCount: existing.record.occurrenceCount + 1,
    ...(laterThanLast ? { latestGap: structuredClone(gap) } : {}),
    ...(latestDisposition ? { latestDisposition: structuredClone(latestDisposition) } : {})
  };
  return cloneRecord(existing.record);
}

function matches(record: BrainGapRegistryRecord, query: Readonly<BrainGapRegistryQuery>): boolean {
  const gap = record.latestGap;
  return (
    (query.status === undefined || record.status === query.status) &&
    (query.gapType === undefined || gap.gapType === query.gapType) &&
    (query.targetModule === undefined || gap.targetModule === query.targetModule) &&
    (query.domain === undefined || gap.scope.domain === query.domain) &&
    (query.jurisdiction === undefined ||
      normalized(gap.scope.jurisdiction) === normalized(query.jurisdiction)) &&
    (query.concept === undefined || gap.scope.concept === query.concept)
  );
}

export class InMemoryBrainGapRegistry {
  private records = new Map<BrainGapRegistryKey, InternalRecord>();

  admit(gap: Readonly<BrainGap>): Readonly<BrainGapRegistryRecord> {
    const draft = cloneState(this.records);
    const result = admitOne(draft, gap);
    this.records = draft;
    return result;
  }

  admitAudit(result: Readonly<BrainSelfAuditResult>): readonly Readonly<BrainGapRegistryRecord>[] {
    if (result.schemaVersion !== 1 || Number.isNaN(Date.parse(result.auditedAt)))
      throw new BrainGapRegistryError('INVALID_GAP', 'BrainSelfAuditResult is invalid.');
    const draft = cloneState(this.records);
    const admitted = result.gaps.map((gap) => admitOne(draft, gap));
    this.records = draft;
    return admitted.map(cloneRecord);
  }

  transition(command: Readonly<BrainGapTransitionCommand>): Readonly<BrainGapRegistryRecord> {
    const occurredAt = Date.parse(command.occurredAt);
    if (Number.isNaN(occurredAt) || !command.reason.trim())
      throw new BrainGapRegistryError(
        'INVALID_COMMAND',
        'BrainGap transition requires an ISO occurredAt and non-empty reason.'
      );
    const current = this.records.get(command.brainGapRegistryKey);
    if (!current)
      throw new BrainGapRegistryError('RECORD_NOT_FOUND', 'BrainGap registry record was not found.');
    if (!transitions[current.record.status].includes(command.toStatus))
      throw new BrainGapRegistryError(
        'INVALID_TRANSITION',
        `BrainGap status cannot transition from ${current.record.status} to ${command.toStatus}.`
      );
    const previousDispositionAt = current.record.latestDisposition
      ? Date.parse(current.record.latestDisposition.occurredAt)
      : Number.NEGATIVE_INFINITY;
    if (
      occurredAt < Date.parse(current.record.firstDetectedAt) ||
      occurredAt < previousDispositionAt
    )
      throw new BrainGapRegistryError(
        'INVALID_COMMAND',
        'BrainGap transition time cannot precede detection or the previous disposition.'
      );

    const disposition: BrainGapDisposition = {
      status: command.toStatus,
      occurredAt: command.occurredAt,
      reason: command.reason.trim(),
      source: 'MANUAL'
    };
    current.record = {
      ...current.record,
      status: command.toStatus,
      latestDisposition: disposition
    };
    return cloneRecord(current.record);
  }

  get(brainGapRegistryKey: BrainGapRegistryKey): Readonly<BrainGapRegistryRecord> | undefined {
    const record = this.records.get(brainGapRegistryKey)?.record;
    return record ? cloneRecord(record) : undefined;
  }

  query(query: Readonly<BrainGapRegistryQuery> = {}): readonly Readonly<BrainGapRegistryRecord>[] {
    return [...this.records.values()]
      .map((value) => value.record)
      .filter((record) => matches(record, query))
      .sort((left, right) => left.brainGapRegistryKey.localeCompare(right.brainGapRegistryKey))
      .map(cloneRecord);
  }
}
