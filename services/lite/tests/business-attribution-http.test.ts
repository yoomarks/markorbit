import { encodeInternalWorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createBusinessAttributionRoutes } from '../src/business-attribution-http.js';

const secret = 'business-attribution-secret-32-bytes-minimum';
const principal = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session_1',
  userId: 'user_1',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  membershipId: 'membership_1',
  role: 'WORKSPACE_ADMIN' as const,
  permissions: ['workspace:read' as const, 'workspace:manage' as const],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
function request(
  method: 'GET' | 'POST',
  body: unknown,
  params: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path: '',
    params,
    query: {},
    body,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': principal.workspaceId,
      'idempotency-key': 'idem-1'
    }
  };
}
function route(routes: readonly JsonRoute[], path: string): JsonRoute {
  const found = routes.find((candidate) => candidate.path === path);
  if (!found) throw new Error(`Missing route ${path}`);
  return found;
}
describe('Business attribution HTTP boundary', () => {
  it('injects trusted Workspace and actor identity and rejects spoofing', async () => {
    const create = vi.fn(() => Promise.resolve({ ok: true } as never));
    const routes = createBusinessAttributionRoutes({
      internalServiceSecret: secret,
      store: { create, find: vi.fn() }
    });
    const body = {
      motionKind: 'PORTFOLIO_GROWTH',
      sourceRefs: [{}],
      touchpointRefs: [],
      attributionState: 'UNKNOWN',
      evidenceBasis: 'HUMAN_CONFIRMED'
    };
    await route(routes, '/v1/business-attribution-links').handle(request('POST', body));
    expect(create).toHaveBeenCalledWith({
      ...body,
      workspaceId: principal.workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: 'idem-1'
    });
    await expect(
      route(routes, '/v1/business-attribution-links').handle(
        request('POST', { ...body, workspaceId: principal.workspaceId })
      )
    ).rejects.toMatchObject({ code: 'OWNER_FIELD_SPOOF_REJECTED' });
  });

  it('uses workspace:read for isolated reads', async () => {
    const find = vi.fn(() => Promise.resolve(undefined));
    const routes = createBusinessAttributionRoutes({
      internalServiceSecret: secret,
      store: { create: vi.fn(), find }
    });
    await expect(
      route(routes, '/v1/business-attribution-links/:linkId').handle(
        request('GET', undefined, { linkId: 'business-attribution_missing' })
      )
    ).rejects.toMatchObject({ status: 404 });
    expect(find).toHaveBeenCalledWith(principal.workspaceId, 'business-attribution_missing');
  });
});
