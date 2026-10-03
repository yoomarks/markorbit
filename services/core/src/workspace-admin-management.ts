import { createHash } from 'node:crypto';
import type { Role, Workspace, WorkspaceMembership } from '@markorbit/contracts';
import type { ManagedDatabase, QueryClient } from '@markorbit/persistence';
import { uuidV7 } from './auth.js';

export const WORKSPACE_ADMIN_MANAGE_AUTHORITY = 'workspace-admin:manage' as const;
export const WORKSPACE_ADMIN_RENAME_ACTION = 'UPDATE_DISPLAY_NAME' as const;
export const WORKSPACE_ADMIN_GRANT_CURRENT_MEMBERSHIP_ACTION =
  'GRANT_CURRENT_OPERATOR_MEMBERSHIP' as const;

export type WorkspaceAdminRenameCommandV1 = Readonly<{
  workspaceId: string;
  expectedVersion: number;
  displayName: string;
  reason: string;
  idempotencyKey: string;
}>;

export type WorkspaceAdminActorV1 = Readonly<{
  userId: string;
  sessionId: string;
}>;

export type WorkspaceAdminGrantCurrentMembershipCommandV1 = Readonly<{
  workspaceId: string;
  role: Role;
  reason: string;
  idempotencyKey: string;
}>;

export type WorkspaceAdminManagementErrorCode =
  | 'INVALID_REQUEST'
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_ARCHIVED'
  | 'USER_NOT_FOUND'
  | 'USER_DISABLED'
  | 'MEMBERSHIP_CONFLICT'
  | 'STALE_VERSION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WORKSPACE_ADMIN_SOURCE_UNAVAILABLE';
export class WorkspaceAdminManagementError extends Error {
  constructor(
    public readonly code: WorkspaceAdminManagementErrorCode,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceAdminManagementError';
  }
}

type WorkspaceRow = {
  workspace_id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReplayRow = {
  request_fingerprint_sha256: string;
  result_workspace_json?: unknown;
  result_membership_json?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function fromRow(row: WorkspaceRow): Readonly<Workspace> {
  return Object.freeze({
    workspaceId: row.workspace_id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  });
}

function fromSnapshot(value: unknown): Readonly<Workspace> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkspaceAdminManagementError(
      'WORKSPACE_ADMIN_SOURCE_UNAVAILABLE',
      'Workspace Admin replay evidence is malformed.',
      503,
      true
    );
  const row = value as Partial<Workspace>;
  if (
    typeof row.workspaceId !== 'string' ||
    !UUID.test(row.workspaceId) ||
    typeof row.name !== 'string' ||
    !row.name.trim() ||
    typeof row.slug !== 'string' ||
    !row.slug ||
    (row.status !== 'ACTIVE' && row.status !== 'ARCHIVED') ||
    !Number.isSafeInteger(row.version) ||
    (row.version ?? 0) < 1 ||
    typeof row.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(row.createdAt)) ||
    typeof row.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(row.updatedAt))
  )
    throw new WorkspaceAdminManagementError(
      'WORKSPACE_ADMIN_SOURCE_UNAVAILABLE',
      'Workspace Admin replay evidence is malformed.',
      503,
      true
    );
  return Object.freeze(structuredClone(row as Workspace));
}

function membershipFromSnapshot(value: unknown): Readonly<WorkspaceMembership> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkspaceAdminManagementError(
      'WORKSPACE_ADMIN_SOURCE_UNAVAILABLE',
      'Workspace membership replay evidence is malformed.',
      503,
      true
    );
  const row = value as Partial<WorkspaceMembership>;
  if (
    typeof row.membershipId !== 'string' ||
    !UUID.test(row.membershipId) ||
    typeof row.workspaceId !== 'string' ||
    !UUID.test(row.workspaceId) ||
    typeof row.userId !== 'string' ||
    !UUID.test(row.userId) ||
    !['WORKSPACE_ADMIN', 'MATTER_MANAGER', 'REVIEWER', 'READ_ONLY'].includes(String(row.role)) ||
    (row.status !== 'ACTIVE' && row.status !== 'SUSPENDED') ||
    !Number.isSafeInteger(row.version) ||
    (row.version ?? 0) < 1 ||
    typeof row.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(row.createdAt)) ||
    typeof row.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(row.updatedAt))
  )
    throw new WorkspaceAdminManagementError(
      'WORKSPACE_ADMIN_SOURCE_UNAVAILABLE',
      'Workspace membership replay evidence is malformed.',
      503,
      true
    );
  return Object.freeze(structuredClone(row as WorkspaceMembership));
}

function normalizeCommand(input: WorkspaceAdminRenameCommandV1): WorkspaceAdminRenameCommandV1 {
  const displayName = input.displayName.trim();
  const reason = input.reason.trim();
  if (
    !UUID.test(input.workspaceId) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !displayName ||
    displayName.length > 200 ||
    !reason ||
    reason.length > 1000 ||
    !input.idempotencyKey ||
    input.idempotencyKey.trim() !== input.idempotencyKey ||
    input.idempotencyKey.length > 256
  )
    throw new WorkspaceAdminManagementError(
      'INVALID_REQUEST',
      'Workspace display-name command is invalid.',
      400
    );
  return Object.freeze({ ...input, displayName, reason });
}

function fingerprint(input: WorkspaceAdminRenameCommandV1): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: 1,
        action: WORKSPACE_ADMIN_RENAME_ACTION,
        workspaceId: input.workspaceId,
        expectedVersion: input.expectedVersion,
        displayName: input.displayName,
        reason: input.reason
      }),
      'utf8'
    )
    .digest('hex');
}

function normalizeGrantCommand(
  input: WorkspaceAdminGrantCurrentMembershipCommandV1
): WorkspaceAdminGrantCurrentMembershipCommandV1 {
  const reason = input.reason.trim();
  if (
    !UUID.test(input.workspaceId) ||
    !['WORKSPACE_ADMIN', 'MATTER_MANAGER', 'REVIEWER', 'READ_ONLY'].includes(input.role) ||
    !reason ||
    reason.length > 1000 ||
    !input.idempotencyKey ||
    input.idempotencyKey.trim() !== input.idempotencyKey ||
    input.idempotencyKey.length > 256
  )
    throw new WorkspaceAdminManagementError(
      'INVALID_REQUEST',
      'Workspace membership grant command is invalid.',
      400
    );
  return Object.freeze({ ...input, reason });
}

function grantFingerprint(
  input: WorkspaceAdminGrantCurrentMembershipCommandV1,
  targetUserId: string
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: 1,
        action: WORKSPACE_ADMIN_GRANT_CURRENT_MEMBERSHIP_ACTION,
        workspaceId: input.workspaceId,
        targetUserId,
        role: input.role,
        reason: input.reason
      }),
      'utf8'
    )
    .digest('hex');
}

async function lock(
  client: QueryClient,
  actorUserId: string,
  idempotencyKey: string
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `core-workspace-admin:${actorUserId}:${idempotencyKey}`
  ]);
}
async function replay(
  client: QueryClient,
  actorUserId: string,
  idempotencyKey: string
): Promise<ReplayRow | undefined> {
  const result = await client.query<ReplayRow>(
    `SELECT request_fingerprint_sha256,result_workspace_json,result_membership_json
       FROM core_workspace_admin_actions
      WHERE actor_user_id=$1 AND idempotency_key=$2`,
    [actorUserId, idempotencyKey]
  );
  return result.rows[0];
}

function sourceUnavailable(error: unknown): never {
  if (error instanceof WorkspaceAdminManagementError) throw error;
  throw new WorkspaceAdminManagementError(
    'WORKSPACE_ADMIN_SOURCE_UNAVAILABLE',
    'Workspace Admin management persistence is unavailable.',
    503,
    true,
    { cause: error instanceof Error ? error : undefined }
  );
}

export class PostgresWorkspaceAdminManagementServiceV1 {
  constructor(private readonly database: ManagedDatabase) {}

  async renameDisplayName(
    raw: WorkspaceAdminRenameCommandV1,
    actor: WorkspaceAdminActorV1,
    correlationId?: string
  ): Promise<Readonly<Workspace>> {
    const input = normalizeCommand(raw);
    if (!UUID.test(actor.userId) || !actor.sessionId || actor.sessionId.length > 256)
      throw new WorkspaceAdminManagementError(
        'INVALID_REQUEST',
        'Workspace Admin actor is invalid.',
        400
      );
    if (
      correlationId !== undefined &&
      (!correlationId || correlationId.trim() !== correlationId || correlationId.length > 256)
    )
      throw new WorkspaceAdminManagementError('INVALID_REQUEST', 'Correlation id is invalid.', 400);
    const requestFingerprint = fingerprint(input);

    try {
      return await this.database.transact(async (client) => {
        await lock(client, actor.userId, input.idempotencyKey);
        const existing = await replay(client, actor.userId, input.idempotencyKey);
        if (existing) {
          if (existing.request_fingerprint_sha256 !== requestFingerprint)
            throw new WorkspaceAdminManagementError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key is already bound to a different Workspace Admin command.',
              409
            );
          return fromSnapshot(existing.result_workspace_json);
        }
        const currentResult = await client.query<WorkspaceRow>(
          `SELECT workspace_id,name,slug,status,version,created_at,updated_at
             FROM workspaces
            WHERE workspace_id=$1
            FOR UPDATE`,
          [input.workspaceId]
        );
        const currentRow = currentResult.rows[0];
        if (!currentRow)
          throw new WorkspaceAdminManagementError(
            'WORKSPACE_NOT_FOUND',
            'Workspace was not found.',
            404
          );
        if (currentRow.status !== 'ACTIVE')
          throw new WorkspaceAdminManagementError(
            'WORKSPACE_ARCHIVED',
            'Archived Workspace display name cannot be changed by this V1 command.',
            409
          );
        if (currentRow.version !== input.expectedVersion)
          throw new WorkspaceAdminManagementError(
            'STALE_VERSION',
            'Expected Workspace version is stale.',
            409
          );

        const updatedResult = await client.query<WorkspaceRow>(
          `UPDATE workspaces
              SET name=$2,version=version+1,updated_at=now()
            WHERE workspace_id=$1 AND version=$3 AND status='ACTIVE'
        RETURNING workspace_id,name,slug,status,version,created_at,updated_at`,
          [input.workspaceId, input.displayName, input.expectedVersion]
        );
        const updatedRow = updatedResult.rows[0];
        if (!updatedRow)
          throw new WorkspaceAdminManagementError(
            'WORKSPACE_ADMIN_SOURCE_UNAVAILABLE',
            'Workspace Admin mutation did not return owner state.',
            503,
            true
          );
        const updated = fromRow(updatedRow);
        const createdAt = new Date().toISOString();
        const auditId = uuidV7();

        await client.query(
          `INSERT INTO core_workspace_admin_actions(
             audit_id,action,actor_user_id,actor_session_id,workspace_id,
             expected_workspace_version,resulting_workspace_version,reason,idempotency_key,
             request_fingerprint_sha256,correlation_id,result,result_workspace_json,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SUCCEEDED',$12::jsonb,$13)`,
          [
            auditId,
            WORKSPACE_ADMIN_RENAME_ACTION,
            actor.userId,
            actor.sessionId,
            input.workspaceId,
            input.expectedVersion,
            updated.version,
            input.reason,
            input.idempotencyKey,
            requestFingerprint,
            correlationId ?? null,
            JSON.stringify(updated),
            createdAt
          ]
        );
        return updated;
      });
    } catch (error) {
      return sourceUnavailable(error);
    }
  }

  async grantCurrentOperatorMembership(
    raw: WorkspaceAdminGrantCurrentMembershipCommandV1,
    actor: WorkspaceAdminActorV1,
    correlationId?: string
  ): Promise<Readonly<WorkspaceMembership>> {
    const input = normalizeGrantCommand(raw);
    if (!UUID.test(actor.userId) || !actor.sessionId || actor.sessionId.length > 256)
      throw new WorkspaceAdminManagementError(
        'INVALID_REQUEST',
        'Workspace Admin actor is invalid.',
        400
      );
    if (
      correlationId !== undefined &&
      (!correlationId || correlationId.trim() !== correlationId || correlationId.length > 256)
    )
      throw new WorkspaceAdminManagementError('INVALID_REQUEST', 'Correlation id is invalid.', 400);
    const requestFingerprint = grantFingerprint(input, actor.userId);

    try {
      return await this.database.transact(async (client) => {
        await lock(client, actor.userId, input.idempotencyKey);
        const existingReplay = await replay(client, actor.userId, input.idempotencyKey);
        if (existingReplay) {
          if (existingReplay.request_fingerprint_sha256 !== requestFingerprint)
            throw new WorkspaceAdminManagementError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key is already bound to a different Workspace Admin command.',
              409
            );
          return membershipFromSnapshot(existingReplay.result_membership_json);
        }

        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `core-workspace-membership:${input.workspaceId}:${actor.userId}`
        ]);
        const workspace = await client.query<{ status: 'ACTIVE' | 'ARCHIVED' }>(
          'SELECT status FROM workspaces WHERE workspace_id=$1 FOR UPDATE',
          [input.workspaceId]
        );
        if (!workspace.rows[0])
          throw new WorkspaceAdminManagementError(
            'WORKSPACE_NOT_FOUND',
            'Workspace was not found.',
            404
          );
        if (workspace.rows[0].status !== 'ACTIVE')
          throw new WorkspaceAdminManagementError(
            'WORKSPACE_ARCHIVED',
            'Archived Workspace membership cannot be granted.',
            409
          );
        const user = await client.query<{ status: 'ACTIVE' | 'DISABLED' }>(
          'SELECT status FROM users WHERE user_id=$1 FOR UPDATE',
          [actor.userId]
        );
        if (!user.rows[0])
          throw new WorkspaceAdminManagementError('USER_NOT_FOUND', 'User was not found.', 404);
        if (user.rows[0].status !== 'ACTIVE')
          throw new WorkspaceAdminManagementError('USER_DISABLED', 'User is disabled.', 409);

        const current = await client.query<{
          membership_id: string;
          workspace_id: string;
          user_id: string;
          role: Role;
          status: 'ACTIVE' | 'SUSPENDED';
          version: number;
          created_at: Date | string;
          updated_at: Date | string;
        }>(
          `SELECT membership_id,workspace_id,user_id,role,status,version,created_at,updated_at
             FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2`,
          [input.workspaceId, actor.userId]
        );
        const currentRow = current.rows[0];
        if (currentRow && (currentRow.status !== 'ACTIVE' || currentRow.role !== input.role))
          throw new WorkspaceAdminManagementError(
            'MEMBERSHIP_CONFLICT',
            'An incompatible Workspace membership already exists.',
            409
          );

        const membership = currentRow
          ? membershipFromSnapshot({
              membershipId: currentRow.membership_id,
              workspaceId: currentRow.workspace_id,
              userId: currentRow.user_id,
              role: currentRow.role,
              status: currentRow.status,
              version: currentRow.version,
              createdAt: iso(currentRow.created_at),
              updatedAt: iso(currentRow.updated_at)
            })
          : membershipFromSnapshot(
              (
                await client.query<{
                  membership_id: string;
                  workspace_id: string;
                  user_id: string;
                  role: Role;
                  status: 'ACTIVE';
                  version: number;
                  created_at: Date | string;
                  updated_at: Date | string;
                }>(
                  `INSERT INTO workspace_memberships(membership_id,workspace_id,user_id,role)
                   VALUES($1,$2,$3,$4)
                   RETURNING membership_id,workspace_id,user_id,role,status,version,created_at,updated_at`,
                  [uuidV7(), input.workspaceId, actor.userId, input.role]
                )
              ).rows.map((row) => ({
                membershipId: row.membership_id,
                workspaceId: row.workspace_id,
                userId: row.user_id,
                role: row.role,
                status: row.status,
                version: row.version,
                createdAt: iso(row.created_at),
                updatedAt: iso(row.updated_at)
              }))[0]
            );

        await client.query(
          `INSERT INTO core_workspace_admin_actions(
             audit_id,action,actor_user_id,actor_session_id,workspace_id,target_user_id,
             granted_role,reason,idempotency_key,request_fingerprint_sha256,correlation_id,
             result,result_membership_json,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SUCCEEDED',$12::jsonb,$13)`,
          [
            uuidV7(),
            WORKSPACE_ADMIN_GRANT_CURRENT_MEMBERSHIP_ACTION,
            actor.userId,
            actor.sessionId,
            input.workspaceId,
            actor.userId,
            input.role,
            input.reason,
            input.idempotencyKey,
            requestFingerprint,
            correlationId ?? null,
            JSON.stringify(membership),
            new Date().toISOString()
          ]
        );
        return membership;
      });
    } catch (error) {
      return sourceUnavailable(error);
    }
  }
}
