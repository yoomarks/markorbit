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
  createManagedCommunicationRuntimeBindingsV1,
  MANAGED_COMMUNICATION_ACCOUNT_REF_ENV,
  MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV,
  MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV,
  MANAGED_COMMUNICATION_PROVIDER_ENV,
  MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV,
  MANAGED_COMMUNICATION_WORKSPACE_ID_ENV
} from '../src/managed-communication-bootstrap.js';
import {
  managedCommunicationNormalizedIdsV1,
  PostgresManagedCommunicationFoundationV1
} from '../src/managed-communication-foundation.js';
import type { ManagedCommunicationProviderSenderV1 } from '../src/managed-communication-exchange.js';

const url = process.env.CAPABILITY_ENGINE_COMMUNICATION_TEST_DATABASE_URL;
const required = process.env.CAPABILITY_ENGINE_COMMUNICATION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'CAPABILITY_ENGINE_COMMUNICATION_POSTGRES_TEST_REQUIRED=1 requires CAPABILITY_ENGINE_COMMUNICATION_TEST_DATABASE_URL.'
  );
}
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const capabilityMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/capability-engine');

const workspaceId = 'workspace_communication_bootstrap_pg';
const accountRef = 'communication-account_bootstrap_pg';
const provider = 'provider-bootstrap-pg';
const providerAccountRef = 'provider-account-bootstrap-pg';

function environment(dispatch = false): NodeJS.ProcessEnv {
  return {
    [MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV]: '1',
    [MANAGED_COMMUNICATION_WORKSPACE_ID_ENV]: workspaceId,
    [MANAGED_COMMUNICATION_ACCOUNT_REF_ENV]: accountRef,
    [MANAGED_COMMUNICATION_PROVIDER_ENV]: provider,
    [MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV]: providerAccountRef,
    ...(dispatch ? { [MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV]: '1' } : {})
  };
}

function inboundMessage(): ManagedCommunicationMessageV1 {
  const providerMessageId = 'provider-message-bootstrap-in';
  const providerThreadId = 'provider-thread-bootstrap';
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
      { role: 'SENDER', address: 'expert@example.test' },
      { role: 'TO', address: 'operator@example.test' }
    ],
    subject: 'Bootstrap inbound reply',
    textBody: 'Exact provider reply admitted through the production bootstrap.',
    attachments: [],
    occurredAt: '2026-09-01T12:10:00.000Z',
    providerObservation: {
      provider,
      providerMessageId,
      providerThreadId,
      observedAt: '2026-09-01T12:10:01.000Z'
    }
  };
}

const outboundRequest = {
  schemaVersion: 1,
  accountRef,
  channel: 'EMAIL',
  participants: [
    { role: 'SENDER', address: 'operator@example.test' },
    { role: 'TO', address: 'expert@example.test' }
  ],
  subject: 'Bootstrap outbound question',
  textBody: 'Please reply to this provider-neutral test message.',
  attachments: []
} as const;

let database: ManagedDatabase;

integration('Managed Communication production bootstrap on PostgreSQL', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'capability_engine_managed_communication_bootstrap_test',
        DB_APPLICATION_NAME: 'markorbit-managed-communication-bootstrap-tests'
      })
    );
    await database.start();
    await database.getPool().query(
      `DO $reset$
       DECLARE capability_table text;
       BEGIN
         FOR capability_table IN
           SELECT tablename
             FROM pg_tables
            WHERE schemaname = current_schema()
              AND tablename LIKE 'capability\\_%' ESCAPE '\\'
         LOOP
           EXECUTE format(
             'DROP TABLE IF EXISTS %I.%I CASCADE',
             current_schema(),
             capability_table
           );
         END LOOP;
       END
       $reset$;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
    await migrate(
      database.getPool(),
      'capability_engine_managed_communication_bootstrap_test',
      await capabilityMigrations()
    );
  });

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE capability_communication_exact_evidence,
                capability_communication_send_claims,
                capability_communication_checkpoints,
                capability_communication_import_claims,
                capability_communication_messages,
                capability_communication_accounts CASCADE`
    );
  });

  afterAll(async () => database.close());

  it('reuses one durable account binding and replays inbound exact evidence after bootstrap reconstruction', async () => {
    const [first, concurrent] = await Promise.all([
      createManagedCommunicationRuntimeBindingsV1({
        environment: environment(),
        database,
        query: database.getPool(),
        now: () => '2026-09-01T12:09:00.000Z'
      }),
      createManagedCommunicationRuntimeBindingsV1({
        environment: environment(),
        database,
        query: database.getPool(),
        now: () => '2026-09-01T12:09:00.001Z'
      })
    ]);
    expect(first).not.toBeNull();
    expect(concurrent).not.toBeNull();
    expect(first?.managedCommunicationExchange).toBeUndefined();
    expect(concurrent?.managedCommunicationExchange).toBeUndefined();

    const rawPayload = Uint8Array.from(Buffer.from('raw-provider-message-bootstrap', 'utf8'));
    const firstAdmission = await first!.managedCommunicationInbound.ingest({
      workspaceId,
      idempotencyKey: 'bootstrap-inbound-1',
      message: inboundMessage(),
      exactEvidence: {
        rawPayload,
        mediaType: 'message/rfc822',
        headers: [{ name: 'message-id', value: '<provider-message-bootstrap-in>' }],
        metadata: { mailbox: 'inbox' }
      }
    });
    expect(firstAdmission.observationDisposition).toBe('ADMITTED');
    expect(firstAdmission.exactEvidenceDisposition).toBe('ADMITTED');
    expect(firstAdmission.authority.externalMessageSent).toBe(false);
    expect(firstAdmission.authority.knowledgeApproved).toBe(false);

    const reconstructed = await createManagedCommunicationRuntimeBindingsV1({
      environment: environment(),
      database,
      query: database.getPool(),
      now: () => '2026-09-01T12:11:00.000Z'
    });
    const replay = await reconstructed!.managedCommunicationInbound.ingest({
      workspaceId,
      idempotencyKey: 'bootstrap-inbound-1',
      message: inboundMessage(),
      exactEvidence: {
        rawPayload,
        mediaType: 'message/rfc822',
        headers: [{ name: 'message-id', value: '<provider-message-bootstrap-in>' }],
        metadata: { mailbox: 'inbox' }
      }
    });
    expect(replay.observationDisposition).toBe('REPLAYED');
    expect(replay.exactEvidenceDisposition).toBe('REPLAYED');
    expect(replay.exactEvidence).toEqual(firstAdmission.exactEvidence);

    const thread = await reconstructed!.managedCommunicationThreadReader.resolveThread({
      workspaceId,
      accountRef,
      threadRef: inboundMessage().threadRef
    });
    expect(thread).toHaveLength(1);
    expect(thread[0]?.messageId).toBe(inboundMessage().messageId);
    await expect(
      reconstructed!.managedCommunicationExactEvidence.resolveExactEvidence({
        workspaceId,
        accountRef,
        messageId: inboundMessage().messageId
      })
    ).resolves.toEqual(firstAdmission.exactEvidence);

    const accountCount = await database
      .getPool()
      .query<{ count: string }>(
        'SELECT count(*)::text AS count FROM capability_communication_accounts'
      );
    expect(accountCount.rows[0]?.count).toBe('1');

    await expect(
      createManagedCommunicationRuntimeBindingsV1({
        environment: {
          ...environment(),
          [MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV]: 'drifted-provider-account'
        },
        database,
        query: database.getPool()
      })
    ).rejects.toThrow(/conflicts with the existing durable account binding/u);
  });

  it('requires explicit dispatch authorization and preserves exactly-once/reconciliation across reconstruction', async () => {
    let successfulCalls = 0;
    const sender: ManagedCommunicationProviderSenderV1 = {
      send: () => {
        successfulCalls += 1;
        return Promise.resolve({
          providerMessageId: 'provider-message-bootstrap-out',
          providerThreadId: 'provider-thread-bootstrap-out',
          providerReceiptRef: 'provider-receipt-bootstrap-out',
          acceptedAt: '2026-09-01T12:20:01.000Z'
        });
      }
    };

    await expect(
      createManagedCommunicationRuntimeBindingsV1({
        environment: environment(true),
        database,
        query: database.getPool()
      })
    ).rejects.toThrow(/requires an explicit ManagedCommunicationProviderSenderV1/u);
    await expect(
      createManagedCommunicationRuntimeBindingsV1({
        environment: environment(),
        database,
        query: database.getPool(),
        sender
      })
    ).rejects.toThrow(/requires MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED=1/u);

    const first = await createManagedCommunicationRuntimeBindingsV1({
      environment: environment(true),
      database,
      query: database.getPool(),
      sender,
      now: () => '2026-09-01T12:20:00.000Z'
    });
    const input = {
      workspaceId,
      idempotencyKey: 'bootstrap-outbound-1',
      correlationId: 'bootstrap-outbound-1',
      request: outboundRequest
    } as const;
    const receipt = await first!.managedCommunicationExchange!.send(input);

    const reconstructed = await createManagedCommunicationRuntimeBindingsV1({
      environment: environment(true),
      database,
      query: database.getPool(),
      sender,
      now: () => '2026-09-01T12:21:00.000Z'
    });
    await expect(reconstructed!.managedCommunicationExchange!.send(input)).resolves.toEqual(
      receipt
    );
    expect(successfulCalls).toBe(1);

    let uncertainCalls = 0;
    const uncertainSender: ManagedCommunicationProviderSenderV1 = {
      send: () => {
        uncertainCalls += 1;
        return Promise.reject(new Error('provider delivery state unknown'));
      }
    };
    const uncertain = await createManagedCommunicationRuntimeBindingsV1({
      environment: environment(true),
      database,
      query: database.getPool(),
      sender: uncertainSender,
      now: () => '2026-09-01T12:22:00.000Z'
    });
    const uncertainInput = {
      workspaceId,
      idempotencyKey: 'bootstrap-outbound-uncertain',
      correlationId: 'bootstrap-outbound-uncertain',
      request: outboundRequest
    } as const;
    await expect(
      uncertain!.managedCommunicationExchange!.send(uncertainInput)
    ).rejects.toMatchObject({
      code: 'RECONCILIATION_REQUIRED'
    });

    const uncertainReconstructed = await createManagedCommunicationRuntimeBindingsV1({
      environment: environment(true),
      database,
      query: database.getPool(),
      sender: uncertainSender,
      now: () => '2026-09-01T12:23:00.000Z'
    });
    await expect(
      uncertainReconstructed!.managedCommunicationExchange!.send(uncertainInput)
    ).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(uncertainCalls).toBe(1);
  });

  it('does not require provider dispatch or credentials merely to activate durable inbound/read runtime', async () => {
    const bindings = await createManagedCommunicationRuntimeBindingsV1({
      environment: environment(),
      database,
      query: database.getPool()
    });
    expect(bindings).not.toBeNull();
    expect(bindings?.managedCommunicationExchange).toBeUndefined();

    const persisted = new PostgresManagedCommunicationFoundationV1(database, database.getPool());
    await expect(persisted.resolveAccount(workspaceId, accountRef)).resolves.toMatchObject({
      workspaceId,
      accountRef,
      provider,
      providerAccountRef
    });
  });
});
