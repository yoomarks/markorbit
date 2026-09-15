import { encodeInternalWorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createSiteHttpRoutesV1 } from '../src/site-http.js';

const secret = 'site-http-secret';
const principal = {
  kind: 'WORKSPACE' as const,
  sessionId: 'session_site',
  userId: 'user_site',
  workspaceId: 'workspace_site',
  membershipId: 'membership_site',
  role: 'WORKSPACE_ADMIN' as const,
  permissions: ['workspace:read' as const, 'workspace:manage' as const],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};

function request(
  path: string,
  body: unknown,
  params: Record<string, string>,
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
      'idempotency-key': 'site-command',
      ...headers
    }
  };
}

function fixture() {
  const service = {
    create: vi.fn((command) => Promise.resolve(command)),
    reviseConfiguration: vi.fn((command) => Promise.resolve(command)),
    createHostBinding: vi.fn((command) => Promise.resolve(command)),
    verifyHostBinding: vi.fn((command) => Promise.resolve(command)),
    activate: vi.fn((command) => Promise.resolve(command)),
    suspend: vi.fn((command) => Promise.resolve(command)),
    list: vi.fn(() => Promise.resolve([])),
    resolve: vi.fn(() => Promise.resolve({ schemaVersion: 1 as const }))
  };
  return {
    service,
    routes: createSiteHttpRoutesV1({ service: service as never, internalServiceSecret: secret })
  };
}

describe('Site owner HTTP boundary', () => {
  it('derives Workspace identity from the trusted Principal', async () => {
    const { routes, service } = fixture();
    await routes[0]!.handle(
      request(
        '/internal/workspaces/:workspaceId/sites',
        { workspaceId: 'attacker', kind: 'WORKSPACE_BRANDED' },
        { workspaceId: principal.workspaceId }
      )
    );
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: principal.workspaceId,
        idempotencyKey: 'site-command'
      })
    );
  });

  it('requires workspace:manage for mutation', async () => {
    const { routes, service } = fixture();
    const readOnly = encodeInternalWorkspacePrincipal({
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    });
    await expect(
      routes[0]!.handle(
        request(
          '/internal/workspaces/:workspaceId/sites',
          {},
          { workspaceId: principal.workspaceId },
          { 'x-markorbit-principal': readOnly }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('keeps public resolution behind internal service identity and rejects owner input', async () => {
    const { routes, service } = fixture();
    const route = routes[7]!;
    await expect(
      route.handle(
        request(
          '/internal/site-runtime/resolve',
          { hostname: 'a.example.com', workspaceId: 'attacker' },
          {}
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    await expect(
      route.handle(
        request(
          '/internal/site-runtime/resolve',
          { hostname: 'a.example.com' },
          {},
          { 'x-markorbit-internal-authorization': 'wrong' }
        )
      )
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(service.resolve).not.toHaveBeenCalled();
  });
});
