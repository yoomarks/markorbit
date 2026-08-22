import { describe, expect, it } from 'vitest';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import {
  TrademarkServiceExecutionError,
  authorizeTrademarkServiceExecution,
  classifyTrademarkServiceRecovery,
  createTrademarkServiceExecutionPlan
} from '../src/trademark-service-execution.js';
import { TrademarkServiceSimulationConnector } from '../src/trademark-service-execution-connectors.js';
import { TrademarkServiceSandboxConnectorExecutionGate } from '../src/trademark-service-execution-isolation.js';
import { createTrademarkServiceOperatorReadinessBundle } from '../src/trademark-service-execution-readiness-bundle.js';
import {
  TrademarkServiceSandboxProtectedActionGate,
  createTrademarkServiceExecutionEnvironmentPolicy
} from '../src/trademark-service-execution-sandbox.js';
import { TrademarkServiceDeterministicSimulationRunner } from '../src/trademark-service-execution-simulation.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const readiness = (): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_m15_wp06',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_m15_wp06', version: 12 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-22T15:20:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m15_wp06'],
  evidenceReferences: ['evidence_m15_wp06'],
  executionAuthorized: false,
  filingAuthorized: false,
  externalContactAuthorized: false,
  paymentAuthorized: false,
  publicationAuthorized: false,
  providerEngagementAuthorized: false
});

const setup = (scenario: 'SUCCESS' | 'AMBIGUOUS_RETURN' = 'SUCCESS') => {
  const authorization = authorizeTrademarkServiceExecution({
    workspaceId,
    readiness: readiness(),
    workPackageVersion: 12,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-22T15:21:00.000Z',
    expiresAt: '2026-08-23T15:21:00.000Z',
    allowedActions: ['PROVIDER_INSTRUCTION'],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });
  const plan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization,
    createdAt: '2026-08-22T15:22:00.000Z',
    steps: [
      {
        action: 'PROVIDER_INSTRUCTION',
        owner: 'MGSN',
        description: 'M15 WP06 operator readiness rehearsal.'
      }
    ]
  });
  const environmentPolicy = createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization,
    environment: 'CI',
    mode: 'SIMULATED',
    connectorClass: 'SIMULATOR',
    endpointClass: 'INTERNAL_TEST',
    credentialClass: 'NONE',
    createdAt: '2026-08-22T15:23:00.000Z'
  });
  const released = new TrademarkServiceSandboxProtectedActionGate().release({
    workspaceId,
    authorization,
    plan,
    policy: environmentPolicy,
    stepId: plan.steps[0]!.stepId,
    idempotencyKey: `m15-wp06-${scenario}`,
    evidenceReferences: ['professional-review_m15_wp06'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-22T15:24:00.000Z',
    currentWorkPackageVersion: 12
  });
  const request = {
    schemaVersion: 1 as const,
    workspaceId,
    release: released.release,
    binding: released.binding,
    evidenceReferences: ['simulation-source_m15_wp06'],
    requestedAt: '2026-08-22T15:25:00.000Z'
  };
  const connector = new TrademarkServiceSimulationConnector('PROVIDER');
  const isolationDecision = new TrademarkServiceSandboxConnectorExecutionGate().execute({
    request,
    runtimePolicy: {
      schemaVersion: 1,
      source: 'SERVER_TRUSTED_CONFIGURATION',
      environment: 'CI',
      mode: 'SIMULATED',
      connectorClass: 'SIMULATOR',
      endpointClass: 'INTERNAL_TEST',
      credentialClass: 'NONE',
      egressMode: 'DISABLED',
      allowedHosts: [],
      productionCredentialPresent: false,
      unrestrictedEgressAllowed: false,
      clientSuppliedEndpointTrusted: false
    },
    connector
  }).isolation;
  const simulationEvidence = new TrademarkServiceDeterministicSimulationRunner().run({
    scenario,
    request,
    connector
  }).evidence;
  return {
    authorization,
    plan,
    environmentPolicy,
    release: released.release,
    environmentBinding: released.binding,
    isolationDecision,
    simulationEvidence
  };
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

describe('M15-WP-06 operator readiness bundle', () => {
  it('composes an operator-readable bundle without granting deployment or production authority', () => {
    const source = setup('SUCCESS');
    const bundle = createTrademarkServiceOperatorReadinessBundle({
      workspaceId,
      ...source,
      recovery: classifyTrademarkServiceRecovery({
        outcome: 'SUCCESS',
        reasonCode: 'SIMULATION_COMPLETED'
      }),
      createdAt: '2026-08-22T15:26:00.000Z'
    });

    expect(bundle.reviewState).toBe('READY_FOR_OPERATOR_REVIEW');
    expect(bundle.connectorMode).toBe('SIMULATED');
    expect(bundle.endpointClass).toBe('INTERNAL_TEST');
    expect(bundle.evidenceReferences).toEqual(
      expect.arrayContaining([
        'professional-review_m15_wp06',
        'simulation-source_m15_wp06',
        source.isolationDecision.isolationDecisionId,
        source.simulationEvidence.simulationResponseId
      ])
    );
    expect(bundle.environmentBindingVerified).toBe(true);
    expect(bundle.evidenceSeparatedFromOfficialTruth).toBe(true);
    expect(bundle.deploymentApproved).toBe(false);
    expect(bundle.productionEnablementAuthorized).toBe(false);
    expect(bundle.productionCredentialsAuthorized).toBe(false);
    expect(bundle.liveExternalActionAuthorized).toBe(false);
    expect(bundle.officialTruthCreated).toBe(false);
  });

  it('surfaces ambiguous simulation and recovery work as unresolved human action', () => {
    const source = setup('AMBIGUOUS_RETURN');
    const bundle = createTrademarkServiceOperatorReadinessBundle({
      workspaceId,
      ...source,
      recovery: classifyTrademarkServiceRecovery({
        outcome: 'AMBIGUOUS_EXTERNAL_OUTCOME',
        reasonCode: 'SIMULATED_AMBIGUITY'
      }),
      unresolvedHumanActions: ['Confirm supporting evidence with an authorized operator.'],
      createdAt: '2026-08-22T15:26:00.000Z'
    });

    expect(bundle.reviewState).toBe('HUMAN_ACTION_REQUIRED');
    expect(bundle.unresolvedHumanActions).toEqual(
      expect.arrayContaining([
        'Confirm supporting evidence with an authorized operator.',
        'Review deterministic simulation evidence before any further protected action.',
        'Verify the external outcome before any new protected action is released.'
      ])
    );
  });

  it('fails closed on cross-environment binding drift', () => {
    const source = setup('SUCCESS');
    const error = executionError(() =>
      createTrademarkServiceOperatorReadinessBundle({
        workspaceId,
        ...source,
        environmentBinding: {
          ...source.environmentBinding,
          environment: 'SANDBOX'
        },
        recovery: classifyTrademarkServiceRecovery({
          outcome: 'SUCCESS',
          reasonCode: 'SIMULATION_COMPLETED'
        }),
        createdAt: '2026-08-22T15:26:00.000Z'
      })
    );
    expect(error.code).toBe('AUTHORITY_BOUNDARY_VIOLATION');
  });

  it('fails closed when simulation evidence attempts to claim Official Truth', () => {
    const source = setup('SUCCESS');
    const error = executionError(() =>
      createTrademarkServiceOperatorReadinessBundle({
        workspaceId,
        ...source,
        simulationEvidence: {
          ...source.simulationEvidence,
          officialTruthCreated: true
        } as never,
        recovery: classifyTrademarkServiceRecovery({
          outcome: 'SUCCESS',
          reasonCode: 'SIMULATION_COMPLETED'
        }),
        createdAt: '2026-08-22T15:26:00.000Z'
      })
    );
    expect(error.code).toBe('AUTHORITY_BOUNDARY_VIOLATION');
  });
});
