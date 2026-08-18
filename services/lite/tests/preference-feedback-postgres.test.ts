import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type { DailySignal, ProductPreferenceEventId } from '@markorbit/contracts/daily-workspace';
import type { LiteTodaySnapshot } from '@markorbit/contracts/product-loop';
import {
  DailyOrbitService,
  type DailyOrbitTodayReader,
  type DailySignalReader
} from '../src/daily-orbit.js';
import { PostgresProductPreferenceStore } from '../src/preference-feedback.js';

const url = process.env.LITE_TODAY_TEST_DATABASE_URL;
const required = process.env.LITE_TODAY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_TODAY_TEST_DATABASE_URL is required when LITE_TODAY_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '91919191-9191-4919-8919-919191919191';
const otherWorkspaceId = '92929292-9292-4929-8929-929292929292';
const userId = 'user_m9_wp07_preference';

const signal: DailySignal = {
  schemaVersion: 1,
  dailySignalId: 'daily-signal_m9-wp07-us-trademark',
  workspaceId,
  version: 1,
  source: {
    schemaVersion: 1,
    owner: 'CORE',
    kind: 'KNOWLEDGE_READY_PACKAGE',
    sourceId: 'rdp_m9-wp07-us-trademark',
    sourceVersion: 'CORE_CONTENT_V1',
    sourceFingerprintSha256: '9'.repeat(64),
    observedAt: '2026-08-18T05:00:00.000Z'
  },
  title: 'USPTO trademark rule update',
  summary: 'A governed USPTO source changes a trademark rule used by practitioners.',
  keyFacts: ['The update concerns United States trademark practice.'],
  jurisdictions: ['US'],
  institution: 'USPTO',
  topicTags: ['trademark'],
  changeType: 'RULE_CHANGE',
  observedAt: '2026-08-18T05:00:00.000Z',
  timeSensitivity: 'MEDIUM',
  dailySignalFingerprintSha256: '8'.repeat(64),
  legalTruthVerified: false,
  recommendationCreatedAutomatically: false,
  createdAt: '2026-08-18T05:00:00.000Z'
};

class OneSignal implements DailySignalReader {
  listRecent(requestWorkspaceId: string): Promise<readonly DailySignal[]> {
    return Promise.resolve(requestWorkspaceId === workspaceId ? [structuredClone(signal)] : []);
  }
}

class EmptyToday implements DailyOrbitTodayReader {
  listToday(requestWorkspaceId: string): Promise<LiteTodaySnapshot> {
    return Promise.resolve({
      schemaVersion: 1,
      workspaceId: requestWorkspaceId,
      generatedAt: '2026-08-18T06:00:00.000Z',
      items: [],
      partial: false,
      warnings: []
    });
  }
}

suite('PostgreSQL M9-WP07 Product preference evidence', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-product-preference-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_product_preference_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let sequence = 0;
  const store = () =>
    new PostgresProductPreferenceStore(
      database,
      database.getPool(),
      () => `2026-08-18T06:0${Math.min(sequence, 9)}:00.000Z`,
      () => `product-preference-event_wp07-${++sequence}` as ProductPreferenceEventId
    );

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    await migrate(
      database.getPool(),
      'lite_product_preference_test',
      await loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/lite-service')
    );
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
       ($1,'WP07 Preference','wp07-preference'),
       ($2,'WP07 Preference Other','wp07-preference-other')
       ON CONFLICT(workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    sequence = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_product_preference_commands,lite_creator_preferences,lite_product_preference_events CASCADE'
      );
  });

  afterAll(() => database.close());

  it('persists replay-safe Product evidence without claiming external or Capability truth', async () => {
    const writer = store();
    const command = {
      workspaceId,
      subjectUserId: userId,
      kind: 'SAVED' as const,
      targetType: 'DAILY_ORBIT_ITEM' as const,
      targetId: 'daily-orbit-item_wp07',
      targetVersion: 1,
      context: {
        jurisdictions: ['US'],
        topics: ['trademark'],
        platforms: ['WECHAT_OFFICIAL_ACCOUNT'] as const
      },
      idempotencyKey: 'save-us-trademark'
    };

    const first = await writer.recordCanonicalEvent(command);
    const replay = await writer.recordCanonicalEvent(command);
    expect(replay).toEqual(first);
    expect(first.event.externalActionExecutedByMarkOrbit).toBe(false);
    expect(first.event.externalOutcomeVerifiedByMarkOrbit).toBe(false);
    expect(first.event.capabilityVerified).toBe(false);
    expect(first.preference.source).toBe('PRODUCT_FEEDBACK');
    expect(first.preference.capabilityVerified).toBe(false);
    expect(first.preference.primaryJurisdictions).toEqual(['US']);
    expect(first.preference.professionalTopics).toEqual(['trademark']);
    expect(first.preference.preferredPlatforms).toEqual(['WECHAT_OFFICIAL_ACCOUNT']);

    await expect(
      writer.recordCanonicalEvent({ ...command, kind: 'DISMISSED' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const restarted = store();
    expect(await restarted.resolve(workspaceId, userId)).toEqual(first.preference);
    expect(await restarted.resolve(otherWorkspaceId, userId)).toBeUndefined();
    expect(await restarted.listRecentEvents(workspaceId, userId)).toEqual([first.event]);
  });

  it('makes durable Product feedback explainably affect a later Daily Orbit without Capability promotion', async () => {
    const baseline = new DailyOrbitService(
      new OneSignal(),
      new EmptyToday(),
      undefined,
      () => '2026-08-18T06:10:00.000Z'
    );
    const before = await baseline.snapshot(workspaceId, userId);
    expect(before.preferenceSource).toBe('NONE');
    expect(before.items[0]?.score.personalRelevance.score).toBe(50);

    await store().recordCanonicalEvent({
      workspaceId,
      subjectUserId: userId,
      kind: 'SAVED',
      targetType: 'DAILY_ORBIT_ITEM',
      targetId: before.items[0]!.dailyOrbitItemId,
      targetVersion: before.items[0]!.version,
      context: {
        jurisdictions: ['US'],
        topics: ['trademark'],
        platforms: ['WECHAT_OFFICIAL_ACCOUNT']
      },
      idempotencyKey: 'orbit-save-us-trademark'
    });

    const restartedPreferenceStore = store();
    const afterRestart = new DailyOrbitService(
      new OneSignal(),
      new EmptyToday(),
      restartedPreferenceStore,
      () => '2026-08-18T06:11:00.000Z'
    );
    const after = await afterRestart.snapshot(workspaceId, userId);
    expect(after.preferenceSource).toBe('PRODUCT_FEEDBACK');
    expect(after.items[0]?.score.personalRelevance.score).toBe(95);
    expect(after.items[0]?.score.personalRelevance.reason).toContain('every configured');
    expect((await restartedPreferenceStore.resolve(workspaceId, userId))?.capabilityVerified).toBe(false);
  });
});
