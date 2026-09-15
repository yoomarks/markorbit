import {
  parseWorkspaceCapabilityBindingValidityObservationV1,
  workspaceCapabilityBindingValidityFingerprintSha256V1,
  workspaceCapabilityBindingValidityIdentityProjectionV1,
  workspaceCapabilityBindingValidityIdentitySha256V1,
  workspaceCapabilityBindingValidityObservationIdV1,
  type WorkspaceCapabilityBindingValidityObservationId,
  type WorkspaceCapabilityBindingValidityObservationV1
} from '@markorbit/contracts/workspace-capability-binding-validity';
import type { QueryClient } from '@markorbit/persistence';

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const OBSERVATION_ID = /^workspace-capability-binding-validity_[0-9a-f]{64}$/u;

type Row = Record<string, unknown>;

export type WorkspaceCapabilityBindingValidityStoreErrorCode =
  | 'INVALID_INPUT'
  | 'IDENTITY_CONFLICT'
  | 'PERSISTENCE_INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';
export class WorkspaceCapabilityBindingValidityStoreError extends Error {
  constructor(
    readonly code: WorkspaceCapabilityBindingValidityStoreErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceCapabilityBindingValidityStoreError';
  }
}

export interface WorkspaceCapabilityBindingValidityRecordResultV1 {
  observation: Readonly<WorkspaceCapabilityBindingValidityObservationV1>;
  replayed: boolean;
}

export interface WorkspaceCapabilityBindingValidityRepositoryV1 {
  record(value: unknown): Promise<WorkspaceCapabilityBindingValidityRecordResultV1>;
  find(
    workspaceId: string,
    observationId: WorkspaceCapabilityBindingValidityObservationId
  ): Promise<Readonly<WorkspaceCapabilityBindingValidityObservationV1> | undefined>;
}
export interface WorkspaceCapabilityBindingValidityTransactionHostV1 {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

function normalizedWorkspace(value: string): string {
  if (typeof value !== 'string' || value.trim() !== value || !WORKSPACE_UUID.test(value))
    throw new WorkspaceCapabilityBindingValidityStoreError(
      'INVALID_INPUT',
      'Workspace validity lookup requires a canonical Workspace identity.',
      422
    );
  return value.toLowerCase();
}

function normalizedObservationId(value: string): WorkspaceCapabilityBindingValidityObservationId {
  if (typeof value !== 'string' || !OBSERVATION_ID.test(value))
    throw new WorkspaceCapabilityBindingValidityStoreError(
      'INVALID_INPUT',
      'Workspace validity lookup requires a canonical observation identity.',
      422
    );
  return value as WorkspaceCapabilityBindingValidityObservationId;
}
function normalizedObservation(value: unknown): WorkspaceCapabilityBindingValidityObservationV1 {
  try {
    const observation = parseWorkspaceCapabilityBindingValidityObservationV1(value);
    const identity = workspaceCapabilityBindingValidityIdentityProjectionV1(observation);
    if (observation.observationId !== workspaceCapabilityBindingValidityObservationIdV1(identity))
      throw new Error('observationId does not match deterministic validity identity.');
    return observation;
  } catch (cause) {
    throw new WorkspaceCapabilityBindingValidityStoreError(
      'INVALID_INPUT',
      'Workspace Capability binding validity observation failed governed validation.',
      422,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

function iso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function identitySha256(
  observation: Readonly<WorkspaceCapabilityBindingValidityObservationV1>
): string {
  return workspaceCapabilityBindingValidityIdentitySha256V1(
    workspaceCapabilityBindingValidityIdentityProjectionV1(observation)
  );
}
function persistedObservation(
  row: Row | undefined
): WorkspaceCapabilityBindingValidityObservationV1 | undefined {
  if (!row) return undefined;
  const document = row.document_json;
  if (!document || typeof document !== 'object' || Array.isArray(document))
    throw new WorkspaceCapabilityBindingValidityStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding validity document is invalid.'
    );
  let observation: WorkspaceCapabilityBindingValidityObservationV1;
  try {
    observation = parseWorkspaceCapabilityBindingValidityObservationV1(document);
  } catch (cause) {
    throw new WorkspaceCapabilityBindingValidityStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding validity failed contract validation.',
      409,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
  const identityFingerprint = identitySha256(observation);
  const documentFingerprint = workspaceCapabilityBindingValidityFingerprintSha256V1(observation);
  const mirrorsMatch =
    row.workspace_id === observation.workspaceId &&
    row.observation_id === observation.observationId &&
    row.binding_id === observation.bindingId &&
    row.binding_fingerprint_sha256 === observation.bindingFingerprintSha256 &&
    row.status === observation.status &&
    row.usable === observation.usable &&
    row.reason_code === observation.reasonCode;
  const integrityMatches =
    row.identity_fingerprint_sha256 === identityFingerprint &&
    row.document_fingerprint_sha256 === documentFingerprint &&
    iso(row.evaluated_at) === observation.evaluatedAt;
  if (!mirrorsMatch || !integrityMatches)
    throw new WorkspaceCapabilityBindingValidityStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding validity mirrors do not match its immutable observation.'
    );
  return structuredClone(observation);
}

export class InMemoryWorkspaceCapabilityBindingValidityRepositoryV1 implements WorkspaceCapabilityBindingValidityRepositoryV1 {
  private readonly records = new Map<
    WorkspaceCapabilityBindingValidityObservationId,
    WorkspaceCapabilityBindingValidityObservationV1
  >();

  record(value: unknown): Promise<WorkspaceCapabilityBindingValidityRecordResultV1> {
    const observation = normalizedObservation(value);
    const existing = this.records.get(observation.observationId);
    if (existing) {
      if (identitySha256(existing) !== identitySha256(observation))
        throw new WorkspaceCapabilityBindingValidityStoreError(
          'IDENTITY_CONFLICT',
          'Workspace Capability binding validity identity conflicts with an existing observation.'
        );
      return Promise.resolve({ observation: structuredClone(existing), replayed: true });
    }
    this.records.set(observation.observationId, structuredClone(observation));
    return Promise.resolve({ observation: structuredClone(observation), replayed: false });
  }
  find(
    workspaceIdValue: string,
    observationIdValue: WorkspaceCapabilityBindingValidityObservationId
  ): Promise<Readonly<WorkspaceCapabilityBindingValidityObservationV1> | undefined> {
    const workspaceId = normalizedWorkspace(workspaceIdValue);
    const observationId = normalizedObservationId(observationIdValue);
    const observation = this.records.get(observationId);
    if (!observation || observation.workspaceId !== workspaceId) return Promise.resolve(undefined);
    return Promise.resolve(structuredClone(observation));
  }
}
export class PostgresWorkspaceCapabilityBindingValidityRepositoryV1 implements WorkspaceCapabilityBindingValidityRepositoryV1 {
  constructor(
    private readonly database: WorkspaceCapabilityBindingValidityTransactionHostV1,
    private readonly query: QueryClient
  ) {}

  async record(value: unknown): Promise<WorkspaceCapabilityBindingValidityRecordResultV1> {
    const observation = normalizedObservation(value);
    const identityFingerprint = identitySha256(observation);
    const documentFingerprint = workspaceCapabilityBindingValidityFingerprintSha256V1(observation);
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `workspace-capability-binding-validity:${observation.observationId}`
        ]);
        const existingResult = await client.query(
          `SELECT * FROM capability_workspace_capability_binding_validity_observations
            WHERE observation_id=$1`,
          [observation.observationId]
        );
        if (existingResult.rowCount && existingResult.rowCount > 1)
          throw new WorkspaceCapabilityBindingValidityStoreError(
            'PERSISTENCE_INTEGRITY_FAILURE',
            'Workspace Capability binding validity identity is duplicated in persistence.'
          );
        const existing = persistedObservation(existingResult.rows[0] as Row | undefined);
        if (existing) {
          if (identitySha256(existing) !== identityFingerprint)
            throw new WorkspaceCapabilityBindingValidityStoreError(
              'IDENTITY_CONFLICT',
              'Workspace Capability binding validity identity conflicts with persisted semantics.'
            );
          return { observation: existing, replayed: true };
        }
        await client.query(
          `INSERT INTO capability_workspace_capability_binding_validity_observations (
             workspace_id,observation_id,binding_id,binding_fingerprint_sha256,status,usable,
             reason_code,identity_fingerprint_sha256,document_fingerprint_sha256,document_json,evaluated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
          [
            observation.workspaceId,
            observation.observationId,
            observation.bindingId,
            observation.bindingFingerprintSha256,
            observation.status,
            observation.usable,
            observation.reasonCode,
            identityFingerprint,
            documentFingerprint,
            JSON.stringify(observation),
            observation.evaluatedAt
          ]
        );
        return { observation: structuredClone(observation), replayed: false };
      });
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingValidityStoreError) throw error;
      throw new WorkspaceCapabilityBindingValidityStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace Capability binding validity persistence is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async find(
    workspaceIdValue: string,
    observationIdValue: WorkspaceCapabilityBindingValidityObservationId
  ): Promise<Readonly<WorkspaceCapabilityBindingValidityObservationV1> | undefined> {
    const workspaceId = normalizedWorkspace(workspaceIdValue);
    const observationId = normalizedObservationId(observationIdValue);
    try {
      const result = await this.query.query(
        `SELECT * FROM capability_workspace_capability_binding_validity_observations
          WHERE workspace_id=$1 AND observation_id=$2`,
        [workspaceId, observationId]
      );
      if (result.rowCount && result.rowCount > 1)
        throw new WorkspaceCapabilityBindingValidityStoreError(
          'PERSISTENCE_INTEGRITY_FAILURE',
          'Workspace Capability binding validity lookup returned duplicate identities.'
        );
      return persistedObservation(result.rows[0] as Row | undefined);
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingValidityStoreError) throw error;
      throw new WorkspaceCapabilityBindingValidityStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace Capability binding validity read is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
