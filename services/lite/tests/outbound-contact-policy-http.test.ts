import { encodeInternalWorkspacePrincipal } from '@markorbit/contracts';
import {
  noOutboundContactBasisAuthorityConsequencesV1,
  noOutboundContactReadinessAuthorityConsequencesV1
} from '@markorbit/contracts/outbound-contact-policy';
import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createOutboundContactPolicyRoutes } from '../src/outbound-contact-policy-http.js';
import type {
  AssertOutboundContactBasisCommand,
  EvaluateOutboundContactReadinessCommand
} from '../src/outbound-contact-policy.js';
const secret = 'outbound-contact-http-secret-32-bytes-minimum';
const principal = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session_1',
  userId: 'user_admin',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  membershipId: 'membership_1',
  role: 'WORKSPACE_ADMIN' as const,
  permissions: ['workspace:read' as const, 'workspace:manage' as const],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
function req(
  path: string,
  body: unknown,
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
): JsonRequest {
  return {
    method: 'POST',
    path,
    params,
    query: {},
    body,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': principal.workspaceId,
      'idempotency-key': 'idem-1',
      ...headers
    }
  };
}
function route(routes: readonly JsonRoute[], path: string) {
  const r = routes.find((x) => x.path === path);
  if (!r) throw new Error(`missing ${path}`);
  return r;
}
function fixture() {
  const store = {
    assertBasis: vi.fn((x: Readonly<AssertOutboundContactBasisCommand>) =>
      Promise.resolve({
        schemaVersion: 1 as const,
        assertionId: 'outbound-contact-basis_http-test' as const,
        workspaceId: x.workspaceId,
        version: 1,
        targetRef: x.targetRef,
        channel: 'EMAIL' as const,
        endpointFingerprintSha256: x.endpointFingerprintSha256,
        purpose: x.purpose,
        ...(x.marketOrJurisdiction === undefined
          ? {}
          : { marketOrJurisdiction: x.marketOrJurisdiction }),
        policyRef: x.policyRef,
        basisState: x.basisState,
        evidenceRefs: x.evidenceRefs,
        assertedByPrincipalId: x.actorPrincipalId,
        assertedAt: '2026-09-16T00:00:00.000Z',
        status: 'ACTIVE' as const,
        supersedesVersion: null,
        authorityConsequences: noOutboundContactBasisAuthorityConsequencesV1
      })
    ),
    revokeBasis: vi.fn(),
    supersedeBasis: vi.fn(),
    setSuppression: vi.fn(),
    clearSuppression: vi.fn(),
    evaluate: vi.fn((x: Readonly<EvaluateOutboundContactReadinessCommand>) =>
      Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId: x.workspaceId,
        evaluatedByPrincipalId: x.actorPrincipalId,
        targetRef: x.targetRef,
        channel: 'EMAIL' as const,
        endpointFingerprintSha256: x.endpointFingerprintSha256,
        purpose: x.purpose,
        policyRef: x.policyRef,
        reviewedSendFingerprintSha256: x.reviewedSendFingerprintSha256,
        outcome: 'UNKNOWN' as const,
        reason: 'NO_CURRENT_ASSERTION' as const,
        suppressionRefs: [],
        evaluatedAt: '2026-09-16T00:00:00.000Z',
        readinessFingerprintSha256: 'c'.repeat(64),
        authorityConsequences: noOutboundContactReadinessAuthorityConsequencesV1
      })
    )
  };
  return {
    store,
    routes: createOutboundContactPolicyRoutes({
      internalServiceSecret: secret,
      store
    })
  };
}
describe('Outbound contact policy HTTP boundary', () => {
  it('injects Workspace and actor identity into durable basis assertions', async () => {
    const { store, routes } = fixture();
    const body = {
      targetRef: { owner: 'LITE', kind: 'PROSPECT', id: 'candidate_1', version: 1 },
      endpointFingerprintSha256: 'a'.repeat(64),
      purpose: 'PROSPECT_OUTREACH',
      policyRef: { policyId: 'policy_1', version: 1 },
      basisState: 'ASSERTED_ALLOWED',
      evidenceRefs: ['review:1']
    };
    await route(routes, '/v1/outbound-contact-policy/basis-assertions').handle(
      req('/v1/outbound-contact-policy/basis-assertions', body)
    );
    expect(store.assertBasis).toHaveBeenCalledWith({
      ...body,
      workspaceId: principal.workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: 'idem-1'
    });
  });
  it('rejects caller-owned authority or identity fields', async () => {
    const { store, routes } = fixture();
    await expect(
      route(routes, '/v1/outbound-contact-policy/basis-assertions').handle(
        req('', { workspaceId: principal.workspaceId })
      )
    ).rejects.toMatchObject({ status: 400, code: 'OWNER_FIELD_SPOOF_REJECTED' });
    expect(store.assertBasis).not.toHaveBeenCalled();
  });
  it('requires workspace:manage for policy mutation but only workspace:read for JIT readiness', async () => {
    const { store, routes } = fixture();
    const readOnly = encodeInternalWorkspacePrincipal({
      ...principal,
      role: 'READ_ONLY' as const,
      permissions: ['workspace:read' as const]
    });
    await expect(
      route(routes, '/v1/outbound-contact-policy/suppressions').handle(
        req('', {}, {}, { 'x-markorbit-principal': readOnly })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    const readiness = {
      targetRef: { owner: 'LITE', kind: 'PROSPECT', id: 'candidate_1', version: 1 },
      endpointFingerprintSha256: 'a'.repeat(64),
      purpose: 'PROSPECT_OUTREACH',
      policyRef: { policyId: 'policy_1', version: 1 },
      reviewedSendFingerprintSha256: 'b'.repeat(64)
    };
    await route(routes, '/v1/outbound-contact-policy/readiness/evaluate').handle(
      req('', readiness, {}, { 'x-markorbit-principal': readOnly, 'idempotency-key': '' })
    );
    expect(store.evaluate).toHaveBeenCalledWith({
      ...readiness,
      workspaceId: principal.workspaceId,
      actorPrincipalId: principal.userId
    });
  });
});
