import { describe, expect, it, vi } from 'vitest';
import {
  MethodImprovementCognitiveReadError,
  MethodImprovementCognitiveReadServiceV1
} from '../src/method-improvement-cognitive-read.js';
import type { MethodImprovementAdmissionSnapshotV1 } from '../src/method-improvement-cognitive-read-postgres.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const predecessor = {
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodRef: 'brain-method:method_cn-duration',
  methodVersionRef: 'brain-method-version:method-version_cn-duration',
  evaluationRef: 'brain-method-evaluation:evaluation_cn-duration',
  packageFingerprintSha256: '1'.repeat(64)
};

function privateMission(createdAt: string) {
  return {
    schemaVersion: 1 as const,
    missionId: 'brain-research-mission_private',
    capabilityDemand: 'Private research demand.',
    problem: 'Private research problem.',
    targetMethodFamily: 'CLASSIFICATION' as const,
    applicabilityTarget: {
      jurisdictions: ['CN'],
      authorities: ['CNIPA'],
      objectTypes: ['TRADEMARK_CASE'],
      operations: ['DURATION_BAND_CLASSIFICATION'],
      procedures: ['COMPLETED_CASE_RESEARCH'],
      stages: ['COMPLETED'],
      filingBases: ['NOT_APPLICABLE'],
      segments: ['HISTORICAL_BAND'],
      requiredData: ['COMPLETED_DURATION_FACTS'],
      effectiveFrom: '2026-08-31T00:00:00.000Z'
    },
    knowledgeResearchPlan: ['Private knowledge research plan.'],
    dataEngineResearchPlan: ['Private data research plan.'],
    hypotheses: ['Private hypothesis.'],
    featurePlan: ['Private feature plan.'],
    evaluationPlan: ['Private evaluation plan.'],
    successMetrics: ['Private success metric.'],
    baselineMetrics: ['brain-method-evaluation:evaluation_cn-duration'],
    createdAt
  };
}

function performanceAdmission(
  triggerId = 'method-improvement-trigger_alpha',
  admittedAt = '2026-08-31T04:22:00.000Z'
): MethodImprovementAdmissionSnapshotV1 {
  return {
    kind: 'PERFORMANCE_GAP',
    trigger: {
      schemaVersion: 1,
      triggerId,
      workspaceId,
      triggerType: 'PERFORMANCE_GAP',
      predecessor,
      source: {
        kind: 'CORE_METHOD_OUTCOME_REPORT_V1',
        query: {
          schemaVersion: 1,
          workspaceId,
          methodPackageRef: predecessor.methodPackageRef,
          methodVersionRef: predecessor.methodVersionRef,
          watermark: {
            admissionSequence: 7,
            methodOutcomeEvidenceId: 'method-outcome-evidence_alpha'
          }
        },
        admittedReviews: 1,
        counts: {
          confirmed: 0,
          overridden: 1,
          inconclusive: 0,
          methodError: 1,
          inputDataError: 0,
          applicabilityError: 0,
          productUserPreference: 0
        },
        sampleEvidenceRefs: [
          {
            admissionSequence: 7,
            methodOutcomeEvidenceId: 'method-outcome-evidence_alpha',
            reviewId: 'matter-intelligence-review_alpha',
            reviewVersion: 1,
            outcome: 'OVERRIDDEN',
            reason: 'METHOD_ERROR',
            admittedAt: '2026-08-31T04:20:30.000Z'
          }
        ],
        reportFingerprintSha256: '2'.repeat(64)
      },
      reason: 'Private governance rationale must not be projected.',
      createdByPrincipalId: 'principal_private-governance',
      triggerFingerprintSha256: '3'.repeat(64),
      admittedAt
    },
    researchMission: {
      schemaVersion: 1,
      researchMissionId: `method-improvement-research-mission_${triggerId.split('_').at(-1)}`,
      workspaceId,
      triggerId,
      triggerFingerprintSha256: '3'.repeat(64),
      predecessor,
      mission: privateMission(admittedAt),
      missionFingerprintSha256: '4'.repeat(64),
      createdByPrincipalId: 'principal_private-governance',
      createdAt: admittedAt
    }
  } as MethodImprovementAdmissionSnapshotV1;
}

function coverageAdmission(
  triggerId = 'method-improvement-trigger_coverage',
  admittedAt = '2026-09-01T00:00:00.000Z'
): MethodImprovementAdmissionSnapshotV1 {
  const evidenceFingerprintSha256 = 'a'.repeat(64);
  const demandFingerprintSha256 = 'd'.repeat(64);
  const source = {
    kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1' as const,
    classification: 'COVERAGE_GAP_EVIDENCE' as const,
    phase7AdmissionStatus: 'NOT_ADMITTED' as const,
    sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1' as const,
    evidenceId: `capability-coverage-gap-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256,
    sourceAuditFingerprintSha256: 'b'.repeat(64),
    candidateId: `capability-coverage-gap-candidate_${'c'.repeat(64)}`,
    candidateFingerprintSha256: 'c'.repeat(64),
    coverageStatus: 'MISSING_RUNTIME_CAPABILITY' as const,
    demandId: `capability-demand_${demandFingerprintSha256}`,
    demandFingerprintSha256
  };
  const target = {
    kind: 'NEW_CAPABILITY_METHOD_DEMAND' as const,
    demandId: source.demandId,
    demandFingerprintSha256
  };
  return {
    kind: 'COVERAGE_GAP',
    trigger: {
      schemaVersion: 1,
      triggerId,
      workspaceId,
      triggerType: 'COVERAGE_GAP',
      target,
      source,
      admission: {
        kind: 'EXPLICIT_CORE_GOVERNANCE_ADMISSION',
        idempotencyKey: 'private-idempotency-key',
        sourceEvidenceResolution: 'EXACT_EVIDENCE_VERIFIED',
        replayKeyFingerprintSha256: '5'.repeat(64)
      },
      reason: 'Private Coverage Gap rationale must not be projected.',
      createdByPrincipalId: 'principal_private-governance',
      authorityConsequences: {
        methodImprovementTriggerRecorded: true,
        coverageEvidenceAdmissionStatusMutated: false,
        researchMissionCreated: false,
        methodImprovementCandidateCreated: false,
        methodActivated: false,
        runtimeCapabilityCreated: false,
        implementationApproved: false,
        arbitraryAiExecutionAuthorized: false,
        productStateCreated: false,
        officialTruthCreated: false,
        filingAuthorized: false,
        paymentAuthorized: false,
        providerAuthorityCreated: false
      },
      triggerFingerprintSha256: '6'.repeat(64),
      admittedAt
    },
    researchMission: {
      schemaVersion: 1,
      researchMissionId: 'method-improvement-research-mission_coverage',
      workspaceId,
      triggerId,
      triggerFingerprintSha256: '6'.repeat(64),
      target,
      source,
      mission: privateMission(admittedAt),
      missionFingerprintSha256: '7'.repeat(64),
      createdByPrincipalId: 'principal_private-governance',
      createdAt: admittedAt
    }
  } as MethodImprovementAdmissionSnapshotV1;
}

describe('bounded Method Improvement cognitive read projection', () => {
  it('projects both durable admission families in deterministic order while redacting private bodies', async () => {
    const service = new MethodImprovementCognitiveReadServiceV1(
      {
        listAdmissions: vi.fn(() =>
          Promise.resolve([
            coverageAdmission(),
            performanceAdmission('method-improvement-trigger_alpha', '2026-08-31T04:22:00.000Z')
          ])
        )
      },
      () => '2026-09-04T16:20:00.000Z'
    );

    const projection = await service.read();
    expect(projection.methodImprovements.map((item) => item.trigger.triggerType)).toEqual([
      'PERFORMANCE_GAP',
      'COVERAGE_GAP'
    ]);
    expect(projection.methodImprovements[1]).toMatchObject({
      trigger: {
        triggerType: 'COVERAGE_GAP',
        target: { kind: 'NEW_CAPABILITY_METHOD_DEMAND' },
        source: {
          kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1',
          coverageStatus: 'MISSING_RUNTIME_CAPABILITY'
        }
      }
    });
    expect(projection.brainBuildRuns).toEqual({
      availability: 'NOT_DURABLY_RECORDED',
      inventory: null,
      reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
    });
    expect(projection.summary).toEqual({
      methodImprovementAdmissionCount: 2,
      performanceGapAdmissionCount: 1,
      coverageGapAdmissionCount: 1,
      brainBuildRunInventoryAvailable: false
    });

    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain(workspaceId);
    expect(serialized).not.toContain('Private governance rationale');
    expect(serialized).not.toContain('Private Coverage Gap rationale');
    expect(serialized).not.toContain('principal_private-governance');
    expect(serialized).not.toContain('Private hypothesis');
    expect(serialized).not.toContain('matter-intelligence-review_alpha');
    expect(serialized).not.toContain('sampleEvidenceRefs');
    expect(serialized).not.toContain('admittedReviews');
    expect(serialized).not.toContain('counts');
    expect(serialized).not.toContain('private-idempotency-key');
  });

  it('treats a successful empty owner read as a valid empty inventory', async () => {
    const service = new MethodImprovementCognitiveReadServiceV1(
      { listAdmissions: vi.fn(() => Promise.resolve([])) },
      () => '2026-09-04T16:20:00.000Z'
    );

    await expect(service.read()).resolves.toMatchObject({
      methodImprovements: [],
      brainBuildRuns: { availability: 'NOT_DURABLY_RECORDED', inventory: null },
      summary: {
        methodImprovementAdmissionCount: 0,
        performanceGapAdmissionCount: 0,
        coverageGapAdmissionCount: 0,
        brainBuildRunInventoryAvailable: false
      }
    });
  });

  it('fails closed when durable Method Improvement owner truth is unavailable', async () => {
    const service = new MethodImprovementCognitiveReadServiceV1({
      listAdmissions: vi.fn(() => Promise.reject(new Error('database unavailable')))
    });

    await expect(service.read()).rejects.toBeInstanceOf(MethodImprovementCognitiveReadError);
  });

  it('fails closed on drifted trigger to mission lineage', async () => {
    const drifted = performanceAdmission();
    const service = new MethodImprovementCognitiveReadServiceV1({
      listAdmissions: vi.fn(() =>
        Promise.resolve([
          {
            ...drifted,
            researchMission: {
              ...drifted.researchMission,
              triggerId: 'method-improvement-trigger_drifted'
            }
          } as MethodImprovementAdmissionSnapshotV1
        ])
      )
    });

    await expect(service.read()).rejects.toBeInstanceOf(MethodImprovementCognitiveReadError);
  });
});
