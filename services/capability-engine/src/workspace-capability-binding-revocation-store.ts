import { createHash } from 'node:crypto';
import type { WorkspaceCapabilityBindingId } from '@markorbit/contracts/workspace-capability-binding';
import type { QueryClient } from '@markorbit/persistence';

export type WorkspaceCapabilityBindingRevocationId =
  `workspace-capability-binding-revocation_${string}`;

export const workspaceCapabilityBindingRevocationAuthorityV1 = Object.freeze({
  bindingCurrentUsabilityRevoked: true,
  capabilityInvocationAuthorized: false,
  implementationSelected: false,
  professionalDecisionCreated: false,
  recommendationCreated: false,
  quoteCreated: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  productStateCreated: false,
  officialTruthCreated: false
} as const);

export interface WorkspaceCapabilityBindingRevocationV1 {
  schemaVersion: 1;
  revocationId: WorkspaceCapabilityBindingRevocationId;
  workspaceId: string;
  bindingId: WorkspaceCapabilityBindingId;
  bindingFingerprintSha256: string;
  reason: string;
  revokedAt: string;
  authority: typeof workspaceCapabilityBindingRevocationAuthorityV1;
}
export type WorkspaceCapabilityBindingRevocationIdentityV1 = Omit<
  WorkspaceCapabilityBindingRevocationV1,
  'revocationId' | 'revokedAt'
>;

const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const BINDING_ID = /^workspace-capability-binding_[0-9a-f]{64}$/u;
const REVOCATION_ID = /^workspace-capability-binding-revocation_[0-9a-f]{64}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

type Row = Record<string, unknown>;

export type WorkspaceCapabilityBindingRevocationStoreErrorCode =
  | 'INVALID_INPUT'
  | 'IDENTITY_CONFLICT'
  | 'PERSISTENCE_INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class WorkspaceCapabilityBindingRevocationStoreError extends Error {
  constructor(
    readonly code: WorkspaceCapabilityBindingRevocationStoreErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceCapabilityBindingRevocationStoreError';
  }
}
export interface WorkspaceCapabilityBindingRevocationRecordResultV1 {
  revocation: Readonly<WorkspaceCapabilityBindingRevocationV1>;
  replayed: boolean;
}

export interface WorkspaceCapabilityBindingRevocationRepositoryV1 {
  record(value: unknown): Promise<WorkspaceCapabilityBindingRevocationRecordResultV1>;
  find(
    workspaceId: string,
    bindingId: WorkspaceCapabilityBindingId
  ): Promise<Readonly<WorkspaceCapabilityBindingRevocationV1> | undefined>;
}

export interface WorkspaceCapabilityBindingRevocationTransactionHostV1 {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  return value;
}

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}
export function workspaceCapabilityBindingRevocationIdentityProjectionV1(
  value: Readonly<WorkspaceCapabilityBindingRevocationV1>
): WorkspaceCapabilityBindingRevocationIdentityV1 {
  return {
    schemaVersion: 1,
    workspaceId: value.workspaceId,
    bindingId: value.bindingId,
    bindingFingerprintSha256: value.bindingFingerprintSha256,
    reason: value.reason,
    authority: value.authority
  };
}

export function workspaceCapabilityBindingRevocationIdentitySha256V1(
  value: Readonly<WorkspaceCapabilityBindingRevocationIdentityV1>
): string {
  return sha256(value);
}

export function workspaceCapabilityBindingRevocationIdV1(
  value: Readonly<WorkspaceCapabilityBindingRevocationIdentityV1>
): WorkspaceCapabilityBindingRevocationId {
  return `workspace-capability-binding-revocation_${workspaceCapabilityBindingRevocationIdentitySha256V1(value)}`;
}

export function workspaceCapabilityBindingRevocationFingerprintSha256V1(
  value: Readonly<WorkspaceCapabilityBindingRevocationV1>
): string {
  return sha256(value);
}
function recordObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'INVALID_INPUT',
      'Workspace Capability binding revocation must be an object.',
      422
    );
  return value as Record<string, unknown>;
}

function canonicalText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > maximum)
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'INVALID_INPUT',
      `${field} must contain canonical text.`,
      422
    );
  return value;
}

function canonicalTimestamp(value: unknown, field: string): string {
  const text = canonicalText(value, field, 80);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== text)
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'INVALID_INPUT',
      `${field} must be a canonical ISO timestamp.`,
      422
    );
  return text;
}
function normalizedRevocation(value: unknown): WorkspaceCapabilityBindingRevocationV1 {
  const input = recordObject(value);
  const keys = Object.keys(input).sort();
  const expected = [
    'authority',
    'bindingFingerprintSha256',
    'bindingId',
    'reason',
    'revocationId',
    'revokedAt',
    'schemaVersion',
    'workspaceId'
  ].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]))
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'INVALID_INPUT',
      'Workspace Capability binding revocation contains unsupported fields.',
      422
    );
  if (input.schemaVersion !== 1)
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'INVALID_INPUT',
      'Workspace Capability binding revocation schemaVersion must be 1.',
      422
    );
  const authority = recordObject(input.authority);
  for (const [key, expectedValue] of Object.entries(
    workspaceCapabilityBindingRevocationAuthorityV1
  )) {
    if (authority[key] !== expectedValue)
      throw new WorkspaceCapabilityBindingRevocationStoreError(
        'INVALID_INPUT',
        `Workspace Capability binding revocation authority.${key} is invalid.`,
        422
      );
  }
  const workspaceId = canonicalText(input.workspaceId, 'workspaceId', 64).toLowerCase();
  const bindingId = canonicalText(input.bindingId, 'bindingId', 100);
  const revocationId = canonicalText(input.revocationId, 'revocationId', 120);
  const bindingFingerprintSha256 = canonicalText(
    input.bindingFingerprintSha256,
    'bindingFingerprintSha256',
    64
  );
  if (
    !WORKSPACE_UUID.test(workspaceId) ||
    !BINDING_ID.test(bindingId) ||
    !REVOCATION_ID.test(revocationId) ||
    !SHA256.test(bindingFingerprintSha256)
  )
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'INVALID_INPUT',
      'Workspace Capability binding revocation identity is invalid.',
      422
    );
  const parsed: WorkspaceCapabilityBindingRevocationV1 = {
    schemaVersion: 1,
    revocationId: revocationId as WorkspaceCapabilityBindingRevocationId,
    workspaceId,
    bindingId: bindingId as WorkspaceCapabilityBindingId,
    bindingFingerprintSha256,
    reason: canonicalText(input.reason, 'reason', 2000),
    revokedAt: canonicalTimestamp(input.revokedAt, 'revokedAt'),
    authority: workspaceCapabilityBindingRevocationAuthorityV1
  };
  if (
    parsed.revocationId !==
    workspaceCapabilityBindingRevocationIdV1(
      workspaceCapabilityBindingRevocationIdentityProjectionV1(parsed)
    )
  )
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'INVALID_INPUT',
      'revocationId must match the deterministic revocation identity.',
      422
    );
  return parsed;
}
function normalizedLookup(workspaceIdValue: string, bindingIdValue: string) {
  const workspaceId = canonicalText(workspaceIdValue, 'workspaceId', 64).toLowerCase();
  const bindingId = canonicalText(bindingIdValue, 'bindingId', 100);
  if (!WORKSPACE_UUID.test(workspaceId) || !BINDING_ID.test(bindingId))
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'INVALID_INPUT',
      'Workspace Capability binding revocation lookup requires canonical identities.',
      422
    );
  return { workspaceId, bindingId: bindingId as WorkspaceCapabilityBindingId };
}

function iso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function persistedRevocation(
  row: Row | undefined
): WorkspaceCapabilityBindingRevocationV1 | undefined {
  if (!row) return undefined;
  let revocation: WorkspaceCapabilityBindingRevocationV1;
  try {
    revocation = normalizedRevocation(row.document_json);
  } catch (cause) {
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding revocation failed validation.',
      409,
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
  const identityFingerprint = workspaceCapabilityBindingRevocationIdentitySha256V1(
    workspaceCapabilityBindingRevocationIdentityProjectionV1(revocation)
  );
  const documentFingerprint = workspaceCapabilityBindingRevocationFingerprintSha256V1(revocation);
  const mirrorsMatch =
    row.workspace_id === revocation.workspaceId &&
    row.revocation_id === revocation.revocationId &&
    row.binding_id === revocation.bindingId &&
    row.binding_fingerprint_sha256 === revocation.bindingFingerprintSha256 &&
    row.reason === revocation.reason;
  const integrityMatches =
    row.identity_fingerprint_sha256 === identityFingerprint &&
    row.document_fingerprint_sha256 === documentFingerprint &&
    iso(row.revoked_at) === revocation.revokedAt;
  if (!mirrorsMatch || !integrityMatches)
    throw new WorkspaceCapabilityBindingRevocationStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Persisted Workspace Capability binding revocation mirrors do not match its immutable event.'
    );
  return structuredClone(revocation);
}

export class InMemoryWorkspaceCapabilityBindingRevocationRepositoryV1 implements WorkspaceCapabilityBindingRevocationRepositoryV1 {
  private readonly records = new Map<string, WorkspaceCapabilityBindingRevocationV1>();
  record(value: unknown): Promise<WorkspaceCapabilityBindingRevocationRecordResultV1> {
    const revocation = normalizedRevocation(value);
    const key = `${revocation.workspaceId}:${revocation.bindingId}`;
    const existing = this.records.get(key);
    if (existing) {
      if (
        workspaceCapabilityBindingRevocationIdentitySha256V1(
          workspaceCapabilityBindingRevocationIdentityProjectionV1(existing)
        ) !==
        workspaceCapabilityBindingRevocationIdentitySha256V1(
          workspaceCapabilityBindingRevocationIdentityProjectionV1(revocation)
        )
      )
        throw new WorkspaceCapabilityBindingRevocationStoreError(
          'IDENTITY_CONFLICT',
          'Workspace Capability binding already has a different immutable revocation event.'
        );
      return Promise.resolve({ revocation: structuredClone(existing), replayed: true });
    }
    this.records.set(key, structuredClone(revocation));
    return Promise.resolve({ revocation: structuredClone(revocation), replayed: false });
  }

  find(
    workspaceIdValue: string,
    bindingIdValue: WorkspaceCapabilityBindingId
  ): Promise<Readonly<WorkspaceCapabilityBindingRevocationV1> | undefined> {
    const { workspaceId, bindingId } = normalizedLookup(workspaceIdValue, bindingIdValue);
    const value = this.records.get(`${workspaceId}:${bindingId}`);
    return Promise.resolve(value ? structuredClone(value) : undefined);
  }
}

export class PostgresWorkspaceCapabilityBindingRevocationRepositoryV1 implements WorkspaceCapabilityBindingRevocationRepositoryV1 {
  constructor(
    private readonly database: WorkspaceCapabilityBindingRevocationTransactionHostV1,
    private readonly query: QueryClient
  ) {}

  async record(value: unknown): Promise<WorkspaceCapabilityBindingRevocationRecordResultV1> {
    const revocation = normalizedRevocation(value);
    const identityFingerprint = workspaceCapabilityBindingRevocationIdentitySha256V1(
      workspaceCapabilityBindingRevocationIdentityProjectionV1(revocation)
    );
    const documentFingerprint = workspaceCapabilityBindingRevocationFingerprintSha256V1(revocation);
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `workspace-capability-binding-revocation:${revocation.workspaceId}:${revocation.bindingId}`
        ]);
        const existingResult = await client.query(
          `SELECT * FROM capability_workspace_capability_binding_revocations
            WHERE workspace_id=$1 AND binding_id=$2`,
          [revocation.workspaceId, revocation.bindingId]
        );
        if (existingResult.rowCount && existingResult.rowCount > 1)
          throw new WorkspaceCapabilityBindingRevocationStoreError(
            'PERSISTENCE_INTEGRITY_FAILURE',
            'Workspace Capability binding has duplicate durable revocation events.'
          );
        const existing = persistedRevocation(existingResult.rows[0] as Row | undefined);
        if (existing) {
          const existingIdentity = workspaceCapabilityBindingRevocationIdentitySha256V1(
            workspaceCapabilityBindingRevocationIdentityProjectionV1(existing)
          );
          if (existingIdentity !== identityFingerprint)
            throw new WorkspaceCapabilityBindingRevocationStoreError(
              'IDENTITY_CONFLICT',
              'Workspace Capability binding already has a different immutable revocation event.'
            );
          return { revocation: existing, replayed: true };
        }
        await client.query(
          `INSERT INTO capability_workspace_capability_binding_revocations (
             workspace_id,revocation_id,binding_id,binding_fingerprint_sha256,reason,
             identity_fingerprint_sha256,document_fingerprint_sha256,document_json,revoked_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            revocation.workspaceId,
            revocation.revocationId,
            revocation.bindingId,
            revocation.bindingFingerprintSha256,
            revocation.reason,
            identityFingerprint,
            documentFingerprint,
            JSON.stringify(revocation),
            revocation.revokedAt
          ]
        );
        return { revocation: structuredClone(revocation), replayed: false };
      });
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingRevocationStoreError) throw error;
      throw new WorkspaceCapabilityBindingRevocationStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace Capability binding revocation persistence is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async find(
    workspaceIdValue: string,
    bindingIdValue: WorkspaceCapabilityBindingId
  ): Promise<Readonly<WorkspaceCapabilityBindingRevocationV1> | undefined> {
    const { workspaceId, bindingId } = normalizedLookup(workspaceIdValue, bindingIdValue);
    try {
      const result = await this.query.query(
        `SELECT * FROM capability_workspace_capability_binding_revocations
          WHERE workspace_id=$1 AND binding_id=$2`,
        [workspaceId, bindingId]
      );
      if (result.rowCount && result.rowCount > 1)
        throw new WorkspaceCapabilityBindingRevocationStoreError(
          'PERSISTENCE_INTEGRITY_FAILURE',
          'Workspace Capability binding revocation lookup returned duplicate events.'
        );
      return persistedRevocation(result.rows[0] as Row | undefined);
    } catch (error) {
      if (error instanceof WorkspaceCapabilityBindingRevocationStoreError) throw error;
      throw new WorkspaceCapabilityBindingRevocationStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace Capability binding revocation read is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
