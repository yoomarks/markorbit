export type CustomerRelationshipId = `customer-relationship_${string}`;

export const customerContextRelationshipModels = [
  'DIRECT',
  'CO_DELIVERY',
  'WHITE_LABEL',
  'REFERRAL',
  'PLATFORM_ASSISTED'
] as const;
export type CustomerContextRelationshipModel = (typeof customerContextRelationshipModels)[number];

export const customerContextRelationshipStatuses = ['ACTIVE', 'ARCHIVED'] as const;
export type CustomerContextRelationshipStatus =
  (typeof customerContextRelationshipStatuses)[number];
export type CustomerContextIdentityStatus = 'UNVERIFIED';
export type CustomerContextOrigin = 'WORKSPACE_EXPLICIT';
export type CustomerContextCurrentness = 'CURRENT' | 'INACTIVE';

export interface CustomerContextSourceReferenceV1 {
  owner: 'MARKREG';
  kind: 'CUSTOMER_RELATIONSHIP';
  referenceId: CustomerRelationshipId;
  referenceVersion: number;
  currentness: CustomerContextCurrentness;
}

export interface CustomerContextIdentityV1 {
  schemaVersion: 1;
  customerRelationshipId: CustomerRelationshipId;
  workspaceId: string;
  displayName: string;
  relationshipModel: CustomerContextRelationshipModel;
  identityStatus: CustomerContextIdentityStatus;
  origin: CustomerContextOrigin;
  status: CustomerContextRelationshipStatus;
  version: number;
  source: Readonly<CustomerContextSourceReferenceV1>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export const customerContextLinkedWorkKinds = [
  'FORMAL_MATTER',
  'OPPORTUNITY_CANDIDATE',
  'QUALIFICATION_DECISION',
  'CONTENT_OPPORTUNITY',
  'PREPARED_ACTION',
  'PROFESSIONAL_REVIEW',
  'EXECUTION_PREPARATION'
] as const;
export type CustomerContextLinkedWorkKind = (typeof customerContextLinkedWorkKinds)[number];
export type CustomerContextLinkedWorkOwner = 'MARKREG' | 'LITE' | 'EXECUTION';
export type CustomerContextLinkedWorkCurrentness = 'CURRENT' | 'INACTIVE' | 'UNKNOWN';

export interface CustomerContextLinkedWorkReferenceV1 {
  owner: CustomerContextLinkedWorkOwner;
  kind: CustomerContextLinkedWorkKind;
  referenceId: string;
  referenceVersion: number;
  currentness: CustomerContextLinkedWorkCurrentness;
}
export type CustomerContextLinkedWorkAvailabilityV1 =
  | Readonly<{
      state: 'AVAILABLE';
      references: readonly CustomerContextLinkedWorkReferenceV1[];
    }>
  | Readonly<{
      state: 'KNOWN_ABSENT';
      references: readonly [];
    }>
  | Readonly<{
      state: 'UNKNOWN';
      reasonCode: 'CANONICAL_LINK_NOT_ESTABLISHED' | 'OWNER_LINKAGE_UNKNOWN';
      references: readonly [];
    }>
  | Readonly<{
      state: 'SOURCE_UNAVAILABLE';
      reasonCode: string;
      retryable: true;
      references: readonly [];
    }>;

export interface CustomerContextLinkedWorkGroupV1 {
  kind: CustomerContextLinkedWorkKind;
  owner: CustomerContextLinkedWorkOwner;
  availability: CustomerContextLinkedWorkAvailabilityV1;
}

export const noCustomerContextAuthorityV1 = Object.freeze({
  verifiedLegalIdentityEstablished: false,
  customerInstructionEstablished: false,
  contactAuthorized: false,
  commercialConsentEstablished: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  officialTruthEstablished: false
});
export type CustomerContextAuthorityConsequencesV1 = typeof noCustomerContextAuthorityV1;

export interface CustomerContextV1 {
  schemaVersion: 1;
  workspaceId: string;
  customerRelationship: Readonly<CustomerContextIdentityV1>;
  linkedWork: readonly Readonly<CustomerContextLinkedWorkGroupV1>[];
  authorityConsequences: CustomerContextAuthorityConsequencesV1;
}

export interface CustomerContextListV1 {
  schemaVersion: 1;
  workspaceId: string;
  page: number;
  pageSize: number;
  total: number;
  items: readonly Readonly<CustomerContextIdentityV1>[];
  authorityConsequences: CustomerContextAuthorityConsequencesV1;
}

export class CustomerContextContractValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerContextContractValidationError';
  }
}

type JsonRecord = Record<string, unknown>;
const relationshipIdPattern = /^customer-relationship_[A-Za-z0-9_-]+$/u;

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CustomerContextContractValidationError(`${field} must be an object.`);
  return value as JsonRecord;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new CustomerContextContractValidationError(`${field} must be a non-empty string.`);
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new CustomerContextContractValidationError(`${field} must be a positive integer.`);
  return Number(value);
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new CustomerContextContractValidationError(`${field} must be a non-negative integer.`);
  return Number(value);
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field);
  if (Number.isNaN(Date.parse(result)))
    throw new CustomerContextContractValidationError(`${field} must be an ISO timestamp.`);
  return result;
}

function relationshipId(value: unknown, field: string): CustomerRelationshipId {
  const result = text(value, field);
  if (!relationshipIdPattern.test(result))
    throw new CustomerContextContractValidationError(
      `${field} must be a Customer Relationship id.`
    );
  return result as CustomerRelationshipId;
}
function oneOf<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== 'string' || !allowed.some((item) => item === value))
    throw new CustomerContextContractValidationError(`${field} is invalid.`);
  return value;
}

export function parseCustomerContextIdentityV1(
  value: unknown,
  expectedWorkspaceId?: string
): CustomerContextIdentityV1 {
  const v = record(value, 'customerRelationship');
  if (v.schemaVersion !== 1)
    throw new CustomerContextContractValidationError(
      'customerRelationship.schemaVersion must be 1.'
    );
  const workspaceId = text(v.workspaceId, 'customerRelationship.workspaceId');
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId)
    throw new CustomerContextContractValidationError(
      'Customer Relationship Workspace does not match.'
    );
  const id = relationshipId(
    v.customerRelationshipId,
    'customerRelationship.customerRelationshipId'
  );
  const version = positiveInteger(v.version, 'customerRelationship.version');
  const source = record(v.source, 'customerRelationship.source');
  if (source.owner !== 'MARKREG' || source.kind !== 'CUSTOMER_RELATIONSHIP')
    throw new CustomerContextContractValidationError(
      'Customer Relationship source owner/kind is invalid.'
    );
  if (relationshipId(source.referenceId, 'customerRelationship.source.referenceId') !== id)
    throw new CustomerContextContractValidationError(
      'Customer Relationship source reference does not match.'
    );
  if (
    positiveInteger(source.referenceVersion, 'customerRelationship.source.referenceVersion') !==
    version
  )
    throw new CustomerContextContractValidationError(
      'Customer Relationship source version does not match.'
    );
  const status = oneOf(
    v.status,
    customerContextRelationshipStatuses,
    'customerRelationship.status'
  );
  const currentness = oneOf(
    source.currentness,
    ['CURRENT', 'INACTIVE'] as const,
    'customerRelationship.source.currentness'
  );
  if (
    (status === 'ACTIVE' && currentness !== 'CURRENT') ||
    (status === 'ARCHIVED' && currentness !== 'INACTIVE')
  )
    throw new CustomerContextContractValidationError(
      'Customer Relationship status/currentness conflict.'
    );
  if (v.identityStatus !== 'UNVERIFIED' || v.origin !== 'WORKSPACE_EXPLICIT')
    throw new CustomerContextContractValidationError(
      'Customer Relationship authority boundary is invalid.'
    );
  const archivedAt =
    v.archivedAt === null ? null : timestamp(v.archivedAt, 'customerRelationship.archivedAt');
  if (
    (status === 'ACTIVE' && archivedAt !== null) ||
    (status === 'ARCHIVED' && archivedAt === null)
  )
    throw new CustomerContextContractValidationError(
      'Customer Relationship archive state is invalid.'
    );
  return {
    schemaVersion: 1,
    customerRelationshipId: id,
    workspaceId,
    displayName: text(v.displayName, 'customerRelationship.displayName'),
    relationshipModel: oneOf(
      v.relationshipModel,
      customerContextRelationshipModels,
      'customerRelationship.relationshipModel'
    ),
    identityStatus: 'UNVERIFIED',
    origin: 'WORKSPACE_EXPLICIT',
    status,
    version,
    source: {
      owner: 'MARKREG',
      kind: 'CUSTOMER_RELATIONSHIP',
      referenceId: id,
      referenceVersion: version,
      currentness
    },
    createdAt: timestamp(v.createdAt, 'customerRelationship.createdAt'),
    updatedAt: timestamp(v.updatedAt, 'customerRelationship.updatedAt'),
    archivedAt
  };
}

const linkedWorkOwners: Readonly<
  Record<CustomerContextLinkedWorkKind, CustomerContextLinkedWorkOwner>
> = {
  FORMAL_MATTER: 'MARKREG',
  OPPORTUNITY_CANDIDATE: 'LITE',
  QUALIFICATION_DECISION: 'LITE',
  CONTENT_OPPORTUNITY: 'LITE',
  PREPARED_ACTION: 'LITE',
  PROFESSIONAL_REVIEW: 'EXECUTION',
  EXECUTION_PREPARATION: 'EXECUTION'
};
function parseLinkedWorkReference(
  value: unknown,
  kind: CustomerContextLinkedWorkKind,
  owner: CustomerContextLinkedWorkOwner,
  index: number
): CustomerContextLinkedWorkReferenceV1 {
  const v = record(value, `linkedWork.${kind}.references[${index}]`);
  if (v.kind !== kind || v.owner !== owner)
    throw new CustomerContextContractValidationError(
      'Linked work reference owner/kind does not match its group.'
    );
  return {
    owner,
    kind,
    referenceId: text(v.referenceId, `linkedWork.${kind}.references[${index}].referenceId`),
    referenceVersion: positiveInteger(
      v.referenceVersion,
      `linkedWork.${kind}.references[${index}].referenceVersion`
    ),
    currentness: oneOf(
      v.currentness,
      ['CURRENT', 'INACTIVE', 'UNKNOWN'] as const,
      `linkedWork.${kind}.references[${index}].currentness`
    )
  };
}

function emptyReferences(value: unknown, field: string): readonly [] {
  if (!Array.isArray(value) || value.length !== 0)
    throw new CustomerContextContractValidationError(`${field} must be empty.`);
  return [];
}
export function parseCustomerContextLinkedWorkGroupV1(
  value: unknown
): CustomerContextLinkedWorkGroupV1 {
  const v = record(value, 'linkedWork');
  const kind = oneOf(v.kind, customerContextLinkedWorkKinds, 'linkedWork.kind');
  const owner = oneOf(v.owner, ['MARKREG', 'LITE', 'EXECUTION'] as const, 'linkedWork.owner');
  if (linkedWorkOwners[kind] !== owner)
    throw new CustomerContextContractValidationError('Linked work owner does not match its kind.');
  const availability = record(v.availability, `linkedWork.${kind}.availability`);
  const state = oneOf(
    availability.state,
    ['AVAILABLE', 'KNOWN_ABSENT', 'UNKNOWN', 'SOURCE_UNAVAILABLE'] as const,
    `linkedWork.${kind}.availability.state`
  );
  if (state === 'AVAILABLE') {
    if (!Array.isArray(availability.references) || availability.references.length === 0)
      throw new CustomerContextContractValidationError(
        'AVAILABLE linked work requires references.'
      );
    return {
      kind,
      owner,
      availability: {
        state,
        references: availability.references.map((reference, index) =>
          parseLinkedWorkReference(reference, kind, owner, index)
        )
      }
    };
  }
  const references = emptyReferences(
    availability.references,
    `linkedWork.${kind}.availability.references`
  );
  if (state === 'KNOWN_ABSENT') return { kind, owner, availability: { state, references } };
  if (state === 'UNKNOWN') {
    const reasonCode = oneOf(
      availability.reasonCode,
      ['CANONICAL_LINK_NOT_ESTABLISHED', 'OWNER_LINKAGE_UNKNOWN'] as const,
      `linkedWork.${kind}.availability.reasonCode`
    );
    return { kind, owner, availability: { state, reasonCode, references } };
  }
  if (availability.retryable !== true)
    throw new CustomerContextContractValidationError('SOURCE_UNAVAILABLE must be retryable.');
  return {
    kind,
    owner,
    availability: {
      state: 'SOURCE_UNAVAILABLE',
      reasonCode: text(availability.reasonCode, `linkedWork.${kind}.availability.reasonCode`),
      retryable: true,
      references
    }
  };
}

function parseAuthority(value: unknown): CustomerContextAuthorityConsequencesV1 {
  const v = record(value, 'authorityConsequences');
  for (const key of Object.keys(noCustomerContextAuthorityV1) as Array<
    keyof CustomerContextAuthorityConsequencesV1
  >) {
    if (v[key] !== false)
      throw new CustomerContextContractValidationError(
        `authorityConsequences.${key} must be false.`
      );
  }
  return noCustomerContextAuthorityV1;
}

function parseLinkedWork(value: unknown): readonly CustomerContextLinkedWorkGroupV1[] {
  if (!Array.isArray(value))
    throw new CustomerContextContractValidationError('linkedWork must be an array.');
  const groups = value.map(parseCustomerContextLinkedWorkGroupV1);
  const kinds = groups.map((group) => group.kind);
  if (
    groups.length !== customerContextLinkedWorkKinds.length ||
    new Set(kinds).size !== customerContextLinkedWorkKinds.length
  )
    throw new CustomerContextContractValidationError(
      'linkedWork must contain each governed work kind once.'
    );
  for (const kind of customerContextLinkedWorkKinds) {
    if (!kinds.includes(kind))
      throw new CustomerContextContractValidationError(`linkedWork is missing ${kind}.`);
  }
  return groups;
}

export function parseCustomerContextV1(
  value: unknown,
  expectedWorkspaceId?: string
): CustomerContextV1 {
  const v = record(value, 'customerContext');
  if (v.schemaVersion !== 1)
    throw new CustomerContextContractValidationError('customerContext.schemaVersion must be 1.');
  const workspaceId = text(v.workspaceId, 'customerContext.workspaceId');
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId)
    throw new CustomerContextContractValidationError('Customer Context Workspace does not match.');
  return {
    schemaVersion: 1,
    workspaceId,
    customerRelationship: parseCustomerContextIdentityV1(v.customerRelationship, workspaceId),
    linkedWork: parseLinkedWork(v.linkedWork),
    authorityConsequences: parseAuthority(v.authorityConsequences)
  };
}

export function parseCustomerContextListV1(
  value: unknown,
  expectedWorkspaceId?: string
): CustomerContextListV1 {
  const v = record(value, 'customerContextList');
  if (v.schemaVersion !== 1)
    throw new CustomerContextContractValidationError(
      'customerContextList.schemaVersion must be 1.'
    );
  const workspaceId = text(v.workspaceId, 'customerContextList.workspaceId');
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId)
    throw new CustomerContextContractValidationError(
      'Customer Context List Workspace does not match.'
    );
  if (!Array.isArray(v.items))
    throw new CustomerContextContractValidationError('customerContextList.items must be an array.');
  const items = v.items.map((item) => parseCustomerContextIdentityV1(item, workspaceId));
  const page = positiveInteger(v.page, 'customerContextList.page');
  const pageSize = positiveInteger(v.pageSize, 'customerContextList.pageSize');
  const total = nonNegativeInteger(v.total, 'customerContextList.total');
  if (pageSize > 100)
    throw new CustomerContextContractValidationError(
      'customerContextList.pageSize cannot exceed 100.'
    );
  if (items.length > pageSize || total < items.length)
    throw new CustomerContextContractValidationError(
      'customerContextList pagination is inconsistent.'
    );
  return {
    schemaVersion: 1,
    workspaceId,
    page,
    pageSize,
    total,
    items,
    authorityConsequences: parseAuthority(v.authorityConsequences)
  };
}
