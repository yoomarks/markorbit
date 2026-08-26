import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  managedCommunicationNormalizedIdsV1,
  PostgresManagedCommunicationFoundationV1
} from '../src/managed-communication-foundation.js';

const url = process.env.CAPABILITY_ENGINE_COMMUNICATION_TEST_DATABASE_URL;
const required = process.env.CAPABILITY_ENGINE_COMMUNICATION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'CAPABILITY_ENGINE_COMMUNICATION_POSTGRES_TEST_REQUIRED=1 requires CAPABILITY_ENGINE_COMMUNICATION_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const capabilityMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/capability-engine');

const workspaceId = 'workspace_communication_pg';
const accountRef = 'communication-account_pg';
const provider = 'provider-pg-test';

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function message(subject = 'PostgreSQL durable communication'): ManagedCommunicationMessageV1 {
  const providerMessageId = 'provider-message-pg-1';
  const providerThreadId = 'provider-thread-pg-1';
  const ids = managedCommunicationNormalizedIdsV1({
    workspaceId,
    accountRef,
    provider,
    providerMessageId,
    providerThreadId
  });
  return {
    schemaVersion: 1,
    messageId: ids.messageId,
    accountRef,
    threadRef: ids.threadRef,
    channel: 'EMAIL',
    direction: 'INBOUND',
    participants: [
      { role: 'SENDER', address: 'sender@example.test' },
      { role: 'TO', address: 'receiver@example.test' }
    ],
    subject,
    textBody: 'Durable PostgreSQL body',
    attachments: [
      {
        attachmentRef: 'attachment-pg-1',
        fileName: 'evidence.pdf',
        mediaType: 'application/pdf',
        sizeBytes: 11,
        sha256: sha('pdf-evidence')
      }
    ],
    occurredAt: '2026-08-26T04:30:00.000Z',
    providerObservation: {
      provider,
      providerMessageId,
      providerThreadId,
      observedAt: '2026-08-26T04:30:01.000Z'
    }
  };
}

let database: ManagedDatabase;

function store() {
  return new PostgresManagedCommunicationFoundationV1(database.getPool());
}

async function register() {
  return store().registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider,
    providerAccountRef: 'provider-account-pg',
    now: '2026-08-26T04:29:00.000Z'
  });
}

integration('MO-CAP-003 PostgreSQL Managed Communication foundation', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'capability_engine_managed_communication_test',
        DB_APPLICATION_NAME: 'markorbit-managed-communication-tests'
      })
    );
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
         capability_communication_checkpoints,
         capability_communication_messages,
         capability_communication_accounts,
         capability_governed_runtime_replays,
         capability_implementation_profile_versions,
         capability_implementation_profile_identities,
         capability_managed_ai_exact_outputs,
         capability_managed_ai_execution_claims,
         capability_reflection_disposition_profile_revisions,
         capability_reflection_disposition_profiles,
         capability_private_reflection_candidate_events,
         capability_private_reflection_candidates,
         capability_observation_events,
         capability_observation_admission_audit,
         capability_observation_admission_commands,
         capability_ledger_entries,
         capability_observations,
         capability_runtime_definition_imports,
         capability_runtime_definitions,
         capability_runtime_identities
       CASCADE;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
    await migrate(
      database.getPool(),
      'capability_engine_managed_communication_test',
      await capabilityMigrations()
    );
  });

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE capability_communication_checkpoints,
                capability_communication_messages,
                capability_communication_accounts CASCADE`
    );
    await register();
  });

  afterAll(async () => database.close());

  it('replays the immutable normalized observation after store reconstruction without raw idempotency persistence', async () => {
    const command = {
      workspaceId,
      accountRef,
      idempotencyKey: 'communication-pg-import-1',
      message: message(),
      now: '2026-08-26T04:30:02.000Z'
    } as const;

    const first = await store().admitObservation(command);
    const reconstructed = new PostgresManagedCommunicationFoundationV1(database.getPool());
    const replay = await reconstructed.admitObservation(command);

    expect(first.disposition).toBe('ADMITTED');
    expect(replay.disposition).toBe('REPLAYED');
    expect(replay.message).toEqual(first.message);
    expect(replay.authority.externalMessageSent).toBe(false);
    expect(replay.authority.knowledgeApproved).toBe(false);

    const persisted = await database.getPool().query<{
      idempotency_key_sha256: string;
      message_json: unknown;
    }>('SELECT idempotency_key_sha256,message_json FROM capability_communication_messages');
    expect(persisted.rows[0]?.idempotency_key_sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(persisted.rows[0]?.idempotency_key_sha256).not.toBe(command.idempotencyKey);
    expect(JSON.stringify(persisted.rows[0]?.message_json)).not.toContain(command.idempotencyKey);
  });

  it('deduplicates the same provider message across a different import key and rejects conflicting replay', async () => {
    await store().admitObservation({
      workspaceId,
      accountRef,
      idempotencyKey: 'communication-pg-import-1',
      message: message(),
      now: '2026-08-26T04:30:02.000Z'
    });

    const replay = await store().admitObservation({
      workspaceId,
      accountRef,
      idempotencyKey: 'communication-pg-import-2',
      message: message(),
      now: '2026-08-26T04:30:03.000Z'
    });
    expect(replay.disposition).toBe('REPLAYED');

    await expect(
      store().admitObservation({
        workspaceId,
        accountRef,
        idempotencyKey: 'communication-pg-import-3',
        message: message('Tampered provider replay'),
        now: '2026-08-26T04:30:04.000Z'
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_OBSERVATION_CONFLICT' });
  });

  it('recovers the latest durable provider cursor after store reconstruction and fails closed on rebinding', async () => {
    await store().saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'checkpoint-pg-1',
      providerCursor: 'opaque-provider-cursor-pg-1',
      observedAt: '2026-08-26T04:31:00.000Z',
      now: '2026-08-26T04:31:01.000Z'
    });
    await store().saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'checkpoint-pg-2',
      providerCursor: 'opaque-provider-cursor-pg-2',
      observedAt: '2026-08-26T04:32:00.000Z',
      now: '2026-08-26T04:32:01.000Z'
    });

    const reconstructed = new PostgresManagedCommunicationFoundationV1(database.getPool());
    await expect(reconstructed.latestCheckpoint(workspaceId, accountRef)).resolves.toMatchObject({
      checkpointRef: 'checkpoint-pg-2',
      providerCursor: 'opaque-provider-cursor-pg-2'
    });
    await expect(
      reconstructed.saveCheckpoint({
        workspaceId,
        accountRef,
        checkpointRef: 'checkpoint-pg-2',
        providerCursor: 'different-cursor',
        observedAt: '2026-08-26T04:32:00.000Z',
        now: '2026-08-26T04:33:01.000Z'
      })
    ).rejects.toMatchObject({ code: 'CHECKPOINT_CONFLICT' });
  });

  it('enforces workspace isolation and detects persisted message/checkpoint corruption', async () => {
    const admitted = await store().admitObservation({
      workspaceId,
      accountRef,
      idempotencyKey: 'communication-pg-import-1',
      message: message(),
      now: '2026-08-26T04:30:02.000Z'
    });
    await store().saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'checkpoint-pg-1',
      providerCursor: 'opaque-provider-cursor-pg-1',
      observedAt: '2026-08-26T04:31:00.000Z',
      now: '2026-08-26T04:31:01.000Z'
    });

    await expect(
      store().resolveMessage('workspace_other', accountRef, admitted.message.messageId)
    ).rejects.toMatchObject({ code: 'MESSAGE_NOT_FOUND' });

    await database.getPool().query(
      `UPDATE capability_communication_messages
          SET message_json=jsonb_set(message_json,'{subject}','\"tampered\"'::jsonb,false)`
    );
    await expect(
      store().resolveMessage(workspaceId, accountRef, admitted.message.messageId)
    ).rejects.toMatchObject({ code: 'INVALID_PERSISTED_STATE' });

    await database.getPool().query(
      `UPDATE capability_communication_checkpoints SET provider_cursor='tampered-cursor'`
    );
    await expect(store().latestCheckpoint(workspaceId, accountRef)).rejects.toMatchObject({
      code: 'INVALID_PERSISTED_STATE'
    });
  });
});
