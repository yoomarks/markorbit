import { describe, expect, it, vi } from 'vitest';
import {
  managedCommunicationPublicMailRefFromSendIdV1,
  managedCommunicationPublicMailReferenceAuthorityV1,
  type ManagedCommunicationPublicMailReferenceResolutionV1
} from '@markorbit/contracts/managed-communication-public-reference';
import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
import type { ManagedCommunicationSendReceiptV1 } from '../src/managed-communication-exchange.js';
import {
  ManagedCommunicationInboundCorrelatorV1,
  managedCommunicationInboundEvidenceMetadataV1
} from '../src/managed-communication-inbound-correlation.js';
import { ManagedCommunicationPublicReferenceError } from '../src/managed-communication-public-reference.js';

const workspaceId = 'workspace-correlation';
const accountRef = 'account-inbound';

function sendId(index: number): string {
  return `commsend_${index.toString(16).padStart(32, '0')}`;
}

function publicRef(index: number): string {
  return managedCommunicationPublicMailRefFromSendIdV1(sendId(index));
}

function resolution(
  index: number,
  threadRef = 'thread-outbound'
): ManagedCommunicationPublicMailReferenceResolutionV1 {
  return {
    schemaVersion: 1,
    workspaceId,
    publicMailRef: publicRef(index),
    sendId: sendId(index),
    accountRef: 'account-outbound',
    messageId: `message-outbound-${index}`,
    threadRef,
    provider: 'MICROSOFT_GRAPH',
    providerMessageId: `provider-message-${index}`,
    providerThreadId: `provider-thread-${index}`,
    acceptedAt: '2026-09-22T00:00:00.000Z',
    authority: managedCommunicationPublicMailReferenceAuthorityV1
  };
}

function rfcReceipt(index: number, threadRef = 'thread-rfc'): ManagedCommunicationSendReceiptV1 {
  return {
    schemaVersion: 1,
    sendId: sendId(index),
    workspaceId,
    accountRef: 'account-outbound',
    idempotencyKeySha256: 'a'.repeat(64),
    requestFingerprintSha256: 'b'.repeat(64),
    state: 'SENT',
    publicMailRef: publicRef(index),
    messageId: `message-outbound-${index}`,
    threadRef,
    provider: 'MICROSOFT_GRAPH',
    providerMessageId: `provider-message-${index}`,
    providerThreadId: `provider-thread-${index}`,
    rfcMessageId: `outbound-${index}@example.test`,
    providerReceiptRef: `msgraph://me/messages/provider-message-${index}`,
    acceptedAt: '2026-09-22T00:00:00.000Z',
    authority: {
      externalMessageSent: true,
      customerTruthMutated: false,
      matterTruthMutated: false,
      legalTruthCreated: false,
      knowledgeApproved: false,
      professionalDecisionCreated: false
    }
  };
}

function inbound(
  overrides: Partial<ManagedCommunicationMessageV1> = {}
): ManagedCommunicationMessageV1 {
  return {
    schemaVersion: 1,
    messageId: 'message-inbound',
    accountRef,
    threadRef: 'provider-derived-inbound-thread',
    channel: 'EMAIL',
    direction: 'INBOUND',
    participants: [
      { role: 'SENDER', address: 'expert@example.test' },
      { role: 'TO', address: 'operator@example.test' }
    ],
    subject: 'Re: request',
    textBody: 'Inbound reply',
    attachments: [],
    occurredAt: '2026-09-22T01:00:00.000Z',
    providerObservation: {
      provider: 'GMAIL',
      providerMessageId: 'gmail-inbound-1',
      providerThreadId: 'gmail-new-provider-thread',
      observedAt: '2026-09-22T01:00:00.000Z'
    },
    ...overrides
  };
}
describe('Managed Communication inbound public-reference correlation V1', () => {
  it('resolves a footer reference to exact outbound lineage without trusting provider thread metadata', async () => {
    const resolve = vi.fn(() => Promise.resolve(resolution(1)));
    const correlator = new ManagedCommunicationInboundCorrelatorV1({ resolve });

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({
        textBody: `Thanks.\n\nMO Reference: [${publicRef(1)}]`
      })
    });

    expect(resolve).toHaveBeenCalledWith({ workspaceId, publicMailRef: publicRef(1) });
    expect(result).toMatchObject({
      method: 'PUBLIC_MAIL_REF',
      disposition: 'RESOLVED',
      confidence: 'EXACT',
      publicMailRefs: [publicRef(1)],
      sendIds: [sendId(1)],
      outboundMessageIds: ['message-outbound-1'],
      outboundThreadRefs: ['thread-outbound'],
      outboundThreadRef: 'thread-outbound',
      sourceFields: ['TEXT_BODY'],
      authority: {
        customerTruthMutated: false,
        matterTruthMutated: false,
        knowledgeApproved: false
      }
    });
    expect(result?.outboundThreadRef).not.toBe(inbound().threadRef);
  });

  it('deduplicates the same reference across subject, text and html evidence', async () => {
    const resolve = vi.fn(() => Promise.resolve(resolution(2)));
    const correlator = new ManagedCommunicationInboundCorrelatorV1({ resolve });
    const ref = publicRef(2);

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({
        subject: `Re: instruction [${ref}]`,
        textBody: `MO Reference: [${ref}]`,
        htmlBody: `<p>MO Reference: [${ref}]</p>`
      })
    });

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      disposition: 'RESOLVED',
      publicMailRefs: [ref],
      sourceFields: ['HTML_BODY', 'SUBJECT', 'TEXT_BODY']
    });
  });

  it('allows multiple exact references only when they converge on one outbound thread', async () => {
    const resolve = vi.fn(({ publicMailRef }: { publicMailRef: string }) =>
      Promise.resolve(publicMailRef === publicRef(3) ? resolution(3) : resolution(4))
    );
    const correlator = new ManagedCommunicationInboundCorrelatorV1({ resolve });

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({ textBody: `${publicRef(3)} and ${publicRef(4)}` })
    });

    expect(result).toMatchObject({
      disposition: 'RESOLVED',
      outboundThreadRefs: ['thread-outbound'],
      outboundThreadRef: 'thread-outbound'
    });
  });
  it('requires review instead of choosing between exact references to different outbound threads', async () => {
    const resolve = vi.fn(({ publicMailRef }: { publicMailRef: string }) =>
      Promise.resolve(
        publicMailRef === publicRef(5) ? resolution(5, 'thread-five') : resolution(6, 'thread-six')
      )
    );
    const correlator = new ManagedCommunicationInboundCorrelatorV1({ resolve });

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({ htmlBody: `<p>${publicRef(5)} ${publicRef(6)}</p>` })
    });

    expect(result).toMatchObject({
      disposition: 'REVIEW_REQUIRED',
      reviewReason: 'CONFLICTING_OUTBOUND_THREADS',
      outboundThreadRefs: ['thread-five', 'thread-six']
    });
    expect(result).not.toHaveProperty('outboundThreadRef');
  });

  it('does not create correlation for canonical-looking references without proven Workspace send evidence', async () => {
    const resolve = vi.fn(() =>
      Promise.reject(
        new ManagedCommunicationPublicReferenceError(
          'PUBLIC_MAIL_REF_NOT_FOUND',
          'not proven in this Workspace'
        )
      )
    );
    const correlator = new ManagedCommunicationInboundCorrelatorV1({ resolve });

    await expect(
      correlator.correlate({
        workspaceId,
        message: inbound({ textBody: publicRef(7) })
      })
    ).resolves.toBeUndefined();
  });

  it('ignores malformed public-reference-like text instead of blocking inbound admission', async () => {
    const resolve = vi.fn(() => Promise.resolve(resolution(7)));
    const correlator = new ManagedCommunicationInboundCorrelatorV1({ resolve });

    await expect(
      correlator.correlate({
        workspaceId,
        message: inbound({
          textBody: `Quoted customer token MO-${'Z'.repeat(26)} is not canonical.`
        })
      })
    ).resolves.toBeUndefined();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('bounds excessive reference material without attempting automatic resolution', async () => {
    const refs = Array.from({ length: 21 }, (_, index) => publicRef(index + 20));
    const resolve = vi.fn(() => Promise.resolve(resolution(20)));
    const correlator = new ManagedCommunicationInboundCorrelatorV1({ resolve });

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({ textBody: refs.join(' ') })
    });

    expect(result).toMatchObject({
      disposition: 'REVIEW_REQUIRED',
      reviewReason: 'TOO_MANY_PUBLIC_MAIL_REFS'
    });
    expect(result?.publicMailRefs).toHaveLength(20);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('propagates owner/infrastructure resolution failures so admission can retry', async () => {
    const correlator = new ManagedCommunicationInboundCorrelatorV1({
      resolve: () => Promise.reject(new Error('send receipt database unavailable'))
    });

    await expect(
      correlator.correlate({
        workspaceId,
        message: inbound({ textBody: publicRef(8) })
      })
    ).rejects.toThrow('send receipt database unavailable');
  });

  it('prefers a proven In-Reply-To RFC Message-ID over a conflicting public reference', async () => {
    const resolvePublic = vi.fn(() => Promise.resolve(resolution(99, 'thread-public')));
    const resolveRfc = vi.fn((_workspaceId: string, rfcMessageId: string) =>
      Promise.resolve(
        rfcMessageId === 'outbound-10@example.test'
          ? rfcReceipt(10, 'thread-rfc-direct')
          : undefined
      )
    );
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: resolvePublic },
      { resolveSentByRfcMessageId: resolveRfc }
    );

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({ textBody: `Quoted fallback ${publicRef(99)}` }),
      headers: [{ name: 'In-Reply-To', value: '<outbound-10@example.test>' }]
    });

    expect(resolvePublic).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      method: 'RFC_MESSAGE_ID',
      disposition: 'RESOLVED',
      confidence: 'EXACT',
      rfcMessageIds: ['outbound-10@example.test'],
      publicMailRefs: [],
      rfcSource: 'IN_REPLY_TO',
      outboundThreadRef: 'thread-rfc-direct'
    });
  });

  it('uses References only when no In-Reply-To identifier resolves to proven outbound evidence', async () => {
    const resolvePublic = vi.fn(() => Promise.resolve(resolution(11, 'thread-public')));
    const resolveRfc = vi.fn((_workspaceId: string, rfcMessageId: string) =>
      Promise.resolve(
        rfcMessageId === 'outbound-11@example.test' ? rfcReceipt(11, 'thread-reference') : undefined
      )
    );
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: resolvePublic },
      { resolveSentByRfcMessageId: resolveRfc }
    );

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({ textBody: publicRef(11) }),
      headers: [
        { name: 'In-Reply-To', value: '<unknown-direct@example.test>' },
        { name: 'References', value: '<older@example.test> <outbound-11@example.test>' }
      ]
    });

    expect(resolvePublic).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      method: 'RFC_MESSAGE_ID',
      disposition: 'RESOLVED',
      rfcMessageIds: ['outbound-11@example.test'],
      rfcSource: 'REFERENCES',
      outboundThreadRef: 'thread-reference'
    });
  });

  it('resolves multiple proven RFC references only when they converge on one outbound thread', async () => {
    const resolveRfc = vi.fn((_workspaceId: string, rfcMessageId: string) => {
      if (rfcMessageId === 'outbound-12@example.test')
        return Promise.resolve(rfcReceipt(12, 'thread-rfc-shared'));
      if (rfcMessageId === 'outbound-13@example.test')
        return Promise.resolve(rfcReceipt(13, 'thread-rfc-shared'));
      return Promise.resolve(undefined);
    });
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: () => Promise.resolve(resolution(12)) },
      { resolveSentByRfcMessageId: resolveRfc }
    );

    const result = await correlator.correlate({
      workspaceId,
      message: inbound(),
      headers: [
        {
          name: 'References',
          value: '<outbound-12@example.test> <outbound-13@example.test>'
        }
      ]
    });

    expect(result).toMatchObject({
      method: 'RFC_MESSAGE_ID',
      disposition: 'RESOLVED',
      rfcSource: 'REFERENCES',
      rfcMessageIds: ['outbound-12@example.test', 'outbound-13@example.test'],
      outboundThreadRefs: ['thread-rfc-shared'],
      outboundThreadRef: 'thread-rfc-shared'
    });
  });

  it('requires review when proven RFC references point to different outbound threads', async () => {
    const resolveRfc = vi.fn((_workspaceId: string, rfcMessageId: string) => {
      if (rfcMessageId === 'outbound-14@example.test')
        return Promise.resolve(rfcReceipt(14, 'thread-rfc-a'));
      if (rfcMessageId === 'outbound-15@example.test')
        return Promise.resolve(rfcReceipt(15, 'thread-rfc-b'));
      return Promise.resolve(undefined);
    });
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: () => Promise.resolve(resolution(14)) },
      { resolveSentByRfcMessageId: resolveRfc }
    );

    const result = await correlator.correlate({
      workspaceId,
      message: inbound(),
      headers: [
        {
          name: 'References',
          value: '<outbound-14@example.test> <outbound-15@example.test>'
        }
      ]
    });

    expect(result).toMatchObject({
      method: 'RFC_MESSAGE_ID',
      disposition: 'REVIEW_REQUIRED',
      reviewReason: 'CONFLICTING_OUTBOUND_THREADS',
      outboundThreadRefs: ['thread-rfc-a', 'thread-rfc-b']
    });
    expect(result).not.toHaveProperty('outboundThreadRef');
  });

  it('falls back to a proven public reference only when all RFC identifiers are unproven', async () => {
    const resolvePublic = vi.fn(() => Promise.resolve(resolution(16, 'thread-public-fallback')));
    const resolveRfc = vi.fn(() => Promise.resolve(undefined));
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: resolvePublic },
      { resolveSentByRfcMessageId: resolveRfc }
    );

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({ textBody: publicRef(16) }),
      headers: [
        { name: 'In-Reply-To', value: '<unknown-direct@example.test>' },
        { name: 'References', value: '<unknown-reference@example.test>' }
      ]
    });

    expect(resolvePublic).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      method: 'PUBLIC_MAIL_REF',
      disposition: 'RESOLVED',
      rfcMessageIds: [],
      publicMailRefs: [publicRef(16)],
      outboundThreadRef: 'thread-public-fallback'
    });
  });

  it('ignores malformed RFC identifiers and still permits exact public-reference fallback', async () => {
    const resolvePublic = vi.fn(() => Promise.resolve(resolution(17, 'thread-public-malformed')));
    const resolveRfc = vi.fn(() => Promise.resolve(undefined));
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: resolvePublic },
      { resolveSentByRfcMessageId: resolveRfc }
    );

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({ textBody: publicRef(17) }),
      headers: [{ name: 'In-Reply-To', value: '<not-an-rfc-message-id>' }]
    });

    expect(resolveRfc).not.toHaveBeenCalled();
    expect(resolvePublic).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      method: 'PUBLIC_MAIL_REF',
      outboundThreadRef: 'thread-public-malformed'
    });
  });

  it('propagates RFC receipt-owner failures instead of silently falling through to public refs', async () => {
    const resolvePublic = vi.fn(() => Promise.resolve(resolution(18)));
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: resolvePublic },
      {
        resolveSentByRfcMessageId: () =>
          Promise.reject(new Error('RFC send receipt owner unavailable'))
      }
    );

    await expect(
      correlator.correlate({
        workspaceId,
        message: inbound({ textBody: publicRef(18) }),
        headers: [{ name: 'In-Reply-To', value: '<outbound-18@example.test>' }]
      })
    ).rejects.toThrow('RFC send receipt owner unavailable');
    expect(resolvePublic).not.toHaveBeenCalled();
  });

  it('requires review for excessive RFC References instead of falling through to public refs', async () => {
    const resolvePublic = vi.fn(() => Promise.resolve(resolution(19)));
    const resolveRfc = vi.fn(() => Promise.resolve(undefined));
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: resolvePublic },
      { resolveSentByRfcMessageId: resolveRfc }
    );
    const references = Array.from(
      { length: 51 },
      (_, index) => `<bounded-${index}@example.test>`
    ).join(' ');

    const result = await correlator.correlate({
      workspaceId,
      message: inbound({ textBody: publicRef(19) }),
      headers: [{ name: 'References', value: references }]
    });

    expect(result).toMatchObject({
      method: 'RFC_MESSAGE_ID',
      disposition: 'REVIEW_REQUIRED',
      reviewReason: 'TOO_MANY_RFC_MESSAGE_IDS'
    });
    expect(resolveRfc).not.toHaveBeenCalled();
    expect(resolvePublic).not.toHaveBeenCalled();
  });
});
describe('Managed Communication inbound correlation evidence metadata', () => {
  it('projects exact no-authority correlation into reserved metadata keys', async () => {
    const correlator = new ManagedCommunicationInboundCorrelatorV1({
      resolve: () => Promise.resolve(resolution(9))
    });
    const correlation = await correlator.correlate({
      workspaceId,
      message: inbound({ textBody: publicRef(9) })
    });

    const metadata = managedCommunicationInboundEvidenceMetadataV1({
      providerMetadata: { gmailMessageId: 'gmail-inbound-1' },
      correlation: correlation!
    });

    expect(metadata).toMatchObject({
      gmailMessageId: 'gmail-inbound-1',
      moCorrelationSchemaVersion: '1',
      moCorrelationMethod: 'PUBLIC_MAIL_REF',
      moCorrelationDisposition: 'RESOLVED',
      moCorrelationConfidence: 'EXACT',
      moCorrelationOutboundThreadRef: 'thread-outbound',
      moCorrelationAuthority: 'NO_AUTHORITY'
    });
  });

  it('projects RFC exact lineage and source into reserved metadata keys', async () => {
    const correlator = new ManagedCommunicationInboundCorrelatorV1(
      { resolve: () => Promise.resolve(resolution(20)) },
      {
        resolveSentByRfcMessageId: (_workspaceId, rfcMessageId) =>
          Promise.resolve(
            rfcMessageId === 'outbound-20@example.test'
              ? rfcReceipt(20, 'thread-rfc-metadata')
              : undefined
          )
      }
    );
    const correlation = await correlator.correlate({
      workspaceId,
      message: inbound(),
      headers: [{ name: 'In-Reply-To', value: '<outbound-20@example.test>' }]
    });

    const metadata = managedCommunicationInboundEvidenceMetadataV1({
      providerMetadata: { graphMessageId: 'graph-inbound-20' },
      correlation: correlation!
    });

    expect(metadata).toMatchObject({
      graphMessageId: 'graph-inbound-20',
      moCorrelationMethod: 'RFC_MESSAGE_ID',
      moCorrelationDisposition: 'RESOLVED',
      moCorrelationRfcMessageIds: JSON.stringify(['outbound-20@example.test']),
      moCorrelationRfcSource: 'IN_REPLY_TO',
      moCorrelationPublicMailRefs: '[]',
      moCorrelationOutboundThreadRef: 'thread-rfc-metadata',
      moCorrelationAuthority: 'NO_AUTHORITY'
    });
  });

  it('preserves only previously admitted owner correlation metadata on immutable evidence replay', () => {
    const result = managedCommunicationInboundEvidenceMetadataV1({
      providerMetadata: {
        gmailMessageId: 'gmail-inbound-1',
        gmailThreadId: 'provider-thread-still-exact'
      },
      existingMetadata: {
        gmailMessageId: 'gmail-inbound-1',
        gmailThreadId: 'provider-thread-still-exact',
        moCorrelationDisposition: 'RESOLVED',
        moCorrelationOutboundThreadRef: 'thread-original'
      }
    });

    expect(result).toEqual({
      gmailMessageId: 'gmail-inbound-1',
      gmailThreadId: 'provider-thread-still-exact',
      moCorrelationDisposition: 'RESOLVED',
      moCorrelationOutboundThreadRef: 'thread-original'
    });
  });

  it('does not copy stale provider metadata from existing evidence and reserves owner keys', () => {
    const result = managedCommunicationInboundEvidenceMetadataV1({
      providerMetadata: { gmailMessageId: 'new-provider-value' },
      existingMetadata: {
        gmailMessageId: 'old-provider-value',
        moCorrelationDisposition: 'RESOLVED'
      }
    });
    expect(result.gmailMessageId).toBe('new-provider-value');

    expect(() =>
      managedCommunicationInboundEvidenceMetadataV1({
        providerMetadata: { moCorrelationDisposition: 'provider-spoof' }
      })
    ).toThrow(/must not write Managed Communication owner key/u);
  });
});
