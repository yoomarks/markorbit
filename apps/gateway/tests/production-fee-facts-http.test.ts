import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayMarkRegEarlyFunnelRoutes } from '../src/markreg-early-funnel-http.js';

const workspaceId = '64646464-6464-4646-8646-646464646464';
const sessionId = 'session_task0944_gateway';
const csrfSecret = 'gateway-task0944-csrf-secret-0123456789';
const internalServiceSecret = 'gateway-task0944-internal-secret-012345';
const intakeId = 'intake_task0944_gateway';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_task0944_gateway',
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_task0944_gateway',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:create']
};

function client(): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not expected')),
    resolve: () => Promise.reject(new Error('not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve()
  };
}

function routes() {
  return createGatewayMarkRegEarlyFunnelRoutes({
    markRegUrl: 'http://markreg.test',
    authenticationClient: client(),
    internalServiceSecret,
    csrfSecret,
    allowedOrigins: ['https://app.example']
  });
}

function route(method: 'GET' | 'POST', path: string) {
  const matches = routes().filter(
    (candidate) => candidate.method === method && candidate.path === path
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function request(
  method: 'GET' | 'POST',
  path: string,
  body: unknown = undefined,
  query: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path,
    body,
    params: { intakeId },
    query,
    headers: {
      cookie: 'mo_session=token-task0944',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation_task0944_gateway',
      ...(method === 'POST'
        ? {
            origin: 'https://app.example',
            'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
            'idempotency-key': 'fee-facts-task0944-gateway'
          }
        : {})
    }
  };
}

const response = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Production fee facts Gateway boundary', () => {
  it('registers the explicit write and exact-current read routes', () => {
    expect(
      routes().filter(
        (candidate) =>
          candidate.method === 'POST' &&
          candidate.path === '/api/markreg/production-intakes/:intakeId/fee-facts'
      )
    ).toHaveLength(1);
    expect(
      routes().filter(
        (candidate) =>
          candidate.method === 'GET' &&
          candidate.path === '/api/markreg/production-intakes/:intakeId/fee-facts/current'
      )
    ).toHaveLength(1);
  });

  it('forces CUSTOMER_SUPPLIED provenance and forwards only explicit basis/classes', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://markreg.test/internal/v1/production-fee-facts');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      const body: unknown = JSON.parse(init.body as string);
      expect(body).toEqual({
        schemaVersion: 1,
        intakeId,
        expectedIntakeVersion: 1,
        filingBasis: 'SECTION_1',
        niceClasses: [9, 42],
        filingBasisSourceClass: 'CUSTOMER_SUPPLIED',
        classSelectionSourceClass: 'CUSTOMER_SUPPLIED',
        idempotencyKey: 'fee-facts-task0944-gateway',
        correlationId: 'correlation_task0944_gateway'
      });
      expect(body).not.toHaveProperty('classCount');
      expect(body).not.toHaveProperty('filingBasisProvenance');
      return response({ feeFacts: { feeFactsId: 'fee-facts_task0944_gateway' } });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route(
      'POST',
      '/api/markreg/production-intakes/:intakeId/fee-facts'
    ).handle(
      request('POST', `/api/markreg/production-intakes/${intakeId}/fee-facts`, {
        schemaVersion: 1,
        expectedIntakeVersion: 1,
        filingBasis: 'SECTION_1',
        niceClasses: [9, 42]
      })
    );
    expect(result.status).toBe(200);
  });

  it('rejects browser attempts to supply derived/provenance/source authority', async () => {
    vi.stubGlobal('fetch', vi.fn());
    for (const extra of [
      { classCount: 2 },
      { filingBasisSourceClass: 'PROFESSIONALLY_ESTABLISHED' },
      { filingBasisProvenance: { actorId: 'attacker' } },
      { intakeId }
    ]) {
      await expect(
        route('POST', '/api/markreg/production-intakes/:intakeId/fee-facts').handle(
          request('POST', `/api/markreg/production-intakes/${intakeId}/fee-facts`, {
            schemaVersion: 1,
            expectedIntakeVersion: 1,
            filingBasis: 'SECTION_1',
            niceClasses: [9],
            ...extra
          })
        )
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_PRODUCTION_FEE_FACTS_REQUEST' });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards an exact current read without inventing missing Intake version', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(
        `http://markreg.test/internal/v1/production-intakes/${intakeId}/fee-facts/current?expectedIntakeVersion=1`
      );
      expect(init.method).toBe('GET');
      return response({ feeFacts: { feeFactsId: 'fee-facts_task0944_gateway' } });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(
      'GET',
      '/api/markreg/production-intakes/:intakeId/fee-facts/current'
    ).handle(
      request('GET', `/api/markreg/production-intakes/${intakeId}/fee-facts/current`, undefined, {
        expectedIntakeVersion: '1'
      })
    );
    expect(result.status).toBe(200);

    await expect(
      route('GET', '/api/markreg/production-intakes/:intakeId/fee-facts/current').handle(
        request('GET', `/api/markreg/production-intakes/${intakeId}/fee-facts/current`)
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_PRODUCTION_FEE_FACTS_REQUEST' });
  });
});
