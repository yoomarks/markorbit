import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayMarkRegEarlyFunnelRoutes } from '../src/markreg-early-funnel-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000698';
const sessionId = '018f0000-0000-7000-8000-000000000699';
const userId = '018f0000-0000-7000-8000-000000000700';
const csrfSecret = 'integration-698-csrf-secret-0123456789';
const internalServiceSecret = 'integration-698-internal-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000701',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:read', 'matter:create', 'matter:manage']
};

const productionIntakeBody = {
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch the Orbit brand for software services.',
    applicant: {
      type: 'ORGANIZATION',
      name: 'Orbit Labs Ltd.',
      country: 'GB'
    },
    trademark: {
      type: 'WORD',
      representationText: 'ORBIT'
    },
    targetJurisdictions: ['US', 'GB'],
    goodsServices: {
      sourceText: 'Downloadable software and software as a service.'
    },
    filingGoal: 'Prepare a new filing without creating a Recommendation.'
  }
} as const;

const intakeEnvelope = {
  intake: {
    schemaVersion: 1,
    intakeId: 'production-intake_698',
    workspaceId,
    version: 1,
    status: 'RECEIVED',
    channel: 'MARKREG_DIRECT',
    relationshipModel: 'DIRECT',
    input: productionIntakeBody.input,
    sourceClass: 'CUSTOMER_SUPPLIED',
    fingerprintSha256: 'a'.repeat(64),
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
    authorityConsequences: {
      professionalApprovalCreated: false,
      legalConclusionCreated: false,
      filingAuthorizationCreated: false,
      protectedActionAuthorized: false,
      orderCreated: false,
      paymentCreated: false,
      invoiceCreated: false,
      filingCreated: false,
      officialTruthCreated: false
    }
  }
};

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

function route(
  method: 'GET' | 'POST',
  path: string,
  authenticationClient: CoreAuthenticationClient = client()
) {
  const matches = routes(authenticationClient).filter(
    (candidate) => candidate.method === method && candidate.path === path
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function request(
  method: 'GET' | 'POST',
  path: string,
  body: unknown = undefined,
  headers: Record<string, string> = {},
  params: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path,
    body,
    params,
    query: {},
    headers: {
      cookie: 'mo_session=token-698',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation_698',
      'x-request-id': 'request-698',
      ...(method === 'POST'
        ? {
            origin: 'https://app.example',
            'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
            'idempotency-key': 'production-intake-key-698'
          }
        : {}),
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

describe('durable Production Intake Gateway boundary', () => {
  it('registers POST and GET exactly once without replacing the historical fixture intake', () => {
    const values = routes();
    expect(
      values.filter(
        (candidate) =>
          candidate.method === 'POST' && candidate.path === '/api/markreg/production-intakes'
      )
    ).toHaveLength(1);
    expect(
      values.filter(
        (candidate) =>
          candidate.method === 'GET' &&
          candidate.path === '/api/markreg/production-intakes/:intakeId'
      )
    ).toHaveLength(1);
    expect(
      values.filter(
        (candidate) => candidate.method === 'POST' && candidate.path === '/v1/markreg/intakes'
      )
    ).toHaveLength(1);
  });

  it('forwards the exact bounded Production Intake command with trusted Workspace authority', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/internal/v1/production-intakes');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['idempotency-key']).toBe('production-intake-key-698');
      expect(headers['x-correlation-id']).toBe('correlation_698');
      expect(headers['x-request-id']).toBe('request-698');
      expect(headers).not.toHaveProperty('cookie');
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({ userId, workspaceId });
      expect(JSON.parse(init.body as string)).toEqual({
        ...productionIntakeBody,
        idempotencyKey: 'production-intake-key-698',
        correlationId: 'correlation_698'
      });
      return response(200, intakeEnvelope);
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('POST', '/api/markreg/production-intakes').handle(
      request('POST', '/api/markreg/production-intakes', productionIntakeBody)
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(intakeEnvelope);
    expect(result.body).not.toHaveProperty('recommendation');
    expect(result.headers).toEqual({ 'x-correlation-id': 'correlation_698' });
  });

  it('uses the Idempotency-Key header as authority and rejects a mismatched body value', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      route('POST', '/api/markreg/production-intakes').handle(
        request('POST', '/api/markreg/production-intakes', productionIntakeBody, {
          'idempotency-key': ''
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });

    await expect(
      route('POST', '/api/markreg/production-intakes').handle(
        request('POST', '/api/markreg/production-intakes', {
          ...productionIntakeBody,
          idempotencyKey: 'browser-other-key'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });

    expect(downstream).not.toHaveBeenCalled();
  });

  it.each(['actor', 'actorId', 'userId', 'workspaceId', 'membershipId'])(
    'rejects browser authority spoof field %s before authentication/downstream',
    async (field) => {
      const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
      const downstream = vi.fn();
      vi.stubGlobal('fetch', downstream);
      await expect(
        route('POST', '/api/markreg/production-intakes', client({ resolveWorkspace })).handle(
          request('POST', '/api/markreg/production-intakes', {
            ...productionIntakeBody,
            [field]: field === 'actor' ? { actorId: 'user_spoof' } : 'spoofed'
          })
        )
      ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
      expect(resolveWorkspace).not.toHaveBeenCalled();
      expect(downstream).not.toHaveBeenCalled();
    }
  );

  it('requires authenticated Workspace resolution, trusted Origin, CSRF, and matter:create on POST', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const create = route('POST', '/api/markreg/production-intakes');

    await expect(
      create.handle(
        request('POST', '/api/markreg/production-intakes', productionIntakeBody, { cookie: '' })
      )
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    await expect(
      create.handle(
        request('POST', '/api/markreg/production-intakes', productionIntakeBody, {
          origin: 'https://evil.example'
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
    await expect(
      create.handle(
        request('POST', '/api/markreg/production-intakes', productionIntakeBody, {
          'x-markorbit-csrf-token': ''
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });

    const denied = client({
      resolveWorkspace: () => Promise.resolve({ ...principal, permissions: ['workspace:read'] })
    });
    await expect(
      route('POST', '/api/markreg/production-intakes', denied).handle(
        request('POST', '/api/markreg/production-intakes', productionIntakeBody)
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects invalid structured Production Intake input locally as 400', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route('POST', '/api/markreg/production-intakes').handle(
        request('POST', '/api/markreg/production-intakes', {
          ...productionIntakeBody,
          input: { ...productionIntakeBody.input, targetJurisdictions: [] }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_PRODUCTION_INTAKE_REQUEST' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('preserves same-material replay command identity and owner result', async () => {
    const commands: unknown[] = [];
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      commands.push(JSON.parse(init.body as string));
      return response(200, intakeEnvelope);
    });
    vi.stubGlobal('fetch', downstream);
    const create = route('POST', '/api/markreg/production-intakes');
    const first = await create.handle(
      request('POST', '/api/markreg/production-intakes', productionIntakeBody)
    );
    const second = await create.handle(
      request('POST', '/api/markreg/production-intakes', productionIntakeBody)
    );
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual(commands[0]);
    expect(second.body).toEqual(first.body);
  });

  it('GET authenticates Workspace read and forwards only trusted service identity', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/internal/v1/production-intakes/production-intake_698');
      expect(init.method).toBe('GET');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-correlation-id']).toBe('correlation_698');
      expect(headers['x-request-id']).toBe('request-698');
      expect(headers).not.toHaveProperty('cookie');
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({ userId, workspaceId });
      return response(200, intakeEnvelope);
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('GET', '/api/markreg/production-intakes/:intakeId').handle(
      request(
        'GET',
        '/api/markreg/production-intakes/production-intake_698',
        undefined,
        { origin: '', 'x-markorbit-csrf-token': '' },
        { intakeId: 'production-intake_698' }
      )
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual(intakeEnvelope);
  });

  it('requires workspace:read on GET and preserves privacy-safe owner 404', async () => {
    const downstream = vi.fn(() => response(404, { code: 'PRODUCTION_INTAKE_NOT_FOUND' }));
    vi.stubGlobal('fetch', downstream);

    const denied = client({
      resolveWorkspace: () => Promise.resolve({ ...principal, permissions: ['matter:create'] })
    });
    await expect(
      route('GET', '/api/markreg/production-intakes/:intakeId', denied).handle(
        request(
          'GET',
          '/api/markreg/production-intakes/production-intake_missing',
          undefined,
          {},
          { intakeId: 'production-intake_missing' }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(downstream).not.toHaveBeenCalled();

    const result = await route('GET', '/api/markreg/production-intakes/:intakeId').handle(
      request(
        'GET',
        '/api/markreg/production-intakes/production-intake_missing',
        undefined,
        {},
        { intakeId: 'production-intake_missing' }
      )
    );
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ code: 'PRODUCTION_INTAKE_NOT_FOUND' });
  });

  it.each([400, 409, 503])('preserves owner POST %i without retry or fallback', async (status) => {
    const ownerBody = { code: `OWNER_${status}`, retryable: status === 503 };
    const downstream = vi.fn(() => response(status, ownerBody));
    vi.stubGlobal('fetch', downstream);
    const result = await route('POST', '/api/markreg/production-intakes').handle(
      request('POST', '/api/markreg/production-intakes', productionIntakeBody)
    );
    expect(result.status).toBe(status);
    expect(result.body).toEqual(ownerBody);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('maps POST and GET transport failures to explicit 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('MarkReg offline')))
    );
    await expect(
      route('POST', '/api/markreg/production-intakes').handle(
        request('POST', '/api/markreg/production-intakes', productionIntakeBody)
      )
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
    await expect(
      route('GET', '/api/markreg/production-intakes/:intakeId').handle(
        request(
          'GET',
          '/api/markreg/production-intakes/production-intake_698',
          undefined,
          {},
          { intakeId: 'production-intake_698' }
        )
      )
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  });

  it('fails closed when Core says the requested Workspace membership is unavailable', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const denied = client({
      resolveWorkspace: () =>
        Promise.reject(
          new AuthenticationError('MEMBERSHIP_REQUIRED', 'Workspace membership is required.')
        )
    });
    await expect(
      route('GET', '/api/markreg/production-intakes/:intakeId', denied).handle(
        request(
          'GET',
          '/api/markreg/production-intakes/production-intake_698',
          undefined,
          {},
          { intakeId: 'production-intake_698' }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });
});
