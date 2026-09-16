import { createHash } from 'node:crypto';

export const businessAttributionMotionKinds = [
  'DATA_PROSPECTING',
  'PORTFOLIO_GROWTH',
  'PARTNER_DEVELOPMENT',
  'SITE_INBOUND',
  'CONTENT_LED_DEMAND'
] as const;
export type BusinessAttributionMotionKindV1 = (typeof businessAttributionMotionKinds)[number];

export const businessAttributionStates = [
  'ATTRIBUTED',
  'DIRECT',
  'UNATTRIBUTED',
  'UNKNOWN'
] as const;
export type BusinessAttributionStateV1 = (typeof businessAttributionStates)[number];

export const businessAttributionEvidenceBases = [
  'EXACT_LINEAGE',
  'HUMAN_CONFIRMED',
  'OWNER_REPORTED'
] as const;
export type BusinessAttributionEvidenceBasisV1 = (typeof businessAttributionEvidenceBases)[number];
export type BusinessAttributionLinkIdV1 = `business-attribution_${string}`;

export interface BusinessAttributionReferenceV1 {
  owner: string;
  kind: string;
  id: string;
  version: number | string;
  fingerprintSha256: string;
  observedAt: string;
}

export const noBusinessAttributionAuthorityConsequencesV1 = Object.freeze({
  customerCreated: false,
  contactPermissionGranted: false,
  conversionCreated: false,
  paymentCreated: false,
  providerAppointed: false,
  filingAuthorized: false,
  officialTruthCreated: false,
  causalReturnOnInvestmentClaimed: false
});

/** Lite-owned observational lineage only; downstream owner records remain authoritative. */
export interface BusinessAttributionLinkV1 {
  schemaVersion: 1;
  businessAttributionLinkId: BusinessAttributionLinkIdV1;
  workspaceId: string;
  version: 1;
  motionKind: BusinessAttributionMotionKindV1;
  sourceRefs: readonly Readonly<BusinessAttributionReferenceV1>[];
  touchpointRefs: readonly Readonly<BusinessAttributionReferenceV1>[];
  downstreamRef?: Readonly<BusinessAttributionReferenceV1>;
  attributionState: BusinessAttributionStateV1;
  evidenceBasis: BusinessAttributionEvidenceBasisV1;
  evaluatedAt: string;
  recordedByPrincipalId: string;
  businessAttributionFingerprintSha256: string;
  authorityConsequences: typeof noBusinessAttributionAuthorityConsequencesV1;
}

export class BusinessAttributionValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessAttributionValidationError';
  }
}

const SHA256 = /^[0-9a-f]{64}$/u;
const LINK_ID = /^business-attribution_[A-Za-z0-9_-]+$/u;

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BusinessAttributionValidationError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[], field: string): void {
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new BusinessAttributionValidationError(`${field} must contain exactly the V1 fields.`);
  }
}
function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new BusinessAttributionValidationError(`${field} is invalid.`);
  }
  return value.trim();
}
function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new BusinessAttributionValidationError(`${field} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}
function fingerprint(value: unknown, field: string): string {
  const normalized = text(value, field, 64);
  if (!SHA256.test(normalized)) {
    throw new BusinessAttributionValidationError(`${field} must be lowercase SHA-256.`);
  }
  return normalized;
}
function oneOf<T extends string>(value: unknown, values: readonly T[], field: string): T {
  const match =
    typeof value === 'string' ? values.find((candidate) => candidate === value) : undefined;
  if (!match) throw new BusinessAttributionValidationError(`${field} is invalid.`);
  return match;
}
function reference(value: unknown, field: string): BusinessAttributionReferenceV1 {
  const input = record(value, field);
  exactKeys(input, ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt'], field);
  const version = input.version;
  if (!(
    (Number.isSafeInteger(version) && Number(version) >= 1) ||
    (typeof version === 'string' && version.trim().length > 0 && version.trim().length <= 200)
  )) {
    throw new BusinessAttributionValidationError(`${field}.version is invalid.`);
  }
  return {
    owner: text(input.owner, `${field}.owner`, 120),
    kind: text(input.kind, `${field}.kind`, 160),
    id: text(input.id, `${field}.id`, 500),
    version: typeof version === 'string' ? version.trim() : Number(version),
    fingerprintSha256: fingerprint(input.fingerprintSha256, `${field}.fingerprintSha256`),
    observedAt: timestamp(input.observedAt, `${field}.observedAt`)
  };
}
function references(
  value: unknown,
  field: string,
  required: boolean
): BusinessAttributionReferenceV1[] {
  if (!Array.isArray(value) || value.length > 20 || (required && value.length === 0)) {
    throw new BusinessAttributionValidationError(
      `${field} must be a bounded${required ? ' non-empty' : ''} array.`
    );
  }
  const parsed = value.map((item, index) => reference(item, `${field}[${index}]`));
  const identities = parsed.map((item) => `${item.owner}:${item.kind}:${item.id}:${item.version}`);
  if (new Set(identities).size !== identities.length) {
    throw new BusinessAttributionValidationError(
      `${field} must not contain duplicate exact references.`
    );
  }
  return parsed;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}
export function businessAttributionFingerprintSha256V1(
  value: Omit<BusinessAttributionLinkV1, 'businessAttributionFingerprintSha256'>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export function parseBusinessAttributionLinkV1(value: unknown): BusinessAttributionLinkV1 {
  const input = record(value, 'businessAttributionLink');
  exactKeys(
    input,
    [
      'schemaVersion',
      'businessAttributionLinkId',
      'workspaceId',
      'version',
      'motionKind',
      'sourceRefs',
      'touchpointRefs',
      ...(input.downstreamRef === undefined ? [] : ['downstreamRef']),
      'attributionState',
      'evidenceBasis',
      'evaluatedAt',
      'recordedByPrincipalId',
      'businessAttributionFingerprintSha256',
      'authorityConsequences'
    ],
    'businessAttributionLink'
  );
  if (input.schemaVersion !== 1 || input.version !== 1) {
    throw new BusinessAttributionValidationError('Business attribution schema/version must be 1.');
  }
  const id = text(input.businessAttributionLinkId, 'businessAttributionLinkId', 240);
  if (!LINK_ID.test(id))
    throw new BusinessAttributionValidationError('businessAttributionLinkId is invalid.');
  const consequences = record(input.authorityConsequences, 'authorityConsequences');
  exactKeys(
    consequences,
    Object.keys(noBusinessAttributionAuthorityConsequencesV1),
    'authorityConsequences'
  );
  if (Object.values(consequences).some((entry) => entry !== false)) {
    throw new BusinessAttributionValidationError(
      'Attribution authority consequences must remain false.'
    );
  }
  const parsed = {
    schemaVersion: 1 as const,
    businessAttributionLinkId: id as BusinessAttributionLinkIdV1,
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: 1 as const,
    motionKind: oneOf(input.motionKind, businessAttributionMotionKinds, 'motionKind'),
    sourceRefs: references(input.sourceRefs, 'sourceRefs', true),
    touchpointRefs: references(input.touchpointRefs, 'touchpointRefs', false),
    ...(input.downstreamRef === undefined
      ? {}
      : { downstreamRef: reference(input.downstreamRef, 'downstreamRef') }),
    attributionState: oneOf(input.attributionState, businessAttributionStates, 'attributionState'),
    evidenceBasis: oneOf(input.evidenceBasis, businessAttributionEvidenceBases, 'evidenceBasis'),
    evaluatedAt: timestamp(input.evaluatedAt, 'evaluatedAt'),
    recordedByPrincipalId: text(input.recordedByPrincipalId, 'recordedByPrincipalId', 240),
    authorityConsequences: noBusinessAttributionAuthorityConsequencesV1
  };
  if (
    (parsed.attributionState === 'ATTRIBUTED' || parsed.attributionState === 'DIRECT') &&
    !parsed.downstreamRef
  ) {
    throw new BusinessAttributionValidationError(
      'ATTRIBUTED and DIRECT require an exact downstream owner reference.'
    );
  }
  const expected = businessAttributionFingerprintSha256V1(parsed);
  if (
    fingerprint(
      input.businessAttributionFingerprintSha256,
      'businessAttributionFingerprintSha256'
    ) !== expected
  ) {
    throw new BusinessAttributionValidationError('Business attribution fingerprint mismatch.');
  }
  return { ...parsed, businessAttributionFingerprintSha256: expected };
}
