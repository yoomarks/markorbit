import { describe, expect, it } from 'vitest';
import { AuthenticationError, type InternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { createGatewayAccountAccessRoutes } from '../src/account-access-http.js';
import type { CommercialAdminAccountInspection, CoreAuthenticationClient } from '../src/auth.js';

const sessionToken = 'opaque-internal-session';
const operator: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: '018f0000-0000-7000-8000-000000000090',
  userId: '018f0000-0000-7000-8000-000000000091',
  capabilities: ['commercial-admin:read', 'commercial-admin:operate'],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const inspection: CommercialAdminAccountInspection = {
  source: { domain: 'CORE', authority: 'ACCOUNT_AND_WORKSPACE' },
  account: {
    userId: '018f0000-0000-7000-8000-000000000001',
    email: 'customer@example.com',
    displayName: 'Customer',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2098-01-01T00:00:00.000Z',
    updatedAt: '2098-01-01T00:00:00.000Z',
    profileCreatedAt: '2098-01-01T00:00:00.000Z',
    profileUpdatedAt: '2098-01-01T00:00:00.000Z'
  },
  workspaces: [
    {
      workspace: {
        workspaceId: '018f0000-0000-7000-8000-000000000010',
        name: 'Customer Workspace',
        slug: 'customer-workspace',
        status: 'ACTIVE',
        version: 1,
        createdAt: '2098-01-01T00:00:00.000Z',
        updatedAt: '2098-01-01T00:00:00.000Z'
      },
      membership: {
        membershipId: '018f0000-0000-7000-8000-000000000011',
        workspaceId: '018f0000-0000-7000-8000-000000000010',
        userId: '018f0000-0000-7000-8000-000000000001',
        role: 'WORKSPACE_ADMIN',
        status: 'ACTIVE',
        version: 1,
        createdAt: '2098-01-01T00:00:00.000Z',
        updatedAt: '2098-01-01T00:00:00.000Z'
      }
    }
  ]
};

function client(overrides: Partial<CoreAuthenticationClient> = {}): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not used')),
    resolve: () => Promise.reject(new Error('not used')),
    resolveWorkspace: () => Promise.reject(new Error('not used')),
    resolveInternalOperator: () => Promise.resolve(operator),
    inspectCommercialAdminAccount: () => Promise.resolve(inspection),
    revoke: () => Promise.resolve(),
    ...overrides
  };
}

function request(cookie = `mo_session=${sessionToken}`): JsonRequest {
  return {
    body: undefined,
    headers: {
      cookie,
      'x-correlation-id': 'correlation_commercial_admin_account'
    },
    method: 'GET',
    path: '',
    params: { userId: inspection.account.userId },
    query: {}
  };
}

function routes(authenticationClient: CoreAuthenticationClient) {
  return createGatewayAccountAccessRoutes({
    authenticationClient,
    csrfSecret: 's'.repeat(32),
    allowedOrigins: ['https://ops.example'],
    secureCookies: false
  });
}

describe('Gateway commercial admin account boundary', () => {
  it('rejects anonymous access before attempting internal operator resolution', async () => {
    let resolved = false;
    const route = routes(
      client({
        resolveInternalOperator: () => {
          resolved = true;
          return Promise.resolve(operator);
        }
      })
    ).find((item) => item.path === '/api/internal/commercial-admin/accounts/:userId')!;

    await expect(route.handle(request(''))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(resolved).toBe(false);
  });

  it('rejects a normal customer or Workspace admin when Core denies commercial-admin capability', async () => {
    const route = routes(
      client({
        resolveInternalOperator: () =>
          Promise.reject(
            new AuthenticationError('PERMISSION_DENIED', 'Commercial admin capability is required.')
          )
      })
    ).find((item) => item.path === '/api/internal/commercial-admin/accounts/:userId')!;

    await expect(route.handle(request())).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
  });

  it('uses the opaque session token to resolve INTERNAL authority and inspect the requested account', async () => {
    let resolvedToken = '';
    let inspectedToken = '';
    let inspectedUserId = '';
    const route = routes(
      client({
        resolveInternalOperator: (token) => {
          resolvedToken = token;
          return Promise.resolve(operator);
        },
        inspectCommercialAdminAccount: (token, userId) => {
          inspectedToken = token;
          inspectedUserId = userId;
          return Promise.resolve(inspection);
        }
      })
    ).find((item) => item.path === '/api/internal/commercial-admin/accounts/:userId')!;

    const response = await route.handle(request());
    expect(response.status).toBe(200);
    expect(response.body).toEqual(inspection);
    expect(resolvedToken).toBe(sessionToken);
    expect(inspectedToken).toBe(sessionToken);
    expect(inspectedUserId).toBe(inspection.account.userId);
    expect(JSON.stringify(response.body)).not.toContain('password');
  });

  it('exposes the server-derived operator capability set without accepting browser role claims', async () => {
    const route = routes(client()).find(
      (item) => item.path === '/api/internal/commercial-admin/operator'
    )!;
    const malicious = request();
    malicious.headers['x-markorbit-role'] = 'WORKSPACE_ADMIN';
    malicious.headers['x-markorbit-account-type'] = 'INTERNAL';

    const response = await route.handle(malicious);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(operator);
    expect(operator.capabilities).toContain('commercial-admin:read');
  });
});
