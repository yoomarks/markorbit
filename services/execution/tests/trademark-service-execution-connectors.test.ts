import { describe, expect, it } from 'vitest';
import type { TrademarkServiceProtectedActionKind } from '@markorbit/contracts/trademark-service-execution';
import type { TrademarkServiceSandboxConnectorClass } from '@markorbit/contracts/trademark-service-execution-sandbox';
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
import {
  TrademarkServiceSandboxProtectedActionGate,
  createTrademarkServiceExecutionEnvironmentPolicy
} from '../src/trademark-service-execution-sandbox.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const readiness = (): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_m15_wp03',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_m15_wp03', version: 9 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-22T14:00:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m15_wp03'],
  evidenceReferences: ['evidence_m15_wp03'],
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
  if (action === 'AUTHORITY_FILING') return 'EXTERNAL_AUTHORITY' as const;
  return 'EXECUTION' as const;
};

const setup = (
  action: TrademarkServiceProtectedActionKind,
  connectorClass: TrademarkServiceSandboxConnectorClass,
  mode: 'SIMULATED' | 'TEST_CONNECTOR' = 'TEST_CONNECTOR'
) => {
  const auth = authorizeTrademarkServiceExecution({
    workspaceId,
    readiness: readiness(),
    workPackageVersion: 9,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-22T14:01:00.000Z',
    expiresAt: '2026-08-23T14:01:00.000Z',
    allowedActions: [action],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });
  const plan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: auth,
    createdAt: '2026-08-22T14:02:00.000Z',
    steps: [
      {
        action,
        owner: ownerFor(action),
        description: 'M15 WP03 non-production connector rehearsal.'
      }
    ]
  });
  const policy = createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: auth,
    environment: mode === 'SIMULATED' ? 'CI' : 'SANDBOX',
    mode,
    connectorClass,
    endpointClass: mode === 'SIMULATED' ? 'INTERNAL_TEST' : 'ALLOWLISTED_SANDBOX',
    credentialClass: mode === 'SIMULATED' ? 'NONE' : 'TEST_ONLY',
    createdAt: '2026-08-22T14:03:00.000Z'
  });
  const gate = new TrademarkServiceSandboxProtectedActionGate();
  const released = gate.release({
    workspaceId,
    authorization: auth,
    plan,
    policy,
    stepId: plan.steps[0]!.stepId,
    idempotencyKey: `m15-wp03-${action}-${connectorClass}-${mode}`,
    evidenceReferences: ['professional-review_m15_wp03'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-22T14:04:00.000Z',
    currentWorkPackageVersion: 9
  });
  return released;
};

const requestFor = (released: ReturnType<typeof setup>) => ({
  schemaVersion: 1 as const,
  workspaceId,
  release: released.release,
  binding: released.binding,
  evidenceReferences: ['sandbox-evidence_m15_wp03'],
  requestedAt: '2026-08-22T14:05:00.000Z'
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

describe('M15-WP-03 non-production connector boundary', () => {
  it('exercises provider, authority/lifecycle and payment-adjacent test connectors without creating truth', () => {
    const cases = [
      {
        connector: new TrademarkServiceProviderSandboxConnector(),
        released: setup('PROVIDER_INSTRUCTION', 'PROVIDER_SANDBOX')
      },
      {
        connector: new TrademarkServiceAuthorityTestConnector(),
        released: setup('AUTHORITY_FILING', 'AUTHORITY_TEST')
      },
      {
        connector: new TrademarkServicePaymentTestConnector(),
        released: setup('PAYMENT', 'PAYMENT_TEST')
      }
    ];

    for (const { connector, released } of cases) {
      const receipt = connector.execute(requestFor(released));
      expect(receipt.outcome).toBe('TEST_CONNECTOR_BOUNDARY_RECORDED');
      expect(receipt.testBoundaryOnly).toBe(true);
      expect(receipt.liveExternalActionPerformed).toBe(false);
      expect(receipt.providerAcceptanceCreated).toBe(false);
      expect(receipt.officialFilingSuccessCreated).toBe(false);
      expect(receipt.paymentTruthCreated).toBe(false);
      expect(receipt.markRegLifecycleTruthCreated).toBe(false);
      expect(receipt.officialTruthCreated).toBe(false);
    }
  });

  it('supports credential-free simulation for every WP03 connector boundary', () => {
    const cases = [
      ['PROVIDER', 'PROVIDER_INSTRUCTION'],
      ['AUTHORITY_LIFECYCLE', 'AUTHORITY_FILING'],
      ['PAYMENT_ADJACENT', 'PAYMENT']
    ] as const;

    for (const [boundary, action] of cases) {
      const released = setup(action, 'SIMULATOR', 'SIMULATED');
      const receipt = new TrademarkServiceSimulationConnector(boundary).execute(
        requestFor(released)
      );
      expect(receipt.outcome).toBe('SIMULATED_BOUNDARY_RECORDED');
      expect(receipt.connectorClass).toBe('SIMULATOR');
      expect(receipt.credentialClass).toBe('NONE');
      expect(receipt.liveExternalActionPerformed).toBe(false);
    }
  });

  it('fails closed when a protected action is routed to the wrong owner boundary', () => {
    const released = setup('AUTHORITY_FILING', 'PROVIDER_SANDBOX');
    const error = executionError(() =>
      new TrademarkServiceProviderSandboxConnector().execute(requestFor(released))
    );
    expect(error.code).toBe('OWNER_MISMATCH');
  });

  it('fails closed when connector class or mode differs from the durable sandbox binding', () => {
    const released = setup('PROVIDER_INSTRUCTION', 'AUTHORITY_TEST');
    const error = executionError(() =>
      new TrademarkServiceProviderSandboxConnector().execute(requestFor(released))
    );
    expect(error.code).toBe('AUTHORITY_BOUNDARY_VIOLATION');
  });

  it('does not route external communication or publication through WP03 connector boundaries', () => {
    for (const action of ['EXTERNAL_COMMUNICATION', 'PUBLICATION'] as const) {
      const released = setup(action, 'SIMULATOR', 'SIMULATED');
      const error = executionError(() =>
        new TrademarkServiceSimulationConnector('PROVIDER').execute(requestFor(released))
      );
      expect(error.code).toBe('OWNER_MISMATCH');
    }
  });

  it('creates a stable connector attempt identity for the same immutable request', () => {
    const released = setup('PAYMENT', 'PAYMENT_TEST');
    const connector = new TrademarkServicePaymentTestConnector();
    const request = requestFor(released);
    expect(connector.execute(request).connectorAttemptId).toBe(
      connector.execute(structuredClone(request)).connectorAttemptId
    );
  });
});
