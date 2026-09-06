import { createHash, randomUUID } from 'node:crypto';
import { relationshipModels, type RelationshipModel } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CustomerRelationshipId = `customer-relationship_${string}`;
export type CustomerRelationshipStatus = 'ACTIVE' | 'ARCHIVED';
export type CustomerRelationshipIdentityStatus = 'UNVERIFIED';
export type CustomerRelationshipOrigin = 'WORKSPACE_EXPLICIT';
export type CustomerRelationshipCurrentness = 'CURRENT' | 'INACTIVE';

export interface CustomerRelationshipRecord {
  schemaVersion: 1;
  customerRelationshipId: CustomerRelationshipId;
  workspaceId: string;
  displayName: string;
  relationshipModel: RelationshipModel;
  identityStatus: CustomerRelationshipIdentityStatus;
  origin: CustomerRelationshipOrigin;
  status: CustomerRelationshipStatus;
  version: number;
  source: Readonly<{
    owner: 'MARKREG';
    kind: 'CUSTOMER_RELATIONSHIP';
    referenceId: CustomerRelationshipId;
    referenceVersion: number;
    currentness: CustomerRelationshipCurrentness;
  }>;
  createdByPrincipalId: string;
  updatedByPrincipalId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface CreateCustomerRelationshipCommand {
  workspaceId: string;
  displayName: string;
  relationshipModel: RelationshipModel;
  principalId: string;
  idempotencyKey: string;
}

export interface UpdateCustomerRelationshipCommand {
  workspaceId: string;
  customerRelationshipId: CustomerRelationshipId;
  expectedVersion: number;
  displayName?: string;
  relationshipModel?: RelationshipModel;
  principalId: string;
}

export interface CustomerRelationshipListQuery {
  status?: CustomerRelationshipStatus;
  page: number;
  pageSize: number;
}
export interface CustomerRelationshipListResult {
  items: readonly CustomerRelationshipRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export type CustomerRelationshipErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'RELATIONSHIP_INACTIVE'
  | 'PERSISTENCE_UNAVAILABLE';

export class CustomerRelationshipError extends Error {
  constructor(
    readonly code: CustomerRelationshipErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CustomerRelationshipError';
  }
}

type Row = Record<string, unknown>;
type CommandRow = Readonly<{
  request_fingerprint_sha256: string;
  customer_relationship_id: string;
}>;
function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new CustomerRelationshipError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned) throw new CustomerRelationshipError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new CustomerRelationshipError(
      'INVALID_INPUT',
      `${field} exceeds the allowed length.`,
      422
    );
  return cleaned;
}

function cleanRelationshipModel(value: RelationshipModel): RelationshipModel {
  if (!relationshipModels.includes(value))
    throw new CustomerRelationshipError('INVALID_INPUT', 'relationshipModel is invalid.', 422);
  return value;
}
function exactVersion(value: number): number {
  if (!Number.isInteger(value) || value < 1)
    throw new CustomerRelationshipError(
      'INVALID_INPUT',
      'expectedVersion must be a positive integer.',
      422
    );
  return value;
}

function exactPage(value: number, field: 'page' | 'pageSize', maximum: number): number {
  if (!Number.isInteger(value) || value < 1 || value > maximum)
    throw new CustomerRelationshipError(
      'INVALID_INPUT',
      `${field} is outside the allowed range.`,
      422
    );
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function nextRelationshipId(): CustomerRelationshipId {
  return `customer-relationship_${randomUUID()}`;
}

function currentness(status: CustomerRelationshipStatus): CustomerRelationshipCurrentness {
  return status === 'ACTIVE' ? 'CURRENT' : 'INACTIVE';
}
function mapRecord(row: Row): CustomerRelationshipRecord {
  const status = row.status as CustomerRelationshipStatus;
  const id = String(row.customer_relationship_id) as CustomerRelationshipId;
  const version = Number(row.version);
  return {
    schemaVersion: 1,
    customerRelationshipId: id,
    workspaceId: String(row.workspace_id),
    displayName: String(row.display_name),
    relationshipModel: row.relationship_model as RelationshipModel,
    identityStatus: 'UNVERIFIED',
    origin: 'WORKSPACE_EXPLICIT',
    status,
    version,
    source: Object.freeze({
      owner: 'MARKREG',
      kind: 'CUSTOMER_RELATIONSHIP',
      referenceId: id,
      referenceVersion: version,
      currentness: currentness(status)
    }),
    createdByPrincipalId: String(row.created_by_principal_id),
    updatedByPrincipalId: String(row.updated_by_principal_id),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    archivedAt: row.archived_at ? new Date(row.archived_at as string).toISOString() : null
  };
}
export interface CustomerRelationshipTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

function unavailable(cause: unknown): CustomerRelationshipError {
  if (cause instanceof CustomerRelationshipError) return cause;
  return new CustomerRelationshipError(
    'PERSISTENCE_UNAVAILABLE',
    'Customer Relationship persistence is unavailable.',
    503,
    { cause: cause instanceof Error ? cause : undefined }
  );
}

export class PostgresCustomerRelationshipStore {
  constructor(
    private readonly database: CustomerRelationshipTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly relationshipId: () => CustomerRelationshipId = nextRelationshipId
  ) {}

  async create(
    command: Readonly<CreateCustomerRelationshipCommand>
  ): Promise<CustomerRelationshipRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const displayName = cleanText(command.displayName, 'displayName', 240);
    const relationshipModel = cleanRelationshipModel(command.relationshipModel);
    const principalId = cleanText(command.principalId, 'principalId', 300);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      displayName,
      relationshipModel,
      principalId
    });
    try {
      const prior = await this.findCommand(workspaceId, idempotencyKey);
      if (prior) return this.replay(prior, requestFingerprintSha256, workspaceId);
      return await this.database.transact(async (client) => {
        const id = this.relationshipId();
        const at = this.now();
        const inserted = await client.query<Row>(
          `INSERT INTO markreg_customer_relationships(
             workspace_id,customer_relationship_id,display_name,relationship_model,
             identity_status,origin,status,version,created_by_principal_id,
             updated_by_principal_id,created_at,updated_at,archived_at
           ) VALUES ($1,$2,$3,$4,'UNVERIFIED','WORKSPACE_EXPLICIT','ACTIVE',1,$5,$5,$6,$6,NULL)
           RETURNING *`,
          [workspaceId, id, displayName, relationshipModel, principalId, at]
        );
        await client.query(
          `INSERT INTO markreg_customer_relationship_commands(
             workspace_id,idempotency_key,request_fingerprint_sha256,command_type,
             customer_relationship_id,result_version,created_at
           ) VALUES ($1,$2,$3,'CREATE',$4,1,$5)`,
          [workspaceId, idempotencyKey, requestFingerprintSha256, id, at]
        );
        return mapRecord(inserted.rows[0]!);
      });
    } catch (cause) {
      if ((cause as { code?: string }).code === '23505') {
        const prior = await this.findCommand(workspaceId, idempotencyKey);
        if (prior) return this.replay(prior, requestFingerprintSha256, workspaceId);
      }
      throw unavailable(cause);
    }
  }
  async get(
    workspaceIdInput: string,
    customerRelationshipId: CustomerRelationshipId
  ): Promise<CustomerRelationshipRecord> {
    const workspaceId = cleanWorkspaceId(workspaceIdInput);
    try {
      const result = await this.query.query<Row>(
        `SELECT * FROM markreg_customer_relationships
         WHERE workspace_id=$1 AND customer_relationship_id=$2`,
        [workspaceId, customerRelationshipId]
      );
      if (!result.rows[0])
        throw new CustomerRelationshipError(
          'NOT_FOUND',
          'Customer Relationship was not found.',
          404
        );
      return mapRecord(result.rows[0]);
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async list(
    workspaceIdInput: string,
    query: Readonly<CustomerRelationshipListQuery>
  ): Promise<CustomerRelationshipListResult> {
    const workspaceId = cleanWorkspaceId(workspaceIdInput);
    const page = exactPage(query.page, 'page', 1000000);
    const pageSize = exactPage(query.pageSize, 'pageSize', 100);
    const status = query.status;
    if (status !== undefined && status !== 'ACTIVE' && status !== 'ARCHIVED')
      throw new CustomerRelationshipError('INVALID_INPUT', 'status is invalid.', 422);
    const values: unknown[] = [workspaceId];
    const where = ['workspace_id=$1'];
    if (status) {
      values.push(status);
      where.push(`status=$${values.length}`);
    }
    try {
      const count = await this.query.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM markreg_customer_relationships WHERE ${where.join(' AND ')}`,
        values
      );
      values.push(pageSize, (page - 1) * pageSize);
      const rows = await this.query.query<Row>(
        `SELECT * FROM markreg_customer_relationships
         WHERE ${where.join(' AND ')}
         ORDER BY updated_at DESC, customer_relationship_id ASC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
      return {
        items: rows.rows.map(mapRecord),
        page,
        pageSize,
        total: Number(count.rows[0]?.total ?? 0)
      };
    } catch (cause) {
      throw unavailable(cause);
    }
  }
  async update(
    command: Readonly<UpdateCustomerRelationshipCommand>
  ): Promise<CustomerRelationshipRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const expectedVersion = exactVersion(command.expectedVersion);
    const principalId = cleanText(command.principalId, 'principalId', 300);
    if (command.displayName === undefined && command.relationshipModel === undefined)
      throw new CustomerRelationshipError(
        'INVALID_INPUT',
        'At least one relationship-owned field must be updated.',
        422
      );
    const displayName =
      command.displayName === undefined
        ? undefined
        : cleanText(command.displayName, 'displayName', 240);
    const relationshipModel =
      command.relationshipModel === undefined
        ? undefined
        : cleanRelationshipModel(command.relationshipModel);
    const at = this.now();
    try {
      const result = await this.query.query<Row>(
        `UPDATE markreg_customer_relationships
         SET display_name=COALESCE($4,display_name),
             relationship_model=COALESCE($5,relationship_model),
             version=version+1,updated_by_principal_id=$6,updated_at=$7
         WHERE workspace_id=$1 AND customer_relationship_id=$2 AND version=$3 AND status='ACTIVE'
         RETURNING *`,
        [
          workspaceId,
          command.customerRelationshipId,
          expectedVersion,
          displayName ?? null,
          relationshipModel ?? null,
          principalId,
          at
        ]
      );
      if (result.rows[0]) return mapRecord(result.rows[0]);
      return await this.throwMutationConflict(
        workspaceId,
        command.customerRelationshipId,
        expectedVersion
      );
    } catch (cause) {
      throw unavailable(cause);
    }
  }
  async archive(
    workspaceIdInput: string,
    customerRelationshipId: CustomerRelationshipId,
    expectedVersionInput: number,
    principalIdInput: string
  ): Promise<CustomerRelationshipRecord> {
    const workspaceId = cleanWorkspaceId(workspaceIdInput);
    const expectedVersion = exactVersion(expectedVersionInput);
    const principalId = cleanText(principalIdInput, 'principalId', 300);
    const at = this.now();
    try {
      const result = await this.query.query<Row>(
        `UPDATE markreg_customer_relationships
         SET status='ARCHIVED',version=version+1,updated_by_principal_id=$4,
             updated_at=$5,archived_at=$5
         WHERE workspace_id=$1 AND customer_relationship_id=$2 AND version=$3 AND status='ACTIVE'
         RETURNING *`,
        [workspaceId, customerRelationshipId, expectedVersion, principalId, at]
      );
      if (result.rows[0]) return mapRecord(result.rows[0]);
      return await this.throwMutationConflict(workspaceId, customerRelationshipId, expectedVersion);
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  private async findCommand(
    workspaceId: string,
    idempotencyKey: string
  ): Promise<CommandRow | undefined> {
    const result = await this.query.query<CommandRow>(
      `SELECT request_fingerprint_sha256,customer_relationship_id
       FROM markreg_customer_relationship_commands
       WHERE workspace_id=$1 AND idempotency_key=$2`,
      [workspaceId, idempotencyKey]
    );
    return result.rows[0];
  }
  private async replay(
    prior: CommandRow,
    requestFingerprintSha256: string,
    workspaceId: string
  ): Promise<CustomerRelationshipRecord> {
    if (prior.request_fingerprint_sha256 !== requestFingerprintSha256)
      throw new CustomerRelationshipError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used with different relationship input.',
        409
      );
    return this.get(workspaceId, prior.customer_relationship_id as CustomerRelationshipId);
  }

  private async throwMutationConflict(
    workspaceId: string,
    customerRelationshipId: CustomerRelationshipId,
    expectedVersion: number
  ): Promise<never> {
    const current = await this.query.query<Row>(
      `SELECT * FROM markreg_customer_relationships
       WHERE workspace_id=$1 AND customer_relationship_id=$2`,
      [workspaceId, customerRelationshipId]
    );
    if (!current.rows[0])
      throw new CustomerRelationshipError('NOT_FOUND', 'Customer Relationship was not found.', 404);
    const record = mapRecord(current.rows[0]);
    if (record.status === 'ARCHIVED')
      throw new CustomerRelationshipError(
        'RELATIONSHIP_INACTIVE',
        'Customer Relationship is archived and cannot be mutated.',
        409
      );
    throw new CustomerRelationshipError(
      'VERSION_CONFLICT',
      `Customer Relationship version is ${record.version}, not ${expectedVersion}.`,
      409
    );
  }
}
