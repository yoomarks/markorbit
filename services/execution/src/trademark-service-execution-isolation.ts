import { createHash } from 'node:crypto';
import type {
  TrademarkServiceNonProductionConnectorReceipt,
  TrademarkServiceNonProductionConnectorRequest
} from '@markorbit/contracts/trademark-service-execution-connector';
import type {
  TrademarkServiceIsolationDecision,
  TrademarkServiceSandboxEgressMode,
  TrademarkServiceTrustedConnectorRuntimePolicy
} from '@markorbit/contracts/trademark-service-execution-isolation';
import {
  trademarkServiceExecutionEnvironments,
  trademarkServiceExecutionModes,
  trademarkServiceSandboxConnectorClasses,
  trademarkServiceSandboxCredentialClasses,
  trademarkServiceSandboxEndpointClasses,
  type TrademarkServiceProtectedActionEnvironmentBinding
} from '@markorbit/contracts/trademark-service-execution-sandbox';
import type { TrademarkServiceNonProductionConnector } from './trademark-service-execution-connectors.js';
import { TrademarkServiceExecutionError } from './trademark-service-execution.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const fail = (message: string): never => {
  throw new TrademarkServiceExecutionError('AUTHORITY_BOUNDARY_VIOLATION', message);
};

function assertKnown<T extends string>(value: unknown, values: readonly T[], label: string): asserts value is T {
  if (typeof value !== 'string' || !values.includes(value as T))
    fail(`Trusted connector runtime policy contains an unsupported ${label}.`);
}

const normalizeHost = (value: string) => value.trim().toLowerCase().replace(/\.$/, '');

function normalizedAllowedHosts(values: readonly string[]) {
  const hosts = values.map(normalizeHost);
  if (
    hosts.some(
      (host) =>
        host.length === 0 ||
        host === '*' ||
        host.includes('*') ||
        host.includes('/') ||
        host.includes('://') ||
        /\s/.test(host)
    )
  )
    fail('Sandbox endpoint allowlist must contain exact hostnames only.');
  return [...new Set(hosts)];
}

function parseEndpoint(
  policy: Readonly<TrademarkServiceTrustedConnectorRuntimePolicy>
): string | undefined {
  if (policy.mode === 'SIMULATED') {
    if (
      policy.egressMode !== 'DISABLED' ||
      policy.endpointUrl !== undefined ||
      policy.allowedHosts.length !== 0 ||
      policy.credentialClass !== 'NONE' ||
      policy.testCredentialReference !== undefined
    )
      fail('Simulated execution must disable egress and credentials completely.');
    return undefined;
  }

  if (policy.connectorClass === 'SIMULATOR')
    fail('TEST_CONNECTOR mode cannot use the simulator connector class.');

  if (policy.credentialClass === 'TEST_ONLY') {
    if (
      !policy.testCredentialReference ||
      !policy.testCredentialReference.startsWith('test-credential_') ||
      policy.testCredentialReference === 'test-credential_'
    )
      fail('TEST_ONLY credential class requires an opaque test credential reference.');
  } else if (policy.testCredentialReference !== undefined) {
    fail('Credential references are forbidden when credential class is NONE.');
  }

  if (!policy.endpointUrl) fail('TEST_CONNECTOR mode requires an explicit trusted test endpoint.');

  let endpoint: URL;
  try {
    endpoint = new URL(policy.endpointUrl);
  } catch {
    fail('Trusted test endpoint must be a valid absolute URL.');
  }
  if (endpoint.username || endpoint.password)
    fail('Credentials must never be embedded in sandbox endpoint URLs.');

  const host = normalizeHost(endpoint.hostname);
  const allowlist = normalizedAllowedHosts(policy.allowedHosts);

  if (policy.endpointClass === 'LOOPBACK') {
    if (policy.egressMode !== 'LOOPBACK_ONLY')
      fail('LOOPBACK endpoint class requires LOOPBACK_ONLY egress.');
    if (!['localhost', '127.0.0.1', '::1'].includes(host))
      fail('LOOPBACK execution may only target a local loopback host.');
    if (!['http:', 'https:'].includes(endpoint.protocol))
      fail('LOOPBACK execution requires HTTP or HTTPS.');
    if (allowlist.length !== 0)
      fail('LOOPBACK execution must not depend on an external endpoint allowlist.');
    return host;
  }

  if (policy.endpointClass === 'INTERNAL_TEST') {
    if (policy.egressMode !== 'INTERNAL_TEST_ONLY')
      fail('INTERNAL_TEST endpoint class requires INTERNAL_TEST_ONLY egress.');
    if (!['http:', 'https:'].includes(endpoint.protocol))
      fail('INTERNAL_TEST execution requires HTTP or HTTPS.');
    if (!allowlist.includes(host)) fail('Internal test endpoint is not present in the exact host allowlist.');
    return host;
  }

  if (policy.egressMode !== 'ALLOWLIST_ONLY')
    fail('ALLOWLISTED_SANDBOX endpoint class requires ALLOWLIST_ONLY egress.');
  if (endpoint.protocol !== 'https:')
    fail('External sandbox endpoints require HTTPS.');
  if (!allowlist.includes(host)) fail('Sandbox endpoint is not present in the exact host allowlist.');
  return host;
}

function assertTrustedPolicyMatchesBinding(
  policy: Readonly<TrademarkServiceTrustedConnectorRuntimePolicy>,
  binding: Readonly<TrademarkServiceProtectedActionEnvironmentBinding>,
  connector: TrademarkServiceNonProductionConnector
) {
  if (policy.source !== 'SERVER_TRUSTED_CONFIGURATION')
    fail('Connector runtime policy must originate from trusted server configuration.');
  if (
    policy.productionCredentialPresent !== false ||
    policy.unrestrictedEgressAllowed !== false ||
    policy.clientSuppliedEndpointTrusted !== false
  )
    fail('Production credentials, unrestricted egress, and client-trusted endpoints are forbidden.');

  assertKnown(policy.environment, trademarkServiceExecutionEnvironments, 'environment');
  assertKnown(policy.mode, trademarkServiceExecutionModes, 'execution mode');
  assertKnown(policy.connectorClass, trademarkServiceSandboxConnectorClasses, 'connector class');
  assertKnown(policy.endpointClass, trademarkServiceSandboxEndpointClasses, 'endpoint class');
  assertKnown(policy.credentialClass, trademarkServiceSandboxCredentialClasses, 'credential class');

  if (
    policy.environment !== binding.environment ||
    policy.mode !== binding.mode ||
    policy.connectorClass !== binding.connectorClass ||
    policy.endpointClass !== binding.endpointClass ||
    policy.credentialClass !== binding.credentialClass
  )
    fail('Trusted runtime policy does not exactly match the durable sandbox binding.');

  if (
    connector.descriptor.mode !== binding.mode ||
    connector.descriptor.connectorClass !== binding.connectorClass
  )
    fail('Selected connector implementation does not match the durable sandbox binding.');
}

export interface TrademarkServiceSandboxConnectorExecutionCommand {
  request: Readonly<TrademarkServiceNonProductionConnectorRequest>;
  runtimePolicy: Readonly<TrademarkServiceTrustedConnectorRuntimePolicy>;
  connector: TrademarkServiceNonProductionConnector;
}

export class TrademarkServiceSandboxConnectorExecutionGate {
  execute(command: Readonly<TrademarkServiceSandboxConnectorExecutionCommand>): {
    isolation: TrademarkServiceIsolationDecision;
    receipt: TrademarkServiceNonProductionConnectorReceipt;
  } {
    assertTrustedPolicyMatchesBinding(
      command.runtimePolicy,
      command.request.binding,
      command.connector
    );
    const endpointHost = parseEndpoint(command.runtimePolicy);
    const binding = command.request.binding;
    const isolationDecisionId = `trademark-service-isolation-decision_${hash({
      workspaceId: command.request.workspaceId,
      protectedActionReleaseId: command.request.release.protectedActionReleaseId,
      environmentPolicyId: binding.environmentPolicyId,
      environment: binding.environment,
      mode: binding.mode,
      connectorClass: binding.connectorClass,
      endpointClass: binding.endpointClass,
      credentialClass: binding.credentialClass,
      egressMode: command.runtimePolicy.egressMode,
      endpointHost,
      testCredentialReference: command.runtimePolicy.testCredentialReference
    }).slice(0, 32)}` as const;

    const isolation: TrademarkServiceIsolationDecision = {
      schemaVersion: 1,
      isolationDecisionId,
      workspaceId: command.request.workspaceId,
      protectedActionReleaseId: command.request.release.protectedActionReleaseId,
      environmentPolicyId: binding.environmentPolicyId,
      environment: binding.environment,
      mode: binding.mode,
      connectorClass: binding.connectorClass,
      endpointClass: binding.endpointClass,
      credentialClass: binding.credentialClass,
      egressMode: command.runtimePolicy.egressMode as TrademarkServiceSandboxEgressMode,
      ...(endpointHost ? { endpointHost } : {}),
      ...(command.runtimePolicy.testCredentialReference
        ? { testCredentialReference: command.runtimePolicy.testCredentialReference }
        : {}),
      permitted: true,
      trustedPolicyMatchedDurableBinding: true,
      productionCredentialUsed: false,
      unrestrictedEgressUsed: false,
      liveExternalActionAuthorized: false
    };

    return {
      isolation,
      receipt: command.connector.execute(command.request)
    };
  }
}
