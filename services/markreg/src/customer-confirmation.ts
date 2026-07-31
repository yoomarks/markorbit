import { createHash, randomUUID } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import { PersistenceError } from '@markorbit/persistence';

export const CUSTOMER_CONFIRMATION_SNAPSHOT_SCHEMA_VERSION = 1 as const;
export type CustomerConfirmationState = 'CONFIRMED' | 'WITHDRAWN';
export interface AcceptedQuoteSnapshot {
  schemaVersion: 1;
  quoteId: string;
  quoteVersion: string;
  planId: string;
  planVersion: string;
  currency: string;
  totalMinor: number;
  lineItems: readonly Readonly<{
    code: string;
    description: string;
    category: string;
    amountMinor: number;
  }>[];
  termsVersion: string;
  acknowledgementCodes: readonly string[];
}
export interface CustomerConfirmationRecord {
  confirmationId: string;
  workspaceId: string;
  sourceQuoteId: string;
  sourceQuoteVersion: string;
  status: CustomerConfirmationState;
  version: number;
  snapshotSchemaVersion: 1;
  sourceSnapshot: Readonly<AcceptedQuoteSnapshot>;
  sourceSnapshotHash: string;
  acceptedAt: string;
  updatedAt: string;
  withdrawnAt: string | null;
}
export type CustomerConfirmationErrorCode =
  | 'CUSTOMER_CONFIRMATION_NOT_FOUND'
  | 'CUSTOMER_CONFIRMATION_DUPLICATE'
  | 'CUSTOMER_CONFIRMATION_WITHDRAWN'
  | 'CUSTOMER_CONFIRMATION_STALE_VERSION'
  | 'CUSTOMER_CONFIRMATION_INVALID_SOURCE'
  | 'CUSTOMER_CONFIRMATION_SOURCE_NOT_FOUND'
  | 'CUSTOMER_CONFIRMATION_SOURCE_VERSION_MISMATCH'
  | 'CUSTOMER_CONFIRMATION_WORKSPACE_MISMATCH'
  | 'CUSTOMER_CONFIRMATION_INVALID_SNAPSHOT'
  | 'PERMISSION_DENIED'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERSISTENCE_UNAVAILABLE';
export class CustomerConfirmationError extends Error {
  constructor(
    readonly code: CustomerConfirmationErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CustomerConfirmationError';
  }
}

/** RFC-8785-like bounded canonical JSON: object keys sort recursively; undefined is rejected. */
export function canonicalJson(value: unknown): string {
  if (value === undefined)
    throw new CustomerConfirmationError(
      'CUSTOMER_CONFIRMATION_INVALID_SNAPSHOT',
      'Snapshot contains undefined.'
    );
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_INVALID_SNAPSHOT',
        'Snapshot contains a non-finite number.'
      );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  throw new CustomerConfirmationError(
    'CUSTOMER_CONFIRMATION_INVALID_SNAPSHOT',
    'Snapshot contains an unsupported value.'
  );
}
export const hashSnapshot = (snapshot: AcceptedQuoteSnapshot) =>
  createHash('sha256')
    .update(Buffer.from(canonicalJson(snapshot), 'utf8'))
    .digest('hex');
function clone<T>(value: T): T {
  return structuredClone(value);
}
export function validateSnapshot(value: unknown): AcceptedQuoteSnapshot {
  const v = value as Partial<AcceptedQuoteSnapshot> | null;
  if (
    !v ||
    v.schemaVersion !== 1 ||
    typeof v.quoteId !== 'string' ||
    typeof v.quoteVersion !== 'string' ||
    typeof v.planId !== 'string' ||
    typeof v.planVersion !== 'string' ||
    typeof v.currency !== 'string' ||
    !Number.isSafeInteger(v.totalMinor) ||
    !Array.isArray(v.lineItems) ||
    typeof v.termsVersion !== 'string' ||
    !Array.isArray(v.acknowledgementCodes)
  )
    throw new CustomerConfirmationError(
      'CUSTOMER_CONFIRMATION_INVALID_SNAPSHOT',
      'Persisted Customer Confirmation snapshot is invalid.'
    );
  return clone(v as AcceptedQuoteSnapshot);
}
export interface CustomerConfirmationRepository {
  create(record: CustomerConfirmationRecord): Promise<CustomerConfirmationRecord>;
  findById(workspaceId: string, confirmationId: string): Promise<CustomerConfirmationRecord | null>;
  findBySource(
    workspaceId: string,
    quoteId: string,
    quoteVersion: string
  ): Promise<CustomerConfirmationRecord | null>;
  withdraw(
    workspaceId: string,
    confirmationId: string,
    expectedVersion: number,
    at: string
  ): Promise<CustomerConfirmationRecord>;
}
export class InMemoryCustomerConfirmationRepository implements CustomerConfirmationRepository {
  private readonly values = new Map<string, CustomerConfirmationRecord>();
  async create(record: CustomerConfirmationRecord) {
    if (
      await this.findBySource(record.workspaceId, record.sourceQuoteId, record.sourceQuoteVersion)
    )
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_DUPLICATE',
        'This Quote version is already confirmed.'
      );
    this.values.set(record.confirmationId, clone(record));
    return clone(record);
  }
  findById(workspaceId: string, id: string) {
    const value = this.values.get(id);
    return Promise.resolve(value?.workspaceId === workspaceId ? clone(value) : null);
  }
  async findBySource(workspaceId: string, quoteId: string, quoteVersion: string) {
    return clone(
      [...this.values.values()].find(
        (v) =>
          v.workspaceId === workspaceId &&
          v.sourceQuoteId === quoteId &&
          v.sourceQuoteVersion === quoteVersion
      ) ?? null
    );
  }
  async withdraw(workspaceId: string, id: string, expectedVersion: number, at: string) {
    const value = await this.findById(workspaceId, id);
    if (!value)
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_NOT_FOUND',
        'Customer Confirmation was not found.'
      );
    if (value.status === 'WITHDRAWN')
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_WITHDRAWN',
        'Customer Confirmation is withdrawn.'
      );
    if (value.version !== expectedVersion)
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_STALE_VERSION',
        'Customer Confirmation version is stale.'
      );
    const next = {
      ...value,
      status: 'WITHDRAWN' as const,
      version: value.version + 1,
      withdrawnAt: at,
      updatedAt: at
    };
    this.values.set(id, clone(next));
    return clone(next);
  }
}
type Row = Record<string, unknown>;
export class PostgresCustomerConfirmationRepository implements CustomerConfirmationRepository {
  constructor(private readonly database: QueryClient) {}
  async create(v: CustomerConfirmationRecord) {
    try {
      const r = await this.database.query(
        'INSERT INTO customer_confirmations (confirmation_id,workspace_id,source_quote_id,source_quote_version,status,version,snapshot_schema_version,source_snapshot,source_snapshot_hash,accepted_at,updated_at,withdrawn_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12) RETURNING *',
        [
          v.confirmationId,
          v.workspaceId,
          v.sourceQuoteId,
          v.sourceQuoteVersion,
          v.status,
          v.version,
          v.snapshotSchemaVersion,
          canonicalJson(v.sourceSnapshot),
          v.sourceSnapshotHash,
          v.acceptedAt,
          v.updatedAt,
          v.withdrawnAt
        ]
      );
      return this.map(r.rows[0] as Row);
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505')
        throw new CustomerConfirmationError(
          'CUSTOMER_CONFIRMATION_DUPLICATE',
          'This Quote version is already confirmed.'
        );
      throw unavailable(cause);
    }
  }
  async findById(workspaceId: string, id: string) {
    try {
      const r = await this.database.query(
        'SELECT * FROM customer_confirmations WHERE workspace_id=$1 AND confirmation_id=$2',
        [workspaceId, id]
      );
      return r.rowCount ? this.map(r.rows[0] as Row) : null;
    } catch (cause) {
      throw unavailable(cause);
    }
  }
  async findBySource(workspaceId: string, quoteId: string, quoteVersion: string) {
    try {
      const r = await this.database.query(
        'SELECT * FROM customer_confirmations WHERE workspace_id=$1 AND source_quote_id=$2 AND source_quote_version=$3',
        [workspaceId, quoteId, quoteVersion]
      );
      return r.rowCount ? this.map(r.rows[0] as Row) : null;
    } catch (cause) {
      throw unavailable(cause);
    }
  }
  async withdraw(workspaceId: string, id: string, expectedVersion: number, at: string) {
    try {
      const r = await this.database.query(
        "UPDATE customer_confirmations SET status='WITHDRAWN',version=version+1,withdrawn_at=$4,updated_at=$4 WHERE workspace_id=$1 AND confirmation_id=$2 AND version=$3 AND status='CONFIRMED' RETURNING *",
        [workspaceId, id, expectedVersion, at]
      );
      if (r.rowCount) return this.map(r.rows[0] as Row);
      const current = await this.findById(workspaceId, id);
      if (!current)
        throw new CustomerConfirmationError(
          'CUSTOMER_CONFIRMATION_NOT_FOUND',
          'Customer Confirmation was not found.'
        );
      if (current.status === 'WITHDRAWN')
        throw new CustomerConfirmationError(
          'CUSTOMER_CONFIRMATION_WITHDRAWN',
          'Customer Confirmation is withdrawn.'
        );
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_STALE_VERSION',
        'Customer Confirmation version is stale.'
      );
    } catch (cause) {
      if (cause instanceof CustomerConfirmationError) throw cause;
      throw unavailable(cause);
    }
  }
  private map(r: Row): CustomerConfirmationRecord {
    const snapshot = validateSnapshot(r.source_snapshot);
    const hash = String(r.source_snapshot_hash);
    if (hashSnapshot(snapshot) !== hash)
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_INVALID_SNAPSHOT',
        'Persisted Customer Confirmation snapshot hash is invalid.'
      );
    return {
      confirmationId: String(r.confirmation_id),
      workspaceId: String(r.workspace_id),
      sourceQuoteId: String(r.source_quote_id),
      sourceQuoteVersion: String(r.source_quote_version),
      status: r.status as CustomerConfirmationState,
      version: Number(r.version),
      snapshotSchemaVersion: 1,
      sourceSnapshot: snapshot,
      sourceSnapshotHash: hash,
      acceptedAt: new Date(r.accepted_at as string).toISOString(),
      updatedAt: new Date(r.updated_at as string).toISOString(),
      withdrawnAt: r.withdrawn_at ? new Date(r.withdrawn_at as string).toISOString() : null
    };
  }
}
function unavailable(cause: unknown) {
  if (cause instanceof CustomerConfirmationError) return cause;
  const wrapped = cause instanceof PersistenceError ? cause : undefined;
  return new CustomerConfirmationError(
    'PERSISTENCE_UNAVAILABLE',
    'Customer Confirmation persistence is unavailable.',
    { cause: wrapped }
  );
}
function authorize(principal: WorkspacePrincipal, workspaceId: string, permission: Permission) {
  if (principal.kind !== 'WORKSPACE')
    throw new CustomerConfirmationError(
      'AUTHENTICATION_REQUIRED',
      'A Workspace Principal is required.'
    );
  if (principal.workspaceId !== workspaceId)
    throw new CustomerConfirmationError(
      'CUSTOMER_CONFIRMATION_WORKSPACE_MISMATCH',
      'Workspace context does not match.'
    );
  if (!principal.permissions.includes(permission))
    throw new CustomerConfirmationError('PERMISSION_DENIED', 'Permission is required.');
}
export class CustomerConfirmationService {
  constructor(
    private readonly repository: CustomerConfirmationRepository,
    private readonly loadQuote: (id: string) => Promise<AcceptedQuoteSnapshot | null>,
    private readonly now = () => new Date().toISOString()
  ) {}
  async create(
    principal: WorkspacePrincipal,
    workspaceId: string,
    quoteId: string,
    quoteVersion: string
  ) {
    authorize(principal, workspaceId, 'matter:create');
    const source = await this.loadQuote(quoteId);
    if (!source)
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_SOURCE_NOT_FOUND',
        'Quote was not found.'
      );
    if (source.quoteVersion !== quoteVersion)
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_SOURCE_VERSION_MISMATCH',
        'The exact Quote version is required.'
      );
    const snapshot = validateSnapshot(source);
    const at = this.now();
    return this.repository.create({
      confirmationId: `confirmation_${randomUUID()}`,
      workspaceId,
      sourceQuoteId: quoteId,
      sourceQuoteVersion: quoteVersion,
      status: 'CONFIRMED',
      version: 1,
      snapshotSchemaVersion: 1,
      sourceSnapshot: snapshot,
      sourceSnapshotHash: hashSnapshot(snapshot),
      acceptedAt: at,
      updatedAt: at,
      withdrawnAt: null
    });
  }
  async get(principal: WorkspacePrincipal, workspaceId: string, id: string) {
    authorize(principal, workspaceId, 'matter:read');
    const value = await this.repository.findById(workspaceId, id);
    if (!value)
      throw new CustomerConfirmationError(
        'CUSTOMER_CONFIRMATION_NOT_FOUND',
        'Customer Confirmation was not found.'
      );
    return value;
  }
  withdraw(
    principal: WorkspacePrincipal,
    workspaceId: string,
    id: string,
    expectedVersion: number
  ) {
    authorize(principal, workspaceId, 'matter:manage');
    return this.repository.withdraw(workspaceId, id, expectedVersion, this.now());
  }
}
