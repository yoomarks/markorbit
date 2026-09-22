import {
  extractManagedCommunicationPublicMailRefsV1,
  ManagedCommunicationPublicMailReferenceContractError,
  type ManagedCommunicationPublicMailReferenceResolutionV1
} from '@markorbit/contracts/managed-communication-public-reference';
import {
  parseManagedCommunicationMessageV1,
  type ManagedCommunicationMessageV1
} from '@markorbit/contracts/managed-communication';
import {
  ManagedCommunicationPublicReferenceError,
  type ManagedCommunicationPublicReferenceReaderV1
} from './managed-communication-public-reference.js';

const MAX_PUBLIC_REFS = 20;
const PUBLIC_REF_LIKE = /(?:^|[^A-Z0-9])(MO-[0-9A-Z]{26})(?=$|[^A-Z0-9])/giu;
const RESERVED_METADATA_PREFIX = 'moCorrelation';

export const managedCommunicationInboundCorrelationNoAuthorityV1 = Object.freeze({
  customerTruthMutated: false,
  matterTruthMutated: false,
  legalTruthCreated: false,
  knowledgeApproved: false,
  professionalDecisionCreated: false
});

export type ManagedCommunicationInboundCorrelationSourceV1 = 'SUBJECT' | 'TEXT_BODY' | 'HTML_BODY';

export type ManagedCommunicationInboundCorrelationReviewReasonV1 =
  'TOO_MANY_PUBLIC_MAIL_REFS' | 'CONFLICTING_OUTBOUND_THREADS';
export type ManagedCommunicationInboundCorrelationV1 = Readonly<{
  schemaVersion: 1;
  method: 'PUBLIC_MAIL_REF';
  disposition: 'RESOLVED' | 'REVIEW_REQUIRED';
  confidence: 'EXACT';
  publicMailRefs: readonly string[];
  sendIds: readonly string[];
  outboundMessageIds: readonly string[];
  outboundThreadRefs: readonly string[];
  sourceFields: readonly ManagedCommunicationInboundCorrelationSourceV1[];
  outboundThreadRef?: string;
  reviewReason?: ManagedCommunicationInboundCorrelationReviewReasonV1;
  authority: Readonly<typeof managedCommunicationInboundCorrelationNoAuthorityV1>;
}>;

export interface ManagedCommunicationInboundCorrelationResolverV1 {
  correlate(input: {
    workspaceId: string;
    message: Readonly<ManagedCommunicationMessageV1>;
  }): Promise<Readonly<ManagedCommunicationInboundCorrelationV1> | undefined>;
}

type PublicRefCandidate = {
  publicMailRef: string;
  sourceFields: Set<ManagedCommunicationInboundCorrelationSourceV1>;
};

function canonicalPublicRefs(value: string): readonly string[] {
  const refs: string[] = [];
  for (const match of value.matchAll(PUBLIC_REF_LIKE)) {
    try {
      const publicMailRef = extractManagedCommunicationPublicMailRefsV1(match[1]!, 1)[0];
      if (publicMailRef) refs.push(publicMailRef);
    } catch (error) {
      if (error instanceof ManagedCommunicationPublicMailReferenceContractError) continue;
      throw error;
    }
  }
  return refs;
}

function candidates(
  message: Readonly<ManagedCommunicationMessageV1>
): readonly PublicRefCandidate[] {
  const byRef = new Map<string, PublicRefCandidate>();
  const values: readonly [ManagedCommunicationInboundCorrelationSourceV1, string | undefined][] = [
    ['SUBJECT', message.subject],
    ['TEXT_BODY', message.textBody],
    ['HTML_BODY', message.htmlBody]
  ];
  for (const [sourceField, value] of values) {
    if (!value) continue;
    for (const publicMailRef of canonicalPublicRefs(value)) {
      const existing = byRef.get(publicMailRef);
      if (existing) {
        existing.sourceFields.add(sourceField);
      } else {
        byRef.set(publicMailRef, {
          publicMailRef,
          sourceFields: new Set([sourceField])
        });
      }
      if (byRef.size > MAX_PUBLIC_REFS) break;
    }
    if (byRef.size > MAX_PUBLIC_REFS) break;
  }
  return [...byRef.values()];
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function sourceFields(values: readonly PublicRefCandidate[]) {
  return Object.freeze([...new Set(values.flatMap((value) => [...value.sourceFields]))].sort());
}

function correlation(
  input: Omit<ManagedCommunicationInboundCorrelationV1, 'schemaVersion' | 'authority'>
): ManagedCommunicationInboundCorrelationV1 {
  return Object.freeze({
    schemaVersion: 1,
    ...input,
    authority: managedCommunicationInboundCorrelationNoAuthorityV1
  });
}
export class ManagedCommunicationInboundCorrelatorV1 implements ManagedCommunicationInboundCorrelationResolverV1 {
  constructor(
    private readonly publicReferences: Pick<ManagedCommunicationPublicReferenceReaderV1, 'resolve'>
  ) {}

  async correlate(input: {
    workspaceId: string;
    message: Readonly<ManagedCommunicationMessageV1>;
  }): Promise<Readonly<ManagedCommunicationInboundCorrelationV1> | undefined> {
    const message = parseManagedCommunicationMessageV1(input.message);
    if (message.channel !== 'EMAIL' || message.direction !== 'INBOUND') {
      throw new TypeError(
        'Managed Communication public-reference correlation requires INBOUND EMAIL.'
      );
    }

    const found = candidates(message);
    if (found.length === 0) return undefined;
    if (found.length > MAX_PUBLIC_REFS) {
      return correlation({
        method: 'PUBLIC_MAIL_REF',
        disposition: 'REVIEW_REQUIRED',
        confidence: 'EXACT',
        publicMailRefs: Object.freeze(
          found.slice(0, MAX_PUBLIC_REFS).map((item) => item.publicMailRef)
        ),
        sendIds: Object.freeze([]),
        outboundMessageIds: Object.freeze([]),
        outboundThreadRefs: Object.freeze([]),
        sourceFields: sourceFields(found),
        reviewReason: 'TOO_MANY_PUBLIC_MAIL_REFS'
      });
    }

    const resolutions: ManagedCommunicationPublicMailReferenceResolutionV1[] = [];
    for (const candidate of found) {
      try {
        resolutions.push(
          await this.publicReferences.resolve({
            workspaceId: input.workspaceId,
            publicMailRef: candidate.publicMailRef
          })
        );
      } catch (error) {
        if (
          error instanceof ManagedCommunicationPublicReferenceError &&
          error.code === 'PUBLIC_MAIL_REF_NOT_FOUND'
        ) {
          continue;
        }
        throw error;
      }
    }
    if (resolutions.length === 0) return undefined;

    const outboundThreadRefs = unique(resolutions.map((item) => item.threadRef));
    const common = {
      method: 'PUBLIC_MAIL_REF' as const,
      confidence: 'EXACT' as const,
      publicMailRefs: Object.freeze(resolutions.map((item) => item.publicMailRef)),
      sendIds: unique(resolutions.map((item) => item.sendId)),
      outboundMessageIds: unique(resolutions.map((item) => item.messageId)),
      outboundThreadRefs,
      sourceFields: sourceFields(
        found.filter((candidate) =>
          resolutions.some((item) => item.publicMailRef === candidate.publicMailRef)
        )
      )
    };
    if (outboundThreadRefs.length !== 1) {
      return correlation({
        ...common,
        disposition: 'REVIEW_REQUIRED',
        reviewReason: 'CONFLICTING_OUTBOUND_THREADS'
      });
    }
    return correlation({
      ...common,
      disposition: 'RESOLVED',
      outboundThreadRef: outboundThreadRefs[0]!
    });
  }
}
function correlationMetadata(
  value: Readonly<ManagedCommunicationInboundCorrelationV1>
): Readonly<Record<string, string>> {
  const metadata: Record<string, string> = {
    moCorrelationSchemaVersion: '1',
    moCorrelationMethod: value.method,
    moCorrelationDisposition: value.disposition,
    moCorrelationConfidence: value.confidence,
    moCorrelationPublicMailRefs: JSON.stringify(value.publicMailRefs),
    moCorrelationSendIds: JSON.stringify(value.sendIds),
    moCorrelationOutboundMessageIds: JSON.stringify(value.outboundMessageIds),
    moCorrelationOutboundThreadRefs: JSON.stringify(value.outboundThreadRefs),
    moCorrelationSourceFields: JSON.stringify(value.sourceFields),
    moCorrelationAuthority: 'NO_AUTHORITY'
  };
  if (value.outboundThreadRef) metadata.moCorrelationOutboundThreadRef = value.outboundThreadRef;
  if (value.reviewReason) metadata.moCorrelationReviewReason = value.reviewReason;
  return Object.freeze(metadata);
}

function reservedCorrelationMetadata(
  metadata: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> {
  if (!metadata) return Object.freeze({});
  return Object.freeze(
    Object.fromEntries(
      Object.entries(metadata).filter(([key]) => key.startsWith(RESERVED_METADATA_PREFIX))
    )
  );
}

export function managedCommunicationInboundEvidenceMetadataV1(input: {
  providerMetadata?: Readonly<Record<string, string>>;
  existingMetadata?: Readonly<Record<string, string>>;
  correlation?: Readonly<ManagedCommunicationInboundCorrelationV1>;
}): Readonly<Record<string, string>> {
  const providerMetadata = input.providerMetadata ?? {};
  const reservedProviderKey = Object.keys(providerMetadata).find((key) =>
    key.startsWith(RESERVED_METADATA_PREFIX)
  );
  if (reservedProviderKey) {
    throw new TypeError(
      `Provider metadata must not write Managed Communication owner key ${reservedProviderKey}.`
    );
  }
  const ownerMetadata =
    input.existingMetadata === undefined
      ? input.correlation === undefined
        ? Object.freeze({})
        : correlationMetadata(input.correlation)
      : reservedCorrelationMetadata(input.existingMetadata);

  return Object.freeze({
    ...providerMetadata,
    ...ownerMetadata
  });
}
