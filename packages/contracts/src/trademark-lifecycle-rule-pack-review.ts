import {
  CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_VERSION_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_ID
} from './brain-cn-trademark-lifecycle-history.js';
import { factCandidateSha256Utf8HexV1 } from './fact-candidate-v1.js';
import {
  noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1,
  type ExactOwnerReferenceV1
} from './trademark-lifecycle.js';

/**
 * LCR-A2b2d structural evidence only. Parsing or hashing these objects does not authenticate
 * MarkReg, prove Core authority, activate a Rule Pack, or authorize any protected action.
 */
export const TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1 =
  'MARKORBIT_TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_V1' as const;
export const TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER = 'MARKREG' as const;
export const TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND =
  'LIFECYCLE_RULE_PACK_REVIEW_RECEIPT' as const;
export const TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND =
  'LIFECYCLE_RULE_PACK_REVIEW_REVOCATION' as const;
export const TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CURRENTNESS_KIND =
  'LIFECYCLE_RULE_PACK_REVIEW_CURRENTNESS' as const;

export const trademarkLifecycleRulePackReviewOutcomesV1 = [
  'ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW',
  'REJECTED'
] as const;
export type TrademarkLifecycleRulePackReviewOutcomeV1 =
  (typeof trademarkLifecycleRulePackReviewOutcomesV1)[number];

export const trademarkLifecycleRulePackReviewRevocationReasonCodesV1 = [
  'GOVERNANCE_WITHDRAWAL',
  'REVIEW_DEFECT',
  'REVIEWER_AUTHORITY_INVALIDATED',
  'REVIEWED_SCOPE_INVALIDATED'
] as const;
export type TrademarkLifecycleRulePackReviewRevocationReasonCodeV1 =
  (typeof trademarkLifecycleRulePackReviewRevocationReasonCodesV1)[number];

export const trademarkLifecycleRulePackReviewCurrentnessStatusesV1 = [
  'CURRENT',
  'SUPERSEDED',
  'REVOKED',
  'EXPIRED',
  'REVIEWER_AUTHORITY_NOT_CURRENT',
  'REVIEWED_SCOPE_CHANGED',
  'NOT_FOUND',
  'UNAVAILABLE',
  'INTEGRITY_FAILURE'
] as const;
export type TrademarkLifecycleRulePackReviewCurrentnessStatusV1 =
  (typeof trademarkLifecycleRulePackReviewCurrentnessStatusesV1)[number];

export const trademarkLifecycleRulePackReviewCurrentnessBasisV1 = [
  'RECEIPT_HEAD',
  'REVOCATION',
  'REVIEWER_AUTHORITY',
  'REVIEWED_SCOPE'
] as const;
export type TrademarkLifecycleRulePackReviewCurrentnessBasisV1 =
  (typeof trademarkLifecycleRulePackReviewCurrentnessBasisV1)[number];

export interface FingerprintedOwnerReferenceV1 extends ExactOwnerReferenceV1 {
  fingerprintSha256: string;
}

export type TrademarkLifecycleRulePackReviewReceiptIdV1 =
  `trademark-lifecycle-rule-pack-review_${string}`;
export type TrademarkLifecycleRulePackReviewRevocationIdV1 =
  `trademark-lifecycle-rule-pack-review-revocation_${string}`;
export type TrademarkLifecycleRulePackReviewCurrentnessIdV1 =
  `trademark-lifecycle-rule-pack-review-currentness_${string}`;

export interface TrademarkLifecycleRulePackReviewReceiptReferenceV1 extends FingerprintedOwnerReferenceV1 {
  owner: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER;
  kind: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND;
  id: TrademarkLifecycleRulePackReviewReceiptIdV1;
  version: 1;
}

export interface TrademarkLifecycleRulePackReviewRevocationReferenceV1 extends FingerprintedOwnerReferenceV1 {
  owner: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER;
  kind: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND;
  id: TrademarkLifecycleRulePackReviewRevocationIdV1;
  version: 1;
}

export interface TrademarkLifecycleRulePackReviewCandidateV1 {
  applicabilityFingerprintSha256: string;
  methodReference: Readonly<FingerprintedOwnerReferenceV1>;
  methodPackageReference: Readonly<FingerprintedOwnerReferenceV1>;
}

export interface TrademarkLifecycleRulePackReviewedBoundaryV1 {
  resultSemantics: 'SOURCE_RECORDED_COMPLETED_HISTORY_ONLY';
  timeAssertionClass: 'SOURCE_RECORDED';
  timePresentationMeaning: 'RECORDED_FACT';
}

export interface TrademarkLifecycleRulePackReviewerV1 {
  role: 'TRADEMARK_LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEWER';
  principalReference: Readonly<FingerprintedOwnerReferenceV1>;
  authorityReference: Readonly<FingerprintedOwnerReferenceV1>;
}

export interface TrademarkLifecycleRulePackReviewAuthorityConsequencesV1 extends Readonly<
  typeof noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1
> {
  reviewedTimingUnlocked: false;
  professionalAdviceProvided: false;
  runtimeExposureAuthorized: false;
  workOrMatterMutationAuthorized: false;
}

export const noTrademarkLifecycleRulePackReviewAuthorityConsequencesV1 = Object.freeze({
  ...noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1,
  reviewedTimingUnlocked: false,
  professionalAdviceProvided: false,
  runtimeExposureAuthorized: false,
  workOrMatterMutationAuthorized: false
}) satisfies Readonly<TrademarkLifecycleRulePackReviewAuthorityConsequencesV1>;

export interface TrademarkLifecycleRulePackReviewReceiptFingerprintMaterialV1 {
  contractVersion: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1;
  schemaVersion: 1;
  owner: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER;
  kind: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND;
  version: 1;
  outcome: TrademarkLifecycleRulePackReviewOutcomeV1;
  candidate: Readonly<TrademarkLifecycleRulePackReviewCandidateV1>;
  reviewedBoundary: Readonly<TrademarkLifecycleRulePackReviewedBoundaryV1>;
  reviewedScopeFingerprintSha256: string;
  reviewer: Readonly<TrademarkLifecycleRulePackReviewerV1>;
  reviewedAt: string;
  expiresAt: string | null;
  supersedesReceiptReference: Readonly<TrademarkLifecycleRulePackReviewReceiptReferenceV1> | null;
  reasonCodes: readonly string[];
  authority: Readonly<TrademarkLifecycleRulePackReviewAuthorityConsequencesV1>;
}

export interface TrademarkLifecycleRulePackReviewReceiptV1 extends TrademarkLifecycleRulePackReviewReceiptFingerprintMaterialV1 {
  receiptId: TrademarkLifecycleRulePackReviewReceiptIdV1;
  receiptFingerprintSha256: string;
}

export interface TrademarkLifecycleRulePackReviewRevocationActorV1 {
  principalReference: Readonly<FingerprintedOwnerReferenceV1>;
  authorityReference: Readonly<FingerprintedOwnerReferenceV1>;
}

export interface TrademarkLifecycleRulePackReviewRevocationFingerprintMaterialV1 {
  contractVersion: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1;
  schemaVersion: 1;
  owner: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER;
  kind: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND;
  version: 1;
  targetReceiptReference: Readonly<TrademarkLifecycleRulePackReviewReceiptReferenceV1>;
  revokedAt: string;
  revokedBy: Readonly<TrademarkLifecycleRulePackReviewRevocationActorV1>;
  reasonCode: TrademarkLifecycleRulePackReviewRevocationReasonCodeV1;
  authority: Readonly<TrademarkLifecycleRulePackReviewAuthorityConsequencesV1>;
}

export interface TrademarkLifecycleRulePackReviewRevocationV1 extends TrademarkLifecycleRulePackReviewRevocationFingerprintMaterialV1 {
  revocationId: TrademarkLifecycleRulePackReviewRevocationIdV1;
  revocationFingerprintSha256: string;
}

export type TrademarkLifecycleRulePackReviewCurrentnessResultV1 =
  | {
      status: 'CURRENT';
      headReceiptReference: Readonly<TrademarkLifecycleRulePackReviewReceiptReferenceV1>;
      reviewerAuthorityReference: Readonly<FingerprintedOwnerReferenceV1>;
      reviewedScopeFingerprintSha256: string;
    }
  | {
      status: 'SUPERSEDED';
      successorReceiptReference: Readonly<TrademarkLifecycleRulePackReviewReceiptReferenceV1>;
    }
  | {
      status: 'REVOKED';
      revocationReference: Readonly<TrademarkLifecycleRulePackReviewRevocationReferenceV1>;
    }
  | { status: 'EXPIRED' }
  | {
      status: 'REVIEWER_AUTHORITY_NOT_CURRENT';
      reviewerAuthorityReference: Readonly<FingerprintedOwnerReferenceV1>;
    }
  | {
      status: 'REVIEWED_SCOPE_CHANGED';
      observedScopeFingerprintSha256: string;
    }
  | { status: 'NOT_FOUND' }
  | {
      status: 'UNAVAILABLE';
      unavailableBasis: readonly TrademarkLifecycleRulePackReviewCurrentnessBasisV1[];
    }
  | {
      status: 'INTEGRITY_FAILURE';
      failedBasis: readonly TrademarkLifecycleRulePackReviewCurrentnessBasisV1[];
    };

export interface TrademarkLifecycleRulePackReviewCurrentnessFingerprintMaterialV1 {
  contractVersion: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1;
  schemaVersion: 1;
  owner: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER;
  kind: typeof TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CURRENTNESS_KIND;
  receiptReference: Readonly<TrademarkLifecycleRulePackReviewReceiptReferenceV1>;
  asOf: string;
  result: Readonly<TrademarkLifecycleRulePackReviewCurrentnessResultV1>;
  authority: Readonly<TrademarkLifecycleRulePackReviewAuthorityConsequencesV1>;
}

export interface TrademarkLifecycleRulePackReviewCurrentnessV1 extends TrademarkLifecycleRulePackReviewCurrentnessFingerprintMaterialV1 {
  observationId: TrademarkLifecycleRulePackReviewCurrentnessIdV1;
  observationFingerprintSha256: string;
}

export interface TrademarkLifecycleRulePackReviewCurrentnessRelationsV1 {
  successorReceipt?: unknown;
  revocation?: unknown;
}

export class TrademarkLifecycleRulePackReviewContractError extends TypeError {}

type JsonRecord = Record<string, unknown>;

const SHA256 = /^[a-f0-9]{64}$/u;
const STABLE_CODE = /^[A-Z][A-Z0-9_]{1,119}$/u;
const RECEIPT_ID_PREFIX = 'trademark-lifecycle-rule-pack-review_';
const REVOCATION_ID_PREFIX = 'trademark-lifecycle-rule-pack-review-revocation_';
const CURRENTNESS_ID_PREFIX = 'trademark-lifecycle-rule-pack-review-currentness_';

const RECEIPT_MATERIAL_KEYS = [
  'contractVersion',
  'schemaVersion',
  'owner',
  'kind',
  'version',
  'outcome',
  'candidate',
  'reviewedBoundary',
  'reviewedScopeFingerprintSha256',
  'reviewer',
  'reviewedAt',
  'expiresAt',
  'supersedesReceiptReference',
  'reasonCodes',
  'authority'
] as const;
const REVOCATION_MATERIAL_KEYS = [
  'contractVersion',
  'schemaVersion',
  'owner',
  'kind',
  'version',
  'targetReceiptReference',
  'revokedAt',
  'revokedBy',
  'reasonCode',
  'authority'
] as const;
const CURRENTNESS_MATERIAL_KEYS = [
  'contractVersion',
  'schemaVersion',
  'owner',
  'kind',
  'receiptReference',
  'asOf',
  'result',
  'authority'
] as const;

function object(value: unknown, field: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TrademarkLifecycleRulePackReviewContractError(`${field} must be an object.`);
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, expected: readonly string[], field: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must contain exactly: ${wanted.join(', ')}.`
    );
  }
}

function text(value: unknown, field: string, maximum = 500): string {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > maximum
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(`${field} is invalid.`);
  }
  return value;
}

function timestamp(value: unknown, field: string): string {
  const parsed = text(value, field, 40);
  const date = new Date(parsed);
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== parsed) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must be a canonical ISO-8601 timestamp.`
    );
  }
  return parsed;
}

function compareTimestamps(left: string, right: string): number {
  return new Date(left).valueOf() - new Date(right).valueOf();
}

function sha256(value: unknown, field: string): string {
  const parsed = text(value, field, 64);
  if (!SHA256.test(parsed)) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must be a lowercase SHA-256 digest.`
    );
  }
  return parsed;
}

function stableCode(value: unknown, field: string): string {
  const parsed = text(value, field, 120);
  if (!STABLE_CODE.test(parsed)) {
    throw new TrademarkLifecycleRulePackReviewContractError(`${field} must be a stable code.`);
  }
  return parsed;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new TrademarkLifecycleRulePackReviewContractError(`${field} is unsupported.`);
  }
  return value as T;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function fingerprint(value: unknown): string {
  return factCandidateSha256Utf8HexV1(stableSerialize(value));
}

function same(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function materialWithoutIdentity(
  value: JsonRecord,
  idKey: string,
  fingerprintKey: string
): JsonRecord {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== idKey && key !== fingerprintKey)
  );
}

function parseFingerprintedReference(value: unknown, field: string): FingerprintedOwnerReferenceV1 {
  const reference = object(value, field);
  exactKeys(reference, ['owner', 'kind', 'id', 'version', 'fingerprintSha256'], field);
  const version = reference.version;
  if (!(
    (Number.isSafeInteger(version) && Number(version) >= 1) ||
    (typeof version === 'string' &&
      version.trim() === version &&
      version.length > 0 &&
      version.length <= 200)
  )) {
    throw new TrademarkLifecycleRulePackReviewContractError(`${field}.version is invalid.`);
  }
  return {
    owner: text(reference.owner, `${field}.owner`, 120),
    kind: text(reference.kind, `${field}.kind`, 160),
    id: text(reference.id, `${field}.id`, 500),
    version: typeof version === 'string' ? version : Number(version),
    fingerprintSha256: sha256(reference.fingerprintSha256, `${field}.fingerprintSha256`)
  };
}

function parseCoreReference(
  value: unknown,
  field: string,
  kind: 'AUTHENTICATED_PRINCIPAL' | 'LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY'
): FingerprintedOwnerReferenceV1 {
  const reference = parseFingerprintedReference(value, field);
  if (reference.owner !== 'CORE' || reference.kind !== kind) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must be the exact Core-owned ${kind} reference.`
    );
  }
  return reference;
}

function parseReceiptReference(
  value: unknown,
  field: string
): TrademarkLifecycleRulePackReviewReceiptReferenceV1 {
  const reference = parseFingerprintedReference(value, field);
  if (
    reference.owner !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER ||
    reference.kind !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND ||
    reference.version !== 1 ||
    reference.id !== `${RECEIPT_ID_PREFIX}${reference.fingerprintSha256}`
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must identify one exact MarkReg lifecycle Rule Pack review receipt V1.`
    );
  }
  return reference as TrademarkLifecycleRulePackReviewReceiptReferenceV1;
}

function parseRevocationReference(
  value: unknown,
  field: string
): TrademarkLifecycleRulePackReviewRevocationReferenceV1 {
  const reference = parseFingerprintedReference(value, field);
  if (
    reference.owner !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER ||
    reference.kind !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND ||
    reference.version !== 1 ||
    reference.id !== `${REVOCATION_ID_PREFIX}${reference.fingerprintSha256}`
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must identify one exact MarkReg lifecycle Rule Pack review revocation V1.`
    );
  }
  return reference as TrademarkLifecycleRulePackReviewRevocationReferenceV1;
}

function parseCodes(value: unknown, field: string, minimum = 0): readonly string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > 50) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must contain between ${minimum} and 50 reason codes.`
    );
  }
  const codes = value.map((entry, index) => stableCode(entry, `${field}[${index}]`));
  if (new Set(codes).size !== codes.length) {
    throw new TrademarkLifecycleRulePackReviewContractError(`${field} contains duplicates.`);
  }
  const sorted = [...codes].sort(compareStrings);
  if (!same(codes, sorted)) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must use canonical ordering.`
    );
  }
  return sorted;
}

function parseCurrentnessBases(
  value: unknown,
  field: string
): readonly TrademarkLifecycleRulePackReviewCurrentnessBasisV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must contain one to four currentness bases.`
    );
  }
  const bases = value.map((entry, index) =>
    oneOf(entry, trademarkLifecycleRulePackReviewCurrentnessBasisV1, `${field}[${index}]`)
  );
  if (new Set(bases).size !== bases.length) {
    throw new TrademarkLifecycleRulePackReviewContractError(`${field} contains duplicates.`);
  }
  const sorted = [...bases].sort(
    (left, right) =>
      trademarkLifecycleRulePackReviewCurrentnessBasisV1.indexOf(left) -
      trademarkLifecycleRulePackReviewCurrentnessBasisV1.indexOf(right)
  );
  if (!same(bases, sorted)) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      `${field} must use canonical basis ordering.`
    );
  }
  return sorted;
}

function parseAuthority(
  value: unknown,
  field: string
): TrademarkLifecycleRulePackReviewAuthorityConsequencesV1 {
  const authority = object(value, field);
  const keys = Object.keys(noTrademarkLifecycleRulePackReviewAuthorityConsequencesV1);
  exactKeys(authority, keys, field);
  for (const key of keys) {
    if (authority[key] !== false) {
      throw new TrademarkLifecycleRulePackReviewContractError(`${field}.${key} must be false.`);
    }
  }
  return noTrademarkLifecycleRulePackReviewAuthorityConsequencesV1;
}

function parseCandidate(value: unknown): TrademarkLifecycleRulePackReviewCandidateV1 {
  const candidate = object(value, 'rulePackReviewReceipt.candidate');
  exactKeys(
    candidate,
    ['applicabilityFingerprintSha256', 'methodReference', 'methodPackageReference'],
    'rulePackReviewReceipt.candidate'
  );
  const applicabilityFingerprintSha256 = sha256(
    candidate.applicabilityFingerprintSha256,
    'rulePackReviewReceipt.candidate.applicabilityFingerprintSha256'
  );
  const methodReference = parseFingerprintedReference(
    candidate.methodReference,
    'rulePackReviewReceipt.candidate.methodReference'
  );
  const methodPackageReference = parseFingerprintedReference(
    candidate.methodPackageReference,
    'rulePackReviewReceipt.candidate.methodPackageReference'
  );
  if (
    applicabilityFingerprintSha256 !==
      CN_TRADEMARK_LIFECYCLE_HISTORY_APPLICABILITY_FINGERPRINT_SHA256 ||
    methodReference.owner !== 'BRAIN' ||
    methodReference.kind !== 'TEMPORAL_RESOLUTION_METHOD' ||
    methodReference.id !== CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_ID ||
    methodReference.version !== CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_VERSION_ID ||
    methodReference.fingerprintSha256 !==
      CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256 ||
    methodPackageReference.owner !== 'BRAIN' ||
    methodPackageReference.kind !== 'TEMPORAL_RESOLUTION_METHOD_PACKAGE' ||
    methodPackageReference.id !== CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_ID ||
    methodPackageReference.version !== 1 ||
    methodPackageReference.fingerprintSha256 !==
      CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewReceipt.candidate must bind the exact CN observed-history candidate.'
    );
  }
  return { applicabilityFingerprintSha256, methodReference, methodPackageReference };
}

function parseReviewedBoundary(value: unknown): TrademarkLifecycleRulePackReviewedBoundaryV1 {
  const boundary = object(value, 'rulePackReviewReceipt.reviewedBoundary');
  exactKeys(
    boundary,
    ['resultSemantics', 'timeAssertionClass', 'timePresentationMeaning'],
    'rulePackReviewReceipt.reviewedBoundary'
  );
  const expected = {
    resultSemantics: 'SOURCE_RECORDED_COMPLETED_HISTORY_ONLY',
    timeAssertionClass: 'SOURCE_RECORDED',
    timePresentationMeaning: 'RECORDED_FACT'
  } as const;
  if (!same(boundary, expected)) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'reviewedBoundary must remain source-recorded completed history only.'
    );
  }
  return expected;
}

function parseReviewer(value: unknown, field: string): TrademarkLifecycleRulePackReviewerV1 {
  const reviewer = object(value, field);
  exactKeys(reviewer, ['role', 'principalReference', 'authorityReference'], field);
  if (reviewer.role !== 'TRADEMARK_LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEWER') {
    throw new TrademarkLifecycleRulePackReviewContractError(`${field}.role is invalid.`);
  }
  return {
    role: 'TRADEMARK_LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEWER',
    principalReference: parseCoreReference(
      reviewer.principalReference,
      `${field}.principalReference`,
      'AUTHENTICATED_PRINCIPAL'
    ),
    authorityReference: parseCoreReference(
      reviewer.authorityReference,
      `${field}.authorityReference`,
      'LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY'
    )
  };
}

export function trademarkLifecycleRulePackReviewedScopeFingerprintSha256V1(
  value: Readonly<{
    candidate: Readonly<TrademarkLifecycleRulePackReviewCandidateV1>;
    reviewedBoundary: Readonly<TrademarkLifecycleRulePackReviewedBoundaryV1>;
  }>
): string {
  return fingerprint({ candidate: value.candidate, reviewedBoundary: value.reviewedBoundary });
}

function normalizeReceiptMaterial(
  value: unknown
): TrademarkLifecycleRulePackReviewReceiptFingerprintMaterialV1 {
  const receipt = object(value, 'rulePackReviewReceipt');
  exactKeys(receipt, RECEIPT_MATERIAL_KEYS, 'rulePackReviewReceipt');
  if (
    receipt.contractVersion !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1 ||
    receipt.schemaVersion !== 1 ||
    receipt.owner !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER ||
    receipt.kind !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND ||
    receipt.version !== 1
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewReceipt must use the fixed MarkReg V1 identity.'
    );
  }
  const outcome = oneOf(
    receipt.outcome,
    trademarkLifecycleRulePackReviewOutcomesV1,
    'rulePackReviewReceipt.outcome'
  );
  const reasonCodes = parseCodes(
    receipt.reasonCodes,
    'rulePackReviewReceipt.reasonCodes',
    outcome === 'REJECTED' ? 1 : 0
  );
  if (outcome === 'ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW' && reasonCodes.length !== 0) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'An acceptable receipt cannot carry rejection reasons.'
    );
  }
  const candidate = parseCandidate(receipt.candidate);
  const reviewedBoundary = parseReviewedBoundary(receipt.reviewedBoundary);
  const reviewedScopeFingerprintSha256 = sha256(
    receipt.reviewedScopeFingerprintSha256,
    'rulePackReviewReceipt.reviewedScopeFingerprintSha256'
  );
  if (
    reviewedScopeFingerprintSha256 !==
    trademarkLifecycleRulePackReviewedScopeFingerprintSha256V1({
      candidate,
      reviewedBoundary
    })
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'reviewedScopeFingerprintSha256 does not bind the exact reviewed scope.'
    );
  }
  const reviewedAt = timestamp(receipt.reviewedAt, 'rulePackReviewReceipt.reviewedAt');
  const expiresAt =
    receipt.expiresAt === null
      ? null
      : timestamp(receipt.expiresAt, 'rulePackReviewReceipt.expiresAt');
  if (expiresAt !== null && compareTimestamps(expiresAt, reviewedAt) <= 0) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewReceipt.expiresAt must be later than reviewedAt.'
    );
  }
  return {
    contractVersion: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1,
    schemaVersion: 1,
    owner: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
    kind: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND,
    version: 1,
    outcome,
    candidate,
    reviewedBoundary,
    reviewedScopeFingerprintSha256,
    reviewer: parseReviewer(receipt.reviewer, 'rulePackReviewReceipt.reviewer'),
    reviewedAt,
    expiresAt,
    supersedesReceiptReference:
      receipt.supersedesReceiptReference === null
        ? null
        : parseReceiptReference(
            receipt.supersedesReceiptReference,
            'rulePackReviewReceipt.supersedesReceiptReference'
          ),
    reasonCodes,
    authority: parseAuthority(receipt.authority, 'rulePackReviewReceipt.authority')
  };
}

export function trademarkLifecycleRulePackReviewReceiptFingerprintSha256V1(
  value:
    | Readonly<TrademarkLifecycleRulePackReviewReceiptFingerprintMaterialV1>
    | Readonly<TrademarkLifecycleRulePackReviewReceiptV1>
): string {
  const receipt = object(value, 'rulePackReviewReceipt');
  return fingerprint(
    normalizeReceiptMaterial(
      receipt.receiptFingerprintSha256 === undefined
        ? receipt
        : materialWithoutIdentity(receipt, 'receiptId', 'receiptFingerprintSha256')
    )
  );
}

export function trademarkLifecycleRulePackReviewReceiptIdV1(
  fingerprintSha256: string
): TrademarkLifecycleRulePackReviewReceiptIdV1 {
  return `${RECEIPT_ID_PREFIX}${sha256(fingerprintSha256, 'receiptFingerprintSha256')}`;
}

export function parseTrademarkLifecycleRulePackReviewReceiptV1(
  value: unknown
): TrademarkLifecycleRulePackReviewReceiptV1 {
  const receipt = object(value, 'rulePackReviewReceipt');
  exactKeys(
    receipt,
    [...RECEIPT_MATERIAL_KEYS, 'receiptId', 'receiptFingerprintSha256'],
    'rulePackReviewReceipt'
  );
  const material = normalizeReceiptMaterial(
    materialWithoutIdentity(receipt, 'receiptId', 'receiptFingerprintSha256')
  );
  const receiptFingerprintSha256 = fingerprint(material);
  if (
    sha256(receipt.receiptFingerprintSha256, 'rulePackReviewReceipt.receiptFingerprintSha256') !==
    receiptFingerprintSha256
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewReceipt fingerprint does not match its immutable material.'
    );
  }
  const receiptId = trademarkLifecycleRulePackReviewReceiptIdV1(receiptFingerprintSha256);
  if (receipt.receiptId !== receiptId) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewReceipt.receiptId must be derived from its exact fingerprint.'
    );
  }
  if (material.supersedesReceiptReference?.id === receiptId) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'A Rule Pack review receipt cannot supersede itself.'
    );
  }
  return { ...material, receiptId, receiptFingerprintSha256 };
}

export function trademarkLifecycleRulePackReviewReceiptReferenceV1(
  value: unknown
): TrademarkLifecycleRulePackReviewReceiptReferenceV1 {
  const receipt = parseTrademarkLifecycleRulePackReviewReceiptV1(value);
  return {
    owner: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
    kind: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_RECEIPT_KIND,
    id: receipt.receiptId,
    version: 1,
    fingerprintSha256: receipt.receiptFingerprintSha256
  };
}

function normalizeRevocationMaterial(
  value: unknown
): TrademarkLifecycleRulePackReviewRevocationFingerprintMaterialV1 {
  const revocation = object(value, 'rulePackReviewRevocation');
  exactKeys(revocation, REVOCATION_MATERIAL_KEYS, 'rulePackReviewRevocation');
  if (
    revocation.contractVersion !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1 ||
    revocation.schemaVersion !== 1 ||
    revocation.owner !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER ||
    revocation.kind !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND ||
    revocation.version !== 1
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewRevocation must use the fixed MarkReg V1 identity.'
    );
  }
  const revokedBy = object(revocation.revokedBy, 'rulePackReviewRevocation.revokedBy');
  exactKeys(
    revokedBy,
    ['principalReference', 'authorityReference'],
    'rulePackReviewRevocation.revokedBy'
  );
  return {
    contractVersion: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1,
    schemaVersion: 1,
    owner: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
    kind: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND,
    version: 1,
    targetReceiptReference: parseReceiptReference(
      revocation.targetReceiptReference,
      'rulePackReviewRevocation.targetReceiptReference'
    ),
    revokedAt: timestamp(revocation.revokedAt, 'rulePackReviewRevocation.revokedAt'),
    revokedBy: {
      principalReference: parseCoreReference(
        revokedBy.principalReference,
        'rulePackReviewRevocation.revokedBy.principalReference',
        'AUTHENTICATED_PRINCIPAL'
      ),
      authorityReference: parseCoreReference(
        revokedBy.authorityReference,
        'rulePackReviewRevocation.revokedBy.authorityReference',
        'LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY'
      )
    },
    reasonCode: oneOf(
      revocation.reasonCode,
      trademarkLifecycleRulePackReviewRevocationReasonCodesV1,
      'rulePackReviewRevocation.reasonCode'
    ),
    authority: parseAuthority(revocation.authority, 'rulePackReviewRevocation.authority')
  };
}

export function trademarkLifecycleRulePackReviewRevocationFingerprintSha256V1(
  value:
    | Readonly<TrademarkLifecycleRulePackReviewRevocationFingerprintMaterialV1>
    | Readonly<TrademarkLifecycleRulePackReviewRevocationV1>
): string {
  const revocation = object(value, 'rulePackReviewRevocation');
  return fingerprint(
    normalizeRevocationMaterial(
      revocation.revocationFingerprintSha256 === undefined
        ? revocation
        : materialWithoutIdentity(revocation, 'revocationId', 'revocationFingerprintSha256')
    )
  );
}

export function trademarkLifecycleRulePackReviewRevocationIdV1(
  fingerprintSha256: string
): TrademarkLifecycleRulePackReviewRevocationIdV1 {
  return `${REVOCATION_ID_PREFIX}${sha256(fingerprintSha256, 'revocationFingerprintSha256')}`;
}

export function parseTrademarkLifecycleRulePackReviewRevocationV1(
  value: unknown
): TrademarkLifecycleRulePackReviewRevocationV1 {
  const revocation = object(value, 'rulePackReviewRevocation');
  exactKeys(
    revocation,
    [...REVOCATION_MATERIAL_KEYS, 'revocationId', 'revocationFingerprintSha256'],
    'rulePackReviewRevocation'
  );
  const material = normalizeRevocationMaterial(
    materialWithoutIdentity(revocation, 'revocationId', 'revocationFingerprintSha256')
  );
  const revocationFingerprintSha256 = fingerprint(material);
  if (
    sha256(
      revocation.revocationFingerprintSha256,
      'rulePackReviewRevocation.revocationFingerprintSha256'
    ) !== revocationFingerprintSha256
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewRevocation fingerprint does not match its immutable material.'
    );
  }
  const revocationId = trademarkLifecycleRulePackReviewRevocationIdV1(revocationFingerprintSha256);
  if (revocation.revocationId !== revocationId) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewRevocation.revocationId must be derived from its exact fingerprint.'
    );
  }
  return { ...material, revocationId, revocationFingerprintSha256 };
}

export function trademarkLifecycleRulePackReviewRevocationReferenceV1(
  value: unknown
): TrademarkLifecycleRulePackReviewRevocationReferenceV1 {
  const revocation = parseTrademarkLifecycleRulePackReviewRevocationV1(value);
  return {
    owner: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
    kind: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_REVOCATION_KIND,
    id: revocation.revocationId,
    version: 1,
    fingerprintSha256: revocation.revocationFingerprintSha256
  };
}

function parseCurrentnessResult(
  value: unknown
): TrademarkLifecycleRulePackReviewCurrentnessResultV1 {
  const result = object(value, 'rulePackReviewCurrentness.result');
  const status = oneOf(
    result.status,
    trademarkLifecycleRulePackReviewCurrentnessStatusesV1,
    'rulePackReviewCurrentness.result.status'
  );
  if (status === 'CURRENT') {
    exactKeys(
      result,
      [
        'status',
        'headReceiptReference',
        'reviewerAuthorityReference',
        'reviewedScopeFingerprintSha256'
      ],
      'rulePackReviewCurrentness.result'
    );
    return {
      status,
      headReceiptReference: parseReceiptReference(
        result.headReceiptReference,
        'rulePackReviewCurrentness.result.headReceiptReference'
      ),
      reviewerAuthorityReference: parseCoreReference(
        result.reviewerAuthorityReference,
        'rulePackReviewCurrentness.result.reviewerAuthorityReference',
        'LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY'
      ),
      reviewedScopeFingerprintSha256: sha256(
        result.reviewedScopeFingerprintSha256,
        'rulePackReviewCurrentness.result.reviewedScopeFingerprintSha256'
      )
    };
  }
  if (status === 'SUPERSEDED') {
    exactKeys(result, ['status', 'successorReceiptReference'], 'rulePackReviewCurrentness.result');
    return {
      status,
      successorReceiptReference: parseReceiptReference(
        result.successorReceiptReference,
        'rulePackReviewCurrentness.result.successorReceiptReference'
      )
    };
  }
  if (status === 'REVOKED') {
    exactKeys(result, ['status', 'revocationReference'], 'rulePackReviewCurrentness.result');
    return {
      status,
      revocationReference: parseRevocationReference(
        result.revocationReference,
        'rulePackReviewCurrentness.result.revocationReference'
      )
    };
  }
  if (status === 'REVIEWER_AUTHORITY_NOT_CURRENT') {
    exactKeys(result, ['status', 'reviewerAuthorityReference'], 'rulePackReviewCurrentness.result');
    return {
      status,
      reviewerAuthorityReference: parseCoreReference(
        result.reviewerAuthorityReference,
        'rulePackReviewCurrentness.result.reviewerAuthorityReference',
        'LIFECYCLE_RULE_PACK_PROFESSIONAL_REVIEW_AUTHORITY'
      )
    };
  }
  if (status === 'REVIEWED_SCOPE_CHANGED') {
    exactKeys(
      result,
      ['status', 'observedScopeFingerprintSha256'],
      'rulePackReviewCurrentness.result'
    );
    return {
      status,
      observedScopeFingerprintSha256: sha256(
        result.observedScopeFingerprintSha256,
        'rulePackReviewCurrentness.result.observedScopeFingerprintSha256'
      )
    };
  }
  if (status === 'UNAVAILABLE') {
    exactKeys(result, ['status', 'unavailableBasis'], 'rulePackReviewCurrentness.result');
    return {
      status,
      unavailableBasis: parseCurrentnessBases(
        result.unavailableBasis,
        'rulePackReviewCurrentness.result.unavailableBasis'
      )
    };
  }
  if (status === 'INTEGRITY_FAILURE') {
    exactKeys(result, ['status', 'failedBasis'], 'rulePackReviewCurrentness.result');
    return {
      status,
      failedBasis: parseCurrentnessBases(
        result.failedBasis,
        'rulePackReviewCurrentness.result.failedBasis'
      )
    };
  }
  exactKeys(result, ['status'], 'rulePackReviewCurrentness.result');
  return { status };
}

function normalizeCurrentnessMaterial(
  value: unknown
): TrademarkLifecycleRulePackReviewCurrentnessFingerprintMaterialV1 {
  const observation = object(value, 'rulePackReviewCurrentness');
  exactKeys(observation, CURRENTNESS_MATERIAL_KEYS, 'rulePackReviewCurrentness');
  if (
    observation.contractVersion !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1 ||
    observation.schemaVersion !== 1 ||
    observation.owner !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER ||
    observation.kind !== TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CURRENTNESS_KIND
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewCurrentness must use the fixed MarkReg V1 identity.'
    );
  }
  return {
    contractVersion: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CONTRACT_V1,
    schemaVersion: 1,
    owner: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_OWNER,
    kind: TRADEMARK_LIFECYCLE_RULE_PACK_REVIEW_CURRENTNESS_KIND,
    receiptReference: parseReceiptReference(
      observation.receiptReference,
      'rulePackReviewCurrentness.receiptReference'
    ),
    asOf: timestamp(observation.asOf, 'rulePackReviewCurrentness.asOf'),
    result: parseCurrentnessResult(observation.result),
    authority: parseAuthority(observation.authority, 'rulePackReviewCurrentness.authority')
  };
}

export function trademarkLifecycleRulePackReviewCurrentnessFingerprintSha256V1(
  value:
    | Readonly<TrademarkLifecycleRulePackReviewCurrentnessFingerprintMaterialV1>
    | Readonly<TrademarkLifecycleRulePackReviewCurrentnessV1>
): string {
  const observation = object(value, 'rulePackReviewCurrentness');
  return fingerprint(
    normalizeCurrentnessMaterial(
      observation.observationFingerprintSha256 === undefined
        ? observation
        : materialWithoutIdentity(observation, 'observationId', 'observationFingerprintSha256')
    )
  );
}

export function trademarkLifecycleRulePackReviewCurrentnessIdV1(
  fingerprintSha256: string
): TrademarkLifecycleRulePackReviewCurrentnessIdV1 {
  return `${CURRENTNESS_ID_PREFIX}${sha256(fingerprintSha256, 'observationFingerprintSha256')}`;
}

export function parseTrademarkLifecycleRulePackReviewCurrentnessV1(
  value: unknown
): TrademarkLifecycleRulePackReviewCurrentnessV1 {
  const observation = object(value, 'rulePackReviewCurrentness');
  exactKeys(
    observation,
    [...CURRENTNESS_MATERIAL_KEYS, 'observationId', 'observationFingerprintSha256'],
    'rulePackReviewCurrentness'
  );
  const material = normalizeCurrentnessMaterial(
    materialWithoutIdentity(observation, 'observationId', 'observationFingerprintSha256')
  );
  const observationFingerprintSha256 = fingerprint(material);
  if (
    sha256(
      observation.observationFingerprintSha256,
      'rulePackReviewCurrentness.observationFingerprintSha256'
    ) !== observationFingerprintSha256
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewCurrentness fingerprint does not match its immutable material.'
    );
  }
  const observationId = trademarkLifecycleRulePackReviewCurrentnessIdV1(
    observationFingerprintSha256
  );
  if (observation.observationId !== observationId) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'rulePackReviewCurrentness.observationId must be derived from its exact fingerprint.'
    );
  }
  return { ...material, observationId, observationFingerprintSha256 };
}

export function validateTrademarkLifecycleRulePackReviewCurrentnessV1(
  receiptValue: unknown,
  currentnessValue: unknown,
  relations: Readonly<TrademarkLifecycleRulePackReviewCurrentnessRelationsV1> = {}
): TrademarkLifecycleRulePackReviewCurrentnessV1 {
  const receipt = parseTrademarkLifecycleRulePackReviewReceiptV1(receiptValue);
  const currentness = parseTrademarkLifecycleRulePackReviewCurrentnessV1(currentnessValue);
  const receiptReference = trademarkLifecycleRulePackReviewReceiptReferenceV1(receipt);
  if (!same(currentness.receiptReference, receiptReference)) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'Currentness does not target the supplied Rule Pack review receipt.'
    );
  }
  if (compareTimestamps(currentness.asOf, receipt.reviewedAt) < 0) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'Currentness asOf cannot precede receipt reviewedAt.'
    );
  }
  const result = currentness.result;
  const hasSuccessorRelation = relations.successorReceipt !== undefined;
  const hasRevocationRelation = relations.revocation !== undefined;
  if (
    (result.status === 'SUPERSEDED' ? !hasSuccessorRelation : hasSuccessorRelation) ||
    (result.status === 'REVOKED' ? !hasRevocationRelation : hasRevocationRelation)
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'Currentness relations must match the exact result branch without positive substitutes.'
    );
  }
  if (result.status === 'CURRENT') {
    if (
      !same(result.headReceiptReference, receiptReference) ||
      !same(result.reviewerAuthorityReference, receipt.reviewer.authorityReference) ||
      result.reviewedScopeFingerprintSha256 !== receipt.reviewedScopeFingerprintSha256 ||
      (receipt.expiresAt !== null && compareTimestamps(currentness.asOf, receipt.expiresAt) >= 0)
    ) {
      throw new TrademarkLifecycleRulePackReviewContractError(
        'CURRENT must match the exact head, Core authority, reviewed scope and expiry.'
      );
    }
  }
  if (
    result.status === 'EXPIRED' &&
    (receipt.expiresAt === null || compareTimestamps(currentness.asOf, receipt.expiresAt) < 0)
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'EXPIRED requires an explicit receipt expiry reached at asOf.'
    );
  }
  if (
    result.status === 'REVIEWER_AUTHORITY_NOT_CURRENT' &&
    !same(result.reviewerAuthorityReference, receipt.reviewer.authorityReference)
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'Authority invalidation must identify the exact reviewed Core authority.'
    );
  }
  if (
    result.status === 'REVIEWED_SCOPE_CHANGED' &&
    result.observedScopeFingerprintSha256 === receipt.reviewedScopeFingerprintSha256
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'Scope change requires a different observed scope fingerprint.'
    );
  }
  if (result.status === 'SUPERSEDED') {
    const successor = parseTrademarkLifecycleRulePackReviewReceiptV1(relations.successorReceipt);
    const successorReference = trademarkLifecycleRulePackReviewReceiptReferenceV1(successor);
    if (
      !same(result.successorReceiptReference, successorReference) ||
      !same(successor.supersedesReceiptReference, receiptReference) ||
      compareTimestamps(successor.reviewedAt, receipt.reviewedAt) <= 0 ||
      compareTimestamps(successor.reviewedAt, currentness.asOf) > 0
    ) {
      throw new TrademarkLifecycleRulePackReviewContractError(
        'SUPERSEDED requires the exact later successor and unchanged lineage at asOf.'
      );
    }
  }
  if (result.status === 'REVOKED') {
    const revocation = parseTrademarkLifecycleRulePackReviewRevocationV1(relations.revocation);
    const revocationReference = trademarkLifecycleRulePackReviewRevocationReferenceV1(revocation);
    if (
      !same(result.revocationReference, revocationReference) ||
      !same(revocation.targetReceiptReference, receiptReference) ||
      compareTimestamps(revocation.revokedAt, receipt.reviewedAt) < 0 ||
      compareTimestamps(revocation.revokedAt, currentness.asOf) > 0
    ) {
      throw new TrademarkLifecycleRulePackReviewContractError(
        'REVOKED requires the exact target revocation effective by asOf.'
      );
    }
  }
  return currentness;
}

export function validateTrademarkLifecycleRulePackReviewCurrentAtV1(
  receiptValue: unknown,
  currentnessValue: unknown,
  evaluationAt: string
): TrademarkLifecycleRulePackReviewReceiptV1 {
  const exactEvaluationAt = timestamp(evaluationAt, 'evaluationAt');
  const receipt = parseTrademarkLifecycleRulePackReviewReceiptV1(receiptValue);
  const currentness = validateTrademarkLifecycleRulePackReviewCurrentnessV1(
    receipt,
    currentnessValue
  );
  if (
    currentness.asOf !== exactEvaluationAt ||
    currentness.result.status !== 'CURRENT' ||
    receipt.outcome !== 'ACCEPTABLE_FOR_INDEPENDENT_ADMISSION_REVIEW'
  ) {
    throw new TrademarkLifecycleRulePackReviewContractError(
      'Current validation requires an acceptable receipt and CURRENT observation at the exact evaluation time.'
    );
  }
  return receipt;
}
