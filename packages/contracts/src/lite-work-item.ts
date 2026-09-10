import type { CustomerRelationshipId } from './customer-context.js';
import type { FormalMatterId, MarkOrbitId } from './index.js';
import type { TrademarkAssetManagementSignalSeverity } from './trademark-asset-management.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';
import type { WorkspaceDirectoryEntryId } from './workspace-directory.js';

/**
 * Lite Work Item is the Workspace-private owner of internal operational work only.
 * It is not Matter, Filing, Execution, Provider Work, Payment, Communication or Calendar truth.
 */
export type LiteWorkItemId = `lite-work-item_${string}`;

export const liteWorkItemTaskTypes = [
  'REPLY_PROVIDER',
  'NOTIFY_CLIENT',
  'PAYMENT_FOLLOW_UP',
  'WAIT_FOR_PROVIDER',
  'WAIT_FOR_CLIENT',
  'CHECK_DEADLINE',
  'DOCUMENT_FOLLOW_UP',
  'GENERAL_FOLLOW_UP',
  'OTHER'
] as const;
export type LiteWorkItemTaskType = (typeof liteWorkItemTaskTypes)[number];

export const liteWorkItemStatuses = [
  'OPEN',
  'WAITING_FOR_CLIENT',
  'WAITING_FOR_PROVIDER',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED'
] as const;
export type LiteWorkItemStatus = (typeof liteWorkItemStatuses)[number];

export const liteWorkItemPriorities = [
  'INFO',
  'NOTICE',
  'IMPORTANT',
  'URGENT'
] as const satisfies readonly TrademarkAssetManagementSignalSeverity[];
export type LiteWorkItemPriority = (typeof liteWorkItemPriorities)[number];

export const liteWorkItemSourceOwners = [
  'LITE',
  'MARKREG',
  'CAPABILITY_ENGINE',
  'DATA_ENGINE',
  'MGSN'
] as const;
export type LiteWorkItemSourceOwner = (typeof liteWorkItemSourceOwners)[number];

export const liteWorkItemSourceKinds = [
  'TODAY_RECOMMENDATION',
  'TRADEMARK_ASSET_MANAGEMENT_RECOMMENDATION',
  'MANAGED_COMMUNICATION_MESSAGE',
  'COMMUNICATION_LINK',
  'TRADEMARK_ASSET',
  'FORMAL_MATTER',
  'PRODUCTION_INTAKE',
  'CUSTOMER_RELATIONSHIP',
  'WORKSPACE_DIRECTORY_ENTRY',
  'PROVIDER_WORK',
  'TRADEMARK_SERVICE_WORK_PACKAGE',
  'DATA_ENGINE_OBSERVATION'
] as const;
export type LiteWorkItemSourceKind = (typeof liteWorkItemSourceKinds)[number];

export interface LiteWorkItemSourceReferenceV1 {
  owner: LiteWorkItemSourceOwner;
  kind: LiteWorkItemSourceKind;
  sourceId: string;
  sourceVersion: number | string;
  sourceFingerprintSha256: string;
  observedAt: string;
}

export interface LiteWorkItemManualSourceV1 {
  sourceClass: 'MANUAL';
  recordedByPrincipalId: string;
  recordedAt: string;
}

export interface LiteWorkItemSystemPreparedSourceV1 {
  sourceClass: 'SYSTEM_PREPARED';
  sourceReferences: readonly Readonly<LiteWorkItemSourceReferenceV1>[];
  preparationFingerprintSha256: string;
  idempotencyKey: string;
  preparedAt: string;
}

export type LiteWorkItemSourceV1 =
  Readonly<LiteWorkItemManualSourceV1> | Readonly<LiteWorkItemSystemPreparedSourceV1>;

export interface LiteWorkItemCustomerRelationshipReferenceV1 {
  owner: 'MARKREG';
  kind: 'CUSTOMER_RELATIONSHIP';
  workspaceId: string;
  referenceId: CustomerRelationshipId;
  referenceVersion: number;
}

export interface LiteWorkItemDirectoryReferenceV1 {
  owner: 'LITE';
  kind: 'WORKSPACE_DIRECTORY_ENTRY';
  workspaceId: string;
  referenceId: WorkspaceDirectoryEntryId;
  referenceVersion: number;
}

export interface LiteWorkItemTrademarkAssetReferenceV1 {
  owner: 'LITE';
  kind: 'TRADEMARK_ASSET';
  workspaceId: string;
  referenceId: TrademarkAssetId;
  referenceVersion: number;
}

export interface LiteWorkItemFormalMatterReferenceV1 {
  owner: 'MARKREG';
  kind: 'FORMAL_MATTER';
  workspaceId: string;
  referenceId: FormalMatterId;
  referenceVersion: number;
}

export interface LiteWorkItemProductionIntakeReferenceV1 {
  owner: 'MARKREG';
  kind: 'PRODUCTION_INTAKE';
  workspaceId: string;
  referenceId: MarkOrbitId;
  referenceVersion: number;
  referenceFingerprintSha256: string;
}

/**
 * Managed Communication messages are not versioned owner records. Exactness is preserved through
 * account + normalized message id + provider message identity + provider observation timestamp.
 */
export interface LiteWorkItemManagedCommunicationReferenceV1 {
  owner: 'CAPABILITY_ENGINE';
  kind: 'MANAGED_COMMUNICATION_MESSAGE';
  accountRef: string;
  referenceId: string;
  provider: string;
  providerMessageId: string;
  observedAt: string;
}

export type LiteWorkItemRelatedReferenceV1 =
  | Readonly<LiteWorkItemCustomerRelationshipReferenceV1>
  | Readonly<LiteWorkItemDirectoryReferenceV1>
  | Readonly<LiteWorkItemTrademarkAssetReferenceV1>
  | Readonly<LiteWorkItemFormalMatterReferenceV1>
  | Readonly<LiteWorkItemProductionIntakeReferenceV1>
  | Readonly<LiteWorkItemManagedCommunicationReferenceV1>;

/**
 * Exact pointer to MarkReg-owned certified deadline truth. The deadline value is deliberately not
 * copied into Lite Work Item; consumers must resolve the referenced owner field when projecting it.
 */
export interface LiteWorkItemCertifiedDeadlineReferenceV1 {
  owner: 'MARKREG';
  kind: 'MARKREG_LIFECYCLE_PROJECTION';
  referenceId: string;
  referenceVersion: number | string;
  deadlineField: string;
  certificationReference: string;
  checkedAt: string;
  legalDeadlineCertifiedByLite: false;
}

/** Source-derived candidate date only. It remains separate from owner-certified deadline truth. */
export interface LiteWorkItemObservedDateCandidateV1 {
  label: string;
  candidateAt: string;
  source: Readonly<LiteWorkItemSourceReferenceV1>;
  observedAt: string;
  legalDeadlineCertified: false;
  officialTruthVerified: false;
}

/** Lite-owned operational time only; none of these fields is a certified legal deadline. */
export interface LiteWorkItemInternalTimingV1 {
  timeClass: 'LITE_INTERNAL_OPERATIONAL';
  internalDueAt?: string;
  remindAt?: string;
  followUpAt?: string;
  certifiedLegalDeadline: false;
}

export const noLiteWorkItemAuthorityConsequencesV1 = Object.freeze({
  legalDeadlineCertified: false,
  filingAuthorized: false,
  filingSubmitted: false,
  protectedActionAuthorized: false,
  providerAcceptanceCreated: false,
  providerWorkCompleted: false,
  paymentAuthorized: false,
  paymentExecuted: false,
  customerContactAuthorized: false,
  providerContactAuthorized: false,
  customerNotificationEstablished: false,
  providerResponseEstablished: false,
  externalMessageSent: false,
  ownerRecordMutated: false,
  officialTruthCreated: false,
  workCompletionRepresentsExternalSuccess: false
});
export type LiteWorkItemAuthorityConsequencesV1 = typeof noLiteWorkItemAuthorityConsequencesV1;

export interface LiteWorkItemV1 {
  schemaVersion: 1;
  liteWorkItemId: LiteWorkItemId;
  workspaceId: string;
  version: number;
  taskType: LiteWorkItemTaskType;
  title: string;
  note?: string;
  priority: LiteWorkItemPriority;
  status: LiteWorkItemStatus;
  assigneePrincipalId?: string;
  source: Readonly<LiteWorkItemSourceV1>;
  relatedReferences: readonly Readonly<LiteWorkItemRelatedReferenceV1>[];
  certifiedDeadlineReferences: readonly Readonly<LiteWorkItemCertifiedDeadlineReferenceV1>[];
  observedDateCandidates: readonly Readonly<LiteWorkItemObservedDateCandidateV1>[];
  internalTiming: Readonly<LiteWorkItemInternalTimingV1>;
  waitingSinceAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
  archivedFrom: 'COMPLETED' | 'CANCELLED' | null;
  authorityConsequences: Readonly<LiteWorkItemAuthorityConsequencesV1>;
  createdAt: string;
  updatedAt: string;
}

export class LiteWorkItemContractValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'LiteWorkItemContractValidationError';
  }
}

type JsonRecord = Record<string, unknown>;

const workItemIdPattern = /^lite-work-item_[A-Za-z0-9_-]+$/u;
const customerRelationshipIdPattern = /^customer-relationship_[A-Za-z0-9_-]+$/u;
const directoryIdPattern = /^workspace-directory-entry_[A-Za-z0-9_-]+$/u;
const trademarkAssetIdPattern = /^trademark-asset_[A-Za-z0-9_-]+$/u;
const formalMatterIdPattern = /^formal-matter_[A-Za-z0-9_-]+$/u;
const markOrbitIdPattern = /^[a-z][a-z0-9-]*_[A-Za-z0-9][A-Za-z0-9_-]*$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;

const sourceOwnerByKind: Readonly<Record<LiteWorkItemSourceKind, LiteWorkItemSourceOwner>> = {
  TODAY_RECOMMENDATION: 'LITE',
  TRADEMARK_ASSET_MANAGEMENT_RECOMMENDATION: 'LITE',
  MANAGED_COMMUNICATION_MESSAGE: 'CAPABILITY_ENGINE',
  COMMUNICATION_LINK: 'LITE',
  TRADEMARK_ASSET: 'LITE',
  FORMAL_MATTER: 'MARKREG',
  PRODUCTION_INTAKE: 'MARKREG',
  CUSTOMER_RELATIONSHIP: 'MARKREG',
  WORKSPACE_DIRECTORY_ENTRY: 'LITE',
  PROVIDER_WORK: 'MGSN',
  TRADEMARK_SERVICE_WORK_PACKAGE: 'LITE',
  DATA_ENGINE_OBSERVATION: 'DATA_ENGINE'
};

const allowedStatusTransitions: Readonly<
  Record<LiteWorkItemStatus, readonly LiteWorkItemStatus[]>
> = {
  OPEN: ['WAITING_FOR_CLIENT', 'WAITING_FOR_PROVIDER', 'COMPLETED', 'CANCELLED'],
  WAITING_FOR_CLIENT: ['OPEN', 'COMPLETED', 'CANCELLED'],
  WAITING_FOR_PROVIDER: ['OPEN', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: []
};

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new LiteWorkItemContractValidationError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length > 0)
    throw new LiteWorkItemContractValidationError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new LiteWorkItemContractValidationError(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new LiteWorkItemContractValidationError(
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
    throw new LiteWorkItemContractValidationError(`${field} must be an ISO timestamp.`);
  return result;
}

function optionalTimestampOrNull(value: unknown, field: string): string | null {
  return value === null ? null : timestamp(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new LiteWorkItemContractValidationError(`${field} must be a positive safe integer.`);
  return Number(value);
}

function versionValue(value: unknown, field: string): number | string {
  if (typeof value === 'number') return positiveInteger(value, field);
  return text(value, field, 240);
}

function sha256(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!sha256Pattern.test(result))
    throw new LiteWorkItemContractValidationError(`${field} must be lowercase SHA-256 hex.`);
  return result;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== 'string' || !allowed.some((candidate) => candidate === value))
    throw new LiteWorkItemContractValidationError(`${field} is invalid.`);
  return value;
}

function assertTimestampOrder(
  earlier: string,
  later: string,
  earlierField: string,
  laterField: string
): void {
  if (Date.parse(earlier) > Date.parse(later))
    throw new LiteWorkItemContractValidationError(`${earlierField} cannot be after ${laterField}.`);
}

function parseSourceReference(value: unknown, field: string): LiteWorkItemSourceReferenceV1 {
  const item = record(value, field);
  exactKeys(
    item,
    ['owner', 'kind', 'sourceId', 'sourceVersion', 'sourceFingerprintSha256', 'observedAt'],
    field
  );
  const owner = oneOf(item.owner, liteWorkItemSourceOwners, `${field}.owner`);
  const kind = oneOf(item.kind, liteWorkItemSourceKinds, `${field}.kind`);
  if (sourceOwnerByKind[kind] !== owner)
    throw new LiteWorkItemContractValidationError(`${field} owner does not match source kind.`);
  return {
    owner,
    kind,
    sourceId: text(item.sourceId, `${field}.sourceId`, 1000),
    sourceVersion: versionValue(item.sourceVersion, `${field}.sourceVersion`),
    sourceFingerprintSha256: sha256(
      item.sourceFingerprintSha256,
      `${field}.sourceFingerprintSha256`
    ),
    observedAt: timestamp(item.observedAt, `${field}.observedAt`)
  };
}

function parseSource(value: unknown, createdAt: string): LiteWorkItemSourceV1 {
  const item = record(value, 'source');
  if (item.sourceClass === 'MANUAL') {
    exactKeys(item, ['sourceClass', 'recordedByPrincipalId', 'recordedAt'], 'source');
    const recordedAt = timestamp(item.recordedAt, 'source.recordedAt');
    assertTimestampOrder(recordedAt, createdAt, 'source.recordedAt', 'createdAt');
    return {
      sourceClass: 'MANUAL',
      recordedByPrincipalId: text(item.recordedByPrincipalId, 'source.recordedByPrincipalId', 240),
      recordedAt
    };
  }
  if (item.sourceClass === 'SYSTEM_PREPARED') {
    exactKeys(
      item,
      [
        'sourceClass',
        'sourceReferences',
        'preparationFingerprintSha256',
        'idempotencyKey',
        'preparedAt'
      ],
      'source'
    );
    if (!Array.isArray(item.sourceReferences) || item.sourceReferences.length === 0)
      throw new LiteWorkItemContractValidationError(
        'source.sourceReferences must be a non-empty array for SYSTEM_PREPARED.'
      );
    if (item.sourceReferences.length > 20)
      throw new LiteWorkItemContractValidationError(
        'source.sourceReferences must contain at most 20 items.'
      );
    const sourceReferences = item.sourceReferences.map((reference, index) =>
      parseSourceReference(reference, `source.sourceReferences[${index}]`)
    );
    const uniqueReferences = new Set(
      sourceReferences.map(
        (reference) =>
          `${reference.owner}:${reference.kind}:${reference.sourceId}:${reference.sourceVersion}`
      )
    );
    if (uniqueReferences.size !== sourceReferences.length)
      throw new LiteWorkItemContractValidationError(
        'source.sourceReferences must not contain duplicate exact references.'
      );
    const preparedAt = timestamp(item.preparedAt, 'source.preparedAt');
    assertTimestampOrder(preparedAt, createdAt, 'source.preparedAt', 'createdAt');
    return {
      sourceClass: 'SYSTEM_PREPARED',
      sourceReferences,
      preparationFingerprintSha256: sha256(
        item.preparationFingerprintSha256,
        'source.preparationFingerprintSha256'
      ),
      idempotencyKey: text(item.idempotencyKey, 'source.idempotencyKey', 500),
      preparedAt
    };
  }
  throw new LiteWorkItemContractValidationError('source.sourceClass is invalid.');
}

function parseWorkspaceScopedReferenceCommon(
  item: JsonRecord,
  field: string,
  workspaceId: string
): { referenceWorkspaceId: string; referenceVersion: number } {
  const referenceWorkspaceId = text(item.workspaceId, `${field}.workspaceId`, 240);
  if (referenceWorkspaceId !== workspaceId)
    throw new LiteWorkItemContractValidationError(
      `${field} Workspace does not match Work Item Workspace.`
    );
  return {
    referenceWorkspaceId,
    referenceVersion: positiveInteger(item.referenceVersion, `${field}.referenceVersion`)
  };
}

function parseRelatedReference(
  value: unknown,
  index: number,
  workspaceId: string
): LiteWorkItemRelatedReferenceV1 {
  const field = `relatedReferences[${index}]`;
  const item = record(value, field);
  const kind = text(item.kind, `${field}.kind`, 100);

  if (kind === 'CUSTOMER_RELATIONSHIP') {
    exactKeys(item, ['owner', 'kind', 'workspaceId', 'referenceId', 'referenceVersion'], field);
    if (item.owner !== 'MARKREG')
      throw new LiteWorkItemContractValidationError(`${field}.owner is invalid.`);
    const { referenceWorkspaceId, referenceVersion } = parseWorkspaceScopedReferenceCommon(
      item,
      field,
      workspaceId
    );
    const referenceId = text(item.referenceId, `${field}.referenceId`, 240);
    if (!customerRelationshipIdPattern.test(referenceId))
      throw new LiteWorkItemContractValidationError(`${field}.referenceId is invalid.`);
    return {
      owner: 'MARKREG',
      kind: 'CUSTOMER_RELATIONSHIP',
      workspaceId: referenceWorkspaceId,
      referenceId: referenceId as CustomerRelationshipId,
      referenceVersion
    };
  }

  if (kind === 'WORKSPACE_DIRECTORY_ENTRY') {
    exactKeys(item, ['owner', 'kind', 'workspaceId', 'referenceId', 'referenceVersion'], field);
    if (item.owner !== 'LITE')
      throw new LiteWorkItemContractValidationError(`${field}.owner is invalid.`);
    const { referenceWorkspaceId, referenceVersion } = parseWorkspaceScopedReferenceCommon(
      item,
      field,
      workspaceId
    );
    const referenceId = text(item.referenceId, `${field}.referenceId`, 240);
    if (!directoryIdPattern.test(referenceId))
      throw new LiteWorkItemContractValidationError(`${field}.referenceId is invalid.`);
    return {
      owner: 'LITE',
      kind: 'WORKSPACE_DIRECTORY_ENTRY',
      workspaceId: referenceWorkspaceId,
      referenceId: referenceId as WorkspaceDirectoryEntryId,
      referenceVersion
    };
  }

  if (kind === 'TRADEMARK_ASSET') {
    exactKeys(item, ['owner', 'kind', 'workspaceId', 'referenceId', 'referenceVersion'], field);
    if (item.owner !== 'LITE')
      throw new LiteWorkItemContractValidationError(`${field}.owner is invalid.`);
    const { referenceWorkspaceId, referenceVersion } = parseWorkspaceScopedReferenceCommon(
      item,
      field,
      workspaceId
    );
    const referenceId = text(item.referenceId, `${field}.referenceId`, 240);
    if (!trademarkAssetIdPattern.test(referenceId))
      throw new LiteWorkItemContractValidationError(`${field}.referenceId is invalid.`);
    return {
      owner: 'LITE',
      kind: 'TRADEMARK_ASSET',
      workspaceId: referenceWorkspaceId,
      referenceId: referenceId as TrademarkAssetId,
      referenceVersion
    };
  }

  if (kind === 'FORMAL_MATTER') {
    exactKeys(item, ['owner', 'kind', 'workspaceId', 'referenceId', 'referenceVersion'], field);
    if (item.owner !== 'MARKREG')
      throw new LiteWorkItemContractValidationError(`${field}.owner is invalid.`);
    const { referenceWorkspaceId, referenceVersion } = parseWorkspaceScopedReferenceCommon(
      item,
      field,
      workspaceId
    );
    const referenceId = text(item.referenceId, `${field}.referenceId`, 240);
    if (!formalMatterIdPattern.test(referenceId))
      throw new LiteWorkItemContractValidationError(`${field}.referenceId is invalid.`);
    return {
      owner: 'MARKREG',
      kind: 'FORMAL_MATTER',
      workspaceId: referenceWorkspaceId,
      referenceId: referenceId as FormalMatterId,
      referenceVersion
    };
  }

  if (kind === 'PRODUCTION_INTAKE') {
    exactKeys(
      item,
      [
        'owner',
        'kind',
        'workspaceId',
        'referenceId',
        'referenceVersion',
        'referenceFingerprintSha256'
      ],
      field
    );
    if (item.owner !== 'MARKREG')
      throw new LiteWorkItemContractValidationError(`${field}.owner is invalid.`);
    const { referenceWorkspaceId, referenceVersion } = parseWorkspaceScopedReferenceCommon(
      item,
      field,
      workspaceId
    );
    const referenceId = text(item.referenceId, `${field}.referenceId`, 240);
    if (!markOrbitIdPattern.test(referenceId))
      throw new LiteWorkItemContractValidationError(`${field}.referenceId is invalid.`);
    return {
      owner: 'MARKREG',
      kind: 'PRODUCTION_INTAKE',
      workspaceId: referenceWorkspaceId,
      referenceId: referenceId as MarkOrbitId,
      referenceVersion,
      referenceFingerprintSha256: sha256(
        item.referenceFingerprintSha256,
        `${field}.referenceFingerprintSha256`
      )
    };
  }

  if (kind === 'MANAGED_COMMUNICATION_MESSAGE') {
    exactKeys(
      item,
      ['owner', 'kind', 'accountRef', 'referenceId', 'provider', 'providerMessageId', 'observedAt'],
      field
    );
    if (item.owner !== 'CAPABILITY_ENGINE')
      throw new LiteWorkItemContractValidationError(`${field}.owner is invalid.`);
    return {
      owner: 'CAPABILITY_ENGINE',
      kind: 'MANAGED_COMMUNICATION_MESSAGE',
      accountRef: text(item.accountRef, `${field}.accountRef`, 500),
      referenceId: text(item.referenceId, `${field}.referenceId`, 500),
      provider: text(item.provider, `${field}.provider`, 120),
      providerMessageId: text(item.providerMessageId, `${field}.providerMessageId`, 500),
      observedAt: timestamp(item.observedAt, `${field}.observedAt`)
    };
  }

  throw new LiteWorkItemContractValidationError(`${field}.kind is invalid.`);
}

function relatedReferenceKey(reference: LiteWorkItemRelatedReferenceV1): string {
  if (reference.kind === 'MANAGED_COMMUNICATION_MESSAGE')
    return `${reference.owner}:${reference.kind}:${reference.accountRef}:${reference.referenceId}:${reference.providerMessageId}`;
  return `${reference.owner}:${reference.kind}:${reference.workspaceId}:${reference.referenceId}:${reference.referenceVersion}`;
}

function parseRelatedReferences(
  value: unknown,
  workspaceId: string
): readonly Readonly<LiteWorkItemRelatedReferenceV1>[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new LiteWorkItemContractValidationError(
      'relatedReferences must be an array with at most 50 items.'
    );
  const references = value.map((reference, index) =>
    parseRelatedReference(reference, index, workspaceId)
  );
  const keys = references.map(relatedReferenceKey);
  if (new Set(keys).size !== keys.length)
    throw new LiteWorkItemContractValidationError(
      'relatedReferences must not contain duplicate exact references.'
    );
  return references;
}

function parseCertifiedDeadlineReference(
  value: unknown,
  index: number
): LiteWorkItemCertifiedDeadlineReferenceV1 {
  const field = `certifiedDeadlineReferences[${index}]`;
  const item = record(value, field);
  exactKeys(
    item,
    [
      'owner',
      'kind',
      'referenceId',
      'referenceVersion',
      'deadlineField',
      'certificationReference',
      'checkedAt',
      'legalDeadlineCertifiedByLite'
    ],
    field
  );
  if (item.owner !== 'MARKREG' || item.kind !== 'MARKREG_LIFECYCLE_PROJECTION')
    throw new LiteWorkItemContractValidationError(`${field} owner/kind is invalid.`);
  if (item.legalDeadlineCertifiedByLite !== false)
    throw new LiteWorkItemContractValidationError(
      `${field}.legalDeadlineCertifiedByLite must be false.`
    );
  return {
    owner: 'MARKREG',
    kind: 'MARKREG_LIFECYCLE_PROJECTION',
    referenceId: text(item.referenceId, `${field}.referenceId`, 1000),
    referenceVersion: versionValue(item.referenceVersion, `${field}.referenceVersion`),
    deadlineField: text(item.deadlineField, `${field}.deadlineField`, 200),
    certificationReference: text(
      item.certificationReference,
      `${field}.certificationReference`,
      1000
    ),
    checkedAt: timestamp(item.checkedAt, `${field}.checkedAt`),
    legalDeadlineCertifiedByLite: false
  };
}

function parseCertifiedDeadlineReferences(
  value: unknown
): readonly Readonly<LiteWorkItemCertifiedDeadlineReferenceV1>[] {
  if (!Array.isArray(value) || value.length > 10)
    throw new LiteWorkItemContractValidationError(
      'certifiedDeadlineReferences must be an array with at most 10 items.'
    );
  return value.map((reference, index) => parseCertifiedDeadlineReference(reference, index));
}

function parseObservedDateCandidate(
  value: unknown,
  index: number
): LiteWorkItemObservedDateCandidateV1 {
  const field = `observedDateCandidates[${index}]`;
  const item = record(value, field);
  exactKeys(
    item,
    [
      'label',
      'candidateAt',
      'source',
      'observedAt',
      'legalDeadlineCertified',
      'officialTruthVerified'
    ],
    field
  );
  if (item.legalDeadlineCertified !== false)
    throw new LiteWorkItemContractValidationError(`${field}.legalDeadlineCertified must be false.`);
  if (item.officialTruthVerified !== false)
    throw new LiteWorkItemContractValidationError(`${field}.officialTruthVerified must be false.`);
  const source = parseSourceReference(item.source, `${field}.source`);
  const observedAt = timestamp(item.observedAt, `${field}.observedAt`);
  assertTimestampOrder(
    source.observedAt,
    observedAt,
    `${field}.source.observedAt`,
    `${field}.observedAt`
  );
  return {
    label: text(item.label, `${field}.label`, 300),
    candidateAt: timestamp(item.candidateAt, `${field}.candidateAt`),
    source,
    observedAt,
    legalDeadlineCertified: false,
    officialTruthVerified: false
  };
}

function parseObservedDateCandidates(
  value: unknown
): readonly Readonly<LiteWorkItemObservedDateCandidateV1>[] {
  if (!Array.isArray(value) || value.length > 20)
    throw new LiteWorkItemContractValidationError(
      'observedDateCandidates must be an array with at most 20 items.'
    );
  return value.map((candidate, index) => parseObservedDateCandidate(candidate, index));
}

function parseInternalTiming(value: unknown): LiteWorkItemInternalTimingV1 {
  const item = record(value, 'internalTiming');
  exactKeys(
    item,
    ['timeClass', 'internalDueAt', 'remindAt', 'followUpAt', 'certifiedLegalDeadline'],
    'internalTiming'
  );
  if (item.timeClass !== 'LITE_INTERNAL_OPERATIONAL')
    throw new LiteWorkItemContractValidationError('internalTiming.timeClass is invalid.');
  if (item.certifiedLegalDeadline !== false)
    throw new LiteWorkItemContractValidationError(
      'internalTiming.certifiedLegalDeadline must be false.'
    );
  const internalDueAt =
    item.internalDueAt === undefined
      ? undefined
      : timestamp(item.internalDueAt, 'internalTiming.internalDueAt');
  const remindAt =
    item.remindAt === undefined ? undefined : timestamp(item.remindAt, 'internalTiming.remindAt');
  const followUpAt =
    item.followUpAt === undefined
      ? undefined
      : timestamp(item.followUpAt, 'internalTiming.followUpAt');
  return {
    timeClass: 'LITE_INTERNAL_OPERATIONAL',
    ...(internalDueAt ? { internalDueAt } : {}),
    ...(remindAt ? { remindAt } : {}),
    ...(followUpAt ? { followUpAt } : {}),
    certifiedLegalDeadline: false
  };
}

function parseAuthority(value: unknown): Readonly<LiteWorkItemAuthorityConsequencesV1> {
  const item = record(value, 'authorityConsequences');
  exactKeys(item, Object.keys(noLiteWorkItemAuthorityConsequencesV1), 'authorityConsequences');
  for (const key of Object.keys(noLiteWorkItemAuthorityConsequencesV1) as Array<
    keyof LiteWorkItemAuthorityConsequencesV1
  >) {
    if (item[key] !== false)
      throw new LiteWorkItemContractValidationError(`authorityConsequences.${key} must be false.`);
  }
  return noLiteWorkItemAuthorityConsequencesV1;
}

function assertLifecycle(
  status: LiteWorkItemStatus,
  createdAt: string,
  updatedAt: string,
  waitingSinceAt: string | null,
  completedAt: string | null,
  cancelledAt: string | null,
  archivedAt: string | null,
  archivedFrom: 'COMPLETED' | 'CANCELLED' | null
): void {
  const waiting = status === 'WAITING_FOR_CLIENT' || status === 'WAITING_FOR_PROVIDER';
  if (waiting !== (waitingSinceAt !== null))
    throw new LiteWorkItemContractValidationError(
      'waitingSinceAt must be present exactly for waiting statuses.'
    );
  if (
    status === 'COMPLETED' &&
    (completedAt === null || cancelledAt !== null || archivedAt !== null)
  )
    throw new LiteWorkItemContractValidationError(
      'COMPLETED Work Item requires completedAt only among terminal timestamps.'
    );
  if (
    status === 'CANCELLED' &&
    (cancelledAt === null || completedAt !== null || archivedAt !== null)
  )
    throw new LiteWorkItemContractValidationError(
      'CANCELLED Work Item requires cancelledAt only among terminal timestamps.'
    );
  if (
    (status === 'OPEN' || waiting) &&
    (completedAt !== null || cancelledAt !== null || archivedAt !== null || archivedFrom !== null)
  )
    throw new LiteWorkItemContractValidationError(
      'Open or waiting Work Item cannot carry terminal or archive state.'
    );
  if (status !== 'ARCHIVED' && archivedFrom !== null)
    throw new LiteWorkItemContractValidationError(
      'archivedFrom is valid only for ARCHIVED Work Item.'
    );
  if (status === 'ARCHIVED') {
    if (archivedAt === null || archivedFrom === null)
      throw new LiteWorkItemContractValidationError(
        'ARCHIVED Work Item requires archivedAt and archivedFrom.'
      );
    if (
      (archivedFrom === 'COMPLETED' && (completedAt === null || cancelledAt !== null)) ||
      (archivedFrom === 'CANCELLED' && (cancelledAt === null || completedAt !== null))
    )
      throw new LiteWorkItemContractValidationError(
        'ARCHIVED Work Item terminal timestamp must match archivedFrom.'
      );
  }
  for (const [field, value] of [
    ['waitingSinceAt', waitingSinceAt],
    ['completedAt', completedAt],
    ['cancelledAt', cancelledAt],
    ['archivedAt', archivedAt]
  ] as const) {
    if (value !== null) {
      assertTimestampOrder(createdAt, value, 'createdAt', field);
      assertTimestampOrder(value, updatedAt, field, 'updatedAt');
    }
  }
  if (archivedAt !== null) {
    const terminalAt = archivedFrom === 'COMPLETED' ? completedAt : cancelledAt;
    if (terminalAt !== null)
      assertTimestampOrder(terminalAt, archivedAt, 'terminalAt', 'archivedAt');
  }
}

export function isLiteWorkItemStatusTransitionAllowedV1(
  from: LiteWorkItemStatus,
  to: LiteWorkItemStatus
): boolean {
  return allowedStatusTransitions[from].includes(to);
}

export function parseLiteWorkItemV1(value: unknown, expectedWorkspaceId?: string): LiteWorkItemV1 {
  const item = record(value, 'liteWorkItem');
  exactKeys(
    item,
    [
      'schemaVersion',
      'liteWorkItemId',
      'workspaceId',
      'version',
      'taskType',
      'title',
      'note',
      'priority',
      'status',
      'assigneePrincipalId',
      'source',
      'relatedReferences',
      'certifiedDeadlineReferences',
      'observedDateCandidates',
      'internalTiming',
      'waitingSinceAt',
      'completedAt',
      'cancelledAt',
      'archivedAt',
      'archivedFrom',
      'authorityConsequences',
      'createdAt',
      'updatedAt'
    ],
    'liteWorkItem'
  );
  if (item.schemaVersion !== 1)
    throw new LiteWorkItemContractValidationError('schemaVersion must be 1.');

  const liteWorkItemId = text(item.liteWorkItemId, 'liteWorkItemId', 240);
  if (!workItemIdPattern.test(liteWorkItemId))
    throw new LiteWorkItemContractValidationError('liteWorkItemId is invalid.');
  const workspaceId = text(item.workspaceId, 'workspaceId', 240);
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId)
    throw new LiteWorkItemContractValidationError('Work Item Workspace does not match.');

  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  assertTimestampOrder(createdAt, updatedAt, 'createdAt', 'updatedAt');
  const status = oneOf(item.status, liteWorkItemStatuses, 'status');
  const waitingSinceAt = optionalTimestampOrNull(item.waitingSinceAt, 'waitingSinceAt');
  const completedAt = optionalTimestampOrNull(item.completedAt, 'completedAt');
  const cancelledAt = optionalTimestampOrNull(item.cancelledAt, 'cancelledAt');
  const archivedAt = optionalTimestampOrNull(item.archivedAt, 'archivedAt');
  const archivedFrom =
    item.archivedFrom === null
      ? null
      : oneOf(item.archivedFrom, ['COMPLETED', 'CANCELLED'] as const, 'archivedFrom');
  assertLifecycle(
    status,
    createdAt,
    updatedAt,
    waitingSinceAt,
    completedAt,
    cancelledAt,
    archivedAt,
    archivedFrom
  );

  const note = optionalText(item.note, 'note', 4000);
  const assigneePrincipalId = optionalText(item.assigneePrincipalId, 'assigneePrincipalId', 240);

  return {
    schemaVersion: 1,
    liteWorkItemId: liteWorkItemId as LiteWorkItemId,
    workspaceId,
    version: positiveInteger(item.version, 'version'),
    taskType: oneOf(item.taskType, liteWorkItemTaskTypes, 'taskType'),
    title: text(item.title, 'title', 500),
    ...(note ? { note } : {}),
    priority: oneOf(item.priority, liteWorkItemPriorities, 'priority'),
    status,
    ...(assigneePrincipalId ? { assigneePrincipalId } : {}),
    source: parseSource(item.source, createdAt),
    relatedReferences: parseRelatedReferences(item.relatedReferences, workspaceId),
    certifiedDeadlineReferences: parseCertifiedDeadlineReferences(item.certifiedDeadlineReferences),
    observedDateCandidates: parseObservedDateCandidates(item.observedDateCandidates),
    internalTiming: parseInternalTiming(item.internalTiming),
    waitingSinceAt,
    completedAt,
    cancelledAt,
    archivedAt,
    archivedFrom,
    authorityConsequences: parseAuthority(item.authorityConsequences),
    createdAt,
    updatedAt
  };
}
