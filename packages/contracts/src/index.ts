export type MarkOrbitId = `${string}_${string}`;

export const products = ['LITE', 'MARKREG_COM', 'OPERATIONS'] as const;
export type Product = (typeof products)[number];

export const channels = [
  'LITE_PROFESSIONAL',
  'MARKREG_DIRECT',
  'MARKREG_PARTNER_REFERRAL',
  'MARKREG_WHITE_LABEL',
  'INTERNAL_OPERATIONS'
] as const;
export type Channel = (typeof channels)[number];

export const relationshipModels = [
  'DIRECT',
  'CO_DELIVERY',
  'WHITE_LABEL',
  'REFERRAL',
  'PLATFORM_ASSISTED'
] as const;
export type RelationshipModel = (typeof relationshipModels)[number];

export interface ActorContext {
  actorId: MarkOrbitId;
  workplaceId: MarkOrbitId;
  product: Product;
  purpose: string;
}

export interface EventEnvelope<TType extends string, TPayload> {
  eventId: MarkOrbitId;
  eventType: TType;
  occurredAt: string;
  correlationId: MarkOrbitId;
  causationId?: MarkOrbitId;
  actor: ActorContext;
  payload: TPayload;
  schemaVersion: 1;
}

export interface SafeError {
  code: string;
  message: string;
  correlationId: MarkOrbitId;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export function isMarkOrbitId(value: unknown): value is MarkOrbitId {
  return typeof value === 'string' && /^[a-z][a-z0-9-]*_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value);
}

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (channels as readonly string[]).includes(value);
}

export function isRelationshipModel(value: unknown): value is RelationshipModel {
  return typeof value === 'string' && (relationshipModels as readonly string[]).includes(value);
}

export function parseChannel(value: unknown): Channel {
  if (!isChannel(value)) throw new TypeError('Invalid MarkOrbit channel.');
  return value;
}

export function parseRelationshipModel(value: unknown): RelationshipModel {
  if (!isRelationshipModel(value)) throw new TypeError('Invalid MarkOrbit relationship model.');
  return value;
}
