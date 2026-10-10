import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER,
  parseDataEngineFactEnvelope,
  type DataEngineFactEnvelope
} from './data-engine.js';
import { factCandidateSha256Utf8HexV1 } from './fact-candidate-v1.js';
import {
  trademarkAssetSourceReadStates,
  type TrademarkAssetSourceReadState
} from './trademark-asset-workspace.js';

export const DATA_ENGINE_DISCOVERY_CONTRACT_VERSION = 'DATA_ENGINE_DISCOVERY_CONTRACT_V1' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID =
  'CN_PRELIMINARY_PUBLICATION_FACT_DISCOVERY_V2' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID =
  'CN_CASE_CURRENT_PRELIMINARY_PUBLICATION_DISCOVERY_V2' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE =
  'CN_TRADEMARK_PRELIMINARY_PUBLICATION' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND =
  'PRELIMINARY_PUBLICATION_FACT_DISCOVERY' as const;
export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_SNAPSHOT_KIND =
  'CN_QUIESCENT_SERVING_EPOCH' as const;

export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS = [
  'case_id',
  'application_number',
  'mark_name_raw',
  'classes',
  'filing_date',
  'prelim_pub_date',
  'prelim_pub_issue',
  'source_effective_date',
  'source_package_id',
  'source_row_hash',
  'record_hash',
  'source_rank'
] as const;

export const CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING = [
  'application_number ASC',
  'toString(case_id) ASC'
] as const;

export interface CnPreliminaryPublicationDiscoveryRequestV2 {
  applicationNumberStart: string;
  applicationNumberEnd: string;
  pageSize?: number;
  cursor?: string;
}

export interface CnPreliminaryPublicationDiscoveryCandidateV2 {
  candidate_type: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE;
  case_id: string;
  application_number: string;
  mark_name_raw: string;
  classes: number[];
  filing_date: string | null;
  prelim_pub_date: string;
  prelim_pub_issue: string;
  source_effective_date: string | null;
  source_package_id: string;
  source_row_hash: string;
  record_hash: string;
  source_rank: number;
}

export interface CnPreliminaryPublicationDiscoveryQueryV2 {
  contract_version: typeof DATA_ENGINE_DISCOVERY_CONTRACT_VERSION;
  stream_id: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID;
  source_schema_id: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID;
  candidate_type: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE;
  projection_fields: string[];
  scope: {
    jurisdiction: 'CN';
    application_number: {
      start_inclusive: string;
      end_exclusive: string;
    };
    is_deleted: 0;
    prelim_pub_date_not_null: true;
    ordering: string[];
    ranking: 'NONE';
    joins: 'NONE';
    read_budget: {
      max_rows_to_read: 250000;
      max_bytes_to_read: 268435456;
      overflow_mode: 'throw';
    };
  };
  limits: {
    page_size: number;
    max_pages: 10;
    max_results: 1000;
  };
  query_hash: string;
}

export interface CnPreliminaryPublicationDiscoverySnapshotV2 {
  snapshot_id: string;
  snapshot_kind: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_SNAPSHOT_KIND;
  watermark: string;
  source_version: string;
}

export interface CnPreliminaryPublicationDiscoveryProvenanceV2 {
  contract_version: typeof DATA_ENGINE_DISCOVERY_CONTRACT_VERSION;
  query_hash: string;
  stream_id: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID;
  candidate_type: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE;
  source_schema_id: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID;
  projection_fields: string[];
  scope: CnPreliminaryPublicationDiscoveryQueryV2['scope'];
  limits: CnPreliminaryPublicationDiscoveryQueryV2['limits'];
  snapshot: CnPreliminaryPublicationDiscoverySnapshotV2;
  engine_version: string;
  page_number: number;
  result_count: number;
  emitted_count: number;
  has_more: boolean;
}

export interface CnPreliminaryPublicationDiscoveryPageV2 {
  stream_id: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID;
  candidate_type: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE;
  query: CnPreliminaryPublicationDiscoveryQueryV2;
  snapshot: CnPreliminaryPublicationDiscoverySnapshotV2;
  results: CnPreliminaryPublicationDiscoveryCandidateV2[];
  next_cursor: string | null;
  provenance: CnPreliminaryPublicationDiscoveryProvenanceV2;
  bounded_truncation: boolean;
  read_budget: {
    max_rows_to_read: 250000;
    max_bytes_to_read: 268435456;
    read_overflow_mode: 'throw';
  };
}

export type CnPreliminaryPublicationDiscoveryEnvelopeV2 =
  DataEngineFactEnvelope<CnPreliminaryPublicationDiscoveryPageV2>;

export const CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION =
  'CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_V3' as const;
export const CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND =
  'CN_PRELIMINARY_PUBLICATION_EXACT_SCOPE_SOURCE_READ_RECEIPT' as const;
export const CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC =
  'NO_SOURCE_OBSERVATION_WITHIN_VERIFIED_COVERAGE_NOT_LEGAL_NONEXISTENCE' as const;
export const CN_PRELIMINARY_PUBLICATION_DATA_TRUST_VERSION =
  'MARKORBIT_DATA_TRUST_FRESHNESS_V1' as const;
export const CN_PRELIMINARY_PUBLICATION_SOURCE_READ_DOMAIN = 'CN_PRELIMINARY_PUBLICATION' as const;

export const cnPreliminaryPublicationSourceReadStatesV3 = trademarkAssetSourceReadStates;
export type CnPreliminaryPublicationSourceReadStateV3 = TrademarkAssetSourceReadState;

export const cnPreliminaryPublicationSourceReadReasonCodesV3 = [
  'NO_OBSERVATION_WITHOUT_TRUSTED_SILENCE',
  'EXACT_SCOPE_NOT_COVERED',
  'SOURCE_READ_UNAVAILABLE',
  'SOURCE_READ_TIMEOUT',
  'SOURCE_READ_RATE_LIMITED'
] as const;
export type CnPreliminaryPublicationSourceReadReasonCodeV3 =
  (typeof cnPreliminaryPublicationSourceReadReasonCodesV3)[number];

export const cnPreliminaryPublicationDataTrustReasonCodesV3 = [
  'QUERY_PLANE_NOT_READY',
  'SOURCE_IDENTITY_INCOMPLETE',
  'REGISTERED_CORPUS_INCOMPLETE',
  'SOURCE_VERIFICATION_NOT_PASSED',
  'COVERAGE_THROUGH_UNKNOWN',
  'REQUIRED_COVERAGE_THROUGH_UNKNOWN',
  'SOURCE_COVERAGE_STALE',
  'DOMAIN_NOT_ACCEPTED',
  'SOURCE_DOES_NOT_SUPPORT_SILENCE_INFERENCE'
] as const;
export type CnPreliminaryPublicationDataTrustReasonCodeV3 =
  (typeof cnPreliminaryPublicationDataTrustReasonCodesV3)[number];

export type CnPreliminaryPublicationSourceReadNormalizedQueryV3 = Omit<
  CnPreliminaryPublicationDiscoveryQueryV2,
  'query_hash'
>;

export interface CnPreliminaryPublicationOwnerEvidenceReferenceV3 {
  source_owner: typeof DATA_ENGINE_SOURCE_OWNER;
  evidence_kind: string;
  evidence_id: string;
  evidence_version: string;
  evidence_fingerprint_sha256: string;
  snapshot_id: string | null;
  source_corpus_fingerprint_sha256: string | null;
}

export interface CnPreliminaryPublicationDataTrustDimensionEvidenceV3 {
  value: boolean;
  evidence_reference: CnPreliminaryPublicationOwnerEvidenceReferenceV3;
}

export interface CnPreliminaryPublicationDataTrustV3 {
  trust_version: typeof CN_PRELIMINARY_PUBLICATION_DATA_TRUST_VERSION;
  domain: typeof CN_PRELIMINARY_PUBLICATION_SOURCE_READ_DOMAIN;
  snapshot_id: string | null;
  source_corpus_fingerprint_sha256: string | null;
  queryable: CnPreliminaryPublicationDataTrustDimensionEvidenceV3;
  complete: CnPreliminaryPublicationDataTrustDimensionEvidenceV3;
  fresh: CnPreliminaryPublicationDataTrustDimensionEvidenceV3;
  /** Data Engine domain/corpus acceptance only. This is never source-use admission. */
  accepted: CnPreliminaryPublicationDataTrustDimensionEvidenceV3;
  trusted_for_silence: CnPreliminaryPublicationDataTrustDimensionEvidenceV3;
  evaluated_at: string;
  coverage_through: string | null;
  required_coverage_through: string | null;
  acceptance_status:
    'PASS' | 'PASS_WITH_WARNINGS' | 'ACCEPTED' | 'NOT_EVALUATED' | 'FAIL' | 'REJECTED';
  source_supports_silence: boolean;
  reason_codes: CnPreliminaryPublicationDataTrustReasonCodeV3[];
  silence_semantics: typeof CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC;
  legal_conclusion: false;
}

export interface CnPreliminaryPublicationSourceReadSnapshotV3 {
  snapshot_id: string;
  snapshot_kind: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_SNAPSHOT_KIND;
  watermark: string;
  source_version: string;
}

export interface CnPreliminaryPublicationProducerImplementationV3 {
  package_id: string;
  package_version: string;
  package_fingerprint_sha256: string;
  build_id: string;
}

export interface CnPreliminaryPublicationSourceCorpusV3 {
  package_id: string;
  package_version: string;
  package_fingerprint_sha256: string;
  snapshot_id: string | null;
  registration_evidence_reference: CnPreliminaryPublicationOwnerEvidenceReferenceV3;
}

export interface CnPreliminaryPublicationCoverageEvidenceV3 {
  decision: 'COVERED' | 'NOT_COVERED' | 'UNKNOWN';
  scope_query_fingerprint_sha256: string;
  snapshot_id: string | null;
  source_corpus_fingerprint_sha256: string | null;
  evaluated_at: string;
  coverage_through: string | null;
  required_coverage_through: string | null;
  evidence_reference: CnPreliminaryPublicationOwnerEvidenceReferenceV3;
}

export interface CnPreliminaryPublicationScanPageV3 {
  page_number: number;
  request_cursor_fingerprint_sha256: string | null;
  response_cursor_fingerprint_sha256: string | null;
  result_count: number;
  cumulative_result_count: number;
  page_fingerprint_sha256: string;
  snapshot_id: string;
}

export interface CnPreliminaryPublicationScanV3 {
  page_count: number;
  continuation_chain: CnPreliminaryPublicationScanPageV3[];
  final_cursor_fingerprint_sha256: string | null;
  exact_scope_complete: boolean;
  bounded_truncation: boolean;
  read_budget_overflowed: boolean;
}

export interface CnPreliminaryPublicationResultReferenceV3 {
  source_owner: typeof DATA_ENGINE_SOURCE_OWNER;
  candidate_type: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE;
  case_id: string;
  application_number: string;
  source_package_id: string;
  source_row_fingerprint_sha256: string;
  record_fingerprint_sha256: string;
  observed_at: string;
}

export interface CnPreliminaryPublicationResultSetV3 {
  result_count: number;
  result_references: CnPreliminaryPublicationResultReferenceV3[];
  result_fingerprint_sha256: string;
  source_corpus_fingerprint_sha256: string | null;
}

export interface CnPreliminaryPublicationSourceReadAuthorityV3 {
  rulePackAdmitted: false;
  sourceUsePromoted: false;
  methodActivated: false;
  capabilityVerified: false;
  projectionPersistenceAuthorized: false;
  productBusinessStateCreated: false;
  officialTruthCreated: false;
  legalDeadlineCertified: false;
  executionAuthorized: false;
  lifecyclePositionInferred: false;
  recommendationAuthorized: false;
}

export interface CnPreliminaryPublicationSourceReadReceiptV3 {
  contract_version: typeof CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION;
  receipt_kind: typeof CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND;
  receipt_id: string;
  source_owner: typeof DATA_ENGINE_SOURCE_OWNER;
  authority: typeof DATA_ENGINE_FACT_AUTHORITY;
  jurisdiction: 'CN';
  resource_kind: typeof CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND;
  state: CnPreliminaryPublicationSourceReadStateV3;
  scope_id: string;
  issued_at: string;
  read_started_at: string;
  read_ended_at: string;
  read_completed_at: string | null;
  query: CnPreliminaryPublicationSourceReadNormalizedQueryV3;
  query_fingerprint_sha256: string;
  snapshot: CnPreliminaryPublicationSourceReadSnapshotV3 | null;
  producer_implementation: CnPreliminaryPublicationProducerImplementationV3;
  source_corpus: CnPreliminaryPublicationSourceCorpusV3 | null;
  coverage_evidence: CnPreliminaryPublicationCoverageEvidenceV3 | null;
  data_trust: CnPreliminaryPublicationDataTrustV3 | null;
  scan: CnPreliminaryPublicationScanV3 | null;
  result_set: CnPreliminaryPublicationResultSetV3;
  reason_codes: CnPreliminaryPublicationSourceReadReasonCodeV3[];
  retryable: boolean | null;
  silence_semantics: typeof CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC | null;
  legal_conclusion: false;
  authority_consequences: CnPreliminaryPublicationSourceReadAuthorityV3;
  receipt_fingerprint_sha256: string;
}

export interface CnPreliminaryPublicationSourceReadReceiptReferenceV3 {
  contract_version: typeof CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION;
  receipt_kind: typeof CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND;
  receipt_id: string;
  source_owner: typeof DATA_ENGINE_SOURCE_OWNER;
  state: CnPreliminaryPublicationSourceReadStateV3;
  scope_id: string;
  query_fingerprint_sha256: string;
  snapshot_id: string | null;
  source_version: string | null;
  issued_at: string;
  receipt_fingerprint_sha256: string;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
}

function exactStrings(value: unknown, expected: readonly string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function nonEmptyText(value: unknown, maxLength = 8192): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isoDateOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function queryHash(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseCandidate(
  value: unknown,
  startInclusive: string,
  endExclusive: string
): CnPreliminaryPublicationDiscoveryCandidateV2 | null {
  const candidate = record(value);
  if (
    !candidate ||
    !exactKeys(candidate, [
      'candidate_type',
      'case_id',
      'application_number',
      'mark_name_raw',
      'classes',
      'filing_date',
      'prelim_pub_date',
      'prelim_pub_issue',
      'source_effective_date',
      'source_package_id',
      'source_row_hash',
      'record_hash',
      'source_rank'
    ]) ||
    candidate.candidate_type !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE ||
    !nonEmptyText(candidate.case_id, 512) ||
    !nonEmptyText(candidate.application_number, 128) ||
    candidate.application_number < startInclusive ||
    candidate.application_number >= endExclusive ||
    typeof candidate.mark_name_raw !== 'string' ||
    !Array.isArray(candidate.classes) ||
    !candidate.classes.every(
      (item) => Number.isInteger(item) && (item as number) >= 1 && (item as number) <= 45
    ) ||
    !isoDateOrNull(candidate.filing_date) ||
    !isoDateOrNull(candidate.prelim_pub_date) ||
    candidate.prelim_pub_date === null ||
    typeof candidate.prelim_pub_issue !== 'string' ||
    !isoDateOrNull(candidate.source_effective_date) ||
    !nonEmptyText(candidate.source_package_id, 512) ||
    !nonEmptyText(candidate.source_row_hash, 512) ||
    !nonEmptyText(candidate.record_hash, 512) ||
    !Number.isSafeInteger(candidate.source_rank) ||
    (candidate.source_rank as number) < 0
  ) {
    return null;
  }
  return candidate as unknown as CnPreliminaryPublicationDiscoveryCandidateV2;
}

export function normalizeCnPreliminaryPublicationDiscoveryRequestV2(
  value: Readonly<CnPreliminaryPublicationDiscoveryRequestV2>
): Required<Omit<CnPreliminaryPublicationDiscoveryRequestV2, 'cursor'>> & { cursor?: string } {
  const applicationNumberStart = value.applicationNumberStart?.trim();
  const applicationNumberEnd = value.applicationNumberEnd?.trim();
  const pageSize = value.pageSize ?? 50;
  if (
    !applicationNumberStart ||
    !applicationNumberEnd ||
    applicationNumberStart >= applicationNumberEnd
  ) {
    throw new TypeError(
      'CN preliminary-publication Discovery requires a non-empty lexical application-number range.'
    );
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new TypeError(
      'CN preliminary-publication Discovery pageSize must be an integer from 1 to 100.'
    );
  }
  if (value.cursor !== undefined && !nonEmptyText(value.cursor, 8192)) {
    throw new TypeError(
      'CN preliminary-publication Discovery cursor must be an opaque non-empty string no longer than 8192 characters.'
    );
  }
  return {
    applicationNumberStart,
    applicationNumberEnd,
    pageSize,
    ...(value.cursor === undefined ? {} : { cursor: value.cursor })
  };
}

export function parseCnPreliminaryPublicationDiscoveryPageV2(
  value: unknown
): CnPreliminaryPublicationDiscoveryPageV2 | null {
  const page = record(value);
  const query = record(page?.query);
  const scope = record(query?.scope);
  const applicationNumber = record(scope?.application_number);
  const scopeReadBudget = record(scope?.read_budget);
  const limits = record(query?.limits);
  const snapshot = record(page?.snapshot);
  const provenance = record(page?.provenance);
  const provenanceSnapshot = record(provenance?.snapshot);
  const readBudget = record(page?.read_budget);
  if (
    !page ||
    !query ||
    !scope ||
    !applicationNumber ||
    !scopeReadBudget ||
    !limits ||
    !snapshot ||
    !provenance ||
    !provenanceSnapshot ||
    !readBudget
  ) {
    return null;
  }
  if (
    !exactKeys(page, [
      'stream_id',
      'candidate_type',
      'query',
      'snapshot',
      'results',
      'next_cursor',
      'provenance',
      'bounded_truncation',
      'read_budget'
    ]) ||
    page.stream_id !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID ||
    page.candidate_type !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE ||
    query.contract_version !== DATA_ENGINE_DISCOVERY_CONTRACT_VERSION ||
    query.stream_id !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID ||
    query.source_schema_id !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID ||
    query.candidate_type !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE ||
    !exactStrings(
      query.projection_fields,
      CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS
    ) ||
    scope.jurisdiction !== 'CN' ||
    scope.is_deleted !== 0 ||
    scope.prelim_pub_date_not_null !== true ||
    !exactStrings(scope.ordering, CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING) ||
    scope.ranking !== 'NONE' ||
    scope.joins !== 'NONE' ||
    scopeReadBudget.max_rows_to_read !== 250000 ||
    scopeReadBudget.max_bytes_to_read !== 268435456 ||
    scopeReadBudget.overflow_mode !== 'throw' ||
    !nonEmptyText(applicationNumber.start_inclusive, 128) ||
    !nonEmptyText(applicationNumber.end_exclusive, 128) ||
    applicationNumber.start_inclusive >= applicationNumber.end_exclusive ||
    !Number.isSafeInteger(limits.page_size) ||
    (limits.page_size as number) < 1 ||
    (limits.page_size as number) > 100 ||
    limits.max_pages !== 10 ||
    limits.max_results !== 1000 ||
    !queryHash(query.query_hash) ||
    snapshot.snapshot_kind !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_SNAPSHOT_KIND ||
    !nonEmptyText(snapshot.snapshot_id, 2048) ||
    !nonEmptyText(snapshot.watermark, 2048) ||
    !nonEmptyText(snapshot.source_version, 512) ||
    readBudget.max_rows_to_read !== 250000 ||
    readBudget.max_bytes_to_read !== 268435456 ||
    readBudget.read_overflow_mode !== 'throw' ||
    !Array.isArray(page.results) ||
    typeof page.bounded_truncation !== 'boolean' ||
    (page.next_cursor !== null && !nonEmptyText(page.next_cursor, 8192))
  ) {
    return null;
  }

  const candidates = page.results.map((candidate) =>
    parseCandidate(
      candidate,
      applicationNumber.start_inclusive as string,
      applicationNumber.end_exclusive as string
    )
  );
  if (candidates.some((candidate) => candidate === null)) return null;
  for (let index = 1; index < candidates.length; index += 1) {
    const previous = candidates[index - 1]!;
    const current = candidates[index]!;
    if (
      previous.application_number > current.application_number ||
      (previous.application_number === current.application_number &&
        previous.case_id >= current.case_id)
    ) {
      return null;
    }
  }

  if (
    provenance.contract_version !== DATA_ENGINE_DISCOVERY_CONTRACT_VERSION ||
    provenance.query_hash !== query.query_hash ||
    provenance.stream_id !== query.stream_id ||
    provenance.candidate_type !== query.candidate_type ||
    provenance.source_schema_id !== query.source_schema_id ||
    !sameJson(provenance.projection_fields, query.projection_fields) ||
    !sameJson(provenance.scope, query.scope) ||
    !sameJson(provenance.limits, query.limits) ||
    !sameJson(provenanceSnapshot, snapshot) ||
    !nonEmptyText(provenance.engine_version, 512) ||
    !Number.isSafeInteger(provenance.page_number) ||
    (provenance.page_number as number) < 1 ||
    (provenance.page_number as number) > 10 ||
    provenance.result_count !== candidates.length ||
    !Number.isSafeInteger(provenance.emitted_count) ||
    (provenance.emitted_count as number) < candidates.length ||
    (provenance.emitted_count as number) > 1000 ||
    provenance.has_more !== (page.next_cursor !== null) ||
    (page.bounded_truncation === true && page.next_cursor !== null)
  ) {
    return null;
  }

  return page as unknown as CnPreliminaryPublicationDiscoveryPageV2;
}

export function parseCnPreliminaryPublicationDiscoveryEnvelopeV2(
  value: unknown
): CnPreliminaryPublicationDiscoveryEnvelopeV2 | null {
  const envelope = parseDataEngineFactEnvelope(value);
  if (
    !envelope ||
    envelope.contract_version !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION ||
    envelope.source_owner !== DATA_ENGINE_SOURCE_OWNER ||
    envelope.authority !== DATA_ENGINE_FACT_AUTHORITY ||
    envelope.jurisdiction !== 'CN' ||
    envelope.resource_kind !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND ||
    envelope.legal_conclusion !== false ||
    envelope.fact_state !== 'observed'
  ) {
    return null;
  }
  const payload = parseCnPreliminaryPublicationDiscoveryPageV2(envelope.payload);
  if (!payload || payload.provenance.engine_version !== payload.snapshot.source_version) {
    return null;
  }
  return { ...envelope, payload };
}

function compareCodeUnitStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalizeSourceReadValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeSourceReadValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => compareCodeUnitStrings(left, right))
        .map(([key, entry]) => [key, canonicalizeSourceReadValue(entry)])
    );
  }
  return value;
}

function canonicalSourceReadFingerprint(value: unknown): string {
  return `sha256:${factCandidateSha256Utf8HexV1(
    JSON.stringify(canonicalizeSourceReadValue(value))
  )}`;
}

function canonicalText(value: unknown, maxLength = 2048): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    value.trim() === value
  );
}

function canonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function controlledCodes<T extends string>(value: unknown, allowed: readonly T[]): T[] | null {
  if (
    !Array.isArray(value) ||
    !value.every((entry): entry is T => allowed.includes(entry as T)) ||
    new Set(value).size !== value.length
  ) {
    return null;
  }
  return value;
}

function parseOwnerEvidenceReferenceV3(
  value: unknown
): CnPreliminaryPublicationOwnerEvidenceReferenceV3 | null {
  const reference = record(value);
  if (
    !reference ||
    !exactKeys(reference, [
      'source_owner',
      'evidence_kind',
      'evidence_id',
      'evidence_version',
      'evidence_fingerprint_sha256',
      'snapshot_id',
      'source_corpus_fingerprint_sha256'
    ]) ||
    reference.source_owner !== DATA_ENGINE_SOURCE_OWNER ||
    !canonicalText(reference.evidence_kind, 240) ||
    !canonicalText(reference.evidence_id, 512) ||
    !canonicalText(reference.evidence_version, 240) ||
    !queryHash(reference.evidence_fingerprint_sha256) ||
    (reference.snapshot_id !== null && !canonicalText(reference.snapshot_id, 2048)) ||
    (reference.source_corpus_fingerprint_sha256 !== null &&
      !queryHash(reference.source_corpus_fingerprint_sha256))
  ) {
    return null;
  }
  return reference as unknown as CnPreliminaryPublicationOwnerEvidenceReferenceV3;
}

function parseNormalizedSourceReadQueryV3(
  value: unknown
): CnPreliminaryPublicationSourceReadNormalizedQueryV3 | null {
  const query = record(value);
  const scope = record(query?.scope);
  const applicationNumber = record(scope?.application_number);
  const readBudget = record(scope?.read_budget);
  const limits = record(query?.limits);
  if (!query || !scope || !applicationNumber || !readBudget || !limits) return null;
  if (
    !exactKeys(query, [
      'contract_version',
      'stream_id',
      'source_schema_id',
      'candidate_type',
      'projection_fields',
      'scope',
      'limits'
    ]) ||
    !exactKeys(scope, [
      'jurisdiction',
      'application_number',
      'is_deleted',
      'prelim_pub_date_not_null',
      'ordering',
      'ranking',
      'joins',
      'read_budget'
    ]) ||
    !exactKeys(applicationNumber, ['start_inclusive', 'end_exclusive']) ||
    !exactKeys(readBudget, ['max_rows_to_read', 'max_bytes_to_read', 'overflow_mode']) ||
    !exactKeys(limits, ['page_size', 'max_pages', 'max_results']) ||
    query.contract_version !== DATA_ENGINE_DISCOVERY_CONTRACT_VERSION ||
    query.stream_id !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID ||
    query.source_schema_id !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID ||
    query.candidate_type !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE ||
    !exactStrings(
      query.projection_fields,
      CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS
    ) ||
    scope.jurisdiction !== 'CN' ||
    scope.is_deleted !== 0 ||
    scope.prelim_pub_date_not_null !== true ||
    !exactStrings(scope.ordering, CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING) ||
    scope.ranking !== 'NONE' ||
    scope.joins !== 'NONE' ||
    readBudget.max_rows_to_read !== 250000 ||
    readBudget.max_bytes_to_read !== 268435456 ||
    readBudget.overflow_mode !== 'throw' ||
    !canonicalText(applicationNumber.start_inclusive, 128) ||
    !canonicalText(applicationNumber.end_exclusive, 128) ||
    applicationNumber.start_inclusive >= applicationNumber.end_exclusive ||
    !Number.isSafeInteger(limits.page_size) ||
    (limits.page_size as number) < 1 ||
    (limits.page_size as number) > 100 ||
    limits.max_pages !== 10 ||
    limits.max_results !== 1000
  ) {
    return null;
  }
  return query as unknown as CnPreliminaryPublicationSourceReadNormalizedQueryV3;
}

function parseSourceReadSnapshotV3(
  value: unknown
): CnPreliminaryPublicationSourceReadSnapshotV3 | null {
  const snapshot = record(value);
  if (
    !snapshot ||
    !exactKeys(snapshot, ['snapshot_id', 'snapshot_kind', 'watermark', 'source_version']) ||
    !canonicalText(snapshot.snapshot_id, 2048) ||
    snapshot.snapshot_kind !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_SNAPSHOT_KIND ||
    !canonicalText(snapshot.watermark, 2048) ||
    !canonicalText(snapshot.source_version, 512)
  ) {
    return null;
  }
  return snapshot as unknown as CnPreliminaryPublicationSourceReadSnapshotV3;
}

function parseProducerImplementationV3(
  value: unknown
): CnPreliminaryPublicationProducerImplementationV3 | null {
  const producer = record(value);
  if (
    !producer ||
    !exactKeys(producer, [
      'package_id',
      'package_version',
      'package_fingerprint_sha256',
      'build_id'
    ]) ||
    !canonicalText(producer.package_id, 512) ||
    !canonicalText(producer.package_version, 240) ||
    !queryHash(producer.package_fingerprint_sha256) ||
    !canonicalText(producer.build_id, 512)
  ) {
    return null;
  }
  return producer as unknown as CnPreliminaryPublicationProducerImplementationV3;
}

function parseSourceCorpusV3(value: unknown): CnPreliminaryPublicationSourceCorpusV3 | null {
  const corpus = record(value);
  if (
    !corpus ||
    !exactKeys(corpus, [
      'package_id',
      'package_version',
      'package_fingerprint_sha256',
      'snapshot_id',
      'registration_evidence_reference'
    ]) ||
    !canonicalText(corpus.package_id, 512) ||
    !canonicalText(corpus.package_version, 240) ||
    !queryHash(corpus.package_fingerprint_sha256) ||
    (corpus.snapshot_id !== null && !canonicalText(corpus.snapshot_id, 2048))
  ) {
    return null;
  }
  const registrationEvidence = parseOwnerEvidenceReferenceV3(
    corpus.registration_evidence_reference
  );
  if (!registrationEvidence) return null;
  return {
    package_id: corpus.package_id,
    package_version: corpus.package_version,
    package_fingerprint_sha256: corpus.package_fingerprint_sha256,
    snapshot_id: corpus.snapshot_id,
    registration_evidence_reference: registrationEvidence
  };
}

function parseDataTrustDimensionV3(
  value: unknown
): CnPreliminaryPublicationDataTrustDimensionEvidenceV3 | null {
  const dimension = record(value);
  if (
    !dimension ||
    !exactKeys(dimension, ['value', 'evidence_reference']) ||
    typeof dimension.value !== 'boolean'
  ) {
    return null;
  }
  const evidence = parseOwnerEvidenceReferenceV3(dimension.evidence_reference);
  if (!evidence) return null;
  return { value: dimension.value, evidence_reference: evidence };
}

function parseDataTrustV3(value: unknown): CnPreliminaryPublicationDataTrustV3 | null {
  const trust = record(value);
  if (
    !trust ||
    !exactKeys(trust, [
      'trust_version',
      'domain',
      'snapshot_id',
      'source_corpus_fingerprint_sha256',
      'queryable',
      'complete',
      'fresh',
      'accepted',
      'trusted_for_silence',
      'evaluated_at',
      'coverage_through',
      'required_coverage_through',
      'acceptance_status',
      'source_supports_silence',
      'reason_codes',
      'silence_semantics',
      'legal_conclusion'
    ]) ||
    trust.trust_version !== CN_PRELIMINARY_PUBLICATION_DATA_TRUST_VERSION ||
    trust.domain !== CN_PRELIMINARY_PUBLICATION_SOURCE_READ_DOMAIN ||
    (trust.snapshot_id !== null && !canonicalText(trust.snapshot_id, 2048)) ||
    (trust.source_corpus_fingerprint_sha256 !== null &&
      !queryHash(trust.source_corpus_fingerprint_sha256)) ||
    !canonicalUtcTimestamp(trust.evaluated_at) ||
    (trust.coverage_through !== null && !canonicalUtcTimestamp(trust.coverage_through)) ||
    (trust.required_coverage_through !== null &&
      !canonicalUtcTimestamp(trust.required_coverage_through)) ||
    !['PASS', 'PASS_WITH_WARNINGS', 'ACCEPTED', 'NOT_EVALUATED', 'FAIL', 'REJECTED'].includes(
      trust.acceptance_status as string
    ) ||
    typeof trust.source_supports_silence !== 'boolean' ||
    trust.silence_semantics !== CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC ||
    trust.legal_conclusion !== false
  ) {
    return null;
  }
  const queryable = parseDataTrustDimensionV3(trust.queryable);
  const complete = parseDataTrustDimensionV3(trust.complete);
  const fresh = parseDataTrustDimensionV3(trust.fresh);
  const accepted = parseDataTrustDimensionV3(trust.accepted);
  const trustedForSilence = parseDataTrustDimensionV3(trust.trusted_for_silence);
  const reasonCodes = controlledCodes(
    trust.reason_codes,
    cnPreliminaryPublicationDataTrustReasonCodesV3
  );
  if (!queryable || !complete || !fresh || !accepted || !trustedForSilence || !reasonCodes) {
    return null;
  }
  const expectedFresh =
    trust.coverage_through !== null &&
    trust.required_coverage_through !== null &&
    trust.coverage_through >= trust.required_coverage_through;
  const expectedAccepted = ['PASS', 'PASS_WITH_WARNINGS', 'ACCEPTED'].includes(
    trust.acceptance_status as string
  );
  const expectedTrustedForSilence =
    queryable.value &&
    complete.value &&
    fresh.value &&
    accepted.value &&
    trust.source_supports_silence === true;
  const completenessReasons = [
    'SOURCE_IDENTITY_INCOMPLETE',
    'REGISTERED_CORPUS_INCOMPLETE',
    'SOURCE_VERIFICATION_NOT_PASSED'
  ] as const;
  const hasReason = (reason: CnPreliminaryPublicationDataTrustReasonCodeV3) =>
    reasonCodes.includes(reason);
  if (
    fresh.value !== expectedFresh ||
    accepted.value !== expectedAccepted ||
    trustedForSilence.value !== expectedTrustedForSilence ||
    hasReason('QUERY_PLANE_NOT_READY') !== !queryable.value ||
    (complete.value ? completenessReasons.some(hasReason) : !completenessReasons.some(hasReason)) ||
    hasReason('COVERAGE_THROUGH_UNKNOWN') !== (trust.coverage_through === null) ||
    hasReason('REQUIRED_COVERAGE_THROUGH_UNKNOWN') !== (trust.required_coverage_through === null) ||
    hasReason('SOURCE_COVERAGE_STALE') !==
      (trust.coverage_through !== null &&
        trust.required_coverage_through !== null &&
        trust.coverage_through < trust.required_coverage_through) ||
    hasReason('DOMAIN_NOT_ACCEPTED') !== !accepted.value ||
    hasReason('SOURCE_DOES_NOT_SUPPORT_SILENCE_INFERENCE') !== !trust.source_supports_silence ||
    (trust.coverage_through !== null && trust.coverage_through > trust.evaluated_at) ||
    (trust.required_coverage_through !== null &&
      trust.required_coverage_through > trust.evaluated_at) ||
    (trustedForSilence.value ? reasonCodes.length !== 0 : reasonCodes.length === 0)
  ) {
    return null;
  }
  return {
    trust_version: CN_PRELIMINARY_PUBLICATION_DATA_TRUST_VERSION,
    domain: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_DOMAIN,
    snapshot_id: trust.snapshot_id,
    source_corpus_fingerprint_sha256: trust.source_corpus_fingerprint_sha256,
    queryable,
    complete,
    fresh,
    accepted,
    trusted_for_silence: trustedForSilence,
    evaluated_at: trust.evaluated_at,
    coverage_through: trust.coverage_through,
    required_coverage_through: trust.required_coverage_through,
    acceptance_status:
      trust.acceptance_status as CnPreliminaryPublicationDataTrustV3['acceptance_status'],
    source_supports_silence: trust.source_supports_silence,
    reason_codes: reasonCodes,
    silence_semantics: CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC,
    legal_conclusion: false
  };
}

function parseCoverageEvidenceV3(
  value: unknown,
  queryFingerprint: string,
  dataTrust: Readonly<CnPreliminaryPublicationDataTrustV3> | null
): CnPreliminaryPublicationCoverageEvidenceV3 | null {
  const coverage = record(value);
  if (
    !coverage ||
    !exactKeys(coverage, [
      'decision',
      'scope_query_fingerprint_sha256',
      'snapshot_id',
      'source_corpus_fingerprint_sha256',
      'evaluated_at',
      'coverage_through',
      'required_coverage_through',
      'evidence_reference'
    ]) ||
    !['COVERED', 'NOT_COVERED', 'UNKNOWN'].includes(coverage.decision as string) ||
    coverage.scope_query_fingerprint_sha256 !== queryFingerprint ||
    (coverage.snapshot_id !== null && !canonicalText(coverage.snapshot_id, 2048)) ||
    (coverage.source_corpus_fingerprint_sha256 !== null &&
      !queryHash(coverage.source_corpus_fingerprint_sha256)) ||
    !canonicalUtcTimestamp(coverage.evaluated_at) ||
    (coverage.coverage_through !== null && !canonicalUtcTimestamp(coverage.coverage_through)) ||
    (coverage.required_coverage_through !== null &&
      !canonicalUtcTimestamp(coverage.required_coverage_through)) ||
    (coverage.coverage_through !== null && coverage.coverage_through > coverage.evaluated_at) ||
    (coverage.required_coverage_through !== null &&
      coverage.required_coverage_through > coverage.evaluated_at) ||
    (dataTrust !== null &&
      (coverage.evaluated_at !== dataTrust.evaluated_at ||
        coverage.coverage_through !== dataTrust.coverage_through ||
        coverage.required_coverage_through !== dataTrust.required_coverage_through))
  ) {
    return null;
  }
  const evidence = parseOwnerEvidenceReferenceV3(coverage.evidence_reference);
  if (!evidence) return null;
  return {
    decision: coverage.decision as CnPreliminaryPublicationCoverageEvidenceV3['decision'],
    scope_query_fingerprint_sha256: queryFingerprint,
    snapshot_id: coverage.snapshot_id,
    source_corpus_fingerprint_sha256: coverage.source_corpus_fingerprint_sha256,
    evaluated_at: coverage.evaluated_at,
    coverage_through: coverage.coverage_through,
    required_coverage_through: coverage.required_coverage_through,
    evidence_reference: evidence
  };
}

function parseScanV3(
  value: unknown,
  query: Readonly<CnPreliminaryPublicationSourceReadNormalizedQueryV3>,
  snapshotId: string
): { scan: CnPreliminaryPublicationScanV3; resultCount: number } | null {
  const scan = record(value);
  if (
    !scan ||
    !exactKeys(scan, [
      'page_count',
      'continuation_chain',
      'final_cursor_fingerprint_sha256',
      'exact_scope_complete',
      'bounded_truncation',
      'read_budget_overflowed'
    ]) ||
    !nonNegativeSafeInteger(scan.page_count) ||
    !Array.isArray(scan.continuation_chain) ||
    scan.page_count !== scan.continuation_chain.length ||
    scan.page_count > query.limits.max_pages ||
    (scan.final_cursor_fingerprint_sha256 !== null &&
      !queryHash(scan.final_cursor_fingerprint_sha256)) ||
    typeof scan.exact_scope_complete !== 'boolean' ||
    typeof scan.bounded_truncation !== 'boolean' ||
    typeof scan.read_budget_overflowed !== 'boolean'
  ) {
    return null;
  }

  const chain: CnPreliminaryPublicationScanPageV3[] = [];
  let resultCount = 0;
  let precedingCursor: string | null = null;
  const requestedCursors = new Set<string>();
  const emittedCursors = new Set<string>();
  const pageFingerprints = new Set<string>();
  for (let index = 0; index < scan.continuation_chain.length; index += 1) {
    const page = record(scan.continuation_chain[index]);
    if (
      !page ||
      !exactKeys(page, [
        'page_number',
        'request_cursor_fingerprint_sha256',
        'response_cursor_fingerprint_sha256',
        'result_count',
        'cumulative_result_count',
        'page_fingerprint_sha256',
        'snapshot_id'
      ]) ||
      page.page_number !== index + 1 ||
      page.request_cursor_fingerprint_sha256 !== precedingCursor ||
      (page.request_cursor_fingerprint_sha256 !== null &&
        !queryHash(page.request_cursor_fingerprint_sha256)) ||
      (page.response_cursor_fingerprint_sha256 !== null &&
        !queryHash(page.response_cursor_fingerprint_sha256)) ||
      !nonNegativeSafeInteger(page.result_count) ||
      page.result_count > query.limits.page_size ||
      !nonNegativeSafeInteger(page.cumulative_result_count) ||
      !queryHash(page.page_fingerprint_sha256) ||
      page.snapshot_id !== snapshotId
    ) {
      return null;
    }
    if (
      (page.request_cursor_fingerprint_sha256 !== null &&
        requestedCursors.has(page.request_cursor_fingerprint_sha256)) ||
      (page.response_cursor_fingerprint_sha256 !== null &&
        emittedCursors.has(page.response_cursor_fingerprint_sha256)) ||
      pageFingerprints.has(page.page_fingerprint_sha256)
    ) {
      return null;
    }
    if (page.request_cursor_fingerprint_sha256 !== null) {
      requestedCursors.add(page.request_cursor_fingerprint_sha256);
    }
    if (page.response_cursor_fingerprint_sha256 !== null) {
      emittedCursors.add(page.response_cursor_fingerprint_sha256);
    }
    pageFingerprints.add(page.page_fingerprint_sha256);
    resultCount += page.result_count;
    if (page.cumulative_result_count !== resultCount) return null;
    precedingCursor = page.response_cursor_fingerprint_sha256;
    chain.push(page as unknown as CnPreliminaryPublicationScanPageV3);
  }

  if (
    precedingCursor !== scan.final_cursor_fingerprint_sha256 ||
    resultCount > query.limits.max_results ||
    (scan.exact_scope_complete === true &&
      (scan.page_count === 0 ||
        scan.final_cursor_fingerprint_sha256 !== null ||
        scan.bounded_truncation === true ||
        scan.read_budget_overflowed === true))
  ) {
    return null;
  }

  return {
    scan: {
      page_count: scan.page_count,
      continuation_chain: chain,
      final_cursor_fingerprint_sha256: scan.final_cursor_fingerprint_sha256,
      exact_scope_complete: scan.exact_scope_complete,
      bounded_truncation: scan.bounded_truncation,
      read_budget_overflowed: scan.read_budget_overflowed
    },
    resultCount
  };
}

function parseResultSetV3(
  value: unknown,
  query: Readonly<CnPreliminaryPublicationSourceReadNormalizedQueryV3>,
  readCompletedAt: string
): CnPreliminaryPublicationResultSetV3 | null {
  const resultSet = record(value);
  if (
    !resultSet ||
    !exactKeys(resultSet, [
      'result_count',
      'result_references',
      'result_fingerprint_sha256',
      'source_corpus_fingerprint_sha256'
    ]) ||
    !nonNegativeSafeInteger(resultSet.result_count) ||
    !Array.isArray(resultSet.result_references) ||
    resultSet.result_count !== resultSet.result_references.length ||
    resultSet.result_count > query.limits.max_results ||
    !queryHash(resultSet.result_fingerprint_sha256) ||
    (resultSet.source_corpus_fingerprint_sha256 !== null &&
      !queryHash(resultSet.source_corpus_fingerprint_sha256))
  ) {
    return null;
  }
  const references: CnPreliminaryPublicationResultReferenceV3[] = [];
  for (const valueReference of resultSet.result_references) {
    const reference = record(valueReference);
    if (
      !reference ||
      !exactKeys(reference, [
        'source_owner',
        'candidate_type',
        'case_id',
        'application_number',
        'source_package_id',
        'source_row_fingerprint_sha256',
        'record_fingerprint_sha256',
        'observed_at'
      ]) ||
      reference.source_owner !== DATA_ENGINE_SOURCE_OWNER ||
      reference.candidate_type !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE ||
      !canonicalText(reference.case_id, 512) ||
      !canonicalText(reference.application_number, 128) ||
      reference.application_number < query.scope.application_number.start_inclusive ||
      reference.application_number >= query.scope.application_number.end_exclusive ||
      !canonicalText(reference.source_package_id, 512) ||
      !queryHash(reference.source_row_fingerprint_sha256) ||
      !queryHash(reference.record_fingerprint_sha256) ||
      !canonicalUtcTimestamp(reference.observed_at) ||
      reference.observed_at > readCompletedAt
    ) {
      return null;
    }
    references.push(reference as unknown as CnPreliminaryPublicationResultReferenceV3);
  }
  for (let index = 1; index < references.length; index += 1) {
    const previous = references[index - 1]!;
    const current = references[index]!;
    if (
      previous.application_number > current.application_number ||
      (previous.application_number === current.application_number &&
        previous.case_id >= current.case_id)
    ) {
      return null;
    }
  }
  if (resultSet.result_fingerprint_sha256 !== canonicalSourceReadFingerprint(references)) {
    return null;
  }
  return {
    result_count: resultSet.result_count,
    result_references: references,
    result_fingerprint_sha256: resultSet.result_fingerprint_sha256,
    source_corpus_fingerprint_sha256: resultSet.source_corpus_fingerprint_sha256
  };
}

function parseSourceReadAuthorityV3(
  value: unknown
): CnPreliminaryPublicationSourceReadAuthorityV3 | null {
  const authority = record(value);
  const keys = [
    'rulePackAdmitted',
    'sourceUsePromoted',
    'methodActivated',
    'capabilityVerified',
    'projectionPersistenceAuthorized',
    'productBusinessStateCreated',
    'officialTruthCreated',
    'legalDeadlineCertified',
    'executionAuthorized',
    'lifecyclePositionInferred',
    'recommendationAuthorized'
  ] as const;
  if (!authority || !exactKeys(authority, keys) || keys.some((key) => authority[key] !== false)) {
    return null;
  }
  return authority as unknown as CnPreliminaryPublicationSourceReadAuthorityV3;
}

export function parseCnPreliminaryPublicationSourceReadReceiptV3(
  value: unknown
): CnPreliminaryPublicationSourceReadReceiptV3 | null {
  // This parser validates a Data Engine-issued receipt body. A consumer must not
  // synthesize one for a local timeout or other failure that produced no owner response.
  const receipt = record(value);
  if (
    !receipt ||
    !exactKeys(receipt, [
      'contract_version',
      'receipt_kind',
      'receipt_id',
      'source_owner',
      'authority',
      'jurisdiction',
      'resource_kind',
      'state',
      'scope_id',
      'issued_at',
      'read_started_at',
      'read_ended_at',
      'read_completed_at',
      'query',
      'query_fingerprint_sha256',
      'snapshot',
      'producer_implementation',
      'source_corpus',
      'coverage_evidence',
      'data_trust',
      'scan',
      'result_set',
      'reason_codes',
      'retryable',
      'silence_semantics',
      'legal_conclusion',
      'authority_consequences',
      'receipt_fingerprint_sha256'
    ]) ||
    receipt.contract_version !== CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION ||
    receipt.receipt_kind !== CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND ||
    !canonicalText(receipt.receipt_id, 512) ||
    receipt.source_owner !== DATA_ENGINE_SOURCE_OWNER ||
    receipt.authority !== DATA_ENGINE_FACT_AUTHORITY ||
    receipt.jurisdiction !== 'CN' ||
    receipt.resource_kind !== CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND ||
    !cnPreliminaryPublicationSourceReadStatesV3.includes(
      receipt.state as CnPreliminaryPublicationSourceReadStateV3
    ) ||
    !canonicalUtcTimestamp(receipt.issued_at) ||
    !canonicalUtcTimestamp(receipt.read_started_at) ||
    !canonicalUtcTimestamp(receipt.read_ended_at) ||
    (receipt.read_completed_at !== null && !canonicalUtcTimestamp(receipt.read_completed_at)) ||
    receipt.read_started_at > receipt.read_ended_at ||
    receipt.read_ended_at > receipt.issued_at ||
    (receipt.read_completed_at !== null && receipt.read_completed_at !== receipt.read_ended_at) ||
    !queryHash(receipt.query_fingerprint_sha256) ||
    (receipt.silence_semantics !== null &&
      receipt.silence_semantics !== CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC) ||
    receipt.legal_conclusion !== false ||
    !queryHash(receipt.receipt_fingerprint_sha256)
  ) {
    return null;
  }

  const state = receipt.state as CnPreliminaryPublicationSourceReadStateV3;
  const query = parseNormalizedSourceReadQueryV3(receipt.query);
  if (!query) return null;
  const queryFingerprint = canonicalSourceReadFingerprint(query);
  if (
    receipt.query_fingerprint_sha256 !== queryFingerprint ||
    receipt.scope_id !==
      `${CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND}:${queryFingerprint}`
  ) {
    return null;
  }

  const snapshot = receipt.snapshot === null ? null : parseSourceReadSnapshotV3(receipt.snapshot);
  const producer = parseProducerImplementationV3(receipt.producer_implementation);
  const corpus = receipt.source_corpus === null ? null : parseSourceCorpusV3(receipt.source_corpus);
  const dataTrust = receipt.data_trust === null ? null : parseDataTrustV3(receipt.data_trust);
  const authorityConsequences = parseSourceReadAuthorityV3(receipt.authority_consequences);
  if (
    (receipt.snapshot !== null && !snapshot) ||
    !producer ||
    (receipt.source_corpus !== null && !corpus) ||
    (receipt.data_trust !== null && !dataTrust) ||
    !authorityConsequences
  ) {
    return null;
  }
  const coverage =
    receipt.coverage_evidence === null
      ? null
      : parseCoverageEvidenceV3(receipt.coverage_evidence, queryFingerprint, dataTrust);
  if (receipt.coverage_evidence !== null && !coverage) return null;
  const boundSnapshotId = snapshot?.snapshot_id ?? null;
  const boundCorpusFingerprint = corpus?.package_fingerprint_sha256 ?? null;
  const ownerEvidenceReferences: CnPreliminaryPublicationOwnerEvidenceReferenceV3[] = [];
  if (corpus) ownerEvidenceReferences.push(corpus.registration_evidence_reference);
  if (coverage) ownerEvidenceReferences.push(coverage.evidence_reference);
  if (dataTrust) {
    ownerEvidenceReferences.push(
      dataTrust.queryable.evidence_reference,
      dataTrust.complete.evidence_reference,
      dataTrust.fresh.evidence_reference,
      dataTrust.accepted.evidence_reference,
      dataTrust.trusted_for_silence.evidence_reference
    );
  }
  if (
    (corpus !== null && corpus.snapshot_id !== boundSnapshotId) ||
    (coverage !== null &&
      (coverage.snapshot_id !== boundSnapshotId ||
        coverage.source_corpus_fingerprint_sha256 !== boundCorpusFingerprint)) ||
    (dataTrust !== null &&
      (dataTrust.snapshot_id !== boundSnapshotId ||
        dataTrust.source_corpus_fingerprint_sha256 !== boundCorpusFingerprint)) ||
    ownerEvidenceReferences.some(
      (reference) =>
        reference.snapshot_id !== boundSnapshotId ||
        reference.source_corpus_fingerprint_sha256 !== boundCorpusFingerprint
    ) ||
    (dataTrust?.complete.value === true && (snapshot === null || corpus === null)) ||
    (coverage?.decision === 'COVERED' && (snapshot === null || corpus === null)) ||
    (corpus !== null &&
      producer.package_id === corpus.package_id &&
      producer.package_version === corpus.package_version &&
      producer.package_fingerprint_sha256 === corpus.package_fingerprint_sha256)
  ) {
    return null;
  }
  if (
    (dataTrust !== null && dataTrust.evaluated_at > receipt.issued_at) ||
    (coverage !== null && coverage.evaluated_at > receipt.issued_at)
  ) {
    return null;
  }
  const scanResult =
    receipt.scan === null || snapshot === null
      ? null
      : parseScanV3(receipt.scan, query, snapshot.snapshot_id);
  if (receipt.scan !== null && (!snapshot || !scanResult)) return null;
  const resultSet = parseResultSetV3(receipt.result_set, query, receipt.read_ended_at);
  const reasonCodes = controlledCodes(
    receipt.reason_codes,
    cnPreliminaryPublicationSourceReadReasonCodesV3
  );
  if (!resultSet || !reasonCodes) return null;
  if (
    resultSet.source_corpus_fingerprint_sha256 !== boundCorpusFingerprint ||
    (scanResult !== null && scanResult.resultCount !== resultSet.result_count)
  ) {
    return null;
  }

  const isNoResult = resultSet.result_count === 0 && resultSet.result_references.length === 0;
  const stateIsValid =
    (state === 'OBSERVED' &&
      resultSet.result_count > 0 &&
      snapshot !== null &&
      corpus !== null &&
      scanResult !== null &&
      scanResult.scan.page_count > 0 &&
      coverage?.decision !== 'NOT_COVERED' &&
      reasonCodes.length === 0 &&
      receipt.retryable === null &&
      receipt.silence_semantics === null &&
      (scanResult.scan.exact_scope_complete
        ? receipt.read_completed_at !== null
        : receipt.read_completed_at === null)) ||
    (state === 'EMPTY' &&
      isNoResult &&
      receipt.read_completed_at !== null &&
      snapshot !== null &&
      corpus !== null &&
      coverage !== null &&
      dataTrust !== null &&
      scanResult !== null &&
      scanResult.scan.page_count > 0 &&
      scanResult.scan.exact_scope_complete === true &&
      scanResult.scan.final_cursor_fingerprint_sha256 === null &&
      scanResult.scan.bounded_truncation === false &&
      scanResult.scan.read_budget_overflowed === false &&
      coverage.decision === 'COVERED' &&
      dataTrust.queryable.value === true &&
      dataTrust.complete.value === true &&
      dataTrust.fresh.value === true &&
      dataTrust.accepted.value === true &&
      dataTrust.trusted_for_silence.value === true &&
      dataTrust.acceptance_status === 'PASS' &&
      reasonCodes.length === 0 &&
      receipt.retryable === null &&
      receipt.silence_semantics === CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC) ||
    (state === 'NOT_OBSERVED' &&
      isNoResult &&
      coverage?.decision !== 'NOT_COVERED' &&
      dataTrust?.trusted_for_silence.value !== true &&
      reasonCodes.length > 0 &&
      reasonCodes.every((code) => code === 'NO_OBSERVATION_WITHOUT_TRUSTED_SILENCE') &&
      receipt.retryable === null &&
      receipt.silence_semantics === null &&
      (scanResult?.scan.exact_scope_complete === true
        ? receipt.read_completed_at !== null
        : receipt.read_completed_at === null)) ||
    (state === 'NOT_COVERED' &&
      isNoResult &&
      receipt.read_completed_at === null &&
      scanResult === null &&
      coverage !== null &&
      coverage.decision === 'NOT_COVERED' &&
      dataTrust?.trusted_for_silence.value !== true &&
      reasonCodes.length === 1 &&
      reasonCodes[0] === 'EXACT_SCOPE_NOT_COVERED' &&
      receipt.retryable === null &&
      receipt.silence_semantics === null) ||
    (state === 'UNAVAILABLE' &&
      isNoResult &&
      receipt.read_completed_at === null &&
      scanResult?.scan.exact_scope_complete !== true &&
      coverage?.decision !== 'NOT_COVERED' &&
      dataTrust?.trusted_for_silence.value !== true &&
      reasonCodes.length > 0 &&
      reasonCodes.every((code) =>
        ['SOURCE_READ_UNAVAILABLE', 'SOURCE_READ_TIMEOUT', 'SOURCE_READ_RATE_LIMITED'].includes(
          code
        )
      ) &&
      typeof receipt.retryable === 'boolean' &&
      receipt.silence_semantics === null);
  if (!stateIsValid) return null;

  const material = {
    ...receipt,
    query,
    snapshot,
    producer_implementation: producer,
    source_corpus: corpus,
    coverage_evidence: coverage,
    data_trust: dataTrust,
    scan: scanResult?.scan ?? null,
    result_set: resultSet,
    reason_codes: reasonCodes,
    authority_consequences: authorityConsequences
  } as Record<string, unknown>;
  delete material.receipt_fingerprint_sha256;
  const expectedReceiptFingerprint = canonicalSourceReadFingerprint(material);
  if (receipt.receipt_fingerprint_sha256 !== expectedReceiptFingerprint) return null;

  return {
    ...material,
    receipt_fingerprint_sha256: expectedReceiptFingerprint
  } as unknown as CnPreliminaryPublicationSourceReadReceiptV3;
}

export function toCnPreliminaryPublicationSourceReadReceiptReferenceV3(
  value: unknown
): CnPreliminaryPublicationSourceReadReceiptReferenceV3 {
  const receipt = parseCnPreliminaryPublicationSourceReadReceiptV3(value);
  if (!receipt) {
    throw new TypeError('CN preliminary-publication source-read receipt V3 is invalid.');
  }
  return {
    contract_version: receipt.contract_version,
    receipt_kind: receipt.receipt_kind,
    receipt_id: receipt.receipt_id,
    source_owner: receipt.source_owner,
    state: receipt.state,
    scope_id: receipt.scope_id,
    query_fingerprint_sha256: receipt.query_fingerprint_sha256,
    snapshot_id: receipt.snapshot?.snapshot_id ?? null,
    source_version: receipt.snapshot?.source_version ?? null,
    issued_at: receipt.issued_at,
    receipt_fingerprint_sha256: receipt.receipt_fingerprint_sha256
  };
}

export * from './data-engine-applicant-discovery.js';
