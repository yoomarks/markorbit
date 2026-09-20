import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { CurrentWorkspaceAuthorityService } from '../src/current-workspace-authority.js';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from '../src/identity.js';
import { ExternalCredentialServiceV1 } from '../src/external-credential.js';
import { ExternalCredentialKeyringV1 } from '../src/external-credential-crypto.js';
import { PostgresExternalCredentialRepositoryV1 } from '../src/external-credential-postgres.js';

const url = process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.AUTH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('AUTH_POSTGRES_TEST_REQUIRED=1 requires AUTH_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_external_credential_test',
    DB_APPLICATION_NAME: 'markorbit-1384-external-credential-tests'
  });
const workspaceId = '018f0000-0000-7000-8000-000000001384';
const userId = '018f0000-0000-7000-8000-000000001385';
const membershipId = '018f0000-0000-7000-8000-000000001386';
let database: ManagedDatabase;

function principal() {
  return {
    kind: 'WORKSPACE' as const,
    sessionId: 'session_1384',
    userId,
    workspaceId,
    membershipId,
    role: 'WORKSPACE_ADMIN' as const,
    permissions: ['workspace:read', 'workspace:manage'] as const,
    sessionExpiresAt: '2026-09-22T00:00:00.000Z'
  };
}

function service(activeKeyId = 'key-v1') {
  const pool = database.getPool();
  return new ExternalCredentialServiceV1({
    repository: new PostgresExternalCredentialRepositoryV1(database),
    currentWorkspaceAuthority: new CurrentWorkspaceAuthorityService({
      users: new PostgresUserRepository(pool),
      workspaces: new PostgresWorkspaceRepository(pool),
      memberships: new PostgresMembershipRepository(pool)
    }),
    keyring: new ExternalCredentialKeyringV1({
      activeKeyId,
      keys: { 'key-v1': Buffer.alloc(32, 1), 'key-v2': Buffer.alloc(32, 2) }
    }),
    clock: () => new Date('2026-09-20T10:00:00.000Z')
  });
}

async function seed() {
  const pool = database.getPool();
  await pool.query(
    'TRUNCATE core_external_credential_audit_events,core_external_credential_secrets,core_external_credential_bindings,workspace_memberships,workspaces,users CASCADE'
  );
  await new PostgresUserRepository(pool).create({
    userId,
    email: 'external-credential@example.test',
    displayName: 'External Credential'
  });
  await new PostgresWorkspaceRepository(pool).create({
    workspaceId,
    name: 'External Credential',
    slug: 'external-credential'
  });
  await new PostgresMembershipRepository(pool).create({
    membershipId,
    workspaceId,
    userId,
    role: 'WORKSPACE_ADMIN'
  });
}

integration('Core external credential PostgreSQL owner', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(
      database.getPool(),
      'core_external_credential_test',
      await loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service')
    );
  });
  beforeEach(seed);
  afterAll(async () => database?.close());

  it('persists encrypted lineage, rotates semantically, rewraps internally, and audits metadata', async () => {
    const owner = service();
    const created = await owner.createCredential(principal(), {
      provider: 'TEST_PROVIDER',
      externalAccountRef: 'account-1384',
      secretKind: 'API_KEY',
      allowedCapabilityIds: ['capability.test'],
      secret: { kind: 'API_KEY', secret: 'initial-secret' }
    });
    const rotated = await owner.rotateCredential(
      principal(),
      { owner: 'CORE_IDENTITY', credentialBindingId: created.credentialBindingId, version: 1 },
      { secret: { kind: 'API_KEY', secret: 'rotated-secret' } }
    );
    expect(rotated.version).toBe(2);
    await expect(service('key-v2').rewrapEncryptionKey(created.credentialBindingId)).resolves.toBe(
      3
    );
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const rows = await database.getPool().query<{
      version: number;
      secret_generation: number;
      ciphertext_base64: string;
    }>(
      `SELECT b.version,s.secret_generation,s.ciphertext_base64
       FROM core_external_credential_bindings b
       JOIN core_external_credential_secrets s USING(credential_binding_id)`
    );
    expect(rows.rows[0]).toMatchObject({ version: 2, secret_generation: 3 });
    expect(rows.rows[0]?.ciphertext_base64).not.toContain('rotated-secret');
    const persisted = await new PostgresExternalCredentialRepositoryV1(database).findCredential(
      created.credentialBindingId
    );
    expect(persisted).toMatchObject({ binding: { version: 2 }, secretGeneration: 3 });
    const audit = await database
      .getPool()
      .query<{ action: string }>(
        'SELECT action FROM core_external_credential_audit_events ORDER BY occurred_at,event_id'
      );
    expect(audit.rows.map((row) => row.action).sort()).toEqual(
      ['CREATED', 'KEY_REWRAPPED', 'ROTATED'].sort()
    );
  });

  it('deletes ciphertext atomically when revoked while retaining safe binding history', async () => {
    const owner = service();
    const created = await owner.createCredential(principal(), {
      provider: 'TEST_PROVIDER',
      externalAccountRef: 'account-1384',
      secretKind: 'STATIC_BEARER',
      allowedCapabilityIds: ['capability.test'],
      secret: { kind: 'STATIC_BEARER', token: 'token' }
    });
    const revoked = await owner.transitionLifecycle(
      principal(),
      { owner: 'CORE_IDENTITY', credentialBindingId: created.credentialBindingId, version: 1 },
      'REVOKED'
    );
    expect(revoked).toMatchObject({ version: 2, lifecycle: 'REVOKED' });
    const stored = await new PostgresExternalCredentialRepositoryV1(database).findCredential(
      created.credentialBindingId
    );
    expect(stored?.secret).toBeUndefined();
    expect(stored?.binding.lifecycle).toBe('REVOKED');
    await expect(
      database
        .getPool()
        .query('DELETE FROM core_external_credential_audit_events WHERE credential_binding_id=$1', [
          created.credentialBindingId
        ])
    ).rejects.toThrow(/immutable/u);
  });

  it('serializes concurrent customer rotation and rejects the stale exact version', async () => {
    const owner = service();
    const created = await owner.createCredential(principal(), {
      provider: 'TEST_PROVIDER',
      externalAccountRef: 'account-1384',
      secretKind: 'API_KEY',
      allowedCapabilityIds: ['capability.test'],
      secret: { kind: 'API_KEY', secret: 'initial' }
    });
    const reference = {
      owner: 'CORE_IDENTITY' as const,
      credentialBindingId: created.credentialBindingId,
      version: 1
    };
    const outcomes = await Promise.allSettled([
      owner.rotateCredential(principal(), reference, {
        secret: { kind: 'API_KEY', secret: 'first' }
      }),
      owner.rotateCredential(principal(), reference, {
        secret: { kind: 'API_KEY', secret: 'second' }
      })
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    const stored = await new PostgresExternalCredentialRepositoryV1(database).findCredential(
      created.credentialBindingId
    );
    expect(stored).toMatchObject({ binding: { version: 2 }, secretGeneration: 2 });
  });
});
