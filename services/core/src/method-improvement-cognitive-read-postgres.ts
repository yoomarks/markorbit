import { createHash } from 'node:crypto';
import {
  assertMethodImprovementMissionBinding,
  parseMethodImprovementResearchMissionV1,
  parseMethodImprovementTriggerV1,
  type MethodImprovementResearchMissionV1,
  type MethodImprovementTriggerV1
} from '@markorbit/contracts/method-improvement';
import {
  assertMethodImprovementCoverageGapMissionBinding,
  parseMethodImprovementCoverageGapResearchMissionV1,
  parseMethodImprovementCoverageGapTriggerV1,
  type MethodImprovementCoverageGapResearchMissionV1,
  type MethodImprovementCoverageGapTriggerV1
} from '@markorbit/contracts/method-improvement-coverage-gap';
import type { ManagedDatabase } from '@markorbit/persistence';

export type MethodImprovementAdmissionSnapshotV1 =
  | Readonly<{
      kind: 'PERFORMANCE_GAP';
      trigger: Readonly<MethodImprovementTriggerV1>;
      researchMission: Readonly<MethodImprovementResearchMissionV1>;
    }>
  | Readonly<{
      kind: 'COVERAGE_GAP';
      trigger: Readonly<MethodImprovementCoverageGapTriggerV1>;
      researchMission: Readonly<MethodImprovementCoverageGapResearchMissionV1>;
    }>;

export interface MethodImprovementAdmissionReadAuthorityV1 {
  listAdmissions(): Promise<readonly Readonly<MethodImprovementAdmissionSnapshotV1>[]>;
}

export class MethodImprovementCognitiveReadSourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MethodImprovementCognitiveReadSourceError';
  }
}

type PerformanceStoredAdmissionRow = {
  source_identity_fingerprint_sha256: unknown;
  report_fingerprint_sha256: unknown;
  trigger_fingerprint_sha256: unknown;
  trigger_json: unknown;
  mission_fingerprint_sha256: unknown;
  mission_json: unknown;
};

type CoverageStoredAdmissionRow = {
  source_identity_fingerprint_sha256: unknown;
  trigger_fingerprint_sha256: unknown;
  trigger_json: unknown;
  mission_fingerprint_sha256: unknown;
  mission_json: unknown;
};

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

function verifiedPerformance(
  row: PerformanceStoredAdmissionRow
): Readonly<MethodImprovementAdmissionSnapshotV1> {
  try {
    const trigger = parseMethodImprovementTriggerV1(row.trigger_json);
    const researchMission = parseMethodImprovementResearchMissionV1(row.mission_json);
    assertMethodImprovementMissionBinding(trigger, researchMission);

    const expectedTriggerFingerprint = fingerprint({
      schemaVersion: trigger.schemaVersion,
      workspaceId: trigger.workspaceId,
      triggerType: trigger.triggerType,
      predecessor: trigger.predecessor,
      source: trigger.source,
      reason: trigger.reason,
      createdByPrincipalId: trigger.createdByPrincipalId
    });
    const expectedMissionFingerprint = fingerprint({
      schemaVersion: researchMission.schemaVersion,
      workspaceId: researchMission.workspaceId,
      triggerId: researchMission.triggerId,
      triggerFingerprintSha256: researchMission.triggerFingerprintSha256,
      predecessor: researchMission.predecessor,
      mission: researchMission.mission,
      createdByPrincipalId: researchMission.createdByPrincipalId,
      createdAt: researchMission.createdAt
    });
    const expectedSourceIdentityFingerprint = fingerprint({
      query: trigger.source.query,
      reportFingerprintSha256: trigger.source.reportFingerprintSha256
    });

    if (
      row.trigger_fingerprint_sha256 !== expectedTriggerFingerprint ||
      trigger.triggerFingerprintSha256 !== expectedTriggerFingerprint ||
      row.mission_fingerprint_sha256 !== expectedMissionFingerprint ||
      researchMission.missionFingerprintSha256 !== expectedMissionFingerprint ||
      row.source_identity_fingerprint_sha256 !== expectedSourceIdentityFingerprint ||
      row.report_fingerprint_sha256 !== trigger.source.reportFingerprintSha256
    )
      throw new Error('Persisted PERFORMANCE_GAP fingerprints do not match governed content.');

    return Object.freeze({
      kind: 'PERFORMANCE_GAP',
      trigger: structuredClone(trigger),
      researchMission: structuredClone(researchMission)
    });
  } catch (error) {
    throw new MethodImprovementCognitiveReadSourceError(
      'Persisted PERFORMANCE_GAP Method Improvement admission failed governed validation.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function verifiedCoverage(
  row: CoverageStoredAdmissionRow
): Readonly<MethodImprovementAdmissionSnapshotV1> {
  try {
    const trigger = parseMethodImprovementCoverageGapTriggerV1(row.trigger_json);
    const researchMission = parseMethodImprovementCoverageGapResearchMissionV1(row.mission_json);
    assertMethodImprovementCoverageGapMissionBinding(trigger, researchMission);
    const expectedSourceIdentityFingerprint = fingerprint({
      workspaceId: trigger.workspaceId,
      evidenceId: trigger.source.evidenceId,
      evidenceFingerprintSha256: trigger.source.evidenceFingerprintSha256
    });

    if (
      row.trigger_fingerprint_sha256 !== trigger.triggerFingerprintSha256 ||
      row.mission_fingerprint_sha256 !== researchMission.missionFingerprintSha256 ||
      row.source_identity_fingerprint_sha256 !== expectedSourceIdentityFingerprint
    )
      throw new Error('Persisted COVERAGE_GAP fingerprints do not match governed content.');

    return Object.freeze({
      kind: 'COVERAGE_GAP',
      trigger: structuredClone(trigger),
      researchMission: structuredClone(researchMission)
    });
  } catch (error) {
    throw new MethodImprovementCognitiveReadSourceError(
      'Persisted COVERAGE_GAP Method Improvement admission failed governed validation.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function admittedAt(value: Readonly<MethodImprovementAdmissionSnapshotV1>): string {
  return value.trigger.admittedAt;
}

export class PostgresMethodImprovementCognitiveReadSourceV1 implements MethodImprovementAdmissionReadAuthorityV1 {
  constructor(private readonly database: ManagedDatabase) {}

  async listAdmissions(): Promise<readonly Readonly<MethodImprovementAdmissionSnapshotV1>[]> {
    try {
      const [performance, coverage] = await Promise.all([
        this.database.getPool().query<PerformanceStoredAdmissionRow>(
          `SELECT t.source_identity_fingerprint_sha256,t.report_fingerprint_sha256,
                  t.trigger_fingerprint_sha256,t.trigger_json,
                  m.mission_fingerprint_sha256,m.mission_json
             FROM core_method_improvement_triggers t
             LEFT JOIN core_method_improvement_research_missions m
               ON m.trigger_id=t.trigger_id AND m.workspace_id=t.workspace_id
            ORDER BY t.admitted_at ASC,t.trigger_id ASC`
        ),
        this.database.getPool().query<CoverageStoredAdmissionRow>(
          `SELECT t.source_identity_fingerprint_sha256,t.trigger_fingerprint_sha256,t.trigger_json,
                  m.mission_fingerprint_sha256,m.mission_json
             FROM core_method_improvement_coverage_gap_triggers t
             LEFT JOIN core_method_improvement_coverage_gap_research_missions m
               ON m.trigger_id=t.trigger_id AND m.workspace_id=t.workspace_id
            ORDER BY t.admitted_at ASC,t.trigger_id ASC`
        )
      ]);

      const admissions = [
        ...performance.rows.map((row) => verifiedPerformance(row)),
        ...coverage.rows.map((row) => verifiedCoverage(row))
      ].sort((left, right) =>
        admittedAt(left) === admittedAt(right)
          ? left.trigger.triggerId.localeCompare(right.trigger.triggerId)
          : admittedAt(left).localeCompare(admittedAt(right))
      );
      return Object.freeze(admissions);
    } catch (error) {
      if (error instanceof MethodImprovementCognitiveReadSourceError) throw error;
      throw new MethodImprovementCognitiveReadSourceError(
        'Method Improvement cognitive owner truth is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
