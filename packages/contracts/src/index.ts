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
export interface CustomerIntent {
  brandName: string;
  applicantCountry: string;
  targetJurisdictions: string[];
  goodsServicesDescription: string;
}
export interface IntakeCreateCommand {
  channel: Channel;
  relationshipModel: RelationshipModel;
  customerIntent: CustomerIntent;
  actor: ActorContext;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}
export interface Intake {
  intakeId: MarkOrbitId;
  channel: Channel;
  relationshipModel: RelationshipModel;
  status: 'RECEIVED' | 'RECOMMENDATION_READY' | 'FAILED';
  customerIntent: CustomerIntent;
  createdAt: string;
  correlationId: MarkOrbitId;
}
export interface CapabilityRequest {
  capabilityRequestId: MarkOrbitId;
  capabilityId: 'trademark-application-recommendation';
  capabilityVersion: '0.1.0-fixture';
  inputRef: MarkOrbitId;
  status: 'ACCEPTED';
  correlationId: MarkOrbitId;
  createdAt: string;
}
export interface CapabilityRequestCommand {
  inputRef: MarkOrbitId;
  actor: ActorContext;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}
export interface ExecutionRecord {
  executionId: MarkOrbitId;
  capabilityRequestId: MarkOrbitId;
  executionType: 'CAPABILITY_INVOCATION';
  status: 'RECORDED';
  correlationId: MarkOrbitId;
  createdAt: string;
}
export interface ExecutionCreateCommand {
  capabilityRequestId: MarkOrbitId;
  actor: ActorContext;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}
export interface RecommendationOption {
  tier: 'A' | 'B' | 'C';
  name: 'Essential Protection' | 'Recommended Protection' | 'Extended Protection';
  description: string;
}
export interface RecommendationPackage {
  recommendationId: MarkOrbitId;
  intakeId: MarkOrbitId;
  status: 'FIXTURE_ONLY';
  options: [RecommendationOption, RecommendationOption, RecommendationOption];
  rationale: string;
  assumptions: string[];
  limitations: string[];
  provenance: MarkOrbitId[];
  generatedAt: string;
}
export interface IntakeRecommendationResponse {
  intake: Intake;
  recommendation: RecommendationPackage;
  trace: {
    correlationId: MarkOrbitId;
    capabilityRequestId: MarkOrbitId;
    executionId: MarkOrbitId;
    provenanceRefs: MarkOrbitId[];
  };
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
}

export class ContractValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ContractValidationError';
  }
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
  if (!isChannel(value)) throw new ContractValidationError('Invalid channel.');
  return value;
}
export function parseRelationshipModel(value: unknown): RelationshipModel {
  if (!isRelationshipModel(value)) throw new ContractValidationError('Invalid relationship model.');
  return value;
}
function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ContractValidationError(`${name} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new ContractValidationError(`${name} must be a non-empty string.`);
  return value;
}
function id(value: unknown, name: string): MarkOrbitId {
  if (!isMarkOrbitId(value))
    throw new ContractValidationError(`${name} must be a MarkOrbit identifier.`);
  return value;
}
function country(value: unknown, name: string): string {
  const result = text(value, name);
  if (!/^[A-Z]{2}$/.test(result))
    throw new ContractValidationError(`${name} must be an ISO 3166-1 alpha-2 code.`);
  return result;
}
export function parseActorContext(value: unknown): ActorContext {
  const v = object(value, 'actor');
  const product = v.product;
  if (typeof product !== 'string' || !(products as readonly string[]).includes(product))
    throw new ContractValidationError('actor.product is invalid.');
  return {
    actorId: id(v.actorId, 'actor.actorId'),
    workplaceId: id(v.workplaceId, 'actor.workplaceId'),
    product: product as Product,
    purpose: text(v.purpose, 'actor.purpose')
  };
}
export function parseCustomerIntent(value: unknown): CustomerIntent {
  const v = object(value, 'customerIntent');
  if (!Array.isArray(v.targetJurisdictions) || v.targetJurisdictions.length === 0)
    throw new ContractValidationError('customerIntent.targetJurisdictions must be non-empty.');
  return {
    brandName: text(v.brandName, 'customerIntent.brandName'),
    applicantCountry: country(v.applicantCountry, 'customerIntent.applicantCountry'),
    targetJurisdictions: v.targetJurisdictions.map((item) => country(item, 'target jurisdiction')),
    goodsServicesDescription: text(
      v.goodsServicesDescription,
      'customerIntent.goodsServicesDescription'
    )
  };
}
export function parseIntakeCreateCommand(value: unknown): IntakeCreateCommand {
  const v = object(value, 'command');
  return {
    channel: parseChannel(v.channel),
    relationshipModel: parseRelationshipModel(v.relationshipModel),
    customerIntent: parseCustomerIntent(v.customerIntent),
    actor: parseActorContext(v.actor),
    idempotencyKey: text(v.idempotencyKey, 'idempotencyKey'),
    correlationId: id(v.correlationId, 'correlationId')
  };
}
export function parseCapabilityRequestCommand(value: unknown): CapabilityRequestCommand {
  const v = object(value, 'command');
  return {
    inputRef: id(v.inputRef, 'inputRef'),
    actor: parseActorContext(v.actor),
    idempotencyKey: text(v.idempotencyKey, 'idempotencyKey'),
    correlationId: id(v.correlationId, 'correlationId')
  };
}
export function parseExecutionCreateCommand(value: unknown): ExecutionCreateCommand {
  const v = object(value, 'command');
  return {
    capabilityRequestId: id(v.capabilityRequestId, 'capabilityRequestId'),
    actor: parseActorContext(v.actor),
    idempotencyKey: text(v.idempotencyKey, 'idempotencyKey'),
    correlationId: id(v.correlationId, 'correlationId')
  };
}
export function assertDirectIntake(command: IntakeCreateCommand): void {
  if (command.channel !== 'MARKREG_DIRECT' || command.relationshipModel !== 'DIRECT')
    throw new ContractValidationError(
      'Only MARKREG_DIRECT with DIRECT is supported by this endpoint.'
    );
}
export function parseRecommendationPackage(value: unknown): RecommendationPackage {
  const v = object(value, 'recommendation');
  if (v.status !== 'FIXTURE_ONLY')
    throw new ContractValidationError('recommendation.status must be FIXTURE_ONLY.');
  if (!Array.isArray(v.options) || v.options.length !== 3)
    throw new ContractValidationError('recommendation.options must contain A/B/C.');
  const tiers = v.options.map((option) => object(option, 'option').tier).join('');
  if (tiers !== 'ABC')
    throw new ContractValidationError('recommendation.options must be ordered A/B/C.');
  return value as RecommendationPackage;
}
