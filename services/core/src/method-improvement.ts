import { createHash, randomUUID } from 'node:crypto';
import {
  MethodImprovementContractError,
  assertMethodImprovementMissionBinding,
  parseMethodImprovementPredecessorV1,
  parseMethodImprovementResearchMissionV1,
  parseMethodImprovementTriggerV1,
  type MethodImprovementPerformanceReportSourceV1,
  type MethodImprovementPredecessorV1,
  type MethodImprovementResearchMissionV1,
  type MethodImprovementTriggerV1
} from '@markorbit/contracts/method-improvement';
import {
  BrainMethodContractError,
  parseBrainResearchMissionV1,
  type BrainResearchMissionV1
} from '@markorbit/contracts/brain-method';
import type { ManagedDatabase } from '@markorbit/persistence';
import {
  MethodOutcomeReportError,
  parseMethodOutcomeReportQueryV1,
  type MethodOutcomeReportQueryV1,
  type MethodOutcomeReportServiceV1,
  type MethodOutcomeReportV1
} from './method-outcome-report.js';

export type MethodImprovementAdmissionErrorCode =
  | 'INVALID_REQUEST'
  | 'WORKSPACE_MISMATCH'
  | 'INSUFFICIENT_EVIDENCE'
  | 'REPORT_MISMATCH'
  | 'TRIGGER_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class MethodImprovementAdmissionError extends Error {
  constructor(
    readonly code: MethodImprovementAdmissionErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MethodImprovementAdmissionError';
  }
}

export interface MethodImprovementPerformanceGapCommandV1 {
  schemaVersion: 1;
  workspaceId: string;
  triggerType: 'PERFORMANCE_GAP';
  predecessor: Readonly<MethodImprovementPredecessorV1>;
  reportQuery: Readonly<MethodOutcomeReportQueryV1> & {
    watermark: NonNullable<MethodOutcomeReportQueryV1['watermark']>;
  };
  reason: string;
  createdByPrincipalId: string;
  mission: Readonly<BrainResearchMissionV1>;
}

export interface MethodImprovementAdmissionResultV1 {
  trigger: Readonly<MethodImprovementTriggerV1>;
  researchMission: Readonly<MethodImprovementResearchMissionV1>;
  replayed: boolean;
}

export interface PreparedMethodImprovementAdmissionV1 {
  trigger: Readonly<MethodImprovementTriggerV1>;
  researchMission: Readonly<MethodImprovementResearchMissionV1>;
  idempotencyKey: string;
  correlationId: string;
  sourceIdentityFingerprintSha256: string;
  requestFingerprintSha256: string;
}

export interface MethodImprovementAdmissionRepositoryV1 {
  admit(
    input: Readonly<PreparedMethodImprovementAdmissionV1>
  ): Promise<MethodImprovementAdmissionResultV1>;
}

type RecordValue = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const PHASE7_PILOT_A_PREDECESSOR = Object.freeze({
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodRef: 'brain-method:method_cn-duration',
  methodVersionRef: 'brain-method-version:method-version_cn-duration',
  evaluationRef: 'brain-method-evaluation:evaluation_cn-duration'
});

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function invalid(message: string): never {
  throw new MethodImprovementAdmissionError('INVALID_REQUEST', message);
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

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    return invalid(`${field} must contain between 1 and ${maximum} characters.`);
  return cleaned;
}

function workspace(value: unknown): string {
  const cleaned = text(value, 'workspaceId', 36).toLowerCase();
  if (!UUID.test(cleaned)) return invalid('workspaceId must be a canonical UUID.');
  return cleaned;
}

function assertFrozenPilotAPredecessor(
  predecessor: Readonly<MethodImprovementPredecessorV1>
): void {
  if (
    predecessor.methodPackageRef !== PHASE7_PILOT_A_PREDECESSOR.methodPackageRef ||
    predecessor.methodRef !== PHASE7_PILOT_A_PREDECESSOR.methodRef ||
    predecessor.methodVersionRef !== PHASE7_PILOT_A_PREDECESSOR.methodVersionRef ||
    predecessor.evaluationRef !== PHASE7_PILOT_A_PREDECESSOR.evaluationRef
  )
    invalid('Phase 7 pilot A requires the frozen CN duration predecessor.');
}

export function parseMethodImprovementPerformanceGapCommandV1(
  value: unknown
): MethodImprovementPerformanceGapCommandV1 {
  const command = record(value, 'methodImprovementCommand');
  exactKeys(
    command,
    [
      'schemaVersion',
      'workspaceId',
      'triggerType',
      'predecessor',
      'reportQuery',
      'reason',
      'createdByPrincipalId',
      'mission'
    ],
    'methodImprovementCommand'
  );
  if (command.schemaVersion !== 1) invalid('methodImprovementCommand.schemaVersion must be 1.');
  if (command.triggerType !== 'PERFORMANCE_GAP')
    invalid('Phase 7 pilot A admits PERFORMANCE_GAP only.');

  let predecessor: MethodImprovementPredecessorV1;
  let reportQuery: MethodOutcomeReportQueryV1;
  let mission: BrainResearchMissionV1;
  try {
    predecessor = parseMethodImprovementPredecessorV1(command.predecessor);
    reportQuery = parseMethodOutcomeReportQueryV1(command.reportQuery);
    mission = parseBrainResearchMissionV1(command.mission);
  } catch (error) {
    if (
      error instanceof MethodImprovementContractError ||
      error instanceof BrainMethodContractError ||
      error instanceof MethodOutcomeReportError
    )
      return invalid(error.message);
    throw error;
  }
  assertFrozenPilotAPredecessor(predecessor);
  if (!reportQuery.watermark) invalid('reportQuery.watermark is required for Phase 7 admission.');
  const workspaceId = workspace(command.workspaceId);
  if (reportQuery.workspaceId !== workspaceId)
    invalid('reportQuery.workspaceId must match command workspaceId.');
  if (
    reportQuery.methodPackageRef !== predecessor.methodPackageRef ||
    reportQuery.methodVersionRef !== predecessor.methodVersionRef
  )
    invalid('reportQuery must match predecessor method package/version refs.');

  return {
    schemaVersion: 1,
    workspaceId,
    triggerType: 'PERFORMANCE_GAP',
    predecessor,
    reportQuery: reportQuery as MethodImprovementPerformanceGapCommandV1['reportQuery'],
    reason: text(command.reason, 'reason'),
    createdByPrincipalId: text(command.createdByPrincipalId, 'createdByPrincipalId', 300),
    mission
  };
}

function sameSegment(
  left: MethodOutcomeReportQueryV1['segment'],
  right: MethodOutcomeReportV1['segment']
): boolean {
  return left?.kind === right?.kind && left?.value === right?.value;
}

function sameWatermark(
  left: NonNullable<MethodOutcomeReportQueryV1['watermark']>,
  right: MethodOutcomeReportV1['watermark']
): boolean {
  return (
    !!right &&
    left.admissionSequence === right.admissionSequence &&
    left.methodOutcomeEvidenceId === right.methodOutcomeEvidenceId
  );
}

function assertExactReport(
  command: Readonly<MethodImprovementPerformanceGapCommandV1>,
  report: Readonly<MethodOutcomeReportV1>
): void {
  if (
    report.schemaVersion !== 1 ||
    report.workspaceId !== command.workspaceId ||
    report.methodPackageRef !== command.reportQuery.methodPackageRef ||
    report.methodVersionRef !== command.reportQuery.methodVersionRef ||
    !sameSegment(command.reportQuery.segment, report.segment) ||
    !sameWatermark(command.reportQuery.watermark, report.watermark)
  )
    throw new MethodImprovementAdmissionError(
      'REPORT_MISMATCH',
      'Resolved Method Outcome report does not match the exact requested Phase 6 source.'
    );
  if (report.admittedReviews < 1 || report.methodError.count < 1)
    throw new MethodImprovementAdmissionError(
      'INSUFFICIENT_EVIDENCE',
      'Phase 7 PERFORMANCE_GAP requires at least one admitted review and one METHOD_ERROR signal.'
    );
}

function performanceSource(
  command: Readonly<MethodImprovementPerformanceGapCommandV1>,
  report: Readonly<MethodOutcomeReportV1>
): MethodImprovementPerformanceReportSourceV1 {
  assertExactReport(command, report);
  return {
    kind: 'CORE_METHOD_OUTCOME_REPORT_V1',
    query: {
      schemaVersion: 1,
      workspaceId: report.workspaceId,
      methodPackageRef: report.methodPackageRef,
      methodVersionRef: report.methodVersionRef,
      ...(report.segment ? { segment: report.segment } : {}),
      watermark: report.watermark!
    },
    admittedReviews: report.admittedReviews,
    counts: {
      confirmed: report.confirmed.count,
      overridden: report.overridden.count,
      inconclusive: report.inconclusive.count,
      methodError: report.methodError.count,
      inputDataError: report.inputDataError.count,
      applicabilityError: report.applicabilityError.count,
      productUserPreference: report.productUserPreference.count
    },
    sampleEvidenceRefs: report.sampleEvidenceRefs,
    reportFingerprintSha256: fingerprint(report)
  };
}

function triggerFingerprint(
  value: Omit<MethodImprovementTriggerV1, 'triggerId' | 'triggerFingerprintSha256' | 'admittedAt'>
): string {
  return fingerprint(value);
}

function missionFingerprint(
  value: Omit<MethodImprovementResearchMissionV1, 'researchMissionId' | 'missionFingerprintSha256'>
): string {
  return fingerprint(value);
}

function sourceIdentityFingerprint(
  source: Readonly<MethodImprovementPerformanceReportSourceV1>
): string {
  return fingerprint({
    query: source.query,
    reportFingerprintSha256: source.reportFingerprintSha256
  });
}

function requestFingerprint(command: Readonly<MethodImprovementPerformanceGapCommandV1>): string {
  return fingerprint(command);
}

type StoredAdmissionRow = {
  request_fingerprint_sha256: unknown;
  source_identity_fingerprint_sha256: unknown;
  report_fingerprint_sha256: unknown;
  trigger_fingerprint_sha256: unknown;
  trigger_json: unknown;
  mission_fingerprint_sha256: unknown;
  mission_json: unknown;
};

function stored(row: StoredAdmissionRow): MethodImprovementAdmissionResultV1 {
  let trigger: MethodImprovementTriggerV1;
  let researchMission: MethodImprovementResearchMissionV1;
  try {
    trigger = parseMethodImprovementTriggerV1(row.trigger_json);
    researchMission = parseMethodImprovementResearchMissionV1(row.mission_json);
    assertMethodImprovementMissionBinding(trigger, researchMission);
  } catch (error) {
    throw new MethodImprovementAdmissionError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Method Improvement admission violates the frozen Phase 7 contract.',
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
  const expectedTriggerFingerprint = triggerFingerprint({
    schemaVersion: trigger.schemaVersion,
    workspaceId: trigger.workspaceId,
    triggerType: trigger.triggerType,
    predecessor: trigger.predecessor,
    source: trigger.source,
    reason: trigger.reason,
    createdByPrincipalId: trigger.createdByPrincipalId
  });
  const expectedMissionFingerprint = missionFingerprint({
    schemaVersion: researchMission.schemaVersion,
    workspaceId: researchMission.workspaceId,
    triggerId: researchMission.triggerId,
    triggerFingerprintSha256: researchMission.triggerFingerprintSha256,
    predecessor: researchMission.predecessor,
    mission: researchMission.mission,
    createdByPrincipalId: researchMission.createdByPrincipalId,
    createdAt: researchMission.createdAt
  });
  const expectedSourceIdentity = sourceIdentityFingerprint(trigger.source);
  if (
    row.trigger_fingerprint_sha256 !== expectedTriggerFingerprint ||
    row.mission_fingerprint_sha256 !== expectedMissionFingerprint ||
    row.source_identity_fingerprint_sha256 !== expectedSourceIdentity ||
    row.report_fingerprint_sha256 !== trigger.source.reportFingerprintSha256 ||
    trigger.triggerFingerprintSha256 !== expectedTriggerFingerprint ||
    researchMission.missionFingerprintSha256 !== expectedMissionFingerprint
  )
    throw new MethodImprovementAdmissionError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted Method Improvement admission failed fingerprint verification.'
    );
  return {
    trigger: structuredClone(trigger),
    researchMission: structuredClone(researchMission),
    replayed: true
  };
}

function postgresCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export class PostgresMethodImprovementAdmissionRepositoryV1 implements MethodImprovementAdmissionRepositoryV1 {
  constructor(private readonly database: ManagedDatabase) {}

  async admit(
    input: Readonly<PreparedMethodImprovementAdmissionV1>
  ): Promise<MethodImprovementAdmissionResultV1> {
    const value = input.trigger;
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${value.workspaceId}:${input.idempotencyKey}:${value.source.reportFingerprintSha256}`
        ]);
        const found = await client.query<StoredAdmissionRow>(
          `SELECT t.request_fingerprint_sha256,t.source_identity_fingerprint_sha256,
                  t.report_fingerprint_sha256,t.trigger_fingerprint_sha256,t.trigger_json,
                  m.mission_fingerprint_sha256,m.mission_json
             FROM core_method_improvement_triggers t
             JOIN core_method_improvement_research_missions m
               ON m.trigger_id=t.trigger_id AND m.workspace_id=t.workspace_id
            WHERE t.workspace_id=$1::uuid
              AND (t.idempotency_key=$2 OR t.report_fingerprint_sha256=$3)
            ORDER BY t.admitted_at ASC`,
          [value.workspaceId, input.idempotencyKey, value.source.reportFingerprintSha256]
        );
        if (found.rows.length > 1)
          throw new MethodImprovementAdmissionError(
            'TRIGGER_CONFLICT',
            'Idempotency and report source identities resolve to different immutable Phase 7 triggers.'
          );
        const existing = found.rows[0];
        if (existing) {
          if (
            existing.request_fingerprint_sha256 !== input.requestFingerprintSha256 ||
            existing.source_identity_fingerprint_sha256 !== input.sourceIdentityFingerprintSha256 ||
            existing.report_fingerprint_sha256 !== value.source.reportFingerprintSha256
          )
            throw new MethodImprovementAdmissionError(
              'TRIGGER_CONFLICT',
              'The same idempotency or Phase 6 report source is already bound to different Method Improvement content.'
            );
          return stored(existing);
        }

        await client.query(
          `INSERT INTO core_method_improvement_triggers (
             trigger_id,workspace_id,trigger_type,method_package_ref,method_ref,method_version_ref,
             evaluation_ref,package_fingerprint_sha256,report_watermark_sequence,
             report_watermark_evidence_id,report_fingerprint_sha256,source_identity_fingerprint_sha256,
             request_fingerprint_sha256,trigger_fingerprint_sha256,idempotency_key,correlation_id,
             trigger_json,admitted_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)`,
          [
            value.triggerId,
            value.workspaceId,
            value.triggerType,
            value.predecessor.methodPackageRef,
            value.predecessor.methodRef,
            value.predecessor.methodVersionRef,
            value.predecessor.evaluationRef,
            value.predecessor.packageFingerprintSha256 ?? null,
            value.source.query.watermark.admissionSequence,
            value.source.query.watermark.methodOutcomeEvidenceId,
            value.source.reportFingerprintSha256,
            input.sourceIdentityFingerprintSha256,
            input.requestFingerprintSha256,
            value.triggerFingerprintSha256,
            input.idempotencyKey,
            input.correlationId,
            JSON.stringify(value),
            value.admittedAt
          ]
        );
        await client.query(
          `INSERT INTO core_method_improvement_research_missions (
             research_mission_id,workspace_id,trigger_id,trigger_fingerprint_sha256,
             mission_fingerprint_sha256,mission_json,created_at
           ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
          [
            input.researchMission.researchMissionId,
            input.researchMission.workspaceId,
            input.researchMission.triggerId,
            input.researchMission.triggerFingerprintSha256,
            input.researchMission.missionFingerprintSha256,
            JSON.stringify(input.researchMission),
            input.researchMission.createdAt
          ]
        );
        return {
          trigger: structuredClone(value),
          researchMission: structuredClone(input.researchMission),
          replayed: false
        };
      });
    } catch (error) {
      if (error instanceof MethodImprovementAdmissionError) throw error;
      if (postgresCode(error) === '23505')
        throw new MethodImprovementAdmissionError(
          'TRIGGER_CONFLICT',
          'Method Improvement idempotency or source identity conflicts with an immutable admission.'
        );
      throw new MethodImprovementAdmissionError(
        'PERSISTENCE_UNAVAILABLE',
        'Method Improvement persistence is unavailable.',
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export interface MethodImprovementAdmissionServiceOptionsV1 {
  repository: MethodImprovementAdmissionRepositoryV1;
  reports: Pick<MethodOutcomeReportServiceV1, 'report'>;
  now?: () => string;
  triggerIdFactory?: () => string;
  researchMissionIdFactory?: () => string;
}

export class MethodImprovementAdmissionServiceV1 {
  private readonly now: () => string;
  private readonly triggerIdFactory: () => string;
  private readonly researchMissionIdFactory: () => string;

  constructor(private readonly options: MethodImprovementAdmissionServiceOptionsV1) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.triggerIdFactory = options.triggerIdFactory ?? randomUUID;
    this.researchMissionIdFactory = options.researchMissionIdFactory ?? randomUUID;
  }

  async admit(input: {
    workspaceId: string;
    idempotencyKey: string;
    correlationId: string;
    command: unknown;
  }): Promise<MethodImprovementAdmissionResultV1> {
    const command = parseMethodImprovementPerformanceGapCommandV1(input.command);
    const trustedWorkspaceId = input.workspaceId.trim().toLowerCase();
    if (command.workspaceId !== trustedWorkspaceId)
      throw new MethodImprovementAdmissionError(
        'WORKSPACE_MISMATCH',
        'Method Improvement workspace does not match trusted request context.'
      );
    const idempotencyKey = text(input.idempotencyKey, 'idempotencyKey', 300);
    const correlationId = text(input.correlationId, 'correlationId', 300);

    let report: Readonly<MethodOutcomeReportV1>;
    try {
      report = await this.options.reports.report({
        workspaceId: trustedWorkspaceId,
        query: command.reportQuery
      });
    } catch (error) {
      if (error instanceof MethodOutcomeReportError) {
        if (error.code === 'WORKSPACE_MISMATCH')
          throw new MethodImprovementAdmissionError('WORKSPACE_MISMATCH', error.message);
        if (error.code === 'WATERMARK_MISMATCH')
          throw new MethodImprovementAdmissionError('REPORT_MISMATCH', error.message);
        if (error.code === 'INVALID_QUERY')
          throw new MethodImprovementAdmissionError('INVALID_REQUEST', error.message);
        throw new MethodImprovementAdmissionError(
          'PERSISTENCE_UNAVAILABLE',
          error.message,
          error.retryable,
          { cause: error }
        );
      }
      throw error;
    }

    const source = performanceSource(command, report);
    const triggerBase = {
      schemaVersion: 1 as const,
      workspaceId: command.workspaceId,
      triggerType: 'PERFORMANCE_GAP' as const,
      predecessor: command.predecessor,
      source,
      reason: command.reason,
      createdByPrincipalId: command.createdByPrincipalId
    };
    const triggerFingerprintSha256 = triggerFingerprint(triggerBase);
    const trigger = parseMethodImprovementTriggerV1({
      ...triggerBase,
      triggerId: `method-improvement-trigger_${this.triggerIdFactory()}`,
      triggerFingerprintSha256,
      admittedAt: this.now()
    });
    const missionBase = {
      schemaVersion: 1 as const,
      workspaceId: command.workspaceId,
      triggerId: trigger.triggerId,
      triggerFingerprintSha256,
      predecessor: command.predecessor,
      mission: command.mission,
      createdByPrincipalId: command.createdByPrincipalId,
      createdAt: command.mission.createdAt
    };
    const missionFingerprintSha256 = missionFingerprint(missionBase);
    const researchMission = parseMethodImprovementResearchMissionV1({
      ...missionBase,
      researchMissionId: `method-improvement-research-mission_${this.researchMissionIdFactory()}`,
      missionFingerprintSha256
    });
    assertMethodImprovementMissionBinding(trigger, researchMission);

    return this.options.repository.admit({
      trigger,
      researchMission,
      idempotencyKey,
      correlationId,
      sourceIdentityFingerprintSha256: sourceIdentityFingerprint(source),
      requestFingerprintSha256: requestFingerprint(command)
    });
  }
}
