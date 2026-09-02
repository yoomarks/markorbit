#!/usr/bin/env node
import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import { resolveManagedCommunicationRuntimeConfigV1 } from '../src/managed-communication-bootstrap.js';
import { PostgresManagedCommunicationExactEvidenceStoreV1 } from '../src/managed-communication-exact-evidence.js';
import { PostgresManagedCommunicationFoundationV1 } from '../src/managed-communication-foundation.js';
import { syncGmailManagedCommunicationInboundFromAnchorV1 } from '../src/managed-communication-gmail-anchor.js';
import {
  GmailManagedCommunicationClientV1,
  GmailManagedCommunicationInboundV1
} from '../src/managed-communication-gmail.js';
import {
  GMAIL_CLIENT_ID_ENV,
  GMAIL_CLIENT_SECRET_ENV,
  GMAIL_REFRESH_TOKEN_ENV
} from '../src/managed-communication-gmail-runtime.js';

function requiredEnvironment(name: string, maximum: number): string {
  const value = process.env[name]?.trim();
  if (!value || value.length > maximum) {
    throw new Error(`${name} is required and must contain 1 to ${maximum} characters.`);
  }
  return value;
}

const argument = process.argv[2]?.trim();
if (!argument) {
  throw new Error(
    'Usage: pnpm exec tsx services/capability-engine/scripts/gmail-inbound-live-sync.ts <anchor-provider-message-id|--resume>'
  );
}
const resume = argument === '--resume';
const anchorProviderMessageId = resume ? undefined : argument;

const runtime = resolveManagedCommunicationRuntimeConfigV1(process.env);
if (!runtime) {
  throw new Error('Managed Communication runtime must be enabled for Gmail live inbound sync.');
}
if (runtime.provider !== 'GMAIL') {
  throw new Error('Gmail live inbound sync requires MO_MANAGED_COMMUNICATION_PROVIDER=GMAIL.');
}

const databaseUrl = process.env.CAPABILITY_ENGINE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('CAPABILITY_ENGINE_DATABASE_URL or DATABASE_URL is required.');
}

const database = new ManagedDatabase(
  parseDatabaseConfig({
    ...process.env,
    DATABASE_URL: databaseUrl,
    DB_MIGRATION_NAMESPACE:
      process.env.CAPABILITY_ENGINE_MIGRATION_NAMESPACE ?? 'capability_engine_runtime_registry'
  })
);

try {
  await database.start();
  const pool = database.getPool();
  const foundation = new PostgresManagedCommunicationFoundationV1(database, pool);
  const exactEvidence = new PostgresManagedCommunicationExactEvidenceStoreV1(pool);
  const client = new GmailManagedCommunicationClientV1({
    clientId: requiredEnvironment(GMAIL_CLIENT_ID_ENV, 10_000),
    clientSecret: requiredEnvironment(GMAIL_CLIENT_SECRET_ENV, 20_000),
    refreshToken: requiredEnvironment(GMAIL_REFRESH_TOKEN_ENV, 20_000),
    providerAccountRef: runtime.providerAccountRef
  });
  const inbound = new GmailManagedCommunicationInboundV1({
    client,
    foundation,
    exactEvidence,
    workspaceId: runtime.workspaceId,
    accountRef: runtime.accountRef
  });

  const result = resume
    ? await inbound.syncOnce()
    : await syncGmailManagedCommunicationInboundFromAnchorV1({
        client,
        inbound,
        foundation,
        workspaceId: runtime.workspaceId,
        accountRef: runtime.accountRef,
        anchorProviderMessageId: anchorProviderMessageId!
      });

  process.stdout.write(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        mode: resume ? 'RESUME' : 'ANCHORED',
        workspaceId: runtime.workspaceId,
        accountRef: runtime.accountRef,
        initialized: result.initialized,
        imported: result.imported,
        providerCursor: result.providerCursor
      },
      null,
      2
    )}\n`
  );
} finally {
  await database.close();
}
