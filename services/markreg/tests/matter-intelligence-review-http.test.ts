import { afterEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createMatterIntelligenceReviewRoutes } from '../src/matter-intelligence-review-http.js';
import type { MatterIntelligenceReviewService } from '../src/matter-intelligence-review.js';

const workspaceId = '55555555-5555-4555-8555-555555555555';
const otherWorkspaceId = '66666666-6666-4666-8666-666666666666';
const formalMatterId = 'formal-matter_phase6-http';
const observationId = 'matter-intelligence-observation_phase6-http';
const reviewId = 'matter-intelligence-review_phase6-http';
const secret = 'phase6-review-internal-service-secret-32-byte-minimum';
const active: ServiceRuntime[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

function principal(
  permissions: WorkspacePrincipal['permissions'] = [
    'workspace:read',
    'matter:read',
    'matter:manage'
  ],
  workspace = workspaceId
): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_phase6-http',
    userId: 'user_phase6-http',
    workspaceId: workspace,
    membershipId: 'membership_phase6-http',
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-08-31T00:00:00.000Z'
  };
}

function headers(value: WorkspacePrincipal, withCommand = false) {
  return {
    'content-type': 'application/json',
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId,
    ...(withCommand
      ? {
          'idempotency-key': 'phase6-http-review-key',
          'x-correlation-id': 'phase6-http-review-correlation'
        }
      : {})
  };
}

async function stack() {
  const calls: Record<string, unknown>[] = [];
  const service = {
    record(command: Record<string, unknown>) {
      calls.push(structuredClone(command));
      return Promise.resolve({
        review: {
          schemaVersion: 1,
          matterIntelligenceReviewId: reviewId,
          version: 1,
          workspaceId,
          formalMatter: { id: formalMatterId, version: 1 },
          reviewedObservation: {
            id: observationId,
            fingerprintSha256: 'a'.repeat(64),
            outputFingerprintSha256: 'b'.repeat(64)
          },
          outcome: 'CONFIRMED_AS_PRESENTED',
          reasonCode: 'INDEPENDENT_REVIEW_CONFIRMED',
          reviewerPrincipalId: 'user_phase6-http',
          reviewerMembershipId: 'membership_phase6-http',
          reviewedAt: '2026-08-30T04:00:00.000Z',
          reviewFingerprintSha256: 'c'.repeat(64)
        },
        replayed: false,
        semanticDuplicate: false
      });
    },
    resolveSource(requestedWorkspace: string, requestedReviewId: string, version: number) {
      calls.push({ requestedWorkspace, requestedReviewId, version });
      return Promise.resolve({
        schemaVersion: 1,
        source: {
          owner: 'MARKREG',
          kind: 'MATTER_INTELLIGENCE_REVIEW',
          sourceId: reviewId,
          sourceVersion: 1,
          sourceFingerprintSha256: 'c'.repeat(64),
          observedAt: '2026-08-30T04:00:00.000Z'
        },
        workspaceId: requestedWorkspace,
        formalMatter: { id: formalMatterId, version: 1 },
        reviewedObservation: {
          id: observationId,
          fingerprintSha256: 'a'.repeat(64),
          outputFingerprintSha256: 'b'.repeat(64)
        },
        review: {
          outcome: 'CONFIRMED_AS_PRESENTED',
          reasonCode: 'INDEPENDENT_REVIEW_CONFIRMED',
          reviewerPrincipalId: 'user_phase6-http',
          reviewerMembershipId: 'membership_phase6-http',
          reviewedAt: '2026-08-30T04:00:00.000Z'
        },
        production: {
          capability: {
            id: 'interpretation.cn-completed-duration-historical-band',
            version: '1.0.0',
            returnId: 'capability-return_phase6-http',
            sessionReceiptId: 'session-receipt_phase6-http'
          },
          methodPackageRef: 'brain-method-package:package_phase6-http',
          methodRef: 'brain-method:method_phase6-http',
          methodVersionRef: 'brain-method-version:version_phase6-http',
          evaluationRef: 'brain-method-evaluation:evaluation_phase6-http',
          researchDatasetRef: 'research-dataset:dataset_phase6-http',
          inputFingerprintSha256: 'd'.repeat(64),
          outputFingerprintSha256: 'b'.repeat(64),
          evidenceFingerprintSha256: 'e'.repeat(64)
        }
      });
    }
  } as unknown as Pick<MatterIntelligenceReviewService, 'record' | 'resolveSource'>;
  const runtime = createServiceRuntime(
    { name: 'markreg-phase6-review-http-test', port: 0, version: '1' },
    { routes: createMatterIntelligenceReviewRoutes({ internalServiceSecret: secret, service }) }
  );
  active.push(runtime);
  await runtime.start();
  return { base: `http://127.0.0.1:${runtime.listeningPort}`, calls };
}

describe('Phase 6 MarkReg Matter Intelligence Review HTTP', () => {
  it('derives reviewer/workspace/provenance server-side and accepts only outcome/reason/rationale', async () => {
    const { base, calls } = await stack();
    const response = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence-observations/${observationId}/review`,
      {
        method: 'POST',
        headers: headers(principal(), true),
        body: JSON.stringify({
          outcome: 'CONFIRMED_AS_PRESENTED',
          reasonCode: 'INDEPENDENT_REVIEW_CONFIRMED'
        })
      }
    );
    expect(response.status).toBe(201);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      workspaceId,
      formalMatterId,
      observationId,
      outcome: 'CONFIRMED_AS_PRESENTED',
      reasonCode: 'INDEPENDENT_REVIEW_CONFIRMED',
      idempotencyKey: 'phase6-http-review-key',
      correlationId: 'phase6-http-review-correlation',
      principal: { userId: 'user_phase6-http', membershipId: 'membership_phase6-http' }
    });

    const spoof = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence-observations/${observationId}/review`,
      {
        method: 'POST',
        headers: headers(principal(), true),
        body: JSON.stringify({
          outcome: 'CONFIRMED_AS_PRESENTED',
          reasonCode: 'INDEPENDENT_REVIEW_CONFIRMED',
          reviewerPrincipalId: 'spoofed-user'
        })
      }
    );
    expect(spoof.status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  it('requires trusted auth and matter:manage for mutation', async () => {
    const { base, calls } = await stack();
    const noManage = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence-observations/${observationId}/review`,
      {
        method: 'POST',
        headers: headers(principal(['workspace:read', 'matter:read']), true),
        body: JSON.stringify({
          outcome: 'INCONCLUSIVE',
          reasonCode: 'INSUFFICIENT_EVIDENCE'
        })
      }
    );
    expect(noManage.status).toBe(403);

    const badSecretHeaders = headers(principal(), true);
    badSecretHeaders['x-markorbit-internal-authorization'] = 'wrong-secret-that-is-still-long-enough-to-send';
    const unauthenticated = await fetch(
      `${base}/internal/v1/formal-matters/${formalMatterId}/intelligence-observations/${observationId}/review`,
      {
        method: 'POST',
        headers: badSecretHeaders,
        body: JSON.stringify({
          outcome: 'INCONCLUSIVE',
          reasonCode: 'INSUFFICIENT_EVIDENCE'
        })
      }
    );
    expect(unauthenticated.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('exposes compact source authority read with workspace isolation and no command key', async () => {
    const { base, calls } = await stack();
    const response = await fetch(
      `${base}/internal/v1/matter-intelligence-reviews/${reviewId}/versions/1/source-authority`,
      { headers: headers(principal(['workspace:read', 'matter:read'])) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      source: { owner: 'MARKREG', kind: 'MATTER_INTELLIGENCE_REVIEW' },
      workspaceId
    });
    expect(JSON.stringify(body)).not.toContain('customer');
    expect(JSON.stringify(body)).not.toContain('payment');
    expect(calls[0]).toEqual({ requestedWorkspace: workspaceId, requestedReviewId: reviewId, version: 1 });

    const other = await fetch(
      `${base}/internal/v1/matter-intelligence-reviews/${reviewId}/versions/1/source-authority`,
      { headers: headers(principal(['workspace:read', 'matter:read'], otherWorkspaceId)) }
    );
    expect(other.status).toBe(200);
    expect(calls[1]).toEqual({
      requestedWorkspace: otherWorkspaceId,
      requestedReviewId: reviewId,
      version: 1
    });
  });
});
