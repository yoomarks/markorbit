import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  canonicalFormalMatterSnapshot,
  FormalMatterService,
  PostgresFormalMatterRepository
} from '../src/formal-matter.js';
import type { FormalMatterError } from '../src/formal-matter.js';
import {
  PostgresCustomerConfirmationRepository,
  hashSnapshot,
  type CustomerConfirmationRecord
} from '../src/customer-confirmation.js';
import { PostgresMatterDraftRepository, type MatterDraftRecord } from '../src/matter-draft.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required when MARKREG_POSTGRES_TEST_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_formal-matter',
  sessionId: 'session_formal-matter',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_formal-matter',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:read', 'matter:create', 'matter:manage']
};
const at = '2026-07-31T15:00:00.000Z';
function confirmation(suffix: string): CustomerConfirmationRecord {
  const snapshot = {
    schemaVersion: 1 as const,
    quoteId: `quote_${suffix}`,
    quoteVersion: 'quote-v7',
    planId: `plan_${suffix}`,
    planVersion: 'plan-v2',
    currency: 'USD',
    totalMinor: 125000,
    lineItems: [
      { code: 'SERVICE', description: 'Service', category: 'SERVICE_FEE', amountMinor: 125000 }
    ],
    termsVersion: 'terms-v3',
    acknowledgementCodes: ['NO_FILING'],
    selectedOptionCode: 'A',
    recommendationId: `recommendation_${suffix}`,
    assumptions: [{ code: 'SCOPE', text: 'Scope is unchanged.' }],
    limitations: ['No filing is created.']
  };
  return {
    confirmationId: `confirmation_${suffix}`,
    workspaceId,
    sourceQuoteId: snapshot.quoteId,
    sourceQuoteVersion: snapshot.quoteVersion,
    status: 'CONFIRMED',
    version: 1,
    snapshotSchemaVersion: 1,
    sourceSnapshot: snapshot,
    sourceSnapshotHash: hashSnapshot(snapshot),
    acceptedAt: at,
    updatedAt: at,
    withdrawnAt: null
  };
}
function draft(source: CustomerConfirmationRecord, suffix: string): MatterDraftRecord {
  const checks = [
    {
      code: 'CUSTOMER_CONFIRMATION_VALID' as const,
      status: 'PASS' as const,
      explanation: 'Current.',
      blocking: true
    }
  ];
  return {
    schemaVersion: 1,
    matterDraftId: `matter-draft_${suffix}`,
    workspaceId,
    customerConfirmationId: source.confirmationId,
    customerConfirmationVersion: source.version,
    sourceQuoteId: source.sourceQuoteId,
    sourceQuoteVersion: source.sourceQuoteVersion,
    preparation: {
      applicantName: 'Orbit Ltd',
      applicantAddress: '1 Orbit Way',
      trademark: 'ORBIT',
      targetJurisdiction: 'US',
      classes: [9],
      goodsServices: 'Software',
      filingBasis: 'USE',
      representativeRequired: false,
      documentReferences: ['document_1'],
      commercialScopeUnchanged: true
    },
    instructionCompleteness: 'COMPLETE',
    documentReadiness: 'READY',
    readiness: { evaluatedAt: at, checks, readyForProfessionalReview: true },
    missingInformation: [],
    status: 'READY_FOR_PROFESSIONAL_REVIEW',
    version: 1,
    createdAt: at,
    updatedAt: at
  };
}

suite('PostgreSQL Formal Matter migration, repository and service', () => {
  const namespace = MARKREG_TEST_MIGRATION_NAMESPACE;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-formal-matter-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const migrations = () =>
    loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/markreg-service');
  const truncate = () =>
    database
      .getPool()
      .query(
        'TRUNCATE markreg_recommended_action_commands, markreg_recommended_action_audit, markreg_recommended_actions, markreg_lifecycle_commands, markreg_lifecycle_views, markreg_lifecycle_events, formal_matter_audit, formal_matter_commands, formal_matters, matter_drafts, customer_confirmations RESTART IDENTITY CASCADE'
      );
  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });
  beforeEach(truncate);
  afterAll(() => database.close());
  const fixture = async (suffix: string, createdAt = at) => {
    const confirmations = new PostgresCustomerConfirmationRepository(database.getPool());
    const source = confirmation(suffix);
    await confirmations.create(source);
    const drafts = new PostgresMatterDraftRepository(database.getPool());
    const ready = draft(source, suffix);
    await drafts.create(ready);
    const repository = new PostgresFormalMatterRepository(database, database.getPool());
    const service = new FormalMatterService(repository, confirmations, drafts, () => createdAt);
    const command = {
      workspaceId,
      customerConfirmationId: source.confirmationId as `confirmation_${string}`,
      expectedCustomerConfirmationVersion: 1,
      matterDraftId: ready.matterDraftId as `matter-draft_${string}`,
      expectedMatterDraftVersion: 1,
      idempotencyKey: `formal-${suffix}`
    };
    return { source, ready, repository, service, command };
  };
  it('applies and verifies owner migration 0022 with no workaround', async () => {
    const owned = await migrations();
    expect(owned.map((x) => x.version)).toEqual(expect.arrayContaining(['0020', '0021', '0022']));
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (x) => x.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });
  it('creates and exactly reloads immutable identity, lineage, canonical snapshot and SHA-256', async () => {
    const f = await fixture('reload');
    const created = await f.service.create(principal, f.command, 'correlation_reload');
    const reloaded = await f.service.get(principal, workspaceId, created.formalMatterId);
    expect(reloaded).toEqual(created);
    expect(reloaded).toMatchObject({
      sourceCustomerConfirmationId: f.source.confirmationId,
      sourceCustomerConfirmationVersion: 1,
      sourceMatterDraftId: f.ready.matterDraftId,
      sourceMatterDraftVersion: 1,
      sourceQuoteId: f.source.sourceQuoteId,
      sourceQuoteVersion: f.source.sourceQuoteVersion
    });
    expect(
      createHash('sha256')
        .update(canonicalFormalMatterSnapshot(reloaded.sourceSnapshot))
        .digest('hex')
    ).toBe(reloaded.snapshotSha256);
  });
  it('replays the same command and rejects conflicting key reuse and a second key for the exact source', async () => {
    const f = await fixture('idempotency');
    const first = await f.service.create(principal, f.command);
    expect((await f.service.create(principal, f.command)).formalMatterId).toBe(
      first.formalMatterId
    );
    await expect(
      f.service.create(principal, { ...f.command, expectedMatterDraftVersion: 2 })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' } satisfies Partial<FormalMatterError>);
    await expect(
      f.service.create(principal, { ...f.command, idempotencyKey: 'different-key' })
    ).rejects.toMatchObject({ code: 'DUPLICATE_SOURCE' } satisfies Partial<FormalMatterError>);
  });
  it('coalesces concurrent identical commands into one winner and one durable evidence set', async () => {
    const f = await fixture('concurrent');
    const results = await Promise.all([
      f.service.create(principal, f.command),
      f.service.create(principal, f.command)
    ]);
    expect(new Set(results.map((x) => x.formalMatterId)).size).toBe(1);
    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*) FROM formal_matters) matters,(SELECT count(*) FROM formal_matter_commands) commands,(SELECT count(*) FROM formal_matter_audit) audits'
      );
    expect(counts.rows[0]).toMatchObject({ matters: '1', commands: '1', audits: '1' });
  });
  it('fails cross-Workspace reads closed', async () => {
    const f = await fixture('scope');
    const created = await f.service.create(principal, f.command);
    await expect(
      f.repository.findById(otherWorkspaceId, created.formalMatterId)
    ).resolves.toBeNull();
  });
  it('searches and paginates a bounded projection with Workspace isolation', async () => {
    const f = await fixture('list');
    const created = await f.service.create(principal, f.command);
    const result = await f.repository.list(workspaceId, {
      search: 'ORBIT',
      status: 'OPEN',
      type: 'TRADEMARK_REGISTRATION',
      page: 1,
      pageSize: 1
    });
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 1 });
    expect(result.items[0]).toMatchObject({
      formalMatterId: created.formalMatterId,
      applicant: 'Orbit Ltd',
      jurisdiction: 'US',
      classes: [9]
    });
    expect(result.items[0]).not.toHaveProperty('sourceSnapshot');
    expect((await f.repository.list(otherWorkspaceId, { page: 1, pageSize: 20 })).total).toBe(0);
  });
  it('filters, orders and paginates without duplicates or gaps, then reconnects exactly', async () => {
    const created = [];
    for (const [suffix, timestamp] of [
      ['old', '2026-07-29T00:00:00.000Z'],
      ['tie-b', '2026-07-30T00:00:00.000Z'],
      ['tie-a', '2026-07-30T00:00:00.000Z']
    ] as const) {
      const f = await fixture(suffix, timestamp);
      created.push(await f.service.create(principal, f.command));
    }
    const repository = new PostgresFormalMatterRepository(database, database.getPool());
    const query = {
      status: 'OPEN' as const,
      type: 'TRADEMARK_REGISTRATION' as const,
      createdFrom: '2026-07-29T00:00:00.000Z',
      createdTo: '2026-07-30T23:59:59.999Z',
      pageSize: 2
    };
    const first = await repository.list(workspaceId, { ...query, page: 1 });
    const second = await repository.list(workspaceId, { ...query, page: 2 });
    const ids = [...first.items, ...second.items].map((item) => item.formalMatterId);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.slice(0, 2)).toEqual([...ids.slice(0, 2)].sort());
    const reconnect = new PostgresFormalMatterRepository(database, database.getPool());
    expect(await reconnect.list(workspaceId, { ...query, page: 1 })).toEqual(first);
    expect(await reconnect.findById(workspaceId, created[0]!.formalMatterId)).toEqual(created[0]);
  });
  it('maps an unavailable database to the canonical persistence error', async () => {
    const unavailable = new PostgresFormalMatterRepository(database, {
      query: () => Promise.reject(new Error('database unavailable'))
    } as never);
    await expect(unavailable.list(workspaceId, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
    await expect(unavailable.findById(workspaceId, 'formal-matter_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
  });
  it('rolls back Matter, snapshot, command and audit when the transaction fails', async () => {
    const f = await fixture('rollback');
    const value = await f.service.create(principal, { ...f.command, idempotencyKey: 'seed' });
    await truncate();
    await expect(
      f.repository.createAtomically(
        { ...value, formalMatterId: 'formal-matter_rollback' },
        'rollback',
        'fingerprint',
        {
          workspaceId,
          formalMatterId: 'formal-matter_rollback',
          action: 'FORMAL_MATTER_CREATED',
          actorId: null as never,
          createdAt: at
        }
      )
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*) FROM formal_matters) matters,(SELECT count(*) FROM formal_matter_commands) commands,(SELECT count(*) FROM formal_matter_audit) audits'
      );
    expect(counts.rows[0]).toMatchObject({ matters: '0', commands: '0', audits: '0' });
  });
  it('reloads exact evidence through a fresh pool and repository after reconnect', async () => {
    const f = await fixture('reconnect');
    const created = await f.service.create(principal, f.command);
    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'markreg-formal-matter-reconnect',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: namespace
    });
    await fresh.start();
    try {
      expect(
        await new PostgresFormalMatterRepository(fresh, fresh.getPool()).findById(
          workspaceId,
          created.formalMatterId
        )
      ).toEqual(created);
    } finally {
      await fresh.close();
    }
  });
});
