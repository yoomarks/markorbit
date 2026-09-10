import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresLiteWorkItemStore } from '../src/lite-work-item.js';

const url = process.env.LITE_WORK_ITEM_TEST_DATABASE_URL;
const required = process.env.LITE_WORK_ITEM_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_WORK_ITEM_TEST_DATABASE_URL is required when LITE_WORK_ITEM_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceId = '12121212-1212-4212-8212-121212121212';
const otherWorkspaceId = '13131313-1313-4313-8313-131313131313';
const sourceFingerprint = 'a'.repeat(64);
const preparationFingerprint = 'b'.repeat(64);

function idSequence(prefix = 'lite-work-item_test') {
  let value = 0;
  return () => `${prefix}-${++value}` as `lite-work-item_${string}`;
}

suite('PostgreSQL Lite Work Item owner runtime', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-work-item-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_work_item_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 8, 10, 10, tick++)).toISOString();
  const ids = idSequence();

  function store() {
    return new PostgresLiteWorkItemStore(database, database.getPool(), now, ids);
  }

  function manualInput(
    idempotencyKey: string,
    overrides: Partial<{
      workspaceId: string;
      title: string;
      assigneePrincipalId: string;
      internalDueAt: string;
    }> = {}
  ) {
    return {
      workspaceId: overrides.workspaceId ?? workspaceId,
      actorPrincipalId: 'principal_agency_owner',
      idempotencyKey,
      taskType: 'GENERAL_FOLLOW_UP' as const,
      title: overrides.title ?? 'Follow up agency matter',
      priority: 'NOTICE' as const,
      ...(overrides.assigneePrincipalId
        ? { assigneePrincipalId: overrides.assigneePrincipalId }
        : {}),
      ...(overrides.internalDueAt
        ? {
            internalTiming: {
              timeClass: 'LITE_INTERNAL_OPERATIONAL' as const,
              internalDueAt: overrides.internalDueAt,
              certifiedLegalDeadline: false as const
            }
          }
        : {})
    };
  }

  function systemInput() {
    return {
      workspaceId,
      taskType: 'CHECK_DEADLINE' as const,
      title: 'Review observed deadline candidate',
      priority: 'IMPORTANT' as const,
      source: {
        sourceClass: 'SYSTEM_PREPARED' as const,
        sourceReferences: [
          {
            owner: 'DATA_ENGINE' as const,
            kind: 'DATA_ENGINE_OBSERVATION' as const,
            sourceId: 'observation_us-001',
            sourceVersion: 7,
            sourceFingerprintSha256: sourceFingerprint,
            observedAt: '2026-09-10T09:00:00.000Z'
          }
        ],
        preparationFingerprintSha256: preparationFingerprint,
        idempotencyKey: 'system-work-001',
        preparedAt: '2026-09-10T09:30:00.000Z'
      },
      observedDateCandidates: [
        {
          label: 'Observed response date',
          candidateAt: '2026-09-20T00:00:00.000Z',
          source: {
            owner: 'DATA_ENGINE' as const,
            kind: 'DATA_ENGINE_OBSERVATION' as const,
            sourceId: 'observation_us-001',
            sourceVersion: 7,
            sourceFingerprintSha256: sourceFingerprint,
            observedAt: '2026-09-10T09:00:00.000Z'
          },
          observedAt: '2026-09-10T09:00:00.000Z',
          legalDeadlineCertified: false as const,
          officialTruthVerified: false as const
        }
      ]
    };
  }

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
    await migrate(database.getPool(), 'lite_work_item_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Work Item Test','work-item-test'),
       ($2,'Work Item Other','work-item-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  }, 30000);

  beforeEach(async () => {
    tick = 0;
    await database.getPool().query('TRUNCATE lite_work_item_commands,lite_work_items CASCADE');
  });

  afterAll(async () => {
    await database.close();
  });

  it('persists manual create, replay, conflict and Workspace-scoped idempotency', async () => {
    const service = store();
    const command = manualInput('manual-1');
    const created = await service.createManual(command);
    const replay = await service.createManual(command);
    const normalizedReplay = await service.createManual({
      ...command,
      title: '  Follow up agency matter  '
    });
    expect(replay).toEqual(created);
    expect(normalizedReplay).toEqual(created);
    expect(created).toMatchObject({ version: 1, status: 'OPEN', workspaceId });
    expect(created.authorityConsequences.workCompletionRepresentsExternalSuccess).toBe(false);

    await expect(
      service.createManual({ ...command, title: 'Different request with same key' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    const other = await service.createManual(
      manualInput('manual-1', { workspaceId: otherWorkspaceId, title: 'Other Workspace work' })
    );
    expect(other.workspaceId).toBe(otherWorkspaceId);
    expect(await service.get(otherWorkspaceId, other.liteWorkItemId)).toEqual(other);
    expect(await service.get(workspaceId, other.liteWorkItemId)).toBeUndefined();

    const reconstructed = store();
    expect(await reconstructed.get(workspaceId, created.liteWorkItemId)).toEqual(created);
  });

  it('persists deterministic SYSTEM_PREPARED lineage and replays across store reconstruction', async () => {
    const firstStore = store();
    const command = systemInput();
    const created = await firstStore.createSystemPrepared(command);
    expect(created.source).toEqual(command.source);
    expect(created.observedDateCandidates[0]).toMatchObject({
      legalDeadlineCertified: false,
      officialTruthVerified: false
    });

    const reconstructed = store();
    const replay = await reconstructed.createSystemPrepared(command);
    expect(replay).toEqual(created);
    expect(await reconstructed.get(workspaceId, created.liteWorkItemId)).toEqual(created);
  });

  it('lists deterministically with bounded status and assignee filters without Workspace leakage', async () => {
    const service = store();
    const later = await service.createManual(
      manualInput('list-later', {
        title: 'Later due',
        assigneePrincipalId: 'principal_mile',
        internalDueAt: '2026-09-14T10:00:00.000Z'
      })
    );
    const earliest = await service.createManual(
      manualInput('list-earliest', {
        title: 'Earliest due',
        assigneePrincipalId: 'principal_mile',
        internalDueAt: '2026-09-12T10:00:00.000Z'
      })
    );
    const unassigned = await service.createManual(
      manualInput('list-unassigned', { title: 'No assignee' })
    );
    await service.createManual(
      manualInput('list-other', { workspaceId: otherWorkspaceId, title: 'Private other work' })
    );

    const assigned = await service.list(workspaceId, {
      statuses: ['OPEN'],
      assigneePrincipalId: 'principal_mile'
    });
    expect(assigned.map((item) => item.liteWorkItemId)).toEqual([
      earliest.liteWorkItemId,
      later.liteWorkItemId
    ]);
    expect(await service.list(workspaceId, { assigneePrincipalId: null })).toEqual([unassigned]);
    expect(
      (await service.list(workspaceId)).every((item) => item.workspaceId === workspaceId)
    ).toBe(true);
  });

  it('updates internal fields with exact CAS and durable command replay', async () => {
    const service = store();
    const created = await service.createManual(manualInput('patch-create'));
    const command = {
      workspaceId,
      liteWorkItemId: created.liteWorkItemId,
      expectedVersion: 1,
      idempotencyKey: 'patch-1',
      title: 'Reply to provider today',
      priority: 'URGENT' as const,
      assigneePrincipalId: 'principal_mile',
      internalTiming: {
        timeClass: 'LITE_INTERNAL_OPERATIONAL' as const,
        internalDueAt: '2026-09-11T09:00:00.000Z',
        remindAt: '2026-09-11T08:00:00.000Z',
        followUpAt: '2026-09-12T09:00:00.000Z',
        certifiedLegalDeadline: false as const
      }
    };
    const updated = await service.updateInternalFields(command);
    expect(updated).toMatchObject({
      version: 2,
      title: 'Reply to provider today',
      priority: 'URGENT'
    });
    expect(updated.internalTiming.certifiedLegalDeadline).toBe(false);
    expect(await store().updateInternalFields(command)).toEqual(updated);

    await expect(
      service.updateInternalFields({
        ...command,
        idempotencyKey: 'patch-stale',
        expectedVersion: 1,
        title: 'Stale write'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await service.get(workspaceId, created.liteWorkItemId))?.version).toBe(2);
  });

  it('persists the allowed lifecycle and rejects forbidden transitions without external consequence', async () => {
    const service = store();
    const open = await service.createManual(manualInput('state-create'));
    const waiting = await service.transitionStatus({
      workspaceId,
      liteWorkItemId: open.liteWorkItemId,
      expectedVersion: 1,
      toStatus: 'WAITING_FOR_CLIENT',
      idempotencyKey: 'state-wait'
    });
    expect(waiting.waitingSinceAt).not.toBeNull();
    const completed = await service.transitionStatus({
      workspaceId,
      liteWorkItemId: waiting.liteWorkItemId,
      expectedVersion: 2,
      toStatus: 'COMPLETED',
      idempotencyKey: 'state-complete'
    });
    expect(completed).toMatchObject({ version: 3, status: 'COMPLETED', waitingSinceAt: null });
    expect(completed.completedAt).not.toBeNull();
    expect(completed.authorityConsequences.externalMessageSent).toBe(false);
    expect(completed.authorityConsequences.workCompletionRepresentsExternalSuccess).toBe(false);
    const archived = await service.transitionStatus({
      workspaceId,
      liteWorkItemId: completed.liteWorkItemId,
      expectedVersion: 3,
      toStatus: 'ARCHIVED',
      idempotencyKey: 'state-archive'
    });
    expect(archived).toMatchObject({ version: 4, status: 'ARCHIVED', archivedFrom: 'COMPLETED' });

    const another = await service.createManual(manualInput('state-forbidden'));
    await expect(
      service.transitionStatus({
        workspaceId,
        liteWorkItemId: another.liteWorkItemId,
        expectedVersion: 1,
        toStatus: 'ARCHIVED',
        idempotencyKey: 'state-bad-archive'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('fails closed when queryable owner columns drift from the validated document', async () => {
    const service = store();
    const created = await service.createManual(manualInput('corrupt-create'));
    await database
      .getPool()
      .query(
        "UPDATE lite_work_items SET status='CANCELLED' WHERE workspace_id=$1 AND lite_work_item_id=$2",
        [workspaceId, created.liteWorkItemId]
      );
    await expect(service.get(workspaceId, created.liteWorkItemId)).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE'
    });
  });
});
