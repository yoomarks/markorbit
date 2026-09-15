import {
  parseWorkspaceCapabilityBindingV1,
  workspaceCapabilityBindingFingerprintSha256V1,
  workspaceCapabilityBindingIdV1,
  workspaceCapabilityBindingIdentityProjectionV1,
  workspaceCapabilityBindingIdentitySha256V1,
  type WorkspaceCapabilityBindingId,
  type WorkspaceCapabilityBindingV1
} from '@markorbit/contracts/workspace-capability-binding';
import type { QueryClient } from '@markorbit/persistence';

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const BINDING_ID = /^workspace-capability-binding_[0-9a-f]{64}$/u;

type Row = Record<string, unknown>;

export type WorkspaceCapabilityBindingStoreErrorCode =
  | 'INVALID_INPUT'
  | 'IDENTITY_CONFLICT'
  | 'PERSISTENCE_INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class WorkspaceCapabilityBindingStoreError extends Error {
  constructor(
    readonly code: WorkspaceCapabilityBindingStoreErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceCapabilityBindingStoreError';
  }
}

export interface WorkspaceCapabilityBindingRecordResultV1 {
  binding: Readonly<WorkspaceCapabilityBindingV1>;
  replayed: boolean;
}

export interface WorkspaceCapabilityBindingRepositoryV1 {
  record(value: unknown): Promise<WorkspaceCapabilityBindingRecordResultV1>;
  find(
    workspaceId: string,
    bindingId: WorkspaceCapabilityBindingId
  ): Promise<Readonly<WorkspaceCapabilityBindingV1> | undefined>;
}

export interface WorkspaceCapabilityBindingTransactionHostV1 {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

function normalizedLookup(workspaceIdValue: string, bindingIdValue: string) {
  if (
    typeof workspaceIdValue !== 'string' ||
    workspaceIdValue.trim() !== workspaceIdValue ||
    !WORKSPACE_UUID.test(workspaceIdValue) ||
    typeof bindingIdValue !== 'string' ||
    !BINDING_ID.test(bindingIdValue)
  )
    throw new WorkspaceCapabilityBindingStoreError(
      'INVALID_INPUT',
      'Workspace Capability binding lookup requires canonical identities.',
      422
    );
  return {
    workspaceId: workspaceIdValue.toLowerCase(),
    bindingId: bindingIdValue as WorkspaceCapabilityBindingId
  };
}

function normalizedBinding(value: unknown): WorkspaceCapabilityBindingV1 {
  try {
    const binding = parseWorkspaceCapabilityBindingV1(value);
    const expectedBindingId = workspaceCapabilityBindingIdV1(
      workspaceCapabilityBindingIdentityProjectionV1(binding)
    );
    if (binding.bindingId !== expectedBindingId)
      throw new Error('bindingId does not match the deterministic binding identity.');
    return binding;
  } catch (cause) {
    throw new WorkspaceCapabilityBindingStoreError(
      'INVALID_INPUT',
      'Workspace Capability binding snapshot failed governed contract or identity validation.',
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

function persistedBinding(row: Row | undefined): WorkspaceCapabilityBindingV1 | undefined {
  if (!row) return undefined;
  const document = row.document_json;
  if (!document || typeof document !== 'object' || Array.isArray(document))
    throw new WorkspaceCapabilityBindingStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding document is invalid.'
    );
  let binding: WorkspaceCapabilityBindingV1;
  try {
    binding = parseWorkspaceCapabilityBindingV1(document);
  } catch (cause) {
    throw new WorkspaceCapabilityBindingStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding failed contract validation.',
      409,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }

  const identityProjection = workspaceCapabilityBindingIdentityProjectionV1(binding);
  if (binding.bindingId !== workspaceCapabilityBindingIdV1(identityProjection))
    throw new WorkspaceCapabilityBindingStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding ID does not match its deterministic identity.'
    );
  const identityFingerprint = workspaceCapabilityBindingIdentitySha256V1(identityProjection);
  const documentFingerprint = workspaceCapabilityBindingFingerprintSha256V1(binding);
  const mirrorsMatch =
    row.workspace_id === binding.workspaceId &&
    row.binding_id === binding.bindingId &&
    row.intelligence_id === binding.source.intelligenceId &&
    row.source_projection_sha256 === binding.source.projectionSha256 &&
    row.runtime_capability_definition_id === binding.runtimeCapability.id &&
    Number(row.runtime_capability_version) === binding.runtimeCapability.version &&
    row.capability_id === binding.runtimeCapability.capabilityId &&
    row.capability_version === binding.runtimeCapability.capabilityVersion &&
    row.binding_policy_id === binding.bindingPolicy.policyId &&
    row.binding_policy_version === binding.bindingPolicy.policyVersion &&
    row.binding_policy_rule_id === binding.bindingPolicy.ruleId &&
    row.identity_fingerprint_sha256 === identityFingerprint &&
    row.document_fingerprint_sha256 === documentFingerprint &&
    iso(row.bound_at) === binding.boundAt;
  if (!mirrorsMatch)
    throw new WorkspaceCapabilityBindingStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding mirrors do not match the immutable snapshot.'
    );
  return structuredClone(binding);
}

function identityFingerprint(binding: Readonly<WorkspaceCapabilityBindingV1>): string {
  return workspaceCapabilityBindingIdentitySha256V1(
    workspaceCapabilityBindingIdentityProjectionV1(binding)
  );
}
export class InMemoryWorkspaceCapabilityBindingRepositoryV1 implements WorkspaceCapabilityBindingRepositoryV1 {
  private readonly records = new Map<string, WorkspaceCapabilityBindingV1>();

  record(value: unknown): Promise<WorkspaceCapabilityBindingRecordResultV1> {
    const binding = normalizedBinding(value);
    const current = this.records.get(binding.bindingId);
    if (current) {
      if (identityFingerprint(current) !== identityFingerprint(binding))
        throw new WorkspaceCapabilityBindingStoreError(
          'IDENTITY_CONFLICT',
          'Workspace Capability binding identity conflicts with an existing snapshot.'
        );
      return Promise.resolve({ binding: structuredClone(current), replayed: true });
    }
    this.records.set(binding.bindingId, structuredClone(binding));
    return Promise.resolve({ binding: structuredClone(binding), replayed: false });
  }

  find(
    workspaceIdValue: string,
    bindingIdValue: WorkspaceCapabilityBindingId
  ): Promise<Readonly<WorkspaceCapabilityBindingV1> | undefined> {
    const { workspaceId, bindingId } = normalizedLookup(workspaceIdValue, bindingIdValue);
    const binding = this.records.get(bindingId);
    if (!binding || binding.workspaceId !== workspaceId) return Promise.resolve(undefined);
    return Promise.resolve(structuredClone(binding));
  }
}

export class PostgresWorkspaceCapabilityBindingRepositoryV1 implements WorkspaceCapabilityBindingRepositoryV1 {
  constructor(
    private readonly database: WorkspaceCapabilityBindingTransactionHostV1,
    private readonly query: QueryClient
  ) {}

  async record(value: unknown): Promise<WorkspaceCapabilityBindingRecordResultV1> {
    const binding = normalizedBinding(value);
    const identitySha256 = identityFingerprint(binding);
    const documentSha256 = workspaceCapabilityBindingFingerprintSha256V1(binding);
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `workspace-capability-binding:${binding.bindingId}`
        ]);
        const existingResult = await client.query(
          `SELECT *
             FROM capability_workspace_capability_bindings
            WHERE binding_id=$1`,
          [binding.bindingId]
        );
        if (existingResult.rowCount && existingResult.rowCount > 1)
          throw new WorkspaceCapabilityBindingStoreError(
            'PERSISTENCE_INTEGRITY_FAILURE',
            'Workspace Capability binding identity is duplicated in persistence.'
          );
        const existing = persistedBinding(existingResult.rows[0] as Row | undefined);
        if (existing) {
          if (identityFingerprint(existing) !== identitySha256)
            throw new WorkspaceCapabilityBindingStoreError(
              'IDENTITY_CONFLICT',
              'Workspace Capability binding identity conflicts with persisted semantics.'
            );
          return { binding: existing, replayed: true };
        }

        await client.query(
          `INSERT INTO capability_workspace_capability_bindings (
             workspace_id,binding_id,intelligence_id,source_projection_sha256,
             runtime_capability_definition_id,runtime_capability_version,
             capability_id,capability_version,binding_policy_id,binding_policy_version,
             binding_policy_rule_id,identity_fingerprint_sha256,
             document_fingerprint_sha256,document_json,bound_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
          [
            binding.workspaceId,
            binding.bindingId,
            binding.source.intelligenceId,
            binding.source.projectionSha256,
            binding.runtimeCapability.id,
            binding.runtimeCapability.version,
            binding.runtimeCapability.capabilityId,
            binding.runtimeCapability.capabilityVersion,
            binding.bindingPolicy.policyId,
            binding.bindingPolicy.policyVersion,
            binding.bindingPolicy.ruleId,
            identitySha256,
            documentSha256,
            JSON.stringify(binding),
            binding.boundAt
          ]
        );
        return { binding: structuredClone(binding), replayed: false };
      });
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingStoreError) throw error;
      throw new WorkspaceCapabilityBindingStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace Capability binding persistence is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async find(
    workspaceIdValue: string,
    bindingIdValue: WorkspaceCapabilityBindingId
  ): Promise<Readonly<WorkspaceCapabilityBindingV1> | undefined> {
    const { workspaceId, bindingId } = normalizedLookup(workspaceIdValue, bindingIdValue);
    try {
      const result = await this.query.query(
        `SELECT * FROM capability_workspace_capability_bindings
          WHERE workspace_id=$1 AND binding_id=$2`,
        [workspaceId, bindingId]
      );
      if (result.rowCount && result.rowCount > 1)
        throw new WorkspaceCapabilityBindingStoreError(
          'PERSISTENCE_INTEGRITY_FAILURE',
          'Workspace Capability binding lookup returned duplicate identities.'
        );
      return persistedBinding(result.rows[0] as Row | undefined);
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingStoreError) throw error;
      throw new WorkspaceCapabilityBindingStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace Capability binding read is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
