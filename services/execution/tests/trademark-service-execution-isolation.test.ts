import { describe, expect, it } from 'vitest';
import type { TrademarkServiceProtectedActionKind } from '@markorbit/contracts/trademark-service-execution';
import type {
  TrademarkServiceSandboxConnectorClass,
  TrademarkServiceSandboxEndpointClass
} from '@markorbit/contracts/trademark-service-execution-sandbox';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import {
  TrademarkServiceExecutionError,
  authorizeTrademarkServiceExecution,
  createTrademarkServiceExecutionPlan
} from '../src/trademark-service-execution.js';
import {
  TrademarkServiceAuthorityTestConnector,
  TrademarkServicePaymentTestConnector,
  TrademarkServiceProviderSandboxConnector,
  TrademarkServiceSimulationConnector
} from '../src/trademark-service-execution-connectors.js';
import { TrademarkServiceSandboxConnectorExecutionGate } from '../src/trademark-service-execution-isolation.js';
import {
  TrademarkServiceSandboxProtectedActionGate,
  createTrademarkServiceExecutionEnvironmentPolicy
} from '../src/trademark-service-execution-sandbox.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const readiness = (): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_m15_wp04',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_m15_wp04', version: 10 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-22T14:20:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m15_wp04'],
  evidenceReferences: ['evidence_m15_wp04'],
  executionAuthorized: false,
  filingAuthorized: false,
  externalContactAuthorized: false,
  paymentAuthorized: false,
  publicationAuthorized: false,
  providerEngagementAuthorized: false
});

const ownerFor = (action: TrademarkServiceProtectedActionKind) => {
  if (action === 'PROVIDER_INSTRUCTION') return 'MGSN' as const;
  if (action === 'PAYMENT') return 'PAYMENT' as const;
  return 'EXTERNAL_AUTHORITY' as const;
};

const setup = (
  action: 'PROVIDER_INSTRUCTION' | 'AUTHORITY_FILING' | 'PAYMENT',
  connectorClass: TrademarkServiceSandboxConnectorClass,
  endpointClass: TrademarkServiceSandboxEndpointClass = 'ALLOWLISTED_SANDBOX',
  mode: 'SIMULATED' | 'TEST_CONNECTOR' = 'TEST_CONNECTOR'
) => {
  const auth = authorizeTrademarkServiceExecution({
    workspaceId,
    readiness: readiness(),
    workPackageVersion: 10,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-22T14:21:00.000Z',
    expiresAt: '2026-08-23T14:21:00.000Z',
    allowedActions: [action],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });
  const plan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: auth,
    createdAt: '2026-08-22T14:22:00.000Z',
    steps: [
      {
        action,
        owner: ownerFor(action),
        description: 'M15 WP04 isolation rehearsal.'
      }
    ]
  });
  const policy = createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: auth,
    environment: mode === 'SIMULATED' ? 'CI' : 'SANDBOX',
    mode,
    connectorClass,
    endpointClass,
    credentialClass: mode === 'SIMULATED' ? 'NONE' : 'TEST_ONLY',
    createdAt: '2026-08-22T14:23:00.000Z'
  });
  const released = new TrademarkServiceSandboxProtectedActionGate().release({
    workspaceId,
    authorization: auth,
    plan,
    policy,
    stepId: plan.steps[0]!.stepId,
    idempotencyKey: `m15-wp04-${action}-${connectorClass}-${endpointClass}-${mode}`,
    evidenceReferences: ['professional-review_m15_wp04'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-22T14:24:00.000Z',
    currentWorkPackageVersion: 10
  });
  return {
    ...released,
    request: {
      schemaVersion: 1 as const,
      workspaceId,
      release: released.release,
      binding: released.binding,
      evidenceReferences: ['sandbox-evidence_m15_wp04'],
      requestedAt: '2026-08-22T14:25:00.000Z'
    }
  };
};

const runtimePolicyFor = (
  released: ReturnType<typeof setup>,
  overrides: Record<string, unknown> = {}
) => ({
  schemaVersion: 1 as const,
  source: 'SERVER_TRUSTED_CONFIGURATION' as const,
  environment: released.binding.environment,
  mode: released.binding.mode,
  connectorClass: released.binding.connectorClass,
  endpointClass: released.binding.endpointClass,
  credentialClass: released.binding.credentialClass,
  egressMode: 'ALLOWLIST_ONLY' as const,
  endpointUrl: 'https://sandbox.example.test/v1/execute',
  allowedHosts: ['sandbox.example.test'],
  testCredentialReference: 'test-credential_wp04' as const,
  productionCredentialPresent: false as const,
  unrestrictedEgressAllowed: false as const,
  clientSuppliedEndpointTrusted: false as const,
  ...overrides
});

const executionError = (run: () => unknown): TrademarkServiceExecutionError => {
  try {
    run();
  } catch (error) {
    if (error instanceof TrademarkServiceExecutionError) return error;
    throw error;
  }
  throw new Error('Expected TrademarkServiceExecutionError.');
};

describe('M15-WP-04 egress and credential isolation', () => {
  it('permits an exact allowlisted HTTPS sandbox endpoint with an opaque test credential reference', () => {
    const released = setup('PROVIDER_INSTRUCTION', 'PROVIDER_SANDBOX');
    const result = new TrademarkServiceSandboxConnectorExecutionGate().execute({
      request: released.request,
      runtimePolicy: runtimePolicyFor(released),
      connector: new TrademarkServiceProviderSandboxConnector()
    });

    expect(result.isolation.permitted).toBe(true);
    expect(result.isolation.endpointHost).toBe('sandbox.example.test');
    expect(result.isolation.productionCredentialUsed).toBe(false);
    expect(result.isolation.unrestrictedEgressUsed).toBe(false);
    expect(result.receipt.liveExternalActionPerformed).toBe(false);
    expect(result.receipt.officialTruthCreated).toBe(false);
  });

  it('permits simulation only when egress and credentials are completely disabled', () => {
    const released = setup('AUTHORITY_FILING', 'SIMULATOR', 'INTERNAL_TEST', 'SIMULATED');
    const result = new TrademarkServiceSandboxConnectorExecutionGate().execute({
      request: released.request,
      runtimePolicy: runtimePolicyFor(released, {
        egressMode: 'DISABLED',
        endpointUrl: undefined,
        allowedHosts: [],
        testCredentialReference: undefined
      }),
      connector: new TrademarkServiceSimulationConnector('AUTHORITY_LIFECYCLE')
    });

    expect(result.isolation.egressMode).toBe('DISABLED');
    expect(result.isolation.endpointHost).toBeUndefined();
    expect(result.receipt.outcome).toBe('SIMULATED_BOUNDARY_RECORDED');
  });

  it('supports bounded loopback and internal-test policies without unrestricted egress', () => {
    const loopback = setup('PAYMENT', 'PAYMENT_TEST', 'LOOPBACK');
    const loopbackResult = new TrademarkServiceSandboxConnectorExecutionGate().execute({
      request: loopback.request,
      runtimePolicy: runtimePolicyFor(loopback, {
        egressMode: 'LOOPBACK_ONLY',
        endpointUrl: 'http://127.0.0.1:4310/test',
        allowedHosts: []
      }),
      connector: new TrademarkServicePaymentTestConnector()
    });
    expect(loopbackResult.isolation.endpointHost).toBe('127.0.0.1');

    const internal = setup('AUTHORITY_FILING', 'AUTHORITY_TEST', 'INTERNAL_TEST');
    const internalResult = new TrademarkServiceSandboxConnectorExecutionGate().execute({
      request: internal.request,
      runtimePolicy: runtimePolicyFor(internal, {
        egressMode: 'INTERNAL_TEST_ONLY',
        endpointUrl: 'http://authority-test.internal/v1/file',
        allowedHosts: ['authority-test.internal']
      }),
      connector: new TrademarkServiceAuthorityTestConnector()
    });
    expect(internalResult.isolation.endpointHost).toBe('authority-test.internal');
  });

  it('rejects runtime environment, mode, connector, endpoint, or credential drift from the durable binding', () => {
    const released = setup('PROVIDER_INSTRUCTION', 'PROVIDER_SANDBOX');
    for (const overrides of [
      { environment: 'PROVIDER_TEST' },
      { mode: 'SIMULATED' },
      { connectorClass: 'AUTHORITY_TEST' },
      { endpointClass: 'INTERNAL_TEST' },
      { credentialClass: 'NONE' }
    ]) {
      expect(
        executionError(() =>
          new TrademarkServiceSandboxConnectorExecutionGate().execute({
            request: released.request,
            runtimePolicy: runtimePolicyFor(released, overrides) as never,
            connector: new TrademarkServiceProviderSandboxConnector()
          })
        ).code
      ).toBe('AUTHORITY_BOUNDARY_VIOLATION');
    }
  });

  it('rejects production-like environment values and production credential flags even when runtime data is cast', () => {
    const released = setup('PROVIDER_INSTRUCTION', 'PROVIDER_SANDBOX');
    for (const overrides of [
      { environment: 'PRODUCTION' },
      { productionCredentialPresent: true },
      { unrestrictedEgressAllowed: true },
      { clientSuppliedEndpointTrusted: true }
    ]) {
      expect(
        executionError(() =>
          new TrademarkServiceSandboxConnectorExecutionGate().execute({
            request: released.request,
            runtimePolicy: runtimePolicyFor(released, overrides) as never,
            connector: new TrademarkServiceProviderSandboxConnector()
          })
        ).code
      ).toBe('AUTHORITY_BOUNDARY_VIOLATION');
    }
  });

  it('rejects wildcard, unallowlisted, non-HTTPS, and credential-bearing external sandbox URLs', () => {
    const released = setup('PROVIDER_INSTRUCTION', 'PROVIDER_SANDBOX');
    for (const overrides of [
      { allowedHosts: ['*.example.test'] },
      { endpointUrl: 'https://other.example.test/v1', allowedHosts: ['sandbox.example.test'] },
      { endpointUrl: 'http://sandbox.example.test/v1' },
      { endpointUrl: 'https://user:secret@sandbox.example.test/v1' }
    ]) {
      expect(
        executionError(() =>
          new TrademarkServiceSandboxConnectorExecutionGate().execute({
            request: released.request,
            runtimePolicy: runtimePolicyFor(released, overrides) as never,
            connector: new TrademarkServiceProviderSandboxConnector()
          })
        ).code
      ).toBe('AUTHORITY_BOUNDARY_VIOLATION');
    }
  });

  it('rejects a connector implementation that does not match the durable connector class', () => {
    const released = setup('PROVIDER_INSTRUCTION', 'PROVIDER_SANDBOX');
    expect(
      executionError(() =>
        new TrademarkServiceSandboxConnectorExecutionGate().execute({
          request: released.request,
          runtimePolicy: runtimePolicyFor(released),
          connector: new TrademarkServiceAuthorityTestConnector()
        })
      ).code
    ).toBe('AUTHORITY_BOUNDARY_VIOLATION');
  });
});
