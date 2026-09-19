import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  type EmailDeliveryAttemptV1,
  type EmailDeliveryObservationV1
} from '@markorbit/contracts/email-delivery';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresEmailDeliveryStore } from '../src/email-delivery.js';

const url = process.env.LITE_EMAIL_DELIVERY_TEST_DATABASE_URL;
const required = process.env.LITE_EMAIL_DELIVERY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_EMAIL_DELIVERY_TEST_DATABASE_URL is required when LITE_EMAIL_DELIVERY_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceId = '14141414-1414-4414-8414-141414141414';

function attempt(
  status: EmailDeliveryAttemptV1['status'] = 'PLANNED',
  providerSubmissionRef?: string
): EmailDeliveryAttemptV1 {
  return {
    schemaVersion: 1,
    deliveryAttemptId: 'email-delivery-attempt_pg',
    version: 1,
    workspaceId,
    executionRelease: {
      releaseId: 'protected-action-release_pg',
      version: 1,
      effectFingerprintSha256: '1'.repeat(64)
    },
    campaign: { campaignId: 'email-campaign_pg', version: 1 },
    senderProfile: {
      senderProfileId: 'email-sender-profile_pg',
      version: 1,
      fingerprintSha256: '2'.repeat(64)
    },
    implementation: {
      implementationProfileId: 'implementation-profile_amazon-ses-v2',
      version: 1
    },
    shardIndex: 0,
    recipientCount: 1,
    recipientManifestFingerprintSha256: '3'.repeat(64),
    deliveryPlanFingerprintSha256: '4'.repeat(64),
    correlationId: 'delivery:pg:0',
    attemptNumber: 1,
    status,
    ...(providerSubmissionRef ? { providerSubmissionRef } : {}),
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: status === 'PLANNED' ? '2026-09-19T00:00:00.000Z' : '2026-09-19T00:01:00.000Z',
    authority: noEmailDeliveryAuthorityConsequencesV1
  };
}

function observation(eventIdentity = 'ses-message-1:Delivery'): EmailDeliveryObservationV1 {
  return {
    schemaVersion: 1,
    observationId: 'email-delivery-observation_pg',
    version: 1,
    workspaceId,
    deliveryAttempt: {
      deliveryAttemptId: 'email-delivery-attempt_pg',
      version: 1
    },
    eventIdentity,
    event: 'DELIVERED',
    evidenceKind: 'PROVIDER_EVENT',
    providerMessageRef: 'ses-message-1',
    endpointFingerprintSha256: '5'.repeat(64),
    authenticatedEvidence: true,
    reasonCode: 'SES_DELIVERED',
    evidenceRefs: ['ses-message:ses-message-1'],
    eventAt: '2026-09-19T00:02:00.000Z',
    observedAt: '2026-09-19T00:02:01.000Z',
    authority: noEmailDeliveryAuthorityConsequencesV1
  };
}

suite('PostgreSQL email delivery evidence owner', () => {
  const databaseConfig = () => ({
    connection: { url: url! },
    applicationName: 'lite-email-delivery-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable' as const,
    migrationNamespace: 'lite_email_delivery_test'
  });
  let database = new ManagedDatabase(databaseConfig());
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

  const store = () =>
    new PostgresEmailDeliveryStore(database, database.getPool(), () => '2026-09-19T00:03:00.000Z');

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
    await migrate(database.getPool(), 'lite_email_delivery_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug)
       VALUES($1,'Email Delivery','email-delivery')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
  }, 30000);

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE
         lite_email_delivery_commands,
         lite_email_delivery_observations,
         lite_email_delivery_attempts
       CASCADE`
    );
  });

  afterAll(async () => {
    await database.close();
  });

  it('registers migration 0136 under Lite owner', async () => {
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    expect(migrations.map((value) => `${value.version}_${value.name}`)).toContain(
      '0136_lite_email_delivery_evidence'
    );
  });

  it('survives database restart and replays identical create command', async () => {
    const first = attempt();
    const created = await store().createAttempt({
      value: first,
      idempotencyKey: 'delivery-create-pg'
    });
    expect(
      await store().createAttempt({
        value: first,
        idempotencyKey: 'delivery-create-pg'
      })
    ).toEqual(created);

    await database.close();
    database = new ManagedDatabase(databaseConfig());
    await database.start();

    expect(await store().getAttempt(workspaceId, first.deliveryAttemptId)).toEqual(first);
    expect(
      await store().createAttempt({
        value: first,
        idempotencyKey: 'delivery-create-pg'
      })
    ).toEqual(created);
  });

  it('rejects changed request under the same idempotency key', async () => {
    const first = attempt();
    await store().createAttempt({
      value: first,
      idempotencyKey: 'delivery-create-conflict'
    });
    await expect(
      store().createAttempt({
        value: {
          ...first,
          recipientManifestFingerprintSha256: '6'.repeat(64)
        },
        idempotencyKey: 'delivery-create-conflict'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('updates only mutable attempt state and rejects immutable drift', async () => {
    const service = store();
    await service.createAttempt({ value: attempt(), idempotencyKey: 'delivery-state-create' });
    const submitting = attempt('SUBMITTING');
    await service.updateAttempt({
      value: submitting,
      expectedStatus: 'PLANNED',
      idempotencyKey: 'delivery-state-submitting'
    });
    const accepted = {
      ...attempt('ACCEPTED', 'ses-message-1'),
      campaign: { campaignId: 'email-campaign_pg', version: 2 }
    } as EmailDeliveryAttemptV1;
    await expect(
      service.updateAttempt({
        value: accepted,
        expectedStatus: 'SUBMITTING',
        idempotencyKey: 'delivery-state-drift'
      })
    ).rejects.toMatchObject({ code: 'STATE_CONFLICT' });
  });

  it('deduplicates authenticated provider events by Workspace/event identity', async () => {
    const service = store();
    await service.createAttempt({ value: attempt(), idempotencyKey: 'delivery-event-create' });
    const value = observation();
    const first = await service.recordObservation({
      value,
      idempotencyKey: 'delivery-event-1'
    });
    expect(
      await service.recordObservation({
        value,
        idempotencyKey: 'delivery-event-1'
      })
    ).toEqual(first);
    expect(
      await service.listObservations(workspaceId, value.deliveryAttempt.deliveryAttemptId)
    ).toEqual([value]);
  });

  it('lists durable attempts and observations only for the exact Campaign version', async () => {
    const service = store();
    const primary = attempt();
    const other: EmailDeliveryAttemptV1 = {
      ...attempt(),
      deliveryAttemptId: 'email-delivery-attempt_pg_other',
      campaign: { campaignId: 'email-campaign_pg_other', version: 1 },
      correlationId: 'delivery:pg:other'
    };

    await service.createAttempt({
      value: primary,
      idempotencyKey: 'delivery-campaign-read-primary'
    });
    await service.createAttempt({
      value: other,
      idempotencyKey: 'delivery-campaign-read-other'
    });
    const delivered = observation();
    await service.recordObservation({
      value: delivered,
      idempotencyKey: 'delivery-campaign-read-observation'
    });

    expect(
      await service.listCampaignAttempts(workspaceId, primary.campaign.campaignId, 1)
    ).toEqual([primary]);
    expect(
      await service.listCampaignObservations(workspaceId, primary.campaign.campaignId, 1)
    ).toEqual([delivered]);
    expect(
      await service.listCampaignAttempts(workspaceId, other.campaign.campaignId, 1)
    ).toEqual([other]);
    expect(
      await service.listCampaignObservations(workspaceId, other.campaign.campaignId, 1)
    ).toEqual([]);
    expect(
      await service.listCampaignAttempts(workspaceId, primary.campaign.campaignId, 2)
    ).toEqual([]);
  });

  it('fails row/document integrity drift closed', async () => {
    const service = store();
    const value = attempt();
    await service.createAttempt({ value, idempotencyKey: 'delivery-integrity-create' });
    await database.getPool().query(
      `UPDATE lite_email_delivery_attempts
          SET recipient_count=2
        WHERE workspace_id=$1 AND delivery_attempt_id=$2`,
      [workspaceId, value.deliveryAttemptId]
    );
    await expect(service.getAttempt(workspaceId, value.deliveryAttemptId)).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE'
    });
  });

  it('fails corrupted command receipt replay closed', async () => {
    const value = attempt();
    await store().createAttempt({
      value,
      idempotencyKey: 'delivery-corrupt-command'
    });
    await database.getPool().query(
      `UPDATE lite_email_delivery_commands
          SET result_json=jsonb_set(result_json,'{recipientCount}','2'::jsonb)
        WHERE workspace_id=$1 AND idempotency_key=$2`,
      [workspaceId, 'delivery-corrupt-command']
    );
    await expect(
      store().createAttempt({
        value,
        idempotencyKey: 'delivery-corrupt-command'
      })
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });

  it('contains no durable raw recipient or provider credential columns', async () => {
    for (const table of [
      'lite_email_delivery_attempts',
      'lite_email_delivery_observations',
      'lite_email_delivery_commands'
    ]) {
      const columns = await database.getPool().query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1`,
        [table]
      );
      const names = columns.rows.map((row) => row.column_name);
      for (const forbidden of [
        'recipient_email',
        'raw_email',
        'api_key',
        'access_token',
        'refresh_token',
        'provider_credential',
        'html_content',
        'text_content'
      ])
        expect(names).not.toContain(forbidden);
    }
  });
});
