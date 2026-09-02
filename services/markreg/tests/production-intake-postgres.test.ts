import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  type CreateProductionIntakeCommandV1
} from '@markorbit/contracts/markreg-early-funnel';
import { ManagedDatabase, loadMigrationsForOwner } from '@markorbit/persistence';
import { PostgresProductionIntakeService } from '../src/production-intake.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_PRODUCTION_INTAKE_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required in required Production Intake mode.');

const suite = url ? describe : describe.skip;
const workspaceId = '60606060-6060-4606-8606-606060606060';
const otherWorkspaceId = '61616161-6161-4616-8616-616161616161';
const at = '2026-09-02T13:00:00.000Z';

const principal = (
  workspace = workspaceId,
  permissions: WorkspacePrincipal['permissions'] = ['workspace:read', 'matter:create']
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0608',
  userId: 'user_task0608',
  workspaceId: workspace,
  membershipId: 'membership_task0608',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const command = (
  overrides: Partial<CreateProductionIntakeCommandV1> = {}
): CreateProductionIntakeCommandV1 => ({
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch a portfolio-management software brand.',
    applicant: {
      type: 'ORGANIZATION',
      name: 'Orbit Intake Labs Ltd.',
      country: 'GB'
    },
    trademark: {
      type: 'WORD',
      representationText: 'ORBIT INTAKE'
    },
    targetJurisdictions: ['US', 'GB'],
    goodsServices: {
      sourceText: 'Downloadable software for trademark portfolio management.'
    },
    filingGoal: 'Protect the core software brand in the requested jurisdictions.'
  },
  idempotencyKey: 'production-intake-task0608',
  correlationId: 'correlation_task0608',
  ...overrides
});

suite('PostgreSQL Production Intake', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: MARKREG_TEST_MIGRATION_NAMESPACE,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });

  const service = () => new PostgresProductionIntakeService(database, database.getPool(), () => at);

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  beforeEach(() =>
    database.getPool().query(
      `TRUNCATE
        markreg_early_funnel_audit,
        markreg_early_funnel_commands,
        markreg_early_funnel_quote_state_events,
        markreg_early_funnel_quotes,
        markreg_early_funnel_selection_state_events,
        markreg_early_funnel_selections,
        markreg_early_funnel_recommendations,
        markreg_early_funnel_intakes
       RESTART IDENTITY CASCADE`
    )
  );

  afterAll(() => database.close());

  it('loads migration 0083 under MarkReg ownership', async () => {
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/markreg-service'
    );
    expect(migrations.map((value) => `${value.version}_${value.name}`)).toContain(
      '0083_markreg_early_funnel'
    );
  });

  it('persists exact structured Intake truth and replays across service restart', async () => {
    const first = await service().create(principal(), command());
    expect(first).toMatchObject({
      workspaceId,
      version: 1,
      status: 'RECEIVED',
      sourceClass: 'CUSTOMER_SUPPLIED',
      input: {
        applicant: { name: 'Orbit Intake Labs Ltd.', country: 'GB' },
        trademark: { type: 'WORD', representationText: 'ORBIT INTAKE' },
        targetJurisdictions: ['US', 'GB']
      },
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
    expect(first.intakeId).toMatch(/^intake_/u);
    expect(first.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);

    const restarted = new PostgresProductionIntakeService(database, database.getPool(), () => at);
    expect(await restarted.create(principal(), command())).toEqual(first);
    expect(await restarted.get(principal(), first.intakeId)).toEqual(first);

    const rows = await database.getPool().query(
      'SELECT input_snapshot,intake_record FROM markreg_early_funnel_intakes WHERE workspace_id=$1',
      [workspaceId]
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.input_snapshot).toEqual(first.input);
    expect(rows.rows[0]?.intake_record).toEqual(first);

    const audit = await database.getPool().query(
      'SELECT action,actor_id,source_lineage FROM markreg_early_funnel_audit WHERE workspace_id=$1',
      [workspaceId]
    );
    expect(audit.rows).toEqual([
      expect.objectContaining({
        action: 'PRODUCTION_INTAKE_CREATED',
        actor_id: 'user_task0608',
        source_lineage: expect.objectContaining({ sourceClass: 'CUSTOMER_SUPPLIED' })
      })
    ]);

    expect(
      (
        await database.getPool().query(
          `SELECT
            (SELECT count(*)::int FROM markreg_early_funnel_recommendations) AS recommendations,
            (SELECT count(*)::int FROM markreg_early_funnel_selections) AS selections,
            (SELECT count(*)::int FROM markreg_early_funnel_quotes) AS quotes`
        )
      ).rows[0]
    ).toEqual({ recommendations: 0, selections: 0, quotes: 0 });
  });

  it('rejects materially different replay and isolates idempotency by Workspace', async () => {
    const first = await service().create(principal(), command());
    await expect(
      service().create(
        principal(),
        command({
          input: {
            ...command().input,
            filingGoal: 'A materially different filing goal.'
          }
        })
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });

    const other = await service().create(principal(otherWorkspaceId), command());
    expect(other.workspaceId).toBe(otherWorkspaceId);
    expect(other.intakeId).not.toBe(first.intakeId);
    await expect(service().get(principal(otherWorkspaceId), first.intakeId)).rejects.toMatchObject({
      code: 'PRODUCTION_INTAKE_NOT_FOUND',
      status: 404
    });
  });

  it('enforces create/read permissions', async () => {
    await expect(
      service().create(principal(workspaceId, ['workspace:read']), command())
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });

    const created = await service().create(principal(), command());
    await expect(
      service().get(principal(workspaceId, ['matter:create']), created.intakeId)
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
  });

  it('maps database unavailability to retryable 503', async () => {
    const unavailable = new PostgresProductionIntakeService(
      { transact: () => Promise.reject(new Error('offline')) },
      { query: () => Promise.reject(new Error('offline')) } as never
    );
    await expect(unavailable.get(principal(), 'intake_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});
