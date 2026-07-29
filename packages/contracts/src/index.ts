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

/** Monetary values are always integral minor units; never JavaScript decimal amounts. */
export interface Money {
  amountMinor: number;
  currency: string;
}
export type PlanOptionCode = 'A' | 'B' | 'C';
export interface QuoteLine {
  code: string;
  description: string;
  category: 'OFFICIAL_FEE' | 'SERVICE_FEE' | 'DISBURSEMENT' | 'TAX';
  amount: Money;
}
export interface QuoteAssumption {
  code: string;
  text: string;
}
export interface PlanSelectionCommand {
  intakeId: MarkOrbitId;
  recommendationId: MarkOrbitId;
  selectedOptionCode: PlanOptionCode;
  actor: ActorContext;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}
export interface PlanSelection {
  planSelectionId: MarkOrbitId;
  intakeId: MarkOrbitId;
  recommendationId: MarkOrbitId;
  selectedOptionCode: PlanOptionCode;
  selectedAt: string;
}
export type QuoteCreateCommand = PlanSelectionCommand;
export const quoteStatuses = ['DRAFT', 'READY', 'CONFIRMED', 'EXPIRED', 'SUPERSEDED'] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];
export interface Quote {
  quoteId: MarkOrbitId;
  intakeId: MarkOrbitId;
  recommendationId: MarkOrbitId;
  selectedOptionCode: PlanOptionCode;
  pricingRuleVersion: string;
  status: QuoteStatus;
  currency: string;
  lines: QuoteLine[];
  subtotal: Money;
  estimatedOfficialFees: Money;
  estimatedServiceFees: Money;
  estimatedDisbursements: Money;
  estimatedTaxes: Money;
  total: Money;
  assumptions: QuoteAssumption[];
  limitations: string[];
  validUntil: string;
  fixtureOnly: true;
  createdAt: string;
}
export interface QuoteConfirmationCommand {
  quoteId: MarkOrbitId;
  actor: ActorContext;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}
export interface QuoteConfirmation {
  quoteId: MarkOrbitId;
  status: 'CONFIRMED';
  confirmedAt: string;
  pendingProfessionalReview: true;
  orderCreated: false;
  paymentMade: false;
  filingStarted: false;
}
export interface PlanQuoteResponse {
  planSelection: PlanSelection;
  quote: Quote;
}

/** Version 1 contracts for the commercial-confirmation to preparation boundary. */
export type CustomerConfirmationId = `confirmation_${string}`;
export type MatterDraftId = `matter-draft_${string}`;
export const customerConfirmationStatuses = ['DRAFT', 'CONFIRMED', 'WITHDRAWN'] as const;
export type CustomerConfirmationStatus = (typeof customerConfirmationStatuses)[number];
export const matterDraftStatuses = [
  'DRAFT',
  'NEEDS_INFORMATION',
  'READY_FOR_PROFESSIONAL_REVIEW',
  'WITHDRAWN'
] as const;
export type MatterDraftStatus = (typeof matterDraftStatuses)[number];
export type ReadinessCheckStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';
export type MatterReadinessCheckCode =
  | 'CUSTOMER_CONFIRMATION_VALID'
  | 'APPLICANT_IDENTITY_PRESENT'
  | 'APPLICANT_ADDRESS_PRESENT'
  | 'MARK_REPRESENTATION_PRESENT'
  | 'JURISDICTION_SELECTED'
  | 'CLASS_SELECTION_PRESENT'
  | 'GOODS_SERVICES_PRESENT'
  | 'FILING_BASIS_PRESENT_OR_NOT_REQUIRED'
  | 'REPRESENTATIVE_REQUIREMENT_EVALUATED'
  | 'REQUIRED_DOCUMENTS_PRESENT'
  | 'COMMERCIAL_SCOPE_UNCHANGED';
export interface ConfirmationAcknowledgement {
  code:
    'NO_FILING' | 'NO_PROFESSIONAL_APPOINTMENT' | 'REVIEW_MAY_BE_REQUIRED' | 'SCOPE_CHANGE_REQUOTE';
  acknowledged: true;
  acknowledgedAt: string;
}
export interface QuoteSnapshotReference {
  quoteId: MarkOrbitId;
  quoteVersion: string;
  planId: MarkOrbitId;
  planVersion: string;
  currency: string;
  totalMinor: number;
  lineItems: ReadonlyArray<Readonly<QuoteLine>>;
}
export interface CustomerConfirmation {
  schemaVersion: 1;
  confirmationId: CustomerConfirmationId;
  customerId: MarkOrbitId;
  quoteSnapshot: Readonly<QuoteSnapshotReference>;
  confirmedBy: MarkOrbitId;
  confirmedAt: string;
  termsVersion: string;
  acknowledgements: ReadonlyArray<Readonly<ConfirmationAcknowledgement>>;
  status: CustomerConfirmationStatus;
  createdAt: string;
  updatedAt: string;
}
export interface MatterReadinessCheck {
  code: MatterReadinessCheckCode;
  status: ReadinessCheckStatus;
  explanation: string;
  evidenceReference?: string;
  blocking: boolean;
}
export interface MatterReadiness {
  evaluatedAt: string;
  checks: ReadonlyArray<Readonly<MatterReadinessCheck>>;
  readyForProfessionalReview: boolean;
}
export interface MatterDraftPreparation {
  applicantName?: string;
  applicantAddress?: string;
  trademark?: string;
  targetJurisdiction?: string;
  classes: number[];
  goodsServices?: string;
  filingBasis?: string;
  representativeRequired?: boolean;
  documentReferences: string[];
  commercialScopeUnchanged?: boolean;
}
export interface MatterDraft {
  schemaVersion: 1;
  matterDraftId: MatterDraftId;
  confirmationId: CustomerConfirmationId;
  customerId: MarkOrbitId;
  preparation: Readonly<MatterDraftPreparation>;
  instructionCompleteness: 'INCOMPLETE' | 'COMPLETE';
  documentReadiness: 'MISSING' | 'READY';
  readiness: MatterReadiness;
  missingInformation: string[];
  status: MatterDraftStatus;
  createdAt: string;
  updatedAt: string;
}
export interface AuthorityBoundary {
  orderCreated: false;
  paymentCreated: false;
  professionalAppointed: false;
  filingCreated: false;
}
export const noAutomaticConsequences: AuthorityBoundary = Object.freeze({
  orderCreated: false,
  paymentCreated: false,
  professionalAppointed: false,
  filingCreated: false
});

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
function option(value: unknown): PlanOptionCode {
  if (value !== 'A' && value !== 'B' && value !== 'C')
    throw new ContractValidationError('selectedOptionCode must be A, B, or C.');
  return value;
}
export function parseQuoteCreateCommand(value: unknown): QuoteCreateCommand {
  const v = object(value, 'command');
  return {
    intakeId: id(v.intakeId, 'intakeId'),
    recommendationId: id(v.recommendationId, 'recommendationId'),
    selectedOptionCode: option(v.selectedOptionCode),
    actor: parseActorContext(v.actor),
    idempotencyKey: text(v.idempotencyKey, 'idempotencyKey'),
    correlationId: id(v.correlationId, 'correlationId')
  };
}
export function parseQuoteConfirmationCommand(value: unknown): QuoteConfirmationCommand {
  const v = object(value, 'command');
  return {
    quoteId: id(v.quoteId, 'quoteId'),
    actor: parseActorContext(v.actor),
    idempotencyKey: text(v.idempotencyKey, 'idempotencyKey'),
    correlationId: id(v.correlationId, 'correlationId')
  };
}
export function parseMoney(value: unknown): Money {
  const v = object(value, 'money');
  if (!Number.isSafeInteger(v.amountMinor) || (v.amountMinor as number) < 0)
    throw new ContractValidationError('money.amountMinor must be a non-negative safe integer.');
  const currency = text(v.currency, 'money.currency');
  if (!/^[A-Z]{3}$/.test(currency))
    throw new ContractValidationError('money.currency must be an ISO 4217 code.');
  return { amountMinor: v.amountMinor as number, currency };
}
export function parseFixtureMoney(value: unknown): Money {
  const result = parseMoney(value);
  if (result.currency !== 'USD')
    throw new ContractValidationError('Fixture money currently supports USD only.');
  return result;
}
export function assertQuoteMoneyInvariants(quote: Quote): void {
  const amounts = [
    quote.subtotal,
    quote.estimatedOfficialFees,
    quote.estimatedServiceFees,
    quote.estimatedDisbursements,
    quote.estimatedTaxes,
    quote.total,
    ...quote.lines.map((line) => line.amount)
  ];
  for (const amount of amounts) {
    parseFixtureMoney(amount);
    if (amount.currency !== quote.currency)
      throw new ContractValidationError('All Quote money must use the Quote currency.');
  }
  if (quote.currency !== 'USD')
    throw new ContractValidationError('Fixture Quote currency must be USD.');
  const category = (name: QuoteLine['category']) =>
    quote.lines
      .filter((line) => line.category === name)
      .reduce((sum, line) => sum + line.amount.amountMinor, 0);
  const official = category('OFFICIAL_FEE');
  const service = category('SERVICE_FEE');
  const disbursements = category('DISBURSEMENT');
  const taxes = category('TAX');
  if (
    official !== quote.estimatedOfficialFees.amountMinor ||
    service !== quote.estimatedServiceFees.amountMinor ||
    disbursements !== quote.estimatedDisbursements.amountMinor ||
    taxes !== quote.estimatedTaxes.amountMinor
  )
    throw new ContractValidationError('Quote category totals do not reconcile.');
  if (quote.subtotal.amountMinor !== official + service + disbursements)
    throw new ContractValidationError('Quote subtotal does not reconcile.');
  if (quote.total.amountMinor !== quote.subtotal.amountMinor + taxes)
    throw new ContractValidationError('Quote total does not reconcile.');
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
