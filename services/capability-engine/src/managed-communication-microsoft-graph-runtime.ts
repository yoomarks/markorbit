import type { QueryClient } from '@markorbit/persistence';
import { resolveManagedCommunicationRuntimeConfigV1 } from './managed-communication-bootstrap.js';
import { PostgresManagedCommunicationExactEvidenceStoreV1 } from './managed-communication-exact-evidence.js';
import { PostgresManagedCommunicationSendClaimStoreV1 } from './managed-communication-exchange.js';
import { ManagedCommunicationInboundCorrelatorV1 } from './managed-communication-inbound-correlation.js';
import { ManagedCommunicationPublicReferenceReaderV1 } from './managed-communication-public-reference.js';
import {
  PostgresManagedCommunicationFoundationV1,
  type ManagedCommunicationFoundationTransactionHostV1
} from './managed-communication-foundation.js';
import {
  MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
  MicrosoftGraphManagedCommunicationClientV1,
  MicrosoftGraphManagedCommunicationInboundV1,
  MicrosoftGraphManagedCommunicationPollerV1,
  MicrosoftGraphManagedCommunicationSenderV1,
  MicrosoftGraphRefreshTokenProviderV1
} from './managed-communication-microsoft-graph.js';

export const MICROSOFT_GRAPH_TENANT_ID_ENV =
  'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_TENANT_ID' as const;
export const MICROSOFT_GRAPH_CLIENT_ID_ENV =
  'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_CLIENT_ID' as const;
export const MICROSOFT_GRAPH_CLIENT_SECRET_ENV =
  'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_CLIENT_SECRET' as const;
export const MICROSOFT_GRAPH_REFRESH_TOKEN_ENV =
  'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_REFRESH_TOKEN' as const;
export const MICROSOFT_GRAPH_SCOPE_ENV = 'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_SCOPE' as const;
export const MICROSOFT_GRAPH_POLL_INTERVAL_MS_ENV =
  'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_POLL_INTERVAL_MS' as const;

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 30_000;
const MAX_POLL_INTERVAL_MS = 3_600_000;

export interface MicrosoftGraphManagedCommunicationProviderRuntimeV1 {
  client: MicrosoftGraphManagedCommunicationClientV1;
  poller: MicrosoftGraphManagedCommunicationPollerV1;
  sender?: MicrosoftGraphManagedCommunicationSenderV1;
}

export interface MicrosoftGraphManagedCommunicationProviderRuntimeOptionsV1 {
  environment: NodeJS.ProcessEnv;
  database: ManagedCommunicationFoundationTransactionHostV1;
  query: QueryClient;
  fetchImpl?: typeof globalThis.fetch;
  clock?: () => number;
  now?: () => string;
}

function required(environment: NodeJS.ProcessEnv, name: string, maximum: number): string {
  const value = environment[name]?.trim();
  if (!value || value.length > maximum) {
    throw new Error(`${name} is required and must contain 1 to ${maximum} characters.`);
  }
  return value;
}

function optional(
  environment: NodeJS.ProcessEnv,
  name: string,
  maximum: number
): string | undefined {
  const value = environment[name]?.trim();
  if (!value) return undefined;
  if (value.length > maximum) {
    throw new Error(`${name} must contain at most ${maximum} characters.`);
  }
  return value;
}

function pollInterval(environment: NodeJS.ProcessEnv): number {
  const value = environment[MICROSOFT_GRAPH_POLL_INTERVAL_MS_ENV]?.trim();
  if (!value) return DEFAULT_POLL_INTERVAL_MS;
  if (!/^\d+$/u.test(value)) {
    throw new Error(`${MICROSOFT_GRAPH_POLL_INTERVAL_MS_ENV} must be an integer.`);
  }
  const milliseconds = Number(value);
  if (milliseconds < MIN_POLL_INTERVAL_MS || milliseconds > MAX_POLL_INTERVAL_MS) {
    throw new Error(
      `${MICROSOFT_GRAPH_POLL_INTERVAL_MS_ENV} must be between ${MIN_POLL_INTERVAL_MS} and ${MAX_POLL_INTERVAL_MS}.`
    );
  }
  return milliseconds;
}

export function createMicrosoftGraphManagedCommunicationProviderRuntimeFromEnvironmentV1(
  options: Readonly<MicrosoftGraphManagedCommunicationProviderRuntimeOptionsV1>
): Readonly<MicrosoftGraphManagedCommunicationProviderRuntimeV1> | undefined {
  const runtime = resolveManagedCommunicationRuntimeConfigV1(options.environment);
  if (!runtime || runtime.provider !== MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER) {
    return undefined;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const clientSecret = optional(options.environment, MICROSOFT_GRAPH_CLIENT_SECRET_ENV, 20_000);
  const scope = optional(options.environment, MICROSOFT_GRAPH_SCOPE_ENV, 10_000);
  const tokenProvider = new MicrosoftGraphRefreshTokenProviderV1(
    {
      tenantId: required(options.environment, MICROSOFT_GRAPH_TENANT_ID_ENV, 500),
      clientId: required(options.environment, MICROSOFT_GRAPH_CLIENT_ID_ENV, 10_000),
      refreshToken: required(options.environment, MICROSOFT_GRAPH_REFRESH_TOKEN_ENV, 20_000),
      ...(clientSecret ? { clientSecret } : {}),
      ...(scope ? { scope } : {})
    },
    fetchImpl,
    options.clock
  );
  const client = new MicrosoftGraphManagedCommunicationClientV1(tokenProvider, fetchImpl);
  const foundation = new PostgresManagedCommunicationFoundationV1(options.database, options.query);
  const exactEvidence = new PostgresManagedCommunicationExactEvidenceStoreV1(options.query);
  const claims = new PostgresManagedCommunicationSendClaimStoreV1(options.database, options.query);
  const publicReferences = new ManagedCommunicationPublicReferenceReaderV1(claims);
  const correlation = new ManagedCommunicationInboundCorrelatorV1(publicReferences, claims);
  const inbound = new MicrosoftGraphManagedCommunicationInboundV1({
    client,
    foundation,
    exactEvidence,
    correlation,
    workspaceId: runtime.workspaceId,
    accountRef: runtime.accountRef,
    ...(options.now ? { now: options.now } : {})
  });
  const poller = new MicrosoftGraphManagedCommunicationPollerV1(
    inbound,
    pollInterval(options.environment)
  );
  const sender = runtime.providerDispatchAuthorized
    ? new MicrosoftGraphManagedCommunicationSenderV1(
        client,
        undefined,
        options.now ?? (() => new Date().toISOString())
      )
    : undefined;

  return Object.freeze({
    client,
    poller,
    ...(sender ? { sender } : {})
  });
}
