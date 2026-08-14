import { describe, expect, it } from 'vitest';
import { AuthenticationError, type AccountAccessResult } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { createGatewayAccountAccessRoutes } from '../src/account-access-http.js';
import type { CoreAuthenticationClient } from '../src/auth.js';

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

function client(overrides: Partial<CoreAuthenticationClient> = {}): CoreAuthenticationClient {
  return {
    register: () => Promise.resolve(result),
    login: () => Promise.resolve(result),
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

function request(body: unknown, origin = 'https://app.example'): JsonRequest {
  return {
    body,
    headers: { origin, 'x-correlation-id': 'correlation_account_access' },
    method: 'POST',
    path: '',
    params: {},
    query: {}
  };
}

function routes(authenticationClient: CoreAuthenticationClient) {
  return createGatewayAccountAccessRoutes({
    authenticationClient,
    csrfSecret: 's'.repeat(32),
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
});
