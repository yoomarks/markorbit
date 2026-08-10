import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  migrationStatus,
  parseDatabaseConfig,
  verifyMigrations,
  type Migration
} from '../packages/persistence/dist/index.js';

const required = process.env.MILESTONE2_MIGRATIONS_REQUIRED === '1';
const urls = {
  Core: process.env.CORE_TEST_DATABASE_URL ?? process.env.IDENTITY_TEST_DATABASE_URL,
  MarkReg: process.env.MARKREG_TEST_DATABASE_URL,
  Execution: process.env.EXECUTION_TEST_DATABASE_URL
} as const;
if (required)
  for (const [owner, url] of Object.entries(urls))
    if (!url) throw new Error(`${owner} owner database URL is required.`);
const suite = Object.values(urls).every(Boolean) ? describe : describe.skip;
const migrationDirectory = path.resolve('infrastructure/persistence/migrations');
const ownershipFile = path.resolve('infrastructure/persistence/migration-owners.json');
const packages = {
  Core: '@markorbit/core-service',
  MarkReg: '@markorbit/markreg-service',
  Execution: '@markorbit/execution-service'
} as const;
const namespaces = { Core: 'core', MarkReg: 'markreg', Execution: 'execution' } as const;
const ownedTables = {
  Core: ['users', 'workspaces', 'workspace_memberships', 'sessions'],
  MarkReg: [
    'customer_confirmations',
    'matter_drafts',
    'formal_matters',
    'formal_matter_commands',
    'formal_matter_audit',
    'document_packages',
    'document_package_items',
    'document_instruction_entries',
    'document_package_commands',
    'document_package_audit',
    'markreg_denial_audit',
    'markreg_lifecycle_commands',
    'markreg_lifecycle_events',
    'markreg_lifecycle_views',
    'orders',
    'order_commands',
    'order_audit'
  ],
  Execution: [
    'execution_evidence_review_sources',
    'execution_evidence_review_decisions',
    'execution_evidence_correction_requests',
    'execution_evidence_review_commands',
    'execution_evidence_review_audit',
    'execution_provider_return_evidence_receipts',
    'execution_provider_return_evidence_commands',
    'execution_provider_return_evidence_audit',
    'professional_review_cases',
    'professional_review_commands',
    'professional_review_audit',
    'filing_authorizations',
    'execution_releases',
    'filing_execution_task_drafts',
    'filing_governance_commands',
    'filing_governance_audit'
  ]
} as const;
const databases: ManagedDatabase[] = [];
const open = async (owner: keyof typeof urls) => {
  const database = new ManagedDatabase(
    parseDatabaseConfig({
      NODE_ENV: 'test',
      DATABASE_URL: urls[owner],
      DB_MIGRATION_NAMESPACE: namespaces[owner],
      DB_APPLICATION_NAME: `task-026-${owner.toLowerCase()}`
    })
  );
  await database.start();
  databases.push(database);
  return database;
};
const migrations = (owner: keyof typeof urls) =>
  loadMigrationsForOwner(migrationDirectory, ownershipFile, packages[owner]);
const migrationOwnedTables = (loaded: Migration[]) => [
  ...new Set(
    loaded.flatMap((migration) =>
      [...migration.sql.matchAll(/\bCREATE TABLE\s+([a-z][a-z0-9_]*)\s*\(/gi)].map(
        (match) => match[1]!
      )
    )
  )
];
const migrationOwnedFunctions = (loaded: Migration[]) => [
  ...new Set(
    loaded.flatMap((migration) =>
      [...migration.sql.matchAll(/\bCREATE FUNCTION\s+([a-z][a-z0-9_]*)\s*\(/gi)].map(
        (match) => match[1]!
      )
    )
  )
];
const reset = async (database: ManagedDatabase, owner: keyof typeof urls) => {
  const loaded = await migrations(owner);
  const tables = migrationOwnedTables(loaded);
  const functions = migrationOwnedFunctions(loaded);
  const pool = database.getPool();
  if (tables.length)
    await pool.query(
      `DROP TABLE IF EXISTS ${tables.map((table) => `"${table}"`).join(',')} CASCADE`
    );
  for (const functionName of functions)
    await pool.query(`DROP FUNCTION IF EXISTS "${functionName}"() CASCADE`);
  await pool.query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
};
afterAll(async () => {
  for (const database of databases.reverse()) await database.close();
});

suite.sequential('TASK 026 owner migration reliability matrix', () => {
  for (const owner of Object.keys(urls) as (keyof typeof urls)[]) {
    it(`MIG-001 ${owner} empty bootstrap applies only owned migrations and reaches database readiness`, async () => {
      const database = await open(owner);
      await reset(database, owner);
      const loaded = await migrations(owner);
      const result = await migrate(database.getPool(), namespaces[owner], loaded);
      expect(result.every((record) => record.state === 'applied')).toBe(true);
      await verifyMigrations(database.getPool(), namespaces[owner], loaded);
      expect((await database.getPool().query('SELECT 1 AS ready')).rows[0]).toEqual({ ready: 1 });
      const relations = await database
        .getPool()
        .query<{ name: string }>(
          "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'"
        );
      expect(relations.rows.map((row) => row.name).sort()).toEqual([...ownedTables[owner]].sort());
    });
    it(`MIG-002 ${owner} repeated application is an exact no-op`, async () => {
      const database = await open(owner);
      const loaded = await migrations(owner);
      const before = await migrationStatus(database.getPool(), namespaces[owner], loaded);
      await migrate(database.getPool(), namespaces[owner], loaded);
      const after = await migrationStatus(database.getPool(), namespaces[owner], loaded);
      expect(
        after.map(({ version, name, checksum, state }) => ({ version, name, checksum, state }))
      ).toEqual(
        before.map(({ version, name, checksum, state }) => ({ version, name, checksum, state }))
      );
      const history = await database
        .getPool()
        .query(
          'SELECT version,count(*)::int AS count FROM markorbit_persistence.migration_history WHERE namespace=$1 GROUP BY version',
          [namespaces[owner]]
        );
      expect(history.rows.every((row) => row.count === 1)).toBe(true);
    });
  }

  it('MIG-003 Core upgrades durable identity evidence from 0018 through Sessions without rewriting it', async () => {
    const database = await open('Core');
    await reset(database, 'Core');
    const loaded = await migrations('Core');
    await migrate(database.getPool(), 'core', loaded.slice(0, 1));
    const ids = [
      '01900000-0000-7000-8000-260000000001',
      '01900000-0000-7000-8000-260000000002',
      '01900000-0000-7000-8000-260000000003'
    ];
    await database
      .getPool()
      .query(
        "INSERT INTO users(user_id,email,normalized_email,display_name) VALUES($1,'prior@example.test','prior@example.test','Prior User')",
        [ids[0]]
      );
    await database
      .getPool()
      .query(
        "INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Prior Workspace','prior-workspace')",
        [ids[1]]
      );
    await database
      .getPool()
      .query(
        "INSERT INTO workspace_memberships(membership_id,workspace_id,user_id,role) VALUES($1,$2,$3,'WORKSPACE_ADMIN')",
        [ids[2], ids[1], ids[0]]
      );
    await migrate(database.getPool(), 'core', loaded);
    expect(
      (
        await database
          .getPool()
          .query('SELECT user_id,version FROM users WHERE user_id=$1', [ids[0]])
      ).rows[0]
    ).toEqual({ user_id: ids[0], version: 1 });
    expect(
      (await database.getPool().query("SELECT to_regclass('sessions') AS relation")).rows[0]
        .relation
    ).toBe('sessions');
  });

  it('MIG-003 MarkReg upgrades pre-0025 audit evidence additively and protects it append-only', async () => {
    const database = await open('MarkReg');
    await reset(database, 'MarkReg');
    const loaded = await migrations('MarkReg');
    const prior = loaded.filter((m) => m.version < '0025');
    await migrate(database.getPool(), 'markreg', prior);
    const pre0025History = await database
      .getPool()
      .query(
        "SELECT 1 FROM markorbit_persistence.migration_history WHERE namespace='markreg' AND version='0025'"
      );
    expect(pre0025History.rowCount).toBe(0);
    expect(
      (
        await database
          .getPool()
          .query(
            "SELECT to_regprocedure('public.reject_markreg_audit_mutation()')::text AS function_name"
          )
      ).rows[0].function_name
    ).toBeNull();
    expect(
      (await database.getPool().query("SELECT to_regclass('markreg_denial_audit') AS relation"))
        .rows[0].relation
    ).toBeNull();
    const workspace = '01900000-0000-7000-8000-260000000010';
    await database
      .getPool()
      .query(
        "INSERT INTO formal_matters(formal_matter_id,workspace_id,kind,status,version,source_customer_confirmation_id,source_customer_confirmation_version,source_matter_draft_id,source_matter_draft_version,source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,snapshot_sha256,created_by_user_id,created_at,updated_at) VALUES('formal-matter_prior',$1,'TRADEMARK_REGISTRATION','OPEN',1,'confirmation',1,'draft',1,'quote','1','{}',1,$2,'actor',now(),now())",
        [workspace, 'a'.repeat(64)]
      );
    await database
      .getPool()
      .query(
        "INSERT INTO formal_matter_audit(workspace_id,formal_matter_id,action,actor_id,created_at) VALUES($1,'formal-matter_prior','FORMAL_MATTER_CREATED','actor',now())",
        [workspace]
      );
    const before = (
      await database
        .getPool()
        .query(
          "SELECT formal_matter_id,version,snapshot_sha256 FROM formal_matters WHERE formal_matter_id='formal-matter_prior'"
        )
    ).rows[0];
    await migrate(database.getPool(), 'markreg', loaded);
    expect(
      (
        await database
          .getPool()
          .query(
            "SELECT formal_matter_id,version,snapshot_sha256 FROM formal_matters WHERE formal_matter_id='formal-matter_prior'"
          )
      ).rows[0]
    ).toEqual(before);
    await expect(database.getPool().query('DELETE FROM formal_matter_audit')).rejects.toMatchObject(
      { code: '55000' }
    );
    expect(
      (await database.getPool().query("SELECT to_regclass('markreg_denial_audit') AS relation"))
        .rows[0].relation
    ).toBe('markreg_denial_audit');
  });

  it('MIG-003 Execution retains exact Professional Review evidence across repeated forward application', async () => {
    const database = await open('Execution');
    await reset(database, 'Execution');
    const loaded = await migrations('Execution');
    await migrate(database.getPool(), 'execution', loaded);
    const workspace = '01900000-0000-7000-8000-260000000020';
    await database
      .getPool()
      .query(
        "INSERT INTO professional_review_cases(professional_review_case_id,workspace_id,formal_matter_id,source_formal_matter_version,source_snapshot_sha256,status,version,review_case,created_by,updated_by,created_at,updated_at) VALUES('professional-review_prior',$1,'formal-matter_prior',1,$2,'IN_REVIEW',2,'{}','actor','actor',now(),now())",
        [workspace, 'b'.repeat(64)]
      );
    const before = (
      await database
        .getPool()
        .query(
          "SELECT professional_review_case_id,version,status,source_snapshot_sha256 FROM professional_review_cases WHERE professional_review_case_id='professional-review_prior'"
        )
    ).rows[0];
    await migrate(database.getPool(), 'execution', loaded);
    expect(
      (
        await database
          .getPool()
          .query(
            "SELECT professional_review_case_id,version,status,source_snapshot_sha256 FROM professional_review_cases WHERE professional_review_case_id='professional-review_prior'"
          )
      ).rows[0]
    ).toEqual(before);
  });

  it('MIG-004 rolls back interrupted test-only DDL, omits history, releases lock and retries cleanly', async () => {
    const database = await open('Core');
    const broken: Migration = {
      version: '9001',
      name: 'task026_interrupted',
      sql: 'CREATE TABLE task026_rollback_probe(id int); SELECT invalid syntax',
      checksum: 'broken'
    };
    await expect(
      migrate(database.getPool(), 'task026_interrupted', [broken])
    ).rejects.toMatchObject({ code: 'MIGRATION_EXECUTION_FAILED' });
    expect(
      (await database.getPool().query("SELECT to_regclass('task026_rollback_probe') AS relation"))
        .rows[0].relation
    ).toBeNull();
    expect(
      (
        await database
          .getPool()
          .query(
            "SELECT 1 FROM markorbit_persistence.migration_history WHERE namespace='task026_interrupted'"
          )
      ).rowCount
    ).toBe(0);
    const clean = {
      ...broken,
      sql: 'CREATE TABLE task026_rollback_probe(id int)',
      checksum: 'clean'
    };
    await migrate(database.getPool(), 'task026_interrupted', [clean]);
    expect(
      (await database.getPool().query("SELECT to_regclass('task026_rollback_probe') AS relation"))
        .rows[0].relation
    ).toBe('task026_rollback_probe');
    await database.getPool().query('DROP TABLE task026_rollback_probe');
  });

  it('MIG-005 rejects altered test-loaded content without touching committed files', async () => {
    const database = await open('Core'),
      loaded = await migrations('Core');
    const altered = [{ ...loaded[0]!, checksum: '0'.repeat(64) }, ...loaded.slice(1)];
    await expect(verifyMigrations(database.getPool(), 'core', altered)).rejects.toMatchObject({
      code: 'MIGRATION_CHECKSUM_MISMATCH'
    });
  });

  it('MIG-006 owner loaders return disjoint, exhaustively owned version sets', async () => {
    const sets = await Promise.all(
      (Object.keys(urls) as (keyof typeof urls)[]).map(
        async (owner) => new Set((await migrations(owner)).map((m) => `${m.version}_${m.name}`))
      )
    );
    for (let i = 0; i < sets.length; i++)
      for (let j = i + 1; j < sets.length; j++)
        expect([...sets[i]!].filter((key) => sets[j]!.has(key))).toEqual([]);
    expect(sets.reduce((count, set) => count + set.size, 0)).toBe(13);
    expect(sets[1]).toContain('0034_markreg_lifecycle_projection');
    expect(sets[2]).toContain('0027_execution_filing_governance');
    expect(sets[2]).toContain('0032_execution_provider_return_evidence');
    expect(sets[2]).toContain('0033_execution_evidence_review');
  });
});
