import type { ManagedCommunicationFoundationStoreV1 } from './managed-communication-foundation.js';
import {
  GMAIL_MANAGED_COMMUNICATION_PROVIDER,
  type GmailManagedCommunicationInboundResultV1,
  GmailManagedCommunicationClientV1,
  GmailManagedCommunicationInboundV1
} from './managed-communication-gmail.js';

export interface GmailManagedCommunicationAnchoredSyncOptionsV1 {
  client: GmailManagedCommunicationClientV1;
  inbound: GmailManagedCommunicationInboundV1;
  foundation: ManagedCommunicationFoundationStoreV1;
  workspaceId: string;
  accountRef: string;
  anchorProviderMessageId: string;
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
 * Seeds the first Gmail history checkpoint from one already-known provider message,
 * then immediately executes the ordinary incremental inbound synchronization.
 *
 * This is intentionally explicit. Ordinary `syncOnce()` keeps its forward-only
 * first-start behavior and never performs an implicit historical backfill.
 */
export async function syncGmailManagedCommunicationInboundFromAnchorV1(
  options: Readonly<GmailManagedCommunicationAnchoredSyncOptionsV1>
): Promise<Readonly<GmailManagedCommunicationInboundResultV1>> {
  const workspaceId = required(options.workspaceId, 'workspaceId');
  const accountRef = required(options.accountRef, 'accountRef');
  const anchorProviderMessageId = required(
    options.anchorProviderMessageId,
    'anchorProviderMessageId'
  );

  const account = await options.foundation.resolveAccount(workspaceId, accountRef);
  if (account.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER) {
    throw new Error('Anchored Gmail inbound sync requires a durable Gmail account binding.');
  }
  if (
    account.providerAccountRef.toLowerCase() !== options.client.providerAccountRef().toLowerCase()
  ) {
    throw new Error('Anchored Gmail inbound sync account binding does not match configured Gmail.');
  }

  const anchor = await options.client.message(anchorProviderMessageId, 'full');
  const returnedAnchorId = required(anchor.id, 'gmail.anchor.id');
  if (returnedAnchorId !== anchorProviderMessageId) {
    throw new Error('Gmail anchor provider message identity changed during lookup.');
  }
  const anchorHistoryId = required(anchor.historyId, 'gmail.anchor.historyId', 200);

  const existing = await options.foundation.latestCheckpoint(workspaceId, accountRef);
  if (existing && existing.providerCursor !== anchorHistoryId) {
    throw new Error(
      'Anchored Gmail inbound sync refuses to replace an existing different provider cursor.'
    );
  }

  if (!existing) {
    const now = options.now ?? (() => new Date().toISOString());
    const observedAt = now();
    await options.foundation.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: `gmail-history:${anchorHistoryId}`,
      providerCursor: anchorHistoryId,
      observedAt,
      now: observedAt
    });
  }

  return options.inbound.syncOnce();
}
