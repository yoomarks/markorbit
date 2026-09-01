import { describe, expect, it, vi } from 'vitest';

import type {
  MethodImprovementCoverageGapEvidenceSourceV1,
  MethodImprovementCoverageGapStatusV1
} from '@markorbit/contracts/method-improvement-coverage-gap';
import {
  InMemoryMethodImprovementCoverageGapAdmissionRepositoryV1,
  MethodImprovementCoverageGapAdmissionServiceV1,
  type CapabilityCoverageGapEvidenceResolutionV1,
  type MethodImprovementCoverageGapAdmissionRepositoryV1
} from '../src/method-improvement-coverage-gap.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const createdAt = '2026-09-01T17:10:00.000Z';

function digest(character: string): string {
  return character.repeat(64);
}

function source(
  coverageStatus: MethodImprovementCoverageGapStatusV1 = 'MISSING_RUNTIME_CAPABILITY',
  evidenceCharacter = 'a'
): MethodImprovementCoverageGapEvidenceSourceV1 {
  const evidenceFingerprintSha256 = digest(evidenceCharacter);
  const candidateFingerprintSha256 = digest('c');
  const demandFingerprintSha256 = digest('d');
  return {
    kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1',
    classification: 'COVERAGE_GAP_EVIDENCE',
    phase7AdmissionStatus: 'NOT_ADMITTED',
    sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1',
    evidenceId: `capability-coverage-gap-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256,
    sourceAuditFingerprintSha256: digest('b'),
    candidateId: `capability-coverage-gap-candidate_${candidateFingerprintSha256}`,
    candidateFingerprintSha256,
    coverageStatus,
    demandId: `capability-demand_${demandFingerprintSha256}`,
    demandFingerprintSha256
  };
}

function target(value = source()) {
  return {
    kind: 'NEW_CAPABILITY_METHOD_DEMAND' as const,
    demandId: value.demandId,
    demandFingerprintSha256: value.demandFingerprintSha256
  };
}

function mission(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    missionId: 'brain-research-mission_coverage-gap-unit',
    capabilityDemand:
      'Research the exact governed capability demand represented by the Coverage Gap.',
    problem:
      'Determine a bounded method path for the explicitly admitted missing Runtime Capability.',
    targetMethodFamily: 'SOURCE_RESOLUTION',
    applicabilityTarget: {
      jurisdictions: ['US'],
      authorities: ['USPTO'],
      objectTypes: ['TRADEMARK_APPLICATION'],
      operations: ['OFFICIAL_FEE_RESOLUTION'],
      procedures: ['ELECTRONIC_FILING'],
      stages: ['NEW_APPLICATION'],
      filingBases: ['SECTION_1'],
      segments: ['BASE_FEE'],
      requiredData: ['GOVERNED_CAPABILITY_DEMAND'],
      effectiveFrom: createdAt
    },
    knowledgeResearchPlan: [
      'Resolve bounded authoritative knowledge relevant to the admitted demand.'
    ],
    dataEngineResearchPlan: [
      'Request only reproducible data needed to evaluate a future method candidate.'
    ],
    hypotheses: ['A bounded governed method may satisfy the missing capability demand.'],
    featurePlan: ['Define deterministic inputs before any candidate is created.'],
    evaluationPlan: ['Evaluate any later candidate against explicit success criteria.'],
    successMetrics: ['bounded reproducible method evaluation'],
    baselineMetrics: ['no predecessor method exists for this missing capability demand'],
    createdAt,
    ...overrides
  };
}

function command(
  sourceValue: MethodImprovementCoverageGapEvidenceSourceV1 = source(),
  overrides: Record<string, unknown> = {}
) {
  return {
    schemaVersion: 1,
    workspaceId,
    triggerType: 'COVERAGE_GAP',
    source: sourceValue,
    target: target(sourceValue),
    reason:
      'Explicit Core governance admission of exact Coverage Gap evidence for bounded research.',
    createdByPrincipalId: 'principal_coverage-gap-governance',
    mission: mission(),
    ...overrides
  };
}

function request(body: unknown = command()) {
  return {
    workspaceId,
    idempotencyKey: 'coverage-gap-unit-key',
    correlationId: 'coverage-gap-unit-correlation',
    command: body
  };
}

function fixture(
  options: {
    resolvedSource?: unknown;
    resolution?: CapabilityCoverageGapEvidenceResolutionV1;
    repository?: MethodImprovementCoverageGapAdmissionRepositoryV1;
  } = {}
) {
  const resolvedSource = options.resolvedSource ?? source();
  const evidence = {
    resolveExact: vi.fn(() =>
      Promise.resolve(
        options.resolution ?? {
          status: 'RESOLVED' as const,
          source: resolvedSource
        }
      )
    )
  };
  const repository =
    options.repository ?? new InMemoryMethodImprovementCoverageGapAdmissionRepositoryV1();
  let triggerSequence = 0;
  let missionSequence = 0;
  return {
    evidence,
    repository,
    service: new MethodImprovementCoverageGapAdmissionServiceV1({
      repository,
      evidence,
      now: () => createdAt,
      triggerIdFactory: () => `coverage-gap-unit-trigger-${++triggerSequence}`,
      researchMissionIdFactory: () => `coverage-gap-unit-mission-${++missionSequence}`
    })
  };
}

describe('Method Improvement Coverage Gap admission', () => {
  it('binds exact producer-resolved gap evidence to one trigger and one Research Mission', async () => {
    const gapSource = source();
    const f = fixture({ resolvedSource: gapSource });

    const result = await f.service.admit(request(command(gapSource)));

    expect(result.replayed).toBe(false);
    expect(result.trigger.triggerType).toBe('COVERAGE_GAP');
    expect(result.trigger.source).toEqual(gapSource);
    expect(result.trigger.source.phase7AdmissionStatus).toBe('NOT_ADMITTED');
    expect(result.trigger.target).toEqual(target(gapSource));
    expect(result.trigger.admission).toMatchObject({
      kind: 'EXPLICIT_CORE_GOVERNANCE_ADMISSION',
      sourceEvidenceResolution: 'EXACT_EVIDENCE_VERIFIED'
    });
    expect(result.trigger.authorityConsequences).toMatchObject({
      methodImprovementTriggerRecorded: true,
      coverageEvidenceAdmissionStatusMutated: false,
      researchMissionCreated: false,
      methodImprovementCandidateCreated: false,
      methodActivated: false,
      runtimeCapabilityCreated: false,
      arbitraryAiExecutionAuthorized: false,
      productStateCreated: false,
      officialTruthCreated: false
    });
    expect(result.researchMission.triggerId).toBe(result.trigger.triggerId);
    expect(result.researchMission.triggerFingerprintSha256).toBe(
      result.trigger.triggerFingerprintSha256
    );
    expect(result.researchMission.source).toEqual(gapSource);
    expect(result.researchMission.target).toEqual(target(gapSource));
    expect(f.evidence.resolveExact).toHaveBeenCalledWith({
      workspaceId,
      evidenceId: gapSource.evidenceId,
      evidenceFingerprintSha256: gapSource.evidenceFingerprintSha256
    });
  });

  it('replays exact evidence and command content without replacing immutable records', async () => {
    const gapSource = source();
    const f = fixture({ resolvedSource: gapSource });

    const first = await f.service.admit(request(command(gapSource)));
    const second = await f.service.admit(request(command(gapSource)));

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.trigger).toEqual(first.trigger);
    expect(second.researchMission).toEqual(first.researchMission);
    expect(second.trigger.triggerId).toBe('method-improvement-trigger_coverage-gap-unit-trigger-1');
    expect(f.evidence.resolveExact).toHaveBeenCalledTimes(2);
  });

  it('rejects conflicting reuse of the same exact evidence identity', async () => {
    const gapSource = source();
    const f = fixture({ resolvedSource: gapSource });
    await f.service.admit(request(command(gapSource)));

    await expect(
      f.service.admit(
        request(
          command(gapSource, {
            reason: 'Different governance content attempting to reuse the same immutable evidence.'
          })
        )
      )
    ).rejects.toMatchObject({ code: 'TRIGGER_CONFLICT' });
  });

  it('fails trusted workspace mismatch before consulting producer evidence', async () => {
    const f = fixture();

    await expect(
      f.service.admit({
        ...request(),
        workspaceId: '22222222-2222-4222-8222-222222222222'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    expect(f.evidence.resolveExact).not.toHaveBeenCalled();
  });

  it('fails closed when producer evidence is not found or unavailable', async () => {
    const repository = { admit: vi.fn() };
    const missing = fixture({
      repository,
      resolution: { status: 'NOT_FOUND', reason: 'exact evidence does not exist' }
    });
    await expect(missing.service.admit(request())).rejects.toMatchObject({
      code: 'EVIDENCE_NOT_FOUND',
      retryable: false
    });
    expect(repository.admit).not.toHaveBeenCalled();

    const unavailable = fixture({
      repository,
      resolution: { status: 'UNAVAILABLE', reason: 'producer evidence authority offline' }
    });
    await expect(unavailable.service.admit(request())).rejects.toMatchObject({
      code: 'EVIDENCE_UNAVAILABLE',
      retryable: true
    });
    expect(repository.admit).not.toHaveBeenCalled();
  });

  it('rejects malformed or mismatched producer evidence before trigger construction', async () => {
    const repository = { admit: vi.fn() };
    const gapSource = source();
    const mismatched = fixture({
      repository,
      resolvedSource: {
        ...gapSource,
        sourceAuditFingerprintSha256: digest('f')
      }
    });
    await expect(mismatched.service.admit(request(command(gapSource)))).rejects.toMatchObject({
      code: 'EVIDENCE_MISMATCH'
    });

    const malformed = fixture({
      repository,
      resolvedSource: {
        ...gapSource,
        phase7AdmissionStatus: 'ADMITTED'
      }
    });
    await expect(malformed.service.admit(request(command(gapSource)))).rejects.toMatchObject({
      code: 'EVIDENCE_MISMATCH'
    });
    expect(repository.admit).not.toHaveBeenCalled();
  });

  it.each([
    'RUNTIME_COVERED_SOURCE_UNPROVEN',
    'SOURCE_ADMISSION_DENIED',
    'SOURCE_PROOF_NOT_CURRENT'
  ] as const)(
    'keeps %s on the source-governance path instead of Research Mission creation',
    async (status) => {
      const gapSource = source(
        status,
        status === 'RUNTIME_COVERED_SOURCE_UNPROVEN'
          ? 'a'
          : status === 'SOURCE_ADMISSION_DENIED'
            ? 'b'
            : 'c'
      );
      const repository = { admit: vi.fn() };
      const f = fixture({ repository, resolvedSource: gapSource });

      await expect(f.service.admit(request(command(gapSource)))).rejects.toMatchObject({
        code: 'INELIGIBLE_COVERAGE_GAP'
      });
      expect(repository.admit).not.toHaveBeenCalled();
    }
  );

  it('requires a new capability/method demand target for a missing Runtime Capability', async () => {
    const gapSource = source();
    const repository = { admit: vi.fn() };
    const f = fixture({ repository, resolvedSource: gapSource });

    await expect(
      f.service.admit(
        request(
          command(gapSource, {
            target: {
              kind: 'EXISTING_METHOD',
              predecessor: {
                methodPackageRef: 'brain-method-package:package_not-real@1',
                methodRef: 'brain-method:method_not-real',
                methodVersionRef: 'brain-method-version:method-version_not-real',
                evaluationRef: 'brain-method-evaluation:evaluation_not-real'
              }
            }
          })
        )
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(repository.admit).not.toHaveBeenCalled();
  });

  it('does not mutate caller-owned historical Coverage Gap evidence during admission', async () => {
    const gapSource = source();
    const original = structuredClone(gapSource);
    const body = command(gapSource);
    const f = fixture({ resolvedSource: gapSource });

    await f.service.admit(request(body));

    expect(gapSource).toEqual(original);
    expect(body.source.phase7AdmissionStatus).toBe('NOT_ADMITTED');
  });
});
