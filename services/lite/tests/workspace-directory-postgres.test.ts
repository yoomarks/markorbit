import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresWorkspaceDirectoryStore } from '../src/workspace-directory.js';

const url = process.env.LITE_WORKSPACE_DIRECTORY_TEST_DATABASE_URL;
const required = process.env.LITE_WORKSPACE_DIRECTORY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) throw new Error('LITE_WORKSPACE_DIRECTORY_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;

const workspaceId = '44444444-4444-4444-8444-444444444444';
const otherWorkspaceId = '55555555-5555-4555-8555-555555555555';

suite('PostgreSQL Workspace Directory durable owner runtime', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'workspace-directory-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_workspace_directory_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let tick = 0;
  let id = 0;
  const now = () => new Date(Date.UTC(2026, 8, 11, 9, 0, tick++)).toISOString();
  const ids = () =>
    `workspace-directory-entry_test-${++id}` as `workspace-directory-entry_${string}`;
  const store = () => new PostgresWorkspaceDirectoryStore(database, database.getPool(), now, ids);
  const create = (
    key: string,
    overrides: Partial<{
      workspaceId: string;
      displayName: string;
      aliases: readonly string[];
      entryKind: 'ORGANIZATION' | 'PERSON';
    }> = {}
  ) => ({
    workspaceId: overrides.workspaceId ?? workspaceId,
    actorPrincipalId: 'user_directory_pg',
    idempotencyKey: key,
    entryKind: overrides.entryKind ?? ('ORGANIZATION' as const),
    displayName: overrides.displayName ?? 'Example Holdings Limited',
    aliases: overrides.aliases ?? ['Example Holdings', 'Example Holdings Ltd.'],
    roles: ['CLIENT_CONTACT' as const],
    externalIdentityReferences: [
      {
        kind: 'APPLICANT_IDENTITY' as const,
        sourceClass: 'DATA_ENGINE_CANDIDATE' as const,
        referenceId: 'candidate:example-holdings',
        label: 'EXAMPLE HOLDINGS LIMITED',
        jurisdiction: 'SG',
        observedAt: '2026-09-11T08:00:00.000Z',
        verifiedLegalIdentityByDirectory: false as const,
        managedTrademarkRelationshipEstablishedByDirectory: false as const
      }
    ]
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
    await migrate(database.getPool(), 'lite_workspace_directory_test', migrations);
    await database
      .getPool()
      .query(
        `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Directory A','directory-a'),($2,'Directory B','directory-b') ON CONFLICT(workspace_id) DO NOTHING`,
        [workspaceId, otherWorkspaceId]
      );
  }, 30000);

  beforeEach(async () => {
    tick = 0;
    id = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_workspace_directory_commands,lite_workspace_directory_heads,lite_workspace_directory_versions CASCADE'
      );
  });

  afterAll(async () => {
    await database.close();
  });

  it('replays exact create across restart semantics and isolates Workspace reads/commands', async () => {
    const first = store();
    const command = create('create-1');
    const created = await first.create(command);
    expect(await store().create(command)).toEqual(created);
    expect(created).toMatchObject({
      version: 1,
      status: 'ACTIVE',
      workspaceId,
      authorityConsequences: {
        verifiedLegalIdentityEstablished: false,
        managedTrademarkRelationshipCreated: false,
        externalActionAuthorized: false,
        officialTruthCreated: false
      }
    });
    await expect(first.create({ ...command, displayName: 'Different' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    });

    const other = await first.create(
      create('create-1', { workspaceId: otherWorkspaceId, displayName: 'Other Workspace' })
    );
    expect(await first.getLatest(workspaceId, other.workspaceDirectoryEntryId)).toBeUndefined();
    expect(await first.getLatest(otherWorkspaceId, other.workspaceDirectoryEntryId)).toEqual(other);
  });

  it('keeps immutable exact history and exact update/archive CAS across store instances', async () => {
    const first = store();
    const created = await first.create(create('history-create'));
    const updated = await store().update({
      workspaceId,
      actorPrincipalId: 'user_directory_pg',
      workspaceDirectoryEntryId: created.workspaceDirectoryEntryId,
      expectedVersion: 1,
      idempotencyKey: 'history-update',
      displayName: 'Example Holdings Pte. Ltd.',
      aliases: ['Example Holdings']
    });
    expect(updated).toMatchObject({ version: 2, displayName: 'Example Holdings Pte. Ltd.' });
    expect(await store().getExact(workspaceId, created.workspaceDirectoryEntryId, 1)).toEqual(
      created
    );
    expect(await store().getLatest(workspaceId, created.workspaceDirectoryEntryId)).toEqual(
      updated
    );

    await expect(
      first.update({
        workspaceId,
        actorPrincipalId: 'user_directory_pg',
        workspaceDirectoryEntryId: created.workspaceDirectoryEntryId,
        expectedVersion: 1,
        idempotencyKey: 'stale-update',
        displayName: 'Stale'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    const archived = await store().archive({
      workspaceId,
      workspaceDirectoryEntryId: created.workspaceDirectoryEntryId,
      expectedVersion: 2,
      idempotencyKey: 'history-archive'
    });
    expect(archived).toMatchObject({ version: 3, status: 'ARCHIVED' });
    expect(
      await store().archive({
        workspaceId,
        workspaceDirectoryEntryId: created.workspaceDirectoryEntryId,
        expectedVersion: 2,
        idempotencyKey: 'history-archive'
      })
    ).toEqual(archived);
    await expect(
      store().update({
        workspaceId,
        actorPrincipalId: 'user_directory_pg',
        workspaceDirectoryEntryId: created.workspaceDirectoryEntryId,
        expectedVersion: 3,
        idempotencyKey: 'after-archive',
        displayName: 'No'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('searches deterministically by normalized display name and aliases without crossing Workspace', async () => {
    const s = store();
    const alpha = await s.create(
      create('search-alpha', {
        displayName: '  Alpha   Holdings  ',
        aliases: ['AHL', 'Alpha International']
      })
    );
    const beta = await s.create(
      create('search-beta', {
        displayName: 'Beta Counsel',
        aliases: ['ALPHA Counsel'],
        entryKind: 'PERSON'
      })
    );
    await s.create(
      create('search-other', {
        workspaceId: otherWorkspaceId,
        displayName: 'Alpha Other Workspace',
        aliases: ['AHL']
      })
    );

    expect(
      (await s.listLatest(workspaceId, { query: ' AHL ', limit: 10 })).map(
        (entry) => entry.workspaceDirectoryEntryId
      )
    ).toEqual([alpha.workspaceDirectoryEntryId]);
    expect(
      (await s.listLatest(workspaceId, { query: 'alpha', limit: 10 })).map(
        (entry) => entry.workspaceDirectoryEntryId
      )
    ).toEqual([alpha.workspaceDirectoryEntryId, beta.workspaceDirectoryEntryId]);
    expect(
      (await s.listLatest(workspaceId, { entryKind: 'PERSON', query: 'alpha', limit: 10 })).map(
        (entry) => entry.workspaceDirectoryEntryId
      )
    ).toEqual([beta.workspaceDirectoryEntryId]);
  });

  it('fails closed when durable columns or document_json are corrupted', async () => {
    const s = store();
    const created = await s.create(create('corrupt-create'));
    await database.getPool().query(
      `UPDATE lite_workspace_directory_versions
            SET normalized_display_name='tampered'
          WHERE workspace_id=$1 AND workspace_directory_entry_id=$2 AND version=1`,
      [workspaceId, created.workspaceDirectoryEntryId]
    );
    await expect(
      s.getExact(workspaceId, created.workspaceDirectoryEntryId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });

  it('keeps external applicant references as local pointers with no verified/managed authority', async () => {
    const created = await store().create(create('authority-create'));
    expect(created.externalIdentityReferences[0]).toMatchObject({
      sourceClass: 'DATA_ENGINE_CANDIDATE',
      verifiedLegalIdentityByDirectory: false,
      managedTrademarkRelationshipEstablishedByDirectory: false
    });
    expect(created.authorityConsequences).toMatchObject({
      customerRelationshipCreatedByDirectory: false,
      applicantIdentityVerified: false,
      managedTrademarkRelationshipCreated: false,
      filingAuthorized: false,
      paymentAuthorized: false,
      externalActionAuthorized: false,
      officialTruthCreated: false
    });
  });
});
