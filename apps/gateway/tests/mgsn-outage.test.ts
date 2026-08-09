import { createServer } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime as createGateway, type CoreAuthenticationClient } from '../src/index.js';

const secret = 'm4-wp08-internal-secret-32-bytes-minimum';
const workspaceId = '11111111-1111-4111-8111-111111111111';
let runtime: ServiceRuntime | undefined;

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session-m4-wp08',
  userId: 'user-m4-wp08',
  workspaceId,
  membershipId: 'membership-m4-wp08',
  role: 'WORKSPACE_ADMIN',
  permissions: ['execution:read', 'execution:manage'],
  sessionExpiresAt: '2026-08-10T00:00:00.000Z'
};

const authentication: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('not used')),
  resolve: () => Promise.resolve(principal),
  resolveWorkspace: () => Promise.resolve(principal),
  revoke: () => Promise.resolve()
};

async function closedLocalPort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a local TCP port.');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  return address.port;
}

afterEach(async () => {
  if (runtime) await runtime.stop();
  runtime = undefined;
});

beforeEach(() => {
  runtime = undefined;
});

describe('M4-WP-08 Gateway reliability boundary', () => {
  it('fails closed with a controlled 503 when MGSN is unavailable', async () => {
    const port = await closedLocalPort();
    runtime = createGateway({
      port: 0,
      mgsnUrl: `http://127.0.0.1:${port}`,
      authenticationClient: authentication,
      internalServiceSecret: secret,
      csrfSecret: 'm4-wp08-csrf-secret-32-bytes-minimum',
      allowedOrigins: ['https://ops.markorbit.test']
    });
    await runtime.start();

    const response = await fetch(`http://127.0.0.1:${runtime.listeningPort}/api/mgsn/providers`, {
      headers: {
        cookie: 'mo_session=opaque',
        'x-markorbit-workspace-id': workspaceId
      }
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body.code).toBe('MGSN_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|fetch failed/i);
  });

  it('fails closed before forwarding when internal MGSN authorization is unavailable', async () => {
    runtime = createGateway({
      port: 0,
      mgsnUrl: 'http://127.0.0.1:1',
      authenticationClient: authentication,
      csrfSecret: 'm4-wp08-csrf-secret-32-bytes-minimum',
      allowedOrigins: ['https://ops.markorbit.test']
    });
    await runtime.start();

    const response = await fetch(`http://127.0.0.1:${runtime.listeningPort}/api/mgsn/providers`, {
      headers: {
        cookie: 'mo_session=opaque',
        'x-markorbit-workspace-id': workspaceId
      }
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body.code).toBe('MGSN_INTERNAL_AUTHORIZATION_UNAVAILABLE');
  });
});
