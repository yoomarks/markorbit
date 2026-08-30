import type { QueryClient } from '@markorbit/persistence';
import {
  ManagedCommunicationExchangeV1,
  PostgresManagedCommunicationSendClaimStoreV1,
  PostgresManagedCommunicationThreadEvidenceReaderV1,
  type ManagedCommunicationSendTransactionHostV1
} from './managed-communication-exchange.js';
import { PostgresManagedCommunicationExactEvidenceStoreV1 } from './managed-communication-exact-evidence.js';
import {
  PostgresManagedCommunicationFoundationV1,
  type ManagedCommunicationFoundationTransactionHostV1
} from './managed-communication-foundation.js';
import {
  GmailManagedCommunicationClientV1,
  GmailManagedCommunicationInboundV1,
  GmailManagedCommunicationPollerV1,
  GmailManagedCommunicationSenderV1
} from './managed-communication-gmail.js';

export const MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV =
  'MO_MANAGED_COMMUNICATION_RUNTIME_ENABLED' as const;
export const MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV =
  'MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED' as const;
export const MANAGED_COMMUNICATION_PROVIDER_ENV = 'MO_MANAGED_COMMUNICATION_PROVIDER' as const;
export const MANAGED_COMMUNICATION_WORKSPACE_ID_ENV =
  'MO_MANAGED_COMMUNICATION_WORKSPACE_ID' as const;
export const MANAGED_COMMUNICATION_ACCOUNT_REF_ENV =
  'MO_MANAGED_COMMUNICATION_ACCOUNT_REF' as const;
export const MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV =
  'MO_MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF' as const;
export const MANAGED_COMMUNICATION_GMAIL_CLIENT_ID_ENV = 'MO_GMAIL_CLIENT_ID' as const;
export const MANAGED_COMMUNICATION_GMAIL_CLIENT_SECRET_ENV = 'MO_GMAIL_CLIENT_SECRET' as const;
export const MANAGED_COMMUNICATION_GMAIL_REFRESH_TOKEN_ENV = 'MO_GMAIL_REFRESH_TOKEN' as const;
export const MANAGED_COMMUNICATION_GMAIL_POLL_INTERVAL_MS_ENV =
  'MO_MANAGED_COMMUNICATION_GMAIL_POLL_INTERVAL_MS' as const;

export interface ManagedCommunicationRuntimeBindingsV1 {
  managedCommunicationExchange: ManagedCommunicationExchangeV1;
  managedCommunicationThreadReader: PostgresManagedCommunicationThreadEvidenceReaderV1;
  managedCommunicationExactEvidence: PostgresManagedCommunicationExactEvidenceStoreV1;
  start(): Promise<void>;
  stop(): void;
}

export interface ManagedCommunicationRuntimeBootstrapOptionsV1 {
  environment: NodeJS.ProcessEnv;
  database: ManagedCommunicationFoundationTransactionHostV1 & ManagedCommunicationSendTransactionHostV1;
  query: QueryClient;
  fetchImpl?: typeof globalThis.fetch;
  now?: () => Date;
}

type ManagedCommunicationProductionConfigV1 = Readonly<{
  workspaceId: string;
  accountRef: string;
  providerAccountRef: string;
  gmailClientId: string;
  gmailClientSecret: string;
  gmailRefreshToken: string;
  pollIntervalMs: number;
}>;

function toggle(environment: NodeJS.ProcessEnv, name: string): boolean {
  const value = environment[name];
  if (value === undefined || value === '' || value === '0') return false;
  if (value === '1') return true;
  throw new Error(`${name} must be exactly '0' or '1' when configured.`);
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required when Managed Communication runtime is enabled.`);
  return value;
}

function pollInterval(environment: NodeJS.ProcessEnv): number {
  const configured = environment[MANAGED_COMMUNICATION_GMAIL_POLL_INTERVAL_MS_ENV]?.trim();
  if (!configured) return 60_000;
  const value = Number(configured);
  if (!Number.isSafeInteger(value) || value < 30_000)
    throw new Error(
      `${MANAGED_COMMUNICATION_GMAIL_POLL_INTERVAL_MS_ENV} must be an integer of at least 30000.`
    );
  return value;
}

export function parseManagedCommunicationProductionConfigV1(
  environment: NodeJS.ProcessEnv
): ManagedCommunicationProductionConfigV1 | null {
  const runtimeEnabled = toggle(environment, MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV);
  const providerDispatchAuthorized = toggle(
    environment,
    MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV
  );
  if (!runtimeEnabled && !providerDispatchAuthorized) return null;
  if (!runtimeEnabled && providerDispatchAuthorized)
    throw new Error(
      `${MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1 requires ${MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV}=1.`
    );
  if (!providerDispatchAuthorized)
    throw new Error(
      `${MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV}=1 requires ${MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1.`
    );

  const provider = required(environment, MANAGED_COMMUNICATION_PROVIDER_ENV);
  if (provider !== 'GMAIL')
    throw new Error(`${MANAGED_COMMUNICATION_PROVIDER_ENV} must be exactly 'GMAIL' for the approved pilot.`);

  return Object.freeze({
    workspaceId: required(environment, MANAGED_COMMUNICATION_WORKSPACE_ID_ENV),
    accountRef: required(environment, MANAGED_COMMUNICATION_ACCOUNT_REF_ENV),
    providerAccountRef: required(environment, MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV),
    gmailClientId: required(environment, MANAGED_COMMUNICATION_GMAIL_CLIENT_ID_ENV),
    gmailClientSecret: required(environment, MANAGED_COMMUNICATION_GMAIL_CLIENT_SECRET_ENV),
    gmailRefreshToken: required(environment, MANAGED_COMMUNICATION_GMAIL_REFRESH_TOKEN_ENV),
    pollIntervalMs: pollInterval(environment)
  });
}

export async function createManagedCommunicationRuntimeBindingsV1(
  options: Readonly<ManagedCommunicationRuntimeBootstrapOptionsV1>
): Promise<ManagedCommunicationRuntimeBindingsV1 | null> {
  const config = parseManagedCommunicationProductionConfigV1(options.environment);
  if (!config) return null;

  const now = options.now ?? (() => new Date());
  const nowIso = () => now().toISOString();
  const foundation = new PostgresManagedCommunicationFoundationV1(options.database, options.query);
  await foundation.registerAccount({
    workspaceId: config.workspaceId,
    accountRef: config.accountRef,
    channel: 'EMAIL',
    provider: 'GMAIL',
    providerAccountRef: config.providerAccountRef,
    now: nowIso()
  });

  const claims = new PostgresManagedCommunicationSendClaimStoreV1(options.database, options.query);
  const managedCommunicationThreadReader = new PostgresManagedCommunicationThreadEvidenceReaderV1(
    options.query
  );
  const managedCommunicationExactEvidence = new PostgresManagedCommunicationExactEvidenceStoreV1(
    options.query
  );
  const client = new GmailManagedCommunicationClientV1(
    {
      clientId: config.gmailClientId,
      clientSecret: config.gmailClientSecret,
      refreshToken: config.gmailRefreshToken,
      providerAccountRef: config.providerAccountRef
    },
    options.fetchImpl ?? globalThis.fetch,
    () => now().getTime()
  );
  const sender = new GmailManagedCommunicationSenderV1(
    client,
    async ({ workspaceId, accountRef, threadRef }) => {
      const found = await options.query.query<{ provider_thread_id: unknown }>(
        `SELECT provider_thread_id
           FROM capability_communication_messages
          WHERE workspace_id=$1 AND account_ref=$2 AND thread_ref=$3
            AND provider='GMAIL' AND provider_thread_id IS NOT NULL
          ORDER BY observed_at DESC, created_at DESC
          LIMIT 1`,
        [workspaceId, accountRef, threadRef]
      );
      const value = found.rows[0]?.provider_thread_id;
      return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    },
    nowIso
  );
  const managedCommunicationExchange = new ManagedCommunicationExchangeV1({
    foundation,
    claims,
    sender,
    now: nowIso
  });
  const inbound = new GmailManagedCommunicationInboundV1({
    client,
    foundation,
    exactEvidence: managedCommunicationExactEvidence,
    workspaceId: config.workspaceId,
    accountRef: config.accountRef,
    now: nowIso
  });
  const poller = new GmailManagedCommunicationPollerV1(inbound, config.pollIntervalMs);

  return {
    managedCommunicationExchange,
    managedCommunicationThreadReader,
    managedCommunicationExactEvidence,
    start: () => poller.start(),
    stop: () => poller.stop()
  };
}
