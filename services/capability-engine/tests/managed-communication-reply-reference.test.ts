import { describe, expect, it } from 'vitest';
import {
  ManagedCommunicationReplyReferenceError,
  ManagedCommunicationReplyReferenceReaderV1
} from '../src/managed-communication-reply-reference.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

function foundation() {
  return {
    resolveAccount: () =>
      Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId,
        accountRef: 'managed-account_reply',
        channel: 'EMAIL' as const,
        provider: 'MICROSOFT_GRAPH',
        providerAccountRef: 'graph-account-private',
        createdAt: '2026-09-19T05:00:00.000Z'
      }),
    resolveMessage: () =>
      Promise.resolve({
        schemaVersion: 1 as const,
        messageId: 'managed-message_reply',
        accountRef: 'managed-account_reply',
        threadRef: 'managed-thread_reply',
        channel: 'EMAIL' as const,
        direction: 'INBOUND' as const,
        participants: [{ role: 'SENDER' as const, address: 'person@example.net' }],
        subject: 'Re: private campaign',
        textBody: 'private reply body',
        attachments: [],
        occurredAt: '2026-09-19T06:00:00.000Z',
        providerObservation: {
          provider: 'MICROSOFT_GRAPH',
          providerMessageId: 'AQMk-reply',
          observedAt: '2026-09-19T06:00:01.000Z'
        }
      })
  };
}

function exactEvidence(
  headers: readonly Readonly<{ name: string; value: string }>[],
  overrides: Partial<{
    provider: string;
    providerMessageId: string;
    observedAt: string;
  }> = {}
) {
  return {
    resolveExactEvidence: () =>
      Promise.resolve({
        schemaVersion: 1 as const,
        evidenceRef: 'commevidence_reply',
        sha256: '1'.repeat(64),
        mediaType: 'message/rfc822',
        sizeBytes: 1234,
        observedAt: overrides.observedAt ?? '2026-09-19T06:00:01.000Z',
        provider: overrides.provider ?? 'MICROSOFT_GRAPH',
        providerMessageId: overrides.providerMessageId ?? 'AQMk-reply',
        headers,
        metadata: {}
      })
  };
}

describe('Managed Communication reply-reference derivation', () => {
  it('projects only bounded RFC message identifiers from admitted exact evidence', async () => {
    const reader = new ManagedCommunicationReplyReferenceReaderV1(
      foundation(),
      exactEvidence([
        {
          name: 'In-Reply-To',
          value: '<010001reply-000000@email.amazonses.com>'
        },
        {
          name: 'References',
          value:
            '<older@example.net> <010001reply-000000@email.amazonses.com>'
        },
        { name: 'Subject', value: 'Re: private campaign' },
        { name: 'X-Custom', value: 'private-header-value' }
      ])
    );

    const result = await reader.read({
      workspaceId,
      accountRef: 'managed-account_reply',
      messageId: 'managed-message_reply'
    });

    expect(result).toMatchObject({
      workspaceId,
      accountRef: 'managed-account_reply',
      messageId: 'managed-message_reply',
      inReplyToMessageIds: ['010001reply-000000@email.amazonses.com'],
      referenceMessageIds: [
        'older@example.net',
        '010001reply-000000@email.amazonses.com'
      ],
      exactEvidence: {
        evidenceRef: 'commevidence_reply',
        sha256: '1'.repeat(64)
      }
    });
    expect(JSON.stringify(result)).not.toContain('private reply body');
    expect(JSON.stringify(result)).not.toContain('private campaign');
    expect(JSON.stringify(result)).not.toContain('person@example.net');
    expect(JSON.stringify(result)).not.toContain('private-header-value');
  });

  it('requires exact evidence to have already been admitted', async () => {
    const reader = new ManagedCommunicationReplyReferenceReaderV1(foundation(), {
      resolveExactEvidence: () => Promise.resolve(undefined)
    });
    await expect(
      reader.read({
        workspaceId,
        accountRef: 'managed-account_reply',
        messageId: 'managed-message_reply'
      })
    ).rejects.toMatchObject({ code: 'EXACT_EVIDENCE_NOT_FOUND' });
  });

  it('fails closed on provider provenance drift', async () => {
    const reader = new ManagedCommunicationReplyReferenceReaderV1(
      foundation(),
      exactEvidence([], { providerMessageId: 'AQMk-other' })
    );
    await expect(
      reader.read({
        workspaceId,
        accountRef: 'managed-account_reply',
        messageId: 'managed-message_reply'
      })
    ).rejects.toMatchObject({ code: 'LINEAGE_MISMATCH' });
  });

  it('fails closed instead of truncating excessive References identifiers', async () => {
    const many = Array.from({ length: 51 }, (_, index) => `<message-${index}@example.net>`).join(
      ' '
    );
    const reader = new ManagedCommunicationReplyReferenceReaderV1(
      foundation(),
      exactEvidence([{ name: 'References', value: many }])
    );
    await expect(
      reader.read({
        workspaceId,
        accountRef: 'managed-account_reply',
        messageId: 'managed-message_reply'
      })
    ).rejects.toBeInstanceOf(ManagedCommunicationReplyReferenceError);
  });
});
