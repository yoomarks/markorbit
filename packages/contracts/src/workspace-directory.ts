import type { CustomerRelationshipId } from './customer-context.js';
import type { ProviderId } from './provider-execution.js';

/**
 * Workspace Directory is a Workspace-private operational directory only.
 * It is not a CRM, Party registry, KYC/legal-identity owner, contact-authorization owner,
 * CustomerRelationship owner, Applicant owner, Provider registry, or action-authority boundary.
 */
export type WorkspaceDirectoryEntryId = `workspace-directory-entry_${string}`;

export const workspaceDirectoryEntryKinds = ['ORGANIZATION', 'PERSON'] as const;
export type WorkspaceDirectoryEntryKind = (typeof workspaceDirectoryEntryKinds)[number];

export const workspaceDirectoryEntryStatuses = ['ACTIVE', 'ARCHIVED'] as const;
export type WorkspaceDirectoryEntryStatus = (typeof workspaceDirectoryEntryStatuses)[number];

export const workspaceDirectoryOperationalRoles = [
  'CLIENT_CONTACT',
  'TRADEMARK_OWNER_CONTACT',
  'INSTRUCTING_AGENT',
  'COOPERATING_AGENT',
  'FOREIGN_COUNSEL',
  'BILLING_CONTACT',
  'INTERNAL_OWNER',
  'OTHER'
] as const;
export type WorkspaceDirectoryOperationalRole = (typeof workspaceDirectoryOperationalRoles)[number];

export const workspaceDirectoryContactPointKinds = ['EMAIL', 'PHONE', 'ADDRESS'] as const;
export type WorkspaceDirectoryContactPointKind =
  (typeof workspaceDirectoryContactPointKinds)[number];

export const workspaceDirectoryLocalSourceKinds = [
  'WORKSPACE_USER',
  'IMPORT',
  'MANAGED_COMMUNICATION',
  'DATA_ENGINE',
  'OTHER_LOCAL_SOURCE'
] as const;
export type WorkspaceDirectoryLocalSourceKind = (typeof workspaceDirectoryLocalSourceKinds)[number];

export const workspaceDirectoryExternalIdentityKinds = [
  'APPLICANT_IDENTITY',
  'EXTERNAL_IDENTITY'
] as const;
export type WorkspaceDirectoryExternalIdentityKind =
  (typeof workspaceDirectoryExternalIdentityKinds)[number];

export const workspaceDirectoryExternalIdentitySourceClasses = [
  'DATA_ENGINE_CANDIDATE',
  'WORKSPACE_SUPPLIED',
  'EXTERNAL_REFERENCE'
] as const;
export type WorkspaceDirectoryExternalIdentitySourceClass =
  (typeof workspaceDirectoryExternalIdentitySourceClasses)[number];

export interface WorkspaceDirectoryLocalProvenanceV1 {
  sourceKind: WorkspaceDirectoryLocalSourceKind;
  sourceReference: string;
  capturedAt: string;
}

export interface WorkspaceDirectoryContactPointV1 {
  kind: WorkspaceDirectoryContactPointKind;
  value: string;
  label?: string;
  provenance: Readonly<WorkspaceDirectoryLocalProvenanceV1>;
}

/** Exact pointer to an existing CustomerRelationship owner record; no Customer data is copied. */
export interface WorkspaceDirectoryCustomerRelationshipReferenceV1 {
  owner: 'MARKREG';
  kind: 'CUSTOMER_RELATIONSHIP';
  workspaceId: string;
  customerRelationshipId: CustomerRelationshipId;
  version: number;
}

/**
 * Exact Provider identity pointer using the shared MGSN Provider vocabulary.
 * Provider records currently expose identity by providerId + providerWorkspaceId rather than a
 * versioned Provider record, so this contract deliberately does not invent a Provider version.
 */
export interface WorkspaceDirectoryProviderReferenceV1 {
  owner: 'MGSN';
  kind: 'PROVIDER';
  providerId: ProviderId;
  providerWorkspaceId: string;
}

/**
 * Bounded pointer/alias to external or applicant identity context. The Directory may retain the
 * reference for finding and organizing local work, but it never verifies the referenced identity.
 */
export interface WorkspaceDirectoryExternalIdentityReferenceV1 {
  kind: WorkspaceDirectoryExternalIdentityKind;
  sourceClass: WorkspaceDirectoryExternalIdentitySourceClass;
  referenceId: string;
  referenceVersion?: string;
  label?: string;
  jurisdiction?: string;
  observedAt: string;
  verifiedLegalIdentityByDirectory: false;
  managedTrademarkRelationshipEstablishedByDirectory: false;
}

export const noWorkspaceDirectoryAuthorityConsequencesV1 = Object.freeze({
  verifiedLegalIdentityEstablished: false,
  contactAuthorizationEstablished: false,
  customerInstructionEstablished: false,
  customerRelationshipCreatedByDirectory: false,
  applicantIdentityVerified: false,
  providerEnrollmentCreatedByDirectory: false,
  professionalAppointmentCreated: false,
  marketingConsentEstablished: false,
  managedTrademarkRelationshipCreated: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  externalActionAuthorized: false,
  officialTruthCreated: false
});
export type WorkspaceDirectoryAuthorityConsequencesV1 =
  typeof noWorkspaceDirectoryAuthorityConsequencesV1;

export interface WorkspaceDirectoryEntryV1 {
  schemaVersion: 1;
  workspaceDirectoryEntryId: WorkspaceDirectoryEntryId;
  workspaceId: string;
  version: number;
  entryKind: WorkspaceDirectoryEntryKind;
  displayName: string;
  aliases: readonly string[];
  status: WorkspaceDirectoryEntryStatus;
  roles: readonly WorkspaceDirectoryOperationalRole[];
  contactPoints: ReadonlyArray<Readonly<WorkspaceDirectoryContactPointV1>>;
  customerRelationship?: Readonly<WorkspaceDirectoryCustomerRelationshipReferenceV1>;
  provider?: Readonly<WorkspaceDirectoryProviderReferenceV1>;
  externalIdentityReferences: ReadonlyArray<
    Readonly<WorkspaceDirectoryExternalIdentityReferenceV1>
  >;
  provenance: Readonly<WorkspaceDirectoryLocalProvenanceV1>;
  authorityConsequences: Readonly<WorkspaceDirectoryAuthorityConsequencesV1>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export class WorkspaceDirectoryContractValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceDirectoryContractValidationError';
  }
}

type JsonRecord = Record<string, unknown>;
const directoryEntryIdPattern = /^workspace-directory-entry_[A-Za-z0-9_-]+$/u;
const customerRelationshipIdPattern = /^customer-relationship_[A-Za-z0-9_-]+$/u;
const providerIdPattern = /^provider_[A-Za-z0-9_-]+$/u;

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkspaceDirectoryContractValidationError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length > 0)
    throw new WorkspaceDirectoryContractValidationError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new WorkspaceDirectoryContractValidationError(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new WorkspaceDirectoryContractValidationError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return normalized;
}

function optionalText(value: unknown, field: string, maximum = 500): string | undefined {
  return value === undefined ? undefined : text(value, field, maximum);
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new WorkspaceDirectoryContractValidationError(`${field} must be an ISO timestamp.`);
  return result;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new WorkspaceDirectoryContractValidationError(
      `${field} must be a positive safe integer.`
    );
  return value as number;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== 'string' || !allowed.some((candidate) => candidate === value))
    throw new WorkspaceDirectoryContractValidationError(`${field} is invalid.`);
  return value;
}

function stringArray(
  value: unknown,
  field: string,
  maximumItems: number,
  maximumItemLength = 300
): readonly string[] {
  if (!Array.isArray(value) || value.length > maximumItems)
    throw new WorkspaceDirectoryContractValidationError(
      `${field} must be an array with at most ${maximumItems} items.`
    );
  const result = value.map((item, index) => text(item, `${field}[${index}]`, maximumItemLength));
  if (new Set(result).size !== result.length)
    throw new WorkspaceDirectoryContractValidationError(`${field} must not contain duplicates.`);
  return result;
}

function assertTimestampOrder(
  earlier: string,
  later: string,
  earlierField: string,
  laterField: string
): void {
  if (Date.parse(earlier) > Date.parse(later))
    throw new WorkspaceDirectoryContractValidationError(
      `${earlierField} cannot be after ${laterField}.`
    );
}

function parseProvenance(value: unknown, field: string): WorkspaceDirectoryLocalProvenanceV1 {
  const item = record(value, field);
  exactKeys(item, ['sourceKind', 'sourceReference', 'capturedAt'], field);
  return {
    sourceKind: oneOf(item.sourceKind, workspaceDirectoryLocalSourceKinds, `${field}.sourceKind`),
    sourceReference: text(item.sourceReference, `${field}.sourceReference`, 1000),
    capturedAt: timestamp(item.capturedAt, `${field}.capturedAt`)
  };
}

function parseContactPoint(value: unknown, index: number): WorkspaceDirectoryContactPointV1 {
  const field = `contactPoints[${index}]`;
  const item = record(value, field);
  exactKeys(item, ['kind', 'value', 'label', 'provenance'], field);
  const label = optionalText(item.label, `${field}.label`, 120);
  return {
    kind: oneOf(item.kind, workspaceDirectoryContactPointKinds, `${field}.kind`),
    value: text(item.value, `${field}.value`, 1000),
    ...(label ? { label } : {}),
    provenance: parseProvenance(item.provenance, `${field}.provenance`)
  };
}

function parseCustomerRelationshipReference(
  value: unknown,
  workspaceId: string
): WorkspaceDirectoryCustomerRelationshipReferenceV1 {
  const field = 'customerRelationship';
  const item = record(value, field);
  exactKeys(item, ['owner', 'kind', 'workspaceId', 'customerRelationshipId', 'version'], field);
  if (item.owner !== 'MARKREG' || item.kind !== 'CUSTOMER_RELATIONSHIP')
    throw new WorkspaceDirectoryContractValidationError(
      'customerRelationship owner/kind is invalid.'
    );
  const referenceWorkspaceId = text(item.workspaceId, 'customerRelationship.workspaceId', 240);
  if (referenceWorkspaceId !== workspaceId)
    throw new WorkspaceDirectoryContractValidationError(
      'customerRelationship Workspace does not match Directory entry Workspace.'
    );
  const id = text(item.customerRelationshipId, 'customerRelationship.customerRelationshipId', 240);
  if (!customerRelationshipIdPattern.test(id))
    throw new WorkspaceDirectoryContractValidationError(
      'customerRelationship.customerRelationshipId is invalid.'
    );
  return {
    owner: 'MARKREG',
    kind: 'CUSTOMER_RELATIONSHIP',
    workspaceId: referenceWorkspaceId,
    customerRelationshipId: id as CustomerRelationshipId,
    version: positiveInteger(item.version, 'customerRelationship.version')
  };
}

function parseProviderReference(value: unknown): WorkspaceDirectoryProviderReferenceV1 {
  const field = 'provider';
  const item = record(value, field);
  exactKeys(item, ['owner', 'kind', 'providerId', 'providerWorkspaceId'], field);
  if (item.owner !== 'MGSN' || item.kind !== 'PROVIDER')
    throw new WorkspaceDirectoryContractValidationError('provider owner/kind is invalid.');
  const providerId = text(item.providerId, 'provider.providerId', 240);
  if (!providerIdPattern.test(providerId))
    throw new WorkspaceDirectoryContractValidationError('provider.providerId is invalid.');
  return {
    owner: 'MGSN',
    kind: 'PROVIDER',
    providerId: providerId as ProviderId,
    providerWorkspaceId: text(item.providerWorkspaceId, 'provider.providerWorkspaceId', 240)
  };
}

function parseExternalIdentityReference(
  value: unknown,
  index: number
): WorkspaceDirectoryExternalIdentityReferenceV1 {
  const field = `externalIdentityReferences[${index}]`;
  const item = record(value, field);
  exactKeys(
    item,
    [
      'kind',
      'sourceClass',
      'referenceId',
      'referenceVersion',
      'label',
      'jurisdiction',
      'observedAt',
      'verifiedLegalIdentityByDirectory',
      'managedTrademarkRelationshipEstablishedByDirectory'
    ],
    field
  );
  if (item.verifiedLegalIdentityByDirectory !== false)
    throw new WorkspaceDirectoryContractValidationError(
      `${field}.verifiedLegalIdentityByDirectory must be false.`
    );
  if (item.managedTrademarkRelationshipEstablishedByDirectory !== false)
    throw new WorkspaceDirectoryContractValidationError(
      `${field}.managedTrademarkRelationshipEstablishedByDirectory must be false.`
    );
  const referenceVersion = optionalText(item.referenceVersion, `${field}.referenceVersion`, 240);
  const label = optionalText(item.label, `${field}.label`, 300);
  const jurisdiction = optionalText(item.jurisdiction, `${field}.jurisdiction`, 80);
  return {
    kind: oneOf(item.kind, workspaceDirectoryExternalIdentityKinds, `${field}.kind`),
    sourceClass: oneOf(
      item.sourceClass,
      workspaceDirectoryExternalIdentitySourceClasses,
      `${field}.sourceClass`
    ),
    referenceId: text(item.referenceId, `${field}.referenceId`, 1000),
    ...(referenceVersion ? { referenceVersion } : {}),
    ...(label ? { label } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    observedAt: timestamp(item.observedAt, `${field}.observedAt`),
    verifiedLegalIdentityByDirectory: false,
    managedTrademarkRelationshipEstablishedByDirectory: false
  };
}

function parseRoles(value: unknown): readonly WorkspaceDirectoryOperationalRole[] {
  if (!Array.isArray(value) || value.length > workspaceDirectoryOperationalRoles.length)
    throw new WorkspaceDirectoryContractValidationError(
      `roles must be an array with at most ${workspaceDirectoryOperationalRoles.length} items.`
    );
  const result = value.map((role, index) =>
    oneOf(role, workspaceDirectoryOperationalRoles, `roles[${index}]`)
  );
  if (new Set(result).size !== result.length)
    throw new WorkspaceDirectoryContractValidationError('roles must not contain duplicates.');
  return result;
}

function parseContactPoints(
  value: unknown
): ReadonlyArray<Readonly<WorkspaceDirectoryContactPointV1>> {
  if (!Array.isArray(value) || value.length > 50)
    throw new WorkspaceDirectoryContractValidationError(
      'contactPoints must be an array with at most 50 items.'
    );
  return value.map((contactPoint, index) => parseContactPoint(contactPoint, index));
}

function parseExternalIdentityReferences(
  value: unknown
): ReadonlyArray<Readonly<WorkspaceDirectoryExternalIdentityReferenceV1>> {
  if (!Array.isArray(value) || value.length > 50)
    throw new WorkspaceDirectoryContractValidationError(
      'externalIdentityReferences must be an array with at most 50 items.'
    );
  return value.map((reference, index) => parseExternalIdentityReference(reference, index));
}

function parseAuthority(value: unknown): Readonly<WorkspaceDirectoryAuthorityConsequencesV1> {
  const item = record(value, 'authorityConsequences');
  exactKeys(
    item,
    Object.keys(noWorkspaceDirectoryAuthorityConsequencesV1),
    'authorityConsequences'
  );
  for (const key of Object.keys(noWorkspaceDirectoryAuthorityConsequencesV1) as Array<
    keyof WorkspaceDirectoryAuthorityConsequencesV1
  >) {
    if (item[key] !== false)
      throw new WorkspaceDirectoryContractValidationError(
        `authorityConsequences.${key} must be false.`
      );
  }
  return noWorkspaceDirectoryAuthorityConsequencesV1;
}

export function parseWorkspaceDirectoryEntryV1(
  value: unknown,
  expectedWorkspaceId?: string
): WorkspaceDirectoryEntryV1 {
  const item = record(value, 'workspaceDirectoryEntry');
  exactKeys(
    item,
    [
      'schemaVersion',
      'workspaceDirectoryEntryId',
      'workspaceId',
      'version',
      'entryKind',
      'displayName',
      'aliases',
      'status',
      'roles',
      'contactPoints',
      'customerRelationship',
      'provider',
      'externalIdentityReferences',
      'provenance',
      'authorityConsequences',
      'createdAt',
      'updatedAt',
      'archivedAt'
    ],
    'workspaceDirectoryEntry'
  );
  if (item.schemaVersion !== 1)
    throw new WorkspaceDirectoryContractValidationError('schemaVersion must be 1.');

  const entryId = text(item.workspaceDirectoryEntryId, 'workspaceDirectoryEntryId', 240);
  if (!directoryEntryIdPattern.test(entryId))
    throw new WorkspaceDirectoryContractValidationError('workspaceDirectoryEntryId is invalid.');

  const workspaceId = text(item.workspaceId, 'workspaceId', 240);
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId)
    throw new WorkspaceDirectoryContractValidationError(
      'Directory entry Workspace does not match.'
    );

  const status = oneOf(item.status, workspaceDirectoryEntryStatuses, 'status');
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  assertTimestampOrder(createdAt, updatedAt, 'createdAt', 'updatedAt');
  const archivedAt = item.archivedAt === null ? null : timestamp(item.archivedAt, 'archivedAt');
  if (status === 'ACTIVE' && archivedAt !== null)
    throw new WorkspaceDirectoryContractValidationError(
      'ACTIVE Directory entry must have archivedAt = null.'
    );
  if (status === 'ARCHIVED' && archivedAt === null)
    throw new WorkspaceDirectoryContractValidationError(
      'ARCHIVED Directory entry requires archivedAt.'
    );
  if (archivedAt !== null) {
    assertTimestampOrder(createdAt, archivedAt, 'createdAt', 'archivedAt');
    assertTimestampOrder(archivedAt, updatedAt, 'archivedAt', 'updatedAt');
  }

  const provenance = parseProvenance(item.provenance, 'provenance');
  assertTimestampOrder(provenance.capturedAt, updatedAt, 'provenance.capturedAt', 'updatedAt');

  return {
    schemaVersion: 1,
    workspaceDirectoryEntryId: entryId as WorkspaceDirectoryEntryId,
    workspaceId,
    version: positiveInteger(item.version, 'version'),
    entryKind: oneOf(item.entryKind, workspaceDirectoryEntryKinds, 'entryKind'),
    displayName: text(item.displayName, 'displayName', 300),
    aliases: stringArray(item.aliases, 'aliases', 50, 300),
    status,
    roles: parseRoles(item.roles),
    contactPoints: parseContactPoints(item.contactPoints),
    ...(item.customerRelationship === undefined
      ? {}
      : {
          customerRelationship: parseCustomerRelationshipReference(
            item.customerRelationship,
            workspaceId
          )
        }),
    ...(item.provider === undefined ? {} : { provider: parseProviderReference(item.provider) }),
    externalIdentityReferences: parseExternalIdentityReferences(item.externalIdentityReferences),
    provenance,
    authorityConsequences: parseAuthority(item.authorityConsequences),
    createdAt,
    updatedAt,
    archivedAt
  };
}
