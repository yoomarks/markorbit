import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EntitlementGrantV1 } from '@markorbit/contracts/workspace-commercial';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresWorkspaceRepository } from '../src/identity.js';
import { PostgresWorkspaceCommercialRepositoryV1 } from '../src/workspace-commercial-postgres.js';
import { WorkspaceCommercialServiceV1 } from '../src/workspace-commercial.js';

const url = process.env.CORE_COMMERCIAL_SCALE_TEST_DATABASE_URL;
if (process.env.CORE_COMMERCIAL_SCALE_POSTGRES_REQUIRED === '1' && !url)
  throw new Error('Required Core scale evidence needs CORE_COMMERCIAL_SCALE_TEST_DATABASE_URL.');
if (url) {
  const parsed = new URL(url);
  if (
    !['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(parsed.hostname) ||
    parsed.pathname !== '/markorbit_core_entitlement_scale_test'
  )
    throw new Error('Core scale evidence requires its isolated local test database.');
}
const integration = url ? describe : describe.skip;
const t0 = '2026-09-15T00:00:00.000Z';
const t1 = '2026-10-01T00:00:00.000Z';
const t2 = '2026-10-02T00:00:00.000Z';
const entitlementKey = 'fixture.data_engine.us.name';
const samples = 30;
let database: ManagedDatabase;
let repository: PostgresWorkspaceCommercialRepositoryV1;
let service: WorkspaceCommercialServiceV1;
const targetWorkspace = randomUUID();
const otherWorkspace = randomUUID();
const measurements: unknown[] = [];

function grant(overrides: Partial<EntitlementGrantV1> = {}): EntitlementGrantV1 {
  return {
    schemaVersion: 1,
    grantId: 'fixture-target',
    version: 1,
    subject: { scope: 'WORKSPACE', workspaceId: targetWorkspace },
    entitlement: {
      key: entitlementKey,
      subjectScope: 'WORKSPACE',
      value: { kind: 'BOOLEAN', enabled: true }
    },
    status: 'ACTIVE',
    sourceType: 'MANUAL',
    sourceRef: 'synthetic:M20-C3',
    effectiveFrom: t0,
    recordedAt: t0,
    ...overrides
  };
}

async function resolve(asOf = t2, key = entitlementKey, workspaceId = targetWorkspace) {
  return service.resolveEntitlement({ scope: 'WORKSPACE', workspaceId }, key, asOf);
}

integration('PostgreSQL Core entitlement resolver scale evidence', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'core_entitlement_scale',
        DB_APPLICATION_NAME: 'markorbit-m20-c3-scale-evidence'
      })
    );
    await database.start();
    await migrate(
      database.getPool(),
      'core_entitlement_scale',
      await loadMigrationsForOwner(
        path.resolve('../../infrastructure/persistence/migrations'),
        path.resolve('../../infrastructure/persistence/migration-owners.json'),
        '@markorbit/core-service'
      )
    );
    const workspaces = new PostgresWorkspaceRepository(database.getPool());
    for (const workspaceId of [targetWorkspace, otherWorkspace])
      await workspaces.create({ workspaceId, name: 'Scale fixture', slug: `scale-${workspaceId}` });
    repository = new PostgresWorkspaceCommercialRepositoryV1(database);
    service = new WorkspaceCommercialServiceV1(repository, () => Promise.resolve(undefined));
  }, 60_000);

  afterAll(async () => {
    try {
      if (database && measurements.length) {
        const environment = await database.getPool().query<Record<string, unknown>>(
          `SELECT version() AS postgres_version, current_setting('shared_buffers') AS shared_buffers,
                  current_setting('work_mem') AS work_mem,
                  current_setting('statement_timeout') AS statement_timeout`
        );
        const report = {
          schemaVersion: 1,
          fixture: 'synthetic:M20-C3; Workspace direct grants only; serial warm reads',
          commit: process.env.CORE_COMMERCIAL_SCALE_COMMIT_SHA ?? 'local-unrecorded',
          node: process.version,
          platform: `${os.platform()} ${os.release()} ${os.arch()}`,
          cpu: os.cpus()[0]?.model,
          cpuCount: os.cpus().length,
          totalMemoryBytes: os.totalmem(),
          database: environment.rows[0],
          measurements
        };
        console.info(`M20_C3_SCALE_EVIDENCE ${JSON.stringify(report)}`);
        if (process.env.CORE_COMMERCIAL_SCALE_EVIDENCE_PATH)
          await writeFile(
            process.env.CORE_COMMERCIAL_SCALE_EVIDENCE_PATH,
            `${JSON.stringify(report, null, 2)}\n`
          );
      }
    } finally {
      if (database) await database.close();
    }
  });

  for (const recordCount of [1_000, 10_000, 100_000])
    it(`measures the unchanged resolver with ${recordCount} grant-version rows`, async () => {
      await database.getPool().query('TRUNCATE core_workspace_commercial_records');
      await repository.appendGrant(grant());
      // Bulk synthetic history preserves the real migration's indexes and append-only trigger.
      await database.getPool().query(
        `INSERT INTO core_workspace_commercial_records
          (record_type,aggregate_id,version,workspace_id,commercial_kind,effective_from,record_json,recorded_at)
         SELECT 'ENTITLEMENT_GRANT', 'noise-' || ((i-1)/2)::text, (i-1)%2+1,
           $2::uuid, $3, $4::timestamptz,
           $1::jsonb || jsonb_build_object('grantId','noise-' || ((i-1)/2)::text,
             'version',(i-1)%2+1, 'status',CASE WHEN i%2=0 THEN 'REVOKED' ELSE 'ACTIVE' END),
           $4::timestamptz
         FROM generate_series(1,$5::integer) AS i`,
        [
          JSON.stringify(grant({ subject: { scope: 'WORKSPACE', workspaceId: otherWorkspace } })),
          otherWorkspace,
          entitlementKey,
          t0,
          recordCount - 1
        ]
      );
      await database.getPool().query('ANALYZE core_workspace_commercial_records');
      const querySpy = vi.spyOn(database.getPool(), 'query');
      let actualQuery: readonly [string, readonly unknown[]];
      let logicalJsonBytes: number;
      try {
        const rows = await repository.listGrants();
        expect(rows).toHaveLength(recordCount);
        logicalJsonBytes = rows.reduce(
          (sum, row) => sum + Buffer.byteLength(JSON.stringify(row)),
          0
        );
        actualQuery = querySpy.mock.calls.at(-1) as unknown as typeof actualQuery;
        expect(typeof actualQuery[0]).toBe('string');
        expect(actualQuery[1]).toEqual(['ENTITLEMENT_GRANT']);
      } finally {
        // Do not retain query results during timing or replace the real query implementation.
        querySpy.mockRestore();
      }
      const plan = await database
        .getPool()
        .query<Record<string, unknown>>(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${actualQuery[0]}`,
          [...actualQuery[1]]
        );
      const queryPlan = plan.rows[0]!['QUERY PLAN'] as { Plan: Record<string, unknown> }[];
      expect(queryPlan[0]!.Plan['Actual Rows']).toBe(recordCount);
      for (let i = 0; i < 3; i++) await resolve();
      const elapsedMs: number[] = [];
      for (let i = 0; i < samples; i++) {
        const started = performance.now();
        const result = await resolve();
        elapsedMs.push(performance.now() - started);
        expect(result.value).toEqual({ kind: 'BOOLEAN', enabled: true });
        expect(result.contributingGrantRefs).toEqual([{ grantId: 'fixture-target', version: 1 }]);
      }
      const sorted = [...elapsedMs].sort((a, b) => a - b);
      measurements.push({
        grantVersionRows: recordCount,
        returnedRowsPerRead: recordCount,
        logicalJsonBytesPerRead: logicalJsonBytes,
        samples,
        warmups: 3,
        elapsedMs,
        p50Ms: sorted[Math.ceil(samples * 0.5) - 1],
        p95Ms: sorted[Math.ceil(samples * 0.95) - 1],
        maxMs: sorted.at(-1),
        actualQuery: actualQuery[0],
        explainAnalyzeBuffers: queryPlan
      });
    }, 120_000);

  it('preserves revocation, historical reads, false values and subject/key isolation at scale', async () => {
    await repository.appendGrant(grant({ version: 2, status: 'REVOKED', recordedAt: t1 }));
    await expect(resolve()).rejects.toMatchObject({ code: 'NO_APPLICABLE_ENTITLEMENT' });
    expect((await resolve(t0)).contributingGrantRefs).toEqual([
      { grantId: 'fixture-target', version: 1 }
    ]);
    await repository.appendGrant(
      grant({
        version: 3,
        recordedAt: t2,
        entitlement: {
          key: entitlementKey,
          subjectScope: 'WORKSPACE',
          value: { kind: 'BOOLEAN', enabled: false }
        }
      })
    );
    expect((await resolve()).value).toEqual({ kind: 'BOOLEAN', enabled: false });
    await expect(resolve(t1)).rejects.toMatchObject({ code: 'NO_APPLICABLE_ENTITLEMENT' });
    await expect(resolve(t2, 'fixture.missing')).rejects.toMatchObject({
      code: 'NO_APPLICABLE_ENTITLEMENT'
    });
    await expect(resolve(t2, entitlementKey, randomUUID())).rejects.toMatchObject({
      code: 'NO_APPLICABLE_ENTITLEMENT'
    });
    await repository.appendGrant(grant({ version: 4, recordedAt: '2026-10-03T00:00:00.000Z' }));
    expect((await resolve()).value).toEqual({ kind: 'BOOLEAN', enabled: false });

    const moving = grant({
      grantId: 'fixture-moving',
      entitlement: {
        key: 'fixture.old-key',
        subjectScope: 'WORKSPACE',
        value: { kind: 'BOOLEAN', enabled: true }
      }
    });
    await repository.appendGrant(moving);
    await repository.appendGrant({
      ...moving,
      version: 2,
      subject: { scope: 'WORKSPACE', workspaceId: otherWorkspace },
      entitlement: { ...moving.entitlement, key: 'fixture.new-key' },
      recordedAt: t1
    });
    await expect(resolve(t2, 'fixture.old-key')).rejects.toMatchObject({
      code: 'NO_APPLICABLE_ENTITLEMENT'
    });
    await expect(resolve(t2, 'fixture.new-key')).rejects.toMatchObject({
      code: 'NO_APPLICABLE_ENTITLEMENT'
    });
    expect((await resolve(t0, 'fixture.old-key')).contributingGrantRefs).toEqual([
      { grantId: 'fixture-moving', version: 1 }
    ]);
    expect((await resolve(t2, 'fixture.new-key', otherWorkspace)).contributingGrantRefs).toEqual([
      { grantId: 'fixture-moving', version: 2 }
    ]);
    await repository.appendGrant(
      grant({
        grantId: 'fixture-window',
        effectiveFrom: t1,
        effectiveTo: t2,
        entitlement: { ...moving.entitlement, key: 'fixture.window' }
      })
    );
    await expect(resolve(t0, 'fixture.window')).rejects.toMatchObject({
      code: 'NO_APPLICABLE_ENTITLEMENT'
    });
    expect((await resolve(t1, 'fixture.window')).value).toEqual({ kind: 'BOOLEAN', enabled: true });
    await expect(resolve(t2, 'fixture.window')).rejects.toMatchObject({
      code: 'NO_APPLICABLE_ENTITLEMENT'
    });
  }, 30_000);
});
