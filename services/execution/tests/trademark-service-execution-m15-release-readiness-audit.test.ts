import { describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  TrademarkServiceNonProductionConnectorRequest
} from '@markorbit/contracts/trademark-service-execution-connector';
import type { TrademarkServiceTrustedConnectorRuntimePolicy } from '@markorbit/contracts/trademark-service-execution-isolation';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  TrademarkServiceSimulationConnector,
  TrademarkServiceProviderSandboxConnector,
  type TrademarkServiceNonProductionConnector
} from '../src/trademark-service-execution-connectors.js';
import { createTrademarkServiceExecutionRoutes } from '../src/trademark-service-execution-http.js';
import { TrademarkServiceSandboxConnectorExecutionGate } from '../src/trademark-service-execution-isolation.js';
import {
  classifyTrademarkServiceRecoveryDrill,
  createTrademarkServiceExecutionCorrelationId
} from '../src/trademark-service-execution-observability.js';
import type { PostgresTrademarkServiceExecutionRepository } from '../src/trademark-service-execution-postgres.js';
import { createTrademarkServiceOperatorReadinessBundle } from '../src/trademark-service-execution-readiness-bundle.js';
import {
  TrademarkServiceSandboxProtectedActionGate,
  createTrademarkServiceExecutionEnvironmentPolicy
} from '../src/trademark-service-execution-sandbox.js';
import { TrademarkServiceDeterministicSimulationRunner } from '../src/trademark-service-execution-simulation.js';
import {
  authorizeTrademarkServiceExecution,
  classifyTrademarkServiceRecovery,
  createTrademarkServiceExecutionPlan
} from '../src/trademark-service-execution.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const workPackageVersion = 17;

const readiness = (workspace = workspaceId): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_m15_wp08',
  workspaceId: workspace,
  workPackage: { id: 'trademark-service-work-package_m15_wp08', version: workPackageVersion },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-23T00:00:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m15_wp08'],
  evidenceReferences: ['evidence_m15_wp08'],
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
    workPackageVersion,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-23T00:01:00.000Z',
    expiresAt: '2026-08-24T00:01:00.000Z',
    allowedActions: ['PROVIDER_INSTRUCTION'],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });

const executionPlan = () => {
  const auth = authorization();
  const plan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: auth,
    createdAt: '2026-08-23T00:02:00.000Z',
    steps: [
      {
        action: 'PROVIDER_INSTRUCTION',
        owner: 'MGSN',
        description: 'M15 WP08 independent sandbox audit.'
      }
    ]
  });
  return { auth, plan };
};

const simulatedPrepared = (gate = new TrademarkServiceSandboxProtectedActionGate()) => {
  const { auth, plan } = executionPlan();
  const policy = createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: auth,
    environment: 'CI',
    mode: 'SIMULATED',
    connectorClass: 'SIMULATOR',
    endpointClass: 'INTERNAL_TEST',
    credentialClass: 'NONE',
    createdAt: '2026-08-23T00:03:00.000Z'
  });
  const protectedAction = gate.release({
    workspaceId,
    authorization: auth,
    plan,
    policy,
    stepId: plan.steps[0]!.stepId,
    idempotencyKey: 'm15-wp08-release',
    evidenceReferences: ['professional-review_m15_wp08'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-23T00:04:00.000Z',
    currentWorkPackageVersion: workPackageVersion
  });
  const request: TrademarkServiceNonProductionConnectorRequest = {
    schemaVersion: 1,
    workspaceId,
    release: protectedAction.release,
    binding: protectedAction.binding,
    evidenceReferences: ['professional-review_m15_wp08'],
    requestedAt: '2026-08-23T00:05:00.000Z'
  };
  const connector = new TrademarkServiceSimulationConnector('PROVIDER');
  const runtimePolicy: TrademarkServiceTrustedConnectorRuntimePolicy = {
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
  };
  return { auth, plan, policy, protectedAction, request, connector, runtimePolicy };
};

const sandboxConnectorPrepared = () => {
  const { auth, plan } = executionPlan();
  const policy = createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: auth,
    environment: 'SANDBOX',
    mode: 'TEST_CONNECTOR',
    connectorClass: 'PROVIDER_SANDBOX',
    endpointClass: 'ALLOWLISTED_SANDBOX',
    credentialClass: 'TEST_ONLY',
    createdAt: '2026-08-23T00:03:00.000Z'
  });
  const protectedAction = new TrademarkServiceSandboxProtectedActionGate().release({
    workspaceId,
    authorization: auth,
    plan,
    policy,
    stepId: plan.steps[0]!.stepId,
    idempotencyKey: 'm15-wp08-sandbox-connector-release',
    evidenceReferences: ['professional-review_m15_wp08'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-23T00:04:00.000Z',
    currentWorkPackageVersion: workPackageVersion
  });
  const request: TrademarkServiceNonProductionConnectorRequest = {
    schemaVersion: 1,
    workspaceId,
    release: protectedAction.release,
    binding: protectedAction.binding,
    evidenceReferences: ['professional-review_m15_wp08'],
    requestedAt: '2026-08-23T00:05:00.000Z'
  };
  return { auth, plan, policy, protectedAction, request };
};

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_m15_wp08',
  userId: 'user_authenticated_operator',
  workspaceId,
  membershipId: 'membership_m15_wp08',
  role: 'REVIEWER',
  permissions: ['review:read', 'review:perform'],
  sessionExpiresAt: '2026-08-24T00:00:00.000Z'
};

const expectExecutionError = (run: () => unknown, code: string) => {
  try {
    run();
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
};

describe('M15 WP08 independent execution sandbox release-readiness audit', () => {
  it('rejects workspace crossing at the non-production connector boundary', () => {
    const prepared = simulatedPrepared();
    expectExecutionError(
      () =>
        prepared.connector.execute({
          ...prepared.request,
          workspaceId: otherWorkspaceId
        }),
      'WORKSPACE_MISMATCH'
    );
  });

  it('rejects actor spoof fields and takes actor identity only from the trusted Workspace Principal', async () => {
    const secret = 'm15-wp08-internal-service-secret-000000000000000000';
    const routes = createTrademarkServiceExecutionRoutes({
      internalServiceSecret: secret,
      repository: {} as PostgresTrademarkServiceExecutionRepository,
      now: () => '2026-08-23T00:01:00.000Z'
    });
    const route = routes[0];
    if (!route) throw new Error('Execution authorization route is missing.');
    const request: JsonRequest = {
      body: {
        authorizedByUserId: 'user_spoofed_actor'
      },
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
        'x-markorbit-workspace-id': workspaceId
      },
      method: 'POST',
      path: route.path,
      params: {},
      query: {}
    };

    await expect(route.handle(request)).rejects.toMatchObject({
      status: 400,
      code: 'ACTOR_SPOOF_REJECTED'
    });
  });

  it('rejects stale Work Package versions before any sandbox release exists', () => {
    const { auth, plan } = executionPlan();
    const policy = createTrademarkServiceExecutionEnvironmentPolicy({
      workspaceId,
      authorization: auth,
      environment: 'CI',
      mode: 'SIMULATED',
      connectorClass: 'SIMULATOR',
      endpointClass: 'INTERNAL_TEST',
      credentialClass: 'NONE',
      createdAt: '2026-08-23T00:03:00.000Z'
    });
    expectExecutionError(
      () =>
        new TrademarkServiceSandboxProtectedActionGate().release({
          workspaceId,
          authorization: auth,
          plan,
          policy,
          stepId: plan.steps[0]!.stepId,
          idempotencyKey: 'm15-wp08-stale-release',
          evidenceReferences: ['professional-review_m15_wp08'],
          releasedByUserId: 'user_releaser',
          releasedAt: '2026-08-23T00:04:00.000Z',
          currentWorkPackageVersion: workPackageVersion + 1
        }),
      'READINESS_REQUIRED'
    );
  });

  it('rejects cross-environment replay and conflicting idempotency on the same protected-action identity', () => {
    const gate = new TrademarkServiceSandboxProtectedActionGate();
    const first = simulatedPrepared(gate);
    const localPolicy = createTrademarkServiceExecutionEnvironmentPolicy({
      workspaceId,
      authorization: first.auth,
      environment: 'LOCAL',
      mode: 'SIMULATED',
      connectorClass: 'SIMULATOR',
      endpointClass: 'INTERNAL_TEST',
      credentialClass: 'NONE',
      createdAt: '2026-08-23T00:03:30.000Z'
    });

    expectExecutionError(
      () =>
        gate.release({
          workspaceId,
          authorization: first.auth,
          plan: first.plan,
          policy: localPolicy,
          stepId: first.plan.steps[0]!.stepId,
          idempotencyKey: 'm15-wp08-release',
          evidenceReferences: ['professional-review_m15_wp08'],
          releasedByUserId: 'user_releaser',
          releasedAt: '2026-08-23T00:06:00.000Z',
          currentWorkPackageVersion: workPackageVersion
        }),
      'IDEMPOTENCY_CONFLICT'
    );

    expectExecutionError(
      () =>
        gate.release({
          workspaceId,
          authorization: first.auth,
          plan: first.plan,
          policy: first.policy,
          stepId: first.plan.steps[0]!.stepId,
          idempotencyKey: 'm15-wp08-release',
          evidenceReferences: ['different-evidence_m15_wp08'],
          releasedByUserId: 'user_releaser',
          releasedAt: '2026-08-23T00:07:00.000Z',
          currentWorkPackageVersion: workPackageVersion
        }),
      'IDEMPOTENCY_CONFLICT'
    );
  });

  it('fails closed on sandbox credential or endpoint policy mismatch', () => {
    const prepared = sandboxConnectorPrepared();
    const connector = new TrademarkServiceProviderSandboxConnector();
    const runtimePolicy: TrademarkServiceTrustedConnectorRuntimePolicy = {
      schemaVersion: 1,
      source: 'SERVER_TRUSTED_CONFIGURATION',
      environment: 'SANDBOX',
      mode: 'TEST_CONNECTOR',
      connectorClass: 'PROVIDER_SANDBOX',
      endpointClass: 'ALLOWLISTED_SANDBOX',
      credentialClass: 'TEST_ONLY',
      egressMode: 'ALLOWLIST_ONLY',
      endpointUrl: 'https://sandbox-provider.example.test/v1',
      allowedHosts: ['different-provider.example.test'],
      testCredentialReference: 'test-credential_m15-wp08',
      productionCredentialPresent: false,
      unrestrictedEgressAllowed: false,
      clientSuppliedEndpointTrusted: false
    };

    expectExecutionError(
      () =>
        new TrademarkServiceSandboxConnectorExecutionGate().execute({
          request: prepared.request,
          runtimePolicy,
          connector
        }),
      'AUTHORITY_BOUNDARY_VIOLATION'
    );
  });

  it('propagates connector failure without manufacturing a receipt or owner-domain truth', () => {
    const prepared = simulatedPrepared();
    const failingConnector: TrademarkServiceNonProductionConnector = {
      descriptor: prepared.connector.descriptor,
      execute() {
        throw new Error('M15_WP08_SYNTHETIC_CONNECTOR_FAILURE');
      }
    };

    expect(() =>
      new TrademarkServiceSandboxConnectorExecutionGate().execute({
        request: prepared.request,
        runtimePolicy: prepared.runtimePolicy,
        connector: failingConnector
      })
    ).toThrow('M15_WP08_SYNTHETIC_CONNECTOR_FAILURE');
  });

  it('classifies ambiguous simulator response as human-review evidence, never as provider or Official Truth', () => {
    const prepared = simulatedPrepared();
    const isolation = new TrademarkServiceSandboxConnectorExecutionGate().execute({
      request: prepared.request,
      runtimePolicy: prepared.runtimePolicy,
      connector: prepared.connector
    });
    const simulation = new TrademarkServiceDeterministicSimulationRunner().run({
      scenario: 'AMBIGUOUS_RETURN',
      request: prepared.request,
      connector: prepared.connector
    });
    const recovery = classifyTrademarkServiceRecovery({
      outcome: 'AMBIGUOUS_EXTERNAL_OUTCOME',
      reasonCode: 'M15_WP08_AMBIGUOUS_RETURN'
    });
    const bundle = createTrademarkServiceOperatorReadinessBundle({
      workspaceId,
      authorization: prepared.auth,
      plan: prepared.plan,
      environmentPolicy: prepared.policy,
      release: prepared.protectedAction.release,
      environmentBinding: prepared.protectedAction.binding,
      isolationDecision: isolation.isolation,
      simulationEvidence: simulation.evidence,
      recovery,
      createdAt: '2026-08-23T00:08:00.000Z'
    });

    expect(simulation.evidence).toMatchObject({
      classification: 'SIMULATED_AMBIGUOUS_RETURN',
      evidenceClass: 'SIMULATION_EVIDENCE',
      requiresHumanReview: true,
      retryClassification: 'MANUAL_REVIEW_REQUIRED',
      providerClaim: false,
      providerAcceptanceCreated: false,
      officialFilingSuccessCreated: false,
      paymentTruthCreated: false,
      markRegLifecycleTruthCreated: false,
      officialTruthCreated: false,
      liveExternalActionPerformed: false,
      automaticRetryAuthorized: false
    });
    expect(bundle).toMatchObject({
      reviewState: 'HUMAN_ACTION_REQUIRED',
      authorityAuditPassed: true,
      environmentBindingVerified: true,
      evidenceSeparatedFromOfficialTruth: true,
      productionEnvironmentAuthorized: false,
      productionCredentialsAuthorized: false,
      liveExternalActionAuthorized: false,
      deploymentApproved: false,
      productionEnablementAuthorized: false,
      officialTruthCreated: false
    });
  });

  it('keeps recovery correlated to the exact environment identity and blocks automatic external replay', () => {
    const prepared = simulatedPrepared();
    const correlationId = createTrademarkServiceExecutionCorrelationId(
      prepared.protectedAction.release,
      prepared.protectedAction.binding
    );
    const recovery = classifyTrademarkServiceRecoveryDrill(
      'AMBIGUOUS_EXTERNAL_OUTCOME',
      'M15_WP08_TIMEOUT_AFTER_SEND'
    );

    expect(correlationId).toMatch(/^trademark-service-execution-correlation_/);
    expect(recovery).toMatchObject({
      deadLetterState: 'HELD_FOR_HUMAN_REVIEW',
      replayRule: 'VERIFY_EXTERNAL_OUTCOME_BEFORE_REPLAY',
      humanApprovalRequiredForRetry: true,
      recovery: {
        state: 'MANUAL_REVIEW_REQUIRED',
        retryable: false,
        duplicateProtectedActionPrevented: true,
        automaticExternalRetryPerformed: false
      }
    });
  });
});
