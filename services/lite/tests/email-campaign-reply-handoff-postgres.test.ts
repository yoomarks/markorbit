import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  noEmailCampaignReplyHandoffAuthorityConsequencesV1,
  type EmailCampaignReplyHandoffV1
} from '@markorbit/contracts/email-campaign-reply-handoff';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  type EmailDeliveryAttemptV1
} from '@markorbit/contracts/email-delivery';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresEmailCampaignReplyHandoffStore } from '../src/email-campaign-reply-handoff.js';
import { PostgresEmailDeliveryStore } from '../src/email-delivery.js';

const url = process.env.LITE_EMAIL_DELIVERY_TEST_DATABASE_URL;
const required = process.env.LITE_EMAIL_DELIVERY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_EMAIL_DELIVERY_TEST_DATABASE_URL is required when LITE_EMAIL_DELIVERY_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceId = '14141414-1414-4414-8414-141414141414';

function attempt(): EmailDeliveryAttemptV1 {
  return {
    schemaVersion: 1,
    deliveryAttemptId: 'email-delivery-attempt_reply_pg',
    version: 1,
    workspaceId,
    executionRelease: {
      releaseId: 'protected-action-release_reply_pg',
      version: 1,
      effectFingerprintSha256: '1'.repeat(64)
    },
    campaign: { campaignId: 'email-campaign_reply_pg', version: 1 },
    senderProfile: {
      senderProfileId: 'email-sender-profile_reply_pg',
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
    correlationId: 'reply:pg:0',
    attemptNumber: 1,
    status: 'ACCEPTED',
    providerSubmissionRef: '010001replypg-000000',
    createdAt: '2026-09-19T05:00:00.000Z',
    updatedAt: '2026-09-19T05:01:00.000Z',
    authority: noEmailDeliveryAuthorityConsequencesV1
  };
}

function handoff(): EmailCampaignReplyHandoffV1 {
  return {
    schemaVersion: 1,
    replyHandoffId: 'email-campaign-reply-handoff_pg',
    workspaceId,
    campaign: { campaignId: 'email-campaign_reply_pg', version: 1 },
    deliveryAttempt: {
      deliveryAttemptId: 'email-delivery-attempt_reply_pg',
      version: 1
    },
    senderProfile: {
      senderProfileId: 'email-sender-profile_reply_pg',
      version: 1
    },
    managedCommunication: {
      accountRef: 'managed-account_reply_pg',
      messageId: 'managed-message_reply_pg',
      threadRef: 'managed-thread_reply_pg',
      provider: 'MICROSOFT_GRAPH',
      providerMessageId: 'AQMk-reply-pg',
      observedAt: '2026-09-19T06:00:00.000Z'
    },
    inboundEvidence: {
      evidenceRef: 'commevidence_reply_pg',
      sha256: '5'.repeat(64)
    },
    outboundProviderSubmissionRef: '010001replypg-000000',
    correlationMethod: 'PROVIDER_MESSAGE_REFERENCE',
    correlationEvidenceFingerprintSha256: '6'.repeat(64),
    status: 'CORRELATED',
    createdAt: '2026-09-19T06:01:00.000Z',
    authority: noEmailCampaignReplyHandoffAuthorityConsequencesV1
  };
}

suite('PostgreSQL Email Campaign reply handoff owner', () => {
  const databaseConfig = () => ({
    connection: { url: url! },
    applicationName: 'lite-email-reply-handoff-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable' as const,
    migrationNamespace: 'lite_email_reply_handoff_test'
  });
  let database = new ManagedDatabase(databaseConfig());
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

  const deliveryStore = () =>
    new PostgresEmailDeliveryStore(database, database.getPool(), () => '2026-09-19T06:02:00.000Z');
  const handoffStore = () =>
    new PostgresEmailCampaignReplyHandoffStore(
      database,
      database.getPool(),
      () => '2026-09-19T06:02:00.000Z'
    );

  async function seedExactLineage() {
    const hashA = 'a'.repeat(64);
    const hashB = 'b'.repeat(64);
    const hashC = 'c'.repeat(64);
    const now = '2026-09-19T04:00:00.000Z';
    await database.getPool().query(
      `INSERT INTO lite_campaign_audience_snapshot_versions(
         workspace_id,audience_snapshot_id,version,reviewed_send_fingerprint_sha256,
         audience_fingerprint_sha256,recipient_count,captured_at,document_json,recorded_at
       ) VALUES($1,'campaign-audience_reply_pg',1,$2,$3,1,$4,'{}'::jsonb,$4)`,
      [workspaceId, hashA, hashB, now]
    );
    await database.getPool().query(
      `INSERT INTO lite_campaign_content_projection_versions(
         workspace_id,content_projection_id,version,publish_package_id,publish_package_version,
         publish_package_fingerprint_sha256,reviewed_send_fingerprint_sha256,
         projection_fingerprint_sha256,created_at,document_json,recorded_at
       ) VALUES($1,'campaign-content_reply_pg',1,'publish-package_reply_pg',1,$2,$3,$4,$5,'{}'::jsonb,$5)`,
      [workspaceId, hashA, hashB, hashC, now]
    );
    await database.getPool().query(
      `INSERT INTO lite_campaign_brand_projection_versions(
         workspace_id,brand_projection_id,version,source_kind,source_ref,
         brand_projection_fingerprint_sha256,captured_at,document_json,recorded_at
       ) VALUES($1,'campaign-brand_reply_pg',1,'CAMPAIGN_LOCAL_PRESENTATION',
                'campaign-brand:reply-pg',$2,$3,'{}'::jsonb,$3)`,
      [workspaceId, hashA, now]
    );
    await database.getPool().query(
      `INSERT INTO lite_email_campaign_versions(
         workspace_id,campaign_id,version,purpose,status,audience_snapshot_id,
         audience_snapshot_version,content_projection_id,content_projection_version,
         brand_projection_id,brand_projection_version,campaign_fingerprint_sha256,
         document_json,created_at,updated_at,recorded_at
       ) VALUES($1,'email-campaign_reply_pg',1,'PROSPECT_OUTREACH','READY_FOR_HUMAN_REVIEW',
                'campaign-audience_reply_pg',1,'campaign-content_reply_pg',1,
                'campaign-brand_reply_pg',1,$2,'{}'::jsonb,$3,$3,$3)`,
      [workspaceId, hashA, now]
    );
    await database.getPool().query(
      `INSERT INTO lite_email_sender_profile_versions(
         workspace_id,sender_profile_id,version,status,from_domain,from_address,
         verification_status,verification_observed_at,reputation_isolation_key,
         document_json,updated_at,recorded_at
       ) VALUES($1,'email-sender-profile_reply_pg',1,'REVOKED','mail.example.com',
                'reply@mail.example.com','VERIFIED',$2,'reply-reputation-pg','{}'::jsonb,$2,$2)`,
      [workspaceId, now]
    );
  }

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
    await migrate(database.getPool(), 'lite_email_reply_handoff_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug)
       VALUES($1,'Email Reply Handoff','email-reply-handoff')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
  }, 30000);

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE
         lite_email_campaign_reply_handoff_commands,
         lite_email_campaign_reply_handoffs,
         lite_email_delivery_commands,
         lite_email_delivery_observations,
         lite_email_delivery_attempts,
         lite_email_campaign_versions,
         lite_email_sender_profile_versions,
         lite_campaign_audience_snapshot_versions,
         lite_campaign_content_projection_versions,
         lite_campaign_brand_projection_versions
       CASCADE`
    );
    await seedExactLineage();
  });

  afterAll(async () => {
    await database.close();
  });

  it('registers migration 0137 under Lite owner', async () => {
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    expect(migrations.map((value) => `${value.version}_${value.name}`)).toContain(
      '0137_lite_email_campaign_reply_handoffs'
    );
  });

  it('persists exact correlated handoff and replays the identical command', async () => {
    await deliveryStore().createAttempt({
      value: attempt(),
      idempotencyKey: 'reply-pg-attempt'
    });
    const value = handoff();
    const first = await handoffStore().recordHandoff({
      value,
      idempotencyKey: 'reply-pg-record'
    });
    expect(first).toEqual(value);
    expect(
      await handoffStore().recordHandoff({
        value,
        idempotencyKey: 'reply-pg-record'
      })
    ).toEqual(value);
    expect(await handoffStore().getHandoff(workspaceId, value.replyHandoffId)).toEqual(value);
  });

  it('replays the same logical reply under a new idempotency key without duplicating the handoff', async () => {
    await deliveryStore().createAttempt({
      value: attempt(),
      idempotencyKey: 'reply-pg-logical-attempt'
    });
    const value = handoff();
    const first = await handoffStore().recordHandoff({
      value,
      idempotencyKey: 'reply-pg-logical-first'
    });
    const replay = await handoffStore().recordHandoff({
      value: {
        ...value,
        createdAt: '2026-09-19T06:02:00.000Z'
      },
      idempotencyKey: 'reply-pg-logical-second'
    });
    expect(replay).toEqual(first);
    const count = await database.getPool().query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM lite_email_campaign_reply_handoffs
        WHERE workspace_id=$1 AND managed_account_ref=$2 AND managed_message_id=$3`,
      [workspaceId, value.managedCommunication.accountRef, value.managedCommunication.messageId]
    );
    expect(count.rows[0]?.count).toBe('1');
  });

  it('rejects changed correlation for the same logical Managed Communication reply', async () => {
    await deliveryStore().createAttempt({
      value: attempt(),
      idempotencyKey: 'reply-pg-conflict-attempt'
    });
    const value = handoff();
    await handoffStore().recordHandoff({
      value,
      idempotencyKey: 'reply-pg-conflict-first'
    });
    await expect(
      handoffStore().recordHandoff({
        value: {
          ...value,
          correlationEvidenceFingerprintSha256: '7'.repeat(64),
          createdAt: '2026-09-19T06:02:00.000Z'
        },
        idempotencyKey: 'reply-pg-conflict-second'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('fails closed if the command receipt is tampered after persistence', async () => {
    await deliveryStore().createAttempt({
      value: attempt(),
      idempotencyKey: 'reply-pg-tamper-attempt'
    });
    const value = handoff();
    await handoffStore().recordHandoff({
      value,
      idempotencyKey: 'reply-pg-tamper'
    });
    await database.getPool().query(
      `UPDATE lite_email_campaign_reply_handoff_commands
          SET result_json=jsonb_set(
            result_json,
            '{correlationEvidenceFingerprintSha256}',
            to_jsonb($3::text)
          )
        WHERE workspace_id=$1 AND idempotency_key=$2`,
      [workspaceId, 'reply-pg-tamper', '7'.repeat(64)]
    );
    await expect(
      handoffStore().recordHandoff({
        value,
        idempotencyKey: 'reply-pg-tamper'
      })
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });

  it('requires the exact durable delivery attempt lineage', async () => {
    await expect(
      handoffStore().recordHandoff({
        value: handoff(),
        idempotencyKey: 'reply-pg-missing-attempt'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('contains no durable raw reply content, address, attachment, or credential columns', async () => {
    for (const table of [
      'lite_email_campaign_reply_handoffs',
      'lite_email_campaign_reply_handoff_commands'
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
        'sender_email',
        'email_address',
        'subject',
        'text_body',
        'html_body',
        'raw_email',
        'raw_payload',
        'attachment',
        'attachments',
        'api_key',
        'access_token',
        'refresh_token',
        'provider_credential'
      ])
        expect(names).not.toContain(forbidden);
    }
  });
});
