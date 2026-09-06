import { createServer, type Server } from 'node:http';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createRuntime as createGateway,
  csrfToken,
  GOVERNED_HUMAN_ACTION_HEADER_NAME,
  type CoreAuthenticationClient
} from '../src/index.js';

const secret = 'handoff-preparation-internal-secret-123456789';
const csrfSecret = 'handoff-preparation-csrf-secret';
const origin = 'https://workplace.markorbit.test';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const active: ServiceRuntime[] = [];
let downstream: Server | undefined;
let downstreamUrl = '';
let base = '';
let ownerStatus = 200;
let ownerPayload: unknown = {};
let receiptCalls = 0;
let captured: Array<{
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}> = [];

function principal(
  permissions: WorkspacePrincipal['permissions'] = ['workspace:read', 'workspace:manage']
): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session-handoff-preparation',
    userId: 'user_handoff_preparation',
    workspaceId,
    membershipId: 'membership-handoff-preparation',
    role: 'WORKSPACE_ADMIN',
    permissions,
    sessionCreatedAt: '2026-09-06T03:00:00.000Z',
    sessionExpiresAt: '2026-09-06T15:00:00.000Z'
  };
}

function authenticationFor(value: WorkspacePrincipal): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not used')),
    resolve: () =>
      Promise.resolve({
        kind: 'AUTHENTICATED_USER',
        sessionId: value.sessionId,
        userId: value.userId,
        ...(value.sessionCreatedAt ? { sessionCreatedAt: value.sessionCreatedAt } : {}),
        sessionExpiresAt: value.sessionExpiresAt
      }),
    resolveWorkspace: (_token, requestedWorkspaceId) => {
      if (requestedWorkspaceId !== workspaceId)
        return Promise.reject(new Error('unexpected workspace in test'));
      return Promise.resolve(value);
    },
    materializeGovernedHumanActionReceipt: () => {
      receiptCalls += 1;
      return Promise.reject(new Error('prepare must not materialize a human-action receipt'));
    },
    revoke: () => Promise.resolve()
  };
}

async function startDownstream() {
  downstream = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      captured.push({
        path: request.url ?? '',
        headers: request.headers,
        body: raw ? JSON.parse(raw) : null
      });
      response.statusCode = ownerStatus;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(ownerPayload));
    });
  });
  await new Promise<void>((resolve) => downstream!.listen(0, '127.0.0.1', resolve));
  const address = downstream.address();
  if (!address || typeof address === 'string') throw new Error('downstream did not bind');
  downstreamUrl = `http://127.0.0.1:${address.port}`;
}

async function startGateway(value = principal()) {
  const gateway = createGateway({
    port: 0,
    mgsnUrl: downstreamUrl,
    authenticationClient: authenticationFor(value),
    internalServiceSecret: secret,
    csrfSecret,
    allowedOrigins: [origin]
  });
  active.push(gateway);
  await gateway.start();
  base = `http://127.0.0.1:${gateway.listeningPort}`;
}

function headers() {
  const value = principal();
  return {
    cookie: 'mo_session=opaque',
    'x-markorbit-workspace-id': workspaceId,
    origin,
    'x-markorbit-csrf-token': csrfToken(value.sessionId, csrfSecret),
    'x-correlation-id': 'correlation-handoff-preparation',
    'content-type': 'application/json'
  };
}

function requestBody() {
  return {
    schemaVersion: 1,
    selection: {
      providerSelectionId: 'provider-selection_selected',
      version: 4,
      scopeVersion: 2
    },
    selectionScope: {
      owner: 'MGSN',
      reference: 'selection-scope_selected',
      version: 2,
      fingerprintSha256: 'a'.repeat(64)
    },
    purpose: {
      code: 'PROFESSIONAL_SERVICE_HANDOFF',
      contextReference: 'professional-context_selected',
      instructionReference: 'instruction_selected'
    },
    requestedFields: [
      {
        dataClass: 'PROVIDER_REFERENCE',
        fieldPath: 'providerId',
        sourceOwner: 'MGSN',
        sourceReference: 'provider_selected',
        necessityReference: 'need_selected_provider'
      }
    ],
    checkedAt: '2026-09-06T03:00:00.000Z',
    correlationId: 'correlation-handoff-preparation'
  };
}

async function responseBody(response: Response): Promise<unknown> {
  return response.json();
}

async function stopLatestGateway() {
  const runtime = active.pop();
  if (runtime) await runtime.stop();
}

beforeEach(async () => {
  ownerStatus = 200;
  ownerPayload = {
    controlledHandoffPreparation: {
      status: 'READY_FOR_HUMAN_REVIEW',
      ownerMarker: 'exact-owner-preview'
    }
  };
  receiptCalls = 0;
  captured = [];
  await startDownstream();
  await startGateway();
});

afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
  if (downstream)
    await new Promise<void>((resolve, reject) =>
      downstream!.close((error) => (error ? reject(error) : resolve()))
    );
  downstream = undefined;
});

describe('Workplace Controlled Handoff Preparation Gateway', () => {
  it('forwards the exact bounded request with server-side Workspace authority and no human receipt', async () => {
    const body = requestBody();
    const response = await fetch(`${base}/api/mgsn/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual(ownerPayload);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.path).toBe('/v1/governed-network/handoffs/prepare');
    expect(captured[0]!.body).toEqual(body);
    expect(captured[0]!.headers['x-markorbit-internal-authorization']).toBe(secret);
    expect(captured[0]!.headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(captured[0]!.headers['x-correlation-id']).toBe('correlation-handoff-preparation');
    expect(captured[0]!.headers['idempotency-key']).toBeUndefined();
    expect(captured[0]!.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME]).toBeUndefined();
    const encodedPrincipal = captured[0]!.headers['x-markorbit-principal'];
    expect(encodedPrincipal).toBeTypeOf('string');
    if (typeof encodedPrincipal !== 'string') throw new Error('principal header missing');
    expect(parseInternalWorkspacePrincipal(encodedPrincipal).workspaceId).toBe(workspaceId);
    expect(receiptCalls).toBe(0);
  });

  it('rejects browser-supplied preparation authority before the owner call', async () => {
    const response = await fetch(`${base}/api/mgsn/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        ...requestBody(),
        directExecutorAuthority: {
          authorityReference: 'browser-forged-authority',
          authorityVersion: 99
        }
      })
    });

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toMatchObject({
      code: 'BROWSER_GOVERNED_AUTHORITY_FORBIDDEN'
    });
    expect(captured).toHaveLength(0);
    expect(receiptCalls).toBe(0);
  });

  it('rejects a browser-supplied governed human-action envelope on preparation', async () => {
    const response = await fetch(`${base}/api/mgsn/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: {
        ...headers(),
        [GOVERNED_HUMAN_ACTION_HEADER_NAME]: 'browser-forged-human-action'
      },
      body: JSON.stringify(requestBody())
    });

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toMatchObject({
      code: 'BROWSER_GOVERNED_AUTHORITY_FORBIDDEN'
    });
    expect(captured).toHaveLength(0);
    expect(receiptCalls).toBe(0);
  });

  it('does not let broad execution permissions replace governed-network read authority', async () => {
    await stopLatestGateway();
    await startGateway(principal(['execution:read', 'execution:manage']));

    const response = await fetch(`${base}/api/mgsn/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(requestBody())
    });

    expect(response.status).toBe(403);
    expect(await responseBody(response)).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(captured).toHaveLength(0);
    expect(receiptCalls).toBe(0);
  });

  it('fails before the owner when session, Workspace, Origin or CSRF context is missing', async () => {
    const cases: Array<Record<string, string>> = [];
    const noSession = headers() as Record<string, string>;
    delete noSession.cookie;
    cases.push(noSession);
    const noWorkspace = headers() as Record<string, string>;
    delete noWorkspace['x-markorbit-workspace-id'];
    cases.push(noWorkspace);
    const noOrigin = headers() as Record<string, string>;
    delete noOrigin.origin;
    cases.push(noOrigin);
    const noCsrf = headers() as Record<string, string>;
    delete noCsrf['x-markorbit-csrf-token'];
    cases.push(noCsrf);

    for (const requestHeaders of cases) {
      const response = await fetch(`${base}/api/mgsn/governed-network/handoffs/prepare`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody())
      });
      expect([400, 401, 403]).toContain(response.status);
    }
    expect(captured).toHaveLength(0);
    expect(receiptCalls).toBe(0);
  });

  it('preserves DENIED owner truth without synthesizing a preview', async () => {
    ownerPayload = {
      controlledHandoffPreparation: {
        status: 'DENIED',
        reason: 'SELECTION_NOT_CURRENT',
        ownerMarker: 'exact-owner-denial'
      }
    };

    const response = await fetch(`${base}/api/mgsn/governed-network/handoffs/prepare`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(requestBody())
    });

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toEqual(ownerPayload);
    expect(captured).toHaveLength(1);
    expect(receiptCalls).toBe(0);
  });

  it('preserves owner fail-closed status codes and payloads including SOURCE_UNAVAILABLE', async () => {
    for (const status of [409, 422, 503]) {
      ownerStatus = status;
      ownerPayload = {
        controlledHandoffPreparation: {
          status: status === 503 ? 'SOURCE_UNAVAILABLE' : 'DENIED',
          ownerStatus: status
        }
      };
      const response = await fetch(`${base}/api/mgsn/governed-network/handoffs/prepare`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(requestBody())
      });
      expect(response.status).toBe(status);
      expect(await responseBody(response)).toEqual(ownerPayload);
    }
    expect(captured).toHaveLength(3);
    expect(receiptCalls).toBe(0);
  });
});
