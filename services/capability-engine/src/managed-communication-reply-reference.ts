import {
  noManagedCommunicationReplyReferenceAuthorityConsequencesV1,
  parseManagedCommunicationReplyReferenceEvidenceV1,
  type ManagedCommunicationReplyReferenceEvidenceV1
} from '@markorbit/contracts/managed-communication-reply-reference';
import type { ManagedCommunicationExactEvidenceStoreV1 } from './managed-communication-exact-evidence.js';
import type { ManagedCommunicationFoundationStoreV1 } from './managed-communication-foundation.js';

export type ManagedCommunicationReplyReferenceErrorCode =
  | 'EXACT_EVIDENCE_NOT_FOUND'
  | 'LINEAGE_MISMATCH'
  | 'TOO_MANY_REFERENCES';

export class ManagedCommunicationReplyReferenceError extends Error {
  constructor(
    readonly code: ManagedCommunicationReplyReferenceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ManagedCommunicationReplyReferenceError';
  }
}

function messageIds(values: readonly string[], maximum: number, field: string): readonly string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const pattern = /<([^<>]+)>/gu;
  for (const value of values) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value)) !== null) {
      const messageId = match[1]!.trim();
      if (!messageId || seen.has(messageId)) continue;
      seen.add(messageId);
      result.push(messageId);
      if (result.length > maximum)
        throw new ManagedCommunicationReplyReferenceError(
          'TOO_MANY_REFERENCES',
          `${field} exceeds the bounded ${maximum}-identifier limit.`
        );
    }
  }
  return result;
}

function headerValues(
  headers: readonly Readonly<{ name: string; value: string }>[],
  name: string
): readonly string[] {
  const target = name.toLowerCase();
  return headers
    .filter((header) => header.name.trim().toLowerCase() === target)
    .map((header) => header.value);
}

export class ManagedCommunicationReplyReferenceReaderV1 {
  constructor(
    private readonly foundation: Pick<
      ManagedCommunicationFoundationStoreV1,
      'resolveAccount' | 'resolveMessage'
    >,
    private readonly exactEvidence: Pick<
      ManagedCommunicationExactEvidenceStoreV1,
      'resolveExactEvidence'
    >
  ) {}

  async read(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
  }): Promise<ManagedCommunicationReplyReferenceEvidenceV1> {
    const [account, message, evidence] = await Promise.all([
      this.foundation.resolveAccount(input.workspaceId, input.accountRef),
      this.foundation.resolveMessage(input.workspaceId, input.accountRef, input.messageId),
      this.exactEvidence.resolveExactEvidence(input)
    ]);
    if (!evidence)
      throw new ManagedCommunicationReplyReferenceError(
        'EXACT_EVIDENCE_NOT_FOUND',
        'Managed Communication exact evidence must already exist before reply-reference derivation.'
      );
    if (
      account.workspaceId !== input.workspaceId ||
      account.accountRef !== input.accountRef ||
      account.channel !== 'EMAIL' ||
      message.accountRef !== account.accountRef ||
      message.messageId !== input.messageId ||
      message.channel !== 'EMAIL' ||
      message.direction !== 'INBOUND' ||
      message.providerObservation.provider !== account.provider ||
      evidence.provider !== message.providerObservation.provider ||
      evidence.providerMessageId !== message.providerObservation.providerMessageId ||
      evidence.observedAt !== message.providerObservation.observedAt
    )
      throw new ManagedCommunicationReplyReferenceError(
        'LINEAGE_MISMATCH',
        'Managed Communication reply-reference lineage does not match the admitted account/message/evidence.'
      );

    const inReplyToMessageIds = messageIds(
      headerValues(evidence.headers, 'in-reply-to'),
      20,
      'In-Reply-To'
    );
    const referenceMessageIds = messageIds(
      headerValues(evidence.headers, 'references'),
      50,
      'References'
    );

    return parseManagedCommunicationReplyReferenceEvidenceV1({
      schemaVersion: 1,
      workspaceId: account.workspaceId,
      accountRef: account.accountRef,
      messageId: message.messageId,
      threadRef: message.threadRef,
      provider: message.providerObservation.provider,
      providerMessageId: message.providerObservation.providerMessageId,
      observedAt: message.providerObservation.observedAt,
      inReplyToMessageIds,
      referenceMessageIds,
      exactEvidence: {
        evidenceRef: evidence.evidenceRef,
        sha256: evidence.sha256
      },
      authority: noManagedCommunicationReplyReferenceAuthorityConsequencesV1
    });
  }
}
