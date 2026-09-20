import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import {
  PostgresWorkspaceChannelIdentityBindingStoreV1,
  type AdmitTrustedWorkspaceChannelIdentityBindingCommandV1
} from '../src/workspace-channel-identity-binding.js';

const url = process.env.LITE_CHANNEL_IDENTITY_BINDING_TEST_DATABASE_URL;
const required = process.env.LITE_CHANNEL_IDENTITY_BINDING_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_CHANNEL_IDENTITY_BINDING_TEST_DATABASE_URL is required when LITE_CHANNEL_IDENTITY_BINDING_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceA = '14141414-1414-4414-8414-141414141414';
const workspaceB = '15151515-1515-4515-8515-151515151515';

suite('PostgreSQL Workspace Channel Identity Binding owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-channel-identity-binding-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_channel_identity_binding_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

  let tick = 0;
  let id = 0;
  const now = () => new Date(Date.UTC(2026, 8, 20, 9, 0, tick++)).toISOString();
  const ids = () => `workspace-channel-identity-binding_test-${++id}` as const;
  const store = () =>
    new PostgresWorkspaceChannelIdentityBindingStoreV1(database, database.getPool(), now, ids);

  const admit = (
    idempotencyKey: string,
    workspaceId = workspaceA,
    featureKey: AdmitTrustedWorkspaceChannelIdentityBindingCommandV1['featureKey'] = 'WHATSAPP_BUSINESS',
    account = 'business-account_primary'
  ): AdmitTrustedWorkspaceChannelIdentityBindingCommandV1 => ({
    workspaceId,
    idempotencyKey,
    featureKey,
    identity: {
      externalAccountRef: account,
      externalChannelRef: 'channel_primary',
      displayLabel: 'Primary business account'
    },
    connection: {
      sourceKind: 'PROVIDER_AUTH',
      capabilityRef: { capabilityId: 'capability_channel', capabilityVersion: '1.0.0' },
      implementationRef: {
        implementationProfileId: 'implementation-profile_channel-primary',
        version: 2
      },
      oauthCredentialRef: {
        owner: 'CORE_IDENTITY',
        credentialBindingId: 'oauth-credential-binding_channel-primary',
        version: 3
      },
      evidenceRefs: ['provider-auth:verified:primary']
    }
  });

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_channel_identity_binding_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
       ($1,'Channel A','channel-a'),($2,'Channel B','channel-b')
       ON CONFLICT(workspace_id) DO NOTHING`,
      [workspaceA, workspaceB]
    );
  }, 30000);

  beforeEach(async () => {
    tick = 0;
    id = 0;
    await database.getPool().query(
      `TRUNCATE
         lite_workspace_channel_identity_binding_commands,
         lite_workspace_channel_identity_binding_heads,
         lite_workspace_channel_identity_binding_versions
       CASCADE`
    );
  });

  afterAll(async () => {
    await database.close();
  });

  it('survives restart with exact version, head, replay, and Workspace isolation', async () => {
    const command = admit('admit-primary');
    const created = await store().admitTrusted(command);
    const restarted = store();

    expect(await restarted.admitTrusted(command)).toEqual(created);
    expect(
      await restarted.getExact(workspaceA, created.workspaceChannelIdentityBindingId, 1)
    ).toEqual(created);
    expect(
      await restarted.getLatest(workspaceA, created.workspaceChannelIdentityBindingId)
    ).toEqual(created);
    expect(
      await restarted.getLatest(workspaceB, created.workspaceChannelIdentityBindingId)
    ).toBeUndefined();

    const otherWorkspace = await restarted.admitTrusted(admit('admit-primary', workspaceB));
    expect(otherWorkspace.workspaceId).toBe(workspaceB);
  });

  it('fails closed on duplicate ACTIVE identity while keeping feature boundaries distinct', async () => {
    const service = store();
    await service.admitTrusted(admit('active-one'));
    await expect(service.admitTrusted(admit('active-two'))).rejects.toMatchObject({
      code: 'DUPLICATE_ACTIVE_IDENTITY'
    });

    await expect(
      service.admitTrusted(admit('active-other-feature', workspaceA, 'SMS_WORKSPACE_CAMPAIGN'))
    ).resolves.toMatchObject({ featureKey: 'SMS_WORKSPACE_CAMPAIGN' });
  });

  it('preserves immutable ACTIVE, STALE, and REVOKED history and current head', async () => {
    const created = await store().admitTrusted(admit('lifecycle-admit'));
    const stale = await store().markStale({
      workspaceId: workspaceA,
      workspaceChannelIdentityBindingId: created.workspaceChannelIdentityBindingId,
      expectedVersion: 1,
      idempotencyKey: 'lifecycle-stale',
      evidenceRef: 'provider-verification:disconnected'
    });
    const revoked = await store().revoke({
      workspaceId: workspaceA,
      workspaceChannelIdentityBindingId: created.workspaceChannelIdentityBindingId,
      expectedVersion: 2,
      idempotencyKey: 'lifecycle-revoke',
      evidenceRef: 'workspace-action:revoke'
    });
    const restarted = store();

    expect([created.status, stale.status, revoked.status]).toEqual(['ACTIVE', 'STALE', 'REVOKED']);
    expect(stale.version).toBe(2);
    expect(revoked.version).toBe(3);
    expect(
      await restarted.getExact(workspaceA, created.workspaceChannelIdentityBindingId, 1)
    ).toEqual(created);
    expect(
      await restarted.getExact(workspaceA, created.workspaceChannelIdentityBindingId, 2)
    ).toEqual(stale);
    expect(
      await restarted.getLatest(workspaceA, created.workspaceChannelIdentityBindingId)
    ).toEqual(revoked);
    await expect(
      restarted.markStale({
        workspaceId: workspaceA,
        workspaceChannelIdentityBindingId: created.workspaceChannelIdentityBindingId,
        expectedVersion: 3,
        idempotencyKey: 'stale-after-revoke',
        evidenceRef: 'provider-verification:stale'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('durably replays lifecycle commands and conflicts changed payloads/stale versions', async () => {
    const service = store();
    const created = await service.admitTrusted(admit('replay-admit'));
    const command = {
      workspaceId: workspaceA,
      workspaceChannelIdentityBindingId: created.workspaceChannelIdentityBindingId,
      expectedVersion: 1,
      idempotencyKey: 'replay-stale',
      evidenceRef: 'provider-verification:stale'
    };
    const stale = await service.markStale(command);
    expect(await store().markStale(command)).toEqual(stale);
    await expect(
      store().markStale({ ...command, evidenceRef: 'provider-verification:different' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(
      store().revoke({
        ...command,
        idempotencyKey: 'stale-version-revoke',
        evidenceRef: 'workspace-action:revoke'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('fails closed on persisted column drift and command replay drift', async () => {
    const command = admit('integrity-admit');
    const created = await store().admitTrusted(command);
    await database.getPool().query(
      `UPDATE lite_workspace_channel_identity_binding_versions
          SET external_account_ref='tampered-account'
        WHERE workspace_id=$1 AND workspace_channel_identity_binding_id=$2 AND version=1`,
      [workspaceA, created.workspaceChannelIdentityBindingId]
    );
    await expect(
      store().getExact(workspaceA, created.workspaceChannelIdentityBindingId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
    await expect(store().admitTrusted(command)).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE'
    });
  });

  it('keeps schema reference-only without raw secret/session/provider payload columns', async () => {
    const columns = await database.getPool().query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name LIKE 'lite_workspace_channel_identity_binding_%'
        ORDER BY column_name`
    );
    const names = columns.rows.map((row) => row.column_name);
    expect(
      names.some((name) =>
        /access_token|refresh_token|api_key|password|cookie|session|secret|provider_response/iu.test(
          name
        )
      )
    ).toBe(false);
    expect(names).toContain('oauth_credential_binding_id');
    expect(names).toContain('binding_fingerprint_sha256');
    expect(names).toContain('identity_fingerprint_sha256');
  });
});
