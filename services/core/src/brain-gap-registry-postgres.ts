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
import type { ManagedDatabase, QueryClient } from '@markorbit/persistence';
import {
  BrainGapRegistryError,
  brainGapIdentityFingerprint
} from './brain-gap-registry.js';

const transitions: Readonly<Record<BrainGapStatus, readonly BrainGapStatus[]>> = {
  OPEN: ['ACKNOWLEDGED', 'RESOLVING', 'RESOLVED', 'DISMISSED'],
  ACKNOWLEDGED: ['RESOLVING', 'RESOLVED', 'DISMISSED', 'OPEN'],
  RESOLVING: ['RESOLVED', 'OPEN', 'DISMISSED'],
  RESOLVED: ['OPEN'],
  DISMISSED: ['OPEN']
};

type OccurrenceRow = {
  occurrence_sha256: string;
  occurrence_admission_sequence: string | number;
  detected_at: Date | string;
  gap_json: unknown;
};

type DispositionRow = {
  disposition_admission_sequence: string | number;
  occurred_at: Date | string;
  disposition_json: unknown;
};

type AuditAdmissionRow = {
  audit_payload_sha256: string;
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

function validateAudit(result: Readonly<BrainSelfAuditResult>): void {
  if (result.schemaVersion !== 1 || Number.isNaN(Date.parse(result.auditedAt)))
    throw new BrainGapRegistryError('INVALID_GAP', 'BrainSelfAuditResult is invalid.');
  result.gaps.forEach(validateGap);
}

function occurrenceFingerprint(gap: Readonly<BrainGap>): string {
  return sha256(gap);
}

function auditPayloadFingerprint(result: Readonly<BrainSelfAuditResult>): string {
  return sha256(result);
}

function auditAdmissionId(result: Readonly<BrainSelfAuditResult>): string {
  const identity = {
    schemaVersion: result.schemaVersion,
    auditedAt: result.auditedAt,
    gaps: result.gaps.map((gap) => ({
      brainGapId: gap.brainGapId,
      fingerprintSha256: gap.fingerprintSha256,
      relatedBrainBuildRunId: gap.relatedBrainBuildRunId ?? null,
      relatedBrainAssetVersionId: gap.relatedBrainAssetVersionId ?? null
    }))
  };
  return `brain-gap-audit_${sha256(identity)}`;
}

function dispositionId(
  key: BrainGapRegistryKey,
  disposition: Readonly<BrainGapDisposition>,
  occurrenceSha256?: string
): string {
  return `brain-gap-disposition_${sha256({
    key,
    disposition,
    occurrenceSha256: occurrenceSha256 ?? null
  })}`;
}

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function persistenceFailure(error: unknown): never {
  if (error instanceof BrainGapRegistryError) throw error;
  throw new BrainGapRegistryError(
    'PERSISTENCE_UNAVAILABLE',
    'BrainGap registry persistence is unavailable.',
    pgCode(error) ? { postgresCode: pgCode(error) } : undefined
  );
}

async function lock(client: QueryClient, key: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
}

function parseGap(value: unknown): BrainGap {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BrainGapRegistryError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored BrainGap payload is invalid.'
    );
  const gap = structuredClone(value) as BrainGap;
  validateGap(gap);
  return gap;
}

function parseDisposition(value: unknown): BrainGapDisposition {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BrainGapRegistryError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored BrainGap disposition payload is invalid.'
    );
  const disposition = structuredClone(value) as BrainGapDisposition;
  if (
    !['OPEN', 'ACKNOWLEDGED', 'RESOLVING', 'RESOLVED', 'DISMISSED'].includes(
      disposition.status
    ) ||
    Number.isNaN(Date.parse(disposition.occurredAt)) ||
    !disposition.reason?.trim() ||
    !['MANUAL', 'RECURRENCE'].includes(disposition.source)
  )
    throw new BrainGapRegistryError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored BrainGap disposition payload is invalid.'
    );
  return disposition;
}

async function occurrencesForKey(
  client: QueryClient,
  key: BrainGapRegistryKey
): Promise<readonly OccurrenceRow[]> {
  const result = await client.query<OccurrenceRow>(
    `SELECT occurrence_sha256,occurrence_admission_sequence,detected_at,gap_json
       FROM brain_gap_occurrences
      WHERE brain_gap_registry_key=$1
      ORDER BY detected_at ASC,occurrence_admission_sequence ASC`,
    [key]
  );
  return result.rows;
}

async function dispositionsForKey(
  client: QueryClient,
  key: BrainGapRegistryKey
): Promise<readonly DispositionRow[]> {
  const result = await client.query<DispositionRow>(
    `SELECT disposition_admission_sequence,occurred_at,disposition_json
       FROM brain_gap_dispositions
      WHERE brain_gap_registry_key=$1
      ORDER BY occurred_at ASC,disposition_admission_sequence ASC`,
    [key]
  );
  return result.rows;
}

async function reconstruct(
  client: QueryClient,
  key: BrainGapRegistryKey
): Promise<BrainGapRegistryRecord | undefined> {
  const occurrences = await occurrencesForKey(client, key);
  if (!occurrences.length) return undefined;
  const gaps = occurrences.map((row) => parseGap(row.gap_json));
  const firstDetectedAtMs = Math.min(...gaps.map((gap) => Date.parse(gap.detectedAt)));
  const lastDetectedAtMs = Math.max(...gaps.map((gap) => Date.parse(gap.detectedAt)));
  const latestGap = gaps.find((gap) => Date.parse(gap.detectedAt) === lastDetectedAtMs)!;
  const dispositions = await dispositionsForKey(client, key);
  const latestDisposition = dispositions.length
    ? parseDisposition(dispositions[dispositions.length - 1]!.disposition_json)
    : undefined;

  return {
    schemaVersion: 1,
    brainGapRegistryKey: key,
    identityFingerprintSha256: latestGap.fingerprintSha256,
    status: latestDisposition?.status ?? 'OPEN',
    firstDetectedAt: new Date(firstDetectedAtMs).toISOString(),
    lastDetectedAt: new Date(lastDetectedAtMs).toISOString(),
    occurrenceCount: occurrences.length,
    latestGap: structuredClone(latestGap),
    ...(latestDisposition ? { latestDisposition: structuredClone(latestDisposition) } : {})
  };
}

async function insertOccurrence(
  client: QueryClient,
  gap: Readonly<BrainGap>
): Promise<{ inserted: boolean; occurrenceSha256: string }> {
  const occurrenceSha256 = occurrenceFingerprint(gap);
  const key = registryKey(gap.fingerprintSha256);
  const result = await client.query(
    `INSERT INTO brain_gap_occurrences(
       occurrence_sha256,brain_gap_id,brain_gap_registry_key,identity_fingerprint_sha256,
       gap_type,severity,business_impact,detection_source,target_module,domain,jurisdiction,
       concept,reason_code,related_brain_build_run_id,related_brain_asset_version_id,detected_at,gap_json
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
     ON CONFLICT (occurrence_sha256) DO NOTHING`,
    [
      occurrenceSha256,
      gap.brainGapId,
      key,
      gap.fingerprintSha256,
      gap.gapType,
      gap.severity,
      gap.businessImpact,
      gap.detectionSource,
      gap.targetModule,
      gap.scope.domain,
      normalized(gap.scope.jurisdiction) ?? null,
      gap.scope.concept,
      gap.reasonCode,
      gap.relatedBrainBuildRunId ?? null,
      gap.relatedBrainAssetVersionId ?? null,
      gap.detectedAt,
      JSON.stringify(gap)
    ]
  );
  return { inserted: Boolean(result.rowCount), occurrenceSha256 };
}

async function insertDisposition(
  client: QueryClient,
  key: BrainGapRegistryKey,
  disposition: Readonly<BrainGapDisposition>,
  occurrenceSha256?: string
): Promise<void> {
  await client.query(
    `INSERT INTO brain_gap_dispositions(
       disposition_id,brain_gap_registry_key,status,occurred_at,reason,source,disposition_json
     ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      dispositionId(key, disposition, occurrenceSha256),
      key,
      disposition.status,
      disposition.occurredAt,
      disposition.reason,
      disposition.source,
      JSON.stringify(disposition)
    ]
  );
}

async function admitOne(
  client: QueryClient,
  gap: Readonly<BrainGap>
): Promise<{ record: BrainGapRegistryRecord; occurrenceSha256: string }> {
  const key = registryKey(gap.fingerprintSha256);
  const before = await reconstruct(client, key);
  const { inserted, occurrenceSha256 } = await insertOccurrence(client, gap);

  if (
    inserted &&
    before?.status === 'RESOLVED' &&
    before.latestDisposition &&
    Date.parse(gap.detectedAt) > Date.parse(before.latestDisposition.occurredAt)
  ) {
    await insertDisposition(
      client,
      key,
      {
        status: 'OPEN',
        occurredAt: gap.detectedAt,
        reason: 'A distinct detection occurrence objectively re-observed the resolved cognitive gap.',
        source: 'RECURRENCE'
      },
      occurrenceSha256
    );
  }

  const record = await reconstruct(client, key);
  if (!record)
    throw new BrainGapRegistryError(
      'PERSISTENCE_UNAVAILABLE',
      'BrainGap registry failed to reconstruct an admitted occurrence.'
    );
  return { record, occurrenceSha256 };
}

function matches(
  record: BrainGapRegistryRecord,
  query: Readonly<BrainGapRegistryQuery>
): boolean {
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

export class PostgresBrainGapRegistry {
  constructor(private readonly database: ManagedDatabase) {}

  async admit(gap: Readonly<BrainGap>): Promise<Readonly<BrainGapRegistryRecord>> {
    validateGap(gap);
    try {
      return await this.database.transact(async (client) => {
        const key = registryKey(gap.fingerprintSha256);
        await lock(client, `brain-gap:${key}`);
        return structuredClone((await admitOne(client, gap)).record);
      });
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async admitAudit(
    result: Readonly<BrainSelfAuditResult>
  ): Promise<readonly Readonly<BrainGapRegistryRecord>[]> {
    validateAudit(result);
    const admissionId = auditAdmissionId(result);
    const payloadSha256 = auditPayloadFingerprint(result);
    const keys = [
      ...new Set(result.gaps.map((gap) => registryKey(gap.fingerprintSha256)))
    ].sort();
    try {
      return await this.database.transact(async (client) => {
        await lock(client, `brain-gap-audit:${admissionId}`);
        for (const key of keys) await lock(client, `brain-gap:${key}`);

        const existing = await client.query<AuditAdmissionRow>(
          'SELECT audit_payload_sha256 FROM brain_gap_audit_admissions WHERE audit_admission_id=$1',
          [admissionId]
        );
        if (existing.rows[0]) {
          if (existing.rows[0].audit_payload_sha256 !== payloadSha256)
            throw new BrainGapRegistryError(
              'IDENTITY_CONFLICT',
              'A Brain self-audit admission identity cannot be replayed with a materially different payload.',
              { auditAdmissionId: admissionId }
            );
          const replayed = await Promise.all(
            result.gaps.map(async (gap) => {
              const record = await reconstruct(client, registryKey(gap.fingerprintSha256));
              if (!record)
                throw new BrainGapRegistryError(
                  'PERSISTENCE_UNAVAILABLE',
                  'BrainGap audit replay is missing its persisted registry occurrence.'
                );
              return structuredClone(record);
            })
          );
          return replayed;
        }

        await client.query(
          `INSERT INTO brain_gap_audit_admissions(
             audit_admission_id,audit_payload_sha256,schema_version,audited_at,audit_json
           ) VALUES($1,$2,$3,$4,$5::jsonb)`,
          [
            admissionId,
            payloadSha256,
            result.schemaVersion,
            result.auditedAt,
            JSON.stringify(result)
          ]
        );

        const admitted: BrainGapRegistryRecord[] = [];
        for (const [ordinal, gap] of result.gaps.entries()) {
          const { record, occurrenceSha256 } = await admitOne(client, gap);
          await client.query(
            `INSERT INTO brain_gap_audit_occurrence_memberships(
               audit_admission_id,audit_payload_sha256,audit_gap_ordinal,occurrence_sha256
             ) VALUES($1,$2,$3,$4)`,
            [admissionId, payloadSha256, ordinal, occurrenceSha256]
          );
          admitted.push(structuredClone(record));
        }
        return admitted;
      });
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async transition(
    command: Readonly<BrainGapTransitionCommand>
  ): Promise<Readonly<BrainGapRegistryRecord>> {
    const occurredAt = Date.parse(command.occurredAt);
    if (Number.isNaN(occurredAt) || !command.reason.trim())
      throw new BrainGapRegistryError(
        'INVALID_COMMAND',
        'BrainGap transition requires an ISO occurredAt and non-empty reason.'
      );
    try {
      return await this.database.transact(async (client) => {
        await lock(client, `brain-gap:${command.brainGapRegistryKey}`);
        const current = await reconstruct(client, command.brainGapRegistryKey);
        if (!current)
          throw new BrainGapRegistryError(
            'RECORD_NOT_FOUND',
            'BrainGap registry record was not found.'
          );
        if (!transitions[current.status].includes(command.toStatus))
          throw new BrainGapRegistryError(
            'INVALID_TRANSITION',
            `BrainGap status cannot transition from ${current.status} to ${command.toStatus}.`
          );
        const previousDispositionAt = current.latestDisposition
          ? Date.parse(current.latestDisposition.occurredAt)
          : Number.NEGATIVE_INFINITY;
        if (
          occurredAt < Date.parse(current.firstDetectedAt) ||
          occurredAt < previousDispositionAt
        )
          throw new BrainGapRegistryError(
            'INVALID_COMMAND',
            'BrainGap transition time cannot precede detection or the previous disposition.'
          );

        await insertDisposition(client, command.brainGapRegistryKey, {
          status: command.toStatus,
          occurredAt: command.occurredAt,
          reason: command.reason.trim(),
          source: 'MANUAL'
        });
        const updated = await reconstruct(client, command.brainGapRegistryKey);
        if (!updated)
          throw new BrainGapRegistryError(
            'PERSISTENCE_UNAVAILABLE',
            'BrainGap registry failed to reconstruct a transitioned record.'
          );
        return structuredClone(updated);
      });
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async get(
    brainGapRegistryKey: BrainGapRegistryKey
  ): Promise<Readonly<BrainGapRegistryRecord> | undefined> {
    try {
      const record = await reconstruct(this.database.getPool(), brainGapRegistryKey);
      return record ? structuredClone(record) : undefined;
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async query(
    query: Readonly<BrainGapRegistryQuery> = {}
  ): Promise<readonly Readonly<BrainGapRegistryRecord>[]> {
    try {
      const rows = await this.database
        .getPool()
        .query<{ brain_gap_registry_key: BrainGapRegistryKey }>(
          'SELECT DISTINCT brain_gap_registry_key FROM brain_gap_occurrences ORDER BY brain_gap_registry_key'
        );
      const records = await Promise.all(
        rows.rows.map((row) => reconstruct(this.database.getPool(), row.brain_gap_registry_key))
      );
      return records
        .filter((record): record is BrainGapRegistryRecord => Boolean(record))
        .filter((record) => matches(record, query))
        .sort((left, right) => left.brainGapRegistryKey.localeCompare(right.brainGapRegistryKey))
        .map((record) => structuredClone(record));
    } catch (error) {
      persistenceFailure(error);
    }
  }
}
