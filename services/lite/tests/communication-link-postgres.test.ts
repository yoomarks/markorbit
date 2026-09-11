import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import {
  DurableCommunicationLinkThreadAssociationLookup,
  PostgresCommunicationLinkStore
} from '../src/communication-link.js';

const url = process.env.LITE_COMMUNICATION_LINK_TEST_DATABASE_URL;
const required = process.env.LITE_COMMUNICATION_LINK_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) throw new Error('LITE_COMMUNICATION_LINK_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
const workspaceId = '55555555-5555-4555-8555-555555555555';
const otherWorkspaceId = '66666666-6666-4666-8666-666666666666';
const source = (scope: 'MESSAGE' | 'THREAD' = 'THREAD') => ({
  owner: 'MANAGED_COMMUNICATION' as const,
  scope,
  accountRef: 'communication-account_pg',
  messageId: 'message_pg',
  threadRef: 'thread_pg',
  provider: 'MICROSOFT_GRAPH',
  providerMessageId: 'provider-pg',
  observedAt: '2026-09-11T05:00:00.000Z'
});
const target = (id = 'trademark-asset_pg', version = 3) => ({
  targetKind: 'TRADEMARK_ASSET' as const,
  owner: 'LITE' as const,
  workspaceId,
  trademarkAssetId: id as `trademark-asset_${string}`,
  version
});

suite('PostgreSQL Communication Link durable owner runtime', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'communication-link-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_communication_link_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let tick = 0;
  let id = 0;
  const now = () => new Date(Date.UTC(2026, 8, 11, 5, 5, tick++)).toISOString();
  const ids = () => `communication-link_test-${++id}` as `communication-link_${string}`;
  const store = () => new PostgresCommunicationLinkStore(database, database.getPool(), now, ids);
  const create = (
    key: string,
    overrides: Partial<{
      workspaceId: string;
      decisionStatus: 'CONFIRMED' | 'REJECTED';
      targetId: string;
      targetVersion: number;
      scope: 'MESSAGE' | 'THREAD';
      reason: string;
    }> = {}
  ) => ({
    workspaceId: overrides.workspaceId ?? workspaceId,
    actorPrincipalId: 'user_pg',
    idempotencyKey: key,
    source: source(overrides.scope ?? 'THREAD'),
    target: {
      ...target(overrides.targetId ?? 'trademark-asset_pg', overrides.targetVersion ?? 3),
      workspaceId: overrides.workspaceId ?? workspaceId
    },
    decisionStatus: overrides.decisionStatus ?? ('CONFIRMED' as const),
    decisionBasis: 'MANUAL' as const,
    reason: overrides.reason ?? 'Reviewed by owner',
    evidenceReferences: [] as string[]
  });

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_communication_link_test', migrations);
    await database
      .getPool()
      .query(
        `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Link A','link-a'),($2,'Link B','link-b') ON CONFLICT(workspace_id) DO NOTHING`,
        [workspaceId, otherWorkspaceId]
      );
  }, 30000);
  beforeEach(async () => {
    tick = 0;
    id = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_communication_link_commands,lite_communication_link_heads,lite_communication_link_versions CASCADE'
      );
  });
  afterAll(async () => {
    await database.close();
  });

  it('replays exact create across store restart and isolates Workspace commands', async () => {
    const first = store();
    const command = create('create-1');
    const created = await first.create(command);
    expect(await store().create(command)).toEqual(created);
    expect(created).toMatchObject({
      version: 1,
      lifecycle: 'ACTIVE',
      workspaceId,
      decision: { status: 'CONFIRMED', authority: 'HUMAN' }
    });
    await expect(first.create({ ...command, reason: 'changed' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    });
    const other = await first.create(create('create-1', { workspaceId: otherWorkspaceId }));
    expect(other.workspaceId).toBe(otherWorkspaceId);
    expect(await first.getLatest(workspaceId, other.communicationLinkId)).toBeUndefined();
    expect(await first.getLatest(otherWorkspaceId, other.communicationLinkId)).toEqual(other);
  });

  it('enforces one ACTIVE source-scope × logical-target decision and allows explicit re-decision after archive', async () => {
    const [left, right] = await Promise.all([
      store().create(create('parallel-a')),
      store().create(create('parallel-b'))
    ]);
    expect(right).toEqual(left);
    await expect(
      store().create(create('opposite', { decisionStatus: 'REJECTED' }))
    ).rejects.toMatchObject({ code: 'ACTIVE_SUBJECT_CONFLICT' });
    const archived = await store().archive({
      workspaceId,
      communicationLinkId: left.communicationLinkId,
      expectedVersion: 1,
      idempotencyKey: 'archive-1'
    });
    expect(archived).toMatchObject({ version: 2, lifecycle: 'ARCHIVED' });
    const rejected = await store().create(create('redecision', { decisionStatus: 'REJECTED' }));
    expect(rejected.communicationLinkId).not.toBe(left.communicationLinkId);
    expect(rejected.decision.status).toBe('REJECTED');
  });

  it('keeps exact history and exact archive CAS across restart', async () => {
    const service = store();
    const active = await service.create(create('history-create'));
    const archived = await service.archive({
      workspaceId,
      communicationLinkId: active.communicationLinkId,
      expectedVersion: 1,
      idempotencyKey: 'history-archive'
    });
    expect(await store().getExact(workspaceId, active.communicationLinkId, 1)).toEqual(active);
    expect(await store().getLatest(workspaceId, active.communicationLinkId)).toEqual(archived);
    expect(
      await store().archive({
        workspaceId,
        communicationLinkId: active.communicationLinkId,
        expectedVersion: 1,
        idempotencyKey: 'history-archive'
      })
    ).toEqual(archived);
    await expect(
      service.archive({
        workspaceId,
        communicationLinkId: active.communicationLinkId,
        expectedVersion: 1,
        idempotencyKey: 'stale'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await expect(
      service.archive({
        workspaceId,
        communicationLinkId: active.communicationLinkId,
        expectedVersion: 2,
        idempotencyKey: 'again'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('provides #1103 inheritance only from ACTIVE THREAD CONFIRMED Trademark Asset links', async () => {
    const service = store();
    const confirmed = await service.create(
      create('confirmed', { targetId: 'trademark-asset_confirmed' })
    );
    await service.create(
      create('rejected', { targetId: 'trademark-asset_rejected', decisionStatus: 'REJECTED' })
    );
    await service.create(
      create('message', { targetId: 'trademark-asset_message', scope: 'MESSAGE' })
    );
    const archived = await service.create(
      create('archived', { targetId: 'trademark-asset_archived' })
    );
    await service.archive({
      workspaceId,
      communicationLinkId: archived.communicationLinkId,
      expectedVersion: 1,
      idempotencyKey: 'archive-hidden'
    });
    const lookup = new DurableCommunicationLinkThreadAssociationLookup(store());
    expect(
      await lookup.lookup({
        workspaceId,
        accountRef: 'communication-account_pg',
        threadRef: 'thread_pg'
      })
    ).toEqual([
      {
        associationReference: confirmed.communicationLinkId,
        workspaceId,
        accountRef: 'communication-account_pg',
        threadRef: 'thread_pg',
        status: 'CONFIRMED',
        confirmationAuthority: 'HUMAN',
        target: { id: 'trademark-asset_confirmed', version: 3 }
      }
    ]);
  });

  it('fails closed when durable columns or latest head drift from document_json', async () => {
    const service = store();
    const created = await service.create(create('corrupt'));
    await database
      .getPool()
      .query(
        `UPDATE lite_communication_link_versions SET target_version=99 WHERE workspace_id=$1 AND communication_link_id=$2 AND version=1`,
        [workspaceId, created.communicationLinkId]
      );
    await expect(
      service.getExact(workspaceId, created.communicationLinkId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
    await database
      .getPool()
      .query(
        `UPDATE lite_communication_link_versions SET target_version=3 WHERE workspace_id=$1 AND communication_link_id=$2 AND version=1`,
        [workspaceId, created.communicationLinkId]
      );
    await database
      .getPool()
      .query(
        `UPDATE lite_communication_link_heads SET target_version=99 WHERE workspace_id=$1 AND communication_link_id=$2`,
        [workspaceId, created.communicationLinkId]
      );
    await expect(service.getLatest(workspaceId, created.communicationLinkId)).rejects.toMatchObject(
      { code: 'INTEGRITY_FAILURE' }
    );
  });
});
