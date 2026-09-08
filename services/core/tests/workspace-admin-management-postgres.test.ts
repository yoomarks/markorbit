import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresUserRepository, PostgresWorkspaceRepository } from '../src/identity.js';
import { PostgresWorkspaceAdminManagementServiceV1 } from '../src/workspace-admin-management.js';

const url = process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.AUTH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('AUTH_POSTGRES_TEST_REQUIRED=1 requires AUTH_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
let database: ManagedDatabase;
const migrations = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_workspace_admin_actions',
    DB_APPLICATION_NAME: 'markorbit-core-workspace-admin-tests'
  });
const coreMigrations = () =>
  loadMigrationsForOwner(migrations, migrationOwners, '@markorbit/core-service');

const ids = {
  actor: '018f0000-0000-7000-8000-000000000973',
  workspace: '018f0000-0000-7000-8000-000000000974'
};
const actor = { userId: ids.actor, sessionId: 'session-973-manage' } as const;
type AuditRow = {
  action: string;
  actor_user_id: string;
  actor_session_id: string;
  workspace_id: string;
  expected_workspace_version: number;
  resulting_workspace_version: number;
  reason: string;
  idempotency_key: string;
  correlation_id: string | null;
  result: string;
  result_workspace_json: unknown;
};
const command = (
  overrides: Partial<
    Parameters<PostgresWorkspaceAdminManagementServiceV1['renameDisplayName']>[0]
  > = {}
) => ({
  workspaceId: ids.workspace,
  expectedVersion: 1,
  displayName: 'Renamed Workspace',
  reason: 'Correct the Workspace display name.',
  idempotencyKey: 'workspace-rename-973-1',
  ...overrides
});

async function reset() {
  await database
    .getPool()
    .query('TRUNCATE core_workspace_admin_actions,workspace_memberships,workspaces,users CASCADE');
  const users = new PostgresUserRepository(database.getPool());
  const workspaces = new PostgresWorkspaceRepository(database.getPool());
  await users.create({
    userId: ids.actor,
    email: 'admin973@example.com',
    displayName: 'Admin 973'
  });
  await workspaces.create({
    workspaceId: ids.workspace,
    name: 'Original Workspace',
    slug: 'original-workspace-973'
  });
}

integration('PostgreSQL Workspace Admin management durability', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS core_workspace_admin_actions,core_governed_human_action_receipts,knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,password_credentials,account_profiles,sessions,workspace_memberships,workspaces,users CASCADE; DROP FUNCTION IF EXISTS reject_core_workspace_admin_action_mutation() CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_workspace_admin_actions', await coreMigrations());
  });
  afterAll(async () => database.close());

  it('renames only the Core-owned display name and persists durable audit lineage', async () => {
    await reset();
    const service = new PostgresWorkspaceAdminManagementServiceV1(database);
    const updated = await service.renameDisplayName(command(), actor, 'corr-973-1');

    expect(updated).toMatchObject({
      workspaceId: ids.workspace,
      name: 'Renamed Workspace',
      slug: 'original-workspace-973',
      status: 'ACTIVE',
      version: 2
    });
    const audit = await database.getPool().query<AuditRow>(
      `SELECT action,actor_user_id,actor_session_id,workspace_id,expected_workspace_version,
              resulting_workspace_version,reason,idempotency_key,correlation_id,result,result_workspace_json
         FROM core_workspace_admin_actions`
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      action: 'UPDATE_DISPLAY_NAME',
      actor_user_id: ids.actor,
      actor_session_id: actor.sessionId,
      workspace_id: ids.workspace,
      expected_workspace_version: 1,
      resulting_workspace_version: 2,
      reason: 'Correct the Workspace display name.',
      idempotency_key: 'workspace-rename-973-1',
      correlation_id: 'corr-973-1',
      result: 'SUCCEEDED'
    });
    expect(audit.rows[0]!.result_workspace_json).toMatchObject({
      name: 'Renamed Workspace',
      slug: 'original-workspace-973',
      version: 2
    });
  });

  it('replays the exact successful result without a second mutation', async () => {
    await reset();
    const service = new PostgresWorkspaceAdminManagementServiceV1(database);
    const first = await service.renameDisplayName(command(), actor, 'corr-973-1');
    const replayed = await service.renameDisplayName(command(), actor, 'corr-973-ignored');

    expect(replayed).toEqual(first);
    expect(
      (
        await database
          .getPool()
          .query('SELECT count(*)::int AS count FROM core_workspace_admin_actions')
      ).rows[0]
    ).toEqual({ count: 1 });
    expect(
      (
        await database
          .getPool()
          .query('SELECT name,slug,version FROM workspaces WHERE workspace_id=$1', [ids.workspace])
      ).rows[0]
    ).toEqual({
      name: 'Renamed Workspace',
      slug: 'original-workspace-973',
      version: 2
    });
  });

  it('binds an idempotency key to one exact command fingerprint', async () => {
    await reset();
    const service = new PostgresWorkspaceAdminManagementServiceV1(database);
    await service.renameDisplayName(command(), actor);
    await expect(
      service.renameDisplayName(command({ displayName: 'Different Name' }), actor)
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
  });

  it('fails closed on stale version and archived Workspace', async () => {
    await reset();
    const service = new PostgresWorkspaceAdminManagementServiceV1(database);
    await expect(
      service.renameDisplayName(command({ expectedVersion: 2, idempotencyKey: 'stale-973' }), actor)
    ).rejects.toMatchObject({ code: 'STALE_VERSION', status: 409 });

    await database
      .getPool()
      .query("UPDATE workspaces SET status='ARCHIVED',version=2 WHERE workspace_id=$1", [
        ids.workspace
      ]);
    await expect(
      service.renameDisplayName(
        command({ expectedVersion: 2, idempotencyKey: 'archived-973' }),
        actor
      )
    ).rejects.toMatchObject({ code: 'WORKSPACE_ARCHIVED', status: 409 });
    expect(
      (
        await database
          .getPool()
          .query('SELECT count(*)::int AS count FROM core_workspace_admin_actions')
      ).rows[0]
    ).toEqual({ count: 0 });
  });

  it('keeps audit evidence append-only at the database boundary', async () => {
    await reset();
    const service = new PostgresWorkspaceAdminManagementServiceV1(database);
    await service.renameDisplayName(command(), actor);

    await expect(
      database.getPool().query("UPDATE core_workspace_admin_actions SET reason='tampered'")
    ).rejects.toThrow(/append-only/i);
    await expect(
      database.getPool().query('DELETE FROM core_workspace_admin_actions')
    ).rejects.toThrow(/append-only/i);
  });

  it('reconstructs the exact replay after database reconnect', async () => {
    await reset();
    const firstService = new PostgresWorkspaceAdminManagementServiceV1(database);
    const first = await firstService.renameDisplayName(command(), actor, 'corr-before-restart');

    await database.close();
    database = new ManagedDatabase(config());
    await database.start();

    const restartedService = new PostgresWorkspaceAdminManagementServiceV1(database);
    await expect(
      restartedService.renameDisplayName(command(), actor, 'corr-after-restart')
    ).resolves.toEqual(first);
  });
});
