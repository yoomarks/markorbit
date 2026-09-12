import { createHash } from 'node:crypto';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  CommunicationLinkSourceReferenceV1,
  CommunicationLinkTargetReferenceV1
} from '@markorbit/contracts/communication-link';
import type {
  ClientNotificationHandoffPlanV1,
  PreparedActionId,
  PreparedActionJourney
} from '@markorbit/contracts/product-loop';
import {
  clientNotificationManagedCommunicationSendCommandV1,
  type ManagedCommunicationClientNotificationSendReceiptV1,
  type ManagedCommunicationClientNotificationSender
} from './client-notification-handoff.js';
import type { CommunicationLinkService } from './communication-link.js';
import type { PostgresLiteWorkItemStore } from './lite-work-item.js';
import type { PreparedActionPlan } from './prepared-action.js';

export type ClientNotificationFollowupState =
  'COMPLETE' | 'LINK_RECONCILIATION_REQUIRED' | 'WORK_RECONCILIATION_REQUIRED';

export type ClientNotificationFollowupErrorCode =
  'NOT_FOUND' | 'PRECONDITION_FAILED' | 'OWNER_RECEIPT_MISMATCH';

export class ClientNotificationFollowupError extends Error {
  constructor(
    readonly code: ClientNotificationFollowupErrorCode,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ClientNotificationFollowupError';
  }
}

export interface ClientNotificationFollowupLinkResultV1 {
  target: Readonly<CommunicationLinkTargetReferenceV1>;
  state: 'LINKED' | 'RECONCILIATION_REQUIRED';
  communicationLinkId?: string;
  version?: number;
  errorCode?: string;
  retryable?: boolean;
}

export interface ClientNotificationFollowupWorkResultV1 {
  state: 'NOT_APPLICABLE' | 'BLOCKED_BY_LINK' | 'WAITING_FOR_CLIENT' | 'RECONCILIATION_REQUIRED';
  workItemId?: string;
  version?: number;
  errorCode?: string;
  retryable?: boolean;
}

export interface ClientNotificationFollowupResultV1 {
  schemaVersion: 1;
  preparedActionId: PreparedActionId;
  state: ClientNotificationFollowupState;
  send: Readonly<{
    sendId: string;
    messageId: string;
    threadRef: string;
    acceptedAt: string;
  }>;
  links: ReadonlyArray<Readonly<ClientNotificationFollowupLinkResultV1>>;
  work: Readonly<ClientNotificationFollowupWorkResultV1>;
  authority: Readonly<{
    customerReceived: false;
    customerRead: false;
    customerResponded: false;
    legalNoticeEffective: false;
    customerTruthMutated: false;
    assetTruthMutated: false;
    matterTruthMutated: false;
    officialTruthCreated: false;
  }>;
}

const NO_AUTHORITY = Object.freeze({
  customerReceived: false,
  customerRead: false,
  customerResponded: false,
  legalNoticeEffective: false,
  customerTruthMutated: false,
  assetTruthMutated: false,
  matterTruthMutated: false,
  officialTruthCreated: false
});

interface JourneyReader {
  findJourney(
    workspaceId: string,
    actionId: PreparedActionId
  ): Promise<PreparedActionJourney | undefined>;
  planFor(workspaceId: string, actionId: PreparedActionId): Promise<PreparedActionPlan | undefined>;
}

type LinkCreator = Pick<CommunicationLinkService, 'create'>;
type WorkOwner = Pick<PostgresLiteWorkItemStore, 'transitionStatus'>;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function exactClientNotification(
  journey: Readonly<PreparedActionJourney>,
  plan: Readonly<PreparedActionPlan>
): Readonly<ClientNotificationHandoffPlanV1> {
  if (
    journey.handoffState !== 'HANDOFF_COMPLETED' ||
    journey.preparedAction.kind !== 'PREPARE_CLIENT_NOTIFICATION' ||
    plan.kind !== 'PREPARE_CLIENT_NOTIFICATION' ||
    !journey.confirmation ||
    !journey.handoffResult ||
    journey.handoffResult.owner !== 'MANAGED_COMMUNICATION' ||
    journey.handoffResult.target !== 'MANAGED_COMMUNICATION_CLIENT_NOTIFICATION'
  ) {
    throw new ClientNotificationFollowupError(
      'PRECONDITION_FAILED',
      'Client-notification follow-up requires an already-completed Managed Communication handoff.',
      409
    );
  }
  if (
    digest(journey.preparedAction.clientNotificationPlan) !== digest(plan.clientNotificationPlan) ||
    journey.confirmation.expectedClientNotificationPlanFingerprintSha256 !==
      plan.clientNotificationPlan.confirmationFingerprintSha256
  ) {
    throw new ClientNotificationFollowupError(
      'PRECONDITION_FAILED',
      'Persisted client-notification confirmation no longer matches the frozen plan.',
      409
    );
  }
  return plan.clientNotificationPlan;
}

function assertReceiptMatchesCompletedHandoff(
  journey: Readonly<PreparedActionJourney>,
  receipt: Readonly<ManagedCommunicationClientNotificationSendReceiptV1>,
  expectedIdempotencyKey: string
): void {
  const result = journey.handoffResult!;
  if (
    receipt.workspaceId.toLowerCase() !== journey.preparedAction.workspaceId.toLowerCase() ||
    receipt.idempotencyKeySha256 !==
      createHash('sha256').update(expectedIdempotencyKey).digest('hex') ||
    receipt.sendId !== result.ownerRecord.id ||
    receipt.requestFingerprintSha256 !== String(result.ownerRecord.version) ||
    receipt.acceptedAt !== result.completedAt
  ) {
    throw new ClientNotificationFollowupError(
      'OWNER_RECEIPT_MISMATCH',
      'Managed Communication replay receipt does not match the completed Prepared Action handoff.',
      409
    );
  }
}

function messageSource(
  receipt: Readonly<ManagedCommunicationClientNotificationSendReceiptV1>
): CommunicationLinkSourceReferenceV1 {
  return {
    owner: 'MANAGED_COMMUNICATION',
    scope: 'MESSAGE',
    accountRef: receipt.accountRef,
    messageId: receipt.messageId,
    threadRef: receipt.threadRef,
    provider: receipt.provider,
    providerMessageId: receipt.providerMessageId,
    observedAt: receipt.acceptedAt
  };
}

function ownerError(error: unknown): { code: string; retryable: boolean } {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === 'string' ? record.code : 'OWNER_UNAVAILABLE',
      retryable: record.retryable === true
    };
  }
  return { code: 'OWNER_UNAVAILABLE', retryable: false };
}

function linkKey(actionId: PreparedActionId, target: Readonly<CommunicationLinkTargetReferenceV1>) {
  return `client-notification-followup:${actionId}:link:${digest(target)}`;
}

function workKey(actionId: PreparedActionId): string {
  return `client-notification-followup:${actionId}:work-waiting-for-client`;
}
export class ClientNotificationFollowupService {
  constructor(
    private readonly journeys: JourneyReader,
    private readonly sender: ManagedCommunicationClientNotificationSender,
    private readonly links: LinkCreator,
    private readonly work: WorkOwner
  ) {}

  async reconcile(
    workspaceId: string,
    actionId: PreparedActionId,
    principal: Readonly<WorkspacePrincipal>
  ): Promise<Readonly<ClientNotificationFollowupResultV1>> {
    if (principal.workspaceId.toLowerCase() !== workspaceId.toLowerCase())
      throw new ClientNotificationFollowupError(
        'NOT_FOUND',
        'Prepared Action was not found in this Workspace.',
        404
      );
    const [journey, plan] = await Promise.all([
      this.journeys.findJourney(workspaceId, actionId),
      this.journeys.planFor(workspaceId, actionId)
    ]);
    if (!journey || !plan)
      throw new ClientNotificationFollowupError('NOT_FOUND', 'Prepared Action was not found.', 404);
    const notificationPlan = exactClientNotification(journey, plan);
    const sendCommand = clientNotificationManagedCommunicationSendCommandV1(
      journey.preparedAction,
      notificationPlan,
      `prepared-action-handoff:${journey.preparedAction.preparedActionId}`
    );
    const receipt = await this.sender.send(sendCommand);
    assertReceiptMatchesCompletedHandoff(journey, receipt, sendCommand.idempotencyKey);
    const source = messageSource(receipt);
    const linkResults: ClientNotificationFollowupLinkResultV1[] = [];

    for (const target of notificationPlan.relatedBusinessRefs) {
      try {
        const link = await this.links.create(
          {
            workspaceId,
            actorPrincipalId: journey.confirmation!.confirmedByPrincipalId,
            idempotencyKey: linkKey(actionId, target),
            source,
            target,
            decisionStatus: 'CONFIRMED',
            decisionBasis: 'MANUAL',
            reason: 'Confirmed client-notification business context.',
            evidenceReferences: [
              `prepared-action:${actionId}:1`,
              `managed-communication-send:${receipt.sendId}`
            ]
          },
          principal
        );
        linkResults.push({
          target,
          state: 'LINKED',
          communicationLinkId: link.communicationLinkId,
          version: link.version
        });
      } catch (error) {
        const owner = ownerError(error);
        linkResults.push({
          target,
          state: 'RECONCILIATION_REQUIRED',
          errorCode: owner.code,
          retryable: owner.retryable
        });
      }
    }

    if (linkResults.some((item) => item.state === 'RECONCILIATION_REQUIRED')) {
      return Object.freeze({
        schemaVersion: 1,
        preparedActionId: actionId,
        state: 'LINK_RECONCILIATION_REQUIRED',
        send: {
          sendId: receipt.sendId,
          messageId: receipt.messageId,
          threadRef: receipt.threadRef,
          acceptedAt: receipt.acceptedAt
        },
        links: linkResults,
        work: notificationPlan.relatedWorkItem
          ? {
              state: 'BLOCKED_BY_LINK' as const,
              workItemId: notificationPlan.relatedWorkItem.workItemId
            }
          : { state: 'NOT_APPLICABLE' as const },
        authority: NO_AUTHORITY
      });
    }

    if (!notificationPlan.relatedWorkItem) {
      return Object.freeze({
        schemaVersion: 1,
        preparedActionId: actionId,
        state: 'COMPLETE',
        send: {
          sendId: receipt.sendId,
          messageId: receipt.messageId,
          threadRef: receipt.threadRef,
          acceptedAt: receipt.acceptedAt
        },
        links: linkResults,
        work: { state: 'NOT_APPLICABLE' as const },
        authority: NO_AUTHORITY
      });
    }
    try {
      const work = await this.work.transitionStatus({
        workspaceId,
        liteWorkItemId: notificationPlan.relatedWorkItem.workItemId as `lite-work-item_${string}`,
        expectedVersion: notificationPlan.relatedWorkItem.version,
        toStatus: 'WAITING_FOR_CLIENT',
        idempotencyKey: workKey(actionId)
      });
      if (
        work.liteWorkItemId !== notificationPlan.relatedWorkItem.workItemId ||
        work.status !== 'WAITING_FOR_CLIENT'
      ) {
        throw new ClientNotificationFollowupError(
          'OWNER_RECEIPT_MISMATCH',
          'Lite Work owner response does not match the requested WAITING_FOR_CLIENT transition.',
          409
        );
      }
      return Object.freeze({
        schemaVersion: 1,
        preparedActionId: actionId,
        state: 'COMPLETE',
        send: {
          sendId: receipt.sendId,
          messageId: receipt.messageId,
          threadRef: receipt.threadRef,
          acceptedAt: receipt.acceptedAt
        },
        links: linkResults,
        work: {
          state: 'WAITING_FOR_CLIENT' as const,
          workItemId: work.liteWorkItemId,
          version: work.version
        },
        authority: NO_AUTHORITY
      });
    } catch (error) {
      if (error instanceof ClientNotificationFollowupError) throw error;
      const owner = ownerError(error);
      return Object.freeze({
        schemaVersion: 1,
        preparedActionId: actionId,
        state: 'WORK_RECONCILIATION_REQUIRED',
        send: {
          sendId: receipt.sendId,
          messageId: receipt.messageId,
          threadRef: receipt.threadRef,
          acceptedAt: receipt.acceptedAt
        },
        links: linkResults,
        work: {
          state: 'RECONCILIATION_REQUIRED' as const,
          workItemId: notificationPlan.relatedWorkItem.workItemId,
          errorCode: owner.code,
          retryable: owner.retryable
        },
        authority: NO_AUTHORITY
      });
    }
  }
}
