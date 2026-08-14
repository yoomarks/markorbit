import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  type AccountAccessResult,
  type WorkspaceEntry
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { createGatewayAccountAccessRoutes } from '../src/account-access-http.js';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';

const csrfSecret = 's'.repeat(32);
const result: AccountAccessResult = {
  account: {
    userId: '018f0000-0000-7000-8000-000000000001',
    email: 'user@example.com',
    displayName: 'User',
    accountType: 'CUSTOMER'
  },
  rawToken: 'opaque-session-token',
  session: {
    sessionId: '018f0000-0000-7000-8000-000000000002',
    userId: '018f0000-0000-7000-8000-000000000001',
    status: 'ACTIVE',
    createdAt: '2098-01-01T00:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    revokedAt: null,
    version: 1
  }
};
const workspace: WorkspaceEntry = {
  workspace: {
    workspaceId: '018f0000-0000-7000-8000-000000000010',
    name: 'User Workspace',
    slug: 'user-workspace',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2098-01-01T00:00:00.000Z',
    updatedAt: '2098-01-01T00:00:00.000Z'
  },
  membership: {
    membershipId: '018f0000-0000-7000-8000-000000000011',
    workspaceId: '018f0000-0000-7000-8000-000000000010',
    userId: result.account.userId,
    role: 'WORKSPACE_ADMIN',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2098-01-01T00:00:00.000Z',
    updatedAt: '2098-01-01T00:00:00.000Z'
  }
};

function client(overrides: Partial<CoreAuthenticationClient> = {}): CoreAuthenticationClient {
  return {
    register: () => Promise.resolve(result),
    login: () => Promise.resolve(result),
    createWorkspace: () => Promise.resolve(workspace),
    listWorkspaces: () => Promise.resolve([workspace]),
    issue: () => Promise.resolve({ rawToken: result.rawToken, session: result.session }),
    resolve: () =>
      Promise.resolve({
        kind: 'AUTHENTICATED_USER',
        sessionId: result.session.sessionId,
        userId: result.account.userId,
        sessionExpiresAt: result.session.expiresAt
      }),
    resolveWorkspace: () => Promise.reject(new Error('not used')),
    revoke: () => Promise.resolve(),
    ...overrides
  };
}

function request(
  body: unknown,
  origin = 'https://app.example',
  headers: Record<string, string> = {}
): JsonRequest {
  return {
    body,
    headers: { origin, 'x-correlation-id': 'correlation_account_access', ...headers },
    method: 'POST',
    path: '',
    params: {},
    query: {}
  };
}

function authenticatedRequest(body: unknown = undefined): JsonRequest {
  return request(body, 'https://app.example', {
    cookie: `mo_session=${result.rawToken}`,
    'x-markorbit-csrf-token': csrfToken(result.session.sessionId, csrfSecret)
  });
}

function routes(authenticationClient: CoreAuthenticationClient) {
  return createGatewayAccountAccessRoutes({
    authenticationClient,
    csrfSecret,
    allowedOrigins: ['https://app.example'],
    secureCookies: false
  });
}

describe('Gateway real account access', () => {
  it('registers a browser account, sets HttpOnly session cookie, and never returns the raw token', async () => {
    const route = routes(client()).find((value) => value.path === '/api/auth/register')!;
    const response = await route.handle(
      request({
        email: 'user@example.com',
        displayName: 'User',
        password: 'secure password',
        accountType: 'CUSTOMER'
      })
    );
    expect(response.status).toBe(201);
    expect(response.headers?.['set-cookie']).toContain('mo_session=opaque-session-token');
    expect(response.headers?.['set-cookie']).toContain('HttpOnly');
    expect(JSON.stringify(response.body)).not.toContain(result.rawToken);
    expect(response.body).toMatchObject({
      authenticated: true,
      account: { accountType: 'CUSTOMER' }
    });
  });

  it('logs in and establishes the same browser session boundary', async () => {
    const route = routes(client()).find((value) => value.path === '/api/auth/login')!;
    const response = await route.handle(
      request({ email: 'user@example.com', password: 'secure password' })
    );
    expect(response.status).toBe(200);
    expect(response.headers?.['set-cookie']).toContain('SameSite=Lax');
    expect(response.body).toMatchObject({ authenticated: true });
  });

  it('requires a trusted browser origin before registration or login', async () => {
    const route = routes(client()).find((value) => value.path === '/api/auth/register')!;
    await expect(
      route.handle(
        request(
          {
            email: 'user@example.com',
            displayName: 'User',
            password: 'secure password',
            accountType: 'CUSTOMER'
          },
          'https://evil.example'
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
  });

  it('maps duplicate registration and bad login without exposing Core details', async () => {
    const duplicateClient = client({
      register: () =>
        Promise.reject(
          new AuthenticationError(
            'EMAIL_ALREADY_REGISTERED',
            'An account with that email already exists.'
          )
        )
    });
    const register = routes(duplicateClient).find((value) => value.path === '/api/auth/register')!;
    await expect(
      register.handle(
        request({
          email: 'user@example.com',
          displayName: 'User',
          password: 'secure password',
          accountType: 'CUSTOMER'
        })
      )
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' });

    const invalidClient = client({
      login: () =>
        Promise.reject(
          new AuthenticationError('INVALID_CREDENTIALS', 'Email or password is incorrect.')
        )
    });
    const login = routes(invalidClient).find((value) => value.path === '/api/auth/login')!;
    await expect(
      login.handle(request({ email: 'user@example.com', password: 'wrong password' }))
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('lists the authenticated user workspaces without trusting a user id from the browser', async () => {
    let listedUserId = '';
    const route = routes(
      client({
        listWorkspaces: (userId) => {
          listedUserId = userId;
          return Promise.resolve([workspace]);
        }
      })
    ).find((value) => value.method === 'GET' && value.path === '/api/workspaces')!;
    const response = await route.handle(authenticatedRequest());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ workspaces: [workspace] });
    expect(listedUserId).toBe(result.account.userId);
  });

  it('creates a WORKSPACE_ADMIN workspace through the authenticated session and CSRF boundary', async () => {
    let createdFor = '';
    const route = routes(
      client({
        createWorkspace: (userId) => {
          createdFor = userId;
          return Promise.resolve(workspace);
        }
      })
    ).find((value) => value.method === 'POST' && value.path === '/api/workspaces')!;
    const response = await route.handle(authenticatedRequest({ name: 'User Workspace' }));
    expect(response.status).toBe(201);
    expect(response.body).toEqual(workspace);
    expect(createdFor).toBe(result.account.userId);
    expect(workspace.membership.role).toBe('WORKSPACE_ADMIN');
  });

  it('rejects workspace creation without the session CSRF token', async () => {
    const route = routes(client()).find(
      (value) => value.method === 'POST' && value.path === '/api/workspaces'
    )!;
    await expect(
      route.handle(
        request({ name: 'Blocked Workspace' }, 'https://app.example', {
          cookie: `mo_session=${result.rawToken}`
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
  });
});
