import { encodeInternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceCommercialRoutesV1 } from '../src/workspace-commercial-http.js';
import { CurrentWorkspaceAuthorityError } from '../src/current-workspace-authority.js';

const secret = 'workspace-commercial-secret-32-bytes';
const ids = {
  workspace: '018f0000-0000-7000-8000-000000001241',
  user: '018f0000-0000-7000-8000-000000001242',
  membership: '018f0000-0000-7000-8000-000000001243'
};
const authorityBody = {
  userId: ids.user,
  membershipId: ids.membership,
  expectedWorkspaceVersion: 2,
  expectedUserVersion: 3,
  expectedMembershipVersion: 4
};

function request(path: string, body: unknown, headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'POST',
    path,
    params: path.includes(':workspaceId') ? { workspaceId: ids.workspace } : {},
    query: {},
    body,
    headers: { 'x-markorbit-internal-authorization': secret, ...headers }
  };
}

function fixture() {
  const validate = vi.fn(() => Promise.resolve({ schemaVersion: 1 as const } as never));
  const listCurrentInstallations = vi.fn(() => Promise.resolve([]));
  const resolveEntitlement = vi.fn(() =>
    Promise.resolve({
      schemaVersion: 1 as const,
      subject: { scope: 'USER' as const, userId: ids.user },
      key: 'lite.access',
      value: { kind: 'BOOLEAN' as const, enabled: true },
      contributingGrantRefs: [],
      resolvedAt: '2026-09-15T00:00:00.000Z'
    })
  );
  const recordOffer = vi.fn((value) => Promise.resolve(value));
  const recordRatePolicy = vi.fn((value) => Promise.resolve(value));
  const routes = createWorkspaceCommercialRoutesV1({
    service: { listCurrentInstallations, resolveEntitlement, recordOffer, recordRatePolicy },
    currentWorkspaceAuthority: { validate },
    internalServiceSecret: secret,
    now: () => new Date('2026-09-15T00:00:00.000Z')
  });
  return { routes, validate, resolveEntitlement, recordOffer };
}

describe('Workspace commercial HTTP boundary', () => {
  it('resolves only the current authority-bound user subject', async () => {
    const { routes, validate, resolveEntitlement } = fixture();
    const route = routes[1]!;
    await route.handle(
      request('/internal/workspaces/:workspaceId/commercial/entitlements/resolve', {
        ...authorityBody,
        subjectScope: 'USER',
        entitlementKey: 'lite.access',
        asOf: '2026-09-15T00:00:00.000Z',
        subjectUserId: 'attacker-controlled-id'
      })
    );
    expect(validate).toHaveBeenCalledWith({
      workspaceId: ids.workspace,
      userId: ids.user,
      membershipId: ids.membership,
      expectedWorkspaceVersion: 2,
      expectedUserVersion: 3,
      expectedMembershipVersion: 4,
      requiredPermission: 'workspace:read'
    });
    expect(resolveEntitlement).toHaveBeenCalledWith(
      { scope: 'USER', userId: ids.user },
      'lite.access',
      '2026-09-15T00:00:00.000Z'
    );
  });

  it('fails closed on stale Workspace authority', async () => {
    const { routes, validate, resolveEntitlement } = fixture();
    validate.mockRejectedValue(
      new CurrentWorkspaceAuthorityError('CURRENT_AUTHORITY_STALE', 'stale', 409)
    );
    await expect(
      routes[1]!.handle(
        request('/internal/workspaces/:workspaceId/commercial/entitlements/resolve', {
          ...authorityBody,
          subjectScope: 'WORKSPACE',
          entitlementKey: 'site.access',
          asOf: '2026-09-15T00:00:00.000Z'
        })
      )
    ).rejects.toMatchObject({ status: 409, code: 'CURRENT_AUTHORITY_STALE' });
    expect(resolveEntitlement).not.toHaveBeenCalled();
  });

  it('requires exact commercial-admin authority for catalog mutation', async () => {
    const { routes, recordOffer } = fixture();
    const principal = encodeInternalOperatorPrincipal({
      kind: 'INTERNAL_OPERATOR',
      sessionId: 'session-test',
      userId: ids.user,
      capabilities: ['commercial-admin:read'],
      sessionExpiresAt: '2099-01-01T00:00:00.000Z'
    });
    await expect(
      routes[2]!.handle(
        request(
          '/internal/commercial/offers',
          {},
          {
            'x-markorbit-principal': principal
          }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(recordOffer).not.toHaveBeenCalled();
  });

  it('rejects an invalid internal caller before consulting authority', async () => {
    const { routes, validate } = fixture();
    await expect(
      routes[0]!.handle(
        request('/internal/workspaces/:workspaceId/commercial/installations/read', authorityBody, {
          'x-markorbit-internal-authorization': 'wrong'
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(validate).not.toHaveBeenCalled();
  });
});
