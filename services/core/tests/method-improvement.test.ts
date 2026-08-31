import { describe, expect, it, vi } from 'vitest';
import {
  MethodImprovementAdmissionError,
  MethodImprovementAdmissionServiceV1,
  type MethodImprovementAdmissionRepositoryV1,
  type PreparedMethodImprovementAdmissionV1
} from '../src/method-improvement.js';
import type { MethodOutcomeReportV1 } from '../src/method-outcome-report.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const predecessor = {
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodRef: 'brain-method:method_cn-duration',
  methodVersionRef: 'brain-method-version:method-version_cn-duration',
  evaluationRef: 'brain-method-evaluation:evaluation_cn-duration'
} as const;
const watermark = {
  admissionSequence: 7,
  methodOutcomeEvidenceId: 'method-outcome-evidence_phase7-unit-7'
} as const;

function mission(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    missionId: 'brain-research-mission_phase7-cn-duration-unit',
    capabilityDemand: 'Improve the governed CN completed-duration historical-band method.',
    problem: 'Research bounded reproducible causes for an admitted Phase 6 METHOD_ERROR signal.',
    targetMethodFamily: 'CLASSIFICATION',
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
    knowledgeResearchPlan: ['Resolve exact authoritative CN duration sources.'],
    dataEngineResearchPlan: ['Rebuild the accepted reproducible CN duration cohort.'],
    hypotheses: ['A bounded duration-band edge case may explain the reviewed method error.'],
    featurePlan: ['Evaluate deterministic completed-duration features only.'],
    evaluationPlan: ['Compare a candidate with the exact predecessor on reproducible inputs.'],
    successMetrics: ['bounded predecessor comparison'],
    baselineMetrics: ['brain-method-evaluation:evaluation_cn-duration'],
    createdAt: '2026-08-31T04:10:00.000Z',
    ...overrides
  };
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    workspaceId,
    triggerType: 'PERFORMANCE_GAP',
    predecessor,
    reportQuery: {
      schemaVersion: 1,
      workspaceId,
      methodPackageRef: predecessor.methodPackageRef,
      methodVersionRef: predecessor.methodVersionRef,
      watermark
    },
    reason: 'Explicit bounded Phase 7 performance-gap research trigger.',
    createdByPrincipalId: 'principal_phase7-governance',
    mission: mission(),
    ...overrides
  };
}

function report(
  overrides: Partial<MethodOutcomeReportV1> = {}
): MethodOutcomeReportV1 {
  return {
    schemaVersion: 1,
    workspaceId,
    methodPackageRef: predecessor.methodPackageRef,
    methodVersionRef: predecessor.methodVersionRef,
    watermark,
    admittedReviews: 1,
    confirmed: { count: 0, rate: 0 },
    overridden: { count: 1, rate: 1 },
    methodError: { count: 1, rate: 1 },
    inputDataError: { count: 0, rate: 0 },
    applicabilityError: { count: 0, rate: 0 },
    productUserPreference: { count: 0, rate: 0 },
    inconclusive: { count: 0, rate: 0 },
    sampleEvidenceRefs: [
      {
        admissionSequence: 7,
        methodOutcomeEvidenceId: watermark.methodOutcomeEvidenceId,
        reviewId: 'matter-intelligence-review_phase7-unit',
        reviewVersion: 1,
        outcome: 'OVERRIDDEN',
        reason: 'METHOD_ERROR',
        admittedAt: '2026-08-31T04:09:00.000Z'
      }
    ],
    ...overrides
  };
}

class ReplayRepository implements MethodImprovementAdmissionRepositoryV1 {
  first?: PreparedMethodImprovementAdmissionV1;

  async admit(input: Readonly<PreparedMethodImprovementAdmissionV1>) {
    if (!this.first) {
      this.first = structuredClone(input);
      return {
        trigger: input.trigger,
        researchMission: input.researchMission,
        replayed: false
      };
    }
    if (
      this.first.idempotencyKey !== input.idempotencyKey ||
      this.first.sourceIdentityFingerprintSha256 !== input.sourceIdentityFingerprintSha256 ||
      this.first.requestFingerprintSha256 !== input.requestFingerprintSha256
    )
      throw new MethodImprovementAdmissionError(
        'TRIGGER_CONFLICT',
        'Immutable Method Improvement request conflicts with the admitted source.'
      );
    return {
      trigger: this.first.trigger,
      researchMission: this.first.researchMission,
      replayed: true
    };
  }
}

function service(
  options: {
    resolved?: MethodOutcomeReportV1;
    repository?: MethodImprovementAdmissionRepositoryV1;
  } = {}
) {
  const reports = {
    report: vi.fn(() => Promise.resolve(options.resolved ?? report()))
  };
  const repository = options.repository ?? new ReplayRepository();
  return {
    reports,
    repository,
    service: new MethodImprovementAdmissionServiceV1({
      repository,
      reports,
      now: () => '2026-08-31T04:11:00.000Z',
      triggerIdFactory: () => 'phase7-unit-trigger',
      researchMissionIdFactory: () => 'phase7-unit-mission'
    })
  };
}

const request = (body: unknown = command()) => ({
  workspaceId,
  idempotencyKey: 'phase7-unit-key',
  correlationId: 'phase7-unit-correlation',
  command: body
});

describe('Method Improvement performance-gap admission', () => {
  it('binds an exact qualifying Phase 6 report to one trigger and research mission', async () => {
    const fixture = service();
    const result = await fixture.service.admit(request());

    expect(result.replayed).toBe(false);
    expect(result.trigger.triggerType).toBe('PERFORMANCE_GAP');
    expect(result.trigger.predecessor).toEqual(predecessor);
    expect(result.trigger.source.query.watermark).toEqual(watermark);
    expect(result.trigger.source.counts.methodError).toBe(1);
    expect(result.researchMission.triggerId).toBe(result.trigger.triggerId);
    expect(result.researchMission.predecessor).toEqual(predecessor);
    expect(fixture.reports.report).toHaveBeenCalledWith({
      workspaceId,
      query: command().reportQuery
    });
  });

  it('fails closed for no METHOD_ERROR or zero admitted reviews before persistence', async () => {
    const noMethodErrorRepository = { admit: vi.fn() };
    const noMethodError = service({
      resolved: report({
        confirmed: { count: 1, rate: 1 },
        overridden: { count: 0, rate: 0 },
        methodError: { count: 0, rate: 0 },
        sampleEvidenceRefs: []
      }),
      repository: noMethodErrorRepository
    });
    await expect(noMethodError.service.admit(request())).rejects.toMatchObject({
      code: 'INSUFFICIENT_EVIDENCE'
    });
    expect(noMethodErrorRepository.admit).not.toHaveBeenCalled();

    const emptyRepository = { admit: vi.fn() };
    const empty = service({
      resolved: report({
        admittedReviews: 0,
        confirmed: { count: 0, rate: 0 },
        overridden: { count: 0, rate: 0 },
        methodError: { count: 0, rate: 0 },
        sampleEvidenceRefs: []
      }),
      repository: emptyRepository
    });
    await expect(empty.service.admit(request())).rejects.toMatchObject({
      code: 'INSUFFICIENT_EVIDENCE'
    });
    expect(emptyRepository.admit).not.toHaveBeenCalled();
  });

  it('fails trusted workspace mismatch before report execution', async () => {
    const fixture = service();
    await expect(
      fixture.service.admit({
        ...request(),
        workspaceId: '22222222-2222-4222-8222-222222222222'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    expect(fixture.reports.report).not.toHaveBeenCalled();
  });

  it('fails exact report or watermark mismatch before persistence', async () => {
    const repository = { admit: vi.fn() };
    const fixture = service({
      resolved: report({
        watermark: {
          admissionSequence: 8,
          methodOutcomeEvidenceId: 'method-outcome-evidence_phase7-unit-8'
        }
      }),
      repository
    });
    await expect(fixture.service.admit(request())).rejects.toMatchObject({
      code: 'REPORT_MISMATCH'
    });
    expect(repository.admit).not.toHaveBeenCalled();
  });

  it('rejects a direct service command outside the frozen Pilot A predecessor refs', async () => {
    const fixture = service();
    await expect(
      fixture.service.admit(
        request(
          command({
            predecessor: {
              ...predecessor,
              methodRef: 'brain-method:method_cn-duration-other'
            }
          })
        )
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fixture.reports.report).not.toHaveBeenCalled();
  });

  it('replays the exact immutable request and returns the original records', async () => {
    const fixture = service();
    const first = await fixture.service.admit(request());
    const replay = await fixture.service.admit(request());

    expect(replay.replayed).toBe(true);
    expect(replay.trigger).toEqual(first.trigger);
    expect(replay.researchMission).toEqual(first.researchMission);
  });

  it('fails closed when the same source is reused with a different mission plan', async () => {
    const fixture = service();
    await fixture.service.admit(request());

    await expect(
      fixture.service.admit(
        request(
          command({
            mission: mission({
              hypotheses: [
                'A materially different hypothesis must be a conflicting immutable request.'
              ]
            })
          })
        )
      )
    ).rejects.toMatchObject({ code: 'TRIGGER_CONFLICT' });
  });
});
