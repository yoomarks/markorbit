import {
  managedCommunicationNoAuthorityConsequences,
  type ManagedCommunicationMessageV1
} from '@markorbit/contracts/managed-communication';
import type {
  ManagedCommunicationSendReceiptReaderV1,
  ManagedCommunicationSendReceiptV1,
  ManagedCommunicationThreadEvidenceReaderV1
} from './managed-communication-exchange.js';
import type {
  ManagedCommunicationExactEvidenceRefV1,
  ManagedCommunicationExactEvidenceStoreV1
} from './managed-communication-exact-evidence.js';
import type { ManagedCommunicationFoundationStoreV1 } from './managed-communication-foundation.js';
import {
  managedCommunicationInboundCorrelationNoAuthorityV1,
  type ManagedCommunicationInboundCorrelationSourceV1,
  type ManagedCommunicationInboundCorrelationV1
} from './managed-communication-inbound-correlation.js';

const CORRELATION_PREFIX = 'moCorrelation';

export type ManagedCommunicationConversationReadErrorCode =
  'CORRELATION_EVIDENCE_INVALID' | 'CORRELATION_LINEAGE_MISMATCH';
export class ManagedCommunicationConversationReadError extends Error {
  constructor(
    readonly code: ManagedCommunicationConversationReadErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ManagedCommunicationConversationReadError';
  }
}

export type ManagedCommunicationConversationSegmentRoleV1 =
  'ANCHOR_PROVIDER_THREAD' | 'CORRELATED_OUTBOUND_THREAD';

export type ManagedCommunicationConversationMessageV1 = Readonly<{
  accountRef: string;
  threadRef: string;
  message: Readonly<ManagedCommunicationMessageV1>;
  exactEvidence?: Readonly<ManagedCommunicationExactEvidenceRefV1>;
}>;

export type ManagedCommunicationConversationSegmentV1 = Readonly<{
  accountRef: string;
  threadRef: string;
  roles: readonly ManagedCommunicationConversationSegmentRoleV1[];
  messages: readonly Readonly<ManagedCommunicationConversationMessageV1>[];
}>;
export type ManagedCommunicationConversationReadV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: string;
  anchor: Readonly<{
    accountRef: string;
    messageId: string;
    threadRef: string;
  }>;
  disposition: 'PROVIDER_THREAD_ONLY' | 'CORRELATED' | 'REVIEW_REQUIRED';
  confidence: 'PROVIDER_ONLY' | 'EXACT';
  correlation?: Readonly<ManagedCommunicationInboundCorrelationV1>;
  segments: readonly Readonly<ManagedCommunicationConversationSegmentV1>[];
  authority: Readonly<typeof managedCommunicationNoAuthorityConsequences>;
}>;

function invalid(message: string): never {
  throw new ManagedCommunicationConversationReadError('CORRELATION_EVIDENCE_INVALID', message);
}

function mismatch(message: string): never {
  throw new ManagedCommunicationConversationReadError('CORRELATION_LINEAGE_MISMATCH', message);
}
function metadataValue(
  metadata: Readonly<Record<string, string>>,
  key: string
): string | undefined {
  return metadata[key];
}

function requiredMetadata(metadata: Readonly<Record<string, string>>, key: string): string {
  const value = metadataValue(metadata, key);
  if (!value) invalid(`Persisted correlation metadata is missing ${key}.`);
  return value;
}

function jsonStringArray(
  metadata: Readonly<Record<string, string>>,
  key: string,
  maximum: number
): readonly string[] {
  let value: unknown;
  try {
    value = JSON.parse(requiredMetadata(metadata, key));
  } catch (error) {
    invalid(
      `${key} must be a JSON string array: ${error instanceof Error ? error.message : 'invalid JSON'}.`
    );
  }
  if (!Array.isArray(value) || value.length > maximum) {
    invalid(`${key} must contain at most ${maximum} non-empty strings.`);
  }
  const normalized: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'string' || !item.trim()) {
      invalid(`${key} must contain at most ${maximum} non-empty strings.`);
    }
    normalized.push(item.trim());
  }
  return Object.freeze(normalized);
}
function correlationFromMetadata(
  metadata: Readonly<Record<string, string>>
): Readonly<ManagedCommunicationInboundCorrelationV1> | undefined {
  const keys = Object.keys(metadata).filter((key) => key.startsWith(CORRELATION_PREFIX));
  if (keys.length === 0) return undefined;
  if (
    requiredMetadata(metadata, 'moCorrelationSchemaVersion') !== '1' ||
    requiredMetadata(metadata, 'moCorrelationConfidence') !== 'EXACT' ||
    requiredMetadata(metadata, 'moCorrelationAuthority') !== 'NO_AUTHORITY'
  ) {
    invalid('Persisted correlation metadata violates the V1 no-authority envelope.');
  }

  const method = requiredMetadata(metadata, 'moCorrelationMethod');
  if (method !== 'RFC_MESSAGE_ID' && method !== 'PUBLIC_MAIL_REF') {
    invalid('Persisted correlation method is invalid.');
  }
  const disposition = requiredMetadata(metadata, 'moCorrelationDisposition');
  if (disposition !== 'RESOLVED' && disposition !== 'REVIEW_REQUIRED') {
    invalid('Persisted correlation disposition is invalid.');
  }

  const sourceFields = jsonStringArray(
    metadata,
    'moCorrelationSourceFields',
    3
  ) as readonly ManagedCommunicationInboundCorrelationSourceV1[];
  if (
    sourceFields.some(
      (value) => value !== 'SUBJECT' && value !== 'TEXT_BODY' && value !== 'HTML_BODY'
    )
  ) {
    invalid('Persisted correlation source fields are invalid.');
  }
  const rfcSource = metadataValue(metadata, 'moCorrelationRfcSource');
  if (rfcSource !== undefined && rfcSource !== 'IN_REPLY_TO' && rfcSource !== 'REFERENCES') {
    invalid('Persisted RFC correlation source is invalid.');
  }
  const reviewReason = metadataValue(metadata, 'moCorrelationReviewReason');
  if (
    reviewReason !== undefined &&
    reviewReason !== 'TOO_MANY_PUBLIC_MAIL_REFS' &&
    reviewReason !== 'TOO_MANY_RFC_MESSAGE_IDS' &&
    reviewReason !== 'CONFLICTING_OUTBOUND_THREADS'
  ) {
    invalid('Persisted correlation review reason is invalid.');
  }

  const outboundThreadRef = metadataValue(metadata, 'moCorrelationOutboundThreadRef');
  const result: ManagedCommunicationInboundCorrelationV1 = {
    schemaVersion: 1,
    method,
    disposition,
    confidence: 'EXACT',
    rfcMessageIds: jsonStringArray(metadata, 'moCorrelationRfcMessageIds', 50),
    publicMailRefs: jsonStringArray(metadata, 'moCorrelationPublicMailRefs', 20),
    sendIds: jsonStringArray(metadata, 'moCorrelationSendIds', 50),
    outboundMessageIds: jsonStringArray(metadata, 'moCorrelationOutboundMessageIds', 50),
    outboundThreadRefs: jsonStringArray(metadata, 'moCorrelationOutboundThreadRefs', 50),
    sourceFields,
    ...(rfcSource === undefined ? {} : { rfcSource }),
    ...(outboundThreadRef === undefined ? {} : { outboundThreadRef }),
    ...(reviewReason === undefined ? {} : { reviewReason }),
    authority: managedCommunicationInboundCorrelationNoAuthorityV1
  };
  if (
    result.disposition === 'RESOLVED' &&
    (!result.outboundThreadRef || result.outboundThreadRefs.length !== 1)
  ) {
    invalid('Resolved correlation must identify exactly one outbound thread.');
  }
  if (result.outboundThreadRef && !result.outboundThreadRefs.includes(result.outboundThreadRef)) {
    invalid('Resolved correlation outbound thread is not present in its proven thread set.');
  }
  return Object.freeze(result);
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
type SegmentSeed = {
  accountRef: string;
  threadRef: string;
  roles: Set<ManagedCommunicationConversationSegmentRoleV1>;
};

export class ManagedCommunicationConversationReadServiceV1 {
  constructor(
    private readonly foundation: Pick<ManagedCommunicationFoundationStoreV1, 'resolveMessage'>,
    private readonly threadReader: ManagedCommunicationThreadEvidenceReaderV1,
    private readonly exactEvidence: Pick<
      ManagedCommunicationExactEvidenceStoreV1,
      'resolveExactEvidence'
    >,
    private readonly receipts: Pick<ManagedCommunicationSendReceiptReaderV1, 'resolveSentBySendId'>
  ) {}

  async read(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
  }): Promise<Readonly<ManagedCommunicationConversationReadV1>> {
    const anchorMessage = await this.foundation.resolveMessage(
      input.workspaceId,
      input.accountRef,
      input.messageId
    );
    const anchorEvidence = await this.exactEvidence.resolveExactEvidence({
      workspaceId: input.workspaceId,
      accountRef: input.accountRef,
      messageId: input.messageId
    });
    const correlation = anchorEvidence
      ? correlationFromMetadata(anchorEvidence.metadata)
      : undefined;
    const segments = new Map<string, SegmentSeed>();
    this.addSegment(segments, input.accountRef, anchorMessage.threadRef, 'ANCHOR_PROVIDER_THREAD');

    let disposition: ManagedCommunicationConversationReadV1['disposition'] = 'PROVIDER_THREAD_ONLY';
    let confidence: ManagedCommunicationConversationReadV1['confidence'] = 'PROVIDER_ONLY';

    if (correlation?.disposition === 'REVIEW_REQUIRED') {
      disposition = 'REVIEW_REQUIRED';
      confidence = 'EXACT';
    } else if (correlation?.disposition === 'RESOLVED') {
      disposition = 'CORRELATED';
      confidence = 'EXACT';
      const receipts = await this.resolveReceipts(input.workspaceId, correlation);
      for (const receipt of receipts) {
        this.addSegment(
          segments,
          receipt.accountRef,
          receipt.threadRef,
          'CORRELATED_OUTBOUND_THREAD'
        );
      }
    }

    const projected = await Promise.all(
      [...segments.values()].map((segment) => this.projectSegment(input.workspaceId, segment))
    );
    const anchorSegment = projected.find(
      (segment) =>
        segment.accountRef === input.accountRef && segment.threadRef === anchorMessage.threadRef
    );
    if (
      !anchorSegment ||
      !anchorSegment.messages.some((item) => item.message.messageId === input.messageId)
    ) {
      mismatch('Anchor message is missing from its persisted provider thread projection.');
    }

    projected.sort((left, right) => {
      const leftAnchor = left.roles.includes('ANCHOR_PROVIDER_THREAD') ? 0 : 1;
      const rightAnchor = right.roles.includes('ANCHOR_PROVIDER_THREAD') ? 0 : 1;
      if (leftAnchor !== rightAnchor) return leftAnchor - rightAnchor;
      return `${left.accountRef}\u0000${left.threadRef}`.localeCompare(
        `${right.accountRef}\u0000${right.threadRef}`
      );
    });

    return Object.freeze({
      schemaVersion: 1,
      workspaceId: input.workspaceId,
      anchor: Object.freeze({
        accountRef: input.accountRef,
        messageId: input.messageId,
        threadRef: anchorMessage.threadRef
      }),
      disposition,
      confidence,
      ...(correlation === undefined ? {} : { correlation }),
      segments: Object.freeze(projected),
      authority: managedCommunicationNoAuthorityConsequences
    });
  }
  private addSegment(
    segments: Map<string, SegmentSeed>,
    accountRef: string,
    threadRef: string,
    role: ManagedCommunicationConversationSegmentRoleV1
  ): void {
    const key = `${accountRef}\u0000${threadRef}`;
    const existing = segments.get(key);
    if (existing) {
      existing.roles.add(role);
      return;
    }
    segments.set(key, {
      accountRef,
      threadRef,
      roles: new Set([role])
    });
  }

  private async resolveReceipts(
    workspaceId: string,
    correlation: Readonly<ManagedCommunicationInboundCorrelationV1>
  ): Promise<readonly Readonly<ManagedCommunicationSendReceiptV1>[]> {
    if (correlation.sendIds.length === 0) {
      mismatch('Resolved correlation does not retain any outbound send identity.');
    }
    const receipts = await Promise.all(
      correlation.sendIds.map((sendId) => this.receipts.resolveSentBySendId(workspaceId, sendId))
    );
    if (receipts.some((receipt) => receipt === undefined)) {
      mismatch('Resolved correlation references an outbound send that no longer resolves.');
    }
    const proven = receipts as readonly Readonly<ManagedCommunicationSendReceiptV1>[];
    proven.forEach((receipt, index) => {
      if (receipt.workspaceId !== workspaceId || receipt.sendId !== correlation.sendIds[index]) {
        mismatch('Resolved correlation send identity no longer matches its Workspace owner.');
      }
    });
    if (correlation.method === 'RFC_MESSAGE_ID') {
      const rfcMessageIds = unique(
        proven.flatMap((receipt) => (receipt.rfcMessageId ? [receipt.rfcMessageId] : []))
      );
      if (
        correlation.publicMailRefs.length !== 0 ||
        !sameSet(rfcMessageIds, correlation.rfcMessageIds)
      ) {
        mismatch('RFC correlation proof no longer matches durable outbound send receipts.');
      }
    } else {
      const publicMailRefs = unique(
        proven.flatMap((receipt) => (receipt.publicMailRef ? [receipt.publicMailRef] : []))
      );
      if (
        correlation.rfcMessageIds.length !== 0 ||
        !sameSet(publicMailRefs, correlation.publicMailRefs)
      ) {
        mismatch(
          'Public-reference correlation proof no longer matches durable outbound send receipts.'
        );
      }
    }
    const messageIds = unique(proven.map((receipt) => receipt.messageId));
    const threadRefs = unique(proven.map((receipt) => receipt.threadRef));
    if (
      !sameSet(messageIds, correlation.outboundMessageIds) ||
      !sameSet(threadRefs, correlation.outboundThreadRefs)
    ) {
      mismatch('Resolved correlation metadata no longer matches durable outbound send receipts.');
    }
    if (
      correlation.outboundThreadRef === undefined ||
      threadRefs.length !== 1 ||
      threadRefs[0] !== correlation.outboundThreadRef
    ) {
      mismatch('Resolved correlation no longer converges on one durable outbound thread.');
    }
    const targetAccounts = unique(proven.map((receipt) => receipt.accountRef));
    if (targetAccounts.length !== 1) {
      mismatch('One correlated outbound thread cannot span multiple durable account bindings.');
    }
    return Object.freeze(proven.map((receipt) => Object.freeze(structuredClone(receipt))));
  }

  private async projectSegment(
    workspaceId: string,
    segment: Readonly<SegmentSeed>
  ): Promise<ManagedCommunicationConversationSegmentV1> {
    const messages = await this.threadReader.resolveThread({
      workspaceId,
      accountRef: segment.accountRef,
      threadRef: segment.threadRef
    });
    const projected = await Promise.all(
      messages.map(async (message) => {
        const exactEvidence = await this.exactEvidence.resolveExactEvidence({
          workspaceId,
          accountRef: segment.accountRef,
          messageId: message.messageId
        });
        return Object.freeze({
          accountRef: segment.accountRef,
          threadRef: segment.threadRef,
          message: Object.freeze(structuredClone(message)),
          ...(exactEvidence === undefined
            ? {}
            : { exactEvidence: Object.freeze(structuredClone(exactEvidence)) })
        });
      })
    );
    return Object.freeze({
      accountRef: segment.accountRef,
      threadRef: segment.threadRef,
      roles: Object.freeze([...segment.roles].sort()),
      messages: Object.freeze(projected)
    });
  }
}
