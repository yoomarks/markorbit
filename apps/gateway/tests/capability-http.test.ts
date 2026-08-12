import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayCapabilityRoutes } from '../src/capability-http.js';

const workspaceId = '38383838-3838-4383-8383-383838383838';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_capability_gateway',
  sessionId: 'session_capability_gateway',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_capability_gateway',
  role: 'REVIEWER',
  permissions: ['workspace:read', 'review:perform']
};
const resolveWorkspace = vi.fn(async () => principal);
const auth: CoreAuthenticationClient = {
  issue: async () => Promise.reject(new Error('not used')),
  resolve: async () => Promise.reject(new Error('not used')),
  resolveWorkspace,
  revoke: async () => undefined
};
const options = {
  capabilityEngineUrl: 'http://capability.test',
  authenticationClient: auth,
  internalServiceSecret: 'wp06-capability-internal-secret-32-bytes',
  csrfSecret: 'wp06-capability-csrf-secret-32-bytes-min',
  allowedOrigins: ['https://lite.markorbit.test']
};

function route(method: string, path: string) {
  const value = createGatewayCapabilityRoutes(options).find(
    (candidate) => candidate.method === method && candidate.path === path
  );
  if (!value) throw new Error(`route ${method} ${path} missing`);
  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway private Capability Center boundary', () => {
  it('forwards only the authenticated Core subject on reads', async () => {
    const downstream = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('http://capability.test/internal/v1/capability-center');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as {
        principal: WorkspacePrincipal;
      };
      expect(envelope.principal.userId).toBe(principal.userId);
      return new Response(
        JSON.stringify({ schemaVersion: 1, workspaceId, subjectUserId: principal.userId }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route('GET', '/api/lite/capability-center').handle({
      method: 'GET',
      path: '/api/lite/capability-center',
      params: {},
      query: {},
      headers: { cookie: 'mo_session=token', 'x-markorbit-workspace-id': workspaceId },
      body: undefined
    });
    expect(result.status).toBe(200);
    expect(resolveWorkspace).toHaveBeenCalledWith('token', workspaceId, undefined);
  });

  it('enforces trusted Origin/CSRF and forwards only exact disposition fields', async () => {
    const downstream = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body).toEqual({
        candidateVersion: 2,
        expectedCandidateFingerprintSha256: 'a'.repeat(64),
        outcome: 'ACCEPTED'
      });
      return new Response(JSON.stringify({ replayed: false }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(
      'POST',
      '/api/lite/capability-center/reflection-candidates/:reflectionCandidateId/disposition'
    ).handle({
      method: 'POST',
      path: '/api/lite/capability-center/reflection-candidates/reflection-candidate_1/disposition',
      params: { reflectionCandidateId: 'reflection-candidate_1' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://lite.markorbit.test',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'idempotency-key': 'capability-decision-1'
      },
      body: {
        candidateVersion: 2,
        expectedCandidateFingerprintSha256: 'a'.repeat(64),
        outcome: 'ACCEPTED'
      }
    });
    expect(result.status).toBe(201);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('rejects request-body subject/workspace spoofing before downstream mutation', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      route(
        'POST',
        '/api/lite/capability-center/reflection-candidates/:reflectionCandidateId/disposition'
      ).handle({
        method: 'POST',
        path: '/api/lite/capability-center/reflection-candidates/reflection-candidate_1/disposition',
        params: { reflectionCandidateId: 'reflection-candidate_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://lite.markorbit.test',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': 'unused',
          'idempotency-key': 'spoof-1'
        },
        body: {
          userId: 'attacker',
          candidateVersion: 2,
          expectedCandidateFingerprintSha256: 'a'.repeat(64),
          outcome: 'ACCEPTED'
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'SUBJECT_SPOOF_REJECTED' });
  });

  it('keeps read-only members read-only for private reflection mutation', async () => {
    resolveWorkspace.mockResolvedValueOnce({
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    });
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      route(
        'POST',
        '/api/lite/capability-center/reflection-candidates/:reflectionCandidateId/disposition'
      ).handle({
        method: 'POST',
        path: '/api/lite/capability-center/reflection-candidates/reflection-candidate_1/disposition',
        params: { reflectionCandidateId: 'reflection-candidate_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://lite.markorbit.test',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
          'idempotency-key': 'readonly-1'
        },
        body: {
          candidateVersion: 2,
          expectedCandidateFingerprintSha256: 'a'.repeat(64),
          outcome: 'DEFERRED'
        }
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });
});
