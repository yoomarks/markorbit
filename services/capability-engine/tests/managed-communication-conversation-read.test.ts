import { describe, expect, it, vi } from 'vitest';
import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
import type {
  ManagedCommunicationSendReceiptReaderV1,
  ManagedCommunicationSendReceiptV1,
  ManagedCommunicationThreadEvidenceReaderV1
} from '../src/managed-communication-exchange.js';
import type {
  ManagedCommunicationExactEvidenceRefV1,
  ManagedCommunicationExactEvidenceStoreV1
} from '../src/managed-communication-exact-evidence.js';
import type { ManagedCommunicationFoundationStoreV1 } from '../src/managed-communication-foundation.js';
import { ManagedCommunicationConversationReadServiceV1 } from '../src/managed-communication-conversation-read.js';

const workspaceId = 'workspace-conversation-read';
const inboundAccountRef = 'account-gmail-current';
const outboundAccountRef = 'account-outlook-original';

function message(input: {
  messageId: string;
  accountRef: string;
  threadRef: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  provider?: string;
}): ManagedCommunicationMessageV1 {
  return {
    schemaVersion: 1,
    messageId: input.messageId,
    accountRef: input.accountRef,
    threadRef: input.threadRef,
    channel: 'EMAIL',
    direction: input.direction ?? 'INBOUND',
    participants: [
      { role: 'SENDER', address: 'expert@example.test' },
      { role: 'TO', address: 'operator@example.test' }
    ],
    subject: 'Conversation read',
    textBody: 'Provider-neutral projection.',
    attachments: [],
    occurredAt: '2026-09-22T08:00:00.000Z',
    providerObservation: {
      provider: input.provider ?? 'GMAIL',
      providerMessageId: `provider-${input.messageId}`,
      providerThreadId: `provider-${input.threadRef}`,
      observedAt: '2026-09-22T08:00:00.000Z'
    }
  };
}

function evidence(
  providerMessageId: string,
  metadata: Readonly<Record<string, string>> = {}
): ManagedCommunicationExactEvidenceRefV1 {
  return Object.freeze({
    schemaVersion: 1,
    evidenceRef: `evidence-${providerMessageId}`,
    sha256: 'a'.repeat(64),
    mediaType: 'message/rfc822',
    sizeBytes: 10,
    observedAt: '2026-09-22T08:00:00.000Z',
    provider: 'GMAIL',
    providerMessageId,
    headers: Object.freeze([]),
    metadata: Object.freeze({ ...metadata })
  });
}

function resolvedMetadata(overrides: Readonly<Record<string, string>> = {}) {
  return {
    moCorrelationSchemaVersion: '1',
    moCorrelationMethod: 'RFC_MESSAGE_ID',
    moCorrelationDisposition: 'RESOLVED',
    moCorrelationConfidence: 'EXACT',
    moCorrelationRfcMessageIds: JSON.stringify(['original@example.test']),
    moCorrelationPublicMailRefs: '[]',
    moCorrelationSendIds: JSON.stringify(['commsend_11111111111111111111111111111111']),
    moCorrelationOutboundMessageIds: JSON.stringify(['outbound-1']),
    moCorrelationOutboundThreadRefs: JSON.stringify(['thread-original']),
    moCorrelationSourceFields: '[]',
    moCorrelationRfcSource: 'IN_REPLY_TO',
    moCorrelationOutboundThreadRef: 'thread-original',
    moCorrelationAuthority: 'NO_AUTHORITY',
    ...overrides
  };
}

function reviewMetadata() {
  return {
    ...resolvedMetadata({
      moCorrelationDisposition: 'REVIEW_REQUIRED',
      moCorrelationSendIds: JSON.stringify([
        'commsend_11111111111111111111111111111111',
        'commsend_22222222222222222222222222222222'
      ]),
      moCorrelationOutboundMessageIds: JSON.stringify(['outbound-1', 'outbound-2']),
      moCorrelationOutboundThreadRefs: JSON.stringify(['thread-original', 'thread-conflict']),
      moCorrelationReviewReason: 'CONFLICTING_OUTBOUND_THREADS'
    })
  };
}

function receipt(
  overrides: Partial<ManagedCommunicationSendReceiptV1> = {}
): ManagedCommunicationSendReceiptV1 {
  return {
    schemaVersion: 1,
    sendId: 'commsend_11111111111111111111111111111111',
    workspaceId,
    accountRef: outboundAccountRef,
    idempotencyKeySha256: 'b'.repeat(64),
    requestFingerprintSha256: 'c'.repeat(64),
    state: 'SENT',
    messageId: 'outbound-1',
    threadRef: 'thread-original',
    provider: 'MICROSOFT_GRAPH',
    providerMessageId: 'graph-outbound-1',
    providerThreadId: 'graph-thread-original',
    rfcMessageId: 'original@example.test',
    providerReceiptRef: 'msgraph://message/1',
    acceptedAt: '2026-09-22T07:00:00.000Z',
    authority: {
      externalMessageSent: true,
      customerTruthMutated: false,
      matterTruthMutated: false,
      legalTruthCreated: false,
      knowledgeApproved: false,
      professionalDecisionCreated: false
    },
    ...overrides
  };
}

function serviceFixture(input?: {
  anchorMetadata?: Readonly<Record<string, string>>;
  sendReceipt?: ManagedCommunicationSendReceiptV1 | undefined;
}) {
  const anchor = message({
    messageId: 'inbound-1',
    accountRef: inboundAccountRef,
    threadRef: 'thread-current'
  });
  const sibling = message({
    messageId: 'inbound-2',
    accountRef: inboundAccountRef,
    threadRef: 'thread-current'
  });
  const outbound = message({
    messageId: 'outbound-1',
    accountRef: outboundAccountRef,
    threadRef: 'thread-original',
    direction: 'OUTBOUND',
    provider: 'MICROSOFT_GRAPH'
  });
  const anchorEvidence = evidence(
    anchor.providerObservation.providerMessageId,
    input?.anchorMetadata ?? {}
  );
  const evidenceByMessage = new Map<string, ManagedCommunicationExactEvidenceRefV1>([
    [anchor.messageId, anchorEvidence],
    [sibling.messageId, evidence(sibling.providerObservation.providerMessageId)]
  ]);
  const foundation = {
    resolveMessage: vi.fn(() => Promise.resolve(anchor))
  } as unknown as Pick<ManagedCommunicationFoundationStoreV1, 'resolveMessage'>;
  const threadReader = {
    resolveThread: vi.fn(({ accountRef, threadRef }: { accountRef: string; threadRef: string }) => {
      if (accountRef === inboundAccountRef && threadRef === 'thread-current') {
        return Promise.resolve([anchor, sibling]);
      }
      if (accountRef === outboundAccountRef && threadRef === 'thread-original') {
        return Promise.resolve([outbound]);
      }
      return Promise.resolve([]);
    })
  } satisfies ManagedCommunicationThreadEvidenceReaderV1;
  const exactEvidence = {
    resolveExactEvidence: vi.fn(
      ({ messageId }: { workspaceId: string; accountRef: string; messageId: string }) =>
        Promise.resolve(evidenceByMessage.get(messageId))
    )
  } as unknown as Pick<ManagedCommunicationExactEvidenceStoreV1, 'resolveExactEvidence'>;
  const receipts = {
    resolveSentBySendId: vi.fn(() =>
      Promise.resolve(input?.sendReceipt === undefined ? receipt() : input.sendReceipt)
    )
  } satisfies ManagedCommunicationSendReceiptReaderV1;
  const service = new ManagedCommunicationConversationReadServiceV1(
    foundation,
    threadReader,
    exactEvidence,
    receipts
  );
  return { service, foundation, threadReader, exactEvidence, receipts };
}
describe('Managed Communication conversation read model V1', () => {
  it('keeps an uncorrelated message on its provider thread only', async () => {
    const { service, receipts } = serviceFixture();

    const result = await service.read({
      workspaceId,
      accountRef: inboundAccountRef,
      messageId: 'inbound-1'
    });

    expect(result).toMatchObject({
      disposition: 'PROVIDER_THREAD_ONLY',
      confidence: 'PROVIDER_ONLY',
      anchor: {
        accountRef: inboundAccountRef,
        messageId: 'inbound-1',
        threadRef: 'thread-current'
      },
      authority: {
        customerTruthMutated: false,
        matterTruthMutated: false,
        knowledgeApproved: false
      }
    });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.roles).toEqual(['ANCHOR_PROVIDER_THREAD']);
    expect(result.segments[0]?.messages.map((item) => item.message.messageId)).toEqual([
      'inbound-1',
      'inbound-2'
    ]);
    expect(receipts.resolveSentBySendId).not.toHaveBeenCalled();
  });
  it('joins current Gmail and original Outlook threads through exact durable correlation', async () => {
    const { service, threadReader, receipts } = serviceFixture({
      anchorMetadata: resolvedMetadata()
    });

    const result = await service.read({
      workspaceId,
      accountRef: inboundAccountRef,
      messageId: 'inbound-1'
    });

    expect(result.disposition).toBe('CORRELATED');
    expect(result.confidence).toBe('EXACT');
    expect(result.correlation).toMatchObject({
      method: 'RFC_MESSAGE_ID',
      disposition: 'RESOLVED',
      outboundThreadRef: 'thread-original',
      sendIds: ['commsend_11111111111111111111111111111111']
    });
    expect(
      result.segments.map((segment) => ({
        accountRef: segment.accountRef,
        threadRef: segment.threadRef,
        roles: segment.roles
      }))
    ).toEqual([
      {
        accountRef: inboundAccountRef,
        threadRef: 'thread-current',
        roles: ['ANCHOR_PROVIDER_THREAD']
      },
      {
        accountRef: outboundAccountRef,
        threadRef: 'thread-original',
        roles: ['CORRELATED_OUTBOUND_THREAD']
      }
    ]);
    expect(result.segments[1]?.messages.map((item) => item.message.messageId)).toEqual([
      'outbound-1'
    ]);
    expect(receipts.resolveSentBySendId).toHaveBeenCalledWith(
      workspaceId,
      'commsend_11111111111111111111111111111111'
    );
    expect(threadReader.resolveThread).toHaveBeenCalledWith({
      workspaceId,
      accountRef: outboundAccountRef,
      threadRef: 'thread-original'
    });
  });

  it('does not cross-read conflicting threads when correlation requires review', async () => {
    const { service, receipts, threadReader } = serviceFixture({
      anchorMetadata: reviewMetadata()
    });

    const result = await service.read({
      workspaceId,
      accountRef: inboundAccountRef,
      messageId: 'inbound-1'
    });

    expect(result.disposition).toBe('REVIEW_REQUIRED');
    expect(result.confidence).toBe('EXACT');
    expect(result.correlation).toMatchObject({
      reviewReason: 'CONFLICTING_OUTBOUND_THREADS'
    });
    expect(result.segments).toHaveLength(1);
    expect(receipts.resolveSentBySendId).not.toHaveBeenCalled();
    expect(threadReader.resolveThread).toHaveBeenCalledTimes(1);
  });
  it('fails closed when persisted correlation no longer matches the send owner', async () => {
    const { service } = serviceFixture({
      anchorMetadata: resolvedMetadata(),
      sendReceipt: receipt({ threadRef: 'thread-drifted' })
    });

    await expect(
      service.read({
        workspaceId,
        accountRef: inboundAccountRef,
        messageId: 'inbound-1'
      })
    ).rejects.toMatchObject({
      code: 'CORRELATION_LINEAGE_MISMATCH'
    });
  });

  it('fails closed when the exact RFC proof drifts even if message/thread identity still matches', async () => {
    const { service } = serviceFixture({
      anchorMetadata: resolvedMetadata(),
      sendReceipt: receipt({ rfcMessageId: 'different@example.test' })
    });

    await expect(
      service.read({
        workspaceId,
        accountRef: inboundAccountRef,
        messageId: 'inbound-1'
      })
    ).rejects.toMatchObject({
      code: 'CORRELATION_LINEAGE_MISMATCH'
    });
  });

  it('fails closed on malformed reserved correlation metadata', async () => {
    const { service } = serviceFixture({
      anchorMetadata: { moCorrelationMethod: 'PUBLIC_MAIL_REF' }
    });

    await expect(
      service.read({
        workspaceId,
        accountRef: inboundAccountRef,
        messageId: 'inbound-1'
      })
    ).rejects.toMatchObject({
      code: 'CORRELATION_EVIDENCE_INVALID'
    });
  });

  it('merges segment roles instead of duplicating the same durable thread', async () => {
    const { service } = serviceFixture({
      anchorMetadata: resolvedMetadata({
        moCorrelationOutboundThreadRefs: JSON.stringify(['thread-current']),
        moCorrelationOutboundThreadRef: 'thread-current',
        moCorrelationOutboundMessageIds: JSON.stringify(['outbound-1'])
      }),
      sendReceipt: receipt({
        accountRef: inboundAccountRef,
        threadRef: 'thread-current'
      })
    });

    const result = await service.read({
      workspaceId,
      accountRef: inboundAccountRef,
      messageId: 'inbound-1'
    });

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.roles).toEqual([
      'ANCHOR_PROVIDER_THREAD',
      'CORRELATED_OUTBOUND_THREAD'
    ]);
  });
});
