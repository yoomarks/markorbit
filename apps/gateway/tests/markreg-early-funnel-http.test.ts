import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayMarkRegEarlyFunnelRoutes } from '../src/markreg-early-funnel-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000386';
const otherWorkspaceId = '018f0000-0000-7000-8000-000000000999';
const sessionId = '018f0000-0000-7000-8000-000000000387';
const userId = '018f0000-0000-7000-8000-000000000388';
const csrfSecret = 'integration-386-csrf-secret-0123456789';
const internalServiceSecret = 'integration-386-internal-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000389',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:read', 'matter:create', 'matter:manage']
};

const intakeBody = {
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  customerIntent: {
    brandName: 'Orbit',
    applicantCountry: 'US',
    targetJurisdictions: ['US'],
    goodsServicesDescription: 'Software services'
  },
  actor: {
    actorId: 'actor_browser-spoof',
    workplaceId: 'workplace_browser-spoof',
    product: 'OPERATIONS',
    purpose: 'Customer intake'
  }
};
const quoteBody = {
  intakeId: 'intake_386',
  recommendationId: 'recommendation_386',
  selectedOptionCode: 'B',
  actor: intakeBody.actor
};
const confirmationBody = { actor: intakeBody.actor };

function client(overrides: Partial<CoreAuthenticationClient> = {}): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected')),
    resolve: () => Promise.reject(new Error('resolve is not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve(),
    ...overrides
  };
}

function routes(authenticationClient: CoreAuthenticationClient = client()) {
  return createGatewayMarkRegEarlyFunnelRoutes({
    markRegUrl: 'http://markreg.test',
    authenticationClient,
    internalServiceSecret,
    csrfSecret,
    allowedOrigins: ['https://app.example']
  });
}

function route(path: string, authenticationClient: CoreAuthenticationClient = client()) {
  const value = routes(authenticationClient).find((candidate) => candidate.path === path);
  if (!value) throw new Error(`POST ${path} route missing`);
  return value;
}

function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  params: Record<string, string> = {}
): JsonRequest {
  return {
    method: 'POST',
    path,
    body,
    params,
    query: {},
    headers: {
      cookie: 'mo_session=token-386',
      origin: 'https://app.example',
      'x-markorbit-workspace-id': workspaceId,
      'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
      'idempotency-key': 'key-386',
      'x-correlation-id': 'correlation_386',
      'x-request-id': 'request-386',
      ...headers
    }
  };
}

function response(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('MarkReg early-funnel governed Gateway mutations', () => {
  it('forwards Intake with trusted Principal-derived actor, Workspace, idempotency, and tracing', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/v1/intakes');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['idempotency-key']).toBe('key-386');
      expect(headers['x-correlation-id']).toBe('correlation_386');
      expect(headers['x-request-id']).toBe('request-386');
      const command = JSON.parse(init.body as string) as Record<string, unknown> & {
        actor: Record<string, string>;
      };
      expect(command.actor).toEqual({
        actorId: `user_${userId}`,
        workplaceId: `workspace_${workspaceId}`,
        product: 'MARKREG_COM',
        purpose: 'Customer intake'
      });
      expect(JSON.stringify(command)).not.toContain('actor_browser-spoof');
      expect(JSON.stringify(command)).not.toContain('workplace_browser-spoof');
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({ userId, workspaceId });
      return response(201, { intake: { intakeId: 'intake_386' } });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('/v1/markreg/intakes').handle(
      request('/v1/markreg/intakes', intakeBody)
    );

    expect(result.status).toBe(201);
    expect(result.headers).toEqual({ 'x-correlation-id': 'correlation_386' });
  });

  it('forwards Quote with the same governed mutation authority', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/v1/quotes');
      const command = JSON.parse(init.body as string) as { actor: Record<string, string> };
      expect(command.actor.actorId).toBe(`user_${userId}`);
      expect(command.actor.workplaceId).toBe(`workspace_${workspaceId}`);
      return response(201, { quote: { quoteId: 'quote_386' } });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('/v1/markreg/quotes').handle(
      request('/v1/markreg/quotes', quoteBody)
    );

    expect(result.status).toBe(201);
  });

  it('forwards Quote confirmation with path identity and trusted actor', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/v1/quotes/quote_386/confirm');
      const command = JSON.parse(init.body as string) as {
        quoteId: string;
        actor: Record<string, string>;
      };
      expect(command.quoteId).toBe('quote_386');
      expect(command.actor.actorId).toBe(`user_${userId}`);
      return response(200, { confirmation: { quoteId: 'quote_386' } });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('/v1/markreg/quotes/:quoteId/confirm').handle(
      request(
        '/v1/markreg/quotes/quote_386/confirm',
        confirmationBody,
        {},
        { quoteId: 'quote_386' }
      )
    );

    expect(result.status).toBe(200);
  });

  it('requires an authenticated Core session before downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route('/v1/markreg/intakes').handle(
        request('/v1/markreg/intakes', intakeBody, { cookie: '' })
      )
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('fails closed in production when Core authentication wiring is unavailable', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const productionRoutes = createGatewayMarkRegEarlyFunnelRoutes({
      markRegUrl: 'http://markreg.test',
      internalServiceSecret,
      csrfSecret,
      allowedOrigins: ['https://app.example']
    });
    const intake = productionRoutes.find((candidate) => candidate.path === '/v1/markreg/intakes');
    expect(intake).toBeDefined();
    await expect(intake!.handle(request('/v1/markreg/intakes', intakeBody))).rejects.toMatchObject({
      status: 503,
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires Workspace context from the trusted header, never the body', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route('/v1/markreg/intakes').handle(
        request(
          '/v1/markreg/intakes',
          { ...intakeBody, workspaceId },
          {
            'x-markorbit-workspace-id': ''
          }
        )
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects top-level browser authority injection before downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route('/v1/markreg/quotes').handle(
        request('/v1/markreg/quotes', { ...quoteBody, userId: 'user_spoofed' })
      )
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires matter:create permission', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const denied = client({
      resolveWorkspace: () => Promise.resolve({ ...principal, permissions: ['workspace:read'] })
    });
    await expect(
      route('/v1/markreg/quotes', denied).handle(request('/v1/markreg/quotes', quoteBody))
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('fails closed when the requested Workspace is not a current membership', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const denied = client({
      resolveWorkspace: (_token, requestedWorkspaceId) => {
        expect(requestedWorkspaceId).toBe(otherWorkspaceId);
        return Promise.reject(
          new AuthenticationError('MEMBERSHIP_REQUIRED', 'Workspace membership is required.')
        );
      }
    });
    await expect(
      route('/v1/markreg/intakes', denied).handle(
        request('/v1/markreg/intakes', intakeBody, {
          'x-markorbit-workspace-id': otherWorkspaceId
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires trusted origin and a valid CSRF token', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route('/v1/markreg/intakes').handle(
        request('/v1/markreg/intakes', intakeBody, { origin: 'https://evil.example' })
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
    await expect(
      route('/v1/markreg/intakes').handle(
        request('/v1/markreg/intakes', intakeBody, { 'x-markorbit-csrf-token': '' })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    await expect(
      route('/v1/markreg/intakes').handle(
        request('/v1/markreg/intakes', intakeBody, { 'x-markorbit-csrf-token': 'bad-token' })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('preserves downstream status/body truth and does not retry or fabricate success', async () => {
    const body = { code: 'MARKREG_CONFLICT', marker: 'owner-truth' };
    const downstream = vi.fn(() => response(409, body));
    vi.stubGlobal('fetch', downstream);
    const result = await route('/v1/markreg/quotes').handle(
      request('/v1/markreg/quotes', quoteBody)
    );
    expect(result.status).toBe(409);
    expect(result.body).toEqual(body);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('maps transport failure to explicit 503 without fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('MarkReg offline')))
    );
    await expect(
      route('/v1/markreg/quotes').handle(request('/v1/markreg/quotes', quoteBody))
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  });

  it('does not register governed routes for explicit unauthenticated fixture runtime', () => {
    expect(
      createGatewayMarkRegEarlyFunnelRoutes({
        markRegUrl: 'http://markreg.test',
        internalServiceSecret,
        csrfSecret,
        allowedOrigins: ['https://app.example'],
        fixtureTestRuntime: true
      })
    ).toEqual([]);
  });

  it('keeps exactly the three governed early-funnel mutation routes', () => {
    expect(
      routes()
        .filter((candidate) => candidate.method === 'POST')
        .map((candidate) => `${candidate.method} ${candidate.path}`)
    ).toEqual([
      'POST /v1/markreg/intakes',
      'POST /v1/markreg/quotes',
      'POST /v1/markreg/quotes/:quoteId/confirm'
    ]);
  });
});
