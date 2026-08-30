import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';
import { createMethodOutcomeEvidenceRoutesV1 } from '../src/method-outcome-evidence-http.js';
import {
  MethodOutcomeEvidenceAdmissionServiceV1,
  type PreparedMethodOutcomeEvidenceAdmissionV1
} from '../src/method-outcome-evidence.js';

const secret = 'phase6-method-outcome-evidence-secret-32-bytes';
const workspaceId = '11111111-1111-4111-8111-111111111111';

function admission() {
  return {
    schemaVersion: 1,
    workspaceId,
    source: {
      owner: 'MARKREG',
      kind: 'MATTER_INTELLIGENCE_REVIEW',
      sourceId: 'matter-intelligence-review_phase6-core-http',
      sourceVersion: 1,
      sourceFingerprintSha256: '1'.repeat(64)
    },
    formalMatter: { id: 'formal-matter_phase6-core-http', version: 1 },
    observation: {
      id: 'matter-intelligence-observation_phase6-core-http',
      fingerprintSha256: '2'.repeat(64),
      outputFingerprintSha256: '3'.repeat(64)
    },
    review: {
      id: 'matter-intelligence-review_phase6-core-http',
      version: 1,
      fingerprintSha256: '4'.repeat(64),
      outcome: 'CONFIRMED',
      reviewedByPrincipalId: 'principal_phase6-core-http',
      reviewedAt: '2026-08-30T20:00:00.000Z'
    },
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      requestId: 'capreq_phase6-core-http',
      returnId: 'capability-return_phase6-core-http',
      outcomeId: 'capability-outcome_phase6-core-http',
      invocationId: 'capability-invocation_phase6-core-http',
      sessionReceiptId: 'session-receipt_phase6-core-http'
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

function fixture(replayed = false) {
  const admit = vi.fn((input: Readonly<PreparedMethodOutcomeEvidenceAdmissionV1>) =>
    Promise.resolve({ evidence: input.evidence, replayed })
  );
  const service = new MethodOutcomeEvidenceAdmissionServiceV1({
    repository: { admit },
    now: () => '2026-08-30T20:01:00.000Z',
    evidenceIdFactory: () => 'phase6-core-http'
  });
  const route = createMethodOutcomeEvidenceRoutesV1({
    internalServiceSecret: secret,
    service
  })[0]!;
  return { route, admit };
}

function request(body: unknown, headers: Record<string, string | undefined> = {}): JsonRequest {
  return {
    body,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-workspace-id': workspaceId,
      ...headers
    },
    method: 'POST',
    path: '/internal/v1/evaluation/method-outcome-evidence',
    params: {},
    query: {}
  };
}

describe('Method Outcome Evidence HTTP admission', () => {
  it('returns 201 for first admission and 200 for exact replay', async () => {
    const first = fixture(false);
    const replay = fixture(true);

    await expect(first.route.handle(request(admission()))).resolves.toMatchObject({ status: 201 });
    await expect(replay.route.handle(request(admission()))).resolves.toMatchObject({ status: 200 });
    expect(first.admit).toHaveBeenCalledTimes(1);
    expect(replay.admit).toHaveBeenCalledTimes(1);
  });

  it('rejects an untrusted internal caller before invoking the admission service', async () => {
    const f = fixture();

    await expect(
      f.route.handle(
        request(admission(), {
          'x-markorbit-internal-authorization': 'not-the-configured-secret'
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(f.admit).not.toHaveBeenCalled();
  });

  it('requires trusted workspace context', async () => {
    const f = fixture();

    await expect(
      f.route.handle(request(admission(), { 'x-markorbit-workspace-id': undefined }))
    ).rejects.toMatchObject({ status: 400, code: 'WORKSPACE_CONTEXT_REQUIRED' });
    expect(f.admit).not.toHaveBeenCalled();
  });

  it('maps evidence workspace mismatch to 403 without persistence', async () => {
    const f = fixture();

    await expect(
      f.route.handle(
        request({
          ...admission(),
          workspaceId: '22222222-2222-4222-8222-222222222222'
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'WORKSPACE_MISMATCH' });
    expect(f.admit).not.toHaveBeenCalled();
  });

  it('maps strict contract violations to 400 without persistence', async () => {
    const f = fixture();

    await expect(
      f.route.handle(
        request({
          ...admission(),
          review: { ...admission().review, outcome: 'OVERRIDDEN' }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_EVIDENCE' });
    expect(f.admit).not.toHaveBeenCalled();
  });
});
