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
const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
const auth: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('not used')),
  resolve: () => Promise.reject(new Error('not used')),
  resolveWorkspace,
  revoke: () => Promise.resolve()
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

function capabilityCommand() {
  return {
    schemaVersion: 2,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    purpose: 'Prepare one bounded Lite assistance result.',
    input: { question: 'What changed?' },
    inputSchemaId: 'managed-ai-input.v1',
    outputSchemaId: 'managed-ai-output.v1',
    riskClass: 'MODERATE',
    idempotencyKey: 'lite-capability-1',
    correlationId: 'correlation_capability_1'
  };
}

function invocationHeaders(overrides: Record<string, string | undefined> = {}) {
  return {
    cookie: 'mo_session=token',
    origin: 'https://lite.markorbit.test',
    'x-markorbit-workspace-id': workspaceId,
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
    'idempotency-key': capabilityCommand().idempotencyKey,
    'x-correlation-id': capabilityCommand().correlationId,
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway private Capability Center boundary', () => {
  it('forwards only the authenticated Core subject on reads', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://capability.test/internal/v1/capability-center');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as {
        principal: WorkspacePrincipal;
      };
      expect(envelope.principal.userId).toBe(principal.userId);
      return Promise.resolve(
        new Response(
          JSON.stringify({ schemaVersion: 1, workspaceId, subjectUserId: principal.userId }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
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
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      expect(typeof init.body).toBe('string');
      if (typeof init.body !== 'string') throw new Error('Expected JSON request body.');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body).toEqual({
        candidateVersion: 2,
        expectedCandidateFingerprintSha256: 'a'.repeat(64),
        outcome: 'ACCEPTED'
      });
      return Promise.resolve(
        new Response(JSON.stringify({ replayed: false }), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        })
      );
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

describe('MO-CAP-001 WP05 trusted Gateway invocation boundary', () => {
  it('derives caller identity from the authenticated Workspace Principal and forwards trusted context', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://capability.test/v1/capability-requests');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(options.internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-markorbit-caller-product']).toBe('LITE');
      expect(headers['x-correlation-id']).toBe(capabilityCommand().correlationId);
      expect(headers['idempotency-key']).toBe(capabilityCommand().idempotencyKey);
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({
        userId: principal.userId,
        workspaceId: principal.workspaceId,
        membershipId: principal.membershipId
      });
      if (typeof init.body !== 'string') throw new Error('Expected JSON request body.');
      const body = JSON.parse(init.body) as Record<string, unknown> & {
        caller: Record<string, unknown>;
      };
      expect(body.caller).toEqual({
        workspaceId,
        principalId: principal.userId,
        callerProduct: 'LITE',
        permissionContextRef: `core-workspace-membership:${principal.membershipId}`
      });
      expect(body).not.toHaveProperty('provider');
      expect(body).not.toHaveProperty('credential');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            replayed: false,
            receipt: {
              workspaceId,
              principalId: principal.userId,
              callerProduct: 'LITE'
            }
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('POST', '/api/lite/capability-requests').handle({
      method: 'POST',
      path: '/api/lite/capability-requests',
      params: {},
      query: {},
      headers: invocationHeaders(),
      body: capabilityCommand()
    });

    expect(result.status).toBe(201);
    expect(resolveWorkspace).toHaveBeenCalledWith(
      'token',
      workspaceId,
      capabilityCommand().correlationId
    );
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('rejects caller identity spoofing before Capability Engine forwarding', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('POST', '/api/lite/capability-requests').handle({
        method: 'POST',
        path: '/api/lite/capability-requests',
        params: {},
        query: {},
        headers: invocationHeaders(),
        body: {
          ...capabilityCommand(),
          caller: {
            workspaceId: 'workspace_attacker',
            principalId: 'attacker',
            callerProduct: 'LITE',
            permissionContextRef: 'forged'
          }
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'SUBJECT_SPOOF_REJECTED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects raw provider/model/credential/implementation controls before forwarding', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('POST', '/api/lite/capability-requests').handle({
        method: 'POST',
        path: '/api/lite/capability-requests',
        params: {},
        query: {},
        headers: invocationHeaders(),
        body: {
          ...capabilityCommand(),
          provider: 'openai',
          model: 'caller-selected-model',
          credential: 'caller-secret',
          implementationProfileId: 'implementation-profile_attacker'
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'IMPLEMENTATION_CONTROL_REJECTED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('fails closed for invalid CSRF, missing idempotency, and correlation conflicts', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const handler = route('POST', '/api/lite/capability-requests');

    await expect(
      handler.handle({
        method: 'POST',
        path: '/api/lite/capability-requests',
        params: {},
        query: {},
        headers: invocationHeaders({ 'x-markorbit-csrf-token': 'invalid' }),
        body: capabilityCommand()
      })
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });

    await expect(
      handler.handle({
        method: 'POST',
        path: '/api/lite/capability-requests',
        params: {},
        query: {},
        headers: invocationHeaders({ 'idempotency-key': undefined }),
        body: capabilityCommand()
      })
    ).rejects.toMatchObject({ status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });

    await expect(
      handler.handle({
        method: 'POST',
        path: '/api/lite/capability-requests',
        params: {},
        query: {},
        headers: invocationHeaders({ 'x-correlation-id': 'different-correlation' }),
        body: capabilityCommand()
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('preserves typed Capability Engine failures without granting extra authority', async () => {
    const downstream = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'NO_APPROVED_IMPLEMENTATION',
            message: 'No approved implementation profile is available for this request.'
          }),
          { status: 409, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    vi.stubGlobal('fetch', downstream);

    const result = await route('POST', '/api/lite/capability-requests').handle({
      method: 'POST',
      path: '/api/lite/capability-requests',
      params: {},
      query: {},
      headers: invocationHeaders(),
      body: capabilityCommand()
    });

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ code: 'NO_APPROVED_IMPLEMENTATION' });
    expect(downstream).toHaveBeenCalledTimes(1);
  });
});
