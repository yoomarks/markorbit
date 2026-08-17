import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type { CoreKnowledgeDailySourceProjection } from '@markorbit/contracts/daily-source';
import type { DailySignalId } from '@markorbit/contracts/daily-workspace';
import {
  PostgresLiteDailySignalStore,
  type DailyKnowledgeSourceAuthority
} from '../src/daily-signal.js';

const url = process.env.LITE_DAILY_SIGNAL_TEST_DATABASE_URL;
const required = process.env.LITE_DAILY_SIGNAL_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_DAILY_SIGNAL_TEST_DATABASE_URL is required when LITE_DAILY_SIGNAL_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '72727272-7272-4727-8727-727272727272';
const otherWorkspaceId = '73737373-7373-4737-8737-737373737373';
const content = '# USPTO trademark notice\n\nThe USPTO announced a new trademark filing notice.\n';
const contentSha = createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');

function projection(fingerprint = 'a'.repeat(64)): CoreKnowledgeDailySourceProjection {
  return {
    schemaVersion: 1,
    readyPackageId: 'rdp_m9-wp02-durable',
    source: {
      schemaVersion: 1,
      owner: 'CORE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: 'rdp_m9-wp02-durable',
      sourceVersion: 'CORE_CONTENT_V1',
      sourceFingerprintSha256: fingerprint,
      observedAt: '2026-08-18T02:00:00.000Z'
    },
    content: {
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      sha256: contentSha,
      content,
      originalName: 'uspto-notice.md',
      capturedAt: '2026-08-18T01:55:00.000Z',
      legalTruthVerified: false
    }
  };
}

suite('PostgreSQL Lite Daily Signal import', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-daily-signal-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_daily_signal_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let source = projection();
  const sourceAuthority: DailyKnowledgeSourceAuthority = {
    resolve(requestWorkspaceId, readyPackageId) {
      if (![workspaceId, otherWorkspaceId].includes(requestWorkspaceId))
        throw new Error('unexpected workspace');
      if (readyPackageId !== source.readyPackageId) throw new Error('unexpected ReadyPackage');
      return Promise.resolve(structuredClone(source));
    }
  };
  let tick = 0;
  let id = 0;
  const now = () => new Date(Date.UTC(2026, 7, 18, 2, 1, tick++)).toISOString();
  const nextId = () => `daily-signal_test-${++id}` as DailySignalId;
  const store = () =>
    new PostgresLiteDailySignalStore(database, database.getPool(), sourceAuthority, now, nextId);

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const liteMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_daily_signal_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Daily Signal Test','daily-signal-test'),
       ($2,'Daily Signal Other','daily-signal-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    source = projection();
    tick = 0;
    id = 0;
    await database
      .getPool()
      .query('TRUNCATE lite_daily_signal_commands,lite_daily_signals CASCADE');
  });

  afterAll(() => database.close());

  it('persists exact Core provenance and replays the same import after store restart', async () => {
    const firstStore = store();
    const first = await firstStore.importKnowledgeSource({
      workspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'import-1'
    });
    expect(first.source).toEqual(source.source);
    expect(first.jurisdictions).toEqual(['US']);
    expect(first.institution).toBe('USPTO');
    expect(first.legalTruthVerified).toBe(false);
    expect(first.recommendationCreatedAutomatically).toBe(false);

    const restarted = store();
    const replay = await restarted.importKnowledgeSource({
      workspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'import-1'
    });
    expect(replay).toEqual(first);
    expect(await restarted.find(workspaceId, first.dailySignalId)).toEqual(first);
  });

  it('deduplicates the same exact source across different idempotency keys', async () => {
    const service = store();
    const first = await service.importKnowledgeSource({
      workspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'import-a'
    });
    const second = await service.importKnowledgeSource({
      workspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'import-b'
    });
    expect(second.dailySignalId).toBe(first.dailySignalId);
    const rows = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM lite_daily_signals WHERE workspace_id=$1', [
        workspaceId
      ]);
    const row = rows.rows[0] as { count: number } | undefined;
    expect(row?.count).toBe(1);
  });

  it('rejects changed immutable source evidence for the same source version', async () => {
    const service = store();
    await service.importKnowledgeSource({
      workspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'import-original'
    });
    source = projection('b'.repeat(64));
    await expect(
      service.importKnowledgeSource({
        workspaceId,
        readyPackageId: source.readyPackageId,
        idempotencyKey: 'import-changed'
      })
    ).rejects.toMatchObject({
      code: 'SOURCE_FINGERPRINT_MISMATCH',
      status: 409
    });
  });

  it('isolates durable signals by Workspace', async () => {
    const service = store();
    const first = await service.importKnowledgeSource({
      workspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'workspace-one'
    });
    const other = await service.importKnowledgeSource({
      workspaceId: otherWorkspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'workspace-two'
    });
    expect(other.dailySignalId).not.toBe(first.dailySignalId);
    expect(await service.find(otherWorkspaceId, first.dailySignalId)).toBeUndefined();
  });
});
