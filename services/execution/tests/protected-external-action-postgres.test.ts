import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  ProtectedExternalActionAuthorizationV1,
  ProtectedExternalActionReleaseV1
} from '@markorbit/contracts';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresProtectedExternalActionRepository } from '../src/protected-external-action-postgres.js';

const url = process.env.EXECUTION_TEST_DATABASE_URL;
const required = process.env.EXECUTION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'EXECUTION_TEST_DATABASE_URL is required when EXECUTION_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceA = '11111111-1111-4111-8111-111111111176';
const workspaceB = '22222222-2222-4222-8222-222222222176';

function authorization(workspaceId = workspaceA): ProtectedExternalActionAuthorizationV1 {
  return {
    schemaVersion: 1,
    authorizationId: 'protected-action-authorization_11111111-1111-4111-8111-111111111176',
    version: 1,
    workspaceId,
    actionKind: 'TRADING_LISTING_PUBLISH',
    intent: {
      schemaVersion: 1,
      actionKind: 'TRADING_LISTING_PUBLISH',
      workspaceId,
      listingDraft: { id: 'trading-listing-draft_pg', version: 1 },
      listingReview: { id: 'trading-listing-review_pg', version: 1 },
      listingAssets: [{ id: 'listing-asset_pg', version: 1 }],
      marketplaceTargetBinding: {
        id: 'trading-marketplace-target-binding_pg',
        version: 1
      },
      effectFingerprintSha256: 'a'.repeat(64)
    },
    effectFingerprintSha256: 'a'.repeat(64),
    humanReceipt: {
      schemaVersion: 1,
      receiptId: '33333333-3333-4333-8333-333333331176',
      receiptVersion: 1,
      workspaceId,
      userId: '44444444-4444-4444-8444-444444441176',
      membershipId: '55555555-5555-4555-8555-555555551176',
      principalReference: 'core-workspace-principal:pg',
      kind: 'TRADING_LISTING_PUBLISH',
      mutationRoute:
        '/api/execution/protected-external-actions/trading-listing-publish/authorizations',
      reviewedActionDigest: 'b'.repeat(64),
      idempotencyKey: 'authorize-pg-1176',
      authenticatedAt: '2026-09-17T00:00:00.000Z',
      authorityReference: 'core-governed-human-action-receipt:pg',
      authorityVersion: 1,
      affirmativeHumanActionEvidenceReference: 'core-governed-human-action-evidence:pg',
      source: 'CORE',
      actorKind: 'HUMAN_USER',
      workspaceVersion: 1,
      userVersion: 1,
      membershipVersion: 1,
      createdAt: '2026-09-17T00:00:00.000Z'
    },
    authorizationStatus: 'AUTHORIZED',
    authorizedByUserId: '44444444-4444-4444-8444-444444441176',
    authorizedAt: '2026-09-17T00:01:00.000Z',
    expiresAt: '2026-09-17T00:16:00.000Z',
    lastValidatedAt: '2026-09-17T00:01:00.000Z',
    idempotencyKey: 'authorize-pg-1176'
  };
}

function release(auth: ProtectedExternalActionAuthorizationV1): ProtectedExternalActionReleaseV1 {
  return {
    schemaVersion: 1,
    releaseId: 'protected-action-release_66666666-6666-4666-8666-666666661176',
    version: 1,
    workspaceId: auth.workspaceId,
    actionKind: 'TRADING_LISTING_PUBLISH',
    authorization: { id: auth.authorizationId, version: 1 },
    effectFingerprintSha256: auth.effectFingerprintSha256,
    status: 'RELEASED_FOR_EXECUTION',
    releasedByUserId: auth.authorizedByUserId,
    releasedAt: '2026-09-17T00:02:00.000Z',
    idempotencyKey: 'release-pg-1176'
  };
}

suite('PostgreSQL protected external action persistence', () => {
  const namespace = 'execution_protected_action_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 6,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  const migrations = () =>
    loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/execution-service'
    );
  const repository = () =>
    new PostgresProtectedExternalActionRepository(database, database.getPool());

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
         execution_protected_action_commands,
         execution_protected_action_releases,
         execution_protected_action_authorizations
       CASCADE`
    );
    const history = await pool.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await pool.query('DELETE FROM markorbit_persistence.migration_history WHERE namespace=$1', [
        namespace
      ]);
    await migrate(pool, namespace, await migrations());
  });
  beforeEach(() =>
    database
      .getPool()
      .query(
        'TRUNCATE execution_protected_action_commands, execution_protected_action_releases, execution_protected_action_authorizations CASCADE'
      )
  );
  afterAll(() => database.close());

  it('registers migration 0131 under the Execution owner', async () => {
    expect((await migrations()).map((value) => `${value.version}_${value.name}`)).toContain(
      '0131_execution_protected_external_actions'
    );
  });

  it('survives restart-style repository reconstruction and replays exact commands', async () => {
    const auth = authorization();
    await repository().createAuthorization(auth, 'c'.repeat(64));
    await expect(
      repository().findAuthorizationByIdempotencyKey(workspaceA, auth.idempotencyKey)
    ).resolves.toEqual({ requestFingerprint: 'c'.repeat(64), result: auth });
    const durableRelease = release(auth);
    await repository().createRelease(durableRelease, 'd'.repeat(64));
    await expect(
      repository().findReleaseByIdempotencyKey(workspaceA, durableRelease.idempotencyKey)
    ).resolves.toEqual({ requestFingerprint: 'd'.repeat(64), result: durableRelease });
  });

  it('isolates Workspace reads and idempotency keys', async () => {
    const auth = authorization();
    await repository().createAuthorization(auth, 'c'.repeat(64));
    await expect(
      repository().findAuthorization(workspaceB, auth.authorizationId)
    ).resolves.toBeUndefined();
    await expect(
      repository().findAuthorizationByIdempotencyKey(workspaceB, auth.idempotencyKey)
    ).resolves.toBeUndefined();
  });

  it('rejects conflicting replay and keeps release rows immutable', async () => {
    const repo = repository();
    const auth = authorization();
    await repo.createAuthorization(auth, 'c'.repeat(64));
    await expect(repo.createAuthorization(auth, 'e'.repeat(64))).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    });
    const durableRelease = release(auth);
    await repo.createRelease(durableRelease, 'd'.repeat(64));
    await expect(
      database
        .getPool()
        .query(
          "UPDATE execution_protected_action_releases SET status='RELEASED_FOR_EXECUTION' WHERE workspace_id=$1",
          [workspaceA]
        )
    ).rejects.toThrow(/immutable/);
  });
});
