import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  permissionsForRole,
  createRuntime as createCore
} from '../services/core/dist/index.js';
import { createRuntime as createGateway } from '../apps/gateway/dist/index.js';
import { HttpCoreAuthenticationClient } from '../apps/gateway/dist/index.js';
const secret = 'internal-service-test-secret-32-bytes-minimum';
const csrfSecret = 'csrf-test-secret-at-least-32-bytes-long';
const origin = 'https://test.markorbit.local';
const ids = {
  user: '01900000-0000-7000-8000-000000000001',
  workspace: '01900000-0000-7000-8000-000000000002',
  membership: '01900000-0000-7000-8000-000000000003'
};
describe('real Core and Gateway authentication HTTP', () => {
  const users = new InMemoryUserRepository(),
    workspaces = new InMemoryWorkspaceRepository(),
    memberships = new InMemoryMembershipRepository(users, workspaces),
    sessions = new InMemorySessionRepository();
  const authentication = new AuthenticationService({ users, workspaces, memberships, sessions });
  const core = createCore({ port: 0, authentication, internalServiceSecret: secret });
  let gateway: ReturnType<typeof createGateway>, base: string, coreBase: string;
  beforeAll(async () => {
    process.env.WEB_ORIGINS = origin;
    await users.create({ userId: ids.user, email: 'http@example.test', displayName: 'HTTP User' });
    await workspaces.create({
      workspaceId: ids.workspace,
      name: 'HTTP Workspace',
      slug: 'http-workspace'
    });
    await memberships.create({
      membershipId: ids.membership,
      userId: ids.user,
      workspaceId: ids.workspace,
      role: 'REVIEWER'
    });
    await core.start();
    coreBase = `http://127.0.0.1:${core.listeningPort}`;
    gateway = createGateway({
      port: 0,
      milestoneTestRuntime: true,
      authenticationClient: new HttpCoreAuthenticationClient(coreBase, secret),
      csrfSecret,
      allowedOrigins: [origin],
      fixtureUsers: { primary: ids.user }
    });
    await gateway.start();
    base = `http://127.0.0.1:${gateway.listeningPort}`;
  });
  afterAll(async () => {
    await gateway.stop();
    await core.stop();
    delete process.env.WEB_ORIGINS;
  });
  it('serves both health boundaries', async () => {
    expect((await fetch(`${coreBase}/health`)).status).toBe(200);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });
  it('rejects missing and wrong service identity', async () => {
    const call = (credential?: string) =>
      fetch(`${coreBase}/internal/auth/sessions/resolve`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(credential ? { 'x-markorbit-internal-authorization': credential } : {})
        },
        body: JSON.stringify({ token: 'invalid' })
      });
    expect((await call()).status).toBe(401);
    expect((await call('x'.repeat(40))).status).toBe(401);
  });
  async function bootstrap() {
    const response = await fetch(`${base}/__test/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fixture: 'primary' })
    });
    const body = (await response.json()) as { csrfToken: string; sessionId: string };
    const cookie = response.headers.get('set-cookie')!;
    return { response, body, cookie };
  }
  it('bootstraps only allowlisted fixtures into a real HttpOnly cookie', async () => {
    const { response, body, cookie } = await bootstrap();
    expect(response.status).toBe(201);
    expect(cookie).toMatch(/^mo_session=.*HttpOnly; SameSite=Lax/);
    expect(cookie).not.toContain('Domain=');
    expect(JSON.stringify(body)).not.toContain(cookie.split('=', 2)[1]!.split(';')[0]);
    expect(
      (
        await fetch(`${base}/__test/auth/session`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fixture: 'unknown' })
        })
      ).status
    ).toBe(403);
  });
  it('keeps bootstrap absent outside test runtime', async () => {
    const runtime = createGateway({ port: 0, milestoneTestRuntime: false });
    await runtime.start();
    try {
      expect(
        (
          await fetch(`http://127.0.0.1:${runtime.listeningPort}/__test/auth/session`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}'
          })
        ).status
      ).toBe(404);
    } finally {
      await runtime.stop();
    }
  });
  it('resolves User and Core-derived Workspace context', async () => {
    const { cookie } = await bootstrap();
    const session = await fetch(`${base}/api/auth/session`, { headers: { cookie } });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ authenticated: true, userId: ids.user });
    const context = await fetch(`${base}/api/workspaces/${ids.workspace}/context`, {
      headers: { cookie }
    });
    const workspaceContext = (await context.json()) as {
      workspaceId: string;
      membershipId: string;
      role: string;
      permissions: string[];
    };
    expect(workspaceContext).toMatchObject({
      workspaceId: ids.workspace,
      membershipId: ids.membership,
      role: 'REVIEWER'
    });
    expect(workspaceContext.permissions).toEqual(permissionsForRole('REVIEWER'));
  });
  it('rejects absent and invalid cookies', async () => {
    expect((await fetch(`${base}/api/auth/session`)).status).toBe(401);
    expect(
      (await fetch(`${base}/api/auth/session`, { headers: { cookie: 'mo_session=invalid' } }))
        .status
    ).toBe(401);
  });
  it('rejects malformed and conflicting Workspace contexts', async () => {
    const { cookie } = await bootstrap();
    expect(
      (await fetch(`${base}/api/workspaces/not-a-uuid/context`, { headers: { cookie } })).status
    ).toBe(400);
    expect(
      (
        await fetch(`${base}/api/workspaces/${ids.workspace}/context`, {
          headers: { cookie, 'x-markorbit-workspace-id': '01900000-0000-7000-8000-999999999999' }
        })
      ).status
    ).toBe(400);
  });
  it('requires Origin and CSRF, then revokes and clears', async () => {
    const { cookie, body } = await bootstrap();
    const logout = (headers: Record<string, string>) =>
      fetch(`${base}/api/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, ...headers },
        body: '{}'
      });
    expect((await logout({ origin })).status).toBe(403);
    expect((await logout({ origin, 'x-markorbit-csrf-token': 'wrong' })).status).toBe(403);
    expect((await logout({ 'x-markorbit-csrf-token': body.csrfToken })).status).toBe(403);
    const response = await logout({ origin, 'x-markorbit-csrf-token': body.csrfToken });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await fetch(`${base}/api/auth/session`, { headers: { cookie } })).status).toBe(401);
  });
  it('returns 503 when Core is unavailable', async () => {
    const runtime = createGateway({
      port: 0,
      authenticationClient: new HttpCoreAuthenticationClient('http://127.0.0.1:1', secret, 50),
      csrfSecret
    });
    await runtime.start();
    try {
      expect(
        (
          await fetch(`http://127.0.0.1:${runtime.listeningPort}/api/auth/session`, {
            headers: { cookie: 'mo_session=opaque' }
          })
        ).status
      ).toBe(503);
    } finally {
      await runtime.stop();
    }
  });
  it('emits allowlisted credentialed CORS only', async () => {
    const allowed = await fetch(`${base}/api/auth/session`, { headers: { origin } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(origin);
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true');
    const denied = await fetch(`${base}/api/auth/session`, {
      headers: { origin: 'https://evil.test' }
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });
});
