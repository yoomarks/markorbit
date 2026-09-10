import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from '../src/identity.js';
import { CurrentWorkspaceAuthorityService } from '../src/current-workspace-authority.js';
import {
  OAuthCredentialServiceV1,
  OAuthProviderRegistryV1,
  type OAuthProviderGrantV1
} from '../src/oauth-credential.js';
import {
  OAuthCredentialKeyringV1,
  oauthCredentialSecretAadV1
} from '../src/oauth-credential-crypto.js';
import { PostgresOAuthCredentialRepositoryV1 } from '../src/oauth-credential-postgres.js';
const url = process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.AUTH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('AUTH_POSTGRES_TEST_REQUIRED=1 requires AUTH_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coreMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_auth',
    DB_APPLICATION_NAME: 'markorbit-1134-oauth-tests'
  });

let database: ManagedDatabase;
const workspaceA = '018f0000-0000-7000-8000-000000001134';
const workspaceB = '018f0000-0000-7000-8000-000000001135';
const userA = '018f0000-0000-7000-8000-000000001136';
const userB = '018f0000-0000-7000-8000-000000001138';
const membershipA = '018f0000-0000-7000-8000-000000001137';
const membershipB = '018f0000-0000-7000-8000-000000001139';
const provider = 'MICROSOFT_GRAPH';
const profile = { id: 'microsoft-graph-default', version: '1' } as const;
let nowMs = Date.parse('2026-09-11T00:00:00.000Z');
const keyring = new OAuthCredentialKeyringV1({
  activeKeyId: 'test-key-v1',
  keys: { 'test-key-v1': Buffer.alloc(32, 7) }
});

function principal(workspaceId: string, userId: string, membershipId: string) {
  return {
    kind: 'WORKSPACE' as const,
    sessionId: `session_${workspaceId}`,
    userId,
    workspaceId,
    membershipId,
    role: 'WORKSPACE_ADMIN' as const,
    permissions: ['workspace:read', 'workspace:manage'] as const,
    sessionExpiresAt: '2026-09-12T00:00:00.000Z'
  };
}

const exchangeAuthorizationCode = vi.fn((): Promise<Readonly<OAuthProviderGrantV1>> =>
  Promise.resolve({
    accessToken: 'db-initial-access-token',
    refreshToken: 'db-initial-refresh-token',
    accessExpiresAt: '2026-09-11T00:10:00.000Z',
    externalAccountRef: 'graph-user-1134',
    grantedScopes: ['Mail.Read', 'Mail.Send']
  })
);
const refresh = vi.fn(() =>
  Promise.resolve({
    accessToken: 'db-rotated-access-token',
    accessExpiresAt: '2026-09-11T02:00:00.000Z',
    refreshTokenDisposition: 'REPLACE' as const,
    refreshToken: 'db-rotated-refresh-token'
  })
);
const revoke = vi.fn(() => Promise.resolve());
const driver = {
  provider,
  oauthClientProfileRef: profile,
  allowedScopes: ['Mail.Read', 'Mail.Send'],
  supportsPkceS256: true,
  buildAuthorizationUrl: ({ state, codeChallenge }: { state: string; codeChallenge?: string }) => {
    const authorization = new URL('https://login.example.test/oauth2/authorize');
    authorization.searchParams.set('state', state);
    if (codeChallenge) authorization.searchParams.set('code_challenge', codeChallenge);
    return authorization.toString();
  },
  exchangeAuthorizationCode,
  refresh,
  revoke
};

function authority() {
  const pool = database.getPool();
  return new CurrentWorkspaceAuthorityService({
    users: new PostgresUserRepository(pool),
    workspaces: new PostgresWorkspaceRepository(pool),
    memberships: new PostgresMembershipRepository(pool)
  });
}
function repository() {
  return new PostgresOAuthCredentialRepositoryV1(database);
}
function service() {
  return new OAuthCredentialServiceV1({
    repository: repository(),
    currentWorkspaceAuthority: authority(),
    providers: new OAuthProviderRegistryV1([driver]),
    keyring,
    clock: () => new Date(nowMs)
  });
}

async function seedIdentity() {
  const pool = database.getPool();
  const users = new PostgresUserRepository(pool);
  const workspaces = new PostgresWorkspaceRepository(pool);
  const memberships = new PostgresMembershipRepository(pool);
  await users.create({ userId: userA, email: 'oauth-a@example.test', displayName: 'OAuth A' });
  await users.create({ userId: userB, email: 'oauth-b@example.test', displayName: 'OAuth B' });
  await workspaces.create({ workspaceId: workspaceA, name: 'OAuth A', slug: 'oauth-a' });
  await workspaces.create({ workspaceId: workspaceB, name: 'OAuth B', slug: 'oauth-b' });
  await memberships.create({
    membershipId: membershipA,
    workspaceId: workspaceA,
    userId: userA,
    role: 'WORKSPACE_ADMIN'
  });
  await memberships.create({
    membershipId: membershipB,
    workspaceId: workspaceB,
    userId: userB,
    role: 'WORKSPACE_ADMIN'
  });
}

async function cleanAndSeed() {
  await database
    .getPool()
    .query(
      'TRUNCATE core_external_oauth_credential_secrets,core_external_oauth_credential_bindings,core_external_oauth_grant_attempts,workspace_memberships,workspaces,users CASCADE'
    );
  await seedIdentity();
  nowMs = Date.parse('2026-09-11T00:00:00.000Z');
  exchangeAuthorizationCode.mockClear();
  refresh.mockClear();
  revoke.mockClear();
}
async function grantCredential() {
  const owner = service();
  const begun = await owner.beginGrant(principal(workspaceA, userA, membershipA), {
    provider,
    oauthClientProfileRef: profile,
    requestedScopes: ['Mail.Read', 'Mail.Send']
  });
  const authorization = new URL(begun.authorizationUrl);
  const state = authorization.searchParams.get('state');
  if (!state) throw new Error('OAuth state was not returned.');
  const binding = await owner.completeGrant(principal(workspaceA, userA, membershipA), {
    state,
    authorizationCode: 'authorization-code-1134'
  });
  return { owner, binding, state };
}

async function reopen() {
  await database.close();
  database = new ManagedDatabase(config());
  await database.start();
}

integration('Core OAuth credential PostgreSQL owner', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_auth', await coreMigrations());
  });
  afterAll(async () => database.close());
  it('persists only encrypted secret material and survives a database restart', async () => {
    await cleanAndSeed();
    const { binding, state } = await grantCredential();
    const grantRow = await database.getPool().query<{
      state_hash_sha256: string;
      pkce_ciphertext_base64: string | null;
    }>('SELECT state_hash_sha256,pkce_ciphertext_base64 FROM core_external_oauth_grant_attempts');
    expect(grantRow.rows[0]?.state_hash_sha256).not.toBe(state);
    expect(grantRow.rows[0]?.pkce_ciphertext_base64).not.toContain('authorization-code-1134');

    const persisted = await database.getPool().query<{ safe: string; secret: string }>(
      `SELECT row_to_json(b)::text AS safe,row_to_json(s)::text AS secret
       FROM core_external_oauth_credential_bindings b
       JOIN core_external_oauth_credential_secrets s USING(credential_binding_id)`
    );
    expect(persisted.rows[0]?.safe).not.toContain('db-initial-access-token');
    expect(persisted.rows[0]?.secret).not.toContain('db-initial-access-token');
    expect(persisted.rows[0]?.secret).not.toContain('db-initial-refresh-token');

    await reopen();
    await expect(
      service().resolveAccessToken({
        credential: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: binding.credentialBindingId,
          version: 1
        },
        expectedWorkspaceId: workspaceA,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Read']
      })
    ).resolves.toMatchObject({ accessToken: 'db-initial-access-token', bindingVersion: 1 });
  });
  it('isolates Workspace use and serializes one refresh without changing binding version', async () => {
    await cleanAndSeed();
    const { binding } = await grantCredential();
    const ref = {
      owner: 'CORE_IDENTITY' as const,
      credentialBindingId: binding.credentialBindingId,
      version: 1
    };
    await expect(
      service().resolveAccessToken({
        credential: ref,
        expectedWorkspaceId: workspaceB,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Read']
      })
    ).rejects.toMatchObject({ code: 'OAUTH_CREDENTIAL_WORKSPACE_MISMATCH' });

    nowMs = Date.parse('2026-09-11T00:20:00.000Z');
    const [a, b] = await Promise.all([
      service().resolveAccessToken({
        credential: ref,
        expectedWorkspaceId: workspaceA,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Send']
      }),
      service().resolveAccessToken({
        credential: ref,
        expectedWorkspaceId: workspaceA,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Send']
      })
    ]);
    expect(a.accessToken).toBe('db-rotated-access-token');
    expect(b.accessToken).toBe('db-rotated-access-token');
    expect(refresh).toHaveBeenCalledTimes(1);
    const row = await database.getPool().query<{ version: number; secret_generation: number }>(
      `SELECT b.version,s.secret_generation FROM core_external_oauth_credential_bindings b
       JOIN core_external_oauth_credential_secrets s USING(credential_binding_id)`
    );
    expect(row.rows[0]).toEqual({ version: 1, secret_generation: 2 });
  });
  it('enforces secret-generation CAS and preserves exact lineage', async () => {
    await cleanAndSeed();
    const { binding } = await grantCredential();
    const repo = repository();
    const stored = await repo.findCredential(binding.credentialBindingId);
    if (!stored) throw new Error('Credential missing.');
    const nextGeneration = stored.secretGeneration + 1;
    const makeSecret = (accessToken: string) =>
      keyring.encrypt(
        { accessToken, refreshToken: 'cas-refresh', accessExpiresAt: '2026-09-11T03:00:00.000Z' },
        oauthCredentialSecretAadV1({
          credentialBindingId: binding.credentialBindingId,
          workspaceId: workspaceA,
          provider,
          secretGeneration: nextGeneration
        })
      );
    const results = await Promise.allSettled([
      repo.rotateSecret({
        credentialBindingId: binding.credentialBindingId,
        expectedSecretGeneration: stored.secretGeneration,
        nextSecret: makeSecret('cas-a'),
        accessExpiresAt: '2026-09-11T03:00:00.000Z',
        refreshCapability: 'AVAILABLE',
        updatedAt: '2026-09-11T00:01:00.000Z'
      }),
      repo.rotateSecret({
        credentialBindingId: binding.credentialBindingId,
        expectedSecretGeneration: stored.secretGeneration,
        nextSecret: makeSecret('cas-b'),
        accessExpiresAt: '2026-09-11T03:00:00.000Z',
        refreshCapability: 'AVAILABLE',
        updatedAt: '2026-09-11T00:01:00.000Z'
      })
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const after = await repo.findCredential(binding.credentialBindingId);
    expect(after?.secretGeneration).toBe(nextGeneration);
    expect(after?.binding.version).toBe(1);
  });
  it('persists one-time callback replay protection', async () => {
    await cleanAndSeed();
    const owner = service();
    const begun = await owner.beginGrant(principal(workspaceA, userA, membershipA), {
      provider,
      oauthClientProfileRef: profile,
      requestedScopes: ['Mail.Read']
    });
    const state = new URL(begun.authorizationUrl).searchParams.get('state');
    if (!state) throw new Error('OAuth state missing.');
    await owner.completeGrant(principal(workspaceA, userA, membershipA), {
      state,
      authorizationCode: 'authorization-code-1134'
    });
    await expect(
      owner.completeGrant(principal(workspaceA, userA, membershipA), {
        state,
        authorizationCode: 'authorization-code-1134-replay'
      })
    ).rejects.toMatchObject({ code: 'OAUTH_GRANT_REPLAYED' });
    expect(exchangeAuthorizationCode).toHaveBeenCalledTimes(1);
  });

  it('keeps durable local revocation even when remote revoke fails', async () => {
    await cleanAndSeed();
    const { binding } = await grantCredential();
    revoke.mockRejectedValueOnce(new Error('provider unavailable'));
    const revoked = await service().revokeCredential(principal(workspaceA, userA, membershipA), {
      owner: 'CORE_IDENTITY',
      credentialBindingId: binding.credentialBindingId,
      version: 1
    });
    expect(revoked).toMatchObject({ lifecycle: 'REVOKED', version: 2 });
    await reopen();
    await expect(
      service().resolveAccessToken({
        credential: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: binding.credentialBindingId,
          version: 2
        },
        expectedWorkspaceId: workspaceA,
        expectedProvider: provider,
        expectedExternalAccountRef: 'graph-user-1134',
        requiredScopes: ['Mail.Read']
      })
    ).rejects.toMatchObject({ code: 'OAUTH_CREDENTIAL_INELIGIBLE' });
  });
});
