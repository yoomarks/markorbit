import { describe, expect, it } from 'vitest';
import {
  MANAGED_COMMUNICATION_CAPABILITY_ID,
  MANAGED_COMMUNICATION_CONTRACT_VERSION,
  managedCommunicationNoAuthorityConsequences,
  parseManagedCommunicationMessageV1,
  parseManagedCommunicationReadRequestV1
} from '../src/managed-communication.js';

const readRequest = {
  schemaVersion: 1,
  accountRef: 'commacct_workspace_primary',
  channel: 'EMAIL',
  checkpointRef: 'checkpoint_opaque_42',
  maxMessages: 100
} as const;

const message = {
  schemaVersion: 1,
  messageId: 'commmsg_001',
  accountRef: 'commacct_workspace_primary',
  threadRef: 'commthread_001',
  channel: 'EMAIL',
  direction: 'INBOUND',
  participants: [
    { role: 'SENDER', address: 'agent@example.test', displayName: 'External Agent' },
    { role: 'TO', address: 'workspace@example.test' }
  ],
  subject: 'Trademark status update',
  textBody: 'Grounded provider-observed message body.',
  attachments: [
    {
      attachmentRef: 'attachment_001',
      fileName: 'status.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 12,
      sha256: 'a'.repeat(64)
    }
  ],
  occurredAt: '2026-08-25T12:00:00.000Z',
  providerObservation: {
    provider: 'GMAIL',
    providerMessageId: 'gmail-message-1',
    providerThreadId: 'gmail-thread-1',
    observedAt: '2026-08-25T12:00:01.000Z'
  }
} as const;

describe('Managed Communication contract V1', () => {
  it('freezes the provider-neutral capability identity and no-authority boundary', () => {
    expect(MANAGED_COMMUNICATION_CAPABILITY_ID).toBe('managed-communication');
    expect(MANAGED_COMMUNICATION_CONTRACT_VERSION).toBe('1.0.0');
    expect(managedCommunicationNoAuthorityConsequences).toEqual({
      externalMessageSent: false,
      customerTruthMutated: false,
      matterTruthMutated: false,
      legalTruthCreated: false,
      knowledgeApproved: false,
      professionalDecisionCreated: false
    });
  });

  it('accepts only opaque account/checkpoint references at the incremental read boundary', () => {
    expect(parseManagedCommunicationReadRequestV1(readRequest)).toEqual(readRequest);
  });

  it.each([
    'provider',
    'credential',
    'accessToken',
    'refreshToken',
    'imapHost',
    'smtpHost',
    'providerCursor'
  ])('rejects caller implementation control field %s', (field) => {
    expect(() =>
      parseManagedCommunicationReadRequestV1({
        ...readRequest,
        [field]: 'caller-controlled'
      })
    ).toThrow(/unsupported fields/u);
  });

  it('normalizes message semantics while preserving provider observation provenance', () => {
    expect(parseManagedCommunicationMessageV1(message)).toEqual(message);
  });

  it('requires exactly one semantic sender without promoting message content into business truth', () => {
    expect(() =>
      parseManagedCommunicationMessageV1({
        ...message,
        participants: [{ role: 'TO', address: 'workspace@example.test' }]
      })
    ).toThrow(/exactly one SENDER/u);
  });

  it('supports outbound-normalized message observation without authorizing external send', () => {
    const outbound = parseManagedCommunicationMessageV1({
      ...message,
      direction: 'OUTBOUND',
      messageId: 'commmsg_out_001'
    });

    expect(outbound.direction).toBe('OUTBOUND');
    expect(managedCommunicationNoAuthorityConsequences.externalMessageSent).toBe(false);
  });

  it('fails closed on raw provider state embedded into normalized message shape', () => {
    expect(() =>
      parseManagedCommunicationMessageV1({
        ...message,
        rawProviderPayload: { secret: 'not-allowed' }
      })
    ).toThrow(/unsupported fields/u);
  });
});
