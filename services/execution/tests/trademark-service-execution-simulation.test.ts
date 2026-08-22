import { describe, expect, it } from 'vitest';
import { trademarkServiceSimulationScenarios } from '@markorbit/contracts/trademark-service-execution-simulation';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import {
  TrademarkServiceExecutionError,
  authorizeTrademarkServiceExecution,
  createTrademarkServiceExecutionPlan
} from '../src/trademark-service-execution.js';
import {
  TrademarkServiceProviderSandboxConnector,
  TrademarkServiceSimulationConnector
} from '../src/trademark-service-execution-connectors.js';
import {
  TrademarkServiceSandboxProtectedActionGate,
  createTrademarkServiceExecutionEnvironmentPolicy
} from '../src/trademark-service-execution-sandbox.js';
import { TrademarkServiceDeterministicSimulationRunner } from '../src/trademark-service-execution-simulation.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const requestedAt = '2026-08-22T15:05:00.000Z';
const readiness = (): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_m15_wp05',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_m15_wp05', version: 11 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-22T15:00:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m15_wp05'],
  evidenceReferences: ['evidence_m15_wp05'],
  executionAuthorized: false,
  filingAuthorized: false,
  externalContactAuthorized: false,
  paymentAuthorized: false,
  publicationAuthorized: false,
  providerEngagementAuthorized: false
});

const setup = (mode: 'SIMULATED' | 'TEST_CONNECTOR' = 'SIMULATED') => {
  const authorization = authorizeTrademarkServiceExecution({
    workspaceId,
    readiness: readiness(),
    workPackageVersion: 11,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-22T15:01:00.000Z',
    expiresAt: '2026-08-23T15:01:00.000Z',
    allowedActions: ['PROVIDER_INSTRUCTION'],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });
  const plan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization,
    createdAt: '2026-08-22T15:02:00.000Z',
    steps: [
      {
        action: 'PROVIDER_INSTRUCTION',
        owner: 'MGSN',
        description: 'M15 WP05 deterministic simulation rehearsal.'
      }
    ]
  });
  const policy = createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization,
    environment: mode === 'SIMULATED' ? 'CI' : 'SANDBOX',
    mode,
    connectorClass: mode === 'SIMULATED' ? 'SIMULATOR' : 'PROVIDER_SANDBOX',
    endpointClass: mode === 'SIMULATED' ? 'INTERNAL_TEST' : 'ALLOWLISTED_SANDBOX',
    credentialClass: mode === 'SIMULATED' ? 'NONE' : 'TEST_ONLY',
    createdAt: '2026-08-22T15:03:00.000Z'
  });
  const released = new TrademarkServiceSandboxProtectedActionGate().release({
    workspaceId,
    authorization,
    plan,
    policy,
    stepId: plan.steps[0]!.stepId,
    idempotencyKey: `m15-wp05-${mode}`,
    evidenceReferences: ['professional-review_m15_wp05'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-22T15:04:00.000Z',
    currentWorkPackageVersion: 11
  });
  return {
    schemaVersion: 1 as const,
    workspaceId,
    release: released.release,
    binding: released.binding,
    evidenceReferences: ['simulation-source_m15_wp05'],
    requestedAt
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

describe('M15-WP-05 deterministic simulation fixtures', () => {
  it('produces deterministic, explicitly simulated evidence for every required outcome', () => {
    const request = setup();
    const connector = new TrademarkServiceSimulationConnector('PROVIDER');

    for (const scenario of trademarkServiceSimulationScenarios) {
      const first = new TrademarkServiceDeterministicSimulationRunner().run({
        scenario,
        request,
        connector
      });
      const second = new TrademarkServiceDeterministicSimulationRunner().run({
        scenario,
        request: structuredClone(request),
        connector: new TrademarkServiceSimulationConnector('PROVIDER')
      });

      expect(second).toEqual(first);
      expect(first.evidence.scenario).toBe(scenario);
      expect(first.evidence.evidenceClass).toBe('SIMULATION_EVIDENCE');
      expect(first.evidence.source).toBe('MARKORBIT_DETERMINISTIC_SIMULATOR');
      expect(first.evidence.providerClaim).toBe(false);
      expect(first.evidence.providerAcceptanceCreated).toBe(false);
      expect(first.evidence.officialFilingSuccessCreated).toBe(false);
      expect(first.evidence.paymentTruthCreated).toBe(false);
      expect(first.evidence.markRegLifecycleTruthCreated).toBe(false);
      expect(first.evidence.officialTruthCreated).toBe(false);
      expect(first.evidence.liveExternalActionPerformed).toBe(false);
      expect(first.evidence.automaticRetryAuthorized).toBe(false);
      expect(first.receipt.outcome).toBe('SIMULATED_BOUNDARY_RECORDED');
    }
  });

  it('classifies timeout, ambiguity, duplicate, stale and malformed fixtures for manual review only', () => {
    const request = setup();
    const runner = new TrademarkServiceDeterministicSimulationRunner();
    const connector = new TrademarkServiceSimulationConnector('PROVIDER');

    for (const scenario of [
      'TIMEOUT',
      'AMBIGUOUS_RETURN',
      'DUPLICATE_RESPONSE',
      'STALE_RESPONSE',
      'MALFORMED_RESPONSE'
    ] as const) {
      const result = runner.run({ scenario, request, connector });
      expect(result.evidence.requiresHumanReview).toBe(true);
      expect(result.evidence.retryClassification).toBe('MANUAL_REVIEW_REQUIRED');
      expect(result.evidence.automaticRetryAuthorized).toBe(false);
    }

    expect(runner.run({ scenario: 'TIMEOUT', request, connector }).evidence.transportState).toBe(
      'TIMED_OUT'
    );
    expect(
      runner.run({ scenario: 'AMBIGUOUS_RETURN', request, connector }).evidence.transportState
    ).toBe('AMBIGUOUS');
    expect(
      runner.run({ scenario: 'STALE_RESPONSE', request, connector }).evidence.sourceFreshness
    ).toBe('STALE_FIXTURE');
    expect(
      runner.run({ scenario: 'MALFORMED_RESPONSE', request, connector }).evidence.parseValidity
    ).toBe('MALFORMED_FIXTURE');
  });

  it('links duplicate response evidence to the deterministic canonical success response', () => {
    const request = setup();
    const runner = new TrademarkServiceDeterministicSimulationRunner();
    const connector = new TrademarkServiceSimulationConnector('PROVIDER');
    const success = runner.run({ scenario: 'SUCCESS', request, connector });
    const duplicate = runner.run({ scenario: 'DUPLICATE_RESPONSE', request, connector });

    expect(duplicate.evidence.duplicateOfSimulationResponseId).toBe(
      success.evidence.simulationResponseId
    );
    expect(duplicate.evidence.simulationResponseId).not.toBe(success.evidence.simulationResponseId);
  });

  it('keeps success and rejection as simulated terminal fixtures without granting authority', () => {
    const request = setup();
    const runner = new TrademarkServiceDeterministicSimulationRunner();
    const connector = new TrademarkServiceSimulationConnector('PROVIDER');

    for (const scenario of ['SUCCESS', 'REJECTION'] as const) {
      const result = runner.run({ scenario, request, connector });
      expect(result.evidence.requiresHumanReview).toBe(false);
      expect(result.evidence.retryClassification).toBe('NO_RETRY');
      expect(result.evidence.officialTruthCreated).toBe(false);
      expect(result.evidence.providerClaim).toBe(false);
    }
  });

  it('fails closed if a TEST_CONNECTOR release is presented to the deterministic simulator', () => {
    const request = setup('TEST_CONNECTOR');
    const error = executionError(() =>
      new TrademarkServiceDeterministicSimulationRunner().run({
        scenario: 'SUCCESS',
        request,
        connector: new TrademarkServiceProviderSandboxConnector()
      })
    );
    expect(error.code).toBe('AUTHORITY_BOUNDARY_VIOLATION');
  });

  it('preserves the existing owner-boundary protection before simulation evidence is created', () => {
    const request = setup();
    const error = executionError(() =>
      new TrademarkServiceDeterministicSimulationRunner().run({
        scenario: 'SUCCESS',
        request,
        connector: new TrademarkServiceSimulationConnector('AUTHORITY_LIFECYCLE')
      })
    );
    expect(error.code).toBe('OWNER_MISMATCH');
  });
});
