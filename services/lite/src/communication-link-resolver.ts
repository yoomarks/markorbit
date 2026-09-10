import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
import type { ProductLoopExactReference } from '@markorbit/contracts/product-loop';
import type {
  TrademarkAsset,
  TrademarkAssetExternalIdentifier,
  TrademarkAssetId,
  TrademarkAssetIdentifierKind
} from '@markorbit/contracts/trademark-asset-workspace';

export const COMMUNICATION_LINK_MAX_ASSET_CONTEXT = 1_000;
export const COMMUNICATION_LINK_MESSAGE_LIMITS = Object.freeze({
  subject: 2_000,
  textBody: 64_000,
  htmlBody: 64_000
});

const MAX_IDENTIFIER_LENGTH = 200;
const SAFE_SEPARATOR = '[\\s\\-./#()_:]{0,3}';

export const communicationLinkUnsupportedMatching = [
  'MARK_TEXT',
  'PARTICIPANT_ONLY',
  'AI_SEMANTIC'
] as const;
export type CommunicationLinkUnsupportedMatching =
  (typeof communicationLinkUnsupportedMatching)[number];

export type CommunicationLinkResolutionState = 'MATCH_CANDIDATE' | 'AMBIGUOUS' | 'UNRESOLVED';
export type CommunicationLinkResolutionMethod = 'EXACT_IDENTIFIER' | 'CONFIRMED_THREAD_INHERITANCE';
export type CommunicationLinkConfidenceClass = 'DETERMINISTIC_EXACT' | 'CONFIRMED_CONTEXT';
export type CommunicationLinkEvidenceField = 'SUBJECT' | 'TEXT_BODY' | 'HTML_DERIVED_TEXT';

export interface CommunicationLinkMessageReference {
  accountRef: string;
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  observedAt: string;
}

export interface CommunicationLinkMatchedIdentifier {
  kind: TrademarkAssetIdentifierKind;
  jurisdiction: string;
  value: string;
}

export interface CommunicationLinkExactCandidate {
  target: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  message: Readonly<CommunicationLinkMessageReference>;
  method: 'EXACT_IDENTIFIER';
  confidence: 'DETERMINISTIC_EXACT';
  matchedIdentifier: Readonly<CommunicationLinkMatchedIdentifier>;
  evidenceField: CommunicationLinkEvidenceField;
  explanation: string;
}

export interface CommunicationLinkThreadCandidate {
  target: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  message: Readonly<CommunicationLinkMessageReference>;
  method: 'CONFIRMED_THREAD_INHERITANCE';
  confidence: 'CONFIRMED_CONTEXT';
  inheritedAssociationReference: string;
  explanation: string;
}

export type CommunicationLinkCandidate =
  CommunicationLinkExactCandidate | CommunicationLinkThreadCandidate;

export type CommunicationLinkThreadAssociationStatus = 'CONFIRMED' | 'SUGGESTED' | 'REJECTED';
export type CommunicationLinkThreadConfirmationAuthority =
  'HUMAN' | 'DETERMINISTIC' | 'AI_SUGGESTION';

export interface CommunicationLinkThreadAssociationEvidence {
  associationReference: string;
  workspaceId: string;
  accountRef: string;
  threadRef: string;
  status: CommunicationLinkThreadAssociationStatus;
  confirmationAuthority: CommunicationLinkThreadConfirmationAuthority;
  target: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
}

export interface CommunicationLinkAssetContext {
  assets: ReadonlyArray<Readonly<TrademarkAsset>>;
  completeForExactResolution: boolean;
}

export interface CommunicationLinkAssetContextReader {
  read(input: {
    workspaceId: string;
    limit: number;
  }): Promise<Readonly<CommunicationLinkAssetContext>>;
}

export interface CommunicationLinkThreadAssociationLookup {
  lookup(input: {
    workspaceId: string;
    accountRef: string;
    threadRef: string;
  }): Promise<ReadonlyArray<Readonly<CommunicationLinkThreadAssociationEvidence>>>;
}

export interface CommunicationLinkResolutionAuthority {
  assetMutated: false;
  customerMutated: false;
  matterMutated: false;
  productionIntakeMutated: false;
  managedCommunicationMutated: false;
  workCreated: false;
  todayMutated: false;
  officialTruthCreated: false;
  legalDeadlineCertified: false;
  legalConclusionCreated: false;
}

export const communicationLinkNoAuthority = Object.freeze({
  assetMutated: false,
  customerMutated: false,
  matterMutated: false,
  productionIntakeMutated: false,
  managedCommunicationMutated: false,
  workCreated: false,
  todayMutated: false,
  officialTruthCreated: false,
  legalDeadlineCertified: false,
  legalConclusionCreated: false
}) satisfies Readonly<CommunicationLinkResolutionAuthority>;

export interface CommunicationLinkBoundedMaterial {
  subjectChars: number;
  textBodyChars: number;
  htmlBodyChars: number;
}

export interface CommunicationLinkResolutionResult {
  schemaVersion: 1;
  workspaceId: string;
  message: Readonly<CommunicationLinkMessageReference>;
  state: CommunicationLinkResolutionState;
  candidates: ReadonlyArray<Readonly<CommunicationLinkCandidate>>;
  reviewRequired: boolean;
  boundedMaterial: Readonly<CommunicationLinkBoundedMaterial>;
  unsupportedMatching: readonly CommunicationLinkUnsupportedMatching[];
  authority: Readonly<CommunicationLinkResolutionAuthority>;
}

export class CommunicationLinkResolverError extends Error {
  constructor(
    readonly code: 'INVALID_INPUT' | 'ASSET_CONTEXT_LIMIT_EXCEEDED' | 'ASSET_CONTEXT_INCOMPLETE',
    message: string
  ) {
    super(message);
    this.name = 'CommunicationLinkResolverError';
  }
}

interface SearchMaterial {
  field: CommunicationLinkEvidenceField;
  text: string;
}

function bounded(value: string | undefined, max: number): string {
  return value === undefined ? '' : value.slice(0, max);
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&(?:nbsp|ensp|emsp);/giu, ' ')
    .replace(/&(?:amp);/giu, '&')
    .replace(/&(?:lt);/giu, '<')
    .replace(/&(?:gt);/giu, '>')
    .replace(/&(?:quot);/giu, '"')
    .replace(/&#39;/gu, "'");
}

function messageReference(
  message: Readonly<ManagedCommunicationMessageV1>
): CommunicationLinkMessageReference {
  return {
    accountRef: message.accountRef,
    messageId: message.messageId,
    threadRef: message.threadRef,
    provider: message.providerObservation.provider,
    providerMessageId: message.providerObservation.providerMessageId,
    observedAt: message.providerObservation.observedAt
  };
}

function searchMaterial(message: Readonly<ManagedCommunicationMessageV1>): {
  material: SearchMaterial[];
  boundedMaterial: CommunicationLinkBoundedMaterial;
} {
  const subject = bounded(message.subject, COMMUNICATION_LINK_MESSAGE_LIMITS.subject);
  const textBody = bounded(message.textBody, COMMUNICATION_LINK_MESSAGE_LIMITS.textBody);
  const boundedHtml = bounded(message.htmlBody, COMMUNICATION_LINK_MESSAGE_LIMITS.htmlBody);
  const htmlText = htmlToText(boundedHtml);
  const material: SearchMaterial[] = [];
  if (subject) material.push({ field: 'SUBJECT', text: subject });
  if (textBody) material.push({ field: 'TEXT_BODY', text: textBody });
  if (htmlText) material.push({ field: 'HTML_DERIVED_TEXT', text: htmlText });
  return {
    material,
    boundedMaterial: {
      subjectChars: subject.length,
      textBodyChars: textBody.length,
      htmlBodyChars: boundedHtml.length
    }
  };
}

function normalizedIdentifier(value: string): string | undefined {
  const normalized = value.normalize('NFKC').trim().toUpperCase();
  const compact = normalized.replace(/[\s\-./#()_:]+/gu, '');
  if (!compact || compact.length > MAX_IDENTIFIER_LENGTH || !/^[A-Z0-9]+$/u.test(compact)) {
    return undefined;
  }
  return compact;
}

function exactPattern(value: string): RegExp | undefined {
  const compact = normalizedIdentifier(value);
  if (!compact) return undefined;
  const pattern = [...compact].join(SAFE_SEPARATOR);
  return new RegExp(`(?<![A-Z0-9])${pattern}(?![A-Z0-9])`, 'iu');
}

function fieldMatches(
  text: string,
  identifier: Readonly<TrademarkAssetExternalIdentifier>
): boolean {
  const pattern = exactPattern(identifier.value);
  return pattern === undefined ? false : pattern.test(text.normalize('NFKC'));
}

function exactCandidates(
  workspaceId: string,
  assets: ReadonlyArray<Readonly<TrademarkAsset>>,
  material: readonly SearchMaterial[],
  message: Readonly<CommunicationLinkMessageReference>
): CommunicationLinkExactCandidate[] {
  const candidates: CommunicationLinkExactCandidate[] = [];
  const seen = new Set<string>();
  for (const asset of assets) {
    if (asset.workspaceId !== workspaceId) continue;
    for (const identifier of asset.externalIdentifiers) {
      const normalized = normalizedIdentifier(identifier.value);
      if (!normalized) continue;
      for (const source of material) {
        if (!fieldMatches(source.text, identifier)) continue;
        const key = `${asset.trademarkAssetId}|${identifier.kind}|${identifier.jurisdiction}|${normalized}|${source.field}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          target: { id: asset.trademarkAssetId, version: asset.version },
          message,
          method: 'EXACT_IDENTIFIER',
          confidence: 'DETERMINISTIC_EXACT',
          matchedIdentifier: {
            kind: identifier.kind,
            jurisdiction: identifier.jurisdiction,
            value: identifier.value
          },
          evidenceField: source.field,
          explanation: `Exact ${identifier.kind} evidence was found in ${source.field}.`
        });
      }
    }
  }
  return candidates;
}

function distinctTargets(candidates: readonly Readonly<CommunicationLinkCandidate>[]): Set<string> {
  return new Set(candidates.map((candidate) => candidate.target.id));
}

function result(
  workspaceId: string,
  message: CommunicationLinkMessageReference,
  boundedMaterial: CommunicationLinkBoundedMaterial,
  candidates: readonly Readonly<CommunicationLinkCandidate>[]
): CommunicationLinkResolutionResult {
  const targetCount = distinctTargets(candidates).size;
  const state: CommunicationLinkResolutionState =
    targetCount === 0 ? 'UNRESOLVED' : targetCount === 1 ? 'MATCH_CANDIDATE' : 'AMBIGUOUS';
  return {
    schemaVersion: 1,
    workspaceId,
    message,
    state,
    candidates,
    reviewRequired: state !== 'UNRESOLVED',
    boundedMaterial,
    unsupportedMatching: communicationLinkUnsupportedMatching,
    authority: communicationLinkNoAuthority
  };
}

function confirmedThreadCandidates(
  workspaceId: string,
  message: Readonly<CommunicationLinkMessageReference>,
  associations: ReadonlyArray<Readonly<CommunicationLinkThreadAssociationEvidence>>
): CommunicationLinkThreadCandidate[] {
  const candidates: CommunicationLinkThreadCandidate[] = [];
  const seen = new Set<string>();
  for (const association of associations) {
    const eligible =
      association.workspaceId === workspaceId &&
      association.accountRef === message.accountRef &&
      association.threadRef === message.threadRef &&
      association.status === 'CONFIRMED' &&
      association.confirmationAuthority !== 'AI_SUGGESTION';
    if (!eligible || seen.has(association.target.id)) continue;
    seen.add(association.target.id);
    candidates.push({
      target: association.target,
      message,
      method: 'CONFIRMED_THREAD_INHERITANCE',
      confidence: 'CONFIRMED_CONTEXT',
      inheritedAssociationReference: association.associationReference,
      explanation: 'A prior confirmed association in the same account thread supports inheritance.'
    });
  }
  return candidates;
}

export class CommunicationLinkCandidateResolver {
  constructor(
    private readonly assets: CommunicationLinkAssetContextReader,
    private readonly threads: CommunicationLinkThreadAssociationLookup
  ) {}

  async resolve(input: {
    workspaceId: string;
    message: Readonly<ManagedCommunicationMessageV1>;
  }): Promise<CommunicationLinkResolutionResult> {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
      throw new CommunicationLinkResolverError('INVALID_INPUT', 'workspaceId must be non-empty.');
    }
    const reference = messageReference(input.message);
    const searched = searchMaterial(input.message);
    const assetContext = await this.assets.read({
      workspaceId,
      limit: COMMUNICATION_LINK_MAX_ASSET_CONTEXT
    });
    if (assetContext.assets.length > COMMUNICATION_LINK_MAX_ASSET_CONTEXT) {
      throw new CommunicationLinkResolverError(
        'ASSET_CONTEXT_LIMIT_EXCEEDED',
        `asset context must contain at most ${COMMUNICATION_LINK_MAX_ASSET_CONTEXT} assets.`
      );
    }

    if (!assetContext.completeForExactResolution) {
      throw new CommunicationLinkResolverError(
        'ASSET_CONTEXT_INCOMPLETE',
        'asset context must be complete for deterministic exact resolution.'
      );
    }

    const exact = exactCandidates(workspaceId, assetContext.assets, searched.material, reference);
    if (exact.length > 0) {
      return result(workspaceId, reference, searched.boundedMaterial, exact);
    }

    const associations = await this.threads.lookup({
      workspaceId,
      accountRef: reference.accountRef,
      threadRef: reference.threadRef
    });
    const inherited = confirmedThreadCandidates(workspaceId, reference, associations);
    return result(workspaceId, reference, searched.boundedMaterial, inherited);
  }
}
