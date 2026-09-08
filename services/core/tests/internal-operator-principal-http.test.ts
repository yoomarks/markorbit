import {
  AuthenticationError,
  type ControlPlaneCapability,
  type ExecutionAdminCapability,
  type InternalOperatorPrincipal,
  type LiteAdminCapability,
  type SystemAdminCapability,
  type WorkspaceAdminCapability
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createInternalOperatorPrincipalRoutesV1 } from '../src/internal-operator-principal-http.js';

const secret = 'core-control-plane-grant-secret-32-bytes';
const cognitivePrincipal = {
  kind: 'INTERNAL_OPERATOR' as const,
  sessionId: 'session-768',
  userId: '018f0000-0000-7000-8000-000000000768',
  capabilities: ['control-plane:cognitive:read' as const],
  sessionExpiresAt: '2026-09-05T12:00:00.000Z'
};
const dataPrincipal = {
  ...cognitivePrincipal,
  capabilities: ['control-plane:data:read' as const]
};
const knowledgePrincipal = {
  ...cognitivePrincipal,
  capabilities: ['control-plane:knowledge:read' as const]
};
const workspaceAdminPrincipal = {
  ...cognitivePrincipal,
  capabilities: ['workspace-admin:read' as const]
};
const liteAdminPrincipal = {
  ...cognitivePrincipal,
  capabilities: ['lite-admin:read' as const]
};
const executionAdminPrincipal = {
  ...cognitivePrincipal,
  capabilities: ['execution-admin:read' as const]
};
const systemAdminPrincipal = {
  ...cognitivePrincipal,
  capabilities: ['system-admin:read' as const]
};
const workspaceAdminManagePrincipal = {
  ...cognitivePrincipal,
  capabilities: ['workspace-admin:manage' as const]
};

type ResolverFunction = (
  token: string,
  requiredCapability?:
    | ControlPlaneCapability
    | WorkspaceAdminCapability
    | LiteAdminCapability
    | ExecutionAdminCapability
    | SystemAdminCapability
) => Promise<Readonly<InternalOperatorPrincipal>>;

function request(
  body: unknown = { token: 'raw-session-token' },
  includeAuthorization = true
): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/control-plane/operator-principals/resolve',
    params: {},
    query: {},
    headers: includeAuthorization ? { 'x-markorbit-internal-authorization': secret } : {},
    body
  };
}

function route(resolve: ResolverFunction = vi.fn(() => Promise.resolve(cognitivePrincipal))) {
  return {
    resolve,
    route: createInternalOperatorPrincipalRoutesV1({
      resolver: { resolve },
      internalServiceSecret: secret
    })[0]!
  };
}

function workspaceRequest(
  body: unknown = { token: 'raw-session-token' },
  includeAuthorization = true
): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/super-admin/workspace/operator-principals/resolve',
    params: {},
    query: {},
    headers: includeAuthorization ? { 'x-markorbit-internal-authorization': secret } : {},
    body
  };
}

function workspaceRoute(
  resolve: ResolverFunction = vi.fn(() => Promise.resolve(workspaceAdminPrincipal))
) {
  return {
    resolve,
    route: createInternalOperatorPrincipalRoutesV1({
      resolver: { resolve },
      internalServiceSecret: secret
    })[1]!
  };
}

function liteRequest(
  body: unknown = { token: 'raw-session-token' },
  includeAuthorization = true
): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/super-admin/lite/operator-principals/resolve',
    params: {},
    query: {},
    headers: includeAuthorization ? { 'x-markorbit-internal-authorization': secret } : {},
    body
  };
}
function liteRoute(resolve: ResolverFunction = vi.fn(() => Promise.resolve(liteAdminPrincipal))) {
  return {
    resolve,
    route: createInternalOperatorPrincipalRoutesV1({
      resolver: { resolve },
      internalServiceSecret: secret
    })[2]!
  };
}

function executionRequest(
  body: unknown = { token: 'raw-session-token' },
  includeAuthorization = true
): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/super-admin/execution/operator-principals/resolve',
    params: {},
    query: {},
    headers: includeAuthorization ? { 'x-markorbit-internal-authorization': secret } : {},
    body
  };
}
function executionRoute(
  resolve: ResolverFunction = vi.fn(() => Promise.resolve(executionAdminPrincipal))
) {
  return {
    resolve,
    route: createInternalOperatorPrincipalRoutesV1({
      resolver: { resolve },
      internalServiceSecret: secret
    })[3]!
  };
}

function systemRequest(
  body: unknown = { token: 'raw-session-token' },
  includeAuthorization = true
): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/super-admin/system/operator-principals/resolve',
    params: {},
    query: {},
    headers: includeAuthorization ? { 'x-markorbit-internal-authorization': secret } : {},
    body
  };
}
function systemRoute(
  resolve: ResolverFunction = vi.fn(() => Promise.resolve(systemAdminPrincipal))
) {
  return {
    resolve,
    route: createInternalOperatorPrincipalRoutesV1({
      resolver: { resolve },
      internalServiceSecret: secret
    })[4]!
  };
}

function workspaceManageRequest(
  body: unknown = { token: 'raw-session-token' },
  includeAuthorization = true
): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/super-admin/workspace/manage/operator-principals/resolve',
    params: {},
    query: {},
    headers: includeAuthorization ? { 'x-markorbit-internal-authorization': secret } : {},
    body
  };
}

function workspaceManageRoute(
  resolve: ResolverFunction = vi.fn(() => Promise.resolve(workspaceAdminManagePrincipal))
) {
  return {
    resolve,
    route: createInternalOperatorPrincipalRoutesV1({
      resolver: { resolve },
      internalServiceSecret: secret
    })[5]!
  };
}

describe('Control Plane Internal Operator resolver HTTP boundary', () => {
  it('preserves legacy token-only cognitive resolution', async () => {
    const { resolve, route: resolverRoute } = route();

    await expect(resolverRoute.handle(request())).resolves.toEqual({
      status: 200,
      body: cognitivePrincipal
    });
    expect(resolve).toHaveBeenCalledWith('raw-session-token');
  });

  it('passes one exact requested Data read capability from the trusted internal caller', async () => {
    const resolve = vi.fn(() => Promise.resolve(dataPrincipal));
    const { route: resolverRoute } = route(resolve);

    await expect(
      resolverRoute.handle(
        request({
          token: 'raw-session-token',
          requiredCapability: 'control-plane:data:read'
        })
      )
    ).resolves.toEqual({ status: 200, body: dataPrincipal });
    expect(resolve).toHaveBeenCalledWith('raw-session-token', 'control-plane:data:read');
  });

  it('passes one exact requested Knowledge read capability from the trusted internal caller', async () => {
    const resolve = vi.fn(() => Promise.resolve(knowledgePrincipal));
    const { route: resolverRoute } = route(resolve);

    await expect(
      resolverRoute.handle(
        request({
          token: 'raw-session-token',
          requiredCapability: 'control-plane:knowledge:read'
        })
      )
    ).resolves.toEqual({ status: 200, body: knowledgePrincipal });
    expect(resolve).toHaveBeenCalledWith('raw-session-token', 'control-plane:knowledge:read');
  });

  it('resolves exact Workspace Admin read only through its dedicated internal route', async () => {
    const resolve = vi.fn(() => Promise.resolve(workspaceAdminPrincipal));
    const { route: resolverRoute } = workspaceRoute(resolve);

    await expect(resolverRoute.handle(workspaceRequest())).resolves.toEqual({
      status: 200,
      body: workspaceAdminPrincipal
    });
    expect(resolve).toHaveBeenCalledWith('raw-session-token', 'workspace-admin:read');
  });

  it('resolves exact Lite Admin read only through its dedicated internal route', async () => {
    const resolve = vi.fn(() => Promise.resolve(liteAdminPrincipal));
    const { route: resolverRoute } = liteRoute(resolve);
    await expect(resolverRoute.handle(liteRequest())).resolves.toEqual({
      status: 200,
      body: liteAdminPrincipal
    });
    expect(resolve).toHaveBeenCalledWith('raw-session-token', 'lite-admin:read');
  });

  it('resolves exact Execution Admin read only through its dedicated internal route', async () => {
    const resolve = vi.fn(() => Promise.resolve(executionAdminPrincipal));
    const { route: resolverRoute } = executionRoute(resolve);
    await expect(resolverRoute.handle(executionRequest())).resolves.toEqual({
      status: 200,
      body: executionAdminPrincipal
    });
    expect(resolve).toHaveBeenCalledWith('raw-session-token', 'execution-admin:read');
  });

  it('resolves exact System Admin read only through its dedicated internal route', async () => {
    const resolve = vi.fn(() => Promise.resolve(systemAdminPrincipal));
    const { route: resolverRoute } = systemRoute(resolve);
    await expect(resolverRoute.handle(systemRequest())).resolves.toEqual({
      status: 200,
      body: systemAdminPrincipal
    });
    expect(resolve).toHaveBeenCalledWith('raw-session-token', 'system-admin:read');
  });

  it('resolves exact Workspace Admin manage only through its dedicated internal route', async () => {
    const resolve = vi.fn(() => Promise.resolve(workspaceAdminManagePrincipal));
    const { route: resolverRoute } = workspaceManageRoute(resolve);

    await expect(resolverRoute.handle(workspaceManageRequest())).resolves.toEqual({
      status: 200,
      body: workspaceAdminManagePrincipal
    });
    expect(resolve).toHaveBeenCalledWith('raw-session-token', 'workspace-admin:manage');
  });

  it.each([
    { token: 'raw-session-token', requiredCapability: 'workspace-admin:manage' },
    { token: 'raw-session-token', capabilities: ['workspace-admin:manage'] },
    { token: 'raw-session-token', principal: workspaceAdminManagePrincipal },
    { token: 'raw-session-token', extra: true }
  ])(
    'rejects Workspace Admin manage authority manufacture on the dedicated route',
    async (body) => {
      const { resolve, route: resolverRoute } = workspaceManageRoute();
      await expect(resolverRoute.handle(workspaceManageRequest(body))).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_REQUEST'
      });
      expect(resolve).not.toHaveBeenCalled();
    }
  );

  it('requires internal service identity on the dedicated Workspace Admin manage resolver', async () => {
    const { resolve, route: resolverRoute } = workspaceManageRoute();
    await expect(
      resolverRoute.handle(workspaceManageRequest(undefined, false))
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    { token: 'raw-session-token', requiredCapability: 'control-plane:data:read' },
    { token: 'raw-session-token', capabilities: ['workspace-admin:read'] },
    { token: 'raw-session-token', principal: workspaceAdminPrincipal },
    { token: 'raw-session-token', extra: true }
  ])('rejects Workspace Admin authority manufacture on the dedicated route', async (body) => {
    const { resolve, route: resolverRoute } = workspaceRoute();
    await expect(resolverRoute.handle(workspaceRequest(body))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('requires internal service identity on the dedicated Workspace Admin resolver', async () => {
    const { resolve, route: resolverRoute } = workspaceRoute();
    await expect(resolverRoute.handle(workspaceRequest(undefined, false))).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('allows an explicit cognitive read request without changing its authority', async () => {
    const { resolve, route: resolverRoute } = route();

    await resolverRoute.handle(
      request({
        token: 'raw-session-token',
        requiredCapability: 'control-plane:cognitive:read'
      })
    );
    expect(resolve).toHaveBeenCalledWith('raw-session-token', 'control-plane:cognitive:read');
  });

  it('requires internal service identity before touching session or grant truth', async () => {
    const { resolve, route: resolverRoute } = route();

    await expect(resolverRoute.handle(request(undefined, false))).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ['missing token', {}],
    [
      'capability array injection',
      { token: 'raw-session-token', capabilities: ['control-plane:data:read'] }
    ],
    ['principal injection', { token: 'raw-session-token', principal: dataPrincipal }],
    [
      'unsupported Data operate capability',
      { token: 'raw-session-token', requiredCapability: 'control-plane:data:operate' }
    ],
    [
      'unsupported Knowledge operate capability',
      { token: 'raw-session-token', requiredCapability: 'control-plane:knowledge:operate' }
    ],
    [
      'commercial capability in Control Plane resolver',
      { token: 'raw-session-token', requiredCapability: 'commercial-admin:read' }
    ],
    ['non-object body', 'raw-session-token']
  ])('rejects %s without allowing authority manufacture', async (_label, body) => {
    const { resolve, route: resolverRoute } = route();

    await expect(resolverRoute.handle(request(body))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('preserves explicit missing-grant denial as 403', async () => {
    const { route: resolverRoute } = route(
      vi.fn(() =>
        Promise.reject(new AuthenticationError('PERMISSION_DENIED', 'Explicit grant is required.'))
      )
    );

    await expect(
      resolverRoute.handle(
        request({ token: 'raw-session-token', requiredCapability: 'control-plane:data:read' })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('preserves requested grant-source failure as retryable 503', async () => {
    const { route: resolverRoute } = route(
      vi.fn(() =>
        Promise.reject(
          new AuthenticationError(
            'AUTHENTICATION_SERVICE_UNAVAILABLE',
            'Data read grant source is unavailable.'
          )
        )
      )
    );

    await expect(
      resolverRoute.handle(
        request({ token: 'raw-session-token', requiredCapability: 'control-plane:data:read' })
      )
    ).rejects.toMatchObject({
      status: 503,
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE',
      retryable: true
    });
  });
});
