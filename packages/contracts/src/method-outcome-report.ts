import type {
  MethodOutcomeEvidenceId,
  MethodOutcomeEvidenceReasonCode,
  MethodOutcomeEvidenceReviewOutcome
} from './method-outcome-evidence.js';

export const methodOutcomeReportSegmentKinds = ['RESEARCH_DATASET', 'IMPLEMENTATION_KEY'] as const;
export type MethodOutcomeReportSegmentKind = (typeof methodOutcomeReportSegmentKinds)[number];

export interface MethodOutcomeReportWatermarkV1 {
  admittedAt: string;
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

export class MethodOutcomeReportContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'MethodOutcomeReportContractError';
  }
}

type RecordValue = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new MethodOutcomeReportContractError(`${field} must be an object.`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[], field: string): void {
  const supported = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !supported.has(key));
  if (unknown.length)
    throw new MethodOutcomeReportContractError(
      `${field} contains unsupported fields: ${unknown.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new MethodOutcomeReportContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new MethodOutcomeReportContractError(
      `${field} must contain between 1 and ${maximum} characters.`
    );
  return cleaned;
}

function prefixed(value: unknown, prefix: string, field: string): string {
  const cleaned = text(value, field);
  if (!cleaned.startsWith(prefix) || cleaned === prefix)
    throw new MethodOutcomeReportContractError(`${field} must start with ${prefix}.`);
  return cleaned;
}

function timestamp(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned)
    throw new MethodOutcomeReportContractError(`${field} must be a canonical ISO timestamp.`);
  return cleaned;
}

function workspace(value: unknown): string {
  const cleaned = text(value, 'workspaceId', 36).toLowerCase();
  if (!UUID.test(cleaned))
    throw new MethodOutcomeReportContractError('workspaceId must be a canonical UUID.');
  return cleaned;
}

function segment(value: unknown): MethodOutcomeReportSegmentV1 {
  const parsed = record(value, 'segment');
  exactKeys(parsed, ['kind', 'value'], 'segment');
  if (
    typeof parsed.kind !== 'string' ||
    !(methodOutcomeReportSegmentKinds as readonly string[]).includes(parsed.kind)
  )
    throw new MethodOutcomeReportContractError('segment.kind is not supported by V1 reporting.');
  const kind = parsed.kind as MethodOutcomeReportSegmentKind;
  const rawValue = text(parsed.value, 'segment.value', 500);
  if (kind === 'RESEARCH_DATASET' && !rawValue.startsWith('research-dataset:'))
    throw new MethodOutcomeReportContractError(
      'RESEARCH_DATASET segment value must be a research-dataset reference.'
    );
  return { kind, value: rawValue };
}

function watermark(value: unknown): MethodOutcomeReportWatermarkV1 {
  const parsed = record(value, 'watermark');
  exactKeys(parsed, ['admittedAt', 'methodOutcomeEvidenceId'], 'watermark');
  return {
    admittedAt: timestamp(parsed.admittedAt, 'watermark.admittedAt'),
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
  if (root.schemaVersion !== 1)
    throw new MethodOutcomeReportContractError('query.schemaVersion must be 1.');
  return {
    schemaVersion: 1,
    workspaceId: workspace(root.workspaceId),
    methodPackageRef: prefixed(root.methodPackageRef, 'brain-method-package:', 'methodPackageRef'),
    methodVersionRef: prefixed(
      root.methodVersionRef,
      'brain-method-version:',
      'methodVersionRef'
    ),
    ...(root.segment === undefined ? {} : { segment: segment(root.segment) }),
    ...(root.watermark === undefined ? {} : { watermark: watermark(root.watermark) })
  };
}
