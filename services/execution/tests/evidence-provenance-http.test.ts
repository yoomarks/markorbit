import { afterEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createExecutionEvidenceProvenanceRoutes } from '../src/evidence-provenance-http.js';
import type { EvidenceReviewService } from '../src/evidence-review.js';
import type {
  ReviewedSourceAdmissionService,
  ReviewedSourceHandoffService
} from '../src/reviewed-source-handoff.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const secret = 'm5-wp06-internal-service-secret-32-bytes-minimum';
const admissionId = 'reviewed-source-admission_wp06';
const active: ServiceRuntime[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

function principal(permissions: WorkspacePrincipal['permissions'], workspace = workspaceId) {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_wp06',
    userId: 'user_wp06',
    workspaceId: workspace,
    membershipId: 'membership_wp06',
    role: 'REVIEWER',
    permissions,
    sessionExpiresAt: '2026-08-11T00:00:00.000Z'
  } satisfies WorkspacePrincipal;
}

async function stack() {
  const admissionService = {
    getAdmission: (requestedWorkspaceId: string, requestedAdmissionId: string) =>
      Promise.resolve(
        requestedWorkspaceId === workspaceId && requestedAdmissionId === admissionId
          ? {
              reviewedSourceAdmissionId: admissionId,
              workspaceId,
              reviewDecision: { id: 'evidence-review-decision_wp06', version: 1 },
              admittedEvidenceReferences: ['artifact://provider/wp06/receipt.pdf']
            }
          : undefined
      )
  } as unknown as ReviewedSourceAdmissionService;
  const reviewService = {
    getDecision: () =>
      Promise.resolve({
        evidenceReviewDecisionId: 'evidence-review-decision_wp06',
        workspaceId,
        outcome: 'ADMITTED_FOR_INTERNAL_USE',
        rationale: 'Reviewed evidence is suitable for bounded internal lifecycle use.'
      }),
    getCorrectionRequest: () =>
      Promise.resolve({
        correctionRequestId: 'evidence-correction-request_wp06',
        status: 'OPEN',
        reasons: [
          {
            code: 'ARTIFACT_HASH_MISSING',
            message: 'Corrected source was requested.',
            evidenceReferences: ['artifact://provider/wp06/receipt.pdf']
          }
        ]
      })
  } as unknown as EvidenceReviewService;
  const handoffService = {
    getDelivery: () =>
      Promise.resolve({
        status: 'DELIVERED',
        attemptCount: 2,
        markRegIdempotencyKey: 'wp05-reviewed-source:reviewed-source-admission_wp06:v1'
      })
  } as unknown as ReviewedSourceHandoffService;
  const runtime = createServiceRuntime(
    { name: 'execution-wp06-provenance-test', port: 0, version: '1' },
    {
      routes: createExecutionEvidenceProvenanceRoutes({
        internalServiceSecret: secret,
        admissionServiceFor: () => admissionService,
        evidenceReviewServiceFor: () => reviewService,
        handoffServiceFor: () => handoffService
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

function headers(value: WorkspacePrincipal) {
  return {
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId
  };
}

describe('M5-WP-06 Execution evidence provenance route', () => {
  it('requires review:perform rather than customer/read-only permissions', async () => {
    const base = await stack();
    const denied = await fetch(
      `${base}/internal/reviewed-source-admissions/${admissionId}/provenance`,
      {
        headers: headers(principal(['matter:read', 'review:read']))
      }
    );
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('returns exact review, correction and retry provenance to authorized Operations', async () => {
    const base = await stack();
    const response = await fetch(
      `${base}/internal/reviewed-source-admissions/${admissionId}/provenance`,
      { headers: headers(principal(['matter:read', 'review:read', 'review:perform'])) }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      admission: {
        reviewedSourceAdmissionId: admissionId,
        admittedEvidenceReferences: ['artifact://provider/wp06/receipt.pdf']
      },
      reviewDecision: {
        evidenceReviewDecisionId: 'evidence-review-decision_wp06',
        outcome: 'ADMITTED_FOR_INTERNAL_USE'
      },
      correctionRequest: {
        correctionRequestId: 'evidence-correction-request_wp06',
        status: 'OPEN'
      },
      handoff: {
        status: 'DELIVERED',
        attemptCount: 2,
        markRegIdempotencyKey: 'wp05-reviewed-source:reviewed-source-admission_wp06:v1'
      }
    });
  });

  it('fails closed when the Principal Workspace and transport Workspace differ', async () => {
    const base = await stack();
    const value = principal(['review:perform']);
    const response = await fetch(
      `${base}/internal/reviewed-source-admissions/${admissionId}/provenance`,
      {
        headers: {
          ...headers(value),
          'x-markorbit-workspace-id': otherWorkspaceId
        }
      }
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });
  });
});
