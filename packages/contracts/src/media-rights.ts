import type { MediaRightsSnapshotRefV1 } from './media.js';

export type MediaRightsBindingId = `media-rights-binding_${string}`;

export interface MediaRightsSubjectV1 {
  subjectRef: string;
  kind: 'HUMAN' | 'ORGANIZATION' | 'VIRTUAL_CHARACTER';
  responsiblePartyRef: string;
}

export interface MediaConsentGrantRefV1 {
  owner: string;
  consentGrantId: string;
  version: number;
  fingerprintSha256: string;
}

export interface MediaCommercialUseScopeV1 {
  purposes: readonly string[];
  territories: readonly string[];
}

export interface MediaIdentityDisclosureV1 {
  required: boolean;
  policyRef?: string;
}

export interface MediaRightsBindingV1 {
  schemaVersion: 1;
  mediaRightsBindingId: MediaRightsBindingId;
  version: number;
  workspaceId: string;
  subject: Readonly<MediaRightsSubjectV1>;
  consentGrant: Readonly<MediaConsentGrantRefV1>;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  commercialUse: Readonly<MediaCommercialUseScopeV1>;
  validFrom: string;
  expiresAt?: string;
  revokedAt?: string;
  sourceEvidenceRefs: readonly string[];
  identityDisclosure: Readonly<MediaIdentityDisclosureV1>;
  updatedAt: string;
}

export interface MediaRightsSnapshotV1 extends MediaRightsSnapshotRefV1 {
  mediaRightsBindingId: MediaRightsBindingId;
  bindingVersion: number;
  statusAtCapture: MediaRightsBindingV1['status'];
  subject: Readonly<MediaRightsSubjectV1>;
  consentGrant: Readonly<MediaConsentGrantRefV1>;
  commercialUse: Readonly<MediaCommercialUseScopeV1>;
  validFrom: string;
  expiresAt?: string;
  revokedAt?: string;
  sourceEvidenceRefs: readonly string[];
  identityDisclosure: Readonly<MediaIdentityDisclosureV1>;
}

export interface MediaRightsUseRequestV1 {
  workspaceId: string;
  purpose: string;
  territory: string;
  requestedAt: string;
}

export type MediaRightsEligibilityReasonV1 =
  | 'ELIGIBLE'
  | 'WORKSPACE_MISMATCH'
  | 'CONSENT_NOT_ACTIVE'
  | 'OUTSIDE_VALIDITY_WINDOW'
  | 'PURPOSE_NOT_ALLOWED'
  | 'TERRITORY_NOT_ALLOWED'
  | 'DISCLOSURE_POLICY_MISSING';

export interface MediaRightsEligibilityV1 {
  eligible: boolean;
  reason: MediaRightsEligibilityReasonV1;
  binding: Readonly<{ mediaRightsBindingId: MediaRightsBindingId; version: number }>;
  assessedAt: string;
  createsExecutionAuthority: false;
}

export class MediaRightsContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'MediaRightsContractError';
  }
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new MediaRightsContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const supported = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !supported.has(key));
  if (unsupported.length)
    throw new MediaRightsContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new MediaRightsContractError(`${field} must be a non-empty string.`);
  return value.trim();
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field);
  if (!Number.isFinite(Date.parse(result)))
    throw new MediaRightsContractError(`${field} must be a timestamp.`);
  return result;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new MediaRightsContractError(`${field} must be a positive safe integer.`);
  return value as number;
}

function sha256(value: unknown, field: string): string {
  const result = text(value, field);
  if (!/^[a-f0-9]{64}$/u.test(result))
    throw new MediaRightsContractError(`${field} must be SHA-256 hex.`);
  return result;
}

function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new MediaRightsContractError(`${field} must be a non-empty array.`);
  const result = value.map((item, index) => text(item, `${field}[${index}]`));
  if (new Set(result).size !== result.length)
    throw new MediaRightsContractError(`${field} must not contain duplicates.`);
  return result;
}

function parseSubject(value: unknown): MediaRightsSubjectV1 {
  const item = object(value, 'subject');
  exactKeys(item, ['subjectRef', 'kind', 'responsiblePartyRef'], 'subject');
  if (!['HUMAN', 'ORGANIZATION', 'VIRTUAL_CHARACTER'].includes(String(item.kind)))
    throw new MediaRightsContractError('subject.kind is invalid.');
  return {
    subjectRef: text(item.subjectRef, 'subject.subjectRef'),
    kind: item.kind as MediaRightsSubjectV1['kind'],
    responsiblePartyRef: text(item.responsiblePartyRef, 'subject.responsiblePartyRef')
  };
}

function parseConsentGrant(value: unknown): MediaConsentGrantRefV1 {
  const item = object(value, 'consentGrant');
  exactKeys(item, ['owner', 'consentGrantId', 'version', 'fingerprintSha256'], 'consentGrant');
  return {
    owner: text(item.owner, 'consentGrant.owner'),
    consentGrantId: text(item.consentGrantId, 'consentGrant.consentGrantId'),
    version: positiveInteger(item.version, 'consentGrant.version'),
    fingerprintSha256: sha256(item.fingerprintSha256, 'consentGrant.fingerprintSha256')
  };
}

function parseCommercialUse(value: unknown): MediaCommercialUseScopeV1 {
  const item = object(value, 'commercialUse');
  exactKeys(item, ['purposes', 'territories'], 'commercialUse');
  return {
    purposes: strings(item.purposes, 'commercialUse.purposes'),
    territories: strings(item.territories, 'commercialUse.territories')
  };
}

function parseDisclosure(value: unknown): MediaIdentityDisclosureV1 {
  const item = object(value, 'identityDisclosure');
  exactKeys(item, ['required', 'policyRef'], 'identityDisclosure');
  if (typeof item.required !== 'boolean')
    throw new MediaRightsContractError('identityDisclosure.required must be boolean.');
  const policyRef =
    item.policyRef === undefined ? undefined : text(item.policyRef, 'identityDisclosure.policyRef');
  if (item.required && !policyRef)
    throw new MediaRightsContractError(
      'Required identity disclosure must reference its owner policy.'
    );
  return { required: item.required, ...(policyRef ? { policyRef } : {}) };
}

export function parseMediaRightsBindingV1(value: unknown): MediaRightsBindingV1 {
  const item = object(value, 'mediaRightsBinding');
  exactKeys(
    item,
    [
      'schemaVersion',
      'mediaRightsBindingId',
      'version',
      'workspaceId',
      'subject',
      'consentGrant',
      'status',
      'commercialUse',
      'validFrom',
      'expiresAt',
      'revokedAt',
      'sourceEvidenceRefs',
      'identityDisclosure',
      'updatedAt'
    ],
    'mediaRightsBinding'
  );
  if (item.schemaVersion !== 1) throw new MediaRightsContractError('schemaVersion must be 1.');
  const id = text(item.mediaRightsBindingId, 'mediaRightsBindingId');
  if (!id.startsWith('media-rights-binding_'))
    throw new MediaRightsContractError('mediaRightsBindingId is invalid.');
  if (!['ACTIVE', 'REVOKED', 'EXPIRED'].includes(String(item.status)))
    throw new MediaRightsContractError('status is invalid.');
  const expiresAt =
    item.expiresAt === undefined ? undefined : timestamp(item.expiresAt, 'expiresAt');
  const revokedAt =
    item.revokedAt === undefined ? undefined : timestamp(item.revokedAt, 'revokedAt');
  if (item.status === 'ACTIVE' && revokedAt)
    throw new MediaRightsContractError('ACTIVE binding cannot carry revokedAt.');
  if (item.status === 'REVOKED' && !revokedAt)
    throw new MediaRightsContractError('REVOKED binding requires revokedAt.');
  if (item.status === 'EXPIRED' && !expiresAt)
    throw new MediaRightsContractError('EXPIRED binding requires expiresAt.');
  const subject = parseSubject(item.subject);
  const identityDisclosure = parseDisclosure(item.identityDisclosure);
  if (
    subject.kind === 'VIRTUAL_CHARACTER' &&
    (!identityDisclosure.required || !identityDisclosure.policyRef)
  )
    throw new MediaRightsContractError('Virtual character requires an identity disclosure policy.');
  return {
    schemaVersion: 1,
    mediaRightsBindingId: id as MediaRightsBindingId,
    version: positiveInteger(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId'),
    subject,
    consentGrant: parseConsentGrant(item.consentGrant),
    status: item.status as MediaRightsBindingV1['status'],
    commercialUse: parseCommercialUse(item.commercialUse),
    validFrom: timestamp(item.validFrom, 'validFrom'),
    ...(expiresAt ? { expiresAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    sourceEvidenceRefs: strings(item.sourceEvidenceRefs, 'sourceEvidenceRefs'),
    identityDisclosure,
    updatedAt: timestamp(item.updatedAt, 'updatedAt')
  };
}

export function assessMediaRightsEligibilityV1(
  binding: Readonly<MediaRightsBindingV1>,
  request: Readonly<MediaRightsUseRequestV1>
): MediaRightsEligibilityV1 {
  const assessedAt = timestamp(request.requestedAt, 'requestedAt');
  let reason: MediaRightsEligibilityReasonV1 = 'ELIGIBLE';
  if (binding.workspaceId !== text(request.workspaceId, 'workspaceId'))
    reason = 'WORKSPACE_MISMATCH';
  else if (binding.status !== 'ACTIVE') reason = 'CONSENT_NOT_ACTIVE';
  else if (
    Date.parse(assessedAt) < Date.parse(binding.validFrom) ||
    (binding.expiresAt && Date.parse(assessedAt) >= Date.parse(binding.expiresAt))
  )
    reason = 'OUTSIDE_VALIDITY_WINDOW';
  else if (!binding.commercialUse.purposes.includes(text(request.purpose, 'purpose')))
    reason = 'PURPOSE_NOT_ALLOWED';
  else if (!binding.commercialUse.territories.includes(text(request.territory, 'territory')))
    reason = 'TERRITORY_NOT_ALLOWED';
  else if (
    binding.subject.kind === 'VIRTUAL_CHARACTER' &&
    (!binding.identityDisclosure.required || !binding.identityDisclosure.policyRef)
  )
    reason = 'DISCLOSURE_POLICY_MISSING';
  return {
    eligible: reason === 'ELIGIBLE',
    reason,
    binding: { mediaRightsBindingId: binding.mediaRightsBindingId, version: binding.version },
    assessedAt,
    createsExecutionAuthority: false
  };
}
