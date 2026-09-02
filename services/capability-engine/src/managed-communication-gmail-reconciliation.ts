import {
  managedCommunicationNormalizedIdsV1,
  type ManagedCommunicationFoundationStoreV1
} from './managed-communication-foundation.js';
import type { ManagedCommunicationExactEvidenceStoreV1 } from './managed-communication-exact-evidence.js';
import {
  GmailManagedCommunicationInboundV1,
  GMAIL_MANAGED_COMMUNICATION_PROVIDER,
  type GmailManagedCommunicationClientV1,
  type GmailManagedCommunicationInboundResultV1
} from './managed-communication-gmail.js';

export interface GmailManagedCommunicationMessageReconciliationOptionsV1 {
  client: GmailManagedCommunicationClientV1;
  foundation: ManagedCommunicationFoundationStoreV1;
  exactEvidence: ManagedCommunicationExactEvidenceStoreV1;
  workspaceId: string;
  accountRef: string;
  providerMessageId: string;
  now?: () => string;
}

function required(value: string | undefined, field: string, maximum = 500): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${field} must contain 1 to ${maximum} characters.`);
  }
  return normalized;
}

/**
 * Reconciles one already-known Gmail provider message without rewinding or advancing
 * the durable Gmail history checkpoint.
 *
 * This is an explicit operator path for a provider message that is visible by stable
 * Gmail identity but whose original `messageAdded` history record predates the first
 * durable checkpoint. Ordinary `syncOnce()` remains forward-only.
 */
export async function reconcileGmailManagedCommunicationProviderMessageV1(
  options: Readonly<GmailManagedCommunicationMessageReconciliationOptionsV1>
): Promise<Readonly<GmailManagedCommunicationInboundResultV1>> {
  const workspaceId = required(options.workspaceId, 'workspaceId');
  const accountRef = required(options.accountRef, 'accountRef');
  const providerMessageId = required(options.providerMessageId, 'providerMessageId');

  const account = await options.foundation.resolveAccount(workspaceId, accountRef);
  if (account.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER) {
    throw new Error('Gmail message reconciliation requires a durable Gmail account binding.');
  }
  if (
    account.providerAccountRef.toLowerCase() !== options.client.providerAccountRef().toLowerCase()
  ) {
    throw new Error(
      'Gmail message reconciliation account binding does not match configured Gmail.'
    );
  }

  const checkpoint = await options.foundation.latestCheckpoint(workspaceId, accountRef);
  if (!checkpoint) {
    throw new Error(
      'Gmail message reconciliation requires an existing durable history checkpoint.'
    );
  }

  const normalizedIds = managedCommunicationNormalizedIdsV1({
    workspaceId,
    accountRef,
    provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
    providerMessageId
  });
  const existingEvidence = await options.exactEvidence.resolveExactEvidence({
    workspaceId,
    accountRef,
    messageId: normalizedIds.messageId
  });
  if (existingEvidence) {
    const existingMessage = await options.foundation.resolveMessage(
      workspaceId,
      accountRef,
      normalizedIds.messageId
    );
    if (
      existingMessage.direction !== 'INBOUND' ||
      existingMessage.providerObservation.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER ||
      existingMessage.providerObservation.providerMessageId !== providerMessageId ||
      existingEvidence.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER ||
      existingEvidence.providerMessageId !== providerMessageId ||
      existingEvidence.mediaType !== 'message/rfc822'
    ) {
      throw new Error(
        'Gmail message reconciliation durable replay state does not match immutable provider evidence.'
      );
    }
    return Object.freeze({
      initialized: false,
      imported: 0,
      providerCursor: checkpoint.providerCursor
    });
  }

  const full = await options.client.message(providerMessageId, 'full');
  const returnedMessageId = required(full.id, 'gmail.reconciliation.message.id');
  if (returnedMessageId !== providerMessageId) {
    throw new Error('Gmail provider message identity changed during reconciliation lookup.');
  }

  const syntheticClient = new Proxy(options.client, {
    get(target, property) {
      if (property === 'history') {
        return (startHistoryId: string, pageToken?: string) => {
          if (startHistoryId !== checkpoint.providerCursor || pageToken !== undefined) {
            throw new Error(
              'Gmail reconciliation synthetic history received an unexpected cursor.'
            );
          }
          return Promise.resolve({
            historyId: checkpoint.providerCursor,
            history: [{ messagesAdded: [{ message: { id: providerMessageId } }] }]
          });
        };
      }
      if (property === 'message') {
        return (messageId: string, format: 'full' | 'raw') => {
          if (messageId === providerMessageId && format === 'full') return Promise.resolve(full);
          return target.message(messageId, format);
        };
      }
      if (property === 'providerAccountRef') {
        return () => target.providerAccountRef();
      }
      if (property === 'attachment') {
        return (messageId: string, attachmentId: string) =>
          target.attachment(messageId, attachmentId);
      }
      throw new Error(`Unsupported Gmail reconciliation client property: ${String(property)}`);
    }
  });

  const checkpointPreservingFoundation: ManagedCommunicationFoundationStoreV1 = {
    registerAccount: (command) => options.foundation.registerAccount(command),
    resolveAccount: (requestedWorkspaceId, requestedAccountRef) =>
      options.foundation.resolveAccount(requestedWorkspaceId, requestedAccountRef),
    admitObservation: (command) => options.foundation.admitObservation(command),
    resolveMessage: (requestedWorkspaceId, requestedAccountRef, messageId) =>
      options.foundation.resolveMessage(requestedWorkspaceId, requestedAccountRef, messageId),
    latestCheckpoint: (requestedWorkspaceId, requestedAccountRef) =>
      options.foundation.latestCheckpoint(requestedWorkspaceId, requestedAccountRef),
    saveCheckpoint: () =>
      Promise.reject(
        new Error('Gmail message reconciliation must not mutate the durable history checkpoint.')
      )
  };

  const inbound = new GmailManagedCommunicationInboundV1({
    client: syntheticClient,
    foundation: checkpointPreservingFoundation,
    exactEvidence: options.exactEvidence,
    workspaceId,
    accountRef,
    ...(options.now ? { now: options.now } : {})
  });

  const result = await inbound.syncOnce();
  if (result.providerCursor !== checkpoint.providerCursor) {
    throw new Error('Gmail message reconciliation unexpectedly changed the provider cursor.');
  }
  return result;
}
