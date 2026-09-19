import { describe, expect, it } from 'vitest';
import {
  noManagedCommunicationReplyReferenceAuthorityConsequencesV1,
  parseManagedCommunicationReplyReferenceEvidenceV1
} from '../src/managed-communication-reply-reference.js';

const value = {
  schemaVersion: 1 as const,
  workspaceId: '14141414-1414-4414-8414-141414141414',
  accountRef: 'managed-account_reply',
  messageId: 'managed-message_reply',
  threadRef: 'managed-thread_reply',
  provider: 'MICROSOFT_GRAPH',
  providerMessageId: 'AQMk-reply',
  observedAt: '2026-09-19T06:00:01.000Z',
  inReplyToMessageIds: ['010001reply-000000@email.amazonses.com'],
  referenceMessageIds: ['older@example.net', '010001reply-000000@email.amazonses.com'],
  exactEvidence: {
    evidenceRef: 'commevidence_reply',
    sha256: '1'.repeat(64)
  },
  authority: noManagedCommunicationReplyReferenceAuthorityConsequencesV1
};

describe('Managed Communication reply reference evidence contract', () => {
  it('admits only bounded message-reference evidence', () => {
    expect(parseManagedCommunicationReplyReferenceEvidenceV1(value)).toEqual(value);
  });

  it('rejects body, participant, subject and address material', () => {
    for (const extra of [
      { subject: 'Re: Offer' },
      { textBody: 'hello' },
      { participants: [] },
      { emailAddress: 'person@example.com' }
    ]) {
      expect(() =>
        parseManagedCommunicationReplyReferenceEvidenceV1({ ...value, ...extra })
      ).toThrow(/forbidden material/);
    }
  });

  it('rejects unbounded or duplicate message-reference sets', () => {
    expect(() =>
      parseManagedCommunicationReplyReferenceEvidenceV1({
        ...value,
        inReplyToMessageIds: Array.from({ length: 21 }, (_, index) => `id-${index}`)
      })
    ).toThrow(/at most 20/);

    expect(() =>
      parseManagedCommunicationReplyReferenceEvidenceV1({
        ...value,
        referenceMessageIds: ['same@example.net', 'same@example.net']
      })
    ).toThrow(/duplicates/);
  });

  it('rejects authority escalation', () => {
    expect(() =>
      parseManagedCommunicationReplyReferenceEvidenceV1({
        ...value,
        authority: {
          ...value.authority,
          campaignTruthCreated: true
        }
      })
    ).toThrow(/campaignTruthCreated/);
  });
});
