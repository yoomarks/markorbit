import { createHash } from 'node:crypto';
import type {
  ManagedAiExactOutputInlineV1,
  ManagedAiExactOutputReferenceV1
} from '@markorbit/contracts/managed-ai-execution';
import type { QueryClient } from '@markorbit/persistence';

export type ManagedAiExactOutputStoreErrorCode =
  | 'PERSISTENCE_UNAVAILABLE'
  | 'CONTENT_MISMATCH'
  | 'REFERENCE_CONFLICT'
  | 'REFERENCE_NOT_FOUND'
  | 'INVALID_PERSISTED_OUTPUT';

export class ManagedAiExactOutputStoreError extends Error {
  constructor(
    readonly code: ManagedAiExactOutputStoreErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ManagedAiExactOutputStoreError';
  }
}

export interface ManagedAiExactOutputPersistCommandV1 {
  executionId: string;
  output: Readonly<ManagedAiExactOutputInlineV1>;
  now: string;
}

export interface ManagedAiExactOutputStoreV1 {
  persist(
    command: Readonly<ManagedAiExactOutputPersistCommandV1>
  ): Promise<Readonly<ManagedAiExactOutputReferenceV1>>;
  resolve(ref: string): Promise<Readonly<ManagedAiExactOutputInlineV1>>;
}

interface ExactOutputRecord {
  ref: string;
  executionId: string;
  mediaType: string;
  sha256: string;
  sizeBytes: number;
  data: Buffer;
}

function outputRef(executionId: string): string {
  if (!/^maiexec_[a-f0-9]{32}$/u.test(executionId))
    throw new ManagedAiExactOutputStoreError(
      'CONTENT_MISMATCH',
      'Managed AI execution id is invalid for exact-output persistence.'
    );
  return `managed-ai-output:v1:${executionId}`;
}

function exactBytes(output: Readonly<ManagedAiExactOutputInlineV1>): Buffer {
  let data: Buffer;
  try {
    data = Buffer.from(output.dataBase64, 'base64');
  } catch (error) {
    throw new ManagedAiExactOutputStoreError(
      'CONTENT_MISMATCH',
      'Managed AI exact output is not valid base64 data.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
  const actualSha256 = createHash('sha256').update(data).digest('hex');
  if (actualSha256 !== output.sha256 || data.byteLength !== output.sizeBytes)
    throw new ManagedAiExactOutputStoreError(
      'CONTENT_MISMATCH',
      'Managed AI exact output bytes do not match governed hash and size metadata.'
    );
  return data;
}

function reference(record: ExactOutputRecord): Readonly<ManagedAiExactOutputReferenceV1> {
  return Object.freeze({
    kind: 'DURABLE_REF' as const,
    mediaType: record.mediaType,
    sha256: record.sha256,
    sizeBytes: record.sizeBytes,
    ref: record.ref
  });
}

function inline(record: ExactOutputRecord): Readonly<ManagedAiExactOutputInlineV1> {
  const data = Buffer.from(record.data);
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (sha256 !== record.sha256 || data.byteLength !== record.sizeBytes)
    throw new ManagedAiExactOutputStoreError(
      'INVALID_PERSISTED_OUTPUT',
      'Persisted Managed AI exact output bytes fail integrity verification.'
    );
  return Object.freeze({
    kind: 'INLINE_BASE64' as const,
    mediaType: record.mediaType,
    sha256: record.sha256,
    sizeBytes: record.sizeBytes,
    dataBase64: data.toString('base64')
  });
}

function asError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('Managed AI exact-output in-memory operation failed.', { cause: error });
}

export class InMemoryManagedAiExactOutputStoreV1 implements ManagedAiExactOutputStoreV1 {
  private readonly rows = new Map<string, ExactOutputRecord>();

  persist(
    command: Readonly<ManagedAiExactOutputPersistCommandV1>
  ): Promise<Readonly<ManagedAiExactOutputReferenceV1>> {
    try {
      const ref = outputRef(command.executionId);
      const data = exactBytes(command.output);
      const existing = this.rows.get(ref);
      if (existing) {
        if (
          existing.executionId !== command.executionId ||
          existing.mediaType !== command.output.mediaType ||
          existing.sha256 !== command.output.sha256 ||
          existing.sizeBytes !== command.output.sizeBytes ||
          !existing.data.equals(data)
        )
          throw new ManagedAiExactOutputStoreError(
            'REFERENCE_CONFLICT',
            'Managed AI exact-output reference is already bound to different bytes.'
          );
        return Promise.resolve(reference(existing));
      }
      const row: ExactOutputRecord = {
        ref,
        executionId: command.executionId,
        mediaType: command.output.mediaType,
        sha256: command.output.sha256,
        sizeBytes: command.output.sizeBytes,
        data: Buffer.from(data)
      };
      this.rows.set(ref, row);
      return Promise.resolve(reference(row));
    } catch (error) {
      return Promise.reject(asError(error));
    }
  }

  resolve(ref: string): Promise<Readonly<ManagedAiExactOutputInlineV1>> {
    try {
      const row = this.rows.get(ref);
      if (!row)
        throw new ManagedAiExactOutputStoreError(
          'REFERENCE_NOT_FOUND',
          'Managed AI exact-output reference was not found.'
        );
      return Promise.resolve(inline(row));
    } catch (error) {
      return Promise.reject(asError(error));
    }
  }
}

type ExactOutputRow = {
  output_ref: unknown;
  execution_id: unknown;
  media_type: unknown;
  sha256: unknown;
  size_bytes: unknown;
  exact_bytes: unknown;
};

function persistedRecord(row: ExactOutputRow): ExactOutputRecord {
  const sizeBytes = Number(row.size_bytes);
  if (
    typeof row.output_ref !== 'string' ||
    typeof row.execution_id !== 'string' ||
    typeof row.media_type !== 'string' ||
    typeof row.sha256 !== 'string' ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 0 ||
    !Buffer.isBuffer(row.exact_bytes)
  )
    throw new ManagedAiExactOutputStoreError(
      'INVALID_PERSISTED_OUTPUT',
      'Persisted Managed AI exact-output record is invalid.'
    );
  return {
    ref: row.output_ref,
    executionId: row.execution_id,
    mediaType: row.media_type,
    sha256: row.sha256,
    sizeBytes,
    data: Buffer.from(row.exact_bytes)
  };
}

export class PostgresManagedAiExactOutputStoreV1 implements ManagedAiExactOutputStoreV1 {
  constructor(private readonly query: QueryClient) {}

  async persist(
    command: Readonly<ManagedAiExactOutputPersistCommandV1>
  ): Promise<Readonly<ManagedAiExactOutputReferenceV1>> {
    const ref = outputRef(command.executionId);
    const data = exactBytes(command.output);
    try {
      await this.query.query(
        `INSERT INTO capability_managed_ai_exact_outputs (
           output_ref,execution_id,media_type,sha256,size_bytes,exact_bytes,created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (output_ref) DO NOTHING`,
        [
          ref,
          command.executionId,
          command.output.mediaType,
          command.output.sha256,
          command.output.sizeBytes,
          data,
          command.now
        ]
      );
      const found = await this.query.query(
        `SELECT output_ref,execution_id,media_type,sha256,size_bytes,exact_bytes
           FROM capability_managed_ai_exact_outputs
          WHERE output_ref=$1`,
        [ref]
      );
      const row = found.rows[0] as ExactOutputRow | undefined;
      if (!row)
        throw new ManagedAiExactOutputStoreError(
          'PERSISTENCE_UNAVAILABLE',
          'Managed AI exact output was not readable after persistence.'
        );
      const record = persistedRecord(row);
      const persisted = inline(record);
      if (
        record.executionId !== command.executionId ||
        persisted.mediaType !== command.output.mediaType ||
        persisted.sha256 !== command.output.sha256 ||
        persisted.sizeBytes !== command.output.sizeBytes ||
        persisted.dataBase64 !== data.toString('base64')
      )
        throw new ManagedAiExactOutputStoreError(
          'REFERENCE_CONFLICT',
          'Managed AI exact-output reference is already bound to different bytes.'
        );
      return reference(record);
    } catch (error) {
      if (error instanceof ManagedAiExactOutputStoreError) throw error;
      throw new ManagedAiExactOutputStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed AI exact-output persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async resolve(ref: string): Promise<Readonly<ManagedAiExactOutputInlineV1>> {
    try {
      const found = await this.query.query(
        `SELECT output_ref,execution_id,media_type,sha256,size_bytes,exact_bytes
           FROM capability_managed_ai_exact_outputs
          WHERE output_ref=$1`,
        [ref]
      );
      const row = found.rows[0] as ExactOutputRow | undefined;
      if (!row)
        throw new ManagedAiExactOutputStoreError(
          'REFERENCE_NOT_FOUND',
          'Managed AI exact-output reference was not found.'
        );
      return inline(persistedRecord(row));
    } catch (error) {
      if (error instanceof ManagedAiExactOutputStoreError) throw error;
      throw new ManagedAiExactOutputStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Managed AI exact-output resolution is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
