import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type { CoreKnowledgeDailySourceProjection } from '@markorbit/contracts/daily-source';
import type { DailySignalId } from '@markorbit/contracts/daily-workspace';
import type { LiteTodaySnapshot } from '@markorbit/contracts/product-loop';
import {
  DailyOrbitService,
  PostgresDailySignalReader,
  type DailyOrbitTodayReader
} from '../src/daily-orbit.js';
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
const workspaceId = '82828282-8282-4828-8828-828282828282';
const otherWorkspaceId = '83838383-8383-4838-8838-838383838383';
const userId = 'user_m9_wp03_postgres';
const content =
  '# USPTO trademark fee update\n\nThe USPTO announced a trademark fee update effective from next month.\n\n- Applicants should review the fee schedule.\n';
const contentSha = createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');

function projection(): CoreKnowledgeDailySourceProjection {
  return {
    schemaVersion: 1,
    readyPackageId: 'rdp_m9-wp03-durable',
    source: {
      schemaVersion: 1,
      owner: 'CORE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: 'rdp_m9-wp03-durable',
      sourceVersion: 'CORE_CONTENT_V1',
      sourceFingerprintSha256: 'd'.repeat(64),
      observedAt: '2026-08-18T04:00:00.000Z'
    },
    content: {
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      sha256: contentSha,
      content,
      originalName: 'm9-wp03-uspto.md',
      capturedAt: '2026-08-18T03:55:00.000Z',
      legalTruthVerified: false
    }
  };
}

class EmptyToday implements DailyOrbitTodayReader {
  listToday(requestWorkspaceId: string): Promise<LiteTodaySnapshot> {
    return Promise.resolve({
      schemaVersion: 1,
      workspaceId: requestWorkspaceId,
      generatedAt: '2026-08-18T04:10:00.000Z',
      items: [],
      partial: false,
      warnings: []
    });
  }
}

suite('PostgreSQL M9-WP-03 Daily Orbit read model', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-daily-orbit-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_daily_signal_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const source = projection();
  const sourceAuthority: DailyKnowledgeSourceAuthority = {
    resolve(requestWorkspaceId, readyPackageId) {
      if (![workspaceId, otherWorkspaceId].includes(requestWorkspaceId))
        throw new Error('unexpected workspace');
      if (readyPackageId !== source.readyPackageId) throw new Error('unexpected ReadyPackage');
      return Promise.resolve(structuredClone(source));
    }
  };
  let id = 0;
  const store = () =>
    new PostgresLiteDailySignalStore(
      database,
      database.getPool(),
      sourceAuthority,
      () => '2026-08-18T04:01:00.000Z',
      () => `daily-signal_orbit-${++id}` as DailySignalId
    );

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
       ($1,'Daily Orbit Test','daily-orbit-test'),
       ($2,'Daily Orbit Other','daily-orbit-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    id = 0;
    await database
      .getPool()
      .query('TRUNCATE lite_daily_signal_commands,lite_daily_signals CASCADE');
  });

  afterAll(() => database.close());

  it('projects durable Daily Signals into a Workspace-isolated explainable Orbit after restart', async () => {
    const writer = store();
    const first = await writer.importKnowledgeSource({
      workspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'orbit-workspace-one'
    });
    await writer.importKnowledgeSource({
      workspaceId: otherWorkspaceId,
      readyPackageId: source.readyPackageId,
      idempotencyKey: 'orbit-workspace-two'
    });

    const restartedReader = new PostgresDailySignalReader(database.getPool());
    const service = new DailyOrbitService(
      restartedReader,
      new EmptyToday(),
      undefined,
      () => '2026-08-18T04:10:00.000Z'
    );
    const snapshot = await service.snapshot(workspaceId, userId);

    expect(snapshot.workspaceId).toBe(workspaceId);
    expect(snapshot.subjectUserId).toBe(userId);
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]?.signal).toEqual({ id: first.dailySignalId, version: 1 });
    expect(snapshot.items[0]?.source).toEqual(source.source);
    expect(snapshot.items[0]?.score.importance.reason).toContain('FEE_CHANGE');
    expect(snapshot.items[0]?.score.personalRelevance.score).toBe(50);
    expect(snapshot.items[0]?.executionAuthorized).toBe(false);
    expect(snapshot.items[0]?.legalTruthVerified).toBe(false);
    expect(snapshot.contentPicks).toEqual([]);

    const other = await service.snapshot(otherWorkspaceId, userId);
    expect(other.items).toHaveLength(1);
    expect(other.items[0]?.signal.id).not.toBe(first.dailySignalId);
  });
});
