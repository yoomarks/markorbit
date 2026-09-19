import type {
  EmailCampaignReplyReferenceCandidateV1,
  EmailCampaignReplyReferenceCorrelatorV1
} from './email-campaign-reply-handoff.js';

const SES_MESSAGE_ID = /^([^<>\s@]+)@email\.amazonses\.com$/iu;

function sesSubmissionRef(messageId: string): string | undefined {
  const match = SES_MESSAGE_ID.exec(messageId.trim());
  const local = match?.[1]?.trim();
  return local || undefined;
}

export class AmazonSesV2ReplyReferenceCorrelatorV1 implements EmailCampaignReplyReferenceCorrelatorV1 {
  candidates(
    inReplyToMessageIds: readonly string[],
    referenceMessageIds: readonly string[]
  ): readonly Readonly<EmailCampaignReplyReferenceCandidateV1>[] {
    const candidates: EmailCampaignReplyReferenceCandidateV1[] = [];
    const seen = new Set<string>();

    const admit = (
      messageId: string,
      evidenceMethod: EmailCampaignReplyReferenceCandidateV1['evidenceMethod']
    ) => {
      const providerSubmissionRef = sesSubmissionRef(messageId);
      if (!providerSubmissionRef || seen.has(providerSubmissionRef)) return;
      seen.add(providerSubmissionRef);
      candidates.push({ providerSubmissionRef, evidenceMethod });
    };

    for (const messageId of inReplyToMessageIds) admit(messageId, 'RFC_IN_REPLY_TO');
    for (const messageId of referenceMessageIds) admit(messageId, 'RFC_REFERENCES');

    return candidates;
  }
}
