import { describe, expect, it, vi } from 'vitest';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from '../src/current-source-admission.js';
import {
  CapabilitySourceAdmissionEvidenceError,
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV1,
  materializeCapabilitySourceAdmissionEvidenceV1
} from '../src/current-source-admission-evidence.js';

const admissibleDecision: CapabilitySourceAdmissionDecision = {
  schemaVersion: 1,
  producer: 'CAPABILITY_ENGINE',
  decision: 'PRODUCTION_ADMISSIBLE',
  historical: {
    capabilityRequestId: 'capreq_evidence',
    implementationBindingId: 'implementation-binding_evidence',
    capabilityInvocationId: 'capability-invocation_evidence',
    capabilityOutcomeId: 'capability-outcome_evidence',
    capabilityReturnId: 'capability-return_evidence',
    sessionReceiptId: 'session-receipt_evidence',
    replayed: false
  },
  current: {
    capability: {
      runtimeCapabilityDefinitionId: 'runtime-capability_evidence',
      version: 3,
      capabilityId: 'trademark-analysis',
      capabilityVersion: '2.1.0'
    },
    implementation: {
      implementationProfileId: 'implementation-profile_evidence',
      version: 4,
      implementationKey: 'analysis:primary',
      status: 'APPROVED'
    }
  },
  methodSource: {
    evidenceRef: 'brain-method-package:method-package_evidence@4.0.0',
    methodId: 'method_evidence',
    methodVersionId: 'method-version_evidence',
    packageId: 'method-package_evidence',
    packageVersion: '4.0.0',
    activationId: 'activation_evidence',
    evaluationId: 'evaluation_evidence'
  },
  referenceSources: [
    {
      evidenceRef: 'research-dataset:evidence',
      sourceId: 'data-engine-query_evidence',
      sourceVersion: '2026-09-01',
      sourceFingerprintSha256: 'a'.repeat(64)
    }
  ],
  authority: capabilitySourceAdmissionNoAuthorityConsequences
};

const deniedDecision: CapabilitySourceAdmissionDecision = {
  schemaVersion: 1,
  producer: 'CAPABILITY_ENGINE',
  decision: 'DENIED',
  historical: {
    capabilityRequestId: 'capreq_denied',
    implementationBindingId: 'implementation-binding_denied',
    capabilityInvocationId: 'capability-invocation_denied',
    capabilityOutcomeId: 'capability-outcome_denied',
    capabilityReturnId: 'capability-return_denied',
    sessionReceiptId: 'session-receipt_denied',
    replayed: true
  },
  denial: {
    code: 'SOURCE_REFERENCE_NOT_CURRENT',
    reason: 'The exact source reference is no longer current.'
  },
  authority: capabilitySourceAdmissionNoAuthorityConsequences
};

const evaluatedAt = '2026-09-01T03:00:00.000Z';

describe('Capability source admission producer evidence V1', () => {
  it('materializes an admitted decision into stable attributable producer evidence', () => {
    const evidence = materializeCapabilitySourceAdmissionEvidenceV1(
      admissibleDecision,
      evaluatedAt
    );

    expect(evidence).toMatchObject({
      schemaVersion: 1,
      producer: 'CAPABILITY_ENGINE',
      evidenceVersion: 1,
      evaluatedAt,
      decision: admissibleDecision,
      authority: capabilitySourceAdmissionNoAuthorityConsequences
    });
    expect(evidence.evidenceId).toBe(
      `capability-source-admission-evidence_${evidence.evidenceFingerprintSha256}`
    );
    expect(evidence.decisionFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.evidenceFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.values(evidence.authority).every((value) => value === false)).toBe(true);
  });

  it('materializes a denied decision as stable denial evidence without upgrading it', () => {
    const evidence = materializeCapabilitySourceAdmissionEvidenceV1(deniedDecision, evaluatedAt);

    expect(evidence.decision).toEqual(deniedDecision);
    expect(evidence.decision.decision).toBe('DENIED');
    expect(evidence.evidenceId).toBe(
      `capability-source-admission-evidence_${evidence.evidenceFingerprintSha256}`
    );
    expect(Object.values(evidence.authority).every((value) => value === false)).toBe(true);
  });

  it('replays deterministically for the exact same decision and evaluation instant', () => {
    const first = materializeCapabilitySourceAdmissionEvidenceV1(admissibleDecision, evaluatedAt);
    const replay = materializeCapabilitySourceAdmissionEvidenceV1(admissibleDecision, evaluatedAt);

    expect(replay).toEqual(first);
  });

  it('changes evidence identity when the exact decision or evaluation instant changes', () => {
    const baseline = materializeCapabilitySourceAdmissionEvidenceV1(admissibleDecision, evaluatedAt);
    const later = materializeCapabilitySourceAdmissionEvidenceV1(
      admissibleDecision,
      '2026-09-01T03:00:01.000Z'
    );
    const denied = materializeCapabilitySourceAdmissionEvidenceV1(deniedDecision, evaluatedAt);

    expect(later.evidenceId).not.toBe(baseline.evidenceId);
    expect(later.evidenceFingerprintSha256).not.toBe(baseline.evidenceFingerprintSha256);
    expect(denied.decisionFingerprintSha256).not.toBe(baseline.decisionFingerprintSha256);
    expect(denied.evidenceId).not.toBe(baseline.evidenceId);
  });

  it('normalizes an explicit RFC3339 producer evaluation instant before identity construction', () => {
    const evidence = materializeCapabilitySourceAdmissionEvidenceV1(
      admissibleDecision,
      '2026-09-01T11:00:00+08:00'
    );

    expect(evidence.evaluatedAt).toBe(evaluatedAt);
    expect(evidence).toEqual(
      materializeCapabilitySourceAdmissionEvidenceV1(admissibleDecision, evaluatedAt)
    );
  });

  it('fails closed on malformed or impossible producer evaluation time', () => {
    expect(() =>
      materializeCapabilitySourceAdmissionEvidenceV1(admissibleDecision, '2026-09-01')
    ).toThrowError(CapabilitySourceAdmissionEvidenceError);
    expect(() =>
      materializeCapabilitySourceAdmissionEvidenceV1(
        admissibleDecision,
        '2026-02-31T03:00:00.000Z'
      )
    ).toThrowError(CapabilitySourceAdmissionEvidenceError);

    try {
      materializeCapabilitySourceAdmissionEvidenceV1(admissibleDecision, 'not-a-time');
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_EVALUATED_AT' });
    }
  });

  it('fails closed instead of materializing a non-producer or incomplete decision', () => {
    const wrongProducer = {
      ...admissibleDecision,
      producer: 'MARKREG'
    } as unknown as CapabilitySourceAdmissionDecision;
    const missingCurrent = {
      schemaVersion: 1,
      producer: 'CAPABILITY_ENGINE',
      decision: 'PRODUCTION_ADMISSIBLE',
      historical: admissibleDecision.historical,
      authority: capabilitySourceAdmissionNoAuthorityConsequences
    } as unknown as CapabilitySourceAdmissionDecision;

    for (const malformed of [wrongProducer, missingCurrent]) {
      try {
        materializeCapabilitySourceAdmissionEvidenceV1(malformed, evaluatedAt);
        throw new Error('expected materialization to fail');
      } catch (error) {
        expect(error).toMatchObject({ code: 'INVALID_ADMISSION_DECISION' });
      }
    }
  });

  it('delegates admission semantics to the existing evaluator exactly once', async () => {
    const evaluate = vi.fn(() => Promise.resolve(admissibleDecision));
    const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV1({
      evaluator: { evaluate },
      now: () => evaluatedAt
    });
    const runtimeExecution = { governed: 'runtime-evidence' };

    const evidence = await materializer.evaluateAndMaterialize(runtimeExecution);

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(runtimeExecution);
    expect(evidence.decision).toEqual(admissibleDecision);
    expect(evidence.evaluatedAt).toBe(evaluatedAt);
  });
});
