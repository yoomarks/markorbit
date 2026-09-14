import type { QueryClient } from '@markorbit/persistence';
import { describe, expect, it, vi } from 'vitest';
import type { ManagedCommunicationFoundationTransactionHostV1 } from '../src/managed-communication-foundation.js';
import { MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER } from '../src/managed-communication-microsoft-graph.js';
import {
  createMicrosoftGraphManagedCommunicationProviderRuntimeFromEnvironmentV1,
  MICROSOFT_GRAPH_CLIENT_ID_ENV,
  MICROSOFT_GRAPH_CLIENT_SECRET_ENV,
  MICROSOFT_GRAPH_POLL_INTERVAL_MS_ENV,
  MICROSOFT_GRAPH_REFRESH_TOKEN_ENV,
  MICROSOFT_GRAPH_SCOPE_ENV,
  MICROSOFT_GRAPH_TENANT_ID_ENV
} from '../src/managed-communication-microsoft-graph-runtime.js';

function persistence() {
  const query = { query: vi.fn() } as unknown as QueryClient;
  const database: ManagedCommunicationFoundationTransactionHostV1 = {
    transact: async <T>(callback: (client: QueryClient) => Promise<T>) => callback(query)
  };
  return { database, query };
}
function graphEnvironment(dispatchAuthorized = false): NodeJS.ProcessEnv {
  return {
    MO_MANAGED_COMMUNICATION_RUNTIME_ENABLED: '1',
    MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED: dispatchAuthorized ? '1' : '0',
    MO_MANAGED_COMMUNICATION_WORKSPACE_ID: 'workspace-live-graph',
    MO_MANAGED_COMMUNICATION_ACCOUNT_REF: 'account-live-graph',
    MO_MANAGED_COMMUNICATION_PROVIDER: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
    MO_MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF: 'operator@example.test',
    [MICROSOFT_GRAPH_TENANT_ID_ENV]: 'tenant-test-only',
    [MICROSOFT_GRAPH_CLIENT_ID_ENV]: 'client-test-only',
    [MICROSOFT_GRAPH_CLIENT_SECRET_ENV]: 'client-secret-test-only',
    [MICROSOFT_GRAPH_REFRESH_TOKEN_ENV]: 'refresh-token-test-only',
    [MICROSOFT_GRAPH_SCOPE_ENV]: 'offline_access Mail.ReadWrite Mail.Send',
    [MICROSOFT_GRAPH_POLL_INTERVAL_MS_ENV]: '60000'
  };
}

function create(environment: NodeJS.ProcessEnv, fetchImpl = vi.fn()) {
  const { database, query } = persistence();
  return {
    runtime: createMicrosoftGraphManagedCommunicationProviderRuntimeFromEnvironmentV1({
      environment,
      database,
      query,
      fetchImpl: fetchImpl as typeof fetch
    }),
    fetchImpl
  };
}
describe('Microsoft Graph Managed Communication production runtime wiring', () => {
  it('stays absent when Managed Communication is disabled or another provider is selected', () => {
    const disabled = create({});
    expect(disabled.runtime).toBeUndefined();
    expect(disabled.fetchImpl).not.toHaveBeenCalled();

    const gmailEnvironment: NodeJS.ProcessEnv = {
      MO_MANAGED_COMMUNICATION_RUNTIME_ENABLED: '1',
      MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED: '0',
      MO_MANAGED_COMMUNICATION_WORKSPACE_ID: 'workspace-live-gmail',
      MO_MANAGED_COMMUNICATION_ACCOUNT_REF: 'account-live-gmail',
      MO_MANAGED_COMMUNICATION_PROVIDER: 'GMAIL',
      MO_MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF: 'markorbit.test@gmail.com'
    };
    const gmail = create(gmailEnvironment);
    expect(gmail.runtime).toBeUndefined();
    expect(gmail.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    MICROSOFT_GRAPH_TENANT_ID_ENV,
    MICROSOFT_GRAPH_CLIENT_ID_ENV,
    MICROSOFT_GRAPH_REFRESH_TOKEN_ENV
  ])('fails closed when %s is missing for the selected Graph mailbox', (name) => {
    const environment = graphEnvironment();
    delete environment[name];
    expect(() => create(environment)).toThrow(`${name} is required`);
  });
  it.each(['29999', '3600001', 'not-a-number'])(
    'rejects unsafe Graph poll interval %s',
    (pollInterval) => {
      const environment = graphEnvironment();
      environment[MICROSOFT_GRAPH_POLL_INTERVAL_MS_ENV] = pollInterval;
      expect(() => create(environment)).toThrow(MICROSOFT_GRAPH_POLL_INTERVAL_MS_ENV);
    }
  );

  it('constructs inbound polling without outbound authority and performs no network request', () => {
    const { runtime, fetchImpl } = create(graphEnvironment(false));
    expect(runtime?.client).toBeDefined();
    expect(runtime?.poller).toBeDefined();
    expect(runtime?.sender).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('adds the existing Graph sender only when provider dispatch is explicitly authorized', () => {
    const { runtime, fetchImpl } = create(graphEnvironment(true));
    expect(runtime?.client).toBeDefined();
    expect(runtime?.poller).toBeDefined();
    expect(runtime?.sender).toBeDefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
