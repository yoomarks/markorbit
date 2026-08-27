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
import {
  ManagedCommunicationExchangeV1,
  PostgresManagedCommunicationSendClaimStoreV1,
  PostgresManagedCommunicationThreadEvidenceReaderV1,
  type ManagedCommunicationProviderSenderV1
} from '../src/managed-communication-exchange.js';

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

const workspaceId = 'workspace_communication_outbound_pg';
const accountRef = 'communication-account_outbound_pg';
const provider = 'provider-outbound-pg-test';

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

let database: ManagedDatabase;

function foundation() {
  return new PostgresManagedCommunicationFoundationV1(database, database.getPool());
}

function claims() {
  return new PostgresManagedCommunicationSendClaimStoreV1(database, database.getPool());
}

function exchange(sender: ManagedCommunicationProviderSenderV1) {
  return new ManagedCommunicationExchangeV1({
    foundation: foundation(),
    claims: claims(),
    sender,
    now: () => '2026-08-27T05:01:00.000Z',
    ownerTokenFactory: () => 'owner-token-postgres'
  });
}

const request = {
  schemaVersion: 1,
  accountRef,
  channel: 'EMAIL',
  participants: [
    { role: 'SENDER', address: 'operator@example.test' },
    { role: 'TO', address: 'expert@example.test' }
  ],
  subject: 'Restart-safe expert question',
  textBody: 'Please reply to this expert question.',
  attachments: [
    {
      attachmentRef: 'expert-question-pg',
      fileName: 'question.txt',
      mediaType: 'text/plain',
      sizeBytes: 8,
      sha256: sha('question')
    }
  ]
} as const;

async function register() {
  await foundation().registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider,
    providerAccountRef: 'provider-account-outbound-pg',
    now: '2026-08-27T05:00:00.000Z'
  });
}

integration('Shared Communication PostgreSQL outbound exchange', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'capability_engine_managed_communication_outbound_test',
        DB_APPLICATION_NAME: 'markorbit-managed-communication-outbound-tests'
      })
    );
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
         capability_communication_send_claims,
         capability_communication_checkpoints,
         capability_communication_import_claims,
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
      'capability_engine_managed_communication_outbound_test',
      await capabilityMigrations()
    );
  });

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE capability_communication_send_claims,
                capability_communication_checkpoints,
                capability_communication_import_claims,
                capability_communication_messages,
                capability_communication_accounts CASCADE`
    );
    await register();
  });

  afterAll(async () => database.close());

  it('replays one durable send after store reconstruction without another provider call', async () => {
    let calls = 0;
    const sender: ManagedCommunicationProviderSenderV1 = {
      send: () => {
        calls += 1;
        return Promise.resolve({
          providerMessageId: 'provider-message-pg-send-1',
          providerThreadId: 'provider-thread-pg-send-1',
          providerReceiptRef: 'provider-receipt-pg-send-1',
          acceptedAt: '2026-08-27T05:01:01.000Z'
        });
      }
    };
    const input = {
      workspaceId,
      idempotencyKey: 'expert-task-pg-1',
      correlationId: 'expert-task-pg-1',
      request
    } as const;

    const first = await exchange(sender).send(input);
    const replay = await exchange(sender).send(input);

    expect(calls).toBe(1);
    expect(replay).toEqual(first);
    const counts = await database.getPool().query<{
      sends: string;
      messages: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM capability_communication_send_claims) AS sends,
         (SELECT count(*)::text FROM capability_communication_messages) AS messages`
    );
    expect(counts.rows[0]).toEqual({ sends: '1', messages: '1' });
    const persisted = await database.getPool().query<{
      idempotency_key_sha256: string;
      receipt_json: unknown;
    }>(
      `SELECT idempotency_key_sha256,receipt_json
         FROM capability_communication_send_claims`
    );
    expect(persisted.rows[0]?.idempotency_key_sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(persisted.rows[0])).not.toContain(input.idempotencyKey);
  });

  it('persists provider uncertainty across restart and never auto-resends', async () => {
    let calls = 0;
    const sender: ManagedCommunicationProviderSenderV1 = {
      send: () => {
        calls += 1;
        return Promise.reject(new Error('delivery state unknown'));
      }
    };
    const input = {
      workspaceId,
      idempotencyKey: 'expert-task-pg-uncertain',
      correlationId: 'expert-task-pg-uncertain',
      request
    } as const;

    await expect(exchange(sender).send(input)).rejects.toMatchObject({
      code: 'RECONCILIATION_REQUIRED'
    });
    await expect(exchange(sender).send(input)).rejects.toMatchObject({
      code: 'RECONCILIATION_REQUIRED'
    });
    expect(calls).toBe(1);
    const state = await database
      .getPool()
      .query<{ state: string; reconciliation_reason: string }>(
        `SELECT state,reconciliation_reason FROM capability_communication_send_claims`
      );
    expect(state.rows[0]).toMatchObject({
      state: 'RECONCILIATION_REQUIRED',
      reconciliation_reason: 'PROVIDER_THROW_AFTER_DISPATCH_MARK'
    });
  });

  it('correlates immutable inbound reply evidence on the durable provider thread', async () => {
    const sender: ManagedCommunicationProviderSenderV1 = {
      send: () =>
        Promise.resolve({
          providerMessageId: 'provider-message-pg-thread-out',
          providerThreadId: 'provider-thread-pg-shared',
          providerReceiptRef: 'provider-receipt-pg-thread-out',
          acceptedAt: '2026-08-27T05:01:01.000Z'
        })
    };
    const sent = await exchange(sender).send({
      workspaceId,
      idempotencyKey: 'expert-task-pg-thread',
      correlationId: 'expert-task-pg-thread',
      request
    });
    const inboundIds = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider,
      providerMessageId: 'provider-message-pg-thread-in',
      providerThreadId: 'provider-thread-pg-shared'
    });
    const inbound: ManagedCommunicationMessageV1 = {
      schemaVersion: 1,
      messageId: inboundIds.messageId,
      accountRef,
      threadRef: inboundIds.threadRef,
      channel: 'EMAIL',
      direction: 'INBOUND',
      participants: [
        { role: 'SENDER', address: 'expert@example.test' },
        { role: 'TO', address: 'operator@example.test' }
      ],
      subject: 'Re: Restart-safe expert question',
      textBody: 'This is the immutable expert reply.',
      attachments: [
        {
          attachmentRef: 'expert-reply-evidence',
          fileName: 'reply.pdf',
          mediaType: 'application/pdf',
          sizeBytes: 10,
          sha256: sha('reply-pdf')
        }
      ],
      occurredAt: '2026-08-27T05:02:00.000Z',
      providerObservation: {
        provider,
        providerMessageId: 'provider-message-pg-thread-in',
        providerThreadId: 'provider-thread-pg-shared',
        observedAt: '2026-08-27T05:02:01.000Z'
      }
    };
    await foundation().admitObservation({
      workspaceId,
      accountRef,
      idempotencyKey: 'inbound-expert-reply-pg',
      message: inbound,
      now: '2026-08-27T05:02:02.000Z'
    });

    expect(inbound.threadRef).toBe(sent.threadRef);
    const reader = new PostgresManagedCommunicationThreadEvidenceReaderV1(database.getPool());
    const thread = await reader.resolveThread({
      workspaceId,
      accountRef,
      threadRef: sent.threadRef
    });
    expect(thread).toHaveLength(2);
    expect(thread.map((item) => item.direction)).toEqual(['OUTBOUND', 'INBOUND']);
    expect(thread[1]?.attachments[0]?.sha256).toBe(sha('reply-pdf'));
  });
});
