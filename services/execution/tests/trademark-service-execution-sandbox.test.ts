import { describe, expect, it } from 'vitest';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import {
  TrademarkServiceExecutionError,
  authorizeTrademarkServiceExecution,
  createTrademarkServiceExecutionPlan
} from '../src/trademark-service-execution.js';
import {
  TrademarkServiceSandboxProtectedActionGate,
  createTrademarkServiceExecutionEnvironmentPolicy
} from '../src/trademark-service-execution-sandbox.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const readiness = (): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_m15',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_m15', version: 8 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-22T00:00:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m15'],
  evidenceReferences: ['evidence_m15'],
  executionAuthorized: false,
  filingAuthorized: false,
  externalContactAuthorized: false,
  paymentAuthorized: false,
  publicationAuthorized: false,
  providerEngagementAuthorized: false
});

const authorization = () =>
  authorizeTrademarkServiceExecution({
    workspaceId,
    readiness: readiness(),
    workPackageVersion: 8,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-22T00:05:00.000Z',
    expiresAt: '2026-08-23T00:05:00.000Z',
    allowedActions: ['AUTHORITY_FILING'],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });

const plan = () => {
  const auth = authorization();
  return {
    auth,
    executionPlan: createTrademarkServiceExecutionPlan({
      workspaceId,
      authorization: auth,
      createdAt: '2026-08-22T00:06:00.000Z',
      steps: [
        {
          action: 'AUTHORITY_FILING',
          owner: 'EXTERNAL_AUTHORITY',
          description: 'Sandbox rehearsal only.'
        }
      ]
    })
  };
};

const simulatedPolicy = () =>
  createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: authorization(),
    environment: 'CI',
    mode: 'SIMULATED',
    connectorClass: 'SIMULATOR',
    endpointClass: 'INTERNAL_TEST',
    credentialClass: 'NONE',
    createdAt: '2026-08-22T00:07:00.000Z'
  });

const sandboxPolicy = () =>
  createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: authorization(),
    environment: 'SANDBOX',
    mode: 'TEST_CONNECTOR',
    connectorClass: 'AUTHORITY_TEST',
    endpointClass: 'ALLOWLISTED_SANDBOX',
    credentialClass: 'TEST_ONLY',
    createdAt: '2026-08-22T00:07:00.000Z'
  });

const releaseWith = (
  gate: TrademarkServiceSandboxProtectedActionGate,
  policy: ReturnType<typeof simulatedPolicy>
) => {
  const { auth, executionPlan } = plan();
  return gate.release({
    workspaceId,
    authorization: auth,
    plan: executionPlan,
    policy,
    stepId: executionPlan.steps[0]!.stepId,
    idempotencyKey: 'm15-sandbox-release-1',
    evidenceReferences: ['professional-review_m15'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-22T00:10:00.000Z',
    currentWorkPackageVersion: 8
  });
};

const executionError = (run: () => unknown): TrademarkServiceExecutionError => {
  try {
    run();
  } catch (error) {
    if (error instanceof TrademarkServiceExecutionError) return error;
    throw error;
  }
  throw new Error('Expected TrademarkServiceExecutionError.');
};

describe('M15-WP-02 sandbox execution replay policy', () => {
  it('rejects credentialed or externally targeted simulated execution', () => {
    const auth = authorization();
    expect(
      executionError(() =>
        createTrademarkServiceExecutionEnvironmentPolicy({
          workspaceId,
          authorization: auth,
          environment: 'CI',
          mode: 'SIMULATED',
          connectorClass: 'AUTHORITY_TEST',
          endpointClass: 'INTERNAL_TEST',
          credentialClass: 'TEST_ONLY',
          createdAt: '2026-08-22T00:07:00.000Z'
        })
      ).code
    ).toBe('AUTHORITY_BOUNDARY_VIOLATION');

    expect(
      executionError(() =>
        createTrademarkServiceExecutionEnvironmentPolicy({
          workspaceId,
          authorization: auth,
          environment: 'CI',
          mode: 'SIMULATED',
          connectorClass: 'SIMULATOR',
          endpointClass: 'ALLOWLISTED_SANDBOX',
          credentialClass: 'NONE',
          createdAt: '2026-08-22T00:07:00.000Z'
        })
      ).code
    ).toBe('AUTHORITY_BOUNDARY_VIOLATION');
  });

  it('rejects TEST_CONNECTOR mode when no explicit test connector exists', () => {
    expect(
      executionError(() =>
        createTrademarkServiceExecutionEnvironmentPolicy({
          workspaceId,
          authorization: authorization(),
          environment: 'SANDBOX',
          mode: 'TEST_CONNECTOR',
          connectorClass: 'SIMULATOR',
          endpointClass: 'INTERNAL_TEST',
          credentialClass: 'NONE',
          createdAt: '2026-08-22T00:07:00.000Z'
        })
      ).code
    ).toBe('AUTHORITY_BOUNDARY_VIOLATION');
  });

  it('replays an identical protected action only inside the same environment identity', () => {
    const gate = new TrademarkServiceSandboxProtectedActionGate();
    const policy = simulatedPolicy();
    const first = releaseWith(gate, policy);
    const second = releaseWith(gate, structuredClone(policy));

    expect(second).toEqual(first);
    expect(gate.replayCount).toBe(1);
    expect(first.binding.environmentAndModeIncludedInReplayIdentity).toBe(true);
    expect(first.binding.crossEnvironmentReplayAllowed).toBe(false);
    expect(first.binding.crossModeReplayAllowed).toBe(false);
  });

  it('rejects the same idempotency key when environment and mode change', () => {
    const gate = new TrademarkServiceSandboxProtectedActionGate();
    releaseWith(gate, simulatedPolicy());

    expect(executionError(() => releaseWith(gate, sandboxPolicy())).code).toBe(
      'IDEMPOTENCY_CONFLICT'
    );
  });

  it('produces different durable fingerprints for identical action content in different environments', () => {
    const simulated = releaseWith(
      new TrademarkServiceSandboxProtectedActionGate(),
      simulatedPolicy()
    );
    const sandbox = releaseWith(new TrademarkServiceSandboxProtectedActionGate(), sandboxPolicy());

    expect(simulated.release.idempotencyKey).toBe(sandbox.release.idempotencyKey);
    expect(simulated.release.requestFingerprintSha256).not.toBe(
      sandbox.release.requestFingerprintSha256
    );
    expect(simulated.release.protectedActionReleaseId).not.toBe(
      sandbox.release.protectedActionReleaseId
    );
  });
});
