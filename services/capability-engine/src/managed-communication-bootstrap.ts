import type { QueryClient } from '@markorbit/persistence';
import {
  ManagedCommunicationExchangeV1,
  PostgresManagedCommunicationSendClaimStoreV1,
  PostgresManagedCommunicationThreadEvidenceReaderV1,
  type ManagedCommunicationProviderSenderV1,
  type ManagedCommunicationSendTransactionHostV1
} from './managed-communication-exchange.js';
import { PostgresManagedCommunicationExactEvidenceStoreV1 } from './managed-communication-exact-evidence.js';
import {
  ManagedCommunicationFoundationError,
  PostgresManagedCommunicationFoundationV1,
  type ManagedCommunicationAccountBindingV1,
  type ManagedCommunicationFoundationTransactionHostV1
} from './managed-communication-foundation.js';
import { ManagedCommunicationInboundIngestorV1 } from './managed-communication-inbound.js';

export const MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV =
  'MO_MANAGED_COMMUNICATION_RUNTIME_ENABLED' as const;
export const MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV =
  'MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED' as const;
export const MANAGED_COMMUNICATION_WORKSPACE_ID_ENV =
  'MO_MANAGED_COMMUNICATION_WORKSPACE_ID' as const;
export const MANAGED_COMMUNICATION_ACCOUNT_REF_ENV =
  'MO_MANAGED_COMMUNICATION_ACCOUNT_REF' as const;
export const MANAGED_COMMUNICATION_PROVIDER_ENV = 'MO_MANAGED_COMMUNICATION_PROVIDER' as const;
export const MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV =
  'MO_MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF' as const;

export interface ManagedCommunicationRuntimeConfigV1 {
  workspaceId: string;
  accountRef: string;
  provider: string;
  providerAccountRef: string;
  providerDispatchAuthorized: boolean;
}

export interface ManagedCommunicationRuntimeBindingsV1 {
  managedCommunicationInbound: ManagedCommunicationInboundIngestorV1;
  managedCommunicationThreadReader: PostgresManagedCommunicationThreadEvidenceReaderV1;
  managedCommunicationExactEvidence: PostgresManagedCommunicationExactEvidenceStoreV1;
  managedCommunicationExchange?: ManagedCommunicationExchangeV1;
}

export interface ManagedCommunicationRuntimeBootstrapOptionsV1 {
  environment: NodeJS.ProcessEnv;
  database: ManagedCommunicationFoundationTransactionHostV1 &
    ManagedCommunicationSendTransactionHostV1;
  query: QueryClient;
  sender?: Readonly<ManagedCommunicationProviderSenderV1>;
  now?: () => string;
}

function toggle(environment: NodeJS.ProcessEnv, name: string): boolean {
  const value = environment[name];
  if (value === undefined || value === '' || value === '0') return false;
  if (value === '1') return true;
  throw new Error(`${name} must be exactly '0' or '1' when configured.`);
}

function required(environment: NodeJS.ProcessEnv, name: string, maximum: number): string {
  const value = environment[name]?.trim();
  if (!value || value.length > maximum) {
    throw new Error(`${name} is required and must contain 1 to ${maximum} characters.`);
  }
  return value;
}

export function resolveManagedCommunicationRuntimeConfigV1(
  environment: NodeJS.ProcessEnv
): Readonly<ManagedCommunicationRuntimeConfigV1> | null {
  const runtimeEnabled = toggle(environment, MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV);
  const providerDispatchAuthorized = toggle(
    environment,
    MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV
  );

  if (!runtimeEnabled && !providerDispatchAuthorized) return null;
  if (!runtimeEnabled && providerDispatchAuthorized) {
    throw new Error(
      `${MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1 requires ${MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV}=1.`
    );
  }

  return Object.freeze({
    workspaceId: required(environment, MANAGED_COMMUNICATION_WORKSPACE_ID_ENV, 500),
    accountRef: required(environment, MANAGED_COMMUNICATION_ACCOUNT_REF_ENV, 500),
    provider: required(environment, MANAGED_COMMUNICATION_PROVIDER_ENV, 120),
    providerAccountRef: required(environment, MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV, 500),
    providerDispatchAuthorized
  });
}

function sameAccountBinding(
  binding: Readonly<ManagedCommunicationAccountBindingV1>,
  config: Readonly<ManagedCommunicationRuntimeConfigV1>
): boolean {
  return (
    binding.workspaceId === config.workspaceId &&
    binding.accountRef === config.accountRef &&
    binding.channel === 'EMAIL' &&
    binding.provider === config.provider &&
    binding.providerAccountRef === config.providerAccountRef
  );
}

function assertSameAccountBinding(
  binding: Readonly<ManagedCommunicationAccountBindingV1>,
  config: Readonly<ManagedCommunicationRuntimeConfigV1>
): Readonly<ManagedCommunicationAccountBindingV1> {
  if (!sameAccountBinding(binding, config)) {
    throw new Error(
      'Managed Communication runtime configuration conflicts with the existing durable account binding.'
    );
  }
  return binding;
}

async function ensureAccountBinding(
  foundation: Readonly<PostgresManagedCommunicationFoundationV1>,
  config: Readonly<ManagedCommunicationRuntimeConfigV1>,
  now: () => string
): Promise<Readonly<ManagedCommunicationAccountBindingV1>> {
  try {
    const existing = await foundation.resolveAccount(config.workspaceId, config.accountRef);
    return assertSameAccountBinding(existing, config);
  } catch (error) {
    if (
      !(error instanceof ManagedCommunicationFoundationError) ||
      error.code !== 'ACCOUNT_NOT_FOUND'
    ) {
      throw error;
    }
  }

  try {
    return await foundation.registerAccount({
      workspaceId: config.workspaceId,
      accountRef: config.accountRef,
      channel: 'EMAIL',
      provider: config.provider,
      providerAccountRef: config.providerAccountRef,
      now: now()
    });
  } catch (error) {
    if (
      !(error instanceof ManagedCommunicationFoundationError) ||
      error.code !== 'ACCOUNT_CONFLICT'
    ) {
      throw error;
    }

    try {
      const raced = await foundation.resolveAccount(config.workspaceId, config.accountRef);
      return assertSameAccountBinding(raced, config);
    } catch (resolutionError) {
      if (
        resolutionError instanceof ManagedCommunicationFoundationError &&
        resolutionError.code === 'ACCOUNT_NOT_FOUND'
      ) {
        throw error;
      }
      throw resolutionError;
    }
  }
}

export async function createManagedCommunicationRuntimeBindingsV1(
  options: Readonly<ManagedCommunicationRuntimeBootstrapOptionsV1>
): Promise<Readonly<ManagedCommunicationRuntimeBindingsV1> | null> {
  const config = resolveManagedCommunicationRuntimeConfigV1(options.environment);
  if (!config) {
    if (options.sender) {
      throw new Error(
        `ManagedCommunicationProviderSenderV1 requires ${MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV}=1.`
      );
    }
    return null;
  }

  if (config.providerDispatchAuthorized && !options.sender) {
    throw new Error(
      `${MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1 requires an explicit ManagedCommunicationProviderSenderV1.`
    );
  }
  if (!config.providerDispatchAuthorized && options.sender) {
    throw new Error(
      `ManagedCommunicationProviderSenderV1 requires ${MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1.`
    );
  }

  const now = options.now ?? (() => new Date().toISOString());
  const foundation = new PostgresManagedCommunicationFoundationV1(options.database, options.query);
  await ensureAccountBinding(foundation, config, now);

  const claims = new PostgresManagedCommunicationSendClaimStoreV1(options.database, options.query);
  const managedCommunicationThreadReader = new PostgresManagedCommunicationThreadEvidenceReaderV1(
    options.query
  );
  const managedCommunicationExactEvidence = new PostgresManagedCommunicationExactEvidenceStoreV1(
    options.query
  );
  const managedCommunicationInbound = new ManagedCommunicationInboundIngestorV1({
    foundation,
    exactEvidence: managedCommunicationExactEvidence,
    now
  });

  const managedCommunicationExchange = options.sender
    ? new ManagedCommunicationExchangeV1({
        foundation,
        claims,
        sender: options.sender,
        now
      })
    : undefined;

  return Object.freeze({
    managedCommunicationInbound,
    managedCommunicationThreadReader,
    managedCommunicationExactEvidence,
    ...(managedCommunicationExchange === undefined ? {} : { managedCommunicationExchange })
  });
}
