import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner } from '@markorbit/persistence';
import {
  PostgresCustomerRelationshipStore,
  type CreateCustomerRelationshipCommand,
  type CustomerRelationshipId
} from '../src/customer-relationship.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_CUSTOMER_RELATIONSHIP_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required in required Customer Relationship mode.');

const suite = url ? describe : describe.skip;
const workspaceId = '70707070-7070-4707-8707-707070707070';
const otherWorkspaceId = '71717171-7171-4717-8717-717171717171';

suite('PostgreSQL MarkReg Customer Relationship', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-customer-relationship-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  let tick = 0;
  let idSequence = 0;
  const now = () => new Date(Date.UTC(2026, 8, 6, 13, 40, tick++)).toISOString();
  const nextId = () => `customer-relationship_test-${++idSequence}` as CustomerRelationshipId;
  const store = () =>
    new PostgresCustomerRelationshipStore(database, database.getPool(), now, nextId);

  const command = (
    overrides: Partial<CreateCustomerRelationshipCommand> = {}
  ): CreateCustomerRelationshipCommand => ({
    workspaceId,
    displayName: 'Acme Brand Team',
    relationshipModel: 'DIRECT',
    principalId: 'user_customer-relationship-914',
    idempotencyKey: 'customer-relationship-914',
    ...overrides
  });

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });
  beforeEach(async () => {
    tick = 0;
    idSequence = 0;
    await database.getPool().query(
      `TRUNCATE
        markreg_customer_relationship_commands,
        markreg_customer_relationships
       RESTART IDENTITY CASCADE`
    );
  });

  afterAll(() => database.close());

  it('loads migration 0096 under MarkReg ownership with no CRM/legal-identity columns', async () => {
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/markreg-service'
    );
    expect(migrations.map((value) => `${value.version}_${value.name}`)).toContain(
      '0096_markreg_customer_relationships'
    );
    const columns = await database.getPool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema=current_schema() AND table_name='markreg_customer_relationships'`
    );
    expect(columns.rows.map((row) => row.column_name)).not.toEqual(
      expect.arrayContaining(['email', 'customer_id', 'legal_identity', 'contact_consent'])
    );
  });
  it('creates only explicit Workspace relationship truth and replays exact creation', async () => {
    const first = await store().create(command());
    expect(first).toMatchObject({
      workspaceId,
      displayName: 'Acme Brand Team',
      relationshipModel: 'DIRECT',
      identityStatus: 'UNVERIFIED',
      origin: 'WORKSPACE_EXPLICIT',
      status: 'ACTIVE',
      version: 1,
      source: {
        owner: 'MARKREG',
        kind: 'CUSTOMER_RELATIONSHIP',
        currentness: 'CURRENT'
      }
    });
    expect(first.customerRelationshipId).toMatch(/^customer-relationship_/u);

    const restarted = new PostgresCustomerRelationshipStore(
      database,
      database.getPool(),
      now,
      nextId
    );
    expect(await restarted.create(command())).toEqual(first);
    expect(await restarted.get(workspaceId, first.customerRelationshipId)).toEqual(first);

    const counts = await database.getPool().query(
      `SELECT
        (SELECT count(*)::int FROM markreg_customer_relationships) AS relationships,
        (SELECT count(*)::int FROM markreg_customer_relationship_commands) AS commands`
    );
    expect(counts.rows[0]).toEqual({ relationships: 1, commands: 1 });
  });

  it('does not promote an existing Order customerId reference into canonical relationship truth', async () => {
    await database.getPool().query(
      `INSERT INTO orders(
        order_id,workspace_id,order_type,status,version,customer_id,channel,relationship_model,
        source_quote_id,source_quote_version,source_customer_confirmation_id,
        source_customer_confirmation_version,commercial_source_snapshot,
        commercial_source_snapshot_sha256,matter_reference,created_by_user_id,
        updated_by_user_id,created_at,updated_at
      ) VALUES (
        'order_legacy-customer-reference',$1,'TrademarkFiling','Draft',1,
        'customer_legacy-order','MARKREG_DIRECT','DIRECT','quote_legacy','quote-v1',
        'confirmation_legacy',1,'{}'::jsonb,$2,NULL,'user_legacy','user_legacy',$3,$3
      )`,
      [workspaceId, 'a'.repeat(64), '2026-09-06T13:39:00.000Z']
    );
    const relationships = await database
      .getPool()
      .query('SELECT count(*)::int AS total FROM markreg_customer_relationships');
    expect(relationships.rows[0]).toEqual({ total: 0 });
  });

  it('rejects different replay while isolating idempotency and reads by Workspace', async () => {
    const first = await store().create(command());
    await expect(
      store().create(command({ displayName: 'Different Customer' }))
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });

    const other = await store().create(
      command({
        workspaceId: otherWorkspaceId,
        displayName: 'Other Workspace Customer'
      })
    );
    expect(other.workspaceId).toBe(otherWorkspaceId);
    expect(other.customerRelationshipId).not.toBe(first.customerRelationshipId);
    await expect(store().get(otherWorkspaceId, first.customerRelationshipId)).rejects.toMatchObject(
      { code: 'NOT_FOUND', status: 404 }
    );
    await expect(store().get(workspaceId, other.customerRelationshipId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404
    });
  });

  it('keeps bounded Workspace list pagination and status filtering', async () => {
    const first = await store().create(command({ idempotencyKey: 'relationship-list-1' }));
    await store().create(
      command({ idempotencyKey: 'relationship-list-2', displayName: 'Beta Brand Team' })
    );
    await store().create(
      command({ idempotencyKey: 'relationship-list-3', displayName: 'Gamma Brand Team' })
    );
    await store().create(
      command({
        workspaceId: otherWorkspaceId,
        idempotencyKey: 'relationship-list-other',
        displayName: 'Other Workspace Team'
      })
    );
    await store().archive(
      workspaceId,
      first.customerRelationshipId,
      first.version,
      'user_customer-relationship-914'
    );

    const pageOne = await store().list(workspaceId, { page: 1, pageSize: 2 });
    expect(pageOne.total).toBe(3);
    expect(pageOne.items).toHaveLength(2);
    expect(pageOne.items.every((item) => item.workspaceId === workspaceId)).toBe(true);

    const pageTwo = await store().list(workspaceId, { page: 2, pageSize: 2 });
    expect(pageTwo.total).toBe(3);
    expect(pageTwo.items).toHaveLength(1);

    const archived = await store().list(workspaceId, {
      status: 'ARCHIVED',
      page: 1,
      pageSize: 20
    });
    expect(archived.total).toBe(1);
    expect(archived.items[0]?.customerRelationshipId).toBe(first.customerRelationshipId);
  });
  it('uses exact versions for bounded update and preserves archived history', async () => {
    const created = await store().create(command());
    const updated = await store().update({
      workspaceId,
      customerRelationshipId: created.customerRelationshipId,
      expectedVersion: 1,
      displayName: 'Acme Portfolio Team',
      relationshipModel: 'CO_DELIVERY',
      principalId: 'user_customer-relationship-editor'
    });
    expect(updated).toMatchObject({
      displayName: 'Acme Portfolio Team',
      relationshipModel: 'CO_DELIVERY',
      version: 2,
      updatedByPrincipalId: 'user_customer-relationship-editor'
    });
    await expect(
      store().update({
        workspaceId,
        customerRelationshipId: created.customerRelationshipId,
        expectedVersion: 1,
        displayName: 'Stale overwrite',
        principalId: 'user_customer-relationship-editor'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });

    const archived = await store().archive(
      workspaceId,
      created.customerRelationshipId,
      2,
      'user_customer-relationship-archiver'
    );
    expect(archived).toMatchObject({
      status: 'ARCHIVED',
      version: 3,
      source: { currentness: 'INACTIVE', referenceVersion: 3 }
    });
    expect(archived.archivedAt).not.toBeNull();
    expect(await store().get(workspaceId, created.customerRelationshipId)).toEqual(archived);
    await expect(
      store().update({
        workspaceId,
        customerRelationshipId: created.customerRelationshipId,
        expectedVersion: 3,
        displayName: 'Cannot revive by update',
        principalId: 'user_customer-relationship-editor'
      })
    ).rejects.toMatchObject({ code: 'RELATIONSHIP_INACTIVE', status: 409 });
  });

  it('distinguishes known absence from persistence unavailability', async () => {
    await expect(store().get(workspaceId, 'customer-relationship_missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404
    });

    const unavailable = new PostgresCustomerRelationshipStore(
      { transact: () => Promise.reject(new Error('offline')) },
      { query: () => Promise.reject(new Error('offline')) } as never
    );
    await expect(
      unavailable.get(workspaceId, 'customer-relationship_missing')
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE', status: 503 });
  });
});
