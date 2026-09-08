import type { TrademarkAssetId } from './trademark-asset-workspace.js';
import type {
  TradingBuyingPointId,
  TradingCommercialAssumptionId,
  TradingCommercialEvidenceId,
  TradingCommercialPersonaId,
  TradingCommercialScenarioId,
  TradingSellingPointId
} from './trading-ai-profile.js';

export type BuyerBehaviorEventId = `buyer-behavior_${string}`;

export const buyerBehaviorEventTypes = [
  'IMPRESSION',
  'CLICK',
  'DETAIL_VIEW',
  'DWELL',
  'FAVORITE',
  'SHARE',
  'INQUIRY_CREATED',
  'OFFER_CREATED',
  'TRANSACTION_STARTED',
  'TRANSACTION_COMPLETED',
  'REPEAT_VISIT'
] as const;
export type BuyerBehaviorEventType = (typeof buyerBehaviorEventTypes)[number];

export const buyerBehaviorSurfaces = [
  'MARKETPLACE_CARD',
  'MARKETPLACE_DETAIL',
  'SEARCH_RESULTS',
  'SHARE_LINK',
  'OTHER'
] as const;
export type BuyerBehaviorSurface = (typeof buyerBehaviorSurfaces)[number];

export const buyerBehaviorOpportunitySections = [
  'BEST_FOR',
  'SELLING_POINTS',
  'BUYING_POINTS',
  'LAUNCH_SCENARIOS',
  'WHY_MO_THINKS_THIS'
] as const;
export type BuyerBehaviorOpportunitySection = (typeof buyerBehaviorOpportunitySections)[number];

export type BuyerBehaviorCommercialInsightReferenceV1 =
  | Readonly<{ kind: 'PERSONA'; id: TradingCommercialPersonaId }>
  | Readonly<{ kind: 'SELLING_POINT'; id: TradingSellingPointId }>
  | Readonly<{ kind: 'BUYING_POINT'; id: TradingBuyingPointId }>
  | Readonly<{ kind: 'SCENARIO'; id: TradingCommercialScenarioId }>
  | Readonly<{ kind: 'EVIDENCE'; id: TradingCommercialEvidenceId }>
  | Readonly<{ kind: 'ASSUMPTION'; id: TradingCommercialAssumptionId }>;

/** Public-safe context only: stable Commercial Value Map IDs, never prompts or asset content. */
export interface BuyerBehaviorOpportunityContextV1 {
  section: BuyerBehaviorOpportunitySection;
  insightReferences: readonly BuyerBehaviorCommercialInsightReferenceV1[];
}

export type BuyerBehaviorSubjectV1 =
  | Readonly<{ kind: 'ANONYMOUS'; sessionId: string }>
  | Readonly<{ kind: 'AUTHENTICATED'; sessionId: string; userId: string }>;

export interface BuyerBehaviorListingReferenceV1 {
  listingId: string;
  listingVersion: number;
  trademarkAssetId: TrademarkAssetId;
}

export const noBuyerBehaviorAuthorityConsequencesV1 = Object.freeze({
  listingPublished: false,
  inquiryCreated: false,
  offerCreated: false,
  offerAccepted: false,
  transactionCreated: false,
  transactionCompleted: false,
  paymentConfirmed: false,
  transferRecorded: false,
  pricingConclusionCreated: false
});
export type BuyerBehaviorAuthorityConsequencesV1 = typeof noBuyerBehaviorAuthorityConsequencesV1;

/**
 * An observation of buyer activity, never the command or authority that creates the observed
 * Listing, Inquiry, Offer or Transaction state. Consequential events point to the canonical
 * owner record that already established the state.
 */
export interface BuyerBehaviorEventV1 {
  schemaVersion: 1;
  buyerBehaviorEventId: BuyerBehaviorEventId;
  eventType: BuyerBehaviorEventType;
  listing: Readonly<BuyerBehaviorListingReferenceV1>;
  subject: BuyerBehaviorSubjectV1;
  surface: BuyerBehaviorSurface;
  occurredAt: string;
  correlationId: string;
  canonicalActionReference?: string;
  dwellDurationMs?: number;
  opportunityContext?: Readonly<BuyerBehaviorOpportunityContextV1>;
  authorityConsequences: BuyerBehaviorAuthorityConsequencesV1;
}

export class BuyerBehaviorContractValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'BuyerBehaviorContractValidationError';
  }
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BuyerBehaviorContractValidationError(`${field} must be an object.`);
  return value as JsonRecord;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new BuyerBehaviorContractValidationError(`${field} must be a non-empty string.`);
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new BuyerBehaviorContractValidationError(`${field} must be a positive integer.`);
  return Number(value);
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== 'string' || !allowed.some((item) => item === value))
    throw new BuyerBehaviorContractValidationError(`${field} is invalid.`);
  return value;
}

function parseSubject(value: unknown): BuyerBehaviorSubjectV1 {
  const subject = record(value, 'buyerBehavior.subject');
  const kind = oneOf(
    subject.kind,
    ['ANONYMOUS', 'AUTHENTICATED'] as const,
    'buyerBehavior.subject.kind'
  );
  const sessionId = text(subject.sessionId, 'buyerBehavior.subject.sessionId');
  if (kind === 'ANONYMOUS') {
    if (subject.userId !== undefined)
      throw new BuyerBehaviorContractValidationError(
        'Anonymous buyer behavior cannot include a userId.'
      );
    return { kind, sessionId };
  }
  return {
    kind,
    sessionId,
    userId: text(subject.userId, 'buyerBehavior.subject.userId')
  };
}

function parseAuthority(value: unknown): BuyerBehaviorAuthorityConsequencesV1 {
  const authority = record(value, 'buyerBehavior.authorityConsequences');
  for (const key of Object.keys(noBuyerBehaviorAuthorityConsequencesV1) as Array<
    keyof BuyerBehaviorAuthorityConsequencesV1
  >) {
    if (authority[key] !== false)
      throw new BuyerBehaviorContractValidationError(
        `buyerBehavior.authorityConsequences.${key} must be false.`
      );
  }
  return noBuyerBehaviorAuthorityConsequencesV1;
}

const canonicalActionEventTypes = new Set<BuyerBehaviorEventType>([
  'FAVORITE',
  'INQUIRY_CREATED',
  'OFFER_CREATED',
  'TRANSACTION_STARTED',
  'TRANSACTION_COMPLETED'
]);

const commercialInsightPrefixes = {
  PERSONA: 'trading-commercial-persona_',
  SELLING_POINT: 'trading-selling-point_',
  BUYING_POINT: 'trading-buying-point_',
  SCENARIO: 'trading-commercial-scenario_',
  EVIDENCE: 'trading-commercial-evidence_',
  ASSUMPTION: 'trading-commercial-assumption_'
} as const;

function parseOpportunityContext(value: unknown): BuyerBehaviorOpportunityContextV1 {
  const context = record(value, 'buyerBehavior.opportunityContext');
  const section = oneOf(
    context.section,
    buyerBehaviorOpportunitySections,
    'buyerBehavior.opportunityContext.section'
  );
  if (!Array.isArray(context.insightReferences) || context.insightReferences.length === 0)
    throw new BuyerBehaviorContractValidationError(
      'buyerBehavior.opportunityContext.insightReferences must contain stable insight references.'
    );
  const seen = new Set<string>();
  const insightReferences = context.insightReferences.map((value, index) => {
    const reference = record(value, `buyerBehavior.opportunityContext.insightReferences[${index}]`);
    const kind = oneOf(
      reference.kind,
      Object.keys(commercialInsightPrefixes),
      `buyerBehavior.opportunityContext.insightReferences[${index}].kind`
    ) as keyof typeof commercialInsightPrefixes;
    const id = text(
      reference.id,
      `buyerBehavior.opportunityContext.insightReferences[${index}].id`
    );
    if (!id.startsWith(commercialInsightPrefixes[kind]))
      throw new BuyerBehaviorContractValidationError(
        `buyerBehavior.opportunityContext.insightReferences[${index}].id is invalid.`
      );
    const key = `${kind}:${id}`;
    if (seen.has(key))
      throw new BuyerBehaviorContractValidationError(
        'buyerBehavior.opportunityContext.insightReferences must be distinct.'
      );
    seen.add(key);
    return { kind, id } as BuyerBehaviorCommercialInsightReferenceV1;
  });
  return { section, insightReferences };
}

export function parseBuyerBehaviorEventV1(value: unknown): BuyerBehaviorEventV1 {
  const event = record(value, 'buyerBehavior');
  if (event.schemaVersion !== 1)
    throw new BuyerBehaviorContractValidationError('buyerBehavior.schemaVersion must be 1.');
  const eventType = oneOf(event.eventType, buyerBehaviorEventTypes, 'buyerBehavior.eventType');
  const eventId = text(event.buyerBehaviorEventId, 'buyerBehavior.buyerBehaviorEventId');
  if (!/^buyer-behavior_[A-Za-z0-9_-]+$/u.test(eventId))
    throw new BuyerBehaviorContractValidationError(
      'buyerBehavior.buyerBehaviorEventId must be a Buyer Behavior event id.'
    );
  const listing = record(event.listing, 'buyerBehavior.listing');
  const canonicalActionReference =
    event.canonicalActionReference === undefined
      ? undefined
      : text(event.canonicalActionReference, 'buyerBehavior.canonicalActionReference');
  if (canonicalActionEventTypes.has(eventType) !== (canonicalActionReference !== undefined))
    throw new BuyerBehaviorContractValidationError(
      'Stateful buyer behavior requires its canonical owner action reference.'
    );
  const dwellDurationMs =
    event.dwellDurationMs === undefined
      ? undefined
      : positiveInteger(event.dwellDurationMs, 'buyerBehavior.dwellDurationMs');
  const opportunityContext =
    event.opportunityContext === undefined
      ? undefined
      : parseOpportunityContext(event.opportunityContext);
  if ((eventType === 'DWELL') !== (dwellDurationMs !== undefined))
    throw new BuyerBehaviorContractValidationError(
      'dwellDurationMs is required only for DWELL events.'
    );
  const occurredAt = text(event.occurredAt, 'buyerBehavior.occurredAt');
  if (Number.isNaN(Date.parse(occurredAt)))
    throw new BuyerBehaviorContractValidationError(
      'buyerBehavior.occurredAt must be an ISO timestamp.'
    );
  return {
    schemaVersion: 1,
    buyerBehaviorEventId: eventId as BuyerBehaviorEventId,
    eventType,
    listing: {
      listingId: text(listing.listingId, 'buyerBehavior.listing.listingId'),
      listingVersion: positiveInteger(
        listing.listingVersion,
        'buyerBehavior.listing.listingVersion'
      ),
      trademarkAssetId: text(
        listing.trademarkAssetId,
        'buyerBehavior.listing.trademarkAssetId'
      ) as TrademarkAssetId
    },
    subject: parseSubject(event.subject),
    surface: oneOf(event.surface, buyerBehaviorSurfaces, 'buyerBehavior.surface'),
    occurredAt,
    correlationId: text(event.correlationId, 'buyerBehavior.correlationId'),
    ...(canonicalActionReference === undefined ? {} : { canonicalActionReference }),
    ...(dwellDurationMs === undefined ? {} : { dwellDurationMs }),
    ...(opportunityContext === undefined ? {} : { opportunityContext }),
    authorityConsequences: parseAuthority(event.authorityConsequences)
  };
}
