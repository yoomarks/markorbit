import { createHash } from 'node:crypto';
import type { QueryClient } from '@markorbit/persistence';

const SHA256 = /^[a-f0-9]{64}$/u;
const SENSITIVE_HEADER =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)$/iu;

export type ManagedCommunicationEvidenceHeaderV1 = Readonly<{
  name: string;
  value: string;
}>;

export type ManagedCommunicationExactEvidenceRefV1 = Readonly<{
  schemaVersion: 1;
  evidenceRef: string;
  sha256: string;
  mediaType: string;
  sizeBytes: number;
  observedAt: string;
  provider: string;
  providerMessageId: string;
  headers: readonly ManagedCommunicationEvidenceHeaderV1[];
  metadata: Readonly<Record<string, string>>;
}>;

export type ManagedCommunicationExactEvidenceAdmissionV1 = Readonly<{
  workspaceId: string;
  accountRef: string;
  messageId: string;
  provider: string;
  providerMessageId: string;
  rawPayload: Uint8Array;
  mediaType: string;
  observedAt: string;
  headers: readonly ManagedCommunicationEvidenceHeaderV1[];
  metadata?: Readonly<Record<string, string>>;
  now: string;
}>;

export type ManagedCommunicationExactEvidenceAdmissionOutcomeV1 = Readonly<{
  schemaVersion: 1;
  disposition: 'ADMITTED' | 'REPLAYED';
  evidence: ManagedCommunicationExactEvidenceRefV1;
}>;

export type ManagedCommunicationExactEvidenceErrorCode =
  | 'INVALID_EXACT_EVIDENCE'
  | 'NORMALIZED_MESSAGE_NOT_FOUND'
  | 'PROVENANCE_MISMATCH'
  | 'EXACT_EVIDENCE_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class ManagedCommunicationExactEvidenceError extends Error {
  constructor(
    readonly code: ManagedCommunicationExactEvidenceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ManagedCommunicationExactEvidenceError';
  }
}

export interface ManagedCommunicationExactEvidenceStoreV1 {
  admitExactEvidence(
    input: ManagedCommunicationExactEvidenceAdmissionV1
  ): Promise<ManagedCommunicationExactEvidenceAdmissionOutcomeV1>;
  resolveExactEvidence(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
  }): Promise<ManagedCommunicationExactEvidenceRefV1 | undefined>;
}

function clean(value: string, field: string, maxLength = 1_000): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength)
    throw new ManagedCommunicationExactEvidenceError(
      'INVALID_EXACT_EVIDENCE',
      `${field} must contain 1 to ${maxLength} characters.`
    );
  return normalized;
}

function canonicalTimestamp(value: string, field: string): string {
  const normalized = clean(value, field, 80);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized)
    throw new ManagedCommunicationExactEvidenceError(
      'INVALID_EXACT_EVIDENCE',
      `${field} must be a canonical ISO timestamp.`
    );
  return normalized;
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalHeaders(
  headers: readonly ManagedCommunicationEvidenceHeaderV1[]
): readonly ManagedCommunicationEvidenceHeaderV1[] {
  if (!Array.isArray(headers))
    throw new ManagedCommunicationExactEvidenceError(
      'INVALID_EXACT_EVIDENCE',
      'headers must be an array.'
    );
  const normalized = headers.map((header, index) => {
    const name = clean(header.name, `headers[${index}].name`, 200).toLowerCase();
    if (SENSITIVE_HEADER.test(name))
      throw new ManagedCommunicationExactEvidenceError(
        'INVALID_EXACT_EVIDENCE',
        `Sensitive credential/session header ${name} must not be persisted as Communication evidence.`
      );
    return Object.freeze({
      name,
      value: clean(header.value, `headers[${index}].value`, 20_000)
    });
  });
  normalized.sort((left, right) =>
    left.name === right.name
      ? left.value.localeCompare(right.value)
      : left.name.localeCompare(right.name)
  );
  return Object.freeze(normalized);
}

function canonicalMetadata(
  metadata: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> {
  if (metadata === undefined) return Object.freeze({});
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    throw new ManagedCommunicationExactEvidenceError(
      'INVALID_EXACT_EVIDENCE',
      'metadata must be an object.'
    );
  const entries: [string, string][] = Object.entries(metadata).map(([key, value]) => [
    clean(key, 'metadata key', 200),
    clean(value, `metadata.${key}`, 20_000)
  ]);
  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.freeze(Object.fromEntries(entries));
}

type ValidatedAdmission = {
  workspaceId: string;
  accountRef: string;
  messageId: string;
  provider: string;
  providerMessageId: string;
  rawPayload: Uint8Array;
  mediaType: string;
  observedAt: string;
  headers: readonly ManagedCommunicationEvidenceHeaderV1[];
  metadata: Readonly<Record<string, string>>;
  now: string;
  sha256: string;
  evidenceRef: string;
};

function validated(input: ManagedCommunicationExactEvidenceAdmissionV1): ValidatedAdmission {
  if (!(input.rawPayload instanceof Uint8Array) || input.rawPayload.byteLength < 1)
    throw new ManagedCommunicationExactEvidenceError(
      'INVALID_EXACT_EVIDENCE',
      'rawPayload must contain the exact non-empty provider message bytes.'
    );
  const workspaceId = clean(input.workspaceId, 'workspaceId', 500);
  const accountRef = clean(input.accountRef, 'accountRef', 500);
  const messageId = clean(input.messageId, 'messageId', 500);
  const provider = clean(input.provider, 'provider', 120);
  const providerMessageId = clean(input.providerMessageId, 'providerMessageId', 500);
  const sha256 = digest(input.rawPayload);
  if (!SHA256.test(sha256)) throw new Error('unreachable SHA-256 invariant');
  return {
    workspaceId,
    accountRef,
    messageId,
    provider,
    providerMessageId,
    rawPayload: Uint8Array.from(input.rawPayload),
    mediaType: clean(input.mediaType, 'mediaType', 200),
    observedAt: canonicalTimestamp(input.observedAt, 'observedAt'),
    headers: canonicalHeaders(input.headers),
    metadata: canonicalMetadata(input.metadata),
    now: canonicalTimestamp(input.now, 'now'),
    sha256,
    evidenceRef: `commevidence_${createHash('sha256')
      .update(`${workspaceId}\n${accountRef}\n${messageId}\n${sha256}`)
      .digest('hex')
      .slice(0, 40)}`
  };
}

function ref(value: ValidatedAdmission): ManagedCommunicationExactEvidenceRefV1 {
  return Object.freeze({
    schemaVersion: 1,
    evidenceRef: value.evidenceRef,
    sha256: value.sha256,
    mediaType: value.mediaType,
    sizeBytes: value.rawPayload.byteLength,
    observedAt: value.observedAt,
    provider: value.provider,
    providerMessageId: value.providerMessageId,
    headers: value.headers,
    metadata: value.metadata
  });
}

type MemoryRow = {
  evidence: ManagedCommunicationExactEvidenceRefV1;
  rawPayload: Uint8Array;
};

export class InMemoryManagedCommunicationExactEvidenceStoreV1 implements ManagedCommunicationExactEvidenceStoreV1 {
  private readonly rows = new Map<string, MemoryRow>();
  private readonly messageProvenance = new Map<
    string,
    { provider: string; providerMessageId: string }
  >();

  registerNormalizedMessage(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
    provider: string;
    providerMessageId: string;
  }): void {
    const key = `${input.workspaceId}\u0000${input.accountRef}\u0000${input.messageId}`;
    this.messageProvenance.set(key, {
      provider: input.provider,
      providerMessageId: input.providerMessageId
    });
  }

  admitExactEvidence(
    input: ManagedCommunicationExactEvidenceAdmissionV1
  ): Promise<ManagedCommunicationExactEvidenceAdmissionOutcomeV1> {
    try {
      const value = validated(input);
      const key = `${value.workspaceId}\u0000${value.accountRef}\u0000${value.messageId}`;
      const provenance = this.messageProvenance.get(key);
      if (!provenance)
        throw new ManagedCommunicationExactEvidenceError(
          'NORMALIZED_MESSAGE_NOT_FOUND',
          'Exact evidence cannot be admitted before its normalized Communication message exists.'
        );
      if (
        provenance.provider !== value.provider ||
        provenance.providerMessageId !== value.providerMessageId
      )
        throw new ManagedCommunicationExactEvidenceError(
          'PROVENANCE_MISMATCH',
          'Exact evidence provider identity does not match the normalized Communication message.'
        );
      const existing = this.rows.get(key);
      if (existing) {
        if (
          existing.evidence.sha256 !== value.sha256 ||
          JSON.stringify(existing.evidence.headers) !== JSON.stringify(value.headers) ||
          JSON.stringify(existing.evidence.metadata) !== JSON.stringify(value.metadata) ||
          existing.evidence.observedAt !== value.observedAt ||
          existing.evidence.mediaType !== value.mediaType
        )
          throw new ManagedCommunicationExactEvidenceError(
            'EXACT_EVIDENCE_CONFLICT',
            'Communication message is already bound to different exact provider evidence.'
          );
        return Promise.resolve(
          Object.freeze({ schemaVersion: 1, disposition: 'REPLAYED', evidence: existing.evidence })
        );
      }
      const evidence = ref(value);
      this.rows.set(key, { evidence, rawPayload: value.rawPayload });
      return Promise.resolve(
        Object.freeze({ schemaVersion: 1, disposition: 'ADMITTED', evidence })
      );
    } catch (error) {
      return Promise.reject(error);
    }
  }

  resolveExactEvidence(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
  }): Promise<ManagedCommunicationExactEvidenceRefV1 | undefined> {
    const row = this.rows.get(
      `${input.workspaceId}\u0000${input.accountRef}\u0000${input.messageId}`
    );
    return Promise.resolve(row?.evidence);
  }
}

type EvidenceRow = {
  evidence_ref: unknown;
  provider: unknown;
  provider_message_id: unknown;
  media_type: unknown;
  payload_sha256: unknown;
  payload_size_bytes: unknown;
  provenance_json: unknown;
  observed_at: unknown;
};

function persistedRef(row: EvidenceRow): ManagedCommunicationExactEvidenceRefV1 {
  const provenance = row.provenance_json as { headers?: unknown; metadata?: unknown } | null;
  if (!provenance || !Array.isArray(provenance.headers))
    throw new ManagedCommunicationExactEvidenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Communication exact evidence provenance is invalid.'
    );
  const metadata = canonicalMetadata(
    provenance.metadata &&
      typeof provenance.metadata === 'object' &&
      !Array.isArray(provenance.metadata)
      ? (provenance.metadata as Record<string, string>)
      : {}
  );
  const sha256 = String(row.payload_sha256);
  if (!SHA256.test(sha256))
    throw new ManagedCommunicationExactEvidenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Communication exact evidence digest is invalid.'
    );
  const sizeBytes = Number(row.payload_size_bytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1)
    throw new ManagedCommunicationExactEvidenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Communication exact evidence size is invalid.'
    );
  return Object.freeze({
    schemaVersion: 1,
    evidenceRef: clean(String(row.evidence_ref), 'persisted evidenceRef', 500),
    sha256,
    mediaType: clean(String(row.media_type), 'persisted mediaType', 200),
    sizeBytes,
    observedAt: new Date(String(row.observed_at)).toISOString(),
    provider: clean(String(row.provider), 'persisted provider', 120),
    providerMessageId: clean(String(row.provider_message_id), 'persisted providerMessageId', 500),
    headers: canonicalHeaders(provenance.headers as ManagedCommunicationEvidenceHeaderV1[]),
    metadata
  });
}

export class PostgresManagedCommunicationExactEvidenceStoreV1 implements ManagedCommunicationExactEvidenceStoreV1 {
  constructor(private readonly query: QueryClient) {}

  async admitExactEvidence(
    input: ManagedCommunicationExactEvidenceAdmissionV1
  ): Promise<ManagedCommunicationExactEvidenceAdmissionOutcomeV1> {
    const value = validated(input);
    try {
      const normalized = await this.query.query(
        `SELECT provider,provider_message_id
           FROM capability_communication_messages
          WHERE workspace_id=$1 AND account_ref=$2 AND message_id=$3`,
        [value.workspaceId, value.accountRef, value.messageId]
      );
      const message = normalized.rows[0] as
        { provider: unknown; provider_message_id: unknown } | undefined;
      if (!message)
        throw new ManagedCommunicationExactEvidenceError(
          'NORMALIZED_MESSAGE_NOT_FOUND',
          'Exact evidence cannot be admitted before its normalized Communication message exists.'
        );
      if (
        String(message.provider) !== value.provider ||
        String(message.provider_message_id) !== value.providerMessageId
      )
        throw new ManagedCommunicationExactEvidenceError(
          'PROVENANCE_MISMATCH',
          'Exact evidence provider identity does not match the normalized Communication message.'
        );

      const existing = await this.resolveExactEvidence(value);
      if (existing) {
        if (
          existing.sha256 !== value.sha256 ||
          existing.mediaType !== value.mediaType ||
          existing.observedAt !== value.observedAt ||
          JSON.stringify(existing.headers) !== JSON.stringify(value.headers) ||
          JSON.stringify(existing.metadata) !== JSON.stringify(value.metadata)
        )
          throw new ManagedCommunicationExactEvidenceError(
            'EXACT_EVIDENCE_CONFLICT',
            'Communication message is already bound to different exact provider evidence.'
          );
        return Object.freeze({ schemaVersion: 1, disposition: 'REPLAYED', evidence: existing });
      }

      await this.query.query(
        `INSERT INTO capability_communication_exact_evidence (
           workspace_id,account_ref,message_id,evidence_ref,provider,provider_message_id,
           media_type,payload_sha256,payload_size_bytes,raw_payload,provenance_json,
           observed_at,created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
        [
          value.workspaceId,
          value.accountRef,
          value.messageId,
          value.evidenceRef,
          value.provider,
          value.providerMessageId,
          value.mediaType,
          value.sha256,
          value.rawPayload.byteLength,
          Buffer.from(value.rawPayload),
          JSON.stringify({ headers: value.headers, metadata: value.metadata }),
          value.observedAt,
          value.now
        ]
      );
      return Object.freeze({ schemaVersion: 1, disposition: 'ADMITTED', evidence: ref(value) });
    } catch (error) {
      if (error instanceof ManagedCommunicationExactEvidenceError) throw error;
      throw new ManagedCommunicationExactEvidenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication exact evidence persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async resolveExactEvidence(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
  }): Promise<ManagedCommunicationExactEvidenceRefV1 | undefined> {
    try {
      const result = await this.query.query(
        `SELECT evidence_ref,provider,provider_message_id,media_type,payload_sha256,
                payload_size_bytes,provenance_json,observed_at
           FROM capability_communication_exact_evidence
          WHERE workspace_id=$1 AND account_ref=$2 AND message_id=$3`,
        [clean(input.workspaceId, 'workspaceId', 500), clean(input.accountRef, 'accountRef', 500), clean(input.messageId, 'messageId', 500)]
      );
      const row = result.rows[0] as EvidenceRow | undefined;
      return row ? persistedRef(row) : undefined;
    } catch (error) {
      if (error instanceof ManagedCommunicationExactEvidenceError) throw error;
      throw new ManagedCommunicationExactEvidenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed Communication exact evidence persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
