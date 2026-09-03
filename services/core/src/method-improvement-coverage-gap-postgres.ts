import type { ManagedDatabase, QueryClient } from '@markorbit/persistence';
import {
  MethodImprovementCoverageGapAdmissionError,
  type MethodImprovementCoverageGapAdmissionRepositoryV1,
  type MethodImprovementCoverageGapAdmissionResultV1,
  type PreparedMethodImprovementCoverageGapAdmissionV1
} from './method-improvement-coverage-gap.js';
import {
  parseMethodImprovementCoverageGapResearchMissionV1,
  parseMethodImprovementCoverageGapTriggerV1
} from '@markorbit/contracts/method-improvement-coverage-gap';

type TriggerRow = {
  trigger_id: string;
  workspace_id: string;
  request_fingerprint_sha256: string;
  source_identity_fingerprint_sha256: string;
  replay_key_fingerprint_sha256: string;
  trigger_json: unknown;
};

type MissionRow = {
  research_mission_id: string;
  workspace_id: string;
  trigger_id: string;
  mission_json: unknown;
};

function persistenceFailure(error: unknown): never {
  if (error instanceof MethodImprovementCoverageGapAdmissionError) throw error;
  throw new MethodImprovementCoverageGapAdmissionError(
    'EVIDENCE_UNAVAILABLE',
    'Coverage Gap admission persistence is unavailable.',
    true,
    { cause: error instanceof Error ? error : undefined }
  );
}

async function lock(client: QueryClient, key: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
}

function parseStoredTrigger(value: unknown) {
  try {
    return parseMethodImprovementCoverageGapTriggerV1(value);
  } catch (error) {
    throw new MethodImprovementCoverageGapAdmissionError(
      'EVIDENCE_UNAVAILABLE',
      'Persisted Coverage Gap trigger is malformed.',
      true,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parseStoredMission(value: unknown) {
  try {
    return parseMethodImprovementCoverageGapResearchMissionV1(value);
  } catch (error) {
    throw new MethodImprovementCoverageGapAdmissionError(
      'EVIDENCE_UNAVAILABLE',
      'Persisted Coverage Gap Research Mission is malformed.',
      true,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

async function existingAdmission(
  client: QueryClient,
  input: Readonly<PreparedMethodImprovementCoverageGapAdmissionV1>
): Promise<MethodImprovementCoverageGapAdmissionResultV1 | undefined> {
  const replayKey = input.trigger.admission.replayKeyFingerprintSha256;
  const triggerRows = await client.query<TriggerRow>(
    `SELECT trigger_id,workspace_id,request_fingerprint_sha256,
            source_identity_fingerprint_sha256,replay_key_fingerprint_sha256,trigger_json
       FROM core_method_improvement_coverage_gap_triggers
      WHERE replay_key_fingerprint_sha256=$1
         OR (workspace_id=$2 AND source_identity_fingerprint_sha256=$3)
      ORDER BY trigger_id ASC`,
    [replayKey, input.trigger.workspaceId, input.sourceIdentityFingerprintSha256]
  );
  if (!triggerRows.rows.length) return undefined;

  const identities = new Set(triggerRows.rows.map((row) => row.trigger_id));
  if (identities.size !== 1) {
    throw new MethodImprovementCoverageGapAdmissionError(
      'TRIGGER_CONFLICT',
      'Coverage Gap replay and evidence identities resolve to different durable admissions.'
    );
  }

  const row = triggerRows.rows[0]!;
  if (
    row.workspace_id !== input.trigger.workspaceId ||
    row.request_fingerprint_sha256 !== input.requestFingerprintSha256 ||
    row.source_identity_fingerprint_sha256 !== input.sourceIdentityFingerprintSha256 ||
    row.replay_key_fingerprint_sha256 !== replayKey
  ) {
    throw new MethodImprovementCoverageGapAdmissionError(
      'TRIGGER_CONFLICT',
      'Coverage Gap durable replay identity is already bound to materially different admission content.'
    );
  }

  const missionRows = await client.query<MissionRow>(
    `SELECT research_mission_id,workspace_id,trigger_id,mission_json
       FROM core_method_improvement_coverage_gap_research_missions
      WHERE workspace_id=$1 AND trigger_id=$2`,
    [input.trigger.workspaceId, row.trigger_id]
  );
  if (missionRows.rows.length !== 1) {
    throw new MethodImprovementCoverageGapAdmissionError(
      'EVIDENCE_UNAVAILABLE',
      'Coverage Gap durable replay is missing its exact Research Mission.',
      true
    );
  }

  const missionRow = missionRows.rows[0]!;
  if (
    missionRow.workspace_id !== input.trigger.workspaceId ||
    missionRow.trigger_id !== row.trigger_id
  ) {
    throw new MethodImprovementCoverageGapAdmissionError(
      'EVIDENCE_UNAVAILABLE',
      'Persisted Coverage Gap Research Mission lineage is inconsistent.',
      true
    );
  }

  const trigger = parseStoredTrigger(row.trigger_json);
  const researchMission = parseStoredMission(missionRow.mission_json);
  if (
    trigger.triggerFingerprintSha256 !== input.trigger.triggerFingerprintSha256 ||
    researchMission.missionFingerprintSha256 !== input.researchMission.missionFingerprintSha256 ||
    researchMission.triggerFingerprintSha256 !== trigger.triggerFingerprintSha256
  ) {
    throw new MethodImprovementCoverageGapAdmissionError(
      'TRIGGER_CONFLICT',
      'Persisted Coverage Gap admission fingerprints do not match the requested exact replay.'
    );
  }

  return { trigger, researchMission, replayed: true };
}

function targetColumns(input: Readonly<PreparedMethodImprovementCoverageGapAdmissionV1>) {
  const target = input.trigger.target;
  if (target.kind === 'EXISTING_METHOD') {
    return {
      targetKind: target.kind,
      predecessorMethodPackageRef: target.predecessor.methodPackageRef,
      predecessorMethodRef: target.predecessor.methodRef,
      predecessorMethodVersionRef: target.predecessor.methodVersionRef,
      predecessorEvaluationRef: target.predecessor.evaluationRef,
      predecessorPackageFingerprintSha256: target.predecessor.packageFingerprintSha256 ?? null,
      targetDemandId: null,
      targetDemandFingerprintSha256: null
    };
  }
  return {
    targetKind: target.kind,
    predecessorMethodPackageRef: null,
    predecessorMethodRef: null,
    predecessorMethodVersionRef: null,
    predecessorEvaluationRef: null,
    predecessorPackageFingerprintSha256: null,
    targetDemandId: target.demandId,
    targetDemandFingerprintSha256: target.demandFingerprintSha256
  };
}

async function insertAdmission(
  client: QueryClient,
  input: Readonly<PreparedMethodImprovementCoverageGapAdmissionV1>
): Promise<MethodImprovementCoverageGapAdmissionResultV1> {
  const target = targetColumns(input);
  const source = input.trigger.source;
  await client.query(
    `INSERT INTO core_method_improvement_coverage_gap_triggers(
       trigger_id,workspace_id,trigger_type,target_kind,
       predecessor_method_package_ref,predecessor_method_ref,predecessor_method_version_ref,
       predecessor_evaluation_ref,predecessor_package_fingerprint_sha256,
       target_demand_id,target_demand_fingerprint_sha256,
       source_evidence_id,source_evidence_fingerprint_sha256,source_audit_fingerprint_sha256,
       source_candidate_id,source_candidate_fingerprint_sha256,source_coverage_status,
       source_demand_id,source_demand_fingerprint_sha256,source_identity_fingerprint_sha256,
       request_fingerprint_sha256,replay_key_fingerprint_sha256,trigger_fingerprint_sha256,
       idempotency_key,correlation_id,created_by_principal_id,trigger_json,admitted_at
     ) VALUES(
       $1,$2,'COVERAGE_GAP',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
       $19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27
     )`,
    [
      input.trigger.triggerId,
      input.trigger.workspaceId,
      target.targetKind,
      target.predecessorMethodPackageRef,
      target.predecessorMethodRef,
      target.predecessorMethodVersionRef,
      target.predecessorEvaluationRef,
      target.predecessorPackageFingerprintSha256,
      target.targetDemandId,
      target.targetDemandFingerprintSha256,
      source.evidenceId,
      source.evidenceFingerprintSha256,
      source.sourceAuditFingerprintSha256,
      source.candidateId,
      source.candidateFingerprintSha256,
      source.coverageStatus,
      source.demandId,
      source.demandFingerprintSha256,
      input.sourceIdentityFingerprintSha256,
      input.requestFingerprintSha256,
      input.trigger.admission.replayKeyFingerprintSha256,
      input.trigger.triggerFingerprintSha256,
      input.idempotencyKey,
      input.correlationId,
      input.trigger.createdByPrincipalId,
      JSON.stringify(input.trigger),
      input.trigger.admittedAt
    ]
  );

  await client.query(
    `INSERT INTO core_method_improvement_coverage_gap_research_missions(
       research_mission_id,workspace_id,trigger_id,trigger_fingerprint_sha256,
       mission_fingerprint_sha256,target_kind,source_evidence_id,
       source_evidence_fingerprint_sha256,created_by_principal_id,mission_json,created_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
    [
      input.researchMission.researchMissionId,
      input.researchMission.workspaceId,
      input.researchMission.triggerId,
      input.researchMission.triggerFingerprintSha256,
      input.researchMission.missionFingerprintSha256,
      input.researchMission.target.kind,
      input.researchMission.source.evidenceId,
      input.researchMission.source.evidenceFingerprintSha256,
      input.researchMission.createdByPrincipalId,
      JSON.stringify(input.researchMission),
      input.researchMission.createdAt
    ]
  );

  return {
    trigger: structuredClone(input.trigger),
    researchMission: structuredClone(input.researchMission),
    replayed: false
  };
}

export class PostgresMethodImprovementCoverageGapAdmissionRepositoryV1 implements MethodImprovementCoverageGapAdmissionRepositoryV1 {
  constructor(private readonly database: ManagedDatabase) {}

  async admit(
    input: Readonly<PreparedMethodImprovementCoverageGapAdmissionV1>
  ): Promise<MethodImprovementCoverageGapAdmissionResultV1> {
    try {
      return await this.database.transact(async (client) => {
        const replayKey = input.trigger.admission.replayKeyFingerprintSha256;
        await lock(client, `coverage-gap:replay:${replayKey}`);
        await lock(
          client,
          `coverage-gap:source:${input.trigger.workspaceId}:${input.sourceIdentityFingerprintSha256}`
        );

        const existing = await existingAdmission(client, input);
        if (existing) return existing;
        return insertAdmission(client, input);
      });
    } catch (error) {
      persistenceFailure(error);
    }
  }
}
