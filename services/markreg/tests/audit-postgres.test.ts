import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, verifyMigrations } from '@markorbit/persistence';
import { PostgresMarkRegAuditRepository } from '../src/audit.js';
import type { MarkRegAuditError } from '../src/audit.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_AUDIT_POSTGRES_REQUIRED === '1';
if (required && !url) throw new Error('MARKREG_TEST_DATABASE_URL is required in audit mode.');
const suite = url ? describe : describe.skip;
const workspaceId = '25252525-2525-4252-8252-252525252525';
const otherWorkspaceId = '26262626-2626-4262-8262-262626262626';
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const at = (second: number) => `2026-08-01T12:00:${String(second).padStart(2, '0')}.000Z`;

suite('TASK 025A MarkReg audit PostgreSQL required mode', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'task025a-audit',
    poolMaximum: 6,
    connectionTimeoutMs: 1000,
    idleTimeoutMs: 1000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const input = (workspace = workspaceId, second = 1) => ({
    workspaceId: workspace,
    actorId: 'user_task025a',
    actorMembershipId: 'membership_task025a',
    operation: 'FORMAL_MATTER_CREATE' as const,
    targetType: 'FORMAL_MATTER' as const,
    targetId: 'formal-matter_task025a',
    reasonCode: 'IDEMPOTENCY_KEY_REUSE' as const,
    correlationId: 'correlation_task025a',
    idempotencyKeySha256: 'a'.repeat(64),
    sourceCommandFingerprint: 'b'.repeat(64),
    occurredAt: at(second)
  });
  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });
  beforeEach(async () => {
    await database.getPool().query('TRUNCATE markreg_denial_audit RESTART IDENTITY');
  });
  afterAll(() => database.close());

  it('owns migration 0025 and verifies its checksum', async () => {
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/markreg-service'
    );
    expect(migrations.find((migration) => migration.version === '0025')).toMatchObject({
      version: '0025',
      name: 'markreg_audit_hardening'
    });
    await expect(
      verifyMigrations(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, migrations)
    ).resolves.toBeUndefined();
  });

  it('appends, reloads, clones immutably, and stores only bounded hashes', async () => {
    const repository = new PostgresMarkRegAuditRepository(database.getPool());
    const appended = await repository.appendDenial(input());
    expect(Object.isFrozen(appended)).toBe(true);
    const page = await repository.list(workspaceId);
    expect(page.records).toEqual([appended]);
    expect(Object.isFrozen(page.records[0])).toBe(true);
    const stored = await database.getPool().query('SELECT * FROM markreg_denial_audit');
    expect(stored.rows[0]).toMatchObject({
      decision: 'DENIED',
      owner_service: 'MARKREG',
      idempotency_key_sha256: 'a'.repeat(64),
      source_command_fingerprint: 'b'.repeat(64)
    });
    expect(JSON.stringify(stored.rows[0])).not.toContain('raw-key');
  });

  it('rejects UPDATE and DELETE at the database boundary', async () => {
    const repository = new PostgresMarkRegAuditRepository(database.getPool());
    await repository.appendDenial(input());
    await expect(
      database.getPool().query("UPDATE markreg_denial_audit SET actor_id='rewritten'")
    ).rejects.toMatchObject({ code: '55000' });
    await expect(
      database.getPool().query('DELETE FROM markreg_denial_audit')
    ).rejects.toMatchObject({ code: '55000' });
    expect((await repository.list(workspaceId)).records).toHaveLength(1);
  });

  it('isolates Workspaces and filters typed reasons', async () => {
    const repository = new PostgresMarkRegAuditRepository(database.getPool());
    await repository.appendDenial(input(workspaceId));
    await repository.appendDenial({ ...input(otherWorkspaceId), reasonCode: 'STALE_VERSION' });
    expect((await repository.list(workspaceId)).records).toHaveLength(1);
    expect(
      (await repository.list(otherWorkspaceId, { reasonCode: 'STALE_VERSION' })).records
    ).toHaveLength(1);
    expect(
      (await repository.list(workspaceId, { reasonCode: 'STALE_VERSION' })).records
    ).toHaveLength(0);
  });

  it('paginates deterministically without duplicates or gaps', async () => {
    const repository = new PostgresMarkRegAuditRepository(database.getPool());
    for (let second = 1; second <= 5; second++)
      await repository.appendDenial({
        ...input(workspaceId, second),
        targetId: `matter_${second}`
      });
    const first = await repository.list(workspaceId, { limit: 2 });
    const second = await repository.list(workspaceId, { limit: 2, cursor: first.nextCursor! });
    const third = await repository.list(workspaceId, { limit: 2, cursor: second.nextCursor! });
    const ids = [...first.records, ...second.records, ...third.records].map((x) => x.auditId);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect([...first.records, ...second.records, ...third.records].map((x) => x.targetId)).toEqual([
      'matter_5',
      'matter_4',
      'matter_3',
      'matter_2',
      'matter_1'
    ]);
  });

  it('rejects invalid filters and maps database unavailability without driver leakage', async () => {
    const repository = new PostgresMarkRegAuditRepository(database.getPool());
    await expect(repository.list(workspaceId, { limit: 101 })).rejects.toMatchObject({
      code: 'INVALID_AUDIT_QUERY'
    });
    const unavailable = new PostgresMarkRegAuditRepository({
      query: () => Promise.reject(new Error('secret driver detail'))
    });
    await expect(unavailable.list(workspaceId)).rejects.toEqual(
      expect.objectContaining({
        code: 'PERSISTENCE_UNAVAILABLE',
        message: 'MarkReg audit persistence is unavailable.'
      })
    );
    await unavailable
      .list(workspaceId)
      .catch((error: MarkRegAuditError) =>
        expect(error.message).not.toContain('secret driver detail')
      );
  });

  it('reloads exact evidence through a fresh PostgreSQL pool', async () => {
    await new PostgresMarkRegAuditRepository(database.getPool()).appendDenial(input());
    const replacement = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'task025a-audit-reconnect',
      poolMaximum: 2,
      connectionTimeoutMs: 1000,
      idleTimeoutMs: 1000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
    });
    await replacement.start();
    try {
      expect(
        (await new PostgresMarkRegAuditRepository(replacement.getPool()).list(workspaceId)).records
      ).toHaveLength(1);
    } finally {
      await replacement.close();
    }
  });
});
