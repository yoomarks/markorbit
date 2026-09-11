import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { isMarkOrbitId, type Channel, type MarkOrbitId, type RelationshipModel } from './index.js';
import {
  parseCreateProductionIntakeCommandV1,
  type ProductionIntakeInputV1
} from './markreg-early-funnel.js';

export type LiteIntakeStagingId = `lite-intake-staging_${string}`;
export type LiteIntakeSourceId = `lite-intake-source_${string}`;
export type LiteIntakeAiExtractionId = `lite-intake-ai_${string}`;
export type LiteIntakeCaseCandidateId = `lite-intake-case_${string}`;
export type LiteIntakeFieldCandidateId = `lite-intake-field_${string}`;

export const liteIntakePrimarySourceKinds = [
  'USER_INLINE_TEXT',
  'MANAGED_COMMUNICATION_MESSAGE',
  'MANAGED_COMMUNICATION_ATTACHMENT'
] as const;
export type LiteIntakePrimarySourceKind = (typeof liteIntakePrimarySourceKinds)[number];

export const liteIntakeAttachmentAvailabilityStates = ['AVAILABLE', 'UNAVAILABLE'] as const;
export type LiteIntakeAttachmentAvailability =
  (typeof liteIntakeAttachmentAvailabilityStates)[number];

export const liteIntakeCandidateOrigins = ['USER_SUPPLIED', 'EXTRACTED', 'USER_CORRECTED'] as const;
export type LiteIntakeCandidateOrigin = (typeof liteIntakeCandidateOrigins)[number];

export const liteIntakeFieldReviewStates = [
  'UNREVIEWED',
  'CONFIRMED',
  'CORRECTED',
  'REJECTED',
  'CONFLICTING',
  'MISSING'
] as const;
export type LiteIntakeFieldReviewState = (typeof liteIntakeFieldReviewStates)[number];

export const liteIntakeCaseStates = [
  'DRAFT',
  'EXTRACTING',
  'NEEDS_REVIEW',
  'NEEDS_INFORMATION',
  'READY_TO_COMMIT',
  'COMMITTING',
  'COMMIT_UNCERTAIN',
  'COMMITTED',
  'ARCHIVED'
] as const;
export type LiteIntakeCaseState = (typeof liteIntakeCaseStates)[number];

export const liteIntakeStagingLifecycles = ['ACTIVE', 'ARCHIVED'] as const;
export type LiteIntakeStagingLifecycle = (typeof liteIntakeStagingLifecycles)[number];

export const liteIntakeFieldPaths = [
  'channel',
  'relationshipModel',
  'input.businessContext',
  'input.applicant.type',
  'input.applicant.name',
  'input.applicant.country',
  'input.trademark.type',
  'input.trademark.representationText',
  'input.targetJurisdictions',
  'input.goodsServices.sourceText',
  'input.filingGoal'
] as const;
export type LiteIntakeFieldPath = (typeof liteIntakeFieldPaths)[number];

export interface LiteIntakeExactEvidencePointerV1 {
  owner: 'MANAGED_COMMUNICATION';
  evidenceRef: string;
  sha256: string;
  mediaType: string;
  sizeBytes: number;
  observedAt: string;
}

export interface LiteIntakeUserInlineTextSourceV1 {
  sourceId: LiteIntakeSourceId;
  kind: 'USER_INLINE_TEXT';
  owner: 'LITE';
  textSnapshot: string;
  sha256: string;
  sizeBytes: number;
  recordedByPrincipalId: string;
  recordedAt: string;
}

export interface LiteIntakeManagedCommunicationMessageSourceV1 {
  sourceId: LiteIntakeSourceId;
  kind: 'MANAGED_COMMUNICATION_MESSAGE';
  owner: 'MANAGED_COMMUNICATION';
  accountRef: string;
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  observedAt: string;
  exactEvidence: Readonly<LiteIntakeExactEvidencePointerV1> | null;
}

export interface LiteIntakeManagedCommunicationAttachmentSourceV1 {
  sourceId: LiteIntakeSourceId;
  kind: 'MANAGED_COMMUNICATION_ATTACHMENT';
  owner: 'MANAGED_COMMUNICATION';
  accountRef: string;
  messageId: string;
  threadRef: string;
  provider: string;
  providerMessageId: string;
  observedAt: string;
  attachmentRef: string;
  fileName: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  availability: LiteIntakeAttachmentAvailability;
}

export type LiteIntakePrimarySourceV1 =
  | LiteIntakeUserInlineTextSourceV1
  | LiteIntakeManagedCommunicationMessageSourceV1
  | LiteIntakeManagedCommunicationAttachmentSourceV1;

/** Managed AI is derivation provenance only and never a primary filing-fact source. */
export interface LiteIntakeManagedAiExtractionRefV1 {
  extractionId: LiteIntakeAiExtractionId;
  owner: 'MANAGED_AI';
  implementationProfileId: string;
  implementationProfileVersion: number;
  implementationKey: string;
  provider: string;
  model: string;
  promptPolicyId: string;
  promptPolicyVersion: string;
  outputSchemaId: string;
  inputSha256: string;
  outputSha256: string;
  outputRef: string | null;
  completedAt: string;
  sourceIds: readonly LiteIntakeSourceId[];
}

export type LiteIntakeCandidateValueV1 = string | readonly string[] | null;

export interface LiteIntakeFieldCandidateV1 {
  fieldCandidateId: LiteIntakeFieldCandidateId;
  fieldPath: LiteIntakeFieldPath;
  proposedValue: LiteIntakeCandidateValueV1;
  originClass: LiteIntakeCandidateOrigin | null;
  sourceIds: readonly LiteIntakeSourceId[];
  aiExtractionIds: readonly LiteIntakeAiExtractionId[];
  reviewState: LiteIntakeFieldReviewState;
  reviewedByPrincipalId: string | null;
  reviewedAt: string | null;
}

export interface LiteIntakeReviewedMaterialV1 {
  channel: Channel;
  relationshipModel: RelationshipModel;
  input: Readonly<ProductionIntakeInputV1>;
}

export interface LiteIntakeReviewedCommitV1 {
  reviewedStagingVersion: number;
  reviewedContentVersion: number;
  material: Readonly<LiteIntakeReviewedMaterialV1>;
  reviewedFingerprintSha256: string;
  confirmedByPrincipalId: string;
  confirmedAt: string;
  markRegIdempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface LiteIntakeProductionIntakeReceiptV1 {
  intakeId: MarkOrbitId;
  version: number;
  fingerprintSha256: string;
  reviewedFingerprintSha256: string;
  committedAt: string;
}

export interface LiteIntakeCaseCandidateV1 {
  caseCandidateId: LiteIntakeCaseCandidateId;
  contentVersion: number;
  state: LiteIntakeCaseState;
  fieldCandidates: readonly Readonly<LiteIntakeFieldCandidateV1>[];
  reviewedCommit: Readonly<LiteIntakeReviewedCommitV1> | null;
  productionIntakeReceipt: Readonly<LiteIntakeProductionIntakeReceiptV1> | null;
  archivedAt: string | null;
}

export const noLiteIntakeStagingAuthorityConsequencesV1 = Object.freeze({
  customerInstructionTruthCreated: false,
  customerRelationshipMutated: false,
  trademarkAssetMutated: false,
  formalMatterMutated: false,
  filingAuthorizationCreated: false,
  filingSubmitted: false,
  paymentCreated: false,
  externalMessageSent: false,
  officialTruthCreated: false,
  legalConclusionCreated: false,
  protectedActionAuthorized: false,
  externalActionAuthorized: false
});
export type LiteIntakeStagingAuthorityConsequencesV1 =
  typeof noLiteIntakeStagingAuthorityConsequencesV1;

export interface LiteIntakeStagingV1 {
  schemaVersion: 1;
  stagingId: LiteIntakeStagingId;
  workspaceId: string;
  version: number;
  lifecycle: LiteIntakeStagingLifecycle;
  sources: readonly Readonly<LiteIntakePrimarySourceV1>[];
  aiExtractions: readonly Readonly<LiteIntakeManagedAiExtractionRefV1>[];
  caseCandidates: readonly Readonly<LiteIntakeCaseCandidateV1>[];
  authorityConsequences: Readonly<LiteIntakeStagingAuthorityConsequencesV1>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export class LiteIntakeStagingContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'LiteIntakeStagingContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const stagingIdPattern = /^lite-intake-staging_[A-Za-z0-9_-]+$/u;
const sourceIdPattern = /^lite-intake-source_[A-Za-z0-9_-]+$/u;
const extractionIdPattern = /^lite-intake-ai_[A-Za-z0-9_-]+$/u;
const caseIdPattern = /^lite-intake-case_[A-Za-z0-9_-]+$/u;
const fieldCandidateIdPattern = /^lite-intake-field_[A-Za-z0-9_-]+$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LiteIntakeStagingContractError(`${field} must be an object.`);
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allow = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allow.has(key));
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (unsupported.length > 0 || missing.length > 0) {
    throw new LiteIntakeStagingContractError(
      `${field} must contain exactly the V1 fields; unsupported=${unsupported.join(',') || 'none'}; missing=${missing.join(',') || 'none'}.`
    );
  }
}

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string') {
    throw new LiteIntakeStagingContractError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new LiteIntakeStagingContractError(`${field} must contain 1 to ${maximum} characters.`);
  }
  return normalized;
}

function exactText(value: unknown, field: string, maximum = 20_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new LiteIntakeStagingContractError(`${field} must contain 1 to ${maximum} characters.`);
  }
  return value;
}

function nullableText(value: unknown, field: string, maximum = 1000): string | null {
  return value === null ? null : text(value, field, maximum);
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new LiteIntakeStagingContractError(`${field} must be a positive safe integer.`);
  }
  return value as number;
}

function nullableNonNegativeInteger(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new LiteIntakeStagingContractError(
      `${field} must be null or a non-negative safe integer.`
    );
  }
  return value as number;
}

function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new LiteIntakeStagingContractError(`${field} must be a canonical ISO timestamp.`);
  }
  return normalized;
}

function nullableTimestamp(value: unknown, field: string): string | null {
  return value === null ? null : timestamp(value, field);
}

function sha256(value: unknown, field: string): string {
  const normalized = text(value, field, 64);
  if (!sha256Pattern.test(normalized)) {
    throw new LiteIntakeStagingContractError(`${field} must be lowercase SHA-256 hex.`);
  }
  return normalized;
}

function nullableSha256(value: unknown, field: string): string | null {
  return value === null ? null : sha256(value, field);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new LiteIntakeStagingContractError(`${field} is invalid.`);
  }
  return value as T;
}

function literal<T extends string>(value: unknown, expected: T, field: string): T {
  if (value !== expected) {
    throw new LiteIntakeStagingContractError(`${field} must be ${expected}.`);
  }
  return expected;
}

function brandedId<T extends string>(value: unknown, pattern: RegExp, field: string): T {
  const normalized = text(value, field, 240);
  if (!pattern.test(normalized)) {
    throw new LiteIntakeStagingContractError(`${field} is invalid.`);
  }
  return normalized as T;
}

function uniqueStrings<T extends string>(
  value: unknown,
  field: string,
  parser: (item: unknown, itemField: string) => T,
  maximum = 50,
  allowEmpty = true
): readonly T[] {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) {
    throw new LiteIntakeStagingContractError(
      `${field} must be an array with ${allowEmpty ? '0' : '1'} to ${maximum} items.`
    );
  }
  const parsed = value.map((item, index) => parser(item, `${field}[${index}]`));
  if (new Set(parsed).size !== parsed.length) {
    throw new LiteIntakeStagingContractError(`${field} must contain unique items.`);
  }
  return parsed;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

export function liteIntakeReviewedMaterialFingerprintSha256V1(
  material: Readonly<LiteIntakeReviewedMaterialV1>
): string {
  return digest(material);
}

export function liteIntakeInlineTextSha256V1(textSnapshot: string): string {
  return createHash('sha256').update(textSnapshot, 'utf8').digest('hex');
}

function parseExactEvidence(value: unknown): LiteIntakeExactEvidencePointerV1 {
  const v = record(value, 'source.exactEvidence');
  exactKeys(
    v,
    ['owner', 'evidenceRef', 'sha256', 'mediaType', 'sizeBytes', 'observedAt'],
    'source.exactEvidence'
  );
  return {
    owner: literal(v.owner, 'MANAGED_COMMUNICATION', 'source.exactEvidence.owner'),
    evidenceRef: text(v.evidenceRef, 'source.exactEvidence.evidenceRef'),
    sha256: sha256(v.sha256, 'source.exactEvidence.sha256'),
    mediaType: text(v.mediaType, 'source.exactEvidence.mediaType', 200),
    sizeBytes: positiveInteger(v.sizeBytes, 'source.exactEvidence.sizeBytes'),
    observedAt: timestamp(v.observedAt, 'source.exactEvidence.observedAt')
  };
}

function parseSource(value: unknown): LiteIntakePrimarySourceV1 {
  const v = record(value, 'source');
  const kind = oneOf(v.kind, liteIntakePrimarySourceKinds, 'source.kind');
  if (kind === 'USER_INLINE_TEXT') {
    exactKeys(
      v,
      [
        'sourceId',
        'kind',
        'owner',
        'textSnapshot',
        'sha256',
        'sizeBytes',
        'recordedByPrincipalId',
        'recordedAt'
      ],
      'source'
    );
    const textSnapshot = exactText(v.textSnapshot, 'source.textSnapshot');
    const digestValue = sha256(v.sha256, 'source.sha256');
    const sizeBytes = positiveInteger(v.sizeBytes, 'source.sizeBytes');
    if (digestValue !== liteIntakeInlineTextSha256V1(textSnapshot)) {
      throw new LiteIntakeStagingContractError(
        'source.sha256 does not match exact inline text snapshot.'
      );
    }
    if (sizeBytes !== Buffer.byteLength(textSnapshot, 'utf8')) {
      throw new LiteIntakeStagingContractError(
        'source.sizeBytes does not match exact inline text snapshot.'
      );
    }
    return {
      sourceId: brandedId<LiteIntakeSourceId>(v.sourceId, sourceIdPattern, 'source.sourceId'),
      kind,
      owner: literal(v.owner, 'LITE', 'source.owner'),
      textSnapshot,
      sha256: digestValue,
      sizeBytes,
      recordedByPrincipalId: text(v.recordedByPrincipalId, 'source.recordedByPrincipalId'),
      recordedAt: timestamp(v.recordedAt, 'source.recordedAt')
    };
  }

  const commonKeys = [
    'sourceId',
    'kind',
    'owner',
    'accountRef',
    'messageId',
    'threadRef',
    'provider',
    'providerMessageId',
    'observedAt'
  ];
  if (kind === 'MANAGED_COMMUNICATION_MESSAGE') {
    exactKeys(v, [...commonKeys, 'exactEvidence'], 'source');
    return {
      sourceId: brandedId<LiteIntakeSourceId>(v.sourceId, sourceIdPattern, 'source.sourceId'),
      kind,
      owner: literal(v.owner, 'MANAGED_COMMUNICATION', 'source.owner'),
      accountRef: text(v.accountRef, 'source.accountRef'),
      messageId: text(v.messageId, 'source.messageId'),
      threadRef: text(v.threadRef, 'source.threadRef'),
      provider: text(v.provider, 'source.provider', 120),
      providerMessageId: text(v.providerMessageId, 'source.providerMessageId'),
      observedAt: timestamp(v.observedAt, 'source.observedAt'),
      exactEvidence: v.exactEvidence === null ? null : parseExactEvidence(v.exactEvidence)
    };
  }

  exactKeys(
    v,
    [
      ...commonKeys,
      'attachmentRef',
      'fileName',
      'mediaType',
      'sizeBytes',
      'sha256',
      'availability'
    ],
    'source'
  );
  const availability = oneOf(
    v.availability,
    liteIntakeAttachmentAvailabilityStates,
    'source.availability'
  );
  const mediaType = nullableText(v.mediaType, 'source.mediaType', 200);
  const sizeBytes = nullableNonNegativeInteger(v.sizeBytes, 'source.sizeBytes');
  const digestValue = nullableSha256(v.sha256, 'source.sha256');
  if (
    availability === 'AVAILABLE' &&
    (mediaType === null || sizeBytes === null || sizeBytes < 1 || digestValue === null)
  ) {
    throw new LiteIntakeStagingContractError(
      'AVAILABLE communication attachment requires mediaType, positive sizeBytes and sha256.'
    );
  }
  return {
    sourceId: brandedId<LiteIntakeSourceId>(v.sourceId, sourceIdPattern, 'source.sourceId'),
    kind,
    owner: literal(v.owner, 'MANAGED_COMMUNICATION', 'source.owner'),
    accountRef: text(v.accountRef, 'source.accountRef'),
    messageId: text(v.messageId, 'source.messageId'),
    threadRef: text(v.threadRef, 'source.threadRef'),
    provider: text(v.provider, 'source.provider', 120),
    providerMessageId: text(v.providerMessageId, 'source.providerMessageId'),
    observedAt: timestamp(v.observedAt, 'source.observedAt'),
    attachmentRef: text(v.attachmentRef, 'source.attachmentRef'),
    fileName: nullableText(v.fileName, 'source.fileName', 500),
    mediaType,
    sizeBytes,
    sha256: digestValue,
    availability
  };
}

function parseAiExtraction(value: unknown): LiteIntakeManagedAiExtractionRefV1 {
  const v = record(value, 'aiExtraction');
  exactKeys(
    v,
    [
      'extractionId',
      'owner',
      'implementationProfileId',
      'implementationProfileVersion',
      'implementationKey',
      'provider',
      'model',
      'promptPolicyId',
      'promptPolicyVersion',
      'outputSchemaId',
      'inputSha256',
      'outputSha256',
      'outputRef',
      'completedAt',
      'sourceIds'
    ],
    'aiExtraction'
  );
  return {
    extractionId: brandedId<LiteIntakeAiExtractionId>(
      v.extractionId,
      extractionIdPattern,
      'aiExtraction.extractionId'
    ),
    owner: literal(v.owner, 'MANAGED_AI', 'aiExtraction.owner'),
    implementationProfileId: text(
      v.implementationProfileId,
      'aiExtraction.implementationProfileId'
    ),
    implementationProfileVersion: positiveInteger(
      v.implementationProfileVersion,
      'aiExtraction.implementationProfileVersion'
    ),
    implementationKey: text(v.implementationKey, 'aiExtraction.implementationKey'),
    provider: text(v.provider, 'aiExtraction.provider', 120),
    model: text(v.model, 'aiExtraction.model', 200),
    promptPolicyId: text(v.promptPolicyId, 'aiExtraction.promptPolicyId'),
    promptPolicyVersion: text(v.promptPolicyVersion, 'aiExtraction.promptPolicyVersion'),
    outputSchemaId: text(v.outputSchemaId, 'aiExtraction.outputSchemaId'),
    inputSha256: sha256(v.inputSha256, 'aiExtraction.inputSha256'),
    outputSha256: sha256(v.outputSha256, 'aiExtraction.outputSha256'),
    outputRef: nullableText(v.outputRef, 'aiExtraction.outputRef'),
    completedAt: timestamp(v.completedAt, 'aiExtraction.completedAt'),
    sourceIds: uniqueStrings(
      v.sourceIds,
      'aiExtraction.sourceIds',
      (item, field) => brandedId<LiteIntakeSourceId>(item, sourceIdPattern, field),
      50,
      false
    )
  };
}

function parseCandidateValue(
  value: unknown,
  fieldPath: LiteIntakeFieldPath
): LiteIntakeCandidateValueV1 {
  if (value === null) return null;
  if (fieldPath === 'input.targetJurisdictions') {
    return uniqueStrings(
      value,
      'fieldCandidate.proposedValue',
      (item, field) => text(item, field, 120),
      50,
      false
    );
  }
  return text(value, 'fieldCandidate.proposedValue', 10_000);
}

function parseFieldCandidate(value: unknown): LiteIntakeFieldCandidateV1 {
  const v = record(value, 'fieldCandidate');
  exactKeys(
    v,
    [
      'fieldCandidateId',
      'fieldPath',
      'proposedValue',
      'originClass',
      'sourceIds',
      'aiExtractionIds',
      'reviewState',
      'reviewedByPrincipalId',
      'reviewedAt'
    ],
    'fieldCandidate'
  );
  const fieldPath = oneOf(v.fieldPath, liteIntakeFieldPaths, 'fieldCandidate.fieldPath');
  const reviewState = oneOf(
    v.reviewState,
    liteIntakeFieldReviewStates,
    'fieldCandidate.reviewState'
  );
  const originClass =
    v.originClass === null
      ? null
      : oneOf(v.originClass, liteIntakeCandidateOrigins, 'fieldCandidate.originClass');
  const proposedValue = parseCandidateValue(v.proposedValue, fieldPath);
  const sourceIds = uniqueStrings(v.sourceIds, 'fieldCandidate.sourceIds', (item, field) =>
    brandedId<LiteIntakeSourceId>(item, sourceIdPattern, field)
  );
  const aiExtractionIds = uniqueStrings(
    v.aiExtractionIds,
    'fieldCandidate.aiExtractionIds',
    (item, field) => brandedId<LiteIntakeAiExtractionId>(item, extractionIdPattern, field),
    20
  );
  const reviewedByPrincipalId = nullableText(
    v.reviewedByPrincipalId,
    'fieldCandidate.reviewedByPrincipalId'
  );
  const reviewedAt = nullableTimestamp(v.reviewedAt, 'fieldCandidate.reviewedAt');

  if (reviewState === 'MISSING') {
    if (
      originClass !== null ||
      proposedValue !== null ||
      sourceIds.length > 0 ||
      aiExtractionIds.length > 0
    ) {
      throw new LiteIntakeStagingContractError(
        'MISSING field candidate cannot carry a value or provenance.'
      );
    }
  } else if (originClass === null || proposedValue === null || sourceIds.length === 0) {
    throw new LiteIntakeStagingContractError(
      'Non-missing field candidate requires value, originClass and primary source provenance.'
    );
  }

  if (originClass === 'EXTRACTED' && aiExtractionIds.length === 0) {
    throw new LiteIntakeStagingContractError(
      'EXTRACTED field candidate requires Managed AI derivation provenance.'
    );
  }
  if (originClass === 'USER_CORRECTED' && reviewState !== 'CORRECTED') {
    throw new LiteIntakeStagingContractError(
      'USER_CORRECTED origin requires CORRECTED human review state.'
    );
  }
  if (reviewState === 'CORRECTED' && originClass !== 'USER_CORRECTED') {
    throw new LiteIntakeStagingContractError(
      'CORRECTED review state requires USER_CORRECTED origin.'
    );
  }

  const humanReviewed =
    reviewState === 'CONFIRMED' || reviewState === 'CORRECTED' || reviewState === 'REJECTED';
  const hasReviewer = reviewedByPrincipalId !== null && reviewedAt !== null;
  if (humanReviewed !== hasReviewer) {
    throw new LiteIntakeStagingContractError(
      'Human review states require reviewer/time; non-human states must not manufacture reviewer/time.'
    );
  }

  return {
    fieldCandidateId: brandedId<LiteIntakeFieldCandidateId>(
      v.fieldCandidateId,
      fieldCandidateIdPattern,
      'fieldCandidate.fieldCandidateId'
    ),
    fieldPath,
    proposedValue,
    originClass,
    sourceIds,
    aiExtractionIds,
    reviewState,
    reviewedByPrincipalId,
    reviewedAt
  };
}

function parseReviewedCommit(
  value: unknown,
  caseContentVersion: number,
  stagingVersion: number
): LiteIntakeReviewedCommitV1 {
  const v = record(value, 'reviewedCommit');
  exactKeys(
    v,
    [
      'reviewedStagingVersion',
      'reviewedContentVersion',
      'material',
      'reviewedFingerprintSha256',
      'confirmedByPrincipalId',
      'confirmedAt',
      'markRegIdempotencyKey',
      'correlationId'
    ],
    'reviewedCommit'
  );
  const reviewedStagingVersion = positiveInteger(
    v.reviewedStagingVersion,
    'reviewedCommit.reviewedStagingVersion'
  );
  if (reviewedStagingVersion > stagingVersion) {
    throw new LiteIntakeStagingContractError(
      'reviewedCommit cannot reference a future staging version.'
    );
  }
  const reviewedContentVersion = positiveInteger(
    v.reviewedContentVersion,
    'reviewedCommit.reviewedContentVersion'
  );
  if (reviewedContentVersion !== caseContentVersion) {
    throw new LiteIntakeStagingContractError(
      'reviewedCommit is stale for the current case contentVersion.'
    );
  }
  const markRegIdempotencyKey = text(
    v.markRegIdempotencyKey,
    'reviewedCommit.markRegIdempotencyKey'
  );
  if (!isMarkOrbitId(v.correlationId)) {
    throw new LiteIntakeStagingContractError('reviewedCommit.correlationId must be a MarkOrbitId.');
  }
  const materialRecord = record(v.material, 'reviewedCommit.material');
  exactKeys(materialRecord, ['channel', 'relationshipModel', 'input'], 'reviewedCommit.material');
  let parsedCommand;
  try {
    parsedCommand = parseCreateProductionIntakeCommandV1({
      schemaVersion: 1,
      channel: materialRecord.channel,
      relationshipModel: materialRecord.relationshipModel,
      input: materialRecord.input,
      idempotencyKey: markRegIdempotencyKey,
      correlationId: v.correlationId
    });
  } catch (error) {
    throw new LiteIntakeStagingContractError(
      `reviewedCommit.material is not valid MarkReg Production Intake material: ${
        error instanceof Error ? error.message : 'invalid command'
      }`
    );
  }
  const material: LiteIntakeReviewedMaterialV1 = {
    channel: parsedCommand.channel,
    relationshipModel: parsedCommand.relationshipModel,
    input: parsedCommand.input
  };
  const reviewedFingerprintSha256 = sha256(
    v.reviewedFingerprintSha256,
    'reviewedCommit.reviewedFingerprintSha256'
  );
  if (reviewedFingerprintSha256 !== liteIntakeReviewedMaterialFingerprintSha256V1(material)) {
    throw new LiteIntakeStagingContractError(
      'reviewedCommit.reviewedFingerprintSha256 does not match normalized reviewed material.'
    );
  }
  return {
    reviewedStagingVersion,
    reviewedContentVersion,
    material,
    reviewedFingerprintSha256,
    confirmedByPrincipalId: text(v.confirmedByPrincipalId, 'reviewedCommit.confirmedByPrincipalId'),
    confirmedAt: timestamp(v.confirmedAt, 'reviewedCommit.confirmedAt'),
    markRegIdempotencyKey,
    correlationId: parsedCommand.correlationId
  };
}

function parseReceipt(
  value: unknown,
  reviewedFingerprintSha256: string
): LiteIntakeProductionIntakeReceiptV1 {
  const v = record(value, 'productionIntakeReceipt');
  exactKeys(
    v,
    ['intakeId', 'version', 'fingerprintSha256', 'reviewedFingerprintSha256', 'committedAt'],
    'productionIntakeReceipt'
  );
  if (!isMarkOrbitId(v.intakeId)) {
    throw new LiteIntakeStagingContractError(
      'productionIntakeReceipt.intakeId must be a MarkOrbitId.'
    );
  }
  const reviewedFingerprint = sha256(
    v.reviewedFingerprintSha256,
    'productionIntakeReceipt.reviewedFingerprintSha256'
  );
  if (reviewedFingerprint !== reviewedFingerprintSha256) {
    throw new LiteIntakeStagingContractError(
      'Production Intake receipt does not match reviewed staging fingerprint.'
    );
  }
  return {
    intakeId: v.intakeId,
    version: positiveInteger(v.version, 'productionIntakeReceipt.version'),
    fingerprintSha256: sha256(v.fingerprintSha256, 'productionIntakeReceipt.fingerprintSha256'),
    reviewedFingerprintSha256: reviewedFingerprint,
    committedAt: timestamp(v.committedAt, 'productionIntakeReceipt.committedAt')
  };
}

function materialValue(
  material: LiteIntakeReviewedMaterialV1,
  path: LiteIntakeFieldPath
): string | readonly string[] {
  switch (path) {
    case 'channel':
      return material.channel;
    case 'relationshipModel':
      return material.relationshipModel;
    case 'input.businessContext':
      return material.input.businessContext;
    case 'input.applicant.type':
      return material.input.applicant.type;
    case 'input.applicant.name':
      return material.input.applicant.name;
    case 'input.applicant.country':
      return material.input.applicant.country;
    case 'input.trademark.type':
      return material.input.trademark.type;
    case 'input.trademark.representationText':
      return material.input.trademark.representationText;
    case 'input.targetJurisdictions':
      return material.input.targetJurisdictions;
    case 'input.goodsServices.sourceText':
      return material.input.goodsServices.sourceText;
    case 'input.filingGoal':
      return material.input.filingGoal;
  }
}

function sameValue(left: LiteIntakeCandidateValueV1, right: string | readonly string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateReadyReviewCoverage(
  fields: readonly LiteIntakeFieldCandidateV1[],
  material: LiteIntakeReviewedMaterialV1
): void {
  if (
    fields.some(
      (field) =>
        field.reviewState === 'UNREVIEWED' ||
        field.reviewState === 'CONFLICTING' ||
        field.reviewState === 'MISSING'
    )
  ) {
    throw new LiteIntakeStagingContractError(
      'Ready/commit case cannot retain unresolved field candidates.'
    );
  }
  for (const path of liteIntakeFieldPaths) {
    const selected = fields.filter(
      (field) =>
        field.fieldPath === path &&
        (field.reviewState === 'CONFIRMED' || field.reviewState === 'CORRECTED')
    );
    if (selected.length !== 1) {
      throw new LiteIntakeStagingContractError(
        `Ready/commit case requires exactly one human-selected candidate for ${path}.`
      );
    }
    if (!sameValue(selected[0]!.proposedValue, materialValue(material, path))) {
      throw new LiteIntakeStagingContractError(
        `Reviewed material does not match the human-selected candidate for ${path}.`
      );
    }
  }
}

function parseCase(
  value: unknown,
  stagingVersion: number,
  sourceById: ReadonlyMap<string, LiteIntakePrimarySourceV1>,
  extractionById: ReadonlyMap<string, LiteIntakeManagedAiExtractionRefV1>,
  updatedAt: string
): LiteIntakeCaseCandidateV1 {
  const v = record(value, 'caseCandidate');
  exactKeys(
    v,
    [
      'caseCandidateId',
      'contentVersion',
      'state',
      'fieldCandidates',
      'reviewedCommit',
      'productionIntakeReceipt',
      'archivedAt'
    ],
    'caseCandidate'
  );
  const state = oneOf(v.state, liteIntakeCaseStates, 'caseCandidate.state');
  const contentVersion = positiveInteger(v.contentVersion, 'caseCandidate.contentVersion');
  if (!Array.isArray(v.fieldCandidates) || v.fieldCandidates.length > 100) {
    throw new LiteIntakeStagingContractError(
      'caseCandidate.fieldCandidates must contain at most 100 items.'
    );
  }
  const fieldCandidates = v.fieldCandidates.map((field) => parseFieldCandidate(field));
  const fieldIds = fieldCandidates.map((field) => field.fieldCandidateId);
  if (new Set(fieldIds).size !== fieldIds.length) {
    throw new LiteIntakeStagingContractError(
      'caseCandidate.fieldCandidateId values must be unique.'
    );
  }

  for (const field of fieldCandidates) {
    for (const sourceId of field.sourceIds) {
      const source = sourceById.get(sourceId);
      if (!source) {
        throw new LiteIntakeStagingContractError(
          `Field candidate references unknown source ${sourceId}.`
        );
      }
      if (
        source.kind === 'MANAGED_COMMUNICATION_ATTACHMENT' &&
        source.availability === 'UNAVAILABLE' &&
        (field.reviewState === 'CONFIRMED' || field.reviewState === 'CORRECTED')
      ) {
        throw new LiteIntakeStagingContractError(
          'Unavailable communication attachment evidence cannot be human-confirmed as filing material.'
        );
      }
    }
    for (const extractionId of field.aiExtractionIds) {
      const extraction = extractionById.get(extractionId);
      if (!extraction) {
        throw new LiteIntakeStagingContractError(
          `Field candidate references unknown AI extraction ${extractionId}.`
        );
      }
      if (
        field.originClass === 'EXTRACTED' &&
        field.sourceIds.some((sourceId) => !extraction.sourceIds.includes(sourceId))
      ) {
        throw new LiteIntakeStagingContractError(
          'Extracted field provenance must trace through Managed AI to the same primary sources.'
        );
      }
    }
  }

  for (const field of fieldCandidates.filter(
    (candidate) => candidate.reviewState === 'CONFLICTING'
  )) {
    const hasCompetingValue = fieldCandidates.some(
      (candidate) =>
        candidate.fieldPath === field.fieldPath &&
        candidate.fieldCandidateId !== field.fieldCandidateId &&
        JSON.stringify(candidate.proposedValue) !== JSON.stringify(field.proposedValue)
    );
    if (!hasCompetingValue) {
      throw new LiteIntakeStagingContractError(
        'CONFLICTING field candidate requires a distinct competing value.'
      );
    }
  }

  const reviewedCommit =
    v.reviewedCommit === null
      ? null
      : parseReviewedCommit(v.reviewedCommit, contentVersion, stagingVersion);
  const productionIntakeReceipt =
    v.productionIntakeReceipt === null
      ? null
      : reviewedCommit === null
        ? (() => {
            throw new LiteIntakeStagingContractError(
              'Production Intake receipt requires reviewedCommit lineage.'
            );
          })()
        : parseReceipt(v.productionIntakeReceipt, reviewedCommit.reviewedFingerprintSha256);
  const archivedAt = nullableTimestamp(v.archivedAt, 'caseCandidate.archivedAt');

  if ((state === 'ARCHIVED') !== (archivedAt !== null)) {
    throw new LiteIntakeStagingContractError(
      'caseCandidate ARCHIVED state and archivedAt must agree.'
    );
  }
  if (archivedAt !== null && Date.parse(archivedAt) > Date.parse(updatedAt)) {
    throw new LiteIntakeStagingContractError(
      'caseCandidate.archivedAt cannot be after staging.updatedAt.'
    );
  }

  const requiresReviewed =
    state === 'READY_TO_COMMIT' ||
    state === 'COMMITTING' ||
    state === 'COMMIT_UNCERTAIN' ||
    state === 'COMMITTED';
  if (requiresReviewed && reviewedCommit === null) {
    throw new LiteIntakeStagingContractError(
      `${state} case requires an exact human-confirmed reviewedCommit.`
    );
  }
  if (!requiresReviewed && state !== 'ARCHIVED' && reviewedCommit !== null) {
    throw new LiteIntakeStagingContractError(
      `${state} case cannot retain a ready-to-commit reviewedCommit.`
    );
  }
  if (
    state === 'NEEDS_INFORMATION' &&
    !fieldCandidates.some((field) => field.reviewState === 'MISSING')
  ) {
    throw new LiteIntakeStagingContractError(
      'NEEDS_INFORMATION requires at least one explicit MISSING field.'
    );
  }
  if (reviewedCommit !== null) {
    validateReadyReviewCoverage(fieldCandidates, reviewedCommit.material);
  }

  if (state === 'COMMITTED') {
    if (productionIntakeReceipt === null) {
      throw new LiteIntakeStagingContractError(
        'COMMITTED case requires Production Intake receipt.'
      );
    }
  } else if (productionIntakeReceipt !== null && state !== 'ARCHIVED') {
    throw new LiteIntakeStagingContractError(
      'Only COMMITTED/ARCHIVED cases may carry Production Intake receipt.'
    );
  }
  if (state === 'COMMIT_UNCERTAIN' && productionIntakeReceipt !== null) {
    throw new LiteIntakeStagingContractError(
      'COMMIT_UNCERTAIN must not fabricate a Production Intake receipt.'
    );
  }

  if (reviewedCommit !== null && Date.parse(reviewedCommit.confirmedAt) > Date.parse(updatedAt)) {
    throw new LiteIntakeStagingContractError(
      'reviewedCommit.confirmedAt cannot be after staging.updatedAt.'
    );
  }
  if (
    productionIntakeReceipt !== null &&
    Date.parse(productionIntakeReceipt.committedAt) > Date.parse(updatedAt)
  ) {
    throw new LiteIntakeStagingContractError(
      'productionIntakeReceipt.committedAt cannot be after staging.updatedAt.'
    );
  }

  return {
    caseCandidateId: brandedId<LiteIntakeCaseCandidateId>(
      v.caseCandidateId,
      caseIdPattern,
      'caseCandidate.caseCandidateId'
    ),
    contentVersion,
    state,
    fieldCandidates,
    reviewedCommit,
    productionIntakeReceipt,
    archivedAt
  };
}

function parseAuthority(value: unknown): LiteIntakeStagingAuthorityConsequencesV1 {
  const v = record(value, 'authorityConsequences');
  exactKeys(v, Object.keys(noLiteIntakeStagingAuthorityConsequencesV1), 'authorityConsequences');
  for (const key of Object.keys(noLiteIntakeStagingAuthorityConsequencesV1) as Array<
    keyof LiteIntakeStagingAuthorityConsequencesV1
  >) {
    if (v[key] !== false) {
      throw new LiteIntakeStagingContractError(`authorityConsequences.${key} must be false.`);
    }
  }
  return noLiteIntakeStagingAuthorityConsequencesV1;
}

export function parseLiteIntakeStagingV1(
  value: unknown,
  expectedWorkspaceId?: string
): LiteIntakeStagingV1 {
  const v = record(value, 'liteIntakeStaging');
  exactKeys(
    v,
    [
      'schemaVersion',
      'stagingId',
      'workspaceId',
      'version',
      'lifecycle',
      'sources',
      'aiExtractions',
      'caseCandidates',
      'authorityConsequences',
      'createdAt',
      'updatedAt',
      'archivedAt'
    ],
    'liteIntakeStaging'
  );
  if (v.schemaVersion !== 1) {
    throw new LiteIntakeStagingContractError('schemaVersion must be 1.');
  }
  const workspaceId = text(v.workspaceId, 'workspaceId');
  if (expectedWorkspaceId !== undefined && workspaceId !== expectedWorkspaceId) {
    throw new LiteIntakeStagingContractError('Lite Intake Staging Workspace does not match.');
  }
  const version = positiveInteger(v.version, 'version');
  const lifecycle = oneOf(v.lifecycle, liteIntakeStagingLifecycles, 'lifecycle');
  const createdAt = timestamp(v.createdAt, 'createdAt');
  const updatedAt = timestamp(v.updatedAt, 'updatedAt');
  const archivedAt = nullableTimestamp(v.archivedAt, 'archivedAt');
  if (Date.parse(createdAt) > Date.parse(updatedAt)) {
    throw new LiteIntakeStagingContractError('createdAt cannot be after updatedAt.');
  }
  if ((lifecycle === 'ARCHIVED') !== (archivedAt !== null)) {
    throw new LiteIntakeStagingContractError('ARCHIVED lifecycle and archivedAt must agree.');
  }
  if (
    archivedAt !== null &&
    (Date.parse(archivedAt) < Date.parse(createdAt) ||
      Date.parse(archivedAt) > Date.parse(updatedAt))
  ) {
    throw new LiteIntakeStagingContractError('archivedAt must be within staging lifetime.');
  }

  if (!Array.isArray(v.sources) || v.sources.length > 100) {
    throw new LiteIntakeStagingContractError('sources must contain at most 100 primary sources.');
  }
  const sources = v.sources.map((source) => parseSource(source));
  const sourceIds = sources.map((source) => source.sourceId);
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new LiteIntakeStagingContractError('sourceId values must be unique.');
  }
  const sourceById = new Map(sources.map((source) => [source.sourceId, source] as const));

  if (!Array.isArray(v.aiExtractions) || v.aiExtractions.length > 50) {
    throw new LiteIntakeStagingContractError(
      'aiExtractions must contain at most 50 derivation references.'
    );
  }
  const aiExtractions = v.aiExtractions.map((extraction) => parseAiExtraction(extraction));
  const extractionIds = aiExtractions.map((extraction) => extraction.extractionId);
  if (new Set(extractionIds).size !== extractionIds.length) {
    throw new LiteIntakeStagingContractError('AI extraction ids must be unique.');
  }
  for (const extraction of aiExtractions) {
    for (const sourceId of extraction.sourceIds) {
      if (!sourceById.has(sourceId)) {
        throw new LiteIntakeStagingContractError(
          `AI extraction references unknown primary source ${sourceId}.`
        );
      }
    }
    if (Date.parse(extraction.completedAt) > Date.parse(updatedAt)) {
      throw new LiteIntakeStagingContractError(
        'AI extraction completion cannot be after staging.updatedAt.'
      );
    }
  }
  const extractionById = new Map(
    aiExtractions.map((extraction) => [extraction.extractionId, extraction] as const)
  );

  for (const source of sources) {
    const sourceTime = source.kind === 'USER_INLINE_TEXT' ? source.recordedAt : source.observedAt;
    if (Date.parse(sourceTime) > Date.parse(updatedAt)) {
      throw new LiteIntakeStagingContractError(
        'Source evidence time cannot be after staging.updatedAt.'
      );
    }
    if (
      source.kind === 'MANAGED_COMMUNICATION_MESSAGE' &&
      source.exactEvidence !== null &&
      (source.exactEvidence.observedAt !== source.observedAt ||
        Date.parse(source.exactEvidence.observedAt) > Date.parse(updatedAt))
    ) {
      throw new LiteIntakeStagingContractError(
        'Managed Communication exact evidence must preserve the same observation time.'
      );
    }
  }

  if (!Array.isArray(v.caseCandidates) || v.caseCandidates.length > 50) {
    throw new LiteIntakeStagingContractError('caseCandidates must contain at most 50 cases.');
  }
  const caseCandidates = v.caseCandidates.map((candidate) =>
    parseCase(candidate, version, sourceById, extractionById, updatedAt)
  );
  const caseIds = caseCandidates.map((candidate) => candidate.caseCandidateId);
  if (new Set(caseIds).size !== caseIds.length) {
    throw new LiteIntakeStagingContractError('caseCandidateId values must be unique and stable.');
  }
  const idempotencyKeys = caseCandidates
    .map((candidate) => candidate.reviewedCommit?.markRegIdempotencyKey)
    .filter((key): key is string => key !== undefined);
  if (new Set(idempotencyKeys).size !== idempotencyKeys.length) {
    throw new LiteIntakeStagingContractError(
      'Each reviewed case must have its own MarkReg idempotency key.'
    );
  }
  if (
    lifecycle === 'ARCHIVED' &&
    caseCandidates.some((candidate) => candidate.state !== 'ARCHIVED')
  ) {
    throw new LiteIntakeStagingContractError(
      'Archived staging session may contain only archived cases.'
    );
  }

  return {
    schemaVersion: 1,
    stagingId: brandedId<LiteIntakeStagingId>(v.stagingId, stagingIdPattern, 'stagingId'),
    workspaceId,
    version,
    lifecycle,
    sources,
    aiExtractions,
    caseCandidates,
    authorityConsequences: parseAuthority(v.authorityConsequences),
    createdAt,
    updatedAt,
    archivedAt
  };
}
