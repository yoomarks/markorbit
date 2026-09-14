import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  MANAGED_COMMUNICATION_PROVIDER_ENV,
  MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV,
  MANAGED_COMMUNICATION_WORKSPACE_ID_ENV
} from '../src/managed-communication-bootstrap.js';
import {
  managedCommunicationNormalizedIdsV1,
  PostgresManagedCommunicationFoundationV1
} from '../src/managed-communication-foundation.js';
import { MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER } from '../src/managed-communication-microsoft-graph.js';

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
const deploymentFixture = path.resolve(
  '../../infrastructure/rehearsal/lite-agency-two-outlook-mailboxes.json'
);
const migrationNamespace = 'capability_engine_managed_communication_two_outlook_test';
const workspaceId = 'workspace_two_outlook_pg';

function databaseConfig(applicationName: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: migrationNamespace,
    DB_APPLICATION_NAME: applicationName
  };
}

function mailboxEnvironment(accountRef: string, providerAccountRef: string): NodeJS.ProcessEnv {
  return {
    [MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV]: '1',
    [MANAGED_COMMUNICATION_WORKSPACE_ID_ENV]: workspaceId,
    [MANAGED_COMMUNICATION_ACCOUNT_REF_ENV]: accountRef,
    [MANAGED_COMMUNICATION_PROVIDER_ENV]: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
    [MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV]: providerAccountRef
  };
}

let database: ManagedDatabase;

integration('two Outlook mailbox runtimes on shared Capability PostgreSQL', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig(databaseConfig('markorbit-two-outlook-setup'))
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
      migrationNamespace,
      await loadMigrationsForOwner(
        migrationsDirectory,
        migrationOwners,
        '@markorbit/capability-engine'
      )
    );
  });

  beforeEach(async () => {
    await database.getPool().query('TRUNCATE capability_communication_accounts CASCADE');
  });

  afterAll(async () => database.close());

  it('isolates two mailbox process bindings and rejects duplicate provider mailbox ownership', async () => {
    const primary = {
      accountRef: 'agency-outlook-primary',
      providerAccountRef: 'primary@example.invalid'
    } as const;
    const secondary = {
      accountRef: 'agency-outlook-secondary',
      providerAccountRef: 'secondary@example.invalid'
    } as const;
    const primaryDatabase = new ManagedDatabase(
      parseDatabaseConfig(databaseConfig('markorbit-outlook-primary-worker'))
    );
    const secondaryDatabase = new ManagedDatabase(
      parseDatabaseConfig(databaseConfig('markorbit-outlook-secondary-worker'))
    );

    await Promise.all([primaryDatabase.start(), secondaryDatabase.start()]);
    try {
      const [primaryBindings, secondaryBindings] = await Promise.all([
        createManagedCommunicationRuntimeBindingsV1({
          environment: mailboxEnvironment(primary.accountRef, primary.providerAccountRef),
          database: primaryDatabase,
          query: primaryDatabase.getPool(),
          now: () => '2026-09-14T09:00:00.000Z'
        }),
        createManagedCommunicationRuntimeBindingsV1({
          environment: mailboxEnvironment(secondary.accountRef, secondary.providerAccountRef),
          database: secondaryDatabase,
          query: secondaryDatabase.getPool(),
          now: () => '2026-09-14T09:00:00.001Z'
        })
      ]);

      expect(primaryBindings).not.toBeNull();
      expect(secondaryBindings).not.toBeNull();
      expect(primaryBindings?.managedCommunicationExchange).toBeUndefined();
      expect(secondaryBindings?.managedCommunicationExchange).toBeUndefined();

      const owner = new PostgresManagedCommunicationFoundationV1(database, database.getPool());
      await expect(owner.resolveAccount(workspaceId, primary.accountRef)).resolves.toMatchObject({
        workspaceId,
        accountRef: primary.accountRef,
        provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
        providerAccountRef: primary.providerAccountRef
      });
      await expect(owner.resolveAccount(workspaceId, secondary.accountRef)).resolves.toMatchObject({
        workspaceId,
        accountRef: secondary.accountRef,
        provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
        providerAccountRef: secondary.providerAccountRef
      });

      const primaryIds = managedCommunicationNormalizedIdsV1({
        workspaceId,
        accountRef: primary.accountRef,
        provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
        providerMessageId: 'same-provider-message-id'
      });
      const secondaryIds = managedCommunicationNormalizedIdsV1({
        workspaceId,
        accountRef: secondary.accountRef,
        provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
        providerMessageId: 'same-provider-message-id'
      });
      expect(primaryIds.messageId).not.toBe(secondaryIds.messageId);
      expect(primaryIds.threadRef).not.toBe(secondaryIds.threadRef);

      const accountCount = await database
        .getPool()
        .query<{ count: string }>(
          'SELECT count(*)::text AS count FROM capability_communication_accounts'
        );
      expect(accountCount.rows[0]?.count).toBe('2');

      await expect(
        createManagedCommunicationRuntimeBindingsV1({
          environment: mailboxEnvironment('agency-outlook-duplicate', primary.providerAccountRef),
          database: secondaryDatabase,
          query: secondaryDatabase.getPool()
        })
      ).rejects.toMatchObject({ code: 'ACCOUNT_CONFLICT' });

      const afterConflict = await database
        .getPool()
        .query<{ count: string }>(
          'SELECT count(*)::text AS count FROM capability_communication_accounts'
        );
      expect(afterConflict.rows[0]?.count).toBe('2');
    } finally {
      await Promise.all([primaryDatabase.close(), secondaryDatabase.close()]);
    }
  });
});

describe('two Outlook mailbox deployment rehearsal', () => {
  it('keeps process, mailbox and secret scopes distinct while sharing owner persistence', async () => {
    const fixture = JSON.parse(await readFile(deploymentFixture, 'utf8')) as {
      shared: {
        databaseEnv: string;
        migrationNamespaceEnv: string;
        workspaceEnv: string;
        provider: string;
      };
      instances: Array<{
        id: string;
        role: string;
        port: number;
        accountRef: string;
        providerAccountRef: string;
        secretScope: string;
        dispatchAuthorized: boolean;
      }>;
      invariants: {
        oneActivePollerPerAccount: boolean;
        duplicateActivePollersForSameAccountSupported: boolean;
        sharedCapabilityDatabase: boolean;
        sharedMigrationNamespace: boolean;
        canonicalHttpEndpointCount: number;
      };
    };

    expect(fixture.shared).toEqual({
      databaseEnv: 'CAPABILITY_ENGINE_DATABASE_URL',
      migrationNamespaceEnv: 'CAPABILITY_ENGINE_MIGRATION_NAMESPACE',
      workspaceEnv: 'MO_MANAGED_COMMUNICATION_WORKSPACE_ID',
      provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER
    });
    expect(fixture.instances).toHaveLength(2);
    expect(new Set(fixture.instances.map((instance) => instance.port)).size).toBe(2);
    expect(new Set(fixture.instances.map((instance) => instance.accountRef)).size).toBe(2);
    expect(new Set(fixture.instances.map((instance) => instance.providerAccountRef)).size).toBe(2);
    expect(new Set(fixture.instances.map((instance) => instance.secretScope)).size).toBe(2);
    expect(fixture.instances.every((instance) => instance.dispatchAuthorized === false)).toBe(true);
    expect(fixture.instances.map((instance) => instance.role).sort()).toEqual([
      'CANONICAL_HTTP_AND_MAILBOX',
      'MAILBOX_WORKER'
    ]);
    expect(fixture.invariants).toEqual({
      oneActivePollerPerAccount: true,
      duplicateActivePollersForSameAccountSupported: false,
      sharedCapabilityDatabase: true,
      sharedMigrationNamespace: true,
      canonicalHttpEndpointCount: 1
    });
  });
});
