import { createHash, randomUUID } from 'node:crypto';
import {
  capabilityLearningNoAuthorityConsequences,
  type CapabilityLedgerEntry,
  type CapabilityLedgerEntryId,
  type CapabilityObservation,
  type CapabilityObservationId,
  type RuntimeCapabilityDefinitionId
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  CapabilityObservationSourceError,
  type CapabilityObservationSourceAuthority,
  type CapabilityObservationSourceLocator
} from './capability-observation-source.js';
import {
  RuntimeCapabilityRegistryError,
  type PostgresRuntimeCapabilityRegistry
} from './runtime-capability-registry.js';

const SHA256 = /^[0-9a-f]{64}$/;
const RUNTIME_ID = /^runtime-capability_[0-9a-f]{32}$/;

export type CapabilityObservationLedgerErrorCode =
  | 'INVALID_INPUT'
  | 'SOURCE_NOT_ALLOWED'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_VERSION_MISMATCH'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'RUNTIME_CAPABILITY_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'PERSISTENCE_UNAVAILABLE';

export class CapabilityObservationLedgerError extends Error {
  constructor(
    readonly code: CapabilityObservationLedgerErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CapabilityObservationLedgerError';
  }
}

export interface AdmitCapabilityObservationCommand {
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
  }>;
  source: Readonly<CapabilityObservationSourceLocator>;
  idempotencyKey: string;
}

export interface CapabilityObservationAdmissionResult {
  observation: Readonly<CapabilityObservation>;
  ledgerEntry: Readonly<CapabilityLedgerEntry>;
  replayed: boolean;
}

export interface CapabilityObservationTransactionHost {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

type Row = Record<string, unknown>;

type NormalizedCommand = Readonly<{
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
  }>;
  source: Readonly<CapabilityObservationSourceLocator>;
  idempotencyKey: string;
}>;

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

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allowedSet = new Set(allowed);
  const extras = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (extras.length)
    throw new CapabilityObservationLedgerError(
      'INVALID_INPUT',
      `${field} contains unsupported fields. Identity and authority cannot be supplied by callers.`,
      422,
      false,
      { fields: extras }
    );
}

function requiredText(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new CapabilityObservationLedgerError('INVALID_INPUT', `${field} must be a string.`, 422);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new CapabilityObservationLedgerError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function exactFingerprint(value: unknown, field: string): string {
  const cleaned = requiredText(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned))
    throw new CapabilityObservationLedgerError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

export function normalizeCapabilityObservationAdmissionCommand(
  value: unknown,
  idempotencyKeyValue: unknown
): NormalizedCommand {
  if (!record(value))
    throw new CapabilityObservationLedgerError(
      'INVALID_INPUT',
      'Request body must be an object.',
      422
    );
  exactKeys(value, ['runtimeCapability', 'source'], 'request');
  if (!record(value.runtimeCapability))
    throw new CapabilityObservationLedgerError(
      'INVALID_INPUT',
      'runtimeCapability must be an object.',
      422
    );
  exactKeys(value.runtimeCapability, ['id', 'version'], 'runtimeCapability');
  const runtimeCapabilityId = requiredText(value.runtimeCapability.id, 'runtimeCapability.id', 100);
  if (!RUNTIME_ID.test(runtimeCapabilityId))
    throw new CapabilityObservationLedgerError(
      'INVALID_INPUT',
      'runtimeCapability.id must be an exact Runtime Capability identity.',
      422
    );
  const runtimeVersion = value.runtimeCapability.version;
  if (!Number.isInteger(runtimeVersion) || Number(runtimeVersion) < 1)
    throw new CapabilityObservationLedgerError(
      'INVALID_INPUT',
      'runtimeCapability.version must be a positive integer.',
      422
    );
  if (!record(value.source))
    throw new CapabilityObservationLedgerError('INVALID_INPUT', 'source must be an object.', 422);
  exactKeys(
    value.source,
    ['owner', 'kind', 'sourceId', 'sourceVersion', 'sourceFingerprintSha256'],
    'source'
  );
  if (
    value.source.owner !== 'EXECUTION' ||
    value.source.kind !== 'EXECUTION_EVIDENCE_REVIEW_DECISION'
  )
    throw new CapabilityObservationLedgerError(
      'SOURCE_NOT_ALLOWED',
      'M6-WP-03 admits only reviewed Execution Evidence Review Decisions. Raw Provider Return, Provider Supply Capability, payment, invoice and unreviewed task evidence are not admissible.',
      422
    );
  const sourceVersion = value.source.sourceVersion;
  if (!Number.isInteger(sourceVersion) || Number(sourceVersion) < 1)
    throw new CapabilityObservationLedgerError(
      'INVALID_INPUT',
      'source.sourceVersion must be a positive integer for Execution Evidence Review Decisions.',
      422
    );
  const idempotencyKey = requiredText(idempotencyKeyValue, 'Idempotency-Key', 300);
  return {
    runtimeCapability: {
      id: runtimeCapabilityId as RuntimeCapabilityDefinitionId,
      version: Number(runtimeVersion)
    },
    source: {
      owner: 'EXECUTION',
      kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
      sourceId: requiredText(value.source.sourceId, 'source.sourceId', 500),
      sourceVersion: Number(sourceVersion),
      sourceFingerprintSha256: exactFingerprint(
        value.source.sourceFingerprintSha256,
        'source.sourceFingerprintSha256'
      )
    },
    idempotencyKey
  };
}

function observationId(): CapabilityObservationId {
  return `capability-observation_${randomUUID().replaceAll('-', '')}`;
}

function ledgerEntryId(): CapabilityLedgerEntryId {
  return `capability-ledger_${randomUUID().replaceAll('-', '')}`;
}

function persistedDocument<T>(row: Row | undefined, field: string): T | undefined {
  if (!row) return undefined;
  const value = row.document_json;
  if (!record(value))
    throw new CapabilityObservationLedgerError(
      'PERSISTENCE_UNAVAILABLE',
      `Persisted ${field} document is invalid.`,
      503,
      true
    );
  return clone(value as T);
}

function replayResult(row: Row): CapabilityObservationAdmissionResult {
  const value = row.result_json;
  if (!record(value) || !record(value.observation) || !record(value.ledgerEntry))
    throw new CapabilityObservationLedgerError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Observation admission replay is invalid.',
      503,
      true
    );
  return {
    observation: clone(value.observation as unknown as CapabilityObservation),
    ledgerEntry: clone(value.ledgerEntry as unknown as CapabilityLedgerEntry),
    replayed: true
  };
}

function mapSourceError(error: CapabilityObservationSourceError): CapabilityObservationLedgerError {
  return new CapabilityObservationLedgerError(
    error.code,
    error.message,
    error.status,
    error.retryable,
    undefined,
    { cause: error }
  );
}

export class PostgresCapabilityObservationLedger {
  constructor(
    private readonly database: CapabilityObservationTransactionHost,
    private readonly query: QueryClient,
    private readonly runtimeCapabilities: PostgresRuntimeCapabilityRegistry,
    private readonly sourceAuthority: CapabilityObservationSourceAuthority,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly observationIdFactory: () => CapabilityObservationId = observationId,
    private readonly ledgerEntryIdFactory: () => CapabilityLedgerEntryId = ledgerEntryId
  ) {}

  async admit(
    body: unknown,
    idempotencyKeyValue: unknown
  ): Promise<CapabilityObservationAdmissionResult> {
    const command = normalizeCapabilityObservationAdmissionCommand(body, idempotencyKeyValue);
    const requestFingerprintSha256 = fingerprint({
      runtimeCapability: command.runtimeCapability,
      source: command.source
    });
    const earlyReplay = await this.findReplay(command.idempotencyKey, requestFingerprintSha256);
    if (earlyReplay) return earlyReplay;

    try {
      const runtimeCapability = await this.runtimeCapabilities.findVersion(
        command.runtimeCapability.id,
        command.runtimeCapability.version
      );
      if (!runtimeCapability)
        throw new CapabilityObservationLedgerError(
          'RUNTIME_CAPABILITY_NOT_FOUND',
          'Exact Runtime Capability definition/version was not found.',
          404
        );
      let assertion;
      try {
        assertion = await this.sourceAuthority.verify(command.source);
      } catch (error) {
        if (error instanceof CapabilityObservationSourceError) throw mapSourceError(error);
        throw error;
      }
      const source = assertion.source;
      if (
        source.owner !== command.source.owner ||
        source.kind !== command.source.kind ||
        source.sourceId !== command.source.sourceId ||
        String(source.sourceVersion) !== String(command.source.sourceVersion)
      )
        throw new CapabilityObservationLedgerError(
          'SOURCE_VERSION_MISMATCH',
          'Governed owner source identity/version changed during admission.',
          409
        );
      if (source.sourceFingerprintSha256 !== command.source.sourceFingerprintSha256)
        throw new CapabilityObservationLedgerError(
          'SOURCE_FINGERPRINT_MISMATCH',
          'Governed owner source fingerprint changed during admission.',
          409
        );

      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `capability-observation-command:${command.idempotencyKey}`
        ]);
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_json FROM capability_observation_admission_commands WHERE idempotency_key=$1',
          [command.idempotencyKey]
        );
        if (replay.rowCount) {
          const row = replay.rows[0] as Row;
          if (String(row.request_fingerprint_sha256) !== requestFingerprintSha256)
            throw new CapabilityObservationLedgerError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Capability Observation admission.'
            );
          return replayResult(row);
        }

        const businessLock = [
          command.runtimeCapability.id,
          command.runtimeCapability.version,
          command.source.owner,
          command.source.kind,
          command.source.sourceId,
          command.source.sourceVersion,
          command.source.sourceFingerprintSha256
        ].join(':');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `capability-observation-source:${businessLock}`
        ]);

        const existing = await client.query(
          `SELECT document_json FROM capability_observations
           WHERE runtime_capability_definition_id=$1 AND runtime_capability_version=$2
             AND source_owner=$3 AND source_kind=$4 AND source_id=$5 AND source_version=$6
             AND source_fingerprint_sha256=$7`,
          [
            command.runtimeCapability.id,
            command.runtimeCapability.version,
            command.source.owner,
            command.source.kind,
            command.source.sourceId,
            String(command.source.sourceVersion),
            command.source.sourceFingerprintSha256
          ]
        );
        const existingObservation = persistedDocument<CapabilityObservation>(
          existing.rows[0] as Row | undefined,
          'Capability Observation'
        );
        if (existingObservation) {
          const ledger = await client.query(
            'SELECT document_json FROM capability_ledger_entries WHERE capability_observation_id=$1',
            [existingObservation.capabilityObservationId]
          );
          const existingLedger = persistedDocument<CapabilityLedgerEntry>(
            ledger.rows[0] as Row | undefined,
            'Capability Ledger Entry'
          );
          if (!existingLedger)
            throw new CapabilityObservationLedgerError(
              'PERSISTENCE_UNAVAILABLE',
              'Capability Observation exists without its append-only Ledger Entry.',
              503,
              true
            );
          const result = {
            observation: existingObservation,
            ledgerEntry: existingLedger,
            replayed: true
          } satisfies CapabilityObservationAdmissionResult;
          await this.insertCommand(
            client,
            command.idempotencyKey,
            requestFingerprintSha256,
            result,
            new Date(this.now()).toISOString()
          );
          return clone(result);
        }

        const admittedAt = new Date(this.now()).toISOString();
        const capabilityObservationId = this.observationIdFactory();
        const capabilityLedgerEntryId = this.ledgerEntryIdFactory();
        const observation: CapabilityObservation = {
          schemaVersion: 1,
          capabilityObservationId,
          workspaceId: source.workspaceId,
          subjectUserId: source.subjectUserId,
          runtimeCapability: clone(command.runtimeCapability),
          source: clone(source),
          subjectAttributionAuthority: assertion.subjectAttributionAuthority,
          observationNature: 'PRIVATE_GOVERNED_WORK_OBSERVATION',
          admittedAt,
          authority: capabilityLearningNoAuthorityConsequences
        };
        const ledgerEntry: CapabilityLedgerEntry = {
          schemaVersion: 1,
          capabilityLedgerEntryId,
          workspaceId: source.workspaceId,
          subjectUserId: source.subjectUserId,
          runtimeCapability: clone(command.runtimeCapability),
          observation: {
            id: capabilityObservationId,
            sourceOwner: source.owner,
            sourceKind: source.kind,
            sourceId: source.sourceId,
            sourceVersion: source.sourceVersion,
            sourceFingerprintSha256: source.sourceFingerprintSha256
          },
          appendOnly: true,
          private: true,
          recordedAt: admittedAt,
          authority: capabilityLearningNoAuthorityConsequences
        };

        await client.query(
          `INSERT INTO capability_observations (
             capability_observation_id,workspace_id,subject_user_id,
             runtime_capability_definition_id,runtime_capability_version,
             source_owner,source_kind,source_id,source_version,source_fingerprint_sha256,
             source_observed_at,source_correlation_id,subject_attribution_authority,
             document_json,admitted_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
          [
            observation.capabilityObservationId,
            observation.workspaceId,
            observation.subjectUserId,
            observation.runtimeCapability.id,
            observation.runtimeCapability.version,
            observation.source.owner,
            observation.source.kind,
            observation.source.sourceId,
            String(observation.source.sourceVersion),
            observation.source.sourceFingerprintSha256,
            observation.source.observedAt,
            observation.source.correlationId ?? null,
            observation.subjectAttributionAuthority,
            JSON.stringify(observation),
            observation.admittedAt
          ]
        );
        await client.query(
          `INSERT INTO capability_ledger_entries (
             capability_ledger_entry_id,capability_observation_id,workspace_id,subject_user_id,
             runtime_capability_definition_id,runtime_capability_version,document_json,recorded_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [
            ledgerEntry.capabilityLedgerEntryId,
            observation.capabilityObservationId,
            ledgerEntry.workspaceId,
            ledgerEntry.subjectUserId,
            ledgerEntry.runtimeCapability.id,
            ledgerEntry.runtimeCapability.version,
            JSON.stringify(ledgerEntry),
            ledgerEntry.recordedAt
          ]
        );
        const result = { observation, ledgerEntry, replayed: false };
        await this.insertCommand(
          client,
          command.idempotencyKey,
          requestFingerprintSha256,
          result,
          admittedAt
        );
        await client.query(
          `INSERT INTO capability_observation_admission_audit (
             idempotency_key,request_fingerprint_sha256,
             runtime_capability_definition_id,runtime_capability_version,
             source_owner,source_kind,source_id,source_version,source_fingerprint_sha256,
             decision,capability_observation_id,capability_ledger_entry_id,created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACCEPTED',$10,$11,$12)`,
          [
            command.idempotencyKey,
            requestFingerprintSha256,
            command.runtimeCapability.id,
            command.runtimeCapability.version,
            command.source.owner,
            command.source.kind,
            command.source.sourceId,
            String(command.source.sourceVersion),
            command.source.sourceFingerprintSha256,
            observation.capabilityObservationId,
            ledgerEntry.capabilityLedgerEntryId,
            admittedAt
          ]
        );
        return clone(result);
      });
    } catch (error) {
      const mapped = this.mapError(error);
      await this.recordDenied(command, requestFingerprintSha256, mapped.code);
      throw mapped;
    }
  }

  async findObservation(
    capabilityObservationId: CapabilityObservationId
  ): Promise<CapabilityObservation | undefined> {
    try {
      const result = await this.query.query(
        'SELECT document_json FROM capability_observations WHERE capability_observation_id=$1',
        [capabilityObservationId]
      );
      return persistedDocument<CapabilityObservation>(
        result.rows[0] as Row | undefined,
        'Capability Observation'
      );
    } catch (error) {
      if (error instanceof CapabilityObservationLedgerError) throw error;
      throw this.persistenceError(error);
    }
  }

  async listLedgerForSubject(
    workspaceId: string,
    subjectUserId: string
  ): Promise<CapabilityLedgerEntry[]> {
    try {
      const result = await this.query.query(
        'SELECT document_json FROM capability_ledger_entries WHERE workspace_id=$1 AND subject_user_id=$2 ORDER BY recorded_at,capability_ledger_entry_id',
        [workspaceId, subjectUserId]
      );
      return result.rows.map((row) => {
        const value = persistedDocument<CapabilityLedgerEntry>(
          row as Row,
          'Capability Ledger Entry'
        );
        if (!value)
          throw new CapabilityObservationLedgerError(
            'PERSISTENCE_UNAVAILABLE',
            'Capability Ledger Entry disappeared while reading.',
            503,
            true
          );
        return value;
      });
    } catch (error) {
      if (error instanceof CapabilityObservationLedgerError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async findReplay(
    idempotencyKey: string,
    requestFingerprintSha256: string
  ): Promise<CapabilityObservationAdmissionResult | undefined> {
    try {
      const replay = await this.query.query(
        'SELECT request_fingerprint_sha256,result_json FROM capability_observation_admission_commands WHERE idempotency_key=$1',
        [idempotencyKey]
      );
      if (!replay.rowCount) return undefined;
      const row = replay.rows[0] as Row;
      if (String(row.request_fingerprint_sha256) !== requestFingerprintSha256)
        throw new CapabilityObservationLedgerError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was already used for a different Capability Observation admission.'
        );
      return replayResult(row);
    } catch (error) {
      if (error instanceof CapabilityObservationLedgerError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async insertCommand(
    client: QueryClient,
    idempotencyKey: string,
    requestFingerprintSha256: string,
    result: CapabilityObservationAdmissionResult,
    createdAt: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO capability_observation_admission_commands (
         idempotency_key,request_fingerprint_sha256,capability_observation_id,
         capability_ledger_entry_id,result_json,created_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [
        idempotencyKey,
        requestFingerprintSha256,
        result.observation.capabilityObservationId,
        result.ledgerEntry.capabilityLedgerEntryId,
        JSON.stringify({ observation: result.observation, ledgerEntry: result.ledgerEntry }),
        createdAt
      ]
    );
  }

  private async recordDenied(
    command: NormalizedCommand,
    requestFingerprintSha256: string,
    code: CapabilityObservationLedgerErrorCode
  ): Promise<void> {
    try {
      await this.query.query(
        `INSERT INTO capability_observation_admission_audit (
           idempotency_key,request_fingerprint_sha256,
           runtime_capability_definition_id,runtime_capability_version,
           source_owner,source_kind,source_id,source_version,source_fingerprint_sha256,
           decision,denial_code,created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DENIED',$10,$11)`,
        [
          command.idempotencyKey,
          requestFingerprintSha256,
          command.runtimeCapability.id,
          command.runtimeCapability.version,
          command.source.owner,
          command.source.kind,
          command.source.sourceId,
          String(command.source.sourceVersion),
          command.source.sourceFingerprintSha256,
          code,
          new Date(this.now()).toISOString()
        ]
      );
    } catch {
      // Denial auditing must never turn the original typed admission error into a different authority result.
    }
  }

  private mapError(error: unknown): CapabilityObservationLedgerError {
    if (error instanceof CapabilityObservationLedgerError) return error;
    if (error instanceof RuntimeCapabilityRegistryError) {
      if (error.code === 'NOT_FOUND')
        return new CapabilityObservationLedgerError(
          'RUNTIME_CAPABILITY_NOT_FOUND',
          error.message,
          404
        );
      return new CapabilityObservationLedgerError(
        'PERSISTENCE_UNAVAILABLE',
        'Runtime Capability Registry is unavailable during Observation admission.',
        503,
        true,
        undefined,
        { cause: error }
      );
    }
    return this.persistenceError(error);
  }

  private persistenceError(error: unknown): CapabilityObservationLedgerError {
    return new CapabilityObservationLedgerError(
      'PERSISTENCE_UNAVAILABLE',
      'Capability Observation Ledger persistence is unavailable.',
      503,
      true,
      undefined,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
