import {
  ContractValidationError,
  isMarkOrbitId,
  parseChannel,
  parseMoney,
  parseRelationshipModel,
  type Channel,
  type MarkOrbitId,
  type Money,
  type PlanOptionCode,
  type QuoteAssumption,
  type QuoteLine,
  type QuoteStatus,
  type RelationshipModel
} from './index.js';

export const earlyFunnelAdmissionClasses = [
  'PRODUCTION_ADMISSIBLE',
  'FIXTURE_TEST',
  'UNSUPPORTED_UNTRUSTED'
] as const;
export type EarlyFunnelAdmissionClass = (typeof earlyFunnelAdmissionClasses)[number];

export const earlyFunnelCurrentnessStates = ['CURRENT', 'STALE', 'SUPERSEDED'] as const;
export type EarlyFunnelCurrentness = (typeof earlyFunnelCurrentnessStates)[number];

export interface EarlyFunnelAuthorityConsequencesV1 {
  professionalApprovalCreated: false;
  legalConclusionCreated: false;
  filingAuthorizationCreated: false;
  protectedActionAuthorized: false;
  orderCreated: false;
  paymentCreated: false;
  invoiceCreated: false;
  filingCreated: false;
  officialTruthCreated: false;
}

export const noEarlyFunnelAuthorityConsequences: EarlyFunnelAuthorityConsequencesV1 = Object.freeze(
  {
    professionalApprovalCreated: false,
    legalConclusionCreated: false,
    filingAuthorizationCreated: false,
    protectedActionAuthorized: false,
    orderCreated: false,
    paymentCreated: false,
    invoiceCreated: false,
    filingCreated: false,
    officialTruthCreated: false
  }
);

export interface RecommendationSourceAuthorityConsequencesV1 extends EarlyFunnelAuthorityConsequencesV1 {
  customerSelectionCreated: false;
}

export const noRecommendationSourceAuthorityConsequences: RecommendationSourceAuthorityConsequencesV1 =
  Object.freeze({
    ...noEarlyFunnelAuthorityConsequences,
    customerSelectionCreated: false
  });

export type EarlyFunnelApplicantType = 'INDIVIDUAL' | 'ORGANIZATION' | 'OTHER';
export type EarlyFunnelTrademarkType = 'WORD' | 'STYLIZED_WORD' | 'DEVICE' | 'COMPOSITE' | 'OTHER';

export interface ProductionIntakeInputV1 {
  businessContext: string;
  applicant: {
    type: EarlyFunnelApplicantType;
    name: string;
    country: string;
  };
  trademark: {
    type: EarlyFunnelTrademarkType;
    representationText: string;
  };
  targetJurisdictions: readonly string[];
  goodsServices: {
    sourceText: string;
  };
  filingGoal: string;
}

/**
 * Browser/client command. Workspace and actor authority are deliberately absent and must come
 * from the trusted authenticated Workspace Principal at the Gateway/service boundary.
 */
export interface CreateProductionIntakeCommandV1 {
  schemaVersion: 1;
  channel: Channel;
  relationshipModel: RelationshipModel;
  input: Readonly<ProductionIntakeInputV1>;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface ProductionIntakeV1 {
  schemaVersion: 1;
  intakeId: MarkOrbitId;
  workspaceId: string;
  version: number;
  status: 'RECEIVED' | 'RECOMMENDATION_READY';
  channel: Channel;
  relationshipModel: RelationshipModel;
  input: Readonly<ProductionIntakeInputV1>;
  sourceClass: 'CUSTOMER_SUPPLIED';
  fingerprintSha256: string;
  createdAt: string;
  updatedAt: string;
  authorityConsequences: EarlyFunnelAuthorityConsequencesV1;
}

export interface EarlyFunnelArtifactReferenceV1 {
  id: MarkOrbitId;
  version: number;
  fingerprintSha256: string;
}

export interface EarlyFunnelAdmittedArtifactReferenceV1 extends EarlyFunnelArtifactReferenceV1 {
  admissionClass: EarlyFunnelAdmissionClass;
  currentness: EarlyFunnelCurrentness;
}

export interface EarlyFunnelSourceReferenceV1 {
  sourceKind: 'CAPABILITY_RESULT' | 'PRICING_SOURCE';
  sourceId: string;
  sourceVersion: string;
  fingerprintSha256: string;
  admissionClass: EarlyFunnelAdmissionClass;
  currentness: EarlyFunnelCurrentness;
  currentnessCheckedAt: string;
  provenanceRefs: readonly string[];
  assumptions: readonly string[];
  limitations: readonly string[];
}

export interface RecommendationSourceReferenceV1 extends EarlyFunnelSourceReferenceV1 {
  sourceKind: 'CAPABILITY_RESULT';
  authorityConsequences: RecommendationSourceAuthorityConsequencesV1;
}

export interface RecommendationOptionV1 {
  code: PlanOptionCode;
  title: string;
  description: string;
}

export interface RecommendationArtifactV1 {
  schemaVersion: 1;
  recommendationId: MarkOrbitId;
  workspaceId: string;
  version: number;
  intake: Readonly<EarlyFunnelArtifactReferenceV1>;
  admissionClass: EarlyFunnelAdmissionClass;
  currentness: EarlyFunnelCurrentness;
  source: Readonly<RecommendationSourceReferenceV1>;
  options: readonly [RecommendationOptionV1, RecommendationOptionV1, RecommendationOptionV1];
  rationale: string;
  assumptions: readonly string[];
  limitations: readonly string[];
  provenanceRefs: readonly string[];
  generatedAt: string;
  fingerprintSha256: string;
  authorityConsequences: EarlyFunnelAuthorityConsequencesV1;
}

export type ProductionRecommendationV1 = RecommendationArtifactV1 & {
  admissionClass: 'PRODUCTION_ADMISSIBLE';
  source: RecommendationSourceReferenceV1 & { admissionClass: 'PRODUCTION_ADMISSIBLE' };
};

export type UserSelectionStatusV1 = 'CURRENT' | 'SUPERSEDED';
export interface UserSelectionV1 {
  schemaVersion: 1;
  selectionId: MarkOrbitId;
  workspaceId: string;
  version: number;
  status: UserSelectionStatusV1;
  recommendation: Readonly<EarlyFunnelArtifactReferenceV1>;
  selectedOptionCode: PlanOptionCode;
  selectedAt: string;
  fingerprintSha256: string;
  authorityConsequences: EarlyFunnelAuthorityConsequencesV1;
}

/** Actor/Workspace identity is intentionally omitted; authority is resolved from trusted context. */
export interface CreateUserSelectionCommandV1 {
  schemaVersion: 1;
  recommendationId: MarkOrbitId;
  expectedRecommendationVersion: number;
  selectedOptionCode: PlanOptionCode;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface ProductionQuoteLineV1 extends QuoteLine {
  sourceReference: {
    sourceId: string;
    sourceVersion: string;
  };
}

export interface QuoteArtifactV1 {
  schemaVersion: 1;
  quoteId: MarkOrbitId;
  workspaceId: string;
  version: number;
  admissionClass: EarlyFunnelAdmissionClass;
  status: QuoteStatus;
  intake: Readonly<EarlyFunnelArtifactReferenceV1>;
  recommendation: Readonly<EarlyFunnelAdmittedArtifactReferenceV1>;
  selection: Readonly<EarlyFunnelArtifactReferenceV1 & { currentness: EarlyFunnelCurrentness }>;
  pricingSource: Readonly<EarlyFunnelSourceReferenceV1 & { sourceKind: 'PRICING_SOURCE' }>;
  currency: string;
  lines: readonly ProductionQuoteLineV1[];
  subtotal: Money;
  estimatedOfficialFees: Money;
  estimatedServiceFees: Money;
  estimatedDisbursements: Money;
  estimatedTaxes: Money;
  total: Money;
  assumptions: readonly QuoteAssumption[];
  limitations: readonly string[];
  validUntil: string;
  supersedesQuoteId?: MarkOrbitId;
  createdAt: string;
  fingerprintSha256: string;
  authorityConsequences: EarlyFunnelAuthorityConsequencesV1;
}

export type ProductionQuoteV1 = QuoteArtifactV1 & {
  admissionClass: 'PRODUCTION_ADMISSIBLE';
  recommendation: EarlyFunnelAdmittedArtifactReferenceV1 & {
    admissionClass: 'PRODUCTION_ADMISSIBLE';
  };
  pricingSource: EarlyFunnelSourceReferenceV1 & {
    sourceKind: 'PRICING_SOURCE';
    admissionClass: 'PRODUCTION_ADMISSIBLE';
  };
};

export interface CreateProductionQuoteCommandV1 {
  schemaVersion: 1;
  intakeId: MarkOrbitId;
  expectedIntakeVersion: number;
  recommendationId: MarkOrbitId;
  expectedRecommendationVersion: number;
  selectionId: MarkOrbitId;
  expectedSelectionVersion: number;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

const authorityInputFields = [
  'actor',
  'actorId',
  'userId',
  'workspaceId',
  'workplaceId',
  'membershipId',
  'subjectUserId'
] as const;

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ContractValidationError(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new ContractValidationError(`${name} must be a non-empty string.`);
  return value;
}

function markOrbitId(value: unknown, name: string): MarkOrbitId {
  if (!isMarkOrbitId(value))
    throw new ContractValidationError(`${name} must be a MarkOrbit identifier.`);
  return value;
}

function version(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0)
    throw new ContractValidationError(`${name} must be a positive safe integer.`);
  return value as number;
}

function timestamp(value: unknown, name: string): string {
  const result = text(value, name);
  if (!Number.isFinite(Date.parse(result)))
    throw new ContractValidationError(`${name} must be an ISO timestamp.`);
  return result;
}

function sha256(value: unknown, name: string): string {
  const result = text(value, name);
  if (!/^[a-f0-9]{64}$/i.test(result))
    throw new ContractValidationError(`${name} must be a SHA-256 hex fingerprint.`);
  return result.toLowerCase();
}

function country(value: unknown, name: string): string {
  const result = text(value, name);
  if (!/^[A-Z]{2}$/.test(result))
    throw new ContractValidationError(`${name} must be an ISO 3166-1 alpha-2 code.`);
  return result;
}

function stringList(value: unknown, name: string, allowEmpty = true): readonly string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0))
    throw new ContractValidationError(
      `${name} must be ${allowEmpty ? 'an' : 'a non-empty'} array.`
    );
  return value.map((item, index) => text(item, `${name}[${index}]`));
}

function admissionClass(value: unknown, name: string): EarlyFunnelAdmissionClass {
  if (!(earlyFunnelAdmissionClasses as readonly unknown[]).includes(value))
    throw new ContractValidationError(`${name} is invalid.`);
  return value as EarlyFunnelAdmissionClass;
}

function currentness(value: unknown, name: string): EarlyFunnelCurrentness {
  if (!(earlyFunnelCurrentnessStates as readonly unknown[]).includes(value))
    throw new ContractValidationError(`${name} is invalid.`);
  return value as EarlyFunnelCurrentness;
}

function planOption(value: unknown, name: string): PlanOptionCode {
  if (value !== 'A' && value !== 'B' && value !== 'C')
    throw new ContractValidationError(`${name} must be A, B, or C.`);
  return value;
}

function rejectAuthorityInput(value: Readonly<Record<string, unknown>>): void {
  const field = authorityInputFields.find((candidate) => Object.hasOwn(value, candidate));
  if (field)
    throw new ContractValidationError(
      `${field} is trusted authority context and must not be supplied by this command.`
    );
}

function parseAuthorityConsequences(
  value: unknown,
  name: string
): EarlyFunnelAuthorityConsequencesV1 {
  const v = record(value, name);
  for (const field of Object.keys(noEarlyFunnelAuthorityConsequences)) {
    if (v[field] !== false) throw new ContractValidationError(`${name}.${field} must be false.`);
  }
  return noEarlyFunnelAuthorityConsequences;
}

function parseSourceAuthorityConsequences(
  value: unknown,
  name: string
): RecommendationSourceAuthorityConsequencesV1 {
  parseAuthorityConsequences(value, name);
  const v = record(value, name);
  if (v.customerSelectionCreated !== false)
    throw new ContractValidationError(`${name}.customerSelectionCreated must be false.`);
  return noRecommendationSourceAuthorityConsequences;
}

function parseIntakeInput(value: unknown): ProductionIntakeInputV1 {
  const v = record(value, 'input');
  const applicant = record(v.applicant, 'input.applicant');
  const trademark = record(v.trademark, 'input.trademark');
  const goodsServices = record(v.goodsServices, 'input.goodsServices');
  const applicantType = applicant.type;
  if (
    applicantType !== 'INDIVIDUAL' &&
    applicantType !== 'ORGANIZATION' &&
    applicantType !== 'OTHER'
  )
    throw new ContractValidationError('input.applicant.type is invalid.');
  const trademarkType = trademark.type;
  if (
    trademarkType !== 'WORD' &&
    trademarkType !== 'STYLIZED_WORD' &&
    trademarkType !== 'DEVICE' &&
    trademarkType !== 'COMPOSITE' &&
    trademarkType !== 'OTHER'
  )
    throw new ContractValidationError('input.trademark.type is invalid.');
  return {
    businessContext: text(v.businessContext, 'input.businessContext'),
    applicant: {
      type: applicantType,
      name: text(applicant.name, 'input.applicant.name'),
      country: country(applicant.country, 'input.applicant.country')
    },
    trademark: {
      type: trademarkType,
      representationText: text(trademark.representationText, 'input.trademark.representationText')
    },
    targetJurisdictions: stringList(v.targetJurisdictions, 'input.targetJurisdictions', false).map(
      (item) => country(item, 'input.targetJurisdictions item')
    ),
    goodsServices: {
      sourceText: text(goodsServices.sourceText, 'input.goodsServices.sourceText')
    },
    filingGoal: text(v.filingGoal, 'input.filingGoal')
  };
}

function parseArtifactReference(value: unknown, name: string): EarlyFunnelArtifactReferenceV1 {
  const v = record(value, name);
  return {
    id: markOrbitId(v.id, `${name}.id`),
    version: version(v.version, `${name}.version`),
    fingerprintSha256: sha256(v.fingerprintSha256, `${name}.fingerprintSha256`)
  };
}

function parseAdmittedArtifactReference(
  value: unknown,
  name: string
): EarlyFunnelAdmittedArtifactReferenceV1 {
  const v = record(value, name);
  return {
    ...parseArtifactReference(v, name),
    admissionClass: admissionClass(v.admissionClass, `${name}.admissionClass`),
    currentness: currentness(v.currentness, `${name}.currentness`)
  };
}

function parseSourceReference(value: unknown, name: string): EarlyFunnelSourceReferenceV1 {
  const v = record(value, name);
  if (v.sourceKind !== 'CAPABILITY_RESULT' && v.sourceKind !== 'PRICING_SOURCE')
    throw new ContractValidationError(`${name}.sourceKind is invalid.`);
  return {
    sourceKind: v.sourceKind,
    sourceId: text(v.sourceId, `${name}.sourceId`),
    sourceVersion: text(v.sourceVersion, `${name}.sourceVersion`),
    fingerprintSha256: sha256(v.fingerprintSha256, `${name}.fingerprintSha256`),
    admissionClass: admissionClass(v.admissionClass, `${name}.admissionClass`),
    currentness: currentness(v.currentness, `${name}.currentness`),
    currentnessCheckedAt: timestamp(v.currentnessCheckedAt, `${name}.currentnessCheckedAt`),
    provenanceRefs: stringList(v.provenanceRefs, `${name}.provenanceRefs`, false),
    assumptions: stringList(v.assumptions, `${name}.assumptions`),
    limitations: stringList(v.limitations, `${name}.limitations`)
  };
}

function parseRecommendationSource(value: unknown): RecommendationSourceReferenceV1 {
  const v = record(value, 'recommendation.source');
  const source = parseSourceReference(v, 'recommendation.source');
  if (source.sourceKind !== 'CAPABILITY_RESULT')
    throw new ContractValidationError(
      'recommendation.source.sourceKind must be CAPABILITY_RESULT.'
    );
  return {
    ...source,
    sourceKind: 'CAPABILITY_RESULT',
    authorityConsequences: parseSourceAuthorityConsequences(
      v.authorityConsequences,
      'recommendation.source.authorityConsequences'
    )
  };
}

function parseRecommendationOptions(
  value: unknown
): readonly [RecommendationOptionV1, RecommendationOptionV1, RecommendationOptionV1] {
  if (!Array.isArray(value) || value.length !== 3)
    throw new ContractValidationError('recommendation.options must contain exactly A/B/C.');
  const options = value.map((entry, index) => {
    const option = record(entry, `recommendation.options[${index}]`);
    return {
      code: planOption(option.code, `recommendation.options[${index}].code`),
      title: text(option.title, `recommendation.options[${index}].title`),
      description: text(option.description, `recommendation.options[${index}].description`)
    };
  });
  if (options.map((option) => option.code).join('') !== 'ABC')
    throw new ContractValidationError('recommendation.options must be ordered A/B/C.');
  return options as unknown as readonly [
    RecommendationOptionV1,
    RecommendationOptionV1,
    RecommendationOptionV1
  ];
}

export function parseCreateProductionIntakeCommandV1(
  value: unknown
): CreateProductionIntakeCommandV1 {
  const v = record(value, 'command');
  rejectAuthorityInput(v);
  if (v.schemaVersion !== 1) throw new ContractValidationError('command.schemaVersion must be 1.');
  return {
    schemaVersion: 1,
    channel: parseChannel(v.channel),
    relationshipModel: parseRelationshipModel(v.relationshipModel),
    input: parseIntakeInput(v.input),
    idempotencyKey: text(v.idempotencyKey, 'command.idempotencyKey'),
    correlationId: markOrbitId(v.correlationId, 'command.correlationId')
  };
}

export function parseProductionIntakeV1(value: unknown): ProductionIntakeV1 {
  const v = record(value, 'intake');
  if (v.schemaVersion !== 1) throw new ContractValidationError('intake.schemaVersion must be 1.');
  if (v.status !== 'RECEIVED' && v.status !== 'RECOMMENDATION_READY')
    throw new ContractValidationError('intake.status is invalid.');
  if (v.sourceClass !== 'CUSTOMER_SUPPLIED')
    throw new ContractValidationError('intake.sourceClass must be CUSTOMER_SUPPLIED.');
  return {
    schemaVersion: 1,
    intakeId: markOrbitId(v.intakeId, 'intake.intakeId'),
    workspaceId: text(v.workspaceId, 'intake.workspaceId'),
    version: version(v.version, 'intake.version'),
    status: v.status,
    channel: parseChannel(v.channel),
    relationshipModel: parseRelationshipModel(v.relationshipModel),
    input: parseIntakeInput(v.input),
    sourceClass: 'CUSTOMER_SUPPLIED',
    fingerprintSha256: sha256(v.fingerprintSha256, 'intake.fingerprintSha256'),
    createdAt: timestamp(v.createdAt, 'intake.createdAt'),
    updatedAt: timestamp(v.updatedAt, 'intake.updatedAt'),
    authorityConsequences: parseAuthorityConsequences(
      v.authorityConsequences,
      'intake.authorityConsequences'
    )
  };
}

export function parseRecommendationArtifactV1(value: unknown): RecommendationArtifactV1 {
  const v = record(value, 'recommendation');
  if (v.schemaVersion !== 1)
    throw new ContractValidationError('recommendation.schemaVersion must be 1.');
  return {
    schemaVersion: 1,
    recommendationId: markOrbitId(v.recommendationId, 'recommendation.recommendationId'),
    workspaceId: text(v.workspaceId, 'recommendation.workspaceId'),
    version: version(v.version, 'recommendation.version'),
    intake: parseArtifactReference(v.intake, 'recommendation.intake'),
    admissionClass: admissionClass(v.admissionClass, 'recommendation.admissionClass'),
    currentness: currentness(v.currentness, 'recommendation.currentness'),
    source: parseRecommendationSource(v.source),
    options: parseRecommendationOptions(v.options),
    rationale: text(v.rationale, 'recommendation.rationale'),
    assumptions: stringList(v.assumptions, 'recommendation.assumptions'),
    limitations: stringList(v.limitations, 'recommendation.limitations'),
    provenanceRefs: stringList(v.provenanceRefs, 'recommendation.provenanceRefs', false),
    generatedAt: timestamp(v.generatedAt, 'recommendation.generatedAt'),
    fingerprintSha256: sha256(v.fingerprintSha256, 'recommendation.fingerprintSha256'),
    authorityConsequences: parseAuthorityConsequences(
      v.authorityConsequences,
      'recommendation.authorityConsequences'
    )
  };
}

export function parseProductionRecommendationV1(value: unknown): ProductionRecommendationV1 {
  const recommendation = parseRecommendationArtifactV1(value);
  if (recommendation.admissionClass !== 'PRODUCTION_ADMISSIBLE')
    throw new ContractValidationError(
      'recommendation.admissionClass must be PRODUCTION_ADMISSIBLE for production admission.'
    );
  if (recommendation.source.admissionClass !== 'PRODUCTION_ADMISSIBLE')
    throw new ContractValidationError(
      'recommendation.source.admissionClass must be PRODUCTION_ADMISSIBLE.'
    );
  return recommendation as ProductionRecommendationV1;
}

export function assertRecommendationEligibleForQuoteV1(value: unknown): ProductionRecommendationV1 {
  const recommendation = parseProductionRecommendationV1(value);
  if (recommendation.currentness !== 'CURRENT' || recommendation.source.currentness !== 'CURRENT')
    throw new ContractValidationError('Recommendation and analytical source must both be CURRENT.');
  return recommendation;
}

export function parseCreateUserSelectionCommandV1(value: unknown): CreateUserSelectionCommandV1 {
  const v = record(value, 'command');
  rejectAuthorityInput(v);
  if (v.schemaVersion !== 1) throw new ContractValidationError('command.schemaVersion must be 1.');
  return {
    schemaVersion: 1,
    recommendationId: markOrbitId(v.recommendationId, 'command.recommendationId'),
    expectedRecommendationVersion: version(
      v.expectedRecommendationVersion,
      'command.expectedRecommendationVersion'
    ),
    selectedOptionCode: planOption(v.selectedOptionCode, 'command.selectedOptionCode'),
    idempotencyKey: text(v.idempotencyKey, 'command.idempotencyKey'),
    correlationId: markOrbitId(v.correlationId, 'command.correlationId')
  };
}

export function parseUserSelectionV1(value: unknown): UserSelectionV1 {
  const v = record(value, 'selection');
  if (v.schemaVersion !== 1)
    throw new ContractValidationError('selection.schemaVersion must be 1.');
  if (v.status !== 'CURRENT' && v.status !== 'SUPERSEDED')
    throw new ContractValidationError('selection.status is invalid.');
  return {
    schemaVersion: 1,
    selectionId: markOrbitId(v.selectionId, 'selection.selectionId'),
    workspaceId: text(v.workspaceId, 'selection.workspaceId'),
    version: version(v.version, 'selection.version'),
    status: v.status,
    recommendation: parseArtifactReference(v.recommendation, 'selection.recommendation'),
    selectedOptionCode: planOption(v.selectedOptionCode, 'selection.selectedOptionCode'),
    selectedAt: timestamp(v.selectedAt, 'selection.selectedAt'),
    fingerprintSha256: sha256(v.fingerprintSha256, 'selection.fingerprintSha256'),
    authorityConsequences: parseAuthorityConsequences(
      v.authorityConsequences,
      'selection.authorityConsequences'
    )
  };
}

function parseQuoteLine(value: unknown, index: number): ProductionQuoteLineV1 {
  const v = record(value, `quote.lines[${index}]`);
  const source = record(v.sourceReference, `quote.lines[${index}].sourceReference`);
  const category = v.category;
  if (
    category !== 'OFFICIAL_FEE' &&
    category !== 'SERVICE_FEE' &&
    category !== 'DISBURSEMENT' &&
    category !== 'TAX'
  )
    throw new ContractValidationError(`quote.lines[${index}].category is invalid.`);
  return {
    code: text(v.code, `quote.lines[${index}].code`),
    description: text(v.description, `quote.lines[${index}].description`),
    category,
    amount: parseMoney(v.amount),
    sourceReference: {
      sourceId: text(source.sourceId, `quote.lines[${index}].sourceReference.sourceId`),
      sourceVersion: text(
        source.sourceVersion,
        `quote.lines[${index}].sourceReference.sourceVersion`
      )
    }
  };
}

function parseQuoteAssumptions(value: unknown): readonly QuoteAssumption[] {
  if (!Array.isArray(value))
    throw new ContractValidationError('quote.assumptions must be an array.');
  return value.map((entry, index) => {
    const v = record(entry, `quote.assumptions[${index}]`);
    return {
      code: text(v.code, `quote.assumptions[${index}].code`),
      text: text(v.text, `quote.assumptions[${index}].text`)
    };
  });
}

function parseQuoteStatus(value: unknown): QuoteStatus {
  if (
    value !== 'DRAFT' &&
    value !== 'READY' &&
    value !== 'CONFIRMED' &&
    value !== 'EXPIRED' &&
    value !== 'SUPERSEDED'
  )
    throw new ContractValidationError('quote.status is invalid.');
  return value;
}

function assertQuoteMoney(quote: QuoteArtifactV1): void {
  if (!/^[A-Z]{3}$/.test(quote.currency))
    throw new ContractValidationError('quote.currency must be an ISO 4217 code.');
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
    parseMoney(amount);
    if (amount.currency !== quote.currency)
      throw new ContractValidationError('All Quote money must use quote.currency.');
  }
  const categoryTotal = (category: QuoteLine['category']) =>
    quote.lines
      .filter((line) => line.category === category)
      .reduce((sum, line) => sum + line.amount.amountMinor, 0);
  const official = categoryTotal('OFFICIAL_FEE');
  const service = categoryTotal('SERVICE_FEE');
  const disbursement = categoryTotal('DISBURSEMENT');
  const taxes = categoryTotal('TAX');
  if (
    official !== quote.estimatedOfficialFees.amountMinor ||
    service !== quote.estimatedServiceFees.amountMinor ||
    disbursement !== quote.estimatedDisbursements.amountMinor ||
    taxes !== quote.estimatedTaxes.amountMinor
  )
    throw new ContractValidationError('Quote category totals do not reconcile.');
  if (quote.subtotal.amountMinor !== official + service + disbursement)
    throw new ContractValidationError('Quote subtotal does not reconcile.');
  if (quote.total.amountMinor !== quote.subtotal.amountMinor + taxes)
    throw new ContractValidationError('Quote total does not reconcile.');
}

export function parseQuoteArtifactV1(value: unknown): QuoteArtifactV1 {
  const v = record(value, 'quote');
  if (v.schemaVersion !== 1) throw new ContractValidationError('quote.schemaVersion must be 1.');
  const lines = Array.isArray(v.lines) ? v.lines.map(parseQuoteLine) : undefined;
  if (!lines?.length) throw new ContractValidationError('quote.lines must be a non-empty array.');
  const pricingSource = parseSourceReference(v.pricingSource, 'quote.pricingSource');
  if (pricingSource.sourceKind !== 'PRICING_SOURCE')
    throw new ContractValidationError('quote.pricingSource.sourceKind must be PRICING_SOURCE.');
  const quote: QuoteArtifactV1 = {
    schemaVersion: 1,
    quoteId: markOrbitId(v.quoteId, 'quote.quoteId'),
    workspaceId: text(v.workspaceId, 'quote.workspaceId'),
    version: version(v.version, 'quote.version'),
    admissionClass: admissionClass(v.admissionClass, 'quote.admissionClass'),
    status: parseQuoteStatus(v.status),
    intake: parseArtifactReference(v.intake, 'quote.intake'),
    recommendation: parseAdmittedArtifactReference(v.recommendation, 'quote.recommendation'),
    selection: {
      ...parseArtifactReference(v.selection, 'quote.selection'),
      currentness: currentness(
        record(v.selection, 'quote.selection').currentness,
        'quote.selection.currentness'
      )
    },
    pricingSource: { ...pricingSource, sourceKind: 'PRICING_SOURCE' },
    currency: text(v.currency, 'quote.currency'),
    lines,
    subtotal: parseMoney(v.subtotal),
    estimatedOfficialFees: parseMoney(v.estimatedOfficialFees),
    estimatedServiceFees: parseMoney(v.estimatedServiceFees),
    estimatedDisbursements: parseMoney(v.estimatedDisbursements),
    estimatedTaxes: parseMoney(v.estimatedTaxes),
    total: parseMoney(v.total),
    assumptions: parseQuoteAssumptions(v.assumptions),
    limitations: stringList(v.limitations, 'quote.limitations'),
    validUntil: timestamp(v.validUntil, 'quote.validUntil'),
    ...(v.supersedesQuoteId === undefined
      ? {}
      : { supersedesQuoteId: markOrbitId(v.supersedesQuoteId, 'quote.supersedesQuoteId') }),
    createdAt: timestamp(v.createdAt, 'quote.createdAt'),
    fingerprintSha256: sha256(v.fingerprintSha256, 'quote.fingerprintSha256'),
    authorityConsequences: parseAuthorityConsequences(
      v.authorityConsequences,
      'quote.authorityConsequences'
    )
  };
  assertQuoteMoney(quote);
  return quote;
}

export function parseProductionQuoteV1(value: unknown): ProductionQuoteV1 {
  const quote = parseQuoteArtifactV1(value);
  if (quote.admissionClass !== 'PRODUCTION_ADMISSIBLE')
    throw new ContractValidationError(
      'quote.admissionClass must be PRODUCTION_ADMISSIBLE for production admission.'
    );
  if (quote.recommendation.admissionClass !== 'PRODUCTION_ADMISSIBLE')
    throw new ContractValidationError(
      'quote.recommendation must reference a production recommendation.'
    );
  if (quote.pricingSource.admissionClass !== 'PRODUCTION_ADMISSIBLE')
    throw new ContractValidationError('quote.pricingSource must be PRODUCTION_ADMISSIBLE.');
  return quote as ProductionQuoteV1;
}

export function assertQuoteConfirmableV1(value: unknown, now: string): ProductionQuoteV1 {
  const quote = parseProductionQuoteV1(value);
  const nowMs = Date.parse(timestamp(now, 'now'));
  if (quote.status !== 'READY')
    throw new ContractValidationError('Only a READY Quote is confirmable.');
  if (
    quote.recommendation.currentness !== 'CURRENT' ||
    quote.selection.currentness !== 'CURRENT' ||
    quote.pricingSource.currentness !== 'CURRENT'
  )
    throw new ContractValidationError('Quote source lineage must be CURRENT.');
  if (Date.parse(quote.validUntil) <= nowMs)
    throw new ContractValidationError('Quote is expired and cannot be confirmed.');
  return quote;
}

export function parseCreateProductionQuoteCommandV1(
  value: unknown
): CreateProductionQuoteCommandV1 {
  const v = record(value, 'command');
  rejectAuthorityInput(v);
  if (v.schemaVersion !== 1) throw new ContractValidationError('command.schemaVersion must be 1.');
  return {
    schemaVersion: 1,
    intakeId: markOrbitId(v.intakeId, 'command.intakeId'),
    expectedIntakeVersion: version(v.expectedIntakeVersion, 'command.expectedIntakeVersion'),
    recommendationId: markOrbitId(v.recommendationId, 'command.recommendationId'),
    expectedRecommendationVersion: version(
      v.expectedRecommendationVersion,
      'command.expectedRecommendationVersion'
    ),
    selectionId: markOrbitId(v.selectionId, 'command.selectionId'),
    expectedSelectionVersion: version(
      v.expectedSelectionVersion,
      'command.expectedSelectionVersion'
    ),
    idempotencyKey: text(v.idempotencyKey, 'command.idempotencyKey'),
    correlationId: markOrbitId(v.correlationId, 'command.correlationId')
  };
}
