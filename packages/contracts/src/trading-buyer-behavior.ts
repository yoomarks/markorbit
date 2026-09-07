import type { TrademarkAssetId } from './trademark-asset-workspace.js';

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
    authorityConsequences: parseAuthority(event.authorityConsequences)
  };
}
