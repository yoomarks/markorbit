import { describe, expect, it, vi } from 'vitest';
import { HttpError, type JsonRequest } from '@markorbit/service-kit';
import { createExecutionCapabilityObservationSourceRoutes } from '../src/capability-observation-source-http.js';

const secret = 'm6-wp-03-internal-secret-32-bytes-minimum';
const fingerprint = 'c'.repeat(64);

function request(overrides: Partial<JsonRequest> = {}): JsonRequest {
  return {
    body: undefined,
    method: 'GET',
    path: '/internal/v1/capability-observation-sources/evidence-review-decisions/evidence-review-decision_governed-001/versions/1',
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-source-fingerprint-sha256': fingerprint
    },
    params: {
      sourceId: 'evidence-review-decision_governed-001',
      version: '1'
    },
    query: {},
    ...overrides
  };
}

function decision() {
  return {
    evidenceReviewDecisionId: 'evidence-review-decision_governed-001',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 1,
    reviewerPrincipalId: 'user_capability_subject',
    decisionFingerprintSha256: fingerprint,
    reviewedAt: '2026-08-12T00:00:00.000Z',
    correlationId: 'correlation_governed-review-001'
  };
}

describe('M6-WP-03 Execution Capability Observation source route', () => {
  it('returns only owner-controlled attribution for the exact persisted review decision', async () => {
    const reader = { findDecisionById: vi.fn(async () => decision() as never) };
    const route = createExecutionCapabilityObservationSourceRoutes({
      internalServiceSecret: secret,
      evidenceReviewReader: reader
    })[0]!;
    const result = await route.handle(request());
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      source: {
        owner: 'EXECUTION',
        kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
        sourceId: 'evidence-review-decision_governed-001',
        sourceVersion: 1,
        sourceFingerprintSha256: fingerprint,
        observedAt: '2026-08-12T00:00:00.000Z',
        workspaceId: '11111111-1111-4111-8111-111111111111',
        subjectUserId: 'user_capability_subject',
        correlationId: 'correlation_governed-review-001'
      },
      subjectAttributionAuthority: 'OWNER_SOURCE'
    });
    expect(reader.findDecisionById).toHaveBeenCalledWith('evidence-review-decision_governed-001');
  });

  it('requires trusted internal authorization', async () => {
    const route = createExecutionCapabilityObservationSourceRoutes({
      internalServiceSecret: secret,
      evidenceReviewReader: { findDecisionById: vi.fn() }
    })[0]!;
    await expect(
      route.handle(
        request({
          headers: { 'x-source-fingerprint-sha256': fingerprint }
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });
  });

  it('fails closed on missing, stale-version and stale-fingerprint source reads', async () => {
    const missing = createExecutionCapabilityObservationSourceRoutes({
      internalServiceSecret: secret,
      evidenceReviewReader: { findDecisionById: vi.fn(async () => undefined) }
    })[0]!;
    await expect(missing.handle(request())).rejects.toMatchObject({
      status: 404,
      code: 'GOVERNED_SOURCE_NOT_FOUND'
    });

    const exact = createExecutionCapabilityObservationSourceRoutes({
      internalServiceSecret: secret,
      evidenceReviewReader: { findDecisionById: vi.fn(async () => decision() as never) }
    })[0]!;
    await expect(
      exact.handle(
        request({ params: { sourceId: decision().evidenceReviewDecisionId, version: '2' } })
      )
    ).rejects.toMatchObject({ status: 409, code: 'SOURCE_VERSION_MISMATCH' });
    await expect(
      exact.handle(
        request({
          headers: {
            'x-markorbit-internal-authorization': secret,
            'x-source-fingerprint-sha256': 'd'.repeat(64)
          }
        })
      )
    ).rejects.toMatchObject({ status: 409, code: 'SOURCE_FINGERPRINT_MISMATCH' });
  });

  it('never accepts body identity fields because the read route derives identity from owner state', async () => {
    const route = createExecutionCapabilityObservationSourceRoutes({
      internalServiceSecret: secret,
      evidenceReviewReader: { findDecisionById: vi.fn(async () => decision() as never) }
    })[0]!;
    const result = await route.handle(
      request({
        body: {
          workspaceId: 'attacker-workspace',
          subjectUserId: 'attacker-user',
          reviewerId: 'attacker-reviewer'
        }
      })
    );
    expect(JSON.stringify(result.body)).not.toContain('attacker');
    expect(result.status).toBe(200);
  });

  it('uses typed HTTP errors for invalid source versions and fingerprints', async () => {
    const route = createExecutionCapabilityObservationSourceRoutes({
      internalServiceSecret: secret,
      evidenceReviewReader: { findDecisionById: vi.fn() }
    })[0]!;
    await expect(
      route.handle(request({ params: { sourceId: 'source', version: '0' } }))
    ).rejects.toBeInstanceOf(HttpError);
    await expect(
      route.handle(
        request({
          headers: {
            'x-markorbit-internal-authorization': secret,
            'x-source-fingerprint-sha256': 'not-a-sha'
          }
        })
      )
    ).rejects.toBeInstanceOf(HttpError);
  });
});
