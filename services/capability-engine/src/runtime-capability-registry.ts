import { createHash, randomUUID } from 'node:crypto';
import type {
  CapabilityCanonReference,
  RuntimeCapabilityDefinition,
  RuntimeCapabilityDefinitionId,
  RuntimeCapabilityLineage
} from '@markorbit/contracts/capability-learning';
import type { QueryClient } from '@markorbit/persistence';

const SHA256 = /^[0-9a-f]{64}$/;
const LEGACY_FIXTURE_VERSION = '0.1.0-fixture';

export type RuntimeCapabilityRegistryErrorCode =
  | 'INVALID_INPUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CANON_VERSION_CONFLICT'
  | 'CAPABILITY_VERSION_CONFLICT'
  | 'NOT_FOUND'
  | 'PERSISTENCE_UNAVAILABLE';

export class RuntimeCapabilityRegistryError extends Error {
  constructor(
    readonly code: RuntimeCapabilityRegistryErrorCode,
    message: string,
    readonly status = 409,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'RuntimeCapabilityRegistryError';
  }
}

export interface AcceptedCapabilityCanonDefinitionInput {
  sourceAuthority: 'ACCEPTED_CAPABILITY_CANON';
  capabilityId: string;
  capabilityVersion: string;
  title: string;
  description: string;
  lineage: Readonly<RuntimeCapabilityLineage>;
  canonReference: Readonly<CapabilityCanonReference>;
}

export interface ImportRuntimeCapabilityCommand {
  definition: unknown;
  idempotencyKey: string;
}

export interface ImportRuntimeCapabilityResult {
  definition: Readonly<RuntimeCapabilityDefinition>;
  replayed: boolean;
}

export interface CapabilityRegistryTransactionHost {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

type Row = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allowedSet = new Set(allowed);
  const unknownKeys = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknownKeys.length)
    throw new RuntimeCapabilityRegistryError(
      'INVALID_INPUT',
      `${field} contains unsupported fields.`,
      422,
      { fields: unknownKeys }
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new RuntimeCapabilityRegistryError('INVALID_INPUT', `${field} must be a string.`, 422);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new RuntimeCapabilityRegistryError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function optionalText(value: unknown, field: string, maximum = 300): string | undefined {
  return value === undefined ? undefined : text(value, field, maximum);
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function exactSha256(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned))
    throw new RuntimeCapabilityRegistryError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function definitionFromRow(row: Row | undefined): RuntimeCapabilityDefinition | undefined {
  if (!row) return undefined;
  const document = row.document_json;
  if (!isRecord(document))
    throw new RuntimeCapabilityRegistryError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted runtime Capability definition is invalid.',
      503
    );
  return clone(document as unknown as RuntimeCapabilityDefinition);
}

function resultFromRow(row: Row): ImportRuntimeCapabilityResult {
  const value = row.result_json;
  if (!isRecord(value) || !isRecord(value.definition))
    throw new RuntimeCapabilityRegistryError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted runtime Capability import result is invalid.',
      503
    );
  return {
    definition: clone(value.definition as unknown as RuntimeCapabilityDefinition),
    replayed: true
  };
}

export function normalizeAcceptedCapabilityCanonDefinition(
  value: unknown
): AcceptedCapabilityCanonDefinitionInput {
  if (!isRecord(value))
    throw new RuntimeCapabilityRegistryError('INVALID_INPUT', 'definition must be an object.', 422);
  exactKeys(
    value,
    [
      'sourceAuthority',
      'capabilityId',
      'capabilityVersion',
      'title',
      'description',
      'lineage',
      'canonReference'
    ],
    'definition'
  );
  if (value.sourceAuthority !== 'ACCEPTED_CAPABILITY_CANON')
    throw new RuntimeCapabilityRegistryError(
      'INVALID_INPUT',
      'Runtime Capability definitions may be admitted only from accepted Capability Canon.',
      422
    );
  const capabilityId = text(value.capabilityId, 'definition.capabilityId', 300);
  const capabilityVersion = text(value.capabilityVersion, 'definition.capabilityVersion', 120);
  if (capabilityVersion === LEGACY_FIXTURE_VERSION)
    throw new RuntimeCapabilityRegistryError(
      'INVALID_INPUT',
      'The legacy 0.1.0-fixture record is not accepted Capability Canon lineage.',
      422
    );
  if (!isRecord(value.lineage))
    throw new RuntimeCapabilityRegistryError(
      'INVALID_INPUT',
      'definition.lineage must be an object.',
      422
    );
  exactKeys(
    value.lineage,
    ['domainId', 'capabilityId', 'skillId', 'actionId', 'invocationId'],
    'definition.lineage'
  );
  const lineageCapabilityId = text(
    value.lineage.capabilityId,
    'definition.lineage.capabilityId',
    300
  );
  if (lineageCapabilityId !== capabilityId)
    throw new RuntimeCapabilityRegistryError(
      'INVALID_INPUT',
      'definition.lineage.capabilityId must match definition.capabilityId.',
      422
    );
  if (!isRecord(value.canonReference))
    throw new RuntimeCapabilityRegistryError(
      'INVALID_INPUT',
      'definition.canonReference must be an object.',
      422
    );
  exactKeys(
    value.canonReference,
    ['canonId', 'canonVersion', 'sourceFingerprintSha256'],
    'definition.canonReference'
  );
  const domainId = optionalText(value.lineage.domainId, 'definition.lineage.domainId');
  const skillId = optionalText(value.lineage.skillId, 'definition.lineage.skillId');
  const actionId = optionalText(value.lineage.actionId, 'definition.lineage.actionId');
  const invocationId = optionalText(value.lineage.invocationId, 'definition.lineage.invocationId');
  return {
    sourceAuthority: 'ACCEPTED_CAPABILITY_CANON',
    capabilityId,
    capabilityVersion,
    title: text(value.title, 'definition.title', 500),
    description: text(value.description, 'definition.description', 8000),
    lineage: {
      ...(domainId ? { domainId } : {}),
      capabilityId,
      ...(skillId ? { skillId } : {}),
      ...(actionId ? { actionId } : {}),
      ...(invocationId ? { invocationId } : {})
    },
    canonReference: {
      canonId: text(value.canonReference.canonId, 'definition.canonReference.canonId', 300),
      canonVersion: text(
        value.canonReference.canonVersion,
        'definition.canonReference.canonVersion',
        120
      ),
      sourceFingerprintSha256: exactSha256(
        value.canonReference.sourceFingerprintSha256,
        'definition.canonReference.sourceFingerprintSha256'
      )
    }
  };
}

export function acceptedCapabilityCanonDefinitionFingerprint(
  definition: AcceptedCapabilityCanonDefinitionInput
): string {
  return sha256(definition);
}

function runtimeCapabilityId(): RuntimeCapabilityDefinitionId {
  return `runtime-capability_${randomUUID().replaceAll('-', '')}`;
}

export class PostgresRuntimeCapabilityRegistry {
  constructor(
    private readonly database: CapabilityRegistryTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly idFactory: () => RuntimeCapabilityDefinitionId = runtimeCapabilityId
  ) {}

  async importAccepted(
    command: Readonly<ImportRuntimeCapabilityCommand>
  ): Promise<ImportRuntimeCapabilityResult> {
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey', 300);
    const accepted = normalizeAcceptedCapabilityCanonDefinition(command.definition);
    const requestFingerprintSha256 = acceptedCapabilityCanonDefinitionFingerprint(accepted);
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `capability-runtime-import:${idempotencyKey}`
        ]);
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_json FROM capability_runtime_definition_imports WHERE idempotency_key=$1',
          [idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256)
            throw new RuntimeCapabilityRegistryError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different accepted Canon definition.'
            );
          return resultFromRow(prior);
        }

        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `capability-runtime-identity:${accepted.capabilityId}`
        ]);
        const sameCanon = await client.query(
          'SELECT document_json,definition_fingerprint_sha256 FROM capability_runtime_definitions WHERE capability_id=$1 AND canon_id=$2 AND canon_version=$3',
          [
            accepted.capabilityId,
            accepted.canonReference.canonId,
            accepted.canonReference.canonVersion
          ]
        );
        const sameCanonRow = sameCanon.rows[0] as Row | undefined;
        if (sameCanonRow) {
          if (String(sameCanonRow.definition_fingerprint_sha256) !== requestFingerprintSha256)
            throw new RuntimeCapabilityRegistryError(
              'CANON_VERSION_CONFLICT',
              'The same accepted Canon identity/version already maps to a different runtime definition.'
            );
          const definition = definitionFromRow(sameCanonRow)!;
          const result: ImportRuntimeCapabilityResult = { definition, replayed: true };
          await this.recordImport(
            client,
            idempotencyKey,
            requestFingerprintSha256,
            definition,
            result
          );
          return result;
        }

        const sameCapabilityVersion = await client.query(
          'SELECT canon_id,canon_version FROM capability_runtime_definitions WHERE capability_id=$1 AND capability_version=$2',
          [accepted.capabilityId, accepted.capabilityVersion]
        );
        if (sameCapabilityVersion.rowCount)
          throw new RuntimeCapabilityRegistryError(
            'CAPABILITY_VERSION_CONFLICT',
            'Capability version is already bound to a different accepted Canon definition.'
          );

        const identity = await client.query(
          'SELECT runtime_capability_definition_id FROM capability_runtime_identities WHERE capability_id=$1',
          [accepted.capabilityId]
        );
        const identityRow = identity.rows[0] as
          { runtime_capability_definition_id: RuntimeCapabilityDefinitionId } | undefined;
        let runtimeCapabilityDefinitionId = identityRow?.runtime_capability_definition_id;
        const createdAt = new Date(this.now()).toISOString();
        if (!runtimeCapabilityDefinitionId) {
          runtimeCapabilityDefinitionId = this.idFactory();
          await client.query(
            'INSERT INTO capability_runtime_identities (runtime_capability_definition_id,capability_id,created_at) VALUES ($1,$2,$3)',
            [runtimeCapabilityDefinitionId, accepted.capabilityId, createdAt]
          );
        }
        const versionResult = await client.query(
          'SELECT COALESCE(MAX(version),0) AS current_version FROM capability_runtime_definitions WHERE runtime_capability_definition_id=$1',
          [runtimeCapabilityDefinitionId]
        );
        const versionRow = versionResult.rows[0] as
          { current_version: number | string } | undefined;
        const version = Number(versionRow?.current_version ?? 0) + 1;
        const definition: RuntimeCapabilityDefinition = {
          schemaVersion: 1,
          runtimeCapabilityDefinitionId,
          version,
          capabilityId: accepted.capabilityId,
          capabilityVersion: accepted.capabilityVersion,
          title: accepted.title,
          description: accepted.description,
          lineage: clone(accepted.lineage),
          canonReference: clone(accepted.canonReference),
          acceptedCanonProjection: true,
          createdFromWorkEvidence: false,
          createdFromAiOutput: false,
          createdAt
        };
        await client.query(
          `INSERT INTO capability_runtime_definitions (
             runtime_capability_definition_id,version,capability_id,capability_version,title,description,
             domain_id,skill_id,action_id,invocation_id,canon_id,canon_version,
             source_fingerprint_sha256,definition_fingerprint_sha256,accepted_canon_projection,
             created_from_work_evidence,created_from_ai_output,document_json,created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,false,false,$15::jsonb,$16)`,
          [
            runtimeCapabilityDefinitionId,
            version,
            accepted.capabilityId,
            accepted.capabilityVersion,
            accepted.title,
            accepted.description,
            accepted.lineage.domainId ?? null,
            accepted.lineage.skillId ?? null,
            accepted.lineage.actionId ?? null,
            accepted.lineage.invocationId ?? null,
            accepted.canonReference.canonId,
            accepted.canonReference.canonVersion,
            accepted.canonReference.sourceFingerprintSha256,
            requestFingerprintSha256,
            JSON.stringify(definition),
            createdAt
          ]
        );
        const result: ImportRuntimeCapabilityResult = { definition, replayed: false };
        await this.recordImport(
          client,
          idempotencyKey,
          requestFingerprintSha256,
          definition,
          result
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof RuntimeCapabilityRegistryError) throw error;
      throw new RuntimeCapabilityRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Capability Engine runtime registry persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async findCurrent(capabilityIdValue: string): Promise<RuntimeCapabilityDefinition | undefined> {
    const capabilityId = text(capabilityIdValue, 'capabilityId', 300);
    try {
      const result = await this.query.query(
        'SELECT document_json FROM capability_runtime_definitions WHERE capability_id=$1 ORDER BY version DESC LIMIT 1',
        [capabilityId]
      );
      return definitionFromRow(result.rows[0] as Row | undefined);
    } catch (error) {
      if (error instanceof RuntimeCapabilityRegistryError) throw error;
      throw new RuntimeCapabilityRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Capability Engine runtime registry persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async findVersion(
    runtimeCapabilityDefinitionId: RuntimeCapabilityDefinitionId,
    version: number
  ): Promise<RuntimeCapabilityDefinition | undefined> {
    if (!Number.isInteger(version) || version < 1)
      throw new RuntimeCapabilityRegistryError(
        'INVALID_INPUT',
        'Runtime Capability version must be a positive integer.',
        422
      );
    try {
      const result = await this.query.query(
        'SELECT document_json FROM capability_runtime_definitions WHERE runtime_capability_definition_id=$1 AND version=$2',
        [runtimeCapabilityDefinitionId, version]
      );
      return definitionFromRow(result.rows[0] as Row | undefined);
    } catch (error) {
      if (error instanceof RuntimeCapabilityRegistryError) throw error;
      throw new RuntimeCapabilityRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Capability Engine runtime registry persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async listVersions(capabilityIdValue: string): Promise<RuntimeCapabilityDefinition[]> {
    const capabilityId = text(capabilityIdValue, 'capabilityId', 300);
    try {
      const result = await this.query.query(
        'SELECT document_json FROM capability_runtime_definitions WHERE capability_id=$1 ORDER BY version ASC',
        [capabilityId]
      );
      return result.rows.map((row) => definitionFromRow(row as Row)!);
    } catch (error) {
      if (error instanceof RuntimeCapabilityRegistryError) throw error;
      throw new RuntimeCapabilityRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Capability Engine runtime registry persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  private async recordImport(
    client: QueryClient,
    idempotencyKey: string,
    requestFingerprintSha256: string,
    definition: RuntimeCapabilityDefinition,
    result: ImportRuntimeCapabilityResult
  ): Promise<void> {
    await client.query(
      'INSERT INTO capability_runtime_definition_imports (idempotency_key,request_fingerprint_sha256,runtime_capability_definition_id,runtime_capability_version,result_json,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
      [
        idempotencyKey,
        requestFingerprintSha256,
        definition.runtimeCapabilityDefinitionId,
        definition.version,
        JSON.stringify(result),
        new Date(this.now()).toISOString()
      ]
    );
  }
}
