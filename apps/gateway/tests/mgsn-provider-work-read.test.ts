import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createGateway,
  PROVIDER_WORKSPACE_HEADER_NAME,
  type CoreAuthenticationClient
} from '../src/index.js';

const secret = 'provider-work-read-internal-secret-32-bytes';
const csrfSecret = 'provider-work-read-csrf-secret-32-bytes';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const origin = 'https://provider.markorbit.test';
const active: ServiceRuntime[] = [];
let downstream: Server;
let downstreamBase = '';
let gatewayBase = '';
let permissions: WorkspacePrincipal['permissions'] = ['execution:read'];
let captured: Array<{
  method: string | undefined;
  url: string | undefined;
  headers: Record<string, string | string[] | undefined>;
}> = [];

function principal(): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session-provider-work-read',
    userId: 'user_provider_work_read',
    workspaceId: providerWorkspaceId,
    membershipId: 'membership-provider-work-read',
    role: 'WORKSPACE_ADMIN',
    permissions,
    sessionExpiresAt: '2026-09-30T00:00:00.000Z'
  };
}

const authentication: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('not used')),
  resolve: () =>
    Promise.resolve({
      kind: 'AUTHENTICATED_USER',
      sessionId: 'session-provider-work-read',
      userId: 'user_provider_work_read',
      sessionExpiresAt: '2026-09-30T00:00:00.000Z'
    }),
  resolveWorkspace: () => Promise.resolve(principal()),
  revoke: () => Promise.resolve()
};

function browserHeaders(includeWorkspace = true) {
  return {
    cookie: 'mo_session=opaque',
    ...(includeWorkspace ? { [PROVIDER_WORKSPACE_HEADER_NAME]: providerWorkspaceId } : {})
  };
}

beforeEach(async () => {
  permissions = ['execution:read'];
  captured = [];
  downstream = createServer((request, response) => {
    captured.push({
      method: request.method,
      url: request.url,
      headers: request.headers
    });
    const url = request.url ?? '';
    if (url.includes('limit=0')) {
      response.writeHead(422, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ code: 'INVALID_QUERY', message: 'limit is invalid' }));
      return;
    }
    if (url.includes('cursor=unavailable')) {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          code: 'PROVIDER_WORK_SOURCE_UNAVAILABLE',
          message: 'Provider work source is temporarily unavailable.'
        })
      );
      return;
    }
    if (url.endsWith('/v1/provider/work-items/allocation_missing')) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          code: 'PROVIDER_WORK_ITEM_NOT_FOUND',
          message: 'Provider work item not found.'
        })
      );
      return;
    }
    if (url.startsWith('/v1/provider/work-items/')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          providerWorkItemRead: {
            schemaVersion: 1,
            decision: 'AUTHORIZED',
            allocationId: 'allocation_owned',
            readAuthorityDoesNotAuthorizeMutation: true
          }
        })
      );
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        providerWorkItemList: {
          schemaVersion: 1,
          providerWorkspaceId,
          items: [],
          page: { limit: 10 },
          readAuthorityDoesNotAuthorizeMutation: true
        }
      })
    );
  });
  await new Promise<void>((resolve) => downstream.listen(0, '127.0.0.1', resolve));
  downstreamBase = `http://127.0.0.1:${(downstream.address() as AddressInfo).port}`;

  const gateway = createGateway({
    port: 0,
    mgsnUrl: downstreamBase,
    authenticationClient: authentication,
    internalServiceSecret: secret,
    csrfSecret,
    allowedOrigins: [origin]
  });
  active.push(gateway);
  await gateway.start();
  gatewayBase = `http://127.0.0.1:${gateway.listeningPort}`;
});

afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
  await new Promise<void>((resolve, reject) =>
    downstream.close((error) => (error ? reject(error) : resolve()))
  );
});

describe('Provider Workspace own-work Gateway reads', () => {
  it('forwards only the bounded list controls with trusted Provider Workspace authority', async () => {
    const response = await fetch(`${gatewayBase}/api/provider/work-items?limit=10&cursor=opaque`, {
      headers: browserHeaders()
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"items":[]');
    expect(captured).toHaveLength(1);
    expect(captured[0]?.method).toBe('GET');
    expect(captured[0]?.url).toBe('/v1/provider/work-items?limit=10&cursor=opaque');
    expect(captured[0]?.headers['x-markorbit-workspace-id']).toBe(providerWorkspaceId);
    expect(captured[0]?.headers['x-markorbit-internal-authorization']).toBe(secret);
    expect(captured[0]?.headers['x-markorbit-principal']).toBeTruthy();
  });

  it('forwards an exact own-work detail read without mutation authority', async () => {
    const response = await fetch(`${gatewayBase}/api/provider/work-items/allocation_owned`, {
      headers: browserHeaders()
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"decision":"AUTHORIZED"');
    expect(captured[0]?.url).toBe('/v1/provider/work-items/allocation_owned');
  });

  it('requires the authenticated browser session and Provider Workspace context', async () => {
    const noSession = await fetch(`${gatewayBase}/api/provider/work-items`, {
      headers: { [PROVIDER_WORKSPACE_HEADER_NAME]: providerWorkspaceId }
    });
    expect(noSession.status).toBe(401);

    const noWorkspace = await fetch(`${gatewayBase}/api/provider/work-items`, {
      headers: { cookie: 'mo_session=opaque' }
    });
    expect(noWorkspace.status).toBe(400);
    expect(await noWorkspace.text()).toContain('"code":"PROVIDER_WORKSPACE_CONTEXT_REQUIRED"');
    expect(captured).toHaveLength(0);
  });

  it('requires execution:read before forwarding', async () => {
    permissions = [];
    const response = await fetch(`${gatewayBase}/api/provider/work-items`, {
      headers: browserHeaders()
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toContain('"code":"PERMISSION_DENIED"');
    expect(captured).toHaveLength(0);
  });

  it('rejects browser authority fields and arbitrary list controls before forwarding', async () => {
    for (const query of ['providerId=provider_spoofed', 'workspaceId=spoofed', 'sort=price']) {
      const response = await fetch(`${gatewayBase}/api/provider/work-items?${query}`, {
        headers: browserHeaders()
      });
      expect(response.status).toBe(400);
      expect(await response.text()).toContain('"code":"PROVIDER_WORK_QUERY_FORBIDDEN"');
    }
    expect(captured).toHaveLength(0);
  });

  it('rejects all query controls on the detail route', async () => {
    const response = await fetch(
      `${gatewayBase}/api/provider/work-items/allocation_owned?providerId=provider_spoofed`,
      { headers: browserHeaders() }
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('"code":"PROVIDER_WORK_QUERY_FORBIDDEN"');
    expect(captured).toHaveLength(0);
  });

  it('preserves producer 404, 422, and 503 semantics instead of manufacturing empty truth', async () => {
    const missing = await fetch(`${gatewayBase}/api/provider/work-items/allocation_missing`, {
      headers: browserHeaders()
    });
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('"code":"PROVIDER_WORK_ITEM_NOT_FOUND"');

    const invalid = await fetch(`${gatewayBase}/api/provider/work-items?limit=0`, {
      headers: browserHeaders()
    });
    expect(invalid.status).toBe(422);
    expect(await invalid.text()).toContain('"code":"INVALID_QUERY"');

    const unavailable = await fetch(`${gatewayBase}/api/provider/work-items?cursor=unavailable`, {
      headers: browserHeaders()
    });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).toContain('"code":"PROVIDER_WORK_SOURCE_UNAVAILABLE"');
  });
});
