import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  noWorkspaceEmailSenderProfileAuthorityConsequencesV1,
  type WorkspaceEmailSenderProfileV1
} from '@markorbit/contracts/email-sender-profile';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresEmailSenderProfileStore } from '../src/email-sender-profile.js';

const url = process.env.LITE_EMAIL_SENDER_PROFILE_TEST_DATABASE_URL;
const required = process.env.LITE_EMAIL_SENDER_PROFILE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_EMAIL_SENDER_PROFILE_TEST_DATABASE_URL is required when LITE_EMAIL_SENDER_PROFILE_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceA = '14141414-1414-4414-8414-141414141414';
const workspaceB = '15151515-1515-4515-8515-151515151515';

function profile(
  workspaceId = workspaceA,
  version = 1,
  overrides: Partial<WorkspaceEmailSenderProfileV1> = {}
): WorkspaceEmailSenderProfileV1 {
  const updatedAt =
    version === 1 ? '2026-09-18T12:00:00.000Z' : '2026-09-18T13:00:00.000Z';
  return {
    schemaVersion: 1,
    senderProfileId: 'email-sender-profile_primary',
    workspaceId,
    version,
    status: 'ACTIVE',
    fromDomain: 'mail.example.com',
    fromAddress: 'hello@mail.example.com',
    displayName: 'Example Brand',
    replyTo: { mode: 'SAME_AS_FROM' },
    verification: {
      status: 'VERIFIED',
      evidenceRefs: ['dns-verification:primary'],
      observedAt: updatedAt
    },
    providerRoutingPartitionRef: `routing-partition:${workspaceId}`,
    ratePolicyRef: 'rate-policy:email-campaign-default',
    reputationIsolationKey: `workspace-reputation:${workspaceId}`,
    createdAt: '2026-09-18T12:00:00.000Z',
    updatedAt,
    authority: noWorkspaceEmailSenderProfileAuthorityConsequencesV1,
    ...overrides
  };
}

suite('PostgreSQL Workspace Email Sender Profile owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-email-sender-profile-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_email_sender_profile_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 8, 18, 12, 30 + tick++)).toISOString();

  function store() {
    return new PostgresEmailSenderProfileStore(database, database.getPool(), now);
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
    await migrate(database.getPool(), 'lite_email_sender_profile_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Sender A','sender-a'),
       ($2,'Sender B','sender-b')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceA, workspaceB]
    );
  }, 30000);

  beforeEach(async () => {
    tick = 0;
    await database.getPool().query(
      `TRUNCATE
         lite_email_sender_profile_commands,
         lite_email_sender_profile_versions
       CASCADE`
    );
  });

  afterAll(async () => {
    await database.close();
  });

  it('survives store reconstruction and preserves exact authority locks', async () => {
    const created = profile();
    await store().createSenderProfile({
      value: created,
      idempotencyKey: 'sender-create-a'
    });

    const restarted = store();
    expect(
      await restarted.getExactSenderProfile(
        workspaceA,
        created.senderProfileId,
        created.version
      )
    ).toEqual(created);
    expect(
      Object.values(
        (
          await restarted.getLatestSenderProfile(workspaceA, created.senderProfileId)
        ).authority
      ).every((value) => value === false)
    ).toBe(true);
  });

  it('replays identical commands and rejects changed input with the same key', async () => {
    const value = profile();
    const command = { value, idempotencyKey: 'sender-replay' };
    const created = await store().createSenderProfile(command);
    expect(await store().createSenderProfile(command)).toEqual(created);

    await expect(
      store().createSenderProfile({
        value: { ...value, displayName: 'Changed Brand' },
        idempotencyKey: 'sender-replay'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('appends v2 and keeps v1 exact and restart-safe', async () => {
    const first = profile();
    const service = store();
    await service.createSenderProfile({
      value: first,
      idempotencyKey: 'sender-v1'
    });

    const second = profile(workspaceA, 2, {
      displayName: 'Example Brand Updated'
    });
    await service.updateSenderProfile({
      value: second,
      expectedVersion: 1,
      idempotencyKey: 'sender-v2'
    });

    const restarted = store();
    expect(
      await restarted.getExactSenderProfile(workspaceA, first.senderProfileId, 1)
    ).toEqual(first);
    expect(
      await restarted.getLatestSenderProfile(workspaceA, first.senderProfileId)
    ).toEqual(second);
  });

  it('rejects stale expectedVersion without mutating the head', async () => {
    const first = profile();
    const service = store();
    await service.createSenderProfile({
      value: first,
      idempotencyKey: 'sender-stale-v1'
    });

    await expect(
      service.updateSenderProfile({
        value: profile(workspaceA, 2),
        expectedVersion: 0,
        idempotencyKey: 'sender-stale-v2'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    expect(
      await service.getLatestSenderProfile(workspaceA, first.senderProfileId)
    ).toEqual(first);
  });

  it('isolates exact identities and command keys by Workspace', async () => {
    const a = profile(workspaceA);
    const b = profile(workspaceB);
    await store().createSenderProfile({ value: a, idempotencyKey: 'shared-key' });
    await store().createSenderProfile({ value: b, idempotencyKey: 'shared-key' });

    expect(
      (await store().getLatestSenderProfile(workspaceA, a.senderProfileId)).workspaceId
    ).toBe(workspaceA);
    expect(
      (await store().getLatestSenderProfile(workspaceB, b.senderProfileId)).workspaceId
    ).toBe(workspaceB);

    await expect(
      store().getLatestSenderProfile(
        '16161616-1616-4616-8616-161616161616',
        a.senderProfileId
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists only latest heads and supports status filtering', async () => {
    const service = store();
    const first = profile();
    await service.createSenderProfile({
      value: first,
      idempotencyKey: 'sender-list-v1'
    });
    const suspended = profile(workspaceA, 2, {
      status: 'SUSPENDED',
      verification: first.verification
    });
    await service.suspendSenderProfile({
      value: suspended,
      expectedVersion: 1,
      idempotencyKey: 'sender-list-v2'
    });

    expect(await service.listSenderProfiles(workspaceA)).toEqual([suspended]);
    expect(
      await service.listSenderProfiles(workspaceA, { statuses: ['ACTIVE'] })
    ).toEqual([]);
    expect(
      await service.listSenderProfiles(workspaceA, { statuses: ['SUSPENDED'] })
    ).toEqual([suspended]);
  });

  it('fails closed when queryable columns drift from document_json', async () => {
    const value = profile();
    const service = store();
    await service.createSenderProfile({
      value,
      idempotencyKey: 'sender-corrupt'
    });

    await database.getPool().query(
      `UPDATE lite_email_sender_profile_versions
          SET reputation_isolation_key='corrupted-isolation-key'
        WHERE workspace_id=$1 AND sender_profile_id=$2 AND version=1`,
      [workspaceA, value.senderProfileId]
    );

    await expect(
      service.getExactSenderProfile(workspaceA, value.senderProfileId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });

  it('rejects secret material before persistence', async () => {
    const unsafe = {
      ...profile(),
      apiKey: 'never-persist-this'
    } as unknown as WorkspaceEmailSenderProfileV1;

    await expect(
      store().createSenderProfile({
        value: unsafe,
        idempotencyKey: 'sender-secret'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    const count = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM lite_email_sender_profile_versions');
    expect((count.rows[0] as { count: number }).count).toBe(0);
  });

  it('evaluates fresh, stale, suspended and unavailable currentness without send authority', async () => {
    const service = store();
    const first = profile();
    await service.createSenderProfile({
      value: first,
      idempotencyKey: 'sender-current-v1'
    });

    expect(
      await service.evaluateSenderProfileCurrentness(
        workspaceA,
        first.senderProfileId,
        60 * 60 * 1000
      )
    ).toMatchObject({ state: 'CURRENT_ELIGIBLE', createsSendAuthority: false });

    expect(
      await service.evaluateSenderProfileCurrentness(
        workspaceA,
        first.senderProfileId,
        1
      )
    ).toMatchObject({ state: 'STALE', createsSendAuthority: false });

    const unavailable = profile(workspaceA, 2, {
      status: 'PENDING_VERIFICATION',
      verification: {
        status: 'UNAVAILABLE',
        evidenceRefs: ['verification-service:unavailable'],
        observedAt: '2026-09-18T13:00:00.000Z'
      }
    });
    await service.recordVerificationObservation({
      value: unavailable,
      expectedVersion: 1,
      idempotencyKey: 'sender-current-v2'
    });
    expect(
      await service.evaluateSenderProfileCurrentness(
        workspaceA,
        first.senderProfileId,
        60 * 60 * 1000
      )
    ).toMatchObject({ state: 'UNAVAILABLE', createsSendAuthority: false });
  });
});
