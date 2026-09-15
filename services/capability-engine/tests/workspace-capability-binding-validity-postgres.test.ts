import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  workspaceCapabilityBindingValidityAuthorityV1,
  workspaceCapabilityBindingValidityObservationIdV1,
  type WorkspaceCapabilityBindingValidityIdentityV1,
  type WorkspaceCapabilityBindingValidityObservationV1
} from '@markorbit/contracts/workspace-capability-binding-validity';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  PostgresWorkspaceCapabilityBindingRevocationRepositoryV1,
  workspaceCapabilityBindingRevocationAuthorityV1,
  workspaceCapabilityBindingRevocationIdV1,
  type WorkspaceCapabilityBindingRevocationIdentityV1,
  type WorkspaceCapabilityBindingRevocationV1
} from '../src/workspace-capability-binding-revocation-store.js';
import { PostgresWorkspaceCapabilityBindingValidityRepositoryV1 } from '../src/workspace-capability-binding-validity-store.js';

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
    DB_MIGRATION_NAMESPACE: 'capability_engine_workspace_binding_validity_test',
    DB_APPLICATION_NAME: 'markorbit-workspace-capability-binding-validity-tests'
  });

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';
const BINDING_ID =
  'workspace-capability-binding_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BINDING_FINGERPRINT = 'b'.repeat(64);
const EVIDENCE_ID =
  'brain-knowledge-evidence_cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
let database: ManagedDatabase;

function revocation(
  reason = 'Manual governance revocation.'
): WorkspaceCapabilityBindingRevocationV1 {
  const identity: WorkspaceCapabilityBindingRevocationIdentityV1 = {
    schemaVersion: 1,
    workspaceId: WORKSPACE,
    bindingId: BINDING_ID,
    bindingFingerprintSha256: BINDING_FINGERPRINT,
    reason,
    authority: workspaceCapabilityBindingRevocationAuthorityV1
  };
  return {
    ...identity,
    revocationId: workspaceCapabilityBindingRevocationIdV1(identity),
    revokedAt: '2026-09-15T00:03:00.000Z'
  };
}

function observation(
  status: 'CURRENT' | 'CURRENTNESS_UNAVAILABLE' = 'CURRENT',
  evaluatedAt = '2026-09-15T00:04:00.000Z'
): WorkspaceCapabilityBindingValidityObservationV1 {
  const current = status === 'CURRENT';
  const identity: WorkspaceCapabilityBindingValidityIdentityV1 = {
    schemaVersion: 1,
    workspaceId: WORKSPACE,
    bindingId: BINDING_ID,
    bindingFingerprintSha256: BINDING_FINGERPRINT,
    status,
    usable: current,
    reasonCode: current ? 'ALL_CURRENT' : 'KNOWLEDGE_CURRENTNESS_UNAVAILABLE',
    basis: {
      sourceTruthSha256: 'd'.repeat(64),
      runtimeCapabilityTruthSha256: 'e'.repeat(64),
      policy: { status: 'CURRENT', fingerprintSha256: 'f'.repeat(64) },
      knowledge: {
        status: current ? 'CURRENT' : 'CURRENTNESS_UNAVAILABLE',
        evidenceRefs: [EVIDENCE_ID],
        ownerSnapshotSha256: '1'.repeat(64)
      },
      revocation: { status: 'NOT_REVOKED', fingerprintSha256: '2'.repeat(64) }
    },
    authority: workspaceCapabilityBindingValidityAuthorityV1
  };
  return {
    ...identity,
    observationId: workspaceCapabilityBindingValidityObservationIdV1(identity),
    evaluatedAt
  };
}

function revocations() {
  return new PostgresWorkspaceCapabilityBindingRevocationRepositoryV1(database, database.getPool());
}
function observations() {
  return new PostgresWorkspaceCapabilityBindingValidityRepositoryV1(database, database.getPool());
}

async function reset() {
  await database
    .getPool()
    .query(
      'TRUNCATE capability_workspace_capability_binding_validity_observations, capability_workspace_capability_binding_revocations'
    );
}

integration('durable Workspace Capability binding validity', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await migrate(
      database.getPool(),
      'capability_engine_workspace_binding_validity_test',
      await capabilityMigrations()
    );
  });
  beforeEach(reset);
  afterAll(async () => database.close());

  it('persists one immutable revocation and replays the same semantic fact', async () => {
    const store = revocations();
    const original = revocation();
    await expect(store.record(original)).resolves.toEqual({
      revocation: original,
      replayed: false
    });
    await expect(revocations().find(WORKSPACE, BINDING_ID)).resolves.toEqual(original);
    await expect(
      store.record({ ...original, revokedAt: '2026-09-15T00:09:00.000Z' })
    ).resolves.toEqual({
      revocation: original,
      replayed: true
    });
  });

  it('isolates revocation reads by Workspace and rejects conflicting semantics', async () => {
    const store = revocations();
    const original = revocation();
    await store.record(original);
    await expect(store.find(OTHER_WORKSPACE, BINDING_ID)).resolves.toBeUndefined();
    await expect(store.record(revocation('Different revocation basis.'))).rejects.toMatchObject({
      code: 'IDENTITY_CONFLICT'
    });
  });

  it('persists and replays immutable current-validity observations', async () => {
    const store = observations();
    const original = observation();
    await expect(store.record(original)).resolves.toEqual({
      observation: original,
      replayed: false
    });
    await expect(store.find(WORKSPACE, original.observationId)).resolves.toEqual(original);
    await expect(
      store.record({ ...original, evaluatedAt: '2026-09-15T00:08:00.000Z' })
    ).resolves.toEqual({ observation: original, replayed: true });
    await expect(store.find(OTHER_WORKSPACE, original.observationId)).resolves.toBeUndefined();
  });

  it('enforces append-only persistence for revocations and validity observations', async () => {
    const revocationValue = revocation();
    const observationValue = observation();
    await revocations().record(revocationValue);
    await observations().record(observationValue);

    await expect(
      database
        .getPool()
        .query(
          'UPDATE capability_workspace_capability_binding_revocations SET reason=$1 WHERE revocation_id=$2',
          ['tampered', revocationValue.revocationId]
        )
    ).rejects.toMatchObject({ code: '55000' });
    await expect(
      database
        .getPool()
        .query(
          'DELETE FROM capability_workspace_capability_binding_validity_observations WHERE observation_id=$1',
          [observationValue.observationId]
        )
    ).rejects.toMatchObject({ code: '55000' });
  });
});
