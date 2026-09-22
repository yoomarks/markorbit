import { describe, expect, it, vi } from 'vitest';
import {
  managedCommunicationPublicMailRefFromSendIdV1,
  managedCommunicationPublicMailReferenceAuthorityV1,
  type ManagedCommunicationPublicMailReferenceResolutionV1
} from '@markorbit/contracts/managed-communication-public-reference';
import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
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
