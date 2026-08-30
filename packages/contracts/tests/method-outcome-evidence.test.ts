import { describe, expect, it } from 'vitest';
import {
  MethodOutcomeEvidenceContractError,
  parseMethodOutcomeEvidenceAdmissionV1,
  parseMethodOutcomeEvidenceV1
} from '../src/method-outcome-evidence.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';

function admission(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    workspaceId,
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId: 'matter-intelligence-review_phase6-evidence',
      sourceVersion: 1,
      sourceFingerprintSha256: '1'.repeat(64)
    },
    formalMatter: {
      id: 'formal-matter_phase6-evidence',
      version: 1
    },
    observation: {
      id: 'matter-intelligence-observation_phase6-evidence',
      fingerprintSha256: '2'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    },
    review: {
      id: 'matter-intelligence-review_phase6-evidence',
      version: 1,
      fingerprintSha256: '4'.repeat(64),
      outcome: 'OVERRIDDEN',
      reason: 'METHOD_ERROR',
      reviewedByPrincipalId: 'principal_phase6-evidence',
      reviewedAt: '2026-08-30T20:00:00.000Z'
    },
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      requestId: 'capreq_phase6-evidence',
      returnId: 'capability-return_phase6-evidence',
      outcomeId: 'capability-outcome_phase6-evidence',
      invocationId: 'capability-invocation_phase6-evidence',
      sessionReceiptId: 'session-receipt_phase6-evidence'
    },
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      key: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    method: {
      packageRef: 'brain-method-package:package_cn-duration@1',
      methodRef: 'brain-method:method_cn-duration',
      methodVersionRef: 'brain-method-version:method-version_cn-duration',
      evaluationRef: 'brain-method-evaluation:evaluation_cn-duration',
      researchDatasetRef: 'research-dataset:cn-duration-band:accepted',
      evidenceFingerprintSha256: '5'.repeat(64),
      inputFingerprintSha256: '6'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    },
    ...overrides
  };
}

describe('MethodOutcomeEvidenceV1', () => {
  it('parses the frozen bounded MarkReg outcome evidence boundary', () => {
    const parsed = parseMethodOutcomeEvidenceAdmissionV1(admission());

    expect(parsed.source).toMatchObject({
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceVersion: 1
    });
    expect(parsed.review).toMatchObject({ outcome: 'OVERRIDDEN', reason: 'METHOD_ERROR' });
    expect(parsed.capability.requestId).toBe('capreq_phase6-evidence');
    expect(parsed.implementation.version).toBe(1);
  });

  it('rejects any source authority other than MarkReg matter-intelligence review', () => {
    expect(() =>
      parseMethodOutcomeEvidenceAdmissionV1(
        admission({
          source: {
            ...admission().source,
            owner: 'BRAIN'
          }
        })
      )
    ).toThrow(/MARKREG MATTER_INTELLIGENCE_REVIEW/u);
  });

  it('rejects unsupported full-product or hidden lifecycle fields', () => {
    expect(() =>
      parseMethodOutcomeEvidenceAdmissionV1(
        admission({ customerSnapshot: { applicant: 'must-not-cross-boundary' } })
      )
    ).toThrow(/unsupported fields/u);
  });

  it.each([
    ['CONFIRMED', 'METHOD_ERROR'],
    ['INCONCLUSIVE', undefined],
    ['OVERRIDDEN', undefined],
    ['OVERRIDDEN', 'INCONCLUSIVE_EVIDENCE']
  ])('rejects invalid review taxonomy %s / %s', (outcome, reason) => {
    expect(() =>
      parseMethodOutcomeEvidenceAdmissionV1(
        admission({
          review: {
            ...admission().review,
            outcome,
            ...(reason === undefined ? { reason: undefined } : { reason })
          }
        })
      )
    ).toThrow(MethodOutcomeEvidenceContractError);
  });

  it('requires source identity and review identity/version to match exactly', () => {
    expect(() =>
      parseMethodOutcomeEvidenceAdmissionV1(
        admission({
          source: {
            ...admission().source,
            sourceVersion: 2
          }
        })
      )
    ).toThrow(/source identity\/version/u);
  });

  it('requires the reviewed observation output to match the attributed method output', () => {
    expect(() =>
      parseMethodOutcomeEvidenceAdmissionV1(
        admission({
          method: {
            ...admission().method,
            outputFingerprintSha256: '7'.repeat(64)
          }
        })
      )
    ).toThrow(/output fingerprints must match/u);
  });

  it('parses server-created immutable admission identity separately from the client payload', () => {
    const parsed = parseMethodOutcomeEvidenceV1({
      ...admission(),
      methodOutcomeEvidenceId: 'method-outcome-evidence_phase6-evidence',
      admissionFingerprintSha256: '8'.repeat(64),
      admittedAt: '2026-08-30T20:01:00.000Z'
    });

    expect(parsed.methodOutcomeEvidenceId).toBe('method-outcome-evidence_phase6-evidence');
    expect(parsed.admissionFingerprintSha256).toBe('8'.repeat(64));
    expect(parsed.admittedAt).toBe('2026-08-30T20:01:00.000Z');
  });
});
