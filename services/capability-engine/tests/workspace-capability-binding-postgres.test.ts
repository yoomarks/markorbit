import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  workspaceCapabilityBindingAuthorityV1,
  workspaceCapabilityBindingIdV1,
  type WorkspaceCapabilityBindingIdentityV1,
  type WorkspaceCapabilityBindingV1
} from '@markorbit/contracts/workspace-capability-binding';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresWorkspaceCapabilityBindingRepositoryV1 } from '../src/workspace-capability-binding-store.js';
import type { WorkspaceCapabilityBindingStoreError } from '../src/workspace-capability-binding-store.js';

const url = process.env.CAPABILITY_ENGINE_TEST_DATABASE_URL;
const required = process.env.CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED=1 requires CAPABILITY_ENGINE_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const capabilityMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/capability-engine');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'capability_engine_workspace_binding_test',
    DB_APPLICATION_NAME: 'markorbit-workspace-capability-binding-tests'
  });

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';
const INTELLIGENCE_ID = `brain-intelligence_${'a'.repeat(64)}` as const;
const EVIDENCE_ID = `brain-knowledge-evidence_${'b'.repeat(64)}` as const;
const PRIMITIVE_ID = `brain-intelligence-primitive_${'c'.repeat(64)}` as const;

function binding(boundAt = '2026-09-15T00:02:00.000Z'): WorkspaceCapabilityBindingV1 {
  const identity: WorkspaceCapabilityBindingIdentityV1 = {
    schemaVersion: 1,
    workspaceId: WORKSPACE,
    source: {
      intelligenceId: INTELLIGENCE_ID,
      task: 'TRADEMARK_ISSUE_EXTRACTION',
      projectionSha256: 'd'.repeat(64),
      generatedAt: '2026-09-15T00:01:00.000Z',
      evidenceRefs: [EVIDENCE_ID],
      primitiveRefs: [PRIMITIVE_ID],
      interpreter: {
        profileId: 'workspace-trademark-issue-interpreter',
        version: '1.0.0',
        policyProfileId: 'brain-policy-profile-v1'
      }
    },
    runtimeCapability: {
      id: 'runtime-capability_test-trademark-issue-routing',
      version: 3,
      capabilityId: 'test.trademark-issue-analysis',
      capabilityVersion: '1.0.0',
      canonReference: {
        canonId: 'test-wif05-canon',
        canonVersion: '1',
        sourceFingerprintSha256: 'e'.repeat(64)
      },
      acceptedCanonProjection: true
    },
    bindingPolicy: {
      policyId: 'workspace-capability-binding.v1',
      policyVersion: '1.0.0',
      ruleId: 'test-trademark-issue-analysis',
      reason: 'Test-only governed mapping.'
    },
    freshness: { status: 'NOT_EVALUATED', plannedStage: 'WIF-08' },
    authority: workspaceCapabilityBindingAuthorityV1
  };
  return { ...identity, bindingId: workspaceCapabilityBindingIdV1(identity), boundAt };
}
let database: ManagedDatabase;

function repository() {
  return new PostgresWorkspaceCapabilityBindingRepositoryV1(database, database.getPool());
}

async function reset() {
  await database.getPool().query('TRUNCATE capability_workspace_capability_bindings');
}

integration('durable Workspace Capability bindings', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await migrate(
      database.getPool(),
      'capability_engine_workspace_binding_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('survives repository restart and preserves the first immutable boundAt', async () => {
    const first = repository();
    const original = binding();
    await expect(first.record(original)).resolves.toEqual({ binding: original, replayed: false });

    const restarted = repository();
    await expect(restarted.find(WORKSPACE, original.bindingId)).resolves.toEqual(original);
    await expect(restarted.record(binding('2026-09-15T00:05:00.000Z'))).resolves.toEqual({
      binding: original,
      replayed: true
    });
  });

  it('keeps exact Workspace reads isolated without existence disclosure', async () => {
    const store = repository();
    const original = binding();
    await store.record(original);

    await expect(store.find(WORKSPACE, original.bindingId)).resolves.toEqual(original);
    await expect(store.find(OTHER_WORKSPACE, original.bindingId)).resolves.toBeUndefined();
  });

  it('serializes concurrent semantic replays to one immutable row', async () => {
    const store = repository();
    const original = binding();
    const alternateTime = binding('2026-09-15T00:05:00.000Z');
    const [left, right] = await Promise.all([store.record(original), store.record(alternateTime)]);

    expect([left.replayed, right.replayed].sort()).toEqual([false, true]);
    expect(left.binding.bindingId).toBe(right.binding.bindingId);
    const count = await database
      .getPool()
      .query('SELECT COUNT(*)::int AS count FROM capability_workspace_capability_bindings');
    const row = count.rows[0] as { count: number } | undefined;
    expect(row?.count).toBe(1);
  });
  it('fails closed when persisted mirror columns drift from the immutable snapshot', async () => {
    const store = repository();
    const original = binding();
    await store.record(original);
    await database
      .getPool()
      .query(
        'UPDATE capability_workspace_capability_bindings SET capability_version=$1 WHERE binding_id=$2',
        ['9.9.9', original.bindingId]
      );

    await expect(store.find(WORKSPACE, original.bindingId)).rejects.toMatchObject({
      code: 'PERSISTENCE_INTEGRITY_FAILURE'
    } satisfies Partial<WorkspaceCapabilityBindingStoreError>);
  });

  it('fails closed when persisted JSON changes without its document fingerprint', async () => {
    const store = repository();
    const original = binding();
    await store.record(original);
    await database.getPool().query(
      `UPDATE capability_workspace_capability_bindings
            SET document_json = jsonb_set(document_json, '{bindingPolicy,reason}', '"tampered"')
          WHERE binding_id=$1`,
      [original.bindingId]
    );

    await expect(store.find(WORKSPACE, original.bindingId)).rejects.toMatchObject({
      code: 'PERSISTENCE_INTEGRITY_FAILURE'
    } satisfies Partial<WorkspaceCapabilityBindingStoreError>);
  });
});
