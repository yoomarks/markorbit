import { createHash } from 'node:crypto';
import { parseBrainEvidenceRef, type BrainEvidenceRef } from './brain.js';
import type { BrainMethodVersionId } from './brain-method.js';

export const subjectSourceKinds = [
  'APPLICANT',
  'OWNER',
  'AGENT',
  'ATTORNEY',
  'CORRESPONDENT',
  'COMPANY',
  'MARKETPLACE_SELLER',
  'OTHER'
] as const;
export type SubjectSourceKindV1 = (typeof subjectSourceKinds)[number];

export const subjectResolutionRelations = [
  'SAME_LEGAL_ENTITY',
  'LIKELY_SAME_ENTITY',
  'RENAMED_FROM',
  'RELATED_ENTITY',
  'CONFLICT',
  'INSUFFICIENT_EVIDENCE'
] as const;
export type SubjectResolutionRelationV1 = (typeof subjectResolutionRelations)[number];
export const subjectResolutionBands = ['VERY_HIGH', 'HIGH', 'REVIEW_REQUIRED', 'CONFLICT'] as const;
export type SubjectResolutionBandV1 = (typeof subjectResolutionBands)[number];

export const subjectResolutionReasonCodes = [
  'OFFICIAL_IDENTIFIER_MATCH',
  'OFFICIAL_RENAME_CHAIN',
  'NORMALIZED_NAME_MATCH',
  'ADDRESS_EVIDENCE_MATCH',
  'RELATED_ENTITY_EVIDENCE',
  'REGISTRATION_NUMBER_CONFLICT',
  'NAME_ONLY_NO_STABLE_IDENTIFIER'
] as const;
export type SubjectResolutionReasonCodeV1 = (typeof subjectResolutionReasonCodes)[number];

const directAuthoritativeIdentityReasonCodes = new Set<SubjectResolutionReasonCodeV1>([
  'OFFICIAL_IDENTIFIER_MATCH'
]);

export interface SourceSubjectRefV1 {
  schemaVersion: 1;
  sourceSystem: string;
  sourceKind: SubjectSourceKindV1;
  sourceObjectId: string;
  sourceVersion: string;
  sourceFingerprintSha256: string;
  observedAt: string;
  jurisdiction?: string;
  displayName?: string;
}

export interface SubjectResolutionAuthorityConsequencesV1 {
  legalIdentityEstablished: false;
  customerRelationshipEstablished: false;
  workspaceAssociationEstablished: false;
  trademarkOwnershipEstablished: false;
  managedAssetEstablished: false;
  externalActionAuthorized: false;
}
export interface SubjectResolutionSnapshotV1 {
  schemaVersion: 1;
  resolutionId: `subject-resolution_${string}`;
  methodVersionId: BrainMethodVersionId;
  evaluatedAt: string;
  left: Readonly<SourceSubjectRefV1>;
  right: Readonly<SourceSubjectRefV1>;
  relation: SubjectResolutionRelationV1;
  band: SubjectResolutionBandV1;
  reasonCodes: readonly SubjectResolutionReasonCodeV1[];
  explanation: string;
  supportingEvidence: readonly Readonly<BrainEvidenceRef>[];
  conflictingEvidence: readonly Readonly<BrainEvidenceRef>[];
  authorityConsequences: Readonly<SubjectResolutionAuthorityConsequencesV1>;
  fingerprintSha256: string;
}

export class SubjectResolutionContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'SubjectResolutionContractError';
  }
}

const SHA256 = /^[0-9a-f]{64}$/u;
const ISO_COUNTRY = /^[A-Z]{2}$/u;
function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new SubjectResolutionContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string')
    throw new SubjectResolutionContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max)
    throw new SubjectResolutionContractError(`${field} must contain 1 to ${max} characters.`);
  return cleaned;
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  if (Number.isNaN(Date.parse(cleaned)))
    throw new SubjectResolutionContractError(`${field} must be an ISO date/time.`);
  return cleaned;
}

function sha(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned)) throw new SubjectResolutionContractError(`${field} must be SHA-256.`);
  return cleaned;
}
function one<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value))
    throw new SubjectResolutionContractError(`${field} is invalid.`);
  return value as T;
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new SubjectResolutionContractError(`${field} must be a non-empty array.`);
  const items = value.map((item, index) => text(item, `${field}[${index}]`, 160));
  if (new Set(items).size !== items.length)
    throw new SubjectResolutionContractError(`${field} must not contain duplicates.`);
  return [...items].sort();
}

function reasonCodeList(value: unknown, field: string): SubjectResolutionReasonCodeV1[] {
  const items = stringList(value, field);
  for (const item of items)
    if (!(subjectResolutionReasonCodes as readonly string[]).includes(item))
      throw new SubjectResolutionContractError(
        `${field} contains unsupported reason code: ${item}.`
      );
  return items as SubjectResolutionReasonCodeV1[];
}

function evidenceList(value: unknown, field: string): BrainEvidenceRef[] {
  if (!Array.isArray(value)) throw new SubjectResolutionContractError(`${field} must be an array.`);
  return value.map((item) => parseBrainEvidenceRef(item));
}

export function parseSourceSubjectRefV1(value: unknown): SourceSubjectRefV1 {
  const x = record(value, 'sourceSubjectRef');
  const jurisdiction =
    x.jurisdiction === undefined
      ? undefined
      : text(x.jurisdiction, 'sourceSubjectRef.jurisdiction', 2).toUpperCase();
  if (jurisdiction && !ISO_COUNTRY.test(jurisdiction))
    throw new SubjectResolutionContractError('sourceSubjectRef.jurisdiction must be ISO alpha-2.');
  return {
    schemaVersion: 1,
    sourceSystem: text(x.sourceSystem, 'sourceSubjectRef.sourceSystem', 120),
    sourceKind: one(x.sourceKind, subjectSourceKinds, 'sourceSubjectRef.sourceKind'),
    sourceObjectId: text(x.sourceObjectId, 'sourceSubjectRef.sourceObjectId', 500),
    sourceVersion: text(x.sourceVersion, 'sourceSubjectRef.sourceVersion', 200),
    sourceFingerprintSha256: sha(
      x.sourceFingerprintSha256,
      'sourceSubjectRef.sourceFingerprintSha256'
    ),
    observedAt: instant(x.observedAt, 'sourceSubjectRef.observedAt'),
    ...(jurisdiction ? { jurisdiction } : {}),
    ...(x.displayName === undefined
      ? {}
      : {
          displayName: text(x.displayName, 'sourceSubjectRef.displayName', 500)
        })
  };
}

function canonicalSubject(ref: Readonly<SourceSubjectRefV1>) {
  return {
    sourceSystem: ref.sourceSystem,
    sourceKind: ref.sourceKind,
    sourceObjectId: ref.sourceObjectId,
    sourceVersion: ref.sourceVersion,
    sourceFingerprintSha256: ref.sourceFingerprintSha256,
    observedAt: ref.observedAt,
    jurisdiction: ref.jurisdiction ?? null
  };
}

function canonicalEvidence(ref: Readonly<BrainEvidenceRef>) {
  return {
    sourceOwner: ref.sourceOwner,
    sourceObjectId: ref.sourceObjectId,
    sourceVersion: ref.sourceVersion,
    sourceFingerprintSha256: ref.sourceFingerprintSha256,
    observedAt: ref.observedAt ?? null
  };
}
export function subjectResolutionFingerprintV1(
  input: Omit<SubjectResolutionSnapshotV1, 'fingerprintSha256'>
): string {
  const canonical = {
    schemaVersion: 1,
    resolutionId: input.resolutionId,
    methodVersionId: input.methodVersionId,
    evaluatedAt: input.evaluatedAt,
    left: canonicalSubject(input.left),
    right: canonicalSubject(input.right),
    relation: input.relation,
    band: input.band,
    reasonCodes: [...input.reasonCodes].sort(),
    explanation: input.explanation,
    supportingEvidence: input.supportingEvidence.map(canonicalEvidence),
    conflictingEvidence: input.conflictingEvidence.map(canonicalEvidence),
    authorityConsequences: input.authorityConsequences
  };
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

export function parseSubjectResolutionSnapshotV1(value: unknown): SubjectResolutionSnapshotV1 {
  const x = record(value, 'subjectResolution');
  if (x.schemaVersion !== 1)
    throw new SubjectResolutionContractError('subjectResolution.schemaVersion must be 1.');
  const resolutionId = text(x.resolutionId, 'subjectResolution.resolutionId', 300);
  if (!resolutionId.startsWith('subject-resolution_'))
    throw new SubjectResolutionContractError('subjectResolution.resolutionId is invalid.');
  const methodVersionId = text(x.methodVersionId, 'subjectResolution.methodVersionId', 300);
  if (!methodVersionId.startsWith('brain-method-version_'))
    throw new SubjectResolutionContractError('subjectResolution.methodVersionId is invalid.');
  const relation = one(x.relation, subjectResolutionRelations, 'subjectResolution.relation');
  const band = one(x.band, subjectResolutionBands, 'subjectResolution.band');
  if (relation === 'CONFLICT' && band !== 'CONFLICT')
    throw new SubjectResolutionContractError('CONFLICT relation requires CONFLICT band.');
  if (relation === 'INSUFFICIENT_EVIDENCE' && band !== 'REVIEW_REQUIRED')
    throw new SubjectResolutionContractError(
      'INSUFFICIENT_EVIDENCE relation requires REVIEW_REQUIRED band.'
    );
  const supportingEvidence = evidenceList(
    x.supportingEvidence,
    'subjectResolution.supportingEvidence'
  );
  const conflictingEvidence = evidenceList(
    x.conflictingEvidence,
    'subjectResolution.conflictingEvidence'
  );
  if (relation === 'CONFLICT' && conflictingEvidence.length === 0)
    throw new SubjectResolutionContractError('CONFLICT requires conflicting evidence.');
  if (relation === 'SAME_LEGAL_ENTITY' && supportingEvidence.length === 0)
    throw new SubjectResolutionContractError('SAME_LEGAL_ENTITY requires supporting evidence.');

  const reasonCodes = reasonCodeList(x.reasonCodes, 'subjectResolution.reasonCodes');
  if (
    relation === 'SAME_LEGAL_ENTITY' &&
    !reasonCodes.some((code) => directAuthoritativeIdentityReasonCodes.has(code))
  )
    throw new SubjectResolutionContractError(
      'SAME_LEGAL_ENTITY requires direct authoritative identifier evidence.'
    );
  if (
    relation === 'RENAMED_FROM' &&
    (!reasonCodes.includes('OFFICIAL_RENAME_CHAIN') || supportingEvidence.length === 0)
  )
    throw new SubjectResolutionContractError(
      'RENAMED_FROM requires an official rename chain with supporting evidence.'
    );

  const authority = record(x.authorityConsequences, 'subjectResolution.authorityConsequences');
  if (
    authority.legalIdentityEstablished !== false ||
    authority.customerRelationshipEstablished !== false ||
    authority.workspaceAssociationEstablished !== false ||
    authority.trademarkOwnershipEstablished !== false ||
    authority.managedAssetEstablished !== false ||
    authority.externalActionAuthorized !== false
  )
    throw new SubjectResolutionContractError('subject resolution cannot grant authority.');
  const result: Omit<SubjectResolutionSnapshotV1, 'fingerprintSha256'> = {
    schemaVersion: 1,
    resolutionId: resolutionId as SubjectResolutionSnapshotV1['resolutionId'],
    methodVersionId: methodVersionId as BrainMethodVersionId,
    evaluatedAt: instant(x.evaluatedAt, 'subjectResolution.evaluatedAt'),
    left: parseSourceSubjectRefV1(x.left),
    right: parseSourceSubjectRefV1(x.right),
    relation,
    band,
    reasonCodes,
    explanation: text(x.explanation, 'subjectResolution.explanation', 2000),
    supportingEvidence,
    conflictingEvidence,
    authorityConsequences: {
      legalIdentityEstablished: false,
      customerRelationshipEstablished: false,
      workspaceAssociationEstablished: false,
      trademarkOwnershipEstablished: false,
      managedAssetEstablished: false,
      externalActionAuthorized: false
    }
  };
  const fingerprintSha256 = sha(x.fingerprintSha256, 'subjectResolution.fingerprintSha256');
  const expected = subjectResolutionFingerprintV1(result);
  if (fingerprintSha256 !== expected)
    throw new SubjectResolutionContractError('subjectResolution fingerprint mismatch.');
  return { ...result, fingerprintSha256 };
}
