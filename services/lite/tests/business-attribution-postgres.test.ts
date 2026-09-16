import path from 'node:path';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresBusinessAttributionStore } from '../src/business-attribution.js';

const url = process.env.LITE_BUSINESS_ATTRIBUTION_TEST_DATABASE_URL;
const required = process.env.LITE_BUSINESS_ATTRIBUTION_POSTGRES_REQUIRED === '1';
if (required && !url) throw new Error('LITE_BUSINESS_ATTRIBUTION_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const evaluatedAt = '2026-09-16T08:00:00.000Z';
const exactRef = (owner: string, kind: string, id: string, sha: string) => ({
  owner,
  kind,
  id,
  version: 1,
  fingerprintSha256: sha.repeat(64),
  observedAt: evaluatedAt
});

suite('PostgreSQL Business Attribution owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'business-attribution-test',
    poolMaximum: 5,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_business_attribution_test'
  });
  let sequence = 0;
  const store = () =>
    new PostgresBusinessAttributionStore(
      database,
      database.getPool(),
      () => evaluatedAt,
      () => `postgres${++sequence}`
    );
  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_business_attribution_test', migrations);
    await database
      .getPool()
      .query(
        `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Attribution A','attribution-a'),($2,'Attribution B','attribution-b') ON CONFLICT(workspace_id) DO NOTHING`,
        [workspaceId, otherWorkspaceId]
      );
  }, 30_000);
  beforeEach(async () => {
    sequence = 0;
    await database
      .getPool()
      .query('TRUNCATE lite_business_attribution_commands,lite_business_attribution_links CASCADE');
  });
  afterAll(async () => database.close());

  it('persists exact portfolio lineage, replays after restart and isolates Workspace reads', async () => {
    const command = {
      workspaceId,
      actorPrincipalId: 'user_professional',
      idempotencyKey: 'portfolio-growth-accepted-1',
      motionKind: 'PORTFOLIO_GROWTH' as const,
      sourceRefs: [
        exactRef('LITE', 'TRADEMARK_ASSET', 'asset_1', 'a'),
        exactRef('LITE', 'TRADEMARK_ASSET_MANAGEMENT_SIGNAL', 'signal_1', 'b'),
        exactRef('MARKREG', 'CUSTOMER_RELATIONSHIP', 'relationship_1', 'c')
      ],
      touchpointRefs: [
        exactRef('LITE', 'OPPORTUNITY_QUALIFICATION_DECISION', 'qualification_1', 'd'),
        exactRef('CAPABILITY_ENGINE', 'MANAGED_COMMUNICATION_MESSAGE', 'message_1', 'e')
      ],
      downstreamRef: exactRef(
        'MARKREG',
        'FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
        'opportunity_1',
        'f'
      ),
      attributionState: 'ATTRIBUTED' as const,
      evidenceBasis: 'EXACT_LINEAGE' as const,
      evaluatedAt
    };
    const created = await store().create(command);
    await expect(store().create(command)).resolves.toEqual(created);
    await expect(store().find(workspaceId, created.businessAttributionLinkId)).resolves.toEqual(
      created
    );
    await expect(
      store().find(otherWorkspaceId, created.businessAttributionLinkId)
    ).resolves.toBeUndefined();
    expect(created.downstreamRef).toMatchObject({ owner: 'MARKREG' });
    expect(created.authorityConsequences.conversionCreated).toBe(false);
  });
});
