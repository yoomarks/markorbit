import { describe, expect, it } from 'vitest';
import { parseMethodImprovementTriggerV1 } from '../src/method-improvement.js';
import {
  assertMethodImprovementCoverageGapMissionBinding,
  methodImprovementCoverageGapMissionFingerprintV1,
  methodImprovementCoverageGapNoDownstreamAuthority,
  methodImprovementCoverageGapReplayKeyFingerprintV1,
  methodImprovementCoverageGapTriggerFingerprintV1,
  parseMethodImprovementAnyTriggerV1,
  parseMethodImprovementCoverageGapEvidenceSourceV1,
  parseMethodImprovementCoverageGapResearchMissionV1,
  parseMethodImprovementCoverageGapTriggerV1,
  type MethodImprovementCoverageGapStatusV1
} from '../src/method-improvement-coverage-gap.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const createdByPrincipalId = 'principal_phase7-coverage-governance';
const demandFingerprintSha256 = 'd'.repeat(64);
const candidateFingerprintSha256 = 'c'.repeat(64);
const evidenceFingerprintSha256 = 'e'.repeat(64);
const sourceAuditFingerprintSha256 = 'a'.repeat(64);
const demandId = `capability-demand_${demandFingerprintSha256}` as const;

const predecessor = {
  methodPackageRef: 'brain-method-package:package_existing-coverage@1',
  methodRef: 'brain-method:method_existing-coverage',
  methodVersionRef: 'brain-method-version:method-version_existing-coverage',
  evaluationRef: 'brain-method-evaluation:evaluation_existing-coverage'
} as const;

const mission = {
  schemaVersion: 1,
  missionId: 'brain-research-mission_phase7-coverage-gap',
  capabilityDemand: 'Research the bounded governed capability coverage demand.',
  problem: 'Resolve a governed research-eligible capability coverage gap without inventing authority.',
  targetMethodFamily: 'CLASSIFICATION',
  applicabilityTarget: {
    jurisdictions: ['CN'],
    authorities: ['CNIPA'],
    objectTypes: ['TRADEMARK_CASE'],
    operations: ['CAPABILITY_COVERAGE_RESEARCH'],
    procedures: ['GOVERNED_RESEARCH'],
    stages: ['PREPARATION'],
    filingBases: ['NOT_APPLICABLE'],
    segments: ['COVERAGE_GAP'],
    requiredData: ['GOVERNED_COVERAGE_EVIDENCE'],
    effectiveFrom: '2026-09-01T00:00:00.000Z'
  },
  knowledgeResearchPlan: ['Resolve bounded authoritative sources for the exact capability demand.'],
  dataEngineResearchPlan: ['Evaluate only reproducible evidence required by the bounded demand.'],
  hypotheses: ['The admitted coverage gap may require a governed capability or method addition.'],
  featurePlan: ['Do not create arbitrary model execution or product state.'],
  evaluationPlan: ['Evaluate a future candidate against the exact admitted coverage demand.'],
  successMetrics: ['bounded coverage demand evaluation'],
  baselineMetrics: ['capability-coverage-gap-evidence baseline'],
  createdAt: '2026-09-01T04:00:00.000Z'
} as const;

function source(status: MethodImprovementCoverageGapStatusV1 = 'MISSING_RUNTIME_CAPABILITY') {
  return {
    kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1',
    classification: 'COVERAGE_GAP_EVIDENCE',
    phase7AdmissionStatus: 'NOT_ADMITTED',
    sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1',
    evidenceId: `capability-coverage-gap-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256,
    sourceAuditFingerprintSha256,
    candidateId: `capability-coverage-gap-candidate_${candidateFingerprintSha256}`,
    candidateFingerprintSha256,
    coverageStatus: status,
    demandId,
    demandFingerprintSha256
  } as const;
}

const newDemandTarget = {
  kind: 'NEW_CAPABILITY_METHOD_DEMAND',
  demandId,
  demandFingerprintSha256
} as const;

const existingMethodTarget = {
  kind: 'EXISTING_METHOD',
  predecessor
} as const;

function trigger(options?: {
  status?: MethodImprovementCoverageGapStatusV1;
  target?: typeof newDemandTarget | typeof existingMethodTarget;
}) {
  const exactSource = source(options?.status);
  const target = options?.target ?? newDemandTarget;
  const admission = {
    kind: 'EXPLICIT_CORE_GOVERNANCE_ADMISSION',
    idempotencyKey: 'coverage-gap-admission-key',
    sourceEvidenceResolution: 'EXACT_EVIDENCE_VERIFIED',
    replayKeyFingerprintSha256: methodImprovementCoverageGapReplayKeyFingerprintV1({
      workspaceId,
      evidenceId: exactSource.evidenceId,
      evidenceFingerprintSha256: exactSource.evidenceFingerprintSha256,
      idempotencyKey: 'coverage-gap-admission-key',
      createdByPrincipalId
    })
  } as const;
  const base = {
    schemaVersion: 1,
    workspaceId,
    triggerType: 'COVERAGE_GAP',
    target,
    source: exactSource,
    admission,
    reason: 'Explicitly admit one governed research-eligible Coverage Gap evidence envelope.',
    createdByPrincipalId,
    authorityConsequences: methodImprovementCoverageGapNoDownstreamAuthority
  } as const;
  return {
    ...base,
    triggerId: 'method-improvement-trigger_phase7-coverage-gap',
    triggerFingerprintSha256: methodImprovementCoverageGapTriggerFingerprintV1(base),
    admittedAt: '2026-09-01T04:00:00.000Z'
  } as const;
}

function researchMission(triggerValue = trigger()) {
  const base = {
    schemaVersion: 1,
    workspaceId,
    triggerId: triggerValue.triggerId,
    triggerFingerprintSha256: triggerValue.triggerFingerprintSha256,
    target: triggerValue.target,
    source: triggerValue.source,
    mission,
    createdByPrincipalId,
    createdAt: mission.createdAt
  } as const;
  return {
    ...base,
    researchMissionId: 'method-improvement-research-mission_phase7-coverage-gap',
    missionFingerprintSha256: methodImprovementCoverageGapMissionFingerprintV1(base)
  } as const;
}

describe('Method Improvement Coverage Gap V1 shared contract', () => {
  it('admits missing Runtime Capability as an explicit new capability/method demand without a fake predecessor', () => {
    const parsed = parseMethodImprovementCoverageGapTriggerV1(trigger());

    expect(parsed.triggerType).toBe('COVERAGE_GAP');
    expect(parsed.target.kind).toBe('NEW_CAPABILITY_METHOD_DEMAND');
    expect('predecessor' in parsed).toBe(false);
    expect(parsed.source.phase7AdmissionStatus).toBe('NOT_ADMITTED');
    expect(parsed.source.evidenceId).toBe(
      `capability-coverage-gap-evidence_${evidenceFingerprintSha256}`
    );
    expect(parsed.authorityConsequences).toEqual(methodImprovementCoverageGapNoDownstreamAuthority);
  });

  it('preserves exact predecessor lineage when governance admits a genuine existing-Method coverage gap', () => {
    const parsed = parseMethodImprovementCoverageGapTriggerV1(
      trigger({ status: 'AMBIGUOUS_CURRENT_IMPLEMENTATION', target: existingMethodTarget })
    );

    expect(parsed.target).toEqual({ kind: 'EXISTING_METHOD', predecessor });
  });

  it('keeps source-governance and currentness failures distinguishable but fail-closed for research admission', () => {
    for (const status of [
      'RUNTIME_COVERED_SOURCE_UNPROVEN',
      'SOURCE_ADMISSION_DENIED',
      'SOURCE_PROOF_NOT_CURRENT'
    ] as const) {
      expect(parseMethodImprovementCoverageGapEvidenceSourceV1(source(status)).coverageStatus).toBe(
        status
      );
      expect(() => parseMethodImprovementCoverageGapTriggerV1(trigger({ status }))).toThrow(
        /source-governance\/currentness revalidation/u
      );
    }
  });

  it('rejects covered or unavailable audit states from the governed Coverage Gap source vocabulary', () => {
    expect(() =>
      parseMethodImprovementCoverageGapEvidenceSourceV1({
        ...source(),
        coverageStatus: 'PRODUCTION_COVERED'
      })
    ).toThrow(/not an eligible governed Coverage Gap status/u);
    expect(() =>
      parseMethodImprovementCoverageGapEvidenceSourceV1({
        ...source(),
        coverageStatus: 'COVERAGE_AUDIT_UNAVAILABLE'
      })
    ).toThrow(/not an eligible governed Coverage Gap status/u);
  });

  it('rejects tampered evidence, candidate and demand identity/fingerprint bindings', () => {
    expect(() =>
      parseMethodImprovementCoverageGapEvidenceSourceV1({
        ...source(),
        evidenceId: 'capability-coverage-gap-evidence_other'
      })
    ).toThrow(/evidenceId must bind/u);
    expect(() =>
      parseMethodImprovementCoverageGapEvidenceSourceV1({
        ...source(),
        candidateId: 'capability-coverage-gap-candidate_other'
      })
    ).toThrow(/candidateId must bind/u);
    expect(() =>
      parseMethodImprovementCoverageGapEvidenceSourceV1({
        ...source(),
        demandId: 'capability-demand_other'
      })
    ).toThrow(/demandId must bind/u);
  });

  it('rejects a new-demand target that drifts from the exact #428 demand identity', () => {
    const otherDemandFingerprint = 'f'.repeat(64);
    expect(() =>
      parseMethodImprovementCoverageGapTriggerV1(
        trigger({
          target: {
            kind: 'NEW_CAPABILITY_METHOD_DEMAND',
            demandId: `capability-demand_${otherDemandFingerprint}`,
            demandFingerprintSha256: otherDemandFingerprint
          }
        })
      )
    ).toThrow(/must match the exact source demand identity/u);
  });

  it('forbids fabricated predecessor lineage for a missing Runtime Capability', () => {
    expect(() =>
      parseMethodImprovementCoverageGapTriggerV1(
        trigger({ status: 'MISSING_RUNTIME_CAPABILITY', target: existingMethodTarget })
      )
    ).toThrow(/requires an explicit new capability\/method demand target/u);
  });

  it('rejects product/customer population copying and authority escalation', () => {
    expect(() =>
      parseMethodImprovementCoverageGapEvidenceSourceV1({
        ...source(),
        customerPopulation: [{ customerId: 'customer_forbidden' }]
      })
    ).toThrow(/unsupported fields/u);

    const valid = trigger();
    expect(() =>
      parseMethodImprovementCoverageGapTriggerV1({
        ...valid,
        authorityConsequences: {
          ...methodImprovementCoverageGapNoDownstreamAuthority,
          arbitraryAiExecutionAuthorized: true
        }
      })
    ).toThrow(/no-downstream-authority/u);
  });

  it('binds replay identity and trigger fingerprint deterministically', () => {
    const valid = trigger();
    expect(() =>
      parseMethodImprovementCoverageGapTriggerV1({
        ...valid,
        admission: { ...valid.admission, idempotencyKey: 'changed-key' }
      })
    ).toThrow(/replay key fingerprint/u);
    expect(() =>
      parseMethodImprovementCoverageGapTriggerV1({
        ...valid,
        reason: 'Changed admitted reason without changing the fingerprint.'
      })
    ).toThrow(/triggerFingerprintSha256 does not match/u);
  });

  it('keeps the legacy PERFORMANCE parser closed to Coverage Gap while the additive union parser opts in', () => {
    const valid = trigger();
    expect(() => parseMethodImprovementTriggerV1(valid)).toThrow(/PERFORMANCE_GAP only/u);
    expect(parseMethodImprovementAnyTriggerV1(valid).triggerType).toBe('COVERAGE_GAP');
  });

  it('binds a Coverage Gap research mission to the exact target and evidence source', () => {
    const parsedTrigger = parseMethodImprovementCoverageGapTriggerV1(trigger());
    const parsedMission = parseMethodImprovementCoverageGapResearchMissionV1(researchMission());

    expect(() =>
      assertMethodImprovementCoverageGapMissionBinding(parsedTrigger, parsedMission)
    ).not.toThrow();

    const drifted = researchMission();
    const otherDemandFingerprint = 'f'.repeat(64);
    const driftedTarget = {
      kind: 'NEW_CAPABILITY_METHOD_DEMAND',
      demandId: `capability-demand_${otherDemandFingerprint}`,
      demandFingerprintSha256: otherDemandFingerprint
    } as const;
    const driftedBase = {
      schemaVersion: 1,
      workspaceId,
      triggerId: drifted.triggerId,
      triggerFingerprintSha256: drifted.triggerFingerprintSha256,
      target: driftedTarget,
      source: drifted.source,
      mission,
      createdByPrincipalId,
      createdAt: mission.createdAt
    } as const;
    const parsedDriftedMission = parseMethodImprovementCoverageGapResearchMissionV1({
      ...driftedBase,
      researchMissionId: drifted.researchMissionId,
      missionFingerprintSha256: methodImprovementCoverageGapMissionFingerprintV1(driftedBase)
    });
    expect(() =>
      assertMethodImprovementCoverageGapMissionBinding(parsedTrigger, parsedDriftedMission)
    ).toThrow(/does not match/u);
  });
});
