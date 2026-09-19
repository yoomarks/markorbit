import type {
  EmailCampaignReplyReferenceCandidateV1,
  EmailCampaignReplyReferenceCorrelatorV1
} from './email-campaign-reply-handoff.js';

const SES_MESSAGE_ID = /^([^<>\s@]+)@email\.amazonses\.com$/iu;

function headerValues(
  headers: readonly Readonly<{ name: string; value: string }>[],
  name: string
): readonly string[] {
  const target = name.toLowerCase();
  return headers
    .filter((header) => header.name.trim().toLowerCase() === target)
    .map((header) => header.value);
}

function rfcMessageIds(value: string): readonly string[] {
  const matches: string[] = [];
  const pattern = /<([^<>]+)>/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) matches.push(match[1]!);
  return matches;
}

function sesSubmissionRef(messageId: string): string | undefined {
  const match = SES_MESSAGE_ID.exec(messageId.trim());
  const local = match?.[1]?.trim();
  return local || undefined;
}

export class AmazonSesV2ReplyReferenceCorrelatorV1 implements EmailCampaignReplyReferenceCorrelatorV1 {
  candidates(
    headers: readonly Readonly<{ name: string; value: string }>[]
  ): readonly Readonly<EmailCampaignReplyReferenceCandidateV1>[] {
    const candidates: EmailCampaignReplyReferenceCandidateV1[] = [];
    const seen = new Set<string>();

    const admit = (
      value: string,
      correlationMethod: EmailCampaignReplyReferenceCandidateV1['correlationMethod']
    ) => {
      for (const rfcMessageId of rfcMessageIds(value)) {
        const providerSubmissionRef = sesSubmissionRef(rfcMessageId);
        if (!providerSubmissionRef || seen.has(providerSubmissionRef)) continue;
        seen.add(providerSubmissionRef);
        candidates.push({ providerSubmissionRef, correlationMethod });
      }
    };

    for (const value of headerValues(headers, 'in-reply-to')) admit(value, 'RFC_IN_REPLY_TO');
    for (const value of headerValues(headers, 'references')) admit(value, 'RFC_REFERENCES');

    return candidates;
  }
}
