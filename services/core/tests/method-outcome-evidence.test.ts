import { describe, expect, it, vi } from 'vitest';
import {
  MethodOutcomeEvidenceAdmissionError,
  MethodOutcomeEvidenceAdmissionServiceV1,
  type MethodOutcomeEvidenceAdmissionRepositoryV1,
  type PreparedMethodOutcomeEvidenceAdmissionV1
} from '../src/method-outcome-evidence.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';

function admission() {
  return {
    schemaVersion: 1,
    workspaceId,
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId: 'matter-intelligence-review_phase6-core',
      sourceVersion: 1,
      sourceFingerprintSha256: '1'.repeat(64)
    },
    formalMatter: { id: 'formal-matter_phase6-core', version: 1 },
    observation: {
      id: 'matter-intelligence-observation_phase6-core',
      fingerprintSha256: '2'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    },
    review: {
      id: 'matter-intelligence-review_phase6-core',
      version: 1,
      fingerprintSha256: '4'.repeat(64),
      outcome: 'CONFIRMED',
      reviewedByPrincipalId: 'principal_phase6-core',
      reviewedAt: '2026-08-30T20:00:00.000Z'
    },
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      requestId: 'capreq_phase6-core',
      returnId: 'capability-return_phase6-core',
      outcomeId: 'capability-outcome_phase6-core',
      invocationId: 'capability-invocation_phase6-core',
      sessionReceiptId: 'session-receipt_phase6-core'
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
    }
  };
}

function repository() {
  const admit = vi.fn((input: Readonly<PreparedMethodOutcomeEvidenceAdmissionV1>) =>
    Promise.resolve({ evidence: input.evidence, replayed: false })
  );
  return {
    admit,
    repository: { admit } as MethodOutcomeEvidenceAdmissionRepositoryV1
  };
}

describe('MethodOutcomeEvidenceAdmissionServiceV1', () => {
  it('creates server-owned evidence identity and deterministic bounded fingerprints', async () => {
    const fake = repository();
    const service = new MethodOutcomeEvidenceAdmissionServiceV1({
      repository: fake.repository,
      now: () => '2026-08-30T20:01:00.000Z',
      evidenceIdFactory: () => 'phase6-core'
    });

    const result = await service.admit({ workspaceId, evidence: admission() });

    expect(result.replayed).toBe(false);
    expect(result.evidence.methodOutcomeEvidenceId).toBe('method-outcome-evidence_phase6-core');
    expect(result.evidence.admittedAt).toBe('2026-08-30T20:01:00.000Z');
    expect(result.evidence.admissionFingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(fake.admit.mock.calls[0]![0].sourceIdentityFingerprintSha256).toMatch(
      /^[0-9a-f]{64}$/u
    );
  });

  it('fails before persistence when trusted workspace context does not match evidence', async () => {
    const fake = repository();
    const service = new MethodOutcomeEvidenceAdmissionServiceV1({ repository: fake.repository });

    await expect(
      service.admit({
        workspaceId: '22222222-2222-4222-8222-222222222222',
        evidence: admission()
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    expect(fake.admit).not.toHaveBeenCalled();
  });

  it('maps contract violations to INVALID_EVIDENCE without persistence', async () => {
    const fake = repository();
    const service = new MethodOutcomeEvidenceAdmissionServiceV1({ repository: fake.repository });

    await expect(
      service.admit({
        workspaceId,
        evidence: { ...admission(), source: { ...admission().source, owner: 'CAPABILITY' } }
      })
    ).rejects.toMatchObject({
      code: 'INVALID_EVIDENCE'
    } satisfies Partial<MethodOutcomeEvidenceAdmissionError>);
    expect(fake.admit).not.toHaveBeenCalled();
  });
});
