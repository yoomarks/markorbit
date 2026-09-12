import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  clientNotificationConfirmationFingerprintSha256V1,
  clientNotificationReviewedContentFingerprintSha256V1,
  noClientNotificationPreparationAuthorityConsequencesV1,
  type ClientNotificationHandoffPlanV1,
  type PreparedAction,
  type PreparedActionConfirmation,
  type PreparedActionJourney
} from '@markorbit/contracts/product-loop';
import {
  ClientNotificationFollowupService,
  type ClientNotificationFollowupResultV1
} from '../src/client-notification-followup.js';
import {
  clientNotificationManagedCommunicationSendCommandV1,
  type ManagedCommunicationClientNotificationSender
} from '../src/client-notification-handoff.js';
import type { CommunicationLinkService } from '../src/communication-link.js';
import type { PostgresLiteWorkItemStore } from '../src/lite-work-item.js';
import { handoffResult, type PreparedActionPlan } from '../src/prepared-action.js';

const workspaceId = '56565656-5656-4565-8565-565656565656';
const timestamp = '2026-09-12T12:00:00.000Z';
const actionId = 'prepared-action_followup' as const;
const target = {
  targetKind: 'TRADEMARK_ASSET' as const,
  owner: 'LITE' as const,
  workspaceId,
  trademarkAssetId: 'trademark-asset_followup' as const,
  version: 4
};
function notificationPlan(): ClientNotificationHandoffPlanV1 {
  const withoutConfirmation = {
    schemaVersion: 1 as const,
    kind: 'CLIENT_NOTIFICATION_HANDOFF' as const,
    workspaceId,
    sourceDraft: {
      owner: 'LITE' as const,
      kind: 'TRADEMARK_SERVICE_COMMUNICATION_DRAFT' as const,
      workPackage: { id: 'trademark-service-work-package_followup', version: 2 },
      preparationId: 'trademark-service-preparation_followup',
      draftKind: 'CLIENT_INFORMATION_REQUEST' as const,
      draftFingerprintSha256: 'a'.repeat(64)
    },
    accountRef: 'mailbox_followup',
    channel: 'EMAIL' as const,
    sender: { role: 'SENDER' as const, address: 'service@example.com' },
    recipients: [
      {
        participant: { role: 'TO' as const, address: 'client@example.com' },
        source: { kind: 'MANUAL_ENTRY' as const }
      }
    ],
    subject: 'Please confirm',
    body: 'Please reply with the requested information.',
    attachments: [],
    reviewedContentFingerprintSha256: clientNotificationReviewedContentFingerprintSha256V1({
      subject: 'Please confirm',
      body: 'Please reply with the requested information.',
      attachments: []
    }),
    relatedWorkItem: {
      owner: 'LITE' as const,
      kind: 'WORK_ITEM' as const,
      workspaceId,
      workItemId: 'lite-work-item_followup',
      version: 3
    },
    relatedBusinessRefs: [target]
  };
  return {
    ...withoutConfirmation,
    confirmationFingerprintSha256:
      clientNotificationConfirmationFingerprintSha256V1(withoutConfirmation),
    authorityConsequences: noClientNotificationPreparationAuthorityConsequencesV1
  };
}

function completedJourney(clientPlan = notificationPlan()): {
  journey: PreparedActionJourney;
  plan: Extract<PreparedActionPlan, { kind: 'PREPARE_CLIENT_NOTIFICATION' }>;
  action: PreparedAction;
} {
  const action: PreparedAction = {
    schemaVersion: 1,
    preparedActionId: actionId,
    workspaceId,
    version: 1,
    recommendation: { id: 'today-recommendation_followup', version: 1 },
    recommendationFingerprintSha256: 'b'.repeat(64),
    kind: 'PREPARE_CLIENT_NOTIFICATION',
    summary: 'Send reviewed client notification.',
    confirmationEffect: 'Send the exact reviewed client notification.',
    handoffTarget: 'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION',
    clientNotificationPlan: clientPlan,
    sources: [],
    preparedActionFingerprintSha256: 'c'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const confirmation: PreparedActionConfirmation = {
    schemaVersion: 1,
    preparedAction: { id: actionId, version: 1 },
    expectedPreparedActionFingerprintSha256: action.preparedActionFingerprintSha256,
    confirmedByPrincipalId: 'user_followup',
    confirmedAt: timestamp,
    acknowledgedEffect: action.confirmationEffect,
    expectedClientNotificationPlanFingerprintSha256: clientPlan.confirmationFingerprintSha256,
    protectedActionAuthorized: false
  };
  const result = handoffResult({
    preparedAction: action,
    owner: 'MANAGED_COMMUNICATION',
    ownerRecord: { id: 'managed-communication-send_followup', version: 'd'.repeat(64) },
    completedAt: '2026-09-12T12:05:00.000Z'
  });
  return {
    action,
    plan: { kind: 'PREPARE_CLIENT_NOTIFICATION', clientNotificationPlan: clientPlan },
    journey: {
      schemaVersion: 1,
      preparedAction: action,
      confirmation,
      handoffState: 'HANDOFF_COMPLETED',
      handoffResult: result
    }
  };
}

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_followup',
  userId: 'user_followup',
  workspaceId,
  membershipId: 'membership_followup',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2026-09-13T12:00:00.000Z'
};

function fixture() {
  const completed = completedJourney();
  const sendCommand = clientNotificationManagedCommunicationSendCommandV1(
    completed.action,
    completed.plan.clientNotificationPlan,
    `prepared-action-handoff:${actionId}`
  );
  const receipt = {
    schemaVersion: 1 as const,
    sendId: completed.journey.handoffResult!.ownerRecord.id,
    workspaceId,
    accountRef: completed.plan.clientNotificationPlan.accountRef,
    idempotencyKeySha256: createHash('sha256').update(sendCommand.idempotencyKey).digest('hex'),
    requestFingerprintSha256: String(completed.journey.handoffResult!.ownerRecord.version),
    state: 'SENT' as const,
    messageId: 'message_followup',
    threadRef: 'thread_followup',
    provider: 'TEST',
    providerMessageId: 'provider-message_followup',
    providerReceiptRef: 'provider-receipt_followup',
    acceptedAt: completed.journey.handoffResult!.completedAt,
    authority: {
      externalMessageSent: true as const,
      customerTruthMutated: false as const,
      matterTruthMutated: false as const,
      legalTruthCreated: false as const,
      knowledgeApproved: false as const,
      professionalDecisionCreated: false as const
    }
  };
  const send = vi
    .fn<ManagedCommunicationClientNotificationSender['send']>()
    .mockResolvedValue(receipt);
  const sender: ManagedCommunicationClientNotificationSender = { send };
  type LinkCreate = (
    ...args: Parameters<CommunicationLinkService['create']>
  ) => Promise<{ communicationLinkId: string; version: number }>;
  const createLink = vi.fn<LinkCreate>().mockResolvedValue({
    communicationLinkId: 'communication-link_followup',
    version: 1
  });
  const links = { create: createLink } as unknown as Pick<CommunicationLinkService, 'create'>;
  type WorkTransition = (
    ...args: Parameters<PostgresLiteWorkItemStore['transitionStatus']>
  ) => Promise<{ liteWorkItemId: string; version: number; status: 'WAITING_FOR_CLIENT' }>;
  const transitionStatus = vi.fn<WorkTransition>().mockResolvedValue({
    liteWorkItemId: 'lite-work-item_followup',
    version: 4,
    status: 'WAITING_FOR_CLIENT'
  });
  const work = {
    transitionStatus
  } as unknown as Pick<PostgresLiteWorkItemStore, 'transitionStatus'>;
  const journeys = {
    findJourney: vi.fn().mockResolvedValue(completed.journey),
    planFor: vi.fn().mockResolvedValue(completed.plan)
  };
  const service = new ClientNotificationFollowupService(journeys, sender, links, work);
  return {
    service,
    completed,
    sendCommand,
    receipt,
    send,
    createLink,
    transitionStatus
  };
}

function expectNoAuthority(result: ClientNotificationFollowupResultV1) {
  expect(result.authority).toEqual({
    customerReceived: false,
    customerRead: false,
    customerResponded: false,
    legalNoticeEffective: false,
    customerTruthMutated: false,
    assetTruthMutated: false,
    matterTruthMutated: false,
    officialTruthCreated: false
  });
}
describe('client notification post-send follow-up', () => {
  it('replays the exact completed send, creates MESSAGE lineage, then advances Work separately', async () => {
    const { service, sendCommand, send, createLink, transitionStatus } = fixture();
    const result = await service.reconcile(workspaceId, actionId, principal);
    expect(result.state).toBe('COMPLETE');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(sendCommand);
    expect(createLink).toHaveBeenCalledTimes(1);
    const [linkCommand, linkPrincipal] = createLink.mock.calls[0]!;
    expect(linkCommand.idempotencyKey).toContain(`client-notification-followup:${actionId}:link:`);
    expect(linkCommand.source).toMatchObject({
      scope: 'MESSAGE',
      messageId: 'message_followup',
      threadRef: 'thread_followup'
    });
    expect(linkCommand.target).toEqual(target);
    expect(linkPrincipal).toEqual(principal);
    expect(transitionStatus).toHaveBeenCalledWith({
      workspaceId,
      liteWorkItemId: 'lite-work-item_followup',
      expectedVersion: 3,
      toStatus: 'WAITING_FOR_CLIENT',
      idempotencyKey: `client-notification-followup:${actionId}:work-waiting-for-client`
    });
    expectNoAuthority(result);
  });
  it('does not touch Work when any Communication Link needs reconciliation', async () => {
    const { service, createLink, transitionStatus, send } = fixture();
    createLink.mockRejectedValueOnce({ code: 'TARGET_UNAVAILABLE', retryable: true });
    const result = await service.reconcile(workspaceId, actionId, principal);
    expect(result.state).toBe('LINK_RECONCILIATION_REQUIRED');
    expect(result.links).toEqual([
      expect.objectContaining({
        state: 'RECONCILIATION_REQUIRED',
        errorCode: 'TARGET_UNAVAILABLE',
        retryable: true
      })
    ]);
    expect(result.work).toEqual({
      state: 'BLOCKED_BY_LINK',
      workItemId: 'lite-work-item_followup'
    });
    expect(transitionStatus).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expectNoAuthority(result);
  });

  it('preserves successful send/link evidence when Work CAS requires reconciliation', async () => {
    const { service, createLink, transitionStatus, send } = fixture();
    transitionStatus.mockRejectedValueOnce({ code: 'VERSION_CONFLICT', retryable: false });
    const result = await service.reconcile(workspaceId, actionId, principal);
    expect(result.state).toBe('WORK_RECONCILIATION_REQUIRED');
    expect(result.links[0]).toEqual(
      expect.objectContaining({
        state: 'LINKED',
        communicationLinkId: 'communication-link_followup'
      })
    );
    expect(result.work).toEqual(
      expect.objectContaining({ state: 'RECONCILIATION_REQUIRED', errorCode: 'VERSION_CONFLICT' })
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(createLink).toHaveBeenCalledTimes(1);
    expectNoAuthority(result);
  });
  it('reuses the exact same owner identities across retries', async () => {
    const { service, send, createLink, transitionStatus } = fixture();
    await service.reconcile(workspaceId, actionId, principal);
    await service.reconcile(workspaceId, actionId, principal);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0]).toEqual(send.mock.calls[0]![0]);
    expect(createLink).toHaveBeenCalledTimes(2);
    expect(createLink.mock.calls[1]![0].idempotencyKey).toBe(
      createLink.mock.calls[0]![0].idempotencyKey
    );
    expect(transitionStatus).toHaveBeenCalledTimes(2);
    expect(transitionStatus.mock.calls[1]![0].idempotencyKey).toBe(
      transitionStatus.mock.calls[0]![0].idempotencyKey
    );
  });

  it('fails closed if replayed SENT receipt does not match the durable handoff owner record', async () => {
    const { service, send, receipt, createLink, transitionStatus } = fixture();
    send.mockResolvedValueOnce({ ...receipt, sendId: 'managed-communication-send_other' });
    await expect(service.reconcile(workspaceId, actionId, principal)).rejects.toMatchObject({
      code: 'OWNER_RECEIPT_MISMATCH',
      status: 409
    });
    expect(createLink).not.toHaveBeenCalled();
    expect(transitionStatus).not.toHaveBeenCalled();
  });
});
