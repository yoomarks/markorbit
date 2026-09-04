import type { MethodImprovementPredecessorV1 } from '@markorbit/contracts/method-improvement';
import type {
  MethodImprovementAdmissionReadAuthorityV1,
  MethodImprovementAdmissionSnapshotV1
} from './method-improvement-cognitive-read-postgres.js';

export class MethodImprovementCognitiveReadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MethodImprovementCognitiveReadError';
  }
}

export interface MethodImprovementPredecessorCognitiveReadV1 {
  methodPackageRef: string;
  methodRef: string;
  methodVersionRef: string;
  evaluationRef: string;
  packageFingerprintSha256?: string;
}

export type MethodImprovementCognitiveReadItemV1 =
  | Readonly<{
      trigger: Readonly<{
        triggerId: string;
        triggerType: 'PERFORMANCE_GAP';
        triggerFingerprintSha256: string;
        admittedAt: string;
        predecessor: Readonly<MethodImprovementPredecessorCognitiveReadV1>;
        source: Readonly<{
          kind: 'CORE_METHOD_OUTCOME_REPORT_V1';
          reportFingerprintSha256: string;
          watermark: Readonly<{
            admissionSequence: number;
            methodOutcomeEvidenceId: string;
          }>;
        }>;
      }>;
      researchMission: Readonly<{
        researchMissionId: string;
        missionFingerprintSha256: string;
        triggerId: string;
        triggerFingerprintSha256: string;
        createdAt: string;
      }>;
    }>
  | Readonly<{
      trigger: Readonly<{
        triggerId: string;
        triggerType: 'COVERAGE_GAP';
        triggerFingerprintSha256: string;
        admittedAt: string;
        target:
          | Readonly<{
              kind: 'EXISTING_METHOD';
              predecessor: Readonly<MethodImprovementPredecessorCognitiveReadV1>;
            }>
          | Readonly<{
              kind: 'NEW_CAPABILITY_METHOD_DEMAND';
              demandId: string;
              demandFingerprintSha256: string;
            }>;
        source: Readonly<{
          kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1';
          coverageStatus: string;
          evidenceId: string;
          evidenceFingerprintSha256: string;
          sourceAuditFingerprintSha256: string;
          demandId: string;
          demandFingerprintSha256: string;
        }>;
      }>;
      researchMission: Readonly<{
        researchMissionId: string;
        missionFingerprintSha256: string;
        triggerId: string;
        triggerFingerprintSha256: string;
        createdAt: string;
      }>;
    }>;

export interface MethodImprovementCognitiveReadProjectionV1 {
  schemaVersion: 1;
  generatedAt: string;
  source: Readonly<{
    domain: 'CORE';
    authority: 'METHOD_IMPROVEMENT_ADMISSION';
    availability: 'AVAILABLE';
  }>;
  methodImprovements: readonly Readonly<MethodImprovementCognitiveReadItemV1>[];
  brainBuildRuns: Readonly<{
    availability: 'NOT_DURABLY_RECORDED';
    inventory: null;
    reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY';
  }>;
  summary: Readonly<{
    methodImprovementAdmissionCount: number;
    performanceGapAdmissionCount: number;
    coverageGapAdmissionCount: number;
    brainBuildRunInventoryAvailable: false;
  }>;
}

function canonicalTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value)
    throw new MethodImprovementCognitiveReadError(`${field} is malformed.`);
  return value;
}

function projectPredecessor(
  predecessor: Readonly<MethodImprovementPredecessorV1>
): Readonly<MethodImprovementPredecessorCognitiveReadV1> {
  return Object.freeze({
    methodPackageRef: predecessor.methodPackageRef,
    methodRef: predecessor.methodRef,
    methodVersionRef: predecessor.methodVersionRef,
    evaluationRef: predecessor.evaluationRef,
    ...(predecessor.packageFingerprintSha256
      ? { packageFingerprintSha256: predecessor.packageFingerprintSha256 }
      : {})
  });
}

function projectMission(value: Readonly<MethodImprovementAdmissionSnapshotV1>) {
  const mission = value.researchMission;
  return Object.freeze({
    researchMissionId: mission.researchMissionId,
    missionFingerprintSha256: mission.missionFingerprintSha256,
    triggerId: mission.triggerId,
    triggerFingerprintSha256: mission.triggerFingerprintSha256,
    createdAt: canonicalTimestamp(mission.createdAt, 'researchMission.createdAt')
  });
}

function assertBinding(value: Readonly<MethodImprovementAdmissionSnapshotV1>): void {
  if (
    value.researchMission.triggerId !== value.trigger.triggerId ||
    value.researchMission.triggerFingerprintSha256 !== value.trigger.triggerFingerprintSha256
  )
    throw new MethodImprovementCognitiveReadError(
      'Method Improvement trigger/mission binding is invalid.'
    );
}

function projectPerformance(
  value: Extract<MethodImprovementAdmissionSnapshotV1, { kind: 'PERFORMANCE_GAP' }>
): Readonly<MethodImprovementCognitiveReadItemV1> {
  const trigger = value.trigger;
  return Object.freeze({
    trigger: Object.freeze({
      triggerId: trigger.triggerId,
      triggerType: 'PERFORMANCE_GAP' as const,
      triggerFingerprintSha256: trigger.triggerFingerprintSha256,
      admittedAt: canonicalTimestamp(trigger.admittedAt, 'trigger.admittedAt'),
      predecessor: projectPredecessor(trigger.predecessor),
      source: Object.freeze({
        kind: trigger.source.kind,
        reportFingerprintSha256: trigger.source.reportFingerprintSha256,
        watermark: Object.freeze({
          admissionSequence: trigger.source.query.watermark.admissionSequence,
          methodOutcomeEvidenceId: trigger.source.query.watermark.methodOutcomeEvidenceId
        })
      })
    }),
    researchMission: projectMission(value)
  });
}

function projectCoverage(
  value: Extract<MethodImprovementAdmissionSnapshotV1, { kind: 'COVERAGE_GAP' }>
): Readonly<MethodImprovementCognitiveReadItemV1> {
  const trigger = value.trigger;
  const target =
    trigger.target.kind === 'EXISTING_METHOD'
      ? Object.freeze({
          kind: 'EXISTING_METHOD' as const,
          predecessor: projectPredecessor(trigger.target.predecessor)
        })
      : Object.freeze({
          kind: 'NEW_CAPABILITY_METHOD_DEMAND' as const,
          demandId: trigger.target.demandId,
          demandFingerprintSha256: trigger.target.demandFingerprintSha256
        });
  return Object.freeze({
    trigger: Object.freeze({
      triggerId: trigger.triggerId,
      triggerType: 'COVERAGE_GAP' as const,
      triggerFingerprintSha256: trigger.triggerFingerprintSha256,
      admittedAt: canonicalTimestamp(trigger.admittedAt, 'trigger.admittedAt'),
      target,
      source: Object.freeze({
        kind: trigger.source.kind,
        coverageStatus: trigger.source.coverageStatus,
        evidenceId: trigger.source.evidenceId,
        evidenceFingerprintSha256: trigger.source.evidenceFingerprintSha256,
        sourceAuditFingerprintSha256: trigger.source.sourceAuditFingerprintSha256,
        demandId: trigger.source.demandId,
        demandFingerprintSha256: trigger.source.demandFingerprintSha256
      })
    }),
    researchMission: projectMission(value)
  });
}

function projectAdmission(
  value: Readonly<MethodImprovementAdmissionSnapshotV1>
): Readonly<MethodImprovementCognitiveReadItemV1> {
  assertBinding(value);
  return value.kind === 'COVERAGE_GAP' ? projectCoverage(value) : projectPerformance(value);
}

export class MethodImprovementCognitiveReadServiceV1 {
  constructor(
    private readonly admissions: Readonly<MethodImprovementAdmissionReadAuthorityV1>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async read(): Promise<MethodImprovementCognitiveReadProjectionV1> {
    try {
      const methodImprovements = (await this.admissions.listAdmissions())
        .map((admission) => projectAdmission(admission))
        .sort((left, right) =>
          left.trigger.admittedAt === right.trigger.admittedAt
            ? left.trigger.triggerId.localeCompare(right.trigger.triggerId)
            : left.trigger.admittedAt.localeCompare(right.trigger.admittedAt)
        );
      const performanceGapAdmissionCount = methodImprovements.filter(
        (item) => item.trigger.triggerType === 'PERFORMANCE_GAP'
      ).length;
      const coverageGapAdmissionCount = methodImprovements.filter(
        (item) => item.trigger.triggerType === 'COVERAGE_GAP'
      ).length;
      return Object.freeze({
        schemaVersion: 1,
        generatedAt: canonicalTimestamp(this.now(), 'generatedAt'),
        source: Object.freeze({
          domain: 'CORE',
          authority: 'METHOD_IMPROVEMENT_ADMISSION',
          availability: 'AVAILABLE'
        }),
        methodImprovements: Object.freeze(methodImprovements),
        brainBuildRuns: Object.freeze({
          availability: 'NOT_DURABLY_RECORDED',
          inventory: null,
          reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
        }),
        summary: Object.freeze({
          methodImprovementAdmissionCount: methodImprovements.length,
          performanceGapAdmissionCount,
          coverageGapAdmissionCount,
          brainBuildRunInventoryAvailable: false
        })
      });
    } catch (error) {
      if (error instanceof MethodImprovementCognitiveReadError) throw error;
      throw new MethodImprovementCognitiveReadError(
        'Method Improvement cognitive owner truth is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
