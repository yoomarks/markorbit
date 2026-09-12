import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  clientNotificationConfirmationFingerprintSha256V1,
  clientNotificationReviewedContentFingerprintSha256V1,
  noClientNotificationPreparationAuthorityConsequencesV1,
  type ClientNotificationHandoffPlanV1,
  type PreparedAction,
  type PreparedActionConfirmation
} from '@markorbit/contracts/product-loop';
import {
  noWorkspaceDirectoryAuthorityConsequencesV1,
  type WorkspaceDirectoryEntryV1
} from '@markorbit/contracts/workspace-directory';
import {
  ClientNotificationPreparedActionHandoff,
  HttpManagedCommunicationClientNotificationSender,
  type ManagedCommunicationClientNotificationSender
} from '../src/client-notification-handoff.js';
import { PreparedActionJourneyError } from '../src/prepared-action.js';
import { trademarkServiceCommunicationDraftFingerprintSha256 } from '../src/trademark-service-work-package.js';

type SendInput = Parameters<ManagedCommunicationClientNotificationSender['send']>[0];

const workspaceId = '45454545-4545-4454-8454-454545454545';
const otherWorkspaceId = '46464646-4646-4464-8464-464646464646';
const email = 'client@example.com';
const timestamp = '2026-09-12T04:00:00.000Z';
const contactPoint = {
  kind: 'EMAIL' as const,
  value: email,
  label: 'Primary',
  provenance: {
    sourceKind: 'WORKSPACE_USER' as const,
    sourceReference: 'manual-client-contact',
    capturedAt: timestamp
  }
};

const directoryEntry: WorkspaceDirectoryEntryV1 = {
  schemaVersion: 1,
  workspaceDirectoryEntryId: 'workspace-directory-entry_client',
  workspaceId,
  version: 1,
  entryKind: 'PERSON',
  displayName: 'Client Contact',
  aliases: [],
  status: 'ACTIVE',
  roles: ['CLIENT_CONTACT'],
  contactPoints: [contactPoint],
  externalIdentityReferences: [],
  provenance: contactPoint.provenance,
  authorityConsequences: noWorkspaceDirectoryAuthorityConsequencesV1,
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: null
};
const reviewedDraft = {
  preparationId: 'trademark-service-preparation_client-notice' as const,
  kind: 'CLIENT_INFORMATION_REQUEST' as const,
  subject: 'Please confirm the filing details',
  body: 'Please review the attached details and reply with your confirmation.',
  recipientReference: email,
  sent: false as const,
  externalContactAuthorized: false as const
};
const draftFingerprintSha256 = trademarkServiceCommunicationDraftFingerprintSha256(reviewedDraft);
const attachments = [
  {
    attachmentRef: 'attachment_client-notice',
    fileName: 'details.pdf',
    mediaType: 'application/pdf',
    sizeBytes: 1200,
    sha256: 'b'.repeat(64)
  }
] as const;

function plan(): ClientNotificationHandoffPlanV1 {
  const reviewedContentFingerprintSha256 = clientNotificationReviewedContentFingerprintSha256V1({
    subject: reviewedDraft.subject,
    body: reviewedDraft.body,
    attachments
  });
  const withoutConfirmation = {
    schemaVersion: 1 as const,
    kind: 'CLIENT_NOTIFICATION_HANDOFF' as const,
    workspaceId,
    sourceDraft: {
      owner: 'LITE' as const,
      kind: 'TRADEMARK_SERVICE_COMMUNICATION_DRAFT' as const,
      workPackage: { id: 'trademark-service-work-package_client', version: 2 },
      preparationId: reviewedDraft.preparationId,
      draftKind: 'CLIENT_INFORMATION_REQUEST' as const,
      draftFingerprintSha256
    },
    accountRef: 'mailbox_client-service',
    channel: 'EMAIL' as const,
    sender: { role: 'SENDER' as const, address: 'service@example.com', displayName: 'Service' },
    recipients: [
      {
        participant: { role: 'TO' as const, address: email, displayName: 'Client Contact' },
        source: {
          kind: 'WORKSPACE_DIRECTORY_CONTACT' as const,
          directoryEntry: {
            owner: 'LITE' as const,
            kind: 'WORKSPACE_DIRECTORY_ENTRY' as const,
            workspaceId,
            workspaceDirectoryEntryId: directoryEntry.workspaceDirectoryEntryId,
            version: directoryEntry.version
          },
          contactPoint
        }
      }
    ],
    subject: reviewedDraft.subject,
    body: reviewedDraft.body,
    attachments,
    reviewedContentFingerprintSha256,
    relatedWorkItem: {
      owner: 'LITE' as const,
      kind: 'WORK_ITEM' as const,
      workspaceId,
      workItemId: 'lite-work-item_client-notice',
      version: 3
    },
    relatedBusinessRefs: [
      {
        targetKind: 'WORKSPACE_DIRECTORY_ENTRY' as const,
        owner: 'LITE' as const,
        workspaceId,
        workspaceDirectoryEntryId: directoryEntry.workspaceDirectoryEntryId,
        version: directoryEntry.version
      }
    ]
  };
  return {
    ...withoutConfirmation,
    confirmationFingerprintSha256:
      clientNotificationConfirmationFingerprintSha256V1(withoutConfirmation),
    authorityConsequences: noClientNotificationPreparationAuthorityConsequencesV1
  };
}
function action(clientPlan = plan()): PreparedAction {
  return {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_client-notice',
    workspaceId,
    version: 1,
    recommendation: { id: 'today-recommendation_client-notice', version: 1 },
    recommendationFingerprintSha256: 'a'.repeat(64),
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
}

function confirmation(clientPlan = plan()): PreparedActionConfirmation {
  return {
    schemaVersion: 1,
    preparedAction: { id: 'prepared-action_client-notice', version: 1 },
    expectedPreparedActionFingerprintSha256: 'c'.repeat(64),
    confirmedByPrincipalId: 'user_client-notice',
    confirmedAt: timestamp,
    acknowledgedEffect: 'Send the exact reviewed client notification.',
    expectedClientNotificationPlanFingerprintSha256: clientPlan.confirmationFingerprintSha256,
    protectedActionAuthorized: false
  };
}

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_client-notice',
  userId: 'user_client-notice',
  workspaceId,
  membershipId: 'membership_client-notice',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2026-09-13T04:00:00.000Z'
};

function fixture() {
  const clientPlan = plan();
  const snapshot = {
    workPackage: {
      id: clientPlan.sourceDraft.workPackage.id as `trademark-service-work-package_${string}`,
      version: 2
    },
    draft: reviewedDraft,
    draftFingerprintSha256
  };
  const drafts = {
    getReviewedCommunicationDraftVersion: vi.fn().mockResolvedValue(snapshot),
    getCurrentReviewedCommunicationDraft: vi.fn().mockResolvedValue(snapshot)
  };
  const directory = {
    getExact: vi.fn().mockResolvedValue(directoryEntry),
    getLatest: vi.fn().mockResolvedValue(directoryEntry)
  };
  const workItems = {
    get: vi.fn().mockResolvedValue({ liteWorkItemId: 'lite-work-item_client-notice', version: 3 })
  };
  const businessRefs = { validate: vi.fn().mockResolvedValue(undefined) };
  const sends: SendInput[] = [];
  const send = vi.fn((input: SendInput) => {
    sends.push(input);
    return Promise.resolve({
      schemaVersion: 1 as const,
      sendId: 'managed-communication-send_client-notice',
      workspaceId,
      accountRef: clientPlan.accountRef,
      idempotencyKeySha256: createHash('sha256').update(input.idempotencyKey).digest('hex'),
      requestFingerprintSha256: 'd'.repeat(64),
      state: 'SENT' as const,
      messageId: 'message_client-notice',
      threadRef: 'thread_client-notice',
      provider: 'TEST',
      providerMessageId: 'provider-message_client-notice',
      providerReceiptRef: 'provider-receipt_client-notice',
      acceptedAt: '2026-09-12T04:05:00.000Z',
      authority: {
        externalMessageSent: true as const,
        customerTruthMutated: false as const,
        matterTruthMutated: false as const,
        legalTruthCreated: false as const,
        knowledgeApproved: false as const,
        professionalDecisionCreated: false as const
      }
    });
  });
  const sender = { send };
  const handoff = new ClientNotificationPreparedActionHandoff(
    drafts,
    directory,
    workItems,
    businessRefs,
    sender
  );
  return { clientPlan, drafts, directory, workItems, businessRefs, sender, sends, handoff };
}

describe('client notification Prepared Action handoff', () => {
  it('sends the exact frozen plan with one stable owner identity and returns Managed Communication lineage', async () => {
    const { clientPlan, businessRefs, sends, handoff } = fixture();
    const localPlan = {
      kind: 'PREPARE_CLIENT_NOTIFICATION' as const,
      clientNotificationPlan: clientPlan
    };
    const first = await handoff.perform(
      action(clientPlan),
      localPlan,
      confirmation(clientPlan),
      'prepared-action-handoff:prepared-action_client-notice',
      principal
    );
    const second = await handoff.perform(
      action(clientPlan),
      localPlan,
      confirmation(clientPlan),
      'prepared-action-handoff:prepared-action_client-notice',
      principal
    );

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      target: 'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION',
      owner: 'MANAGED_COMMUNICATION',
      ownerRecord: { id: 'managed-communication-send_client-notice', version: 'd'.repeat(64) }
    });
    expect(sends).toHaveLength(2);
    const firstSend = sends[0];
    const secondSend = sends[1];
    expect(firstSend?.idempotencyKey).toBe(secondSend?.idempotencyKey);
    expect(firstSend?.correlationId).toBe(secondSend?.correlationId);
    expect(firstSend?.request).toEqual({
      schemaVersion: 1,
      accountRef: clientPlan.accountRef,
      channel: 'EMAIL',
      participants: [
        clientPlan.sender,
        ...clientPlan.recipients.map(({ participant }) => participant)
      ],
      subject: clientPlan.subject,
      textBody: clientPlan.body,
      attachments: clientPlan.attachments
    });
    expect(businessRefs.validate).toHaveBeenCalledWith(
      principal,
      clientPlan.relatedBusinessRefs[0]
    );
  });

  it('fails closed on source draft drift before Managed Communication is called', async () => {
    const { clientPlan, drafts, sender, handoff } = fixture();
    drafts.getCurrentReviewedCommunicationDraft.mockResolvedValue({
      workPackage: {
        id: clientPlan.sourceDraft.workPackage.id as `trademark-service-work-package_${string}`,
        version: 3
      },
      draft: { ...reviewedDraft, body: 'Changed after confirmation.' },
      draftFingerprintSha256: 'e'.repeat(64)
    });
    await expect(
      handoff.perform(
        action(clientPlan),
        { kind: 'PREPARE_CLIENT_NOTIFICATION', clientNotificationPlan: clientPlan },
        confirmation(clientPlan),
        'prepared-action-handoff:prepared-action_client-notice',
        principal
      )
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('fails closed on Directory recipient drift before Managed Communication is called', async () => {
    const { clientPlan, directory, sender, handoff } = fixture();
    directory.getLatest.mockResolvedValue({ ...directoryEntry, version: 2 });
    await expect(
      handoff.perform(
        action(clientPlan),
        { kind: 'PREPARE_CLIENT_NOTIFICATION', clientNotificationPlan: clientPlan },
        confirmation(clientPlan),
        'prepared-action-handoff:prepared-action_client-notice',
        principal
      )
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('fails closed on stale business references before Managed Communication is called', async () => {
    const { clientPlan, businessRefs, sender, handoff } = fixture();
    businessRefs.validate.mockRejectedValue(
      new PreparedActionJourneyError('STALE_SOURCE', 'business ref drift', 409)
    );
    await expect(
      handoff.perform(
        action(clientPlan),
        { kind: 'PREPARE_CLIENT_NOTIFICATION', clientNotificationPlan: clientPlan },
        confirmation(clientPlan),
        'prepared-action-handoff:prepared-action_client-notice',
        principal
      )
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('requires the current Workspace principal for owner-current business validation', async () => {
    const { clientPlan, sender, handoff } = fixture();
    await expect(
      handoff.perform(
        action(clientPlan),
        { kind: 'PREPARE_CLIENT_NOTIFICATION', clientNotificationPlan: clientPlan },
        confirmation(clientPlan),
        'prepared-action-handoff:prepared-action_client-notice'
      )
    ).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    expect(sender.send).not.toHaveBeenCalled();

    await expect(
      handoff.perform(
        action(clientPlan),
        { kind: 'PREPARE_CLIENT_NOTIFICATION', clientNotificationPlan: clientPlan },
        confirmation(clientPlan),
        'prepared-action-handoff:prepared-action_client-notice',
        { ...principal, workspaceId: otherWorkspaceId }
      )
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
  });
});
describe('Managed Communication client-notification HTTP sender', () => {
  const request = {
    workspaceId,
    idempotencyKey: 'client-notification:prepared-action_client-notice:stable',
    correlationId: 'client-notification:stable',
    request: {
      schemaVersion: 1 as const,
      accountRef: 'mailbox_client-service',
      channel: 'EMAIL' as const,
      participants: [
        { role: 'SENDER' as const, address: 'service@example.com' },
        { role: 'TO' as const, address: email }
      ],
      subject: reviewedDraft.subject,
      textBody: reviewedDraft.body,
      attachments
    }
  };

  it('preserves reconciliation-required instead of collapsing it into dependency unavailable', async () => {
    const sender = new HttpManagedCommunicationClientNotificationSender(
      'http://capability.test',
      'secret',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'RECONCILIATION_REQUIRED', message: 'uncertain' }), {
          status: 409,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    await expect(sender.send(request)).rejects.toMatchObject({
      code: 'RECONCILIATION_REQUIRED',
      status: 409,
      details: {
        confirmationPersisted: true,
        handoffPending: true,
        reconciliationRequired: true,
        ownerCode: 'RECONCILIATION_REQUIRED'
      }
    });
  });

  it('keeps provider unavailability retryable but distinct from accepted-but-unknown', async () => {
    const sender = new HttpManagedCommunicationClientNotificationSender(
      'http://capability.test',
      'secret',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'PROVIDER_NOT_READY' }), {
          status: 503,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    await expect(sender.send(request)).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: 503,
      details: { confirmationPersisted: true, handoffPending: true }
    });
  });

  it('rejects malformed SENT evidence instead of fabricating a successful handoff', async () => {
    const malformed = {
      schemaVersion: 1,
      sendId: 'send_bad',
      workspaceId,
      accountRef: request.request.accountRef,
      idempotencyKeySha256: 'a'.repeat(64),
      requestFingerprintSha256: 'b'.repeat(64),
      state: 'SENT',
      messageId: 'message_bad',
      threadRef: 'thread_bad',
      provider: 'TEST',
      providerMessageId: 'provider_bad',
      providerReceiptRef: 'receipt_bad',
      acceptedAt: timestamp,
      authority: {
        externalMessageSent: false,
        customerTruthMutated: false,
        matterTruthMutated: false,
        legalTruthCreated: false,
        knowledgeApproved: false,
        professionalDecisionCreated: false
      }
    };
    const sender = new HttpManagedCommunicationClientNotificationSender(
      'http://capability.test',
      'secret',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(malformed), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    await expect(sender.send(request)).rejects.toThrow(
      'Managed Communication send owner returned invalid authority evidence.'
    );
  });

  it('sends internal authorization only in headers and returns valid SENT evidence', async () => {
    let capturedInit: RequestInit | undefined;
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      const idempotencyKey = new Headers(init?.headers).get('idempotency-key') ?? '';
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            sendId: 'managed-communication-send_valid',
            workspaceId,
            accountRef: request.request.accountRef,
            idempotencyKeySha256: createHash('sha256').update(idempotencyKey).digest('hex'),
            requestFingerprintSha256: 'f'.repeat(64),
            state: 'SENT',
            messageId: 'message_valid',
            threadRef: 'thread_valid',
            provider: 'TEST',
            providerMessageId: 'provider-message_valid',
            providerReceiptRef: 'provider-receipt_valid',
            acceptedAt: timestamp,
            authority: {
              externalMessageSent: true,
              customerTruthMutated: false,
              matterTruthMutated: false,
              legalTruthCreated: false,
              knowledgeApproved: false,
              professionalDecisionCreated: false
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    const sender = new HttpManagedCommunicationClientNotificationSender(
      'http://capability.test',
      'super-secret',
      fetcher
    );
    const receipt = await sender.send(request);
    expect(receipt.state).toBe('SENT');
    const headers = new Headers(capturedInit?.headers);
    const body = typeof capturedInit?.body === 'string' ? capturedInit.body : '';
    expect(headers.get('x-markorbit-internal-authorization')).toBe('super-secret');
    expect(body).not.toContain('super-secret');
    expect(body).toBe(JSON.stringify(request.request));
  });
});
