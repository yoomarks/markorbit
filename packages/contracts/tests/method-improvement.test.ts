import { describe, expect, it } from 'vitest';
import {
  assertMethodImprovementMissionBinding,
  parseMethodImprovementResearchMissionV1,
  parseMethodImprovementTriggerV1
} from '../src/method-improvement.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const predecessor = {
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodRef: 'brain-method:method_cn-duration',
  methodVersionRef: 'brain-method-version:method-version_cn-duration',
  evaluationRef: 'brain-method-evaluation:evaluation_cn-duration'
} as const;

const mission = {
  schemaVersion: 1,
  missionId: 'brain-research-mission_phase7-cn-duration-gap',
  capabilityDemand: 'Improve the governed CN completed-duration historical-band method.',
  problem: 'Research bounded reproducible causes for the admitted Phase 6 METHOD_ERROR signal.',
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
  knowledgeResearchPlan: [
    'Resolve bounded authoritative CN duration sources with exact lineage.'
  ],
  dataEngineResearchPlan: ['Rebuild the accepted reproducible CN duration research cohort.'],
  hypotheses: [
    'The admitted method error may be explained by a bounded duration-band edge case.'
  ],
  featurePlan: [
    'Evaluate only deterministic completed-duration features already allowed by the method family.'
  ],
  evaluationPlan: [
    'Compare a candidate against the exact predecessor on a reproducible bounded cohort.'
  ],
  successMetrics: ['bounded predecessor comparison'],
  baselineMetrics: ['brain-method-evaluation:evaluation_cn-duration'],
  createdAt: '2026-08-31T04:00:00.000Z'
} as const;

function trigger() {
  return {
    schemaVersion: 1,
    triggerId: 'method-improvement-trigger_phase7-contract',
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
          methodOutcomeEvidenceId: 'method-outcome-evidence_phase7-contract'
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
          methodOutcomeEvidenceId: 'method-outcome-evidence_phase7-contract',
          reviewId: 'matter-intelligence-review_phase7-contract',
          reviewVersion: 1,
          outcome: 'OVERRIDDEN',
          reason: 'METHOD_ERROR',
          admittedAt: '2026-08-31T03:59:00.000Z'
        }
      ],
      reportFingerprintSha256: 'a'.repeat(64)
    },
    reason: 'Explicitly admit a bounded performance research trigger.',
    createdByPrincipalId: 'principal_phase7-governance',
    triggerFingerprintSha256: 'b'.repeat(64),
    admittedAt: '2026-08-31T04:00:00.000Z'
  } as const;
}

function wrapper() {
  return {
    schemaVersion: 1,
    researchMissionId: 'method-improvement-research-mission_phase7-contract',
    workspaceId,
    triggerId: trigger().triggerId,
    triggerFingerprintSha256: trigger().triggerFingerprintSha256,
    predecessor,
    mission,
    missionFingerprintSha256: 'c'.repeat(64),
    createdByPrincipalId: trigger().createdByPrincipalId,
    createdAt: mission.createdAt
  } as const;
}

describe('Method Improvement V1 contracts', () => {
  it('accepts the frozen PERFORMANCE_GAP trigger and exact mission wrapper', () => {
    const parsedTrigger = parseMethodImprovementTriggerV1(trigger());
    const parsedMission = parseMethodImprovementResearchMissionV1(wrapper());

    expect(parsedTrigger.triggerType).toBe('PERFORMANCE_GAP');
    expect(parsedTrigger.source.counts.methodError).toBe(1);
    expect(parsedMission.mission.targetMethodFamily).toBe('CLASSIFICATION');
    expect(() =>
      assertMethodImprovementMissionBinding(parsedTrigger, parsedMission)
    ).not.toThrow();
  });

  it('rejects extra unbounded product/customer snapshot fields', () => {
    expect(() =>
      parseMethodImprovementTriggerV1({
        ...trigger(),
        formalMatter: { id: 'formal-matter_forbidden' }
      })
    ).toThrow(/unsupported fields/u);
    expect(() =>
      parseMethodImprovementTriggerV1({
        ...trigger(),
        source: {
          ...trigger().source,
          customerSnapshot: { customerId: 'customer_forbidden' }
        }
      })
    ).toThrow(/unsupported fields/u);
  });

  it('rejects non-pilot taxonomy runtime admission', () => {
    expect(() =>
      parseMethodImprovementTriggerV1({
        ...trigger(),
        triggerType: 'CAPABILITY_GAP'
      })
    ).toThrow(/PERFORMANCE_GAP only/u);
    expect(() =>
      parseMethodImprovementTriggerV1({
        ...trigger(),
        triggerType: 'AUTONOMOUS_RETRAIN'
      })
    ).toThrow(/triggerType is invalid/u);
  });

  it('rejects malformed or missing exact watermark identity', () => {
    expect(() =>
      parseMethodImprovementTriggerV1({
        ...trigger(),
        source: {
          ...trigger().source,
          query: {
            ...trigger().source.query,
            watermark: {
              admissionSequence: 0,
              methodOutcomeEvidenceId: 'method-outcome-evidence_phase7-contract'
            }
          }
        }
      })
    ).toThrow(/positive safe integer/u);
    const sourceWithoutWatermark = {
      ...trigger().source,
      query: {
        schemaVersion: 1,
        workspaceId,
        methodPackageRef: predecessor.methodPackageRef,
        methodVersionRef: predecessor.methodVersionRef
      }
    };
    expect(() =>
      parseMethodImprovementTriggerV1({
        ...trigger(),
        source: sourceWithoutWatermark
      })
    ).toThrow(/watermark must be an object/u);
  });

  it('rejects predecessor/report package or version drift', () => {
    expect(() =>
      parseMethodImprovementTriggerV1({
        ...trigger(),
        predecessor: {
          ...predecessor,
          methodVersionRef: 'brain-method-version:method-version_cn-duration-v2'
        }
      })
    ).toThrow(/source query must match predecessor/u);
  });

  it('rejects more than 20 bounded sample evidence refs', () => {
    const sample = trigger().source.sampleEvidenceRefs[0];
    expect(() =>
      parseMethodImprovementTriggerV1({
        ...trigger(),
        source: {
          ...trigger().source,
          sampleEvidenceRefs: Array.from({ length: 21 }, (_, index) => ({
            ...sample,
            admissionSequence: index + 1,
            methodOutcomeEvidenceId: `method-outcome-evidence_phase7-contract-${index + 1}`
          }))
        }
      })
    ).toThrow(/at most 20/u);
  });

  it('rejects mission trigger or predecessor binding mismatch', () => {
    const parsedTrigger = parseMethodImprovementTriggerV1(trigger());
    const wrongTrigger = parseMethodImprovementResearchMissionV1({
      ...wrapper(),
      triggerId: 'method-improvement-trigger_other'
    });
    expect(() => assertMethodImprovementMissionBinding(parsedTrigger, wrongTrigger)).toThrow(
      /does not match/u
    );

    const wrongPredecessor = parseMethodImprovementResearchMissionV1({
      ...wrapper(),
      predecessor: {
        ...predecessor,
        evaluationRef: 'brain-method-evaluation:evaluation_other'
      }
    });
    expect(() =>
      assertMethodImprovementMissionBinding(parsedTrigger, wrongPredecessor)
    ).toThrow(/does not match/u);
  });
});
