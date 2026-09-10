import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER,
  dataEngineJurisdictions,
  parseDataEngineFactEnvelope,
  type DataEngineFactEnvelope,
  type DataEngineJurisdiction
} from './data-engine.js';
import { DATA_ENGINE_DISCOVERY_CONTRACT_VERSION } from './data-engine-discovery.js';

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

function queryHash(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
export const APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND = 'APPLICANT_IDENTITY_DISCOVERY' as const;
export const APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND = 'APPLICANT_PORTFOLIO_DISCOVERY' as const;
export const APPLICANT_IDENTITY_DISCOVERY_CANDIDATE_TYPE = 'APPLICANT_IDENTITY' as const;
export const APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE = 'DISCOVERED_TRADEMARK' as const;

export const applicantDiscoveryMatchKinds = [
  'EXACT_SOURCE_REFERENCE',
  'EXACT_NORMALIZED_NAME',
  'ALIAS_NAME',
  'FUZZY_NAME'
] as const;
export type ApplicantDiscoveryMatchKind = (typeof applicantDiscoveryMatchKinds)[number];

export const applicantDiscoveryReadStates = [
  'RESULTS',
  'EMPTY',
  'NOT_FOUND',
  'NOT_OBSERVED',
  'NOT_COVERED',
  'UNAVAILABLE'
] as const;
export type ApplicantDiscoveryReadState = (typeof applicantDiscoveryReadStates)[number];

export interface DataEngineDiscoveryRequestContextV1 {
  requester_workspace_id: string;
  request_id: string;
}

export interface DataEngineDiscoverySourceReferenceV1 {
  owner: typeof DATA_ENGINE_SOURCE_OWNER;
  authority: typeof DATA_ENGINE_FACT_AUTHORITY;
  jurisdiction: DataEngineJurisdiction;
  source_kind: 'APPLICANT_IDENTITY' | 'TRADEMARK_RECORD';
  source_id: string;
  source_version: string;
  source_fingerprint_sha256: string;
  observed_at: string;
}

export interface ApplicantDiscoveryNameInputV1 {
  kind: 'NAME';
  value: string;
}

export interface ApplicantDiscoveryExternalIdentityHintV1 {
  kind: 'EXTERNAL_IDENTITY_HINT';
  value: string;
  reference_version?: string;
}

export type ApplicantDiscoveryInputV1 =
  ApplicantDiscoveryNameInputV1 | ApplicantDiscoveryExternalIdentityHintV1;

export interface ApplicantDiscoveryRequestV1 {
  requestContext: Readonly<DataEngineDiscoveryRequestContextV1>;
  jurisdiction: DataEngineJurisdiction;
  input: Readonly<ApplicantDiscoveryInputV1>;
  pageSize?: number;
  cursor?: string;
}

export interface DataEngineApplicantCandidateReferenceV1 {
  applicant_candidate_id: string;
  source_reference: Readonly<DataEngineDiscoverySourceReferenceV1>;
}

export interface ApplicantPortfolioRequestV1 {
  requestContext: Readonly<DataEngineDiscoveryRequestContextV1>;
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
  pageSize?: number;
  cursor?: string;
}

export interface DataEngineApplicantCandidateV1 {
  candidate_type: typeof APPLICANT_IDENTITY_DISCOVERY_CANDIDATE_TYPE;
  applicant_candidate_id: string;
  display_name: string;
  alternate_names: readonly string[];
  source_reference: Readonly<DataEngineDiscoverySourceReferenceV1>;
  match_kind: ApplicantDiscoveryMatchKind;
  review_required: true;
  verified_legal_identity: false;
  customer_relationship_established: false;
}

export interface DataEngineDiscoveredTrademarkCandidateV1 {
  candidate_type: typeof APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE;
  trademark_candidate_id: string;
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
  jurisdiction: DataEngineJurisdiction;
  mark_text: string | null;
  application_number: string | null;
  registration_number: string | null;
  classes: readonly number[];
  source_reference: Readonly<DataEngineDiscoverySourceReferenceV1>;
  official_truth_verified: false;
  legal_conclusion_created: false;
  workspace_relationship_established: false;
}

export const noApplicantDiscoveryAuthorityConsequencesV1 = Object.freeze({
  verifiedLegalIdentityEstablished: false,
  customerRelationshipEstablished: false,
  trademarkAssetCreated: false,
  managedRelationshipEstablished: false,
  representedRelationshipEstablished: false,
  ownedRelationshipEstablished: false,
  watchCreated: false,
  legalConclusionCreated: false,
  officialTruthCreated: false,
  externalActionAuthorized: false
});
export type ApplicantDiscoveryAuthorityConsequencesV1 =
  typeof noApplicantDiscoveryAuthorityConsequencesV1;

export interface ApplicantDiscoveryQueryV1 {
  contract_version: typeof DATA_ENGINE_DISCOVERY_CONTRACT_VERSION;
  request_context: Readonly<DataEngineDiscoveryRequestContextV1>;
  jurisdiction: DataEngineJurisdiction;
  input: Readonly<ApplicantDiscoveryInputV1>;
  ordering: readonly ['applicant_candidate_id ASC'];
  ranking_authority: 'NONE';
  limits: Readonly<{ page_size: number; max_results: 100 }>;
  query_hash: string;
}

export interface ApplicantPortfolioQueryV1 {
  contract_version: typeof DATA_ENGINE_DISCOVERY_CONTRACT_VERSION;
  request_context: Readonly<DataEngineDiscoveryRequestContextV1>;
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
  ordering: readonly ['trademark_candidate_id ASC'];
  ranking_authority: 'NONE';
  limits: Readonly<{ page_size: number; max_results: 500 }>;
  query_hash: string;
}

export interface ApplicantDiscoverySourceSnapshotV1 {
  source_version: string;
  observed_at: string;
}

export interface ApplicantDiscoveryProvenanceV1<TQuery> {
  query_hash: string;
  request_context: Readonly<DataEngineDiscoveryRequestContextV1>;
  source_snapshot: Readonly<ApplicantDiscoverySourceSnapshotV1>;
  engine_version: string;
  result_count: number;
  has_more: boolean;
  query: Readonly<TQuery>;
}

export interface ApplicantDiscoveryPageV1 {
  query: Readonly<ApplicantDiscoveryQueryV1>;
  source_snapshot: Readonly<ApplicantDiscoverySourceSnapshotV1>;
  results: ReadonlyArray<Readonly<DataEngineApplicantCandidateV1>>;
  next_cursor: string | null;
  provenance: Readonly<ApplicantDiscoveryProvenanceV1<ApplicantDiscoveryQueryV1>>;
  authority_consequences: Readonly<ApplicantDiscoveryAuthorityConsequencesV1>;
}

export interface ApplicantPortfolioPageV1 {
  query: Readonly<ApplicantPortfolioQueryV1>;
  source_snapshot: Readonly<ApplicantDiscoverySourceSnapshotV1>;
  results: ReadonlyArray<Readonly<DataEngineDiscoveredTrademarkCandidateV1>>;
  next_cursor: string | null;
  provenance: Readonly<ApplicantDiscoveryProvenanceV1<ApplicantPortfolioQueryV1>>;
  authority_consequences: Readonly<ApplicantDiscoveryAuthorityConsequencesV1>;
}

export type ApplicantDiscoveryEnvelopeV1 = DataEngineFactEnvelope<ApplicantDiscoveryPageV1 | null>;
export type ApplicantPortfolioEnvelopeV1 = DataEngineFactEnvelope<ApplicantPortfolioPageV1 | null>;

function isoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function sha256Reference(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

function exactFalseAuthorityConsequences(value: unknown): boolean {
  const candidate = record(value);
  return !!candidate && sameJson(candidate, noApplicantDiscoveryAuthorityConsequencesV1);
}

function parseDiscoveryRequestContext(value: unknown): DataEngineDiscoveryRequestContextV1 | null {
  const context = record(value);
  if (
    !context ||
    !exactKeys(context, ['requester_workspace_id', 'request_id']) ||
    !nonEmptyText(context.requester_workspace_id, 512) ||
    !nonEmptyText(context.request_id, 512)
  ) {
    return null;
  }
  return context as unknown as DataEngineDiscoveryRequestContextV1;
}

function parseApplicantDiscoveryInput(value: unknown): ApplicantDiscoveryInputV1 | null {
  const input = record(value);
  if (!input || !nonEmptyText(input.kind, 64) || !nonEmptyText(input.value, 1000)) return null;
  if (input.kind === 'NAME') {
    if (!exactKeys(input, ['kind', 'value'])) return null;
    return input as unknown as ApplicantDiscoveryNameInputV1;
  }
  if (input.kind === 'EXTERNAL_IDENTITY_HINT') {
    const keys = Object.keys(input);
    if (
      !keys.every((key) => ['kind', 'value', 'reference_version'].includes(key)) ||
      (input.reference_version !== undefined && !nonEmptyText(input.reference_version, 512))
    ) {
      return null;
    }
    return input as unknown as ApplicantDiscoveryExternalIdentityHintV1;
  }
  return null;
}

function parseDiscoverySourceReference(
  value: unknown,
  expectedKind?: DataEngineDiscoverySourceReferenceV1['source_kind']
): DataEngineDiscoverySourceReferenceV1 | null {
  const source = record(value);
  if (
    !source ||
    !exactKeys(source, [
      'owner',
      'authority',
      'jurisdiction',
      'source_kind',
      'source_id',
      'source_version',
      'source_fingerprint_sha256',
      'observed_at'
    ]) ||
    source.owner !== DATA_ENGINE_SOURCE_OWNER ||
    source.authority !== DATA_ENGINE_FACT_AUTHORITY ||
    !dataEngineJurisdictions.includes(source.jurisdiction as DataEngineJurisdiction) ||
    (source.source_kind !== 'APPLICANT_IDENTITY' && source.source_kind !== 'TRADEMARK_RECORD') ||
    (expectedKind !== undefined && source.source_kind !== expectedKind) ||
    !nonEmptyText(source.source_id, 1000) ||
    !nonEmptyText(source.source_version, 512) ||
    !sha256Reference(source.source_fingerprint_sha256) ||
    !isoTimestamp(source.observed_at)
  ) {
    return null;
  }
  return source as unknown as DataEngineDiscoverySourceReferenceV1;
}

function parseApplicantCandidateReference(
  value: unknown
): DataEngineApplicantCandidateReferenceV1 | null {
  const reference = record(value);
  const source = parseDiscoverySourceReference(reference?.source_reference, 'APPLICANT_IDENTITY');
  if (
    !reference ||
    !source ||
    !exactKeys(reference, ['applicant_candidate_id', 'source_reference']) ||
    !nonEmptyText(reference.applicant_candidate_id, 512)
  ) {
    return null;
  }
  return {
    applicant_candidate_id: reference.applicant_candidate_id,
    source_reference: source
  };
}

function parseSourceSnapshot(value: unknown): ApplicantDiscoverySourceSnapshotV1 | null {
  const snapshot = record(value);
  if (
    !snapshot ||
    !exactKeys(snapshot, ['source_version', 'observed_at']) ||
    !nonEmptyText(snapshot.source_version, 512) ||
    !isoTimestamp(snapshot.observed_at)
  ) {
    return null;
  }
  return snapshot as unknown as ApplicantDiscoverySourceSnapshotV1;
}

function parseApplicantDiscoveryQuery(value: unknown): ApplicantDiscoveryQueryV1 | null {
  const query = record(value);
  const context = parseDiscoveryRequestContext(query?.request_context);
  const input = parseApplicantDiscoveryInput(query?.input);
  const limits = record(query?.limits);
  if (
    !query ||
    !context ||
    !input ||
    !limits ||
    !exactKeys(query, [
      'contract_version',
      'request_context',
      'jurisdiction',
      'input',
      'ordering',
      'ranking_authority',
      'limits',
      'query_hash'
    ]) ||
    query.contract_version !== DATA_ENGINE_DISCOVERY_CONTRACT_VERSION ||
    !dataEngineJurisdictions.includes(query.jurisdiction as DataEngineJurisdiction) ||
    !exactStrings(query.ordering, ['applicant_candidate_id ASC']) ||
    query.ranking_authority !== 'NONE' ||
    !exactKeys(limits, ['page_size', 'max_results']) ||
    !Number.isSafeInteger(limits.page_size) ||
    (limits.page_size as number) < 1 ||
    (limits.page_size as number) > 100 ||
    limits.max_results !== 100 ||
    !queryHash(query.query_hash)
  ) {
    return null;
  }
  return query as unknown as ApplicantDiscoveryQueryV1;
}

function parseApplicantPortfolioQuery(value: unknown): ApplicantPortfolioQueryV1 | null {
  const query = record(value);
  const context = parseDiscoveryRequestContext(query?.request_context);
  const applicant = parseApplicantCandidateReference(query?.applicant);
  const limits = record(query?.limits);
  if (
    !query ||
    !context ||
    !applicant ||
    !limits ||
    !exactKeys(query, [
      'contract_version',
      'request_context',
      'applicant',
      'ordering',
      'ranking_authority',
      'limits',
      'query_hash'
    ]) ||
    query.contract_version !== DATA_ENGINE_DISCOVERY_CONTRACT_VERSION ||
    !exactStrings(query.ordering, ['trademark_candidate_id ASC']) ||
    query.ranking_authority !== 'NONE' ||
    !exactKeys(limits, ['page_size', 'max_results']) ||
    !Number.isSafeInteger(limits.page_size) ||
    (limits.page_size as number) < 1 ||
    (limits.page_size as number) > 100 ||
    limits.max_results !== 500 ||
    !queryHash(query.query_hash)
  ) {
    return null;
  }
  return query as unknown as ApplicantPortfolioQueryV1;
}
function nullableText(value: unknown, maxLength = 8192): value is string | null {
  return value === null || nonEmptyText(value, maxLength);
}

function uniqueTextList(value: unknown, maxItems: number, maxLength = 1000): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => nonEmptyText(item, maxLength)) &&
    new Set(value).size === value.length
  );
}

function classList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= 45 &&
    value.every((item) => Number.isInteger(item) && item >= 1 && item <= 45) &&
    new Set(value).size === value.length
  );
}

function sourceObservedNoLaterThanSnapshot(
  source: Readonly<DataEngineDiscoverySourceReferenceV1>,
  snapshot: Readonly<ApplicantDiscoverySourceSnapshotV1>
): boolean {
  return (
    source.source_version === snapshot.source_version &&
    Date.parse(source.observed_at) <= Date.parse(snapshot.observed_at)
  );
}

function parseApplicantCandidate(
  value: unknown,
  jurisdiction: DataEngineJurisdiction,
  snapshot: Readonly<ApplicantDiscoverySourceSnapshotV1>
): DataEngineApplicantCandidateV1 | null {
  const candidate = record(value);
  const source = parseDiscoverySourceReference(candidate?.source_reference, 'APPLICANT_IDENTITY');
  if (
    !candidate ||
    !source ||
    !exactKeys(candidate, [
      'candidate_type',
      'applicant_candidate_id',
      'display_name',
      'alternate_names',
      'source_reference',
      'match_kind',
      'review_required',
      'verified_legal_identity',
      'customer_relationship_established'
    ]) ||
    candidate.candidate_type !== APPLICANT_IDENTITY_DISCOVERY_CANDIDATE_TYPE ||
    !nonEmptyText(candidate.applicant_candidate_id, 512) ||
    !nonEmptyText(candidate.display_name, 1000) ||
    !uniqueTextList(candidate.alternate_names, 20) ||
    !applicantDiscoveryMatchKinds.includes(candidate.match_kind as ApplicantDiscoveryMatchKind) ||
    candidate.review_required !== true ||
    candidate.verified_legal_identity !== false ||
    candidate.customer_relationship_established !== false ||
    source.jurisdiction !== jurisdiction ||
    !sourceObservedNoLaterThanSnapshot(source, snapshot)
  ) {
    return null;
  }
  return candidate as unknown as DataEngineApplicantCandidateV1;
}

function parseDiscoveredTrademarkCandidate(
  value: unknown,
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>,
  snapshot: Readonly<ApplicantDiscoverySourceSnapshotV1>
): DataEngineDiscoveredTrademarkCandidateV1 | null {
  const candidate = record(value);
  const candidateApplicant = parseApplicantCandidateReference(candidate?.applicant);
  const source = parseDiscoverySourceReference(candidate?.source_reference, 'TRADEMARK_RECORD');
  if (
    !candidate ||
    !candidateApplicant ||
    !source ||
    !exactKeys(candidate, [
      'candidate_type',
      'trademark_candidate_id',
      'applicant',
      'jurisdiction',
      'mark_text',
      'application_number',
      'registration_number',
      'classes',
      'source_reference',
      'official_truth_verified',
      'legal_conclusion_created',
      'workspace_relationship_established'
    ]) ||
    candidate.candidate_type !== APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE ||
    !nonEmptyText(candidate.trademark_candidate_id, 512) ||
    !dataEngineJurisdictions.includes(candidate.jurisdiction as DataEngineJurisdiction) ||
    candidate.jurisdiction !== applicant.source_reference.jurisdiction ||
    !nullableText(candidate.mark_text, 1000) ||
    !nullableText(candidate.application_number, 256) ||
    !nullableText(candidate.registration_number, 256) ||
    (candidate.application_number === null && candidate.registration_number === null) ||
    !classList(candidate.classes) ||
    candidate.official_truth_verified !== false ||
    candidate.legal_conclusion_created !== false ||
    candidate.workspace_relationship_established !== false ||
    !sameJson(candidateApplicant, applicant) ||
    source.jurisdiction !== candidate.jurisdiction ||
    !sourceObservedNoLaterThanSnapshot(source, snapshot)
  ) {
    return null;
  }
  return candidate as unknown as DataEngineDiscoveredTrademarkCandidateV1;
}

function parseApplicantDiscoveryProvenance(
  value: unknown,
  query: Readonly<ApplicantDiscoveryQueryV1>,
  snapshot: Readonly<ApplicantDiscoverySourceSnapshotV1>,
  resultCount: number,
  hasMore: boolean
): ApplicantDiscoveryProvenanceV1<ApplicantDiscoveryQueryV1> | null {
  const provenance = record(value);
  const context = parseDiscoveryRequestContext(provenance?.request_context);
  const provenanceSnapshot = parseSourceSnapshot(provenance?.source_snapshot);
  const provenanceQuery = parseApplicantDiscoveryQuery(provenance?.query);
  if (
    !provenance ||
    !context ||
    !provenanceSnapshot ||
    !provenanceQuery ||
    !exactKeys(provenance, [
      'query_hash',
      'request_context',
      'source_snapshot',
      'engine_version',
      'result_count',
      'has_more',
      'query'
    ]) ||
    provenance.query_hash !== query.query_hash ||
    !sameJson(context, query.request_context) ||
    !sameJson(provenanceSnapshot, snapshot) ||
    !nonEmptyText(provenance.engine_version, 512) ||
    provenance.result_count !== resultCount ||
    provenance.has_more !== hasMore ||
    !sameJson(provenanceQuery, query)
  ) {
    return null;
  }
  return provenance as unknown as ApplicantDiscoveryProvenanceV1<ApplicantDiscoveryQueryV1>;
}

function parseApplicantPortfolioProvenance(
  value: unknown,
  query: Readonly<ApplicantPortfolioQueryV1>,
  snapshot: Readonly<ApplicantDiscoverySourceSnapshotV1>,
  resultCount: number,
  hasMore: boolean
): ApplicantDiscoveryProvenanceV1<ApplicantPortfolioQueryV1> | null {
  const provenance = record(value);
  const context = parseDiscoveryRequestContext(provenance?.request_context);
  const provenanceSnapshot = parseSourceSnapshot(provenance?.source_snapshot);
  const provenanceQuery = parseApplicantPortfolioQuery(provenance?.query);
  if (
    !provenance ||
    !context ||
    !provenanceSnapshot ||
    !provenanceQuery ||
    !exactKeys(provenance, [
      'query_hash',
      'request_context',
      'source_snapshot',
      'engine_version',
      'result_count',
      'has_more',
      'query'
    ]) ||
    provenance.query_hash !== query.query_hash ||
    !sameJson(context, query.request_context) ||
    !sameJson(provenanceSnapshot, snapshot) ||
    !nonEmptyText(provenance.engine_version, 512) ||
    provenance.result_count !== resultCount ||
    provenance.has_more !== hasMore ||
    !sameJson(provenanceQuery, query)
  ) {
    return null;
  }
  return provenance as unknown as ApplicantDiscoveryProvenanceV1<ApplicantPortfolioQueryV1>;
}
export function parseApplicantDiscoveryPageV1(value: unknown): ApplicantDiscoveryPageV1 | null {
  const page = record(value);
  const query = parseApplicantDiscoveryQuery(page?.query);
  const snapshot = parseSourceSnapshot(page?.source_snapshot);
  if (
    !page ||
    !query ||
    !snapshot ||
    !exactKeys(page, [
      'query',
      'source_snapshot',
      'results',
      'next_cursor',
      'provenance',
      'authority_consequences'
    ]) ||
    !Array.isArray(page.results) ||
    page.results.length > query.limits.max_results ||
    (page.next_cursor !== null && !nonEmptyText(page.next_cursor, 8192)) ||
    !exactFalseAuthorityConsequences(page.authority_consequences)
  ) {
    return null;
  }

  const results = page.results.map((item) =>
    parseApplicantCandidate(item, query.jurisdiction, snapshot)
  );
  if (results.some((item) => item === null)) return null;
  for (let index = 1; index < results.length; index += 1) {
    if (results[index - 1]!.applicant_candidate_id >= results[index]!.applicant_candidate_id) {
      return null;
    }
  }
  const provenance = parseApplicantDiscoveryProvenance(
    page.provenance,
    query,
    snapshot,
    results.length,
    page.next_cursor !== null
  );
  if (!provenance) return null;
  return page as unknown as ApplicantDiscoveryPageV1;
}

export function parseApplicantPortfolioPageV1(value: unknown): ApplicantPortfolioPageV1 | null {
  const page = record(value);
  const query = parseApplicantPortfolioQuery(page?.query);
  const snapshot = parseSourceSnapshot(page?.source_snapshot);
  if (
    !page ||
    !query ||
    !snapshot ||
    !exactKeys(page, [
      'query',
      'source_snapshot',
      'results',
      'next_cursor',
      'provenance',
      'authority_consequences'
    ]) ||
    !Array.isArray(page.results) ||
    page.results.length > query.limits.max_results ||
    (page.next_cursor !== null && !nonEmptyText(page.next_cursor, 8192)) ||
    !exactFalseAuthorityConsequences(page.authority_consequences)
  ) {
    return null;
  }

  const results = page.results.map((item) =>
    parseDiscoveredTrademarkCandidate(item, query.applicant, snapshot)
  );
  if (results.some((item) => item === null)) return null;
  for (let index = 1; index < results.length; index += 1) {
    if (results[index - 1]!.trademark_candidate_id >= results[index]!.trademark_candidate_id) {
      return null;
    }
  }
  const provenance = parseApplicantPortfolioProvenance(
    page.provenance,
    query,
    snapshot,
    results.length,
    page.next_cursor !== null
  );
  if (!provenance) return null;
  return page as unknown as ApplicantPortfolioPageV1;
}

function parseApplicantReadEnvelope<TPage>(
  value: unknown,
  resourceKind:
    | typeof APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND
    | typeof APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
  parsePage: (value: unknown) => TPage | null,
  pageJurisdiction: (page: TPage) => DataEngineJurisdiction,
  pageEngineVersion: (page: TPage) => string
): DataEngineFactEnvelope<TPage | null> | null {
  const envelope = parseDataEngineFactEnvelope(value);
  if (
    !envelope ||
    envelope.contract_version !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION ||
    envelope.source_owner !== DATA_ENGINE_SOURCE_OWNER ||
    envelope.authority !== DATA_ENGINE_FACT_AUTHORITY ||
    envelope.resource_kind !== resourceKind ||
    envelope.legal_conclusion !== false
  ) {
    return null;
  }

  if (envelope.fact_state === 'observed') {
    const payload = parsePage(envelope.payload);
    if (!payload || pageJurisdiction(payload) !== envelope.jurisdiction) return null;
    if (pageEngineVersion(payload) !== envelope.engine_version) return null;
    return { ...envelope, payload };
  }

  if (
    envelope.fact_state === 'not_found' ||
    envelope.fact_state === 'not_covered' ||
    envelope.fact_state === 'no_observation' ||
    envelope.fact_state === 'service_unavailable'
  ) {
    return envelope.payload === null ? (envelope as DataEngineFactEnvelope<TPage | null>) : null;
  }

  return null;
}

export function parseApplicantDiscoveryEnvelopeV1(
  value: unknown
): ApplicantDiscoveryEnvelopeV1 | null {
  return parseApplicantReadEnvelope(
    value,
    APPLICANT_IDENTITY_DISCOVERY_RESOURCE_KIND,
    parseApplicantDiscoveryPageV1,
    (page) => page.query.jurisdiction,
    (page) => page.provenance.engine_version
  );
}

export function parseApplicantPortfolioEnvelopeV1(
  value: unknown
): ApplicantPortfolioEnvelopeV1 | null {
  return parseApplicantReadEnvelope(
    value,
    APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
    parseApplicantPortfolioPageV1,
    (page) => page.query.applicant.source_reference.jurisdiction,
    (page) => page.provenance.engine_version
  );
}

export function classifyApplicantDiscoveryEnvelopeV1(
  value: Readonly<ApplicantDiscoveryEnvelopeV1>
): ApplicantDiscoveryReadState {
  if (value.fact_state === 'observed') {
    return value.payload && value.payload.results.length > 0 ? 'RESULTS' : 'EMPTY';
  }
  if (value.fact_state === 'not_found') return 'NOT_FOUND';
  if (value.fact_state === 'not_covered') return 'NOT_COVERED';
  if (value.fact_state === 'service_unavailable') return 'UNAVAILABLE';
  return 'NOT_OBSERVED';
}

export function classifyApplicantPortfolioEnvelopeV1(
  value: Readonly<ApplicantPortfolioEnvelopeV1>
): ApplicantDiscoveryReadState {
  if (value.fact_state === 'observed') {
    return value.payload && value.payload.results.length > 0 ? 'RESULTS' : 'EMPTY';
  }
  if (value.fact_state === 'not_found') return 'NOT_FOUND';
  if (value.fact_state === 'not_covered') return 'NOT_COVERED';
  if (value.fact_state === 'service_unavailable') return 'UNAVAILABLE';
  return 'NOT_OBSERVED';
}

export function normalizeApplicantDiscoveryRequestV1(value: Readonly<ApplicantDiscoveryRequestV1>) {
  const requestContext = parseDiscoveryRequestContext({
    requester_workspace_id: value.requestContext?.requester_workspace_id?.trim(),
    request_id: value.requestContext?.request_id?.trim()
  });
  const jurisdiction = value.jurisdiction;
  const input = parseApplicantDiscoveryInput(
    value.input?.kind === 'EXTERNAL_IDENTITY_HINT'
      ? {
          kind: value.input.kind,
          value: value.input.value?.trim(),
          ...(value.input.reference_version === undefined
            ? {}
            : { reference_version: value.input.reference_version.trim() })
        }
      : { kind: value.input?.kind, value: value.input?.value?.trim() }
  );
  const pageSize = value.pageSize ?? 25;
  if (
    !requestContext ||
    !dataEngineJurisdictions.includes(jurisdiction) ||
    !input ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    (value.cursor !== undefined && !nonEmptyText(value.cursor, 8192))
  ) {
    throw new TypeError('Applicant Discovery request is outside the bounded V1 contract.');
  }
  return {
    requestContext,
    jurisdiction,
    input,
    pageSize,
    ...(value.cursor === undefined ? {} : { cursor: value.cursor })
  };
}

export function normalizeApplicantPortfolioRequestV1(value: Readonly<ApplicantPortfolioRequestV1>) {
  const requestContext = parseDiscoveryRequestContext({
    requester_workspace_id: value.requestContext?.requester_workspace_id?.trim(),
    request_id: value.requestContext?.request_id?.trim()
  });
  const applicant = parseApplicantCandidateReference(value.applicant);
  const pageSize = value.pageSize ?? 50;
  if (
    !requestContext ||
    !applicant ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    (value.cursor !== undefined && !nonEmptyText(value.cursor, 8192))
  ) {
    throw new TypeError('Applicant Portfolio request is outside the bounded V1 contract.');
  }
  return {
    requestContext,
    applicant,
    pageSize,
    ...(value.cursor === undefined ? {} : { cursor: value.cursor })
  };
}
