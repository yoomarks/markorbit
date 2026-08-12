import { createHash, randomUUID } from 'node:crypto';
import {
  capabilityLearningNoAuthorityConsequences,
  type CapabilityLedgerEntry,
  type ReflectionCandidate,
  type ReflectionCandidateId
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  RuntimeCapabilityRegistryError,
  type PostgresRuntimeCapabilityRegistry
} from './runtime-capability-registry.js';

export const privateReflectionGenerationPolicyVersion =
  'm6-private-reflection-deterministic-v1' as const;

const LEDGER_ID = /^capability-ledger_[0-9a-f]{32}$/;

type Row = Record<string, unknown>;

export type PrivateReflectionCandidateErrorCode =
  | 'INVALID_INPUT'
  | 'LEDGER_ENTRY_NOT_FOUND'
  | 'LEDGER_LINEAGE_MISMATCH'
  | 'RUNTIME_CAPABILITY_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class PrivateReflectionCandidateError extends Error {
  constructor(
    readonly code: PrivateReflectionCandidateErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PrivateReflectionCandidateError';
  }
}

export interface GeneratePrivateReflectionCandidateCommand {
  ledgerEntryId: string;
  idempotencyKey: string;
}

export interface PrivateReflectionCandidateGenerationResult {
  candidate: Readonly<ReflectionCandidate>;
  candidateFingerprintSha256: string;
  replayed: boolean;
}

export interface PrivateReflectionTransactionHost {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

type NormalizedCommand = Readonly<GeneratePrivateReflectionCandidateCommand>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (record(value))
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function requiredText(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new PrivateReflectionCandidateError('INVALID_INPUT', `${field} must be a string.`, 422);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new PrivateReflectionCandidateError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allowedSet = new Set(allowed);
  const extras = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (extras.length)
    throw new PrivateReflectionCandidateError(
      'INVALID_INPUT',
      `${field} contains unsupported fields. Workspace, subject identity and authority cannot be supplied by callers.`,
      422,
      false,
      { fields: extras }
    );
}

export function normalizePrivateReflectionGenerationCommand(
  value: unknown,
  idempotencyKeyValue: unknown
): NormalizedCommand {
  if (!record(value))
    throw new PrivateReflectionCandidateError(
      'INVALID_INPUT',
      'Request body must be an object.',
      422
    );
  exactKeys(value, ['ledgerEntryId'], 'request');
  const ledgerEntryId = requiredText(value.ledgerEntryId, 'ledgerEntryId', 100);
  if (!LEDGER_ID.test(ledgerEntryId))
    throw new PrivateReflectionCandidateError(
      'INVALID_INPUT',
      'ledgerEntryId must be an exact Capability Ledger entry identity.',
      422
    );
  return {
    ledgerEntryId,
    idempotencyKey: requiredText(idempotencyKeyValue, 'Idempotency-Key', 300)
  };
}

function ledgerFromRow(row: Row | undefined): CapabilityLedgerEntry | undefined {
  if (!row) return undefined;
  const document = row.document_json;
  if (!record(document))
    throw new PrivateReflectionCandidateError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Capability Ledger Entry is invalid.',
      503,
      true
    );
  return clone(document as unknown as CapabilityLedgerEntry);
}

function candidateFromRow(row: Row | undefined): ReflectionCandidate | undefined {
  if (!row) return undefined;
  const document = row.document_json;
  if (!record(document))
    throw new PrivateReflectionCandidateError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Reflection Candidate is invalid.',
      503,
      true
    );
  return clone(document as unknown as ReflectionCandidate);
}

function replayFromRow(row: Row): PrivateReflectionCandidateGenerationResult {
  const value = row.result_json;
  if (
    !record(value) ||
    !record(value.candidate) ||
    typeof value.candidateFingerprintSha256 !== 'string'
  )
    throw new PrivateReflectionCandidateError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Reflection Candidate generation replay is invalid.',
      503,
      true
    );
  return {
    candidate: clone(value.candidate as unknown as ReflectionCandidate),
    candidateFingerprintSha256: value.candidateFingerprintSha256,
    replayed: true
  };
}

function candidateId(): ReflectionCandidateId {
  return `reflection-candidate_${randomUUID().replaceAll('-', '')}`;
}

function latestRecordedAt(entries: readonly CapabilityLedgerEntry[]): string {
  return entries.reduce(
    (latest, entry) => (entry.recordedAt > latest ? entry.recordedAt : latest),
    entries[0]!.recordedAt
  );
}

function reflectionNarrative(title: string, entries: readonly CapabilityLedgerEntry[]) {
  const count = entries.length;
  const latest = latestRecordedAt(entries);
  const noun = count === 1 ? 'entry' : 'entries';
  return {
    explanation: `Generated from ${count} private governed Capability Ledger ${noun} linked to “${title}”. This candidate is a private reflection draft only; it does not verify Capability, publish a profile, change permissions, or create canonical truth.`,
    proposedPrivateReflection: `My private Capability Ledger contains ${count} governed work outcome${count === 1 ? '' : 's'} linked to ${title}, with the latest evidence recorded at ${latest}. This reflection is private and does not represent verification, certification, or canonical truth.`
  };
}

export class PostgresPrivateReflectionCandidateService {
  constructor(
    private readonly database: PrivateReflectionTransactionHost,
    private readonly query: QueryClient,
    private readonly runtimeCapabilities: PostgresRuntimeCapabilityRegistry,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly idFactory: () => ReflectionCandidateId = candidateId
  ) {}

  async generate(
    body: unknown,
    idempotencyKeyValue: unknown
  ): Promise<PrivateReflectionCandidateGenerationResult> {
    const command = normalizePrivateReflectionGenerationCommand(body, idempotencyKeyValue);
    const requestFingerprintSha256 = fingerprint({ ledgerEntryId: command.ledgerEntryId });
    const earlyReplay = await this.findReplay(command.idempotencyKey, requestFingerprintSha256);
    if (earlyReplay) return earlyReplay;

    try {
      const anchorResult = await this.query.query(
        'SELECT document_json FROM capability_ledger_entries WHERE capability_ledger_entry_id=$1',
        [command.ledgerEntryId]
      );
      const anchor = ledgerFromRow(anchorResult.rows[0] as Row | undefined);
      if (!anchor)
        throw new PrivateReflectionCandidateError(
          'LEDGER_ENTRY_NOT_FOUND',
          'Capability Ledger Entry was not found.',
          404
        );
      const runtimeCapability = await this.runtimeCapabilities.findVersion(
        anchor.runtimeCapability.id,
        anchor.runtimeCapability.version
      );
      if (!runtimeCapability)
        throw new PrivateReflectionCandidateError(
          'RUNTIME_CAPABILITY_NOT_FOUND',
          'Exact Runtime Capability definition/version was not found.',
          404
        );

      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `private-reflection:${anchor.workspaceId}:${anchor.subjectUserId}:${anchor.runtimeCapability.id}:${anchor.runtimeCapability.version}`
        ]);
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_json FROM capability_reflection_generation_commands WHERE idempotency_key=$1',
          [command.idempotencyKey]
        );
        if (replay.rowCount) {
          const row = replay.rows[0] as Row;
          if (row.request_fingerprint_sha256 !== requestFingerprintSha256)
            throw new PrivateReflectionCandidateError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Reflection Candidate generation request.'
            );
          return replayFromRow(row);
        }

        const currentAnchorResult = await client.query(
          'SELECT document_json FROM capability_ledger_entries WHERE capability_ledger_entry_id=$1',
          [command.ledgerEntryId]
        );
        const currentAnchor = ledgerFromRow(currentAnchorResult.rows[0] as Row | undefined);
        if (!currentAnchor)
          throw new PrivateReflectionCandidateError(
            'LEDGER_ENTRY_NOT_FOUND',
            'Capability Ledger Entry was not found.',
            404
          );
        if (
          currentAnchor.workspaceId !== anchor.workspaceId ||
          currentAnchor.subjectUserId !== anchor.subjectUserId ||
          currentAnchor.runtimeCapability.id !== anchor.runtimeCapability.id ||
          currentAnchor.runtimeCapability.version !== anchor.runtimeCapability.version
        )
          throw new PrivateReflectionCandidateError(
            'LEDGER_LINEAGE_MISMATCH',
            'Capability Ledger anchor lineage changed unexpectedly.'
          );

        const ledgerResult = await client.query(
          `SELECT document_json FROM capability_ledger_entries
           WHERE workspace_id=$1 AND subject_user_id=$2
             AND runtime_capability_definition_id=$3 AND runtime_capability_version=$4
           ORDER BY recorded_at, capability_ledger_entry_id`,
          [
            anchor.workspaceId,
            anchor.subjectUserId,
            anchor.runtimeCapability.id,
            anchor.runtimeCapability.version
          ]
        );
        const entries = ledgerResult.rows.map((row) => {
          const entry = ledgerFromRow(row as Row);
          if (!entry)
            throw new PrivateReflectionCandidateError(
              'PERSISTENCE_UNAVAILABLE',
              'Capability Ledger Entry disappeared during Reflection generation.',
              503,
              true
            );
          if (
            entry.workspaceId !== anchor.workspaceId ||
            entry.subjectUserId !== anchor.subjectUserId ||
            entry.runtimeCapability.id !== anchor.runtimeCapability.id ||
            entry.runtimeCapability.version !== anchor.runtimeCapability.version
          )
            throw new PrivateReflectionCandidateError(
              'LEDGER_LINEAGE_MISMATCH',
              'Capability Ledger contains inconsistent subject or runtime Capability lineage.'
            );
          return entry;
        });
        if (!entries.length)
          throw new PrivateReflectionCandidateError(
            'LEDGER_ENTRY_NOT_FOUND',
            'No current Capability Ledger evidence exists for this private reflection.',
            404
          );

        const ledgerEntries = entries.map((entry) => ({
          id: entry.capabilityLedgerEntryId,
          sourceFingerprintSha256: entry.observation.sourceFingerprintSha256
        }));
        const ledgerSnapshotFingerprintSha256 = fingerprint(ledgerEntries);
        const inputFingerprintSha256 = fingerprint({
          generationPolicyVersion: privateReflectionGenerationPolicyVersion,
          runtimeCapability: anchor.runtimeCapability,
          ledgerEntries
        });
        const latestResult = await client.query(
          `SELECT version,input_fingerprint_sha256,candidate_fingerprint_sha256,document_json
           FROM capability_reflection_candidates
           WHERE workspace_id=$1 AND subject_user_id=$2
             AND runtime_capability_definition_id=$3 AND runtime_capability_version=$4
           ORDER BY version DESC LIMIT 1`,
          [
            anchor.workspaceId,
            anchor.subjectUserId,
            anchor.runtimeCapability.id,
            anchor.runtimeCapability.version
          ]
        );
        const latestRow = latestResult.rows[0] as Row | undefined;
        if (latestRow?.input_fingerprint_sha256 === inputFingerprintSha256) {
          const candidate = candidateFromRow(latestRow);
          if (!candidate || typeof latestRow.candidate_fingerprint_sha256 !== 'string')
            throw new PrivateReflectionCandidateError(
              'PERSISTENCE_UNAVAILABLE',
              'Current Reflection Candidate persistence is invalid.',
              503,
              true
            );
          const result = {
            candidate,
            candidateFingerprintSha256: latestRow.candidate_fingerprint_sha256,
            replayed: true
          } satisfies PrivateReflectionCandidateGenerationResult;
          await this.recordCommand(
            client,
            command,
            requestFingerprintSha256,
            result,
            new Date(this.now()).toISOString()
          );
          return clone(result);
        }

        const version = Number(latestRow?.version ?? 0) + 1;
        const createdAt = new Date(this.now()).toISOString();
        const narrative = reflectionNarrative(runtimeCapability.title, entries);
        const candidate: ReflectionCandidate = {
          schemaVersion: 1,
          reflectionCandidateId: this.idFactory(),
          workspaceId: anchor.workspaceId,
          subjectUserId: anchor.subjectUserId,
          version,
          runtimeCapability: clone(anchor.runtimeCapability),
          ledgerEntries: clone(ledgerEntries),
          explanation: narrative.explanation,
          proposedPrivateReflection: narrative.proposedPrivateReflection,
          generation: { policyVersion: privateReflectionGenerationPolicyVersion },
          status: 'PENDING',
          private: true,
          createdAt,
          authority: capabilityLearningNoAuthorityConsequences
        };
        const candidateFingerprintSha256 = fingerprint(candidate);
        await client.query(
          `INSERT INTO capability_reflection_candidates (
             reflection_candidate_id,workspace_id,subject_user_id,version,
             runtime_capability_definition_id,runtime_capability_version,generation_policy_version,
             input_fingerprint_sha256,ledger_snapshot_fingerprint_sha256,candidate_fingerprint_sha256,
             document_json,created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
          [
            candidate.reflectionCandidateId,
            candidate.workspaceId,
            candidate.subjectUserId,
            candidate.version,
            candidate.runtimeCapability.id,
            candidate.runtimeCapability.version,
            privateReflectionGenerationPolicyVersion,
            inputFingerprintSha256,
            ledgerSnapshotFingerprintSha256,
            candidateFingerprintSha256,
            JSON.stringify(candidate),
            createdAt
          ]
        );
        for (const [position, entry] of ledgerEntries.entries())
          await client.query(
            `INSERT INTO capability_reflection_candidate_ledger_entries (
               reflection_candidate_id,ledger_entry_id,position,source_fingerprint_sha256
             ) VALUES ($1,$2,$3,$4)`,
            [candidate.reflectionCandidateId, entry.id, position, entry.sourceFingerprintSha256]
          );
        const result = {
          candidate,
          candidateFingerprintSha256,
          replayed: false
        } satisfies PrivateReflectionCandidateGenerationResult;
        await this.recordCommand(client, command, requestFingerprintSha256, result, createdAt);
        return clone(result);
      });
    } catch (error) {
      if (error instanceof PrivateReflectionCandidateError) throw error;
      if (error instanceof RuntimeCapabilityRegistryError) {
        if (error.code === 'NOT_FOUND')
          throw new PrivateReflectionCandidateError(
            'RUNTIME_CAPABILITY_NOT_FOUND',
            error.message,
            404
          );
        throw new PrivateReflectionCandidateError(
          'PERSISTENCE_UNAVAILABLE',
          'Runtime Capability Registry is unavailable during Reflection Candidate generation.',
          503,
          true,
          undefined,
          { cause: error }
        );
      }
      throw this.persistenceError(error);
    }
  }

  async findVersion(
    reflectionCandidateId: ReflectionCandidateId,
    version: number
  ): Promise<PrivateReflectionCandidateGenerationResult | undefined> {
    if (!Number.isInteger(version) || version < 1)
      throw new PrivateReflectionCandidateError(
        'INVALID_INPUT',
        'Reflection Candidate version must be a positive integer.',
        422
      );
    try {
      const result = await this.query.query(
        `SELECT candidate_fingerprint_sha256,document_json
         FROM capability_reflection_candidates
         WHERE reflection_candidate_id=$1 AND version=$2`,
        [reflectionCandidateId, version]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row) return undefined;
      const candidate = candidateFromRow(row);
      if (!candidate || typeof row.candidate_fingerprint_sha256 !== 'string')
        throw new PrivateReflectionCandidateError(
          'PERSISTENCE_UNAVAILABLE',
          'Persisted Reflection Candidate is invalid.',
          503,
          true
        );
      return {
        candidate,
        candidateFingerprintSha256: row.candidate_fingerprint_sha256,
        replayed: true
      };
    } catch (error) {
      if (error instanceof PrivateReflectionCandidateError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async findReplay(
    idempotencyKey: string,
    requestFingerprintSha256: string
  ): Promise<PrivateReflectionCandidateGenerationResult | undefined> {
    try {
      const replay = await this.query.query(
        'SELECT request_fingerprint_sha256,result_json FROM capability_reflection_generation_commands WHERE idempotency_key=$1',
        [idempotencyKey]
      );
      if (!replay.rowCount) return undefined;
      const row = replay.rows[0] as Row;
      if (row.request_fingerprint_sha256 !== requestFingerprintSha256)
        throw new PrivateReflectionCandidateError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used for a different Reflection Candidate generation request.'
        );
      return replayFromRow(row);
    } catch (error) {
      if (error instanceof PrivateReflectionCandidateError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async recordCommand(
    client: QueryClient,
    command: NormalizedCommand,
    requestFingerprintSha256: string,
    result: PrivateReflectionCandidateGenerationResult,
    createdAt: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO capability_reflection_generation_commands (
         idempotency_key,request_fingerprint_sha256,reflection_candidate_id,
         candidate_version,candidate_fingerprint_sha256,result_json,created_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [
        command.idempotencyKey,
        requestFingerprintSha256,
        result.candidate.reflectionCandidateId,
        result.candidate.version,
        result.candidateFingerprintSha256,
        JSON.stringify({
          candidate: result.candidate,
          candidateFingerprintSha256: result.candidateFingerprintSha256
        }),
        createdAt
      ]
    );
    await client.query(
      `INSERT INTO capability_reflection_generation_audit (
         idempotency_key,request_fingerprint_sha256,reflection_candidate_id,candidate_version,
         candidate_fingerprint_sha256,workspace_id,subject_user_id,
         runtime_capability_definition_id,runtime_capability_version,generation_policy_version,
         decision,created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'GENERATED_OR_REUSED',$11)`,
      [
        command.idempotencyKey,
        requestFingerprintSha256,
        result.candidate.reflectionCandidateId,
        result.candidate.version,
        result.candidateFingerprintSha256,
        result.candidate.workspaceId,
        result.candidate.subjectUserId,
        result.candidate.runtimeCapability.id,
        result.candidate.runtimeCapability.version,
        privateReflectionGenerationPolicyVersion,
        createdAt
      ]
    );
  }

  private persistenceError(error: unknown): PrivateReflectionCandidateError {
    return new PrivateReflectionCandidateError(
      'PERSISTENCE_UNAVAILABLE',
      'Private Reflection Candidate persistence is unavailable.',
      503,
      true,
      undefined,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
