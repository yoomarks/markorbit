import { describe, expect, it, vi } from 'vitest';
import { managedCommunicationPublicMailRefFromSendIdV1 } from '@markorbit/contracts/managed-communication-public-reference';
import type {
  ManagedCommunicationSendReceiptReaderV1,
  ManagedCommunicationSendReceiptV1
} from '../src/managed-communication-exchange.js';
import { ManagedCommunicationPublicReferenceReaderV1 } from '../src/managed-communication-public-reference.js';

const workspaceId = 'workspace-public-ref';
const sendId = 'commsend_0123456789abcdef0123456789abcdef';
const publicMailRef = managedCommunicationPublicMailRefFromSendIdV1(sendId);

function receipt(overrides: Partial<ManagedCommunicationSendReceiptV1> = {}) {
  return {
    schemaVersion: 1,
    sendId,
    workspaceId,
    accountRef: 'account-original',
    idempotencyKeySha256: 'a'.repeat(64),
    requestFingerprintSha256: 'b'.repeat(64),
    state: 'SENT',
    publicMailRef,
    messageId: 'message-original',
    threadRef: 'thread-original',
    provider: 'MICROSOFT_GRAPH',
    providerMessageId: 'provider-message-original',
    providerThreadId: 'provider-thread-original',
    providerReceiptRef: 'provider-receipt-original',
    acceptedAt: '2026-09-22T00:00:00.000Z',
    authority: {
      externalMessageSent: true,
      customerTruthMutated: false,
      matterTruthMutated: false,
      legalTruthCreated: false,
      knowledgeApproved: false,
      professionalDecisionCreated: false
    },
    ...overrides
  } as ManagedCommunicationSendReceiptV1;
}

describe('Managed Communication public reference reader V1', () => {
  it('resolves the original durable outbound message without current provider identity', async () => {
    const resolveSentBySendId = vi.fn(() => Promise.resolve(receipt()));
    const reader = new ManagedCommunicationPublicReferenceReaderV1({
      resolveSentBySendId
    } satisfies ManagedCommunicationSendReceiptReaderV1);

    const resolved = await reader.resolve({ workspaceId, publicMailRef });

    expect(resolveSentBySendId).toHaveBeenCalledWith(workspaceId, sendId);
    expect(resolved).toMatchObject({
      workspaceId,
      publicMailRef,
      sendId,
      accountRef: 'account-original',
      messageId: 'message-original',
      threadRef: 'thread-original',
      provider: 'MICROSOFT_GRAPH',
      authority: {
        externalMessageSent: false,
        customerTruthMutated: false,
        matterTruthMutated: false
      }
    });
  });

  it('does not let a derivable ref retroactively prove legacy sends that never emitted it', async () => {
    const legacy = receipt();
    delete legacy.publicMailRef;
    const reader = new ManagedCommunicationPublicReferenceReaderV1({
      resolveSentBySendId: () => Promise.resolve(legacy)
    });

    await expect(reader.resolve({ workspaceId, publicMailRef })).rejects.toMatchObject({
      code: 'PUBLIC_MAIL_REF_NOT_FOUND'
    });
  });

  it('fails invalid references before any receipt lookup', async () => {
    const resolveSentBySendId = vi.fn(() => Promise.resolve(undefined));
    const reader = new ManagedCommunicationPublicReferenceReaderV1({
      resolveSentBySendId
    });

    await expect(
      reader.resolve({ workspaceId, publicMailRef: 'MO-NOT-A-REFERENCE' })
    ).rejects.toMatchObject({ code: 'INVALID_PUBLIC_MAIL_REF' });
    expect(resolveSentBySendId).not.toHaveBeenCalled();
  });
});
