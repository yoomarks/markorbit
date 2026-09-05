import { afterEach, describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type AuthenticatedUserPrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { createServiceRuntime, json, type ServiceRuntime } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createRuntime as createGateway } from '../src/index.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const secret = 'examination-gateway-internal-secret-32-bytes-minimum';
const active: ServiceRuntime[] = [];
const observations: {
  formalMatterId: string;
  method: string;
  body: unknown;
  headers: Readonly<Record<string, string | undefined>>;
}[] = [];

afterEach(async () => {
  observations.splice(0);
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
});

function workspacePrincipal(token: string): WorkspacePrincipal {
  const permissions = token === 'denied' ? (['review:read'] as const) : (['matter:read'] as const);
  return {
    kind: 'WORKSPACE',
    sessionId: `session_${token}`,
    userId: `user_${token}`,
    workspaceId,
    membershipId: `membership_${token}`,
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-09-06T00:00:00.000Z'
  };
}

const authenticationClient = {
  resolveWorkspace(token: string, requestedWorkspaceId: string) {
    if (token === 'expired')
      return Promise.reject(new AuthenticationError('INVALID_SESSION', 'Session expired.'));
    if (requestedWorkspaceId !== workspaceId)
      return Promise.reject(new AuthenticationError('MEMBERSHIP_REQUIRED', 'Membership required.'));
    return Promise.resolve(workspacePrincipal(token));
  },
  resolve(token: string): Promise<AuthenticatedUserPrincipal> {
    if (token === 'expired')
      return Promise.reject(new AuthenticationError('INVALID_SESSION', 'Session expired.'));
    const principal = workspacePrincipal(token);
    return Promise.resolve({
      kind: 'AUTHENTICATED_USER',
      sessionId: principal.sessionId,
      userId: principal.userId,
      sessionExpiresAt: principal.sessionExpiresAt
    });
  },
  issue() {
    return Promise.reject(new Error('not used'));
  },
  revoke() {
    return Promise.resolve();
  }
} as CoreAuthenticationClient;

async function start(runtime: ServiceRuntime) {
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

const authorityConsequences = Object.freeze({
  protectedActionAuthorized: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentCreated: false,
  providerContacted: false,
  officeMutationCreated: false,
  officialTruthCreated: false
});

function examination(formalMatterId: string, status: 'ESTABLISHED' | 'NOT_ESTABLISHED') {
  return {
    schemaVersion: 1,
    workspaceId,
    formalMatter: { id: formalMatterId, version: 1 },
    status,
    current:
      status === 'ESTABLISHED'
        ? {
            lifecycleEvent: {
              id: 'lifecycle-event_examination-gateway',
              version: 2,
              fingerprintSha256: 'a'.repeat(64)
            },
            lifecycleView: {
              id: 'lifecycle-view_examination-gateway',
              version: 3,
              fingerprintSha256: 'b'.repeat(64)
            },
            workflowState: 'CUSTOMER_ACTION_NEEDED',
            eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
            customerSafeLabel: 'Customer action needed',
            customerSafeSummary: 'Reviewed evidence requires customer attention.',
            sourceClass: 'REVIEWED_EXTERNAL_EVIDENCE',
            projectionClass: 'INTERNAL_PRODUCT_PROJECTION',
            sourceCurrentness: 'CURRENT',
            officialStatusVerified: false
          }
        : null,
    history: [],
    deadline: null,
    deadlineStatus: 'UNAVAILABLE',
    officialStatusVerified: false,
    authorityConsequences
  };
}

async function stack() {
  const markReg = createServiceRuntime(
    { name: 'markreg-examination-gateway-test', port: 0, version: '1' },
    {
      routes: [
        {
          method: 'GET',
          path: '/internal/v1/formal-matters/:formalMatterId/examination',
          handle: (request) => {
            const formalMatterId = request.params.formalMatterId!;
            observations.push({
              formalMatterId,
              method: request.method,
              body: request.body,
              headers: request.headers
            });
            if (formalMatterId === 'formal-matter_missing')
              return json(404, {
                code: 'FORMAL_MATTER_NOT_FOUND',
                message: 'Formal Matter was not found.'
              });
            if (formalMatterId === 'formal-matter_stale')
              return json(409, {
                code: 'EXAMINATION_SOURCE_STALE',
                message: 'Examination source truth is stale.'
              });
            if (formalMatterId === 'formal-matter_unavailable')
              return json(503, {
                code: 'EXAMINATION_TRUTH_UNAVAILABLE',
                message: 'Examination truth is unavailable.',
                retryable: true
              });
            const status =
              formalMatterId === 'formal-matter_absent' ? 'NOT_ESTABLISHED' : 'ESTABLISHED';
            return json(200, { examination: examination(formalMatterId, status) });
          }
        }
      ]
    }
  );
  const markRegUrl = await start(markReg);
  const gateway = createGateway({
    port: 0,
    markRegUrl,
    authenticationClient,
    internalServiceSecret: secret,
    csrfSecret: 'unused-for-get',
    allowedOrigins: []
  });
  return start(gateway);
}

function browserHeaders(token = 'customer', workspace = workspaceId) {
  return {
    cookie: `mo_session=${token}`,
    'x-markorbit-workspace-id': workspace
  };
}

const endpoint = (base: string, formalMatterId: string) =>
  `${base}/api/markreg/formal-matters/${formalMatterId}/examination`;

describe('authenticated Examination Stage V1 Gateway read', () => {
  it('forwards ESTABLISHED and NOT_ESTABLISHED owner truth without changing authority meaning', async () => {
    const base = await stack();
    for (const [formalMatterId, status] of [
      ['formal-matter_established', 'ESTABLISHED'],
      ['formal-matter_absent', 'NOT_ESTABLISHED']
    ] as const) {
      const response = await fetch(endpoint(base, formalMatterId), {
        headers: browserHeaders()
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        examination: examination(formalMatterId, status)
      });
    }
  });

  it('derives internal service authority server-side and keeps the read consequence-free', async () => {
    const base = await stack();
    const trustedPrincipal = workspacePrincipal('customer');
    const response = await fetch(endpoint(base, 'formal-matter_established'), {
      headers: {
        ...browserHeaders(),
        'x-markorbit-internal-authorization': 'browser-spoofed-secret',
        'x-markorbit-principal': 'browser-spoofed-principal'
      }
    });
    expect(response.status).toBe(200);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      formalMatterId: 'formal-matter_established',
      method: 'GET',
      body: undefined
    });
    expect(observations[0]?.headers['x-markorbit-internal-authorization']).toBe(secret);
    expect(observations[0]?.headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(observations[0]?.headers['x-markorbit-principal']).toBe(
      encodeInternalWorkspacePrincipal(trustedPrincipal)
    );
  });

  it('requires an authenticated Workspace membership and matter:read before calling MarkReg', async () => {
    const base = await stack();

    const unauthenticated = await fetch(endpoint(base, 'formal-matter_established'), {
      headers: { 'x-markorbit-workspace-id': workspaceId }
    });
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });

    const denied = await fetch(endpoint(base, 'formal-matter_established'), {
      headers: browserHeaders('denied')
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });

    const foreignWorkspace = await fetch(endpoint(base, 'formal-matter_established'), {
      headers: browserHeaders('customer', otherWorkspaceId)
    });
    expect(foreignWorkspace.status).toBe(403);
    expect(await foreignWorkspace.json()).toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });

    expect(observations).toHaveLength(0);
  });

  it('preserves owner 404, 409 and retryable 503 instead of fabricating Examination absence', async () => {
    const base = await stack();
    for (const [formalMatterId, status, code] of [
      ['formal-matter_missing', 404, 'FORMAL_MATTER_NOT_FOUND'],
      ['formal-matter_stale', 409, 'EXAMINATION_SOURCE_STALE'],
      ['formal-matter_unavailable', 503, 'EXAMINATION_TRUTH_UNAVAILABLE']
    ] as const) {
      const response = await fetch(endpoint(base, formalMatterId), {
        headers: browserHeaders()
      });
      expect(response.status).toBe(status);
      const body: unknown = await response.json();
      expect(body).toMatchObject({ code });
      expect(body).not.toHaveProperty('examination.status', 'NOT_ESTABLISHED');
    }
  });
});
