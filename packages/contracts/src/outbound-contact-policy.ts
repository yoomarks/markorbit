export const outboundContactChannels = ['EMAIL'] as const;
export type OutboundContactChannelV1 = (typeof outboundContactChannels)[number];
export const outboundContactPurposes = [
  'PROSPECT_OUTREACH',
  'PARTNER_OUTREACH',
  'EDUCATION_INVITATION'
] as const;
export type OutboundContactPurposeV1 = (typeof outboundContactPurposes)[number];
export const outboundContactBasisStates = ['ASSERTED_ALLOWED', 'ASSERTED_BLOCKED'] as const;
export type OutboundContactBasisStateV1 = (typeof outboundContactBasisStates)[number];
export const outboundContactBasisStatuses = ['ACTIVE', 'SUPERSEDED', 'REVOKED'] as const;
export type OutboundContactBasisStatusV1 = (typeof outboundContactBasisStatuses)[number];
export const outboundContactSuppressionScopes = [
  'ALL_OUTBOUND',
  'PROSPECT_OUTREACH',
  'PARTNER_OUTREACH',
  'EDUCATION_INVITATION'
] as const;
export type OutboundContactSuppressionScopeV1 = (typeof outboundContactSuppressionScopes)[number];
export const outboundContactSuppressionStatuses = ['ACTIVE', 'CLEARED'] as const;
export type OutboundContactSuppressionStatusV1 =
  (typeof outboundContactSuppressionStatuses)[number];
export const outboundContactSuppressionReasons = [
  'WORKSPACE_DO_NOT_CONTACT',
  'RECIPIENT_OPT_OUT',
  'HARD_BOUNCE',
  'COMPLAINT',
  'POLICY_BLOCK',
  'OTHER_REVIEWED_REASON'
] as const;
export type OutboundContactSuppressionReasonV1 = (typeof outboundContactSuppressionReasons)[number];
export const outboundContactSuppressionSourceClasses = [
  'WORKSPACE_USER',
  'MANAGED_COMMUNICATION',
  'PROVIDER_OBSERVATION',
  'OTHER_REVIEWED_SOURCE'
] as const;
export type OutboundContactSuppressionSourceClassV1 =
  (typeof outboundContactSuppressionSourceClasses)[number];
export const outboundContactReadinessOutcomes = [
  'READY_FOR_HUMAN_SEND',
  'BLOCKED',
  'UNKNOWN'
] as const;
export type OutboundContactReadinessOutcomeV1 = (typeof outboundContactReadinessOutcomes)[number];
export const outboundContactReadinessReasons = [
  'CURRENT_ALLOWED_ASSERTION',
  'ASSERTED_BLOCKED',
  'ACTIVE_SUPPRESSION',
  'NO_CURRENT_ASSERTION',
  'ASSERTION_NOT_ACTIVE',
  'TARGET_MISMATCH',
  'POLICY_MISMATCH'
] as const;
export type OutboundContactReadinessReasonV1 = (typeof outboundContactReadinessReasons)[number];
export type OutboundContactBasisAssertionIdV1 = `outbound-contact-basis_${string}`;
export type OutboundContactSuppressionIdV1 = `outbound-contact-suppression_${string}`;
export interface OutboundContactTargetReferenceV1 {
  owner: string;
  kind: string;
  id: string;
  version: number;
}
export interface OutboundContactPolicyReferenceV1 {
  policyId: string;
  version: number;
}
export const noOutboundContactBasisAuthorityConsequencesV1 = Object.freeze({
  legalConsentVerifiedByMarkOrbit: false,
  externalSendAuthorized: false,
  customerTruthMutated: false
});
export const noOutboundContactReadinessAuthorityConsequencesV1 = Object.freeze({
  legalConsentVerifiedByMarkOrbit: false,
  externalMessageSent: false,
  protectedActionAuthorized: false
});
export interface OutboundContactBasisAssertionV1 {
  schemaVersion: 1;
  assertionId: OutboundContactBasisAssertionIdV1;
  workspaceId: string;
  version: number;
  targetRef: Readonly<OutboundContactTargetReferenceV1>;
  channel: 'EMAIL';
  endpointFingerprintSha256: string;
  purpose: OutboundContactPurposeV1;
  marketOrJurisdiction?: string;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  basisState: OutboundContactBasisStateV1;
  evidenceRefs: readonly string[];
  assertedByPrincipalId: string;
  assertedAt: string;
  status: OutboundContactBasisStatusV1;
  supersedesVersion: number | null;
  authorityConsequences: typeof noOutboundContactBasisAuthorityConsequencesV1;
}
export interface OutboundContactSuppressionV1 {
  schemaVersion: 1;
  suppressionId: OutboundContactSuppressionIdV1;
  workspaceId: string;
  version: number;
  channel: 'EMAIL';
  endpointFingerprintSha256: string;
  scope: OutboundContactSuppressionScopeV1;
  status: OutboundContactSuppressionStatusV1;
  reasonCode: OutboundContactSuppressionReasonV1;
  sourceClass: OutboundContactSuppressionSourceClassV1;
  evidenceRefs: readonly string[];
  effectiveAt: string;
  recordedAt: string;
  recordedByPrincipalId: string;
  supersedesVersion: number | null;
  legalConsentVerifiedByMarkOrbit: false;
  externalSendAuthorized: false;
}
export interface OutboundContactReadinessV1 {
  schemaVersion: 1;
  workspaceId: string;
  evaluatedByPrincipalId: string;
  targetRef: Readonly<OutboundContactTargetReferenceV1>;
  channel: 'EMAIL';
  endpointFingerprintSha256: string;
  purpose: OutboundContactPurposeV1;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  reviewedSendFingerprintSha256: string;
  outcome: OutboundContactReadinessOutcomeV1;
  reason: OutboundContactReadinessReasonV1;
  basisAssertionRef?: Readonly<{ assertionId: OutboundContactBasisAssertionIdV1; version: number }>;
  suppressionRefs: readonly Readonly<{
    suppressionId: OutboundContactSuppressionIdV1;
    version: number;
    scope: OutboundContactSuppressionScopeV1;
    status: OutboundContactSuppressionStatusV1;
  }>[];
  evaluatedAt: string;
  readinessFingerprintSha256: string;
  authorityConsequences: typeof noOutboundContactReadinessAuthorityConsequencesV1;
}
export class OutboundContactPolicyValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'OutboundContactPolicyValidationError';
  }
}
const SHA = /^[0-9a-f]{64}$/u;
const BASIS = /^outbound-contact-basis_[A-Za-z0-9_-]+$/u;
const SUPPRESSION = /^outbound-contact-suppression_[A-Za-z0-9_-]+$/u;
function rec(v: unknown, f: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new OutboundContactPolicyValidationError(`${f} must be an object.`);
  return v as Record<string, unknown>;
}
function exact(v: Record<string, unknown>, allowed: readonly string[], f: string): void {
  const extra = Object.keys(v).filter((k) => !allowed.includes(k));
  const missing = allowed.filter((k) => !(k in v));
  if (extra.length || missing.length)
    throw new OutboundContactPolicyValidationError(
      `${f} must contain exactly the bounded V1 fields.`
    );
}
function txt(v: unknown, f: string, max = 500): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max)
    throw new OutboundContactPolicyValidationError(`${f} is invalid.`);
  return v.trim();
}
function pos(v: unknown, f: string): number {
  if (!Number.isSafeInteger(v) || Number(v) < 1)
    throw new OutboundContactPolicyValidationError(`${f} must be a positive integer.`);
  return Number(v);
}
function iso(v: unknown, f: string): string {
  const s = txt(v, f, 80);
  if (!Number.isFinite(Date.parse(s)))
    throw new OutboundContactPolicyValidationError(`${f} must be an ISO timestamp.`);
  return new Date(s).toISOString();
}
function sha(v: unknown, f: string): string {
  const s = txt(v, f, 64);
  if (!SHA.test(s))
    throw new OutboundContactPolicyValidationError(`${f} must be lowercase SHA-256.`);
  return s;
}
function one<T extends string>(v: unknown, a: readonly T[], f: string): T {
  const x = typeof v === 'string' ? a.find((i) => i === v) : undefined;
  if (!x) throw new OutboundContactPolicyValidationError(`${f} is invalid.`);
  return x;
}
function reference(v: unknown, f: string, max = 500): string {
  const s = txt(v, f, max);
  if (s.includes('@'))
    throw new OutboundContactPolicyValidationError(
      `${f} must be an opaque reference, not raw contact data.`
    );
  return s;
}
function refs(v: unknown, f: string): readonly string[] {
  if (!Array.isArray(v) || v.length > 20)
    throw new OutboundContactPolicyValidationError(`${f} must be a bounded array.`);
  return v.map((x, i) => reference(x, `${f}[${i}]`, 500));
}
function target(v: unknown): OutboundContactTargetReferenceV1 {
  const x = rec(v, 'targetRef');
  const keys = Object.keys(x).sort().join(',');
  if (keys !== 'id,kind,owner,version')
    throw new OutboundContactPolicyValidationError('targetRef must contain exact V1 fields.');
  return {
    owner: txt(x.owner, 'targetRef.owner', 120),
    kind: txt(x.kind, 'targetRef.kind', 120),
    id: reference(x.id, 'targetRef.id', 500),
    version: pos(x.version, 'targetRef.version')
  };
}
function policy(v: unknown): OutboundContactPolicyReferenceV1 {
  const x = rec(v, 'policyRef');
  const keys = Object.keys(x).sort().join(',');
  if (keys !== 'policyId,version')
    throw new OutboundContactPolicyValidationError('policyRef must contain exact V1 fields.');
  return {
    policyId: txt(x.policyId, 'policyRef.policyId', 240),
    version: pos(x.version, 'policyRef.version')
  };
}
function consequence(v: unknown, readiness = false): void {
  const expected = readiness
    ? noOutboundContactReadinessAuthorityConsequencesV1
    : noOutboundContactBasisAuthorityConsequencesV1;
  const x = rec(v, 'authorityConsequences');
  exact(x, Object.keys(expected), 'authorityConsequences');
  if (Object.values(x).some((entry) => entry !== false))
    throw new OutboundContactPolicyValidationError(
      'authorityConsequences must preserve the V1 false authority locks.'
    );
}
export function parseOutboundContactBasisAssertionV1(
  value: unknown
): OutboundContactBasisAssertionV1 {
  const x = rec(value, 'basisAssertion');
  exact(
    x,
    [
      'schemaVersion',
      'assertionId',
      'workspaceId',
      'version',
      'targetRef',
      'channel',
      'endpointFingerprintSha256',
      'purpose',
      'marketOrJurisdiction',
      'policyRef',
      'basisState',
      'evidenceRefs',
      'assertedByPrincipalId',
      'assertedAt',
      'status',
      'supersedesVersion',
      'authorityConsequences'
    ].filter((k) => k !== 'marketOrJurisdiction' || x.marketOrJurisdiction !== undefined),
    'basisAssertion'
  );
  if (x.schemaVersion !== 1)
    throw new OutboundContactPolicyValidationError('schemaVersion must be 1.');
  consequence(x.authorityConsequences);
  const id = txt(x.assertionId, 'assertionId', 240);
  if (!BASIS.test(id)) throw new OutboundContactPolicyValidationError('assertionId is invalid.');
  const supersedes =
    x.supersedesVersion === null ? null : pos(x.supersedesVersion, 'supersedesVersion');
  const market =
    x.marketOrJurisdiction === undefined
      ? undefined
      : txt(x.marketOrJurisdiction, 'marketOrJurisdiction', 80);
  return {
    schemaVersion: 1,
    assertionId: id as OutboundContactBasisAssertionIdV1,
    workspaceId: txt(x.workspaceId, 'workspaceId', 80),
    version: pos(x.version, 'version'),
    targetRef: target(x.targetRef),
    channel: one(x.channel, outboundContactChannels, 'channel'),
    endpointFingerprintSha256: sha(x.endpointFingerprintSha256, 'endpointFingerprintSha256'),
    purpose: one(x.purpose, outboundContactPurposes, 'purpose'),
    ...(market ? { marketOrJurisdiction: market } : {}),
    policyRef: policy(x.policyRef),
    basisState: one(x.basisState, outboundContactBasisStates, 'basisState'),
    evidenceRefs: refs(x.evidenceRefs, 'evidenceRefs'),
    assertedByPrincipalId: txt(x.assertedByPrincipalId, 'assertedByPrincipalId', 240),
    assertedAt: iso(x.assertedAt, 'assertedAt'),
    status: one(x.status, outboundContactBasisStatuses, 'status'),
    supersedesVersion: supersedes,
    authorityConsequences: noOutboundContactBasisAuthorityConsequencesV1
  };
}
export function parseOutboundContactSuppressionV1(value: unknown): OutboundContactSuppressionV1 {
  const x = rec(value, 'suppression');
  exact(
    x,
    [
      'schemaVersion',
      'suppressionId',
      'workspaceId',
      'version',
      'channel',
      'endpointFingerprintSha256',
      'scope',
      'status',
      'reasonCode',
      'sourceClass',
      'evidenceRefs',
      'effectiveAt',
      'recordedAt',
      'recordedByPrincipalId',
      'supersedesVersion',
      'legalConsentVerifiedByMarkOrbit',
      'externalSendAuthorized'
    ],
    'suppression'
  );
  if (x.schemaVersion !== 1)
    throw new OutboundContactPolicyValidationError('schemaVersion must be 1.');
  const id = txt(x.suppressionId, 'suppressionId', 240);
  if (!SUPPRESSION.test(id))
    throw new OutboundContactPolicyValidationError('suppressionId is invalid.');
  if (x.legalConsentVerifiedByMarkOrbit !== false || x.externalSendAuthorized !== false)
    throw new OutboundContactPolicyValidationError(
      'suppression authority locks must remain false.'
    );
  return {
    schemaVersion: 1,
    suppressionId: id as OutboundContactSuppressionIdV1,
    workspaceId: txt(x.workspaceId, 'workspaceId', 80),
    version: pos(x.version, 'version'),
    channel: one(x.channel, outboundContactChannels, 'channel'),
    endpointFingerprintSha256: sha(x.endpointFingerprintSha256, 'endpointFingerprintSha256'),
    scope: one(x.scope, outboundContactSuppressionScopes, 'scope'),
    status: one(x.status, outboundContactSuppressionStatuses, 'status'),
    reasonCode: one(x.reasonCode, outboundContactSuppressionReasons, 'reasonCode'),
    sourceClass: one(x.sourceClass, outboundContactSuppressionSourceClasses, 'sourceClass'),
    evidenceRefs: refs(x.evidenceRefs, 'evidenceRefs'),
    effectiveAt: iso(x.effectiveAt, 'effectiveAt'),
    recordedAt: iso(x.recordedAt, 'recordedAt'),
    recordedByPrincipalId: txt(x.recordedByPrincipalId, 'recordedByPrincipalId', 240),
    supersedesVersion:
      x.supersedesVersion === null ? null : pos(x.supersedesVersion, 'supersedesVersion'),
    legalConsentVerifiedByMarkOrbit: false,
    externalSendAuthorized: false
  };
}
export function assertOutboundContactReadinessV1(
  value: unknown
): asserts value is OutboundContactReadinessV1 {
  const x = rec(value, 'readiness');
  consequence(x.authorityConsequences, true);
  sha(x.readinessFingerprintSha256, 'readinessFingerprintSha256');
  sha(x.reviewedSendFingerprintSha256, 'reviewedSendFingerprintSha256');
  one(x.outcome, outboundContactReadinessOutcomes, 'outcome');
  one(x.reason, outboundContactReadinessReasons, 'reason');
}
