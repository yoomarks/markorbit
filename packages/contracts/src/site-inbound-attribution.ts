import { createHash } from 'node:crypto';
import type { BusinessAttributionStateV1 } from './business-attribution.js';

export interface SiteInboundContentReferenceV1 {
  owner: 'LITE';
  kind: 'PUBLISH_PACKAGE';
  id: string;
  version: number;
  fingerprintSha256: string;
}

export const noSiteInboundAcquisitionAuthorityConsequencesV1 = Object.freeze({
  customerIdentityEstablished: false,
  customerRelationshipCreated: false,
  contactPermissionGranted: false,
  conversionCreated: false,
  paymentCreated: false,
  causalReturnOnInvestmentClaimed: false
});

/** Bounded request evidence only. It is not visitor identity, consent, or conversion truth. */
export interface SiteInboundAcquisitionV1 {
  schemaVersion: 1;
  attributionState: BusinessAttributionStateV1;
  landingPath: string;
  source?: string;
  campaign?: string;
  content?: string;
  referral?: string;
  referrerHostname?: string;
  contentRef?: Readonly<SiteInboundContentReferenceV1>;
  observedAt: string;
  fingerprintSha256: string;
  authorityConsequences: typeof noSiteInboundAcquisitionAuthorityConsequencesV1;
}

export interface SiteInboundAttributionSummaryV1 {
  schemaVersion: 1;
  workspaceId: string;
  intakeCount: number;
  quotePreparedCount: number;
  orderCount: number;
  confirmationCount: number;
  matterCount: number;
  bySiteSource: readonly Readonly<{
    siteId: string;
    source: string;
    attributionState: BusinessAttributionStateV1;
    intakeCount: number;
  }>[];
  byAttributionState: Readonly<Record<BusinessAttributionStateV1, number>>;
  evaluatedAt: string;
}

export class SiteInboundAcquisitionValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'SiteInboundAcquisitionValidationError';
  }
}

const SHA256 = /^[0-9a-f]{64}$/u;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/u;
const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SiteInboundAcquisitionValidationError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new SiteInboundAcquisitionValidationError(`${field} contains unsupported fields.`);
  }
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new SiteInboundAcquisitionValidationError(`${field} must be an ISO timestamp.`);
  }
  return new Date(value).toISOString();
}

function fingerprint(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new SiteInboundAcquisitionValidationError(`${field} must be lowercase SHA-256.`);
  }
  return value;
}

function token(value: unknown, field: string): string {
  if (typeof value !== 'string' || !TOKEN.test(value)) {
    throw new SiteInboundAcquisitionValidationError(`${field} must be a bounded opaque token.`);
  }
  return value;
}

function landingPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.length > 300 ||
    value.includes('?') ||
    value.includes('#')
  ) {
    throw new SiteInboundAcquisitionValidationError('landingPath must be a bounded path only.');
  }
  return value;
}

function hostname(value: unknown): string {
  if (typeof value !== 'string' || !HOSTNAME.test(value)) {
    throw new SiteInboundAcquisitionValidationError('referrerHostname is invalid.');
  }
  return value;
}

function contentReference(value: unknown): SiteInboundContentReferenceV1 {
  const input = object(value, 'contentRef');
  exactKeys(input, ['owner', 'kind', 'id', 'version', 'fingerprintSha256'], 'contentRef');
  if (input.owner !== 'LITE' || input.kind !== 'PUBLISH_PACKAGE') {
    throw new SiteInboundAcquisitionValidationError('contentRef owner/kind is invalid.');
  }
  if (typeof input.id !== 'string' || !input.id.trim() || input.id.length > 300) {
    throw new SiteInboundAcquisitionValidationError('contentRef.id is invalid.');
  }
  if (!Number.isSafeInteger(input.version) || Number(input.version) < 1) {
    throw new SiteInboundAcquisitionValidationError('contentRef.version is invalid.');
  }
  return {
    owner: 'LITE',
    kind: 'PUBLISH_PACKAGE',
    id: input.id.trim(),
    version: Number(input.version),
    fingerprintSha256: fingerprint(input.fingerprintSha256, 'contentRef.fingerprintSha256')
  };
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

export function siteInboundAcquisitionFingerprintSha256V1(
  value: Omit<SiteInboundAcquisitionV1, 'fingerprintSha256'>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export function parseSiteInboundAcquisitionV1(value: unknown): SiteInboundAcquisitionV1 {
  const input = object(value, 'siteInboundAcquisition');
  exactKeys(
    input,
    [
      'schemaVersion',
      'attributionState',
      'landingPath',
      'source',
      'campaign',
      'content',
      'referral',
      'referrerHostname',
      'contentRef',
      'observedAt',
      'fingerprintSha256',
      'authorityConsequences'
    ],
    'siteInboundAcquisition'
  );
  if (input.schemaVersion !== 1) {
    throw new SiteInboundAcquisitionValidationError(
      'siteInboundAcquisition.schemaVersion must be 1.'
    );
  }
  const states = ['ATTRIBUTED', 'DIRECT', 'UNATTRIBUTED', 'UNKNOWN'] as const;
  const attributionState = states.find((candidate) => candidate === input.attributionState);
  if (!attributionState) {
    throw new SiteInboundAcquisitionValidationError('attributionState is invalid.');
  }
  const consequences = object(input.authorityConsequences, 'authorityConsequences');
  exactKeys(
    consequences,
    Object.keys(noSiteInboundAcquisitionAuthorityConsequencesV1),
    'authorityConsequences'
  );
  if (Object.values(consequences).some((entry) => entry !== false)) {
    throw new SiteInboundAcquisitionValidationError(
      'Acquisition authority consequences must remain false.'
    );
  }
  const withoutFingerprint = {
    schemaVersion: 1 as const,
    attributionState,
    landingPath: landingPath(input.landingPath),
    ...(input.source === undefined ? {} : { source: token(input.source, 'source') }),
    ...(input.campaign === undefined ? {} : { campaign: token(input.campaign, 'campaign') }),
    ...(input.content === undefined ? {} : { content: token(input.content, 'content') }),
    ...(input.referral === undefined ? {} : { referral: token(input.referral, 'referral') }),
    ...(input.referrerHostname === undefined
      ? {}
      : { referrerHostname: hostname(input.referrerHostname) }),
    ...(input.contentRef === undefined ? {} : { contentRef: contentReference(input.contentRef) }),
    observedAt: timestamp(input.observedAt, 'observedAt'),
    authorityConsequences: noSiteInboundAcquisitionAuthorityConsequencesV1
  };
  const expected = siteInboundAcquisitionFingerprintSha256V1(withoutFingerprint);
  if (fingerprint(input.fingerprintSha256, 'fingerprintSha256') !== expected) {
    throw new SiteInboundAcquisitionValidationError(
      'Site inbound acquisition fingerprint mismatch.'
    );
  }
  return { ...withoutFingerprint, fingerprintSha256: expected };
}
