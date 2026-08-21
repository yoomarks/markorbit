import { describe, expect, it } from 'vitest';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import {
  TrademarkServiceProtectedActionGate,
  authorizeTrademarkServiceExecution,
  classifyTrademarkServiceRecovery,
  createTrademarkServiceExecutionPlan,
  createTrademarkServiceExecutionWorkbenchSnapshot,
  createTrademarkServiceLifecycleHandoff,
  createTrademarkServiceProviderHandoff,
  recordTrademarkServiceExecutionEvidence
} from '../src/trademark-service-execution.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const readiness = (): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_ready',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_ready', version: 6 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-21T02:00:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_1'],
  evidenceReferences: ['evidence_1'],
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
    workPackageVersion: 6,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-21T03:00:00.000Z',
    expiresAt: '2026-08-22T03:00:00.000Z',
    allowedActions: ['PROVIDER_INSTRUCTION', 'AUTHORITY_FILING'],
    providerRestriction: 'provider_us-1',
    conditions: ['Use the reviewed document package only.'],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });

const plan = () =>
  createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: authorization(),
    createdAt: '2026-08-21T03:05:00.000Z',
    steps: [
      {
        action: 'PROVIDER_INSTRUCTION',
        owner: 'MGSN',
        description: 'Request governed provider delivery.',
        providerReference: 'provider_us-1'
      },
      {
        action: 'AUTHORITY_FILING',
        owner: 'EXTERNAL_AUTHORITY',
        description: 'File only through the released Execution owner-domain path.'
      }
    ]
  });

function releaseProvider(gate = new TrademarkServiceProtectedActionGate()) {
  const auth = authorization();
  const executionPlan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: auth,
    createdAt: '2026-08-21T03:05:00.000Z',
    steps: [
      {
        action: 'PROVIDER_INSTRUCTION',
        owner: 'MGSN',
        description: 'Request governed provider delivery.',
        providerReference: 'provider_us-1'
      }
    ]
  });
  const release = gate.release({
    workspaceId,
    authorization: auth,
    plan: executionPlan,
    stepId: executionPlan.steps[0]!.stepId,
    idempotencyKey: 'm13-provider-release-1',
    evidenceReferences: ['preparation-lock_1', 'professional-review_1'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-21T03:10:00.000Z',
    currentWorkPackageVersion: 6
  });
  return { auth, executionPlan, release, gate };
}

describe('M13 controlled trademark service execution', () => {
  it('WP01 freezes explicit authorization without implying filing or Official Truth', () => {
    const result = authorization();
    expect(result.allowedActions).toEqual(['AUTHORITY_FILING', 'PROVIDER_INSTRUCTION']);
    expect(result.workPackage).toEqual({ id: 'trademark-service-work-package_ready', version: 6 });
    expect(result.explicitUserAuthorization).toBe(true);
    expect(result.acknowledgementAuthorizationIsNotSubmission).toBe(true);
    expect(result.externalActionPerformed).toBe(false);
    expect(result.officialTruthCreated).toBe(false);
    expect(authorization().executionAuthorizationId).toBe(result.executionAuthorizationId);
  });

  it('WP01 rejects stale or pre-authorized M12 readiness', () => {
    expect(() =>
      authorizeTrademarkServiceExecution({
        workspaceId,
        readiness: readiness(),
        workPackageVersion: 5,
        authorizedByUserId: 'user_authorizer',
        authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
        authorizedAt: '2026-08-21T03:00:00.000Z',
        allowedActions: ['AUTHORITY_FILING'],
        explicitUserAuthorization: true,
        acknowledgementAuthorizationIsNotSubmission: true,
        acknowledgementOfficialAcceptanceNotGuaranteed: true
      })
    ).toThrow('Execution Readiness does not match the requested Work Package version.');

    const promoted = readiness();
    promoted.executionAuthorized = true as false;
    expect(() =>
      authorizeTrademarkServiceExecution({
        workspaceId,
        readiness: promoted,
        workPackageVersion: 6,
        authorizedByUserId: 'user_authorizer',
        authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
        authorizedAt: '2026-08-21T03:00:00.000Z',
        allowedActions: ['AUTHORITY_FILING'],
        explicitUserAuthorization: true,
        acknowledgementAuthorizationIsNotSubmission: true,
        acknowledgementOfficialAcceptanceNotGuaranteed: true
      })
    ).toThrow('M12 Execution Readiness must not already contain protected-action authority.');
  });

  it('WP02 creates only authorized owner-routed plan steps', () => {
    const result = plan();
    expect(result.steps).toHaveLength(2);
    expect(result.steps.every((step) => step.status === 'PLANNED')).toBe(true);
    expect(result.steps.every((step) => step.requiresProtectedActionGate)).toBe(true);
    expect(result.externalActionPerformed).toBe(false);
    expect(result.matterLifecycleMutated).toBe(false);
    expect(() =>
      createTrademarkServiceExecutionPlan({
        workspaceId,
        authorization: authorization(),
        createdAt: '2026-08-21T03:05:00.000Z',
        steps: [{ action: 'PAYMENT', owner: 'PAYMENT', description: 'Pay.' }]
      })
    ).toThrow('Execution Plan step PAYMENT is outside the authorization scope.');
  });

  it('WP03 releases only current evidenced protected actions and is replay-safe', () => {
    const { gate, auth, executionPlan, release } = releaseProvider();
    const replay = gate.release({
      workspaceId,
      authorization: auth,
      plan: executionPlan,
      stepId: executionPlan.steps[0]!.stepId,
      idempotencyKey: 'm13-provider-release-1',
      evidenceReferences: ['professional-review_1', 'preparation-lock_1'],
      releasedByUserId: 'another_actor_does_not_change_request_fingerprint',
      releasedAt: '2026-08-21T03:11:00.000Z',
      currentWorkPackageVersion: 6
    });
    expect(replay.protectedActionReleaseId).toBe(release.protectedActionReleaseId);
    expect(gate.replayCount).toBe(1);
    expect(release.externalSuccessConfirmed).toBe(false);
    expect(release.officialAcceptanceConfirmed).toBe(false);

    expect(() =>
      gate.release({
        workspaceId,
        authorization: auth,
        plan: executionPlan,
        stepId: executionPlan.steps[0]!.stepId,
        idempotencyKey: 'm13-provider-release-1',
        evidenceReferences: ['different_evidence'],
        releasedByUserId: 'user_releaser',
        releasedAt: '2026-08-21T03:12:00.000Z',
        currentWorkPackageVersion: 6
      })
    ).toThrow('Idempotency key was already used for a different protected action.');
  });

  it('WP03 fails closed when the Work Package changes after authorization', () => {
    const gate = new TrademarkServiceProtectedActionGate();
    const auth = authorization();
    const executionPlan = plan();
    expect(() =>
      gate.release({
        workspaceId,
        authorization: auth,
        plan: executionPlan,
        stepId: executionPlan.steps[0]!.stepId,
        idempotencyKey: 'stale-release',
        evidenceReferences: ['evidence_1'],
        releasedByUserId: 'user_releaser',
        releasedAt: '2026-08-21T03:10:00.000Z',
        currentWorkPackageVersion: 7
      })
    ).toThrow('Work Package changed after authorization.');
  });

  it('WP04 creates an MGSN handoff request without manufacturing engagement or acceptance', () => {
    const { executionPlan, release } = releaseProvider();
    const handoff = createTrademarkServiceProviderHandoff({
      workspaceId,
      release,
      plan: executionPlan,
      providerReference: 'provider_us-1',
      instructionReferences: ['instruction-ledger_1'],
      evidenceReferences: ['professional-review_1'],
      createdAt: '2026-08-21T03:15:00.000Z'
    });
    expect(handoff.targetOwner).toBe('MGSN');
    expect(handoff.providerEngagementCreatedByExecution).toBe(false);
    expect(handoff.providerAcceptanceCreatedByExecution).toBe(false);
  });

  it('WP05 and WP06 keep execution evidence separate from MarkReg lifecycle and Official Truth', () => {
    const { release } = releaseProvider();
    const evidence = recordTrademarkServiceExecutionEvidence({
      workspaceId,
      release,
      attemptState: 'OWNER_ACCEPTED',
      receiptReferences: ['provider-receipt_1'],
      providerReturnReferences: ['provider-return_1'],
      ownerValidationReferences: ['execution-review_1'],
      recordedAt: '2026-08-21T03:20:00.000Z'
    });
    expect(evidence.attemptedDoesNotImplySubmitted).toBe(true);
    expect(evidence.providerReturnDoesNotImplyOfficialTruth).toBe(true);
    expect(evidence.officialAcceptanceVerifiedByExecution).toBe(false);

    const lifecycle = createTrademarkServiceLifecycleHandoff({
      workspaceId,
      evidence,
      matterReference: 'formal-matter_1',
      requestedProjection: 'RECEIPT_RECORDED',
      ownerValidationReferences: ['markreg-owner-validation_1'],
      createdAt: '2026-08-21T03:25:00.000Z'
    });
    expect(lifecycle.targetOwner).toBe('MARKREG');
    expect(lifecycle.matterLifecycleMutatedByExecution).toBe(false);
    expect(lifecycle.officialTruthCreatedByExecution).toBe(false);
  });

  it('WP07 never automatically retries ambiguous external outcomes', () => {
    expect(
      classifyTrademarkServiceRecovery({ outcome: 'TRANSIENT_FAILURE', reasonCode: 'HTTP_503' })
    ).toMatchObject({
      state: 'RETRY_ALLOWED',
      retryable: true,
      duplicateProtectedActionPrevented: true,
      automaticExternalRetryPerformed: false
    });
    expect(
      classifyTrademarkServiceRecovery({
        outcome: 'AMBIGUOUS_EXTERNAL_OUTCOME',
        reasonCode: 'TIMEOUT_AFTER_SEND'
      })
    ).toMatchObject({
      state: 'MANUAL_REVIEW_REQUIRED',
      retryable: false,
      automaticExternalRetryPerformed: false
    });
  });

  it('WP08 produces one authority-audited professional workbench snapshot', () => {
    const { auth, executionPlan, release } = releaseProvider();
    const providerHandoff = createTrademarkServiceProviderHandoff({
      workspaceId,
      release,
      plan: executionPlan,
      providerReference: 'provider_us-1',
      instructionReferences: ['instruction-ledger_1'],
      evidenceReferences: ['professional-review_1'],
      createdAt: '2026-08-21T03:15:00.000Z'
    });
    const evidence = recordTrademarkServiceExecutionEvidence({
      workspaceId,
      release,
      attemptState: 'ATTEMPTED',
      providerReturnReferences: ['provider-return_1'],
      recordedAt: '2026-08-21T03:20:00.000Z'
    });
    const lifecycleHandoff = createTrademarkServiceLifecycleHandoff({
      workspaceId,
      evidence,
      matterReference: 'formal-matter_1',
      requestedProjection: 'INSTRUCTED',
      ownerValidationReferences: ['markreg-owner-validation_1'],
      createdAt: '2026-08-21T03:25:00.000Z'
    });
    const recovery = classifyTrademarkServiceRecovery({
      outcome: 'SUCCESS',
      reasonCode: 'OWNER_ACCEPTED'
    });
    const snapshot = createTrademarkServiceExecutionWorkbenchSnapshot({
      workspaceId,
      authorization: auth,
      plan: executionPlan,
      release,
      providerHandoff,
      lifecycleHandoff,
      evidence,
      recovery,
      nextHumanAction: 'Verify owner-domain evidence before any next protected action.'
    });
    expect(snapshot.authorityAuditPassed).toBe(true);
    expect(snapshot.officialTruthCreated).toBe(false);
    expect(snapshot.crossServiceSqlUsed).toBe(false);
    expect(snapshot.nextHumanAction).toContain('Verify owner-domain evidence');
  });
});
