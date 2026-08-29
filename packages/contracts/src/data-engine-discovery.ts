import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER,
  parseDataEngineFactEnvelope,
  type DataEngineFactEnvelope
} from './data-engine.js';

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
  if (
    !payload ||
    payload.snapshot.source_version !== envelope.engine_version ||
    payload.provenance.engine_version !== envelope.engine_version
  ) {
    return null;
  }
  return { ...envelope, payload };
}
