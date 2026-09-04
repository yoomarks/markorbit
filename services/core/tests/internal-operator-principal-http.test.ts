import { AuthenticationError } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createInternalOperatorPrincipalRoutesV1 } from '../src/internal-operator-principal-http.js';

const secret = 'core-cognitive-grant-secret-32-bytes';
const principal = {
  kind: 'INTERNAL_OPERATOR' as const,
  sessionId: 'session-768',
  userId: '018f0000-0000-7000-8000-000000000768',
  capabilities: ['control-plane:cognitive:read' as const],
  sessionExpiresAt: '2026-09-05T12:00:00.000Z'
};

function request(
  body: unknown = { token: 'raw-session-token' },
  includeAuthorization = true
): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/control-plane/operator-principals/resolve',
    params: {},
    query: {},
    headers: includeAuthorization
      ? { 'x-markorbit-internal-authorization': secret }
      : {},
    body
  };
}

function route(resolve = vi.fn(() => Promise.resolve(principal))) {
  return {
    resolve,
    route: createInternalOperatorPrincipalRoutesV1({
      resolver: { resolve },
      internalServiceSecret: secret
    })[0]!
  };
}

describe('cognitive Internal Operator resolver HTTP boundary', () => {
  it('returns only the owner-resolved canonical principal', async () => {
    const { resolve, route: resolverRoute } = route();

    await expect(resolverRoute.handle(request())).resolves.toEqual({ status: 200, body: principal });
    expect(resolve).toHaveBeenCalledWith('raw-session-token');
  });

  it('requires internal service identity before touching session or grant truth', async () => {
    const { resolve, route: resolverRoute } = route();

    await expect(resolverRoute.handle(request(undefined, false))).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ['missing token', {}],
    ['browser capability injection', { token: 'raw-session-token', capabilities: ['control-plane:cognitive:read'] }],
    ['browser principal injection', { token: 'raw-session-token', principal: principal }],
    ['non-object body', 'raw-session-token']
  ])('rejects %s without allowing authority manufacture', async (_label, body) => {
    const { resolve, route: resolverRoute } = route();

    await expect(resolverRoute.handle(request(body))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('preserves explicit missing-grant denial as 403', async () => {
    const { route: resolverRoute } = route(
      vi.fn(() =>
        Promise.reject(new AuthenticationError('PERMISSION_DENIED', 'Explicit grant is required.'))
      )
    );

    await expect(resolverRoute.handle(request())).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
  });

  it('preserves grant-source failure as retryable 503', async () => {
    const { route: resolverRoute } = route(
      vi.fn(() =>
        Promise.reject(
          new AuthenticationError(
            'AUTHENTICATION_SERVICE_UNAVAILABLE',
            'Cognitive read grant source is unavailable.'
          )
        )
      )
    );

    await expect(resolverRoute.handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE',
      retryable: true
    });
  });
});
