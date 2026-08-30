import type {
  MethodOutcomeEvidenceId,
  MethodOutcomeEvidenceReasonCode,
  MethodOutcomeEvidenceReviewOutcome
} from '@markorbit/contracts/method-outcome-evidence';
import type { ManagedDatabase } from '@markorbit/persistence';

export const methodOutcomeReportSegmentKinds = ['RESEARCH_DATASET', 'IMPLEMENTATION_KEY'] as const;
export type MethodOutcomeReportSegmentKind = (typeof methodOutcomeReportSegmentKinds)[number];

export interface MethodOutcomeReportWatermarkV1 {
  admissionSequence: number;
  methodOutcomeEvidenceId: MethodOutcomeEvidenceId;
}

export interface MethodOutcomeReportSegmentV1 {
  kind: MethodOutcomeReportSegmentKind;
  value: string;
}

export interface MethodOutcomeReportQueryV1 {
  schemaVersion: 1;
  workspaceId: string;
  methodPackageRef: string;
  methodVersionRef: string;
  segment?: Readonly<MethodOutcomeReportSegmentV1>;
  watermark?: Readonly<MethodOutcomeReportWatermarkV1>;
}

export interface MethodOutcomeReportMetricV1 {
  count: number;
  rate: number;
}

export interface MethodOutcomeReportSampleRefV1 {
  admissionSequence: number;
  methodOutcomeEvidenceId: MethodOutcomeEvidenceId;
  reviewId: string;
  reviewVersion: number;
  outcome: MethodOutcomeEvidenceReviewOutcome;
  reason?: MethodOutcomeEvidenceReasonCode;
  admittedAt: string;
}

export interface MethodOutcomeReportV1 {
  schemaVersion: 1;
  workspaceId: string;
  methodPackageRef: string;
  methodVersionRef: string;
  segment?: Readonly<MethodOutcomeReportSegmentV1>;
  watermark?: Readonly<MethodOutcomeReportWatermarkV1>;
  admittedReviews: number;
  confirmed: Readonly<MethodOutcomeReportMetricV1>;
  overridden: Readonly<MethodOutcomeReportMetricV1>;
  methodError: Readonly<MethodOutcomeReportMetricV1>;
  inputDataError: Readonly<MethodOutcomeReportMetricV1>;
  applicabilityError: Readonly<MethodOutcomeReportMetricV1>;
  productUserPreference: Readonly<MethodOutcomeReportMetricV1>;
  inconclusive: Readonly<MethodOutcomeReportMetricV1>;
  sampleEvidenceRefs: ReadonlyArray<Readonly<MethodOutcomeReportSampleRefV1>>;
}

export type MethodOutcomeReportErrorCode =
  | 'INVALID_QUERY'
  | 'WORKSPACE_MISMATCH'
  | 'WATERMARK_MISMATCH'
  | 'PERSISTENCE_UNAVAILABLE';

export class MethodOutcomeReportError extends Error {
  constructor(
    readonly code: MethodOutcomeReportErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MethodOutcomeReportError';
  }
}

type RecordValue = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const OUTCOMES = new Set<MethodOutcomeEvidenceReviewOutcome>([
  'CONFIRMED',
  'OVERRIDDEN',
  'INCONCLUSIVE'
]);
const REASONS = new Set<MethodOutcomeEvidenceReasonCode>([
  'METHOD_ERROR',
  'INPUT_DATA_ERROR',
  'APPLICABILITY_ERROR',
  'PRODUCT_USER_PREFERENCE',
  'INCONCLUSIVE_EVIDENCE'
]);

function invalid(message: string): never {
  throw new MethodOutcomeReportError('INVALID_QUERY', message, 400);
}

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid(`${field} must be an object.`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[], field: string): void {
  const supported = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !supported.has(key));
  if (unknown.length) invalid(`${field} contains unsupported fields: ${unknown.join(', ')}.`);
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    return invalid(`${field} must contain between 1 and ${maximum} characters.`);
  return cleaned;
}

function prefixed(value: unknown, prefix: string, field: string): string {
  const cleaned = text(value, field);
  if (!cleaned.startsWith(prefix) || cleaned === prefix)
    return invalid(`${field} must start with ${prefix}.`);
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    return invalid(`${field} must be a positive safe integer.`);
  return Number(value);
}

function workspace(value: unknown): string {
  const cleaned = text(value, 'workspaceId', 36).toLowerCase();
  if (!UUID.test(cleaned)) return invalid('workspaceId must be a canonical UUID.');
  return cleaned;
}

function parseSegment(value: unknown): MethodOutcomeReportSegmentV1 {
  const parsed = record(value, 'segment');
  exactKeys(parsed, ['kind', 'value'], 'segment');
  if (
    typeof parsed.kind !== 'string' ||
    !(methodOutcomeReportSegmentKinds as readonly string[]).includes(parsed.kind)
  )
    return invalid('segment.kind is not supported by V1 reporting.');
  const kind = parsed.kind as MethodOutcomeReportSegmentKind;
  const segmentValue = text(parsed.value, 'segment.value');
  if (kind === 'RESEARCH_DATASET' && !segmentValue.startsWith('research-dataset:'))
    return invalid('RESEARCH_DATASET segment value must be a research-dataset reference.');
  return { kind, value: segmentValue };
}

function parseWatermark(value: unknown): MethodOutcomeReportWatermarkV1 {
  const parsed = record(value, 'watermark');
  exactKeys(parsed, ['admissionSequence', 'methodOutcomeEvidenceId'], 'watermark');
  return {
    admissionSequence: positiveInteger(parsed.admissionSequence, 'watermark.admissionSequence'),
    methodOutcomeEvidenceId: prefixed(
      parsed.methodOutcomeEvidenceId,
      'method-outcome-evidence_',
      'watermark.methodOutcomeEvidenceId'
    ) as MethodOutcomeEvidenceId
  };
}

export function parseMethodOutcomeReportQueryV1(value: unknown): MethodOutcomeReportQueryV1 {
  const root = record(value, 'query');
  exactKeys(
    root,
    ['schemaVersion', 'workspaceId', 'methodPackageRef', 'methodVersionRef', 'segment', 'watermark'],
    'query'
  );
  if (root.schemaVersion !== 1) invalid('query.schemaVersion must be 1.');
  return {
    schemaVersion: 1,
    workspaceId: workspace(root.workspaceId),
    methodPackageRef: prefixed(root.methodPackageRef, 'brain-method-package:', 'methodPackageRef'),
    methodVersionRef: prefixed(
      root.methodVersionRef,
      'brain-method-version:',
      'methodVersionRef'
    ),
    ...(root.segment === undefined ? {} : { segment: parseSegment(root.segment) }),
    ...(root.watermark === undefined ? {} : { watermark: parseWatermark(root.watermark) })
  };
}

interface ReportRow {
  watermark_count: number;
  watermark_sequence: string | null;
  watermark_evidence_id: string | null;
  admitted_reviews: number;
  confirmed_count: number;
  overridden_count: number;
  method_error_count: number;
  input_data_error_count: number;
  applicability_error_count: number;
  product_user_preference_count: number;
  inconclusive_count: number;
  sample_refs: unknown;
}

interface StoredSampleRef {
  admissionSequence: unknown;
  methodOutcomeEvidenceId: unknown;
  reviewId: unknown;
  reviewVersion: unknown;
  outcome: unknown;
  reason?: unknown;
  admittedAt: unknown;
}

function safeSequence(value: unknown, field: string): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || Number(parsed) < 1)
    throw new MethodOutcomeReportError(
      'PERSISTENCE_UNAVAILABLE',
      `Stored ${field} is invalid.`,
      503,
      true
    );
  return Number(parsed);
}

function canonicalTimestamp(value: unknown, field: string): string {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime()))
    throw new MethodOutcomeReportError(
      'PERSISTENCE_UNAVAILABLE',
      `Stored ${field} is invalid.`,
      503,
      true
    );
  return parsed.toISOString();
}

function sampleRefs(value: unknown): MethodOutcomeReportSampleRefV1[] {
  if (!Array.isArray(value) || value.length > 20)
    throw new MethodOutcomeReportError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored Method Outcome report sample references are invalid.',
      503,
      true
    );
  return value.map((item) => {
    const row = item as StoredSampleRef;
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.methodOutcomeEvidenceId !== 'string' ||
      !row.methodOutcomeEvidenceId.startsWith('method-outcome-evidence_') ||
      typeof row.reviewId !== 'string' ||
      !row.reviewId.startsWith('matter-intelligence-review_') ||
      !Number.isSafeInteger(row.reviewVersion) ||
      typeof row.outcome !== 'string' ||
      !OUTCOMES.has(row.outcome as MethodOutcomeEvidenceReviewOutcome) ||
      (row.reason !== null &&
        row.reason !== undefined &&
        (typeof row.reason !== 'string' || !REASONS.has(row.reason as MethodOutcomeEvidenceReasonCode)))
    )
      throw new MethodOutcomeReportError(
        'PERSISTENCE_UNAVAILABLE',
        'Stored Method Outcome report sample reference violates V1.',
        503,
        true
      );
    return {
      admissionSequence: safeSequence(row.admissionSequence, 'sample admission sequence'),
      methodOutcomeEvidenceId: row.methodOutcomeEvidenceId as MethodOutcomeEvidenceId,
      reviewId: row.reviewId,
      reviewVersion: Number(row.reviewVersion),
      outcome: row.outcome as MethodOutcomeEvidenceReviewOutcome,
      ...(row.reason === null || row.reason === undefined
        ? {}
        : { reason: row.reason as MethodOutcomeEvidenceReasonCode }),
      admittedAt: canonicalTimestamp(row.admittedAt, 'sample admittedAt')
    };
  });
}

function metric(count: number, admittedReviews: number): MethodOutcomeReportMetricV1 {
  return { count, rate: admittedReviews === 0 ? 0 : count / admittedReviews };
}

export interface MethodOutcomeReportReaderV1 {
  report(query: Readonly<MethodOutcomeReportQueryV1>): Promise<Readonly<MethodOutcomeReportV1>>;
}

export class PostgresMethodOutcomeReportReaderV1 implements MethodOutcomeReportReaderV1 {
  constructor(private readonly database: ManagedDatabase) {}

  async report(query: Readonly<MethodOutcomeReportQueryV1>): Promise<Readonly<MethodOutcomeReportV1>> {
    const segmentKind = query.segment?.kind ?? null;
    const segmentValue = query.segment?.value ?? null;
    const watermarkSequence = query.watermark?.admissionSequence ?? null;
    const watermarkId = query.watermark?.methodOutcomeEvidenceId ?? null;
    try {
      const result = await this.database.getPool().query<ReportRow>(
        `WITH filtered AS (
           SELECT admission_sequence,method_outcome_evidence_id,review_id,review_version,outcome,reason,admitted_at
             FROM core_method_outcome_evidence
            WHERE workspace_id=$1::uuid
              AND method_package_ref=$2
              AND method_version_ref=$3
              AND (
                $4::text IS NULL
                OR ($4='RESEARCH_DATASET' AND research_dataset_ref=$5)
                OR ($4='IMPLEMENTATION_KEY' AND implementation_key=$5)
              )
         ), watermark AS (
           SELECT admission_sequence,method_outcome_evidence_id
             FROM filtered
            WHERE $6::bigint IS NULL
               OR (admission_sequence=$6::bigint AND method_outcome_evidence_id=$7)
            ORDER BY admission_sequence DESC
            LIMIT 1
         ), bounded AS (
           SELECT filtered.*
             FROM filtered CROSS JOIN watermark
            WHERE filtered.admission_sequence <= watermark.admission_sequence
         ), samples AS (
           SELECT admission_sequence,method_outcome_evidence_id,review_id,review_version,outcome,reason,admitted_at
             FROM bounded
            ORDER BY admission_sequence DESC
            LIMIT 20
         )
         SELECT
           (SELECT count(*)::int FROM watermark) AS watermark_count,
           (SELECT admission_sequence::text FROM watermark) AS watermark_sequence,
           (SELECT method_outcome_evidence_id FROM watermark) AS watermark_evidence_id,
           (SELECT count(*)::int FROM bounded) AS admitted_reviews,
           (SELECT count(*)::int FROM bounded WHERE outcome='CONFIRMED') AS confirmed_count,
           (SELECT count(*)::int FROM bounded WHERE outcome='OVERRIDDEN') AS overridden_count,
           (SELECT count(*)::int FROM bounded WHERE reason='METHOD_ERROR') AS method_error_count,
           (SELECT count(*)::int FROM bounded WHERE reason='INPUT_DATA_ERROR') AS input_data_error_count,
           (SELECT count(*)::int FROM bounded WHERE reason='APPLICABILITY_ERROR') AS applicability_error_count,
           (SELECT count(*)::int FROM bounded WHERE reason='PRODUCT_USER_PREFERENCE') AS product_user_preference_count,
           (SELECT count(*)::int FROM bounded WHERE outcome='INCONCLUSIVE') AS inconclusive_count,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'admissionSequence',admission_sequence::text,
               'methodOutcomeEvidenceId',method_outcome_evidence_id,
               'reviewId',review_id,
               'reviewVersion',review_version,
               'outcome',outcome,
               'reason',reason,
               'admittedAt',admitted_at
             ) ORDER BY admission_sequence DESC)
               FROM samples
           ),'[]'::jsonb) AS sample_refs`,
        [
          query.workspaceId,
          query.methodPackageRef,
          query.methodVersionRef,
          segmentKind,
          segmentValue,
          watermarkSequence,
          watermarkId
        ]
      );
      const row = result.rows[0];
      if (!row)
        throw new MethodOutcomeReportError(
          'PERSISTENCE_UNAVAILABLE',
          'Method Outcome report query returned no result.',
          503,
          true
        );
      if (query.watermark && row.watermark_count !== 1)
        throw new MethodOutcomeReportError(
          'WATERMARK_MISMATCH',
          'The supplied Method Outcome report watermark is outside the requested workspace/filter.',
          409
        );
      const admittedReviews = row.admitted_reviews;
      const resolvedWatermark =
        row.watermark_count === 0
          ? undefined
          : {
              admissionSequence: safeSequence(row.watermark_sequence, 'report watermark sequence'),
              methodOutcomeEvidenceId: row.watermark_evidence_id as MethodOutcomeEvidenceId
            };
      if (resolvedWatermark && !row.watermark_evidence_id?.startsWith('method-outcome-evidence_'))
        throw new MethodOutcomeReportError(
          'PERSISTENCE_UNAVAILABLE',
          'Stored Method Outcome report watermark identity is invalid.',
          503,
          true
        );
      return {
        schemaVersion: 1,
        workspaceId: query.workspaceId,
        methodPackageRef: query.methodPackageRef,
        methodVersionRef: query.methodVersionRef,
        ...(query.segment ? { segment: query.segment } : {}),
        ...(resolvedWatermark ? { watermark: resolvedWatermark } : {}),
        admittedReviews,
        confirmed: metric(row.confirmed_count, admittedReviews),
        overridden: metric(row.overridden_count, admittedReviews),
        methodError: metric(row.method_error_count, admittedReviews),
        inputDataError: metric(row.input_data_error_count, admittedReviews),
        applicabilityError: metric(row.applicability_error_count, admittedReviews),
        productUserPreference: metric(row.product_user_preference_count, admittedReviews),
        inconclusive: metric(row.inconclusive_count, admittedReviews),
        sampleEvidenceRefs: sampleRefs(row.sample_refs)
      };
    } catch (error) {
      if (error instanceof MethodOutcomeReportError) throw error;
      throw new MethodOutcomeReportError(
        'PERSISTENCE_UNAVAILABLE',
        'Method Outcome reporting persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export class MethodOutcomeReportServiceV1 {
  constructor(private readonly reader: MethodOutcomeReportReaderV1) {}

  async report(input: {
    workspaceId: string;
    query: unknown;
  }): Promise<Readonly<MethodOutcomeReportV1>> {
    const query = parseMethodOutcomeReportQueryV1(input.query);
    if (query.workspaceId !== input.workspaceId)
      throw new MethodOutcomeReportError(
        'WORKSPACE_MISMATCH',
        'Method Outcome report workspace does not match trusted workspace context.',
        403
      );
    return this.reader.report(query);
  }
}
