import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayPreparationLockHandler } from '../src/preparation-lock-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000700';
const sessionId = '018f0000-0000-7000-8000-000000000701';
const userId = '018f0000-0000-7000-8000-000000000702';
const csrfSecret = 'integration-700-csrf-secret-0123456789';
const internalServiceSecret = 'integration-700-internal-secret-0123456789';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000703',
  role: 'MATTER_MANAGER',
  permissions: ['document-package:read', 'document-package:mark-ready']
};

const body = {
  documentPackageId: 'document-package_700',
  expectedDocumentPackageVersion: 7,
  expectedCanonicalEvidenceHash: 'a'.repeat(64)
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

function handler(
  authenticationClient: CoreAuthenticationClient | null = client(),
  overrides: Partial<Parameters<typeof createGatewayPreparationLockHandler>[0]> = {},
  includeInternalServiceSecret = true
) {
  return createGatewayPreparationLockHandler({
    markRegUrl: 'http://markreg.test',
    ...(authenticationClient ? { authenticationClient } : {}),
    ...(includeInternalServiceSecret ? { internalServiceSecret } : {}),
    csrfSecret,
    allowedOrigins: ['https://app.example'],
    ...overrides
  });
}

function request(
  method: 'GET' | 'POST',
  path: string,
  requestBody: unknown = undefined,
  headers: Record<string, string> = {},
  params: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path,
    body: requestBody,
    params,
    query: {},
    headers: {
      cookie: 'mo_session=token-700',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation-700',
      'x-request-id': 'request-700',
      ...(method === 'POST'
        ? {
            origin: 'https://app.example',
            'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret)
          }
        : {}),
      ...headers
    }
  };
}

function response(status: number, value: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('durable Preparation Lock governed tuple handler', () => {
  it('forwards only the exact durable create command with trusted Principal authority', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(200, { preparationLockId: 'preparation-lock_700' }));
    vi.stubGlobal('fetch', downstream);
    const result = await handler()(
      request('POST', '/api/markreg/preparation-locks', body, {
        'idempotency-key': 'preparation-lock-key-700'
      })
    );
    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
    const [url, init] = downstream.mock.calls[0]!;
    expect(url).toBe('http://markreg.test/v1/preparation-locks');
    if (!init) throw new Error('Expected request init.');
    const forwardedBody = init.body;
    expect(typeof forwardedBody).toBe('string');
    if (typeof forwardedBody !== 'string') throw new Error('Expected string request body.');
    expect(JSON.parse(forwardedBody)).toEqual(body);
    const headers = init.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
    expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(headers['x-correlation-id']).toBe('correlation-700');
    expect(headers['x-request-id']).toBe('request-700');
    expect(headers['idempotency-key']).toBe('preparation-lock-key-700');
    expect(parseInternalWorkspacePrincipal(headers['x-markorbit-principal'])).toEqual(principal);
  });

  it('rejects legacy and browser authority fields before they can reach MarkReg', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler()(
        request(
          'POST',
          '/api/markreg/preparation-locks',
          { ...body, instructionLedgerId: 'instruction-ledger_legacy' },
          { 'idempotency-key': 'preparation-lock-key-700' }
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_PREPARATION_LOCK_REQUEST' });
    await expect(
      handler()(
        request(
          'POST',
          '/api/markreg/preparation-locks',
          { ...body, workspaceId },
          { 'idempotency-key': 'preparation-lock-key-700' }
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_PREPARATION_LOCK_REQUEST' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires idempotency, trusted Origin, CSRF and mark-ready permission for create', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler()(request('POST', '/api/markreg/preparation-locks', body))
    ).rejects.toMatchObject({ status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });
    await expect(
      handler()(
        request('POST', '/api/markreg/preparation-locks', body, {
          'idempotency-key': 'preparation-lock-key-700',
          origin: 'https://evil.example'
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
    await expect(
      handler()(
        request('POST', '/api/markreg/preparation-locks', body, {
          'idempotency-key': 'preparation-lock-key-700',
          'x-markorbit-csrf-token': 'invalid'
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    const noPermission = {
      ...principal,
      permissions: ['document-package:read']
    } as WorkspacePrincipal;
    await expect(
      handler(client({ resolveWorkspace: () => Promise.resolve(noPermission) }))(
        request('POST', '/api/markreg/preparation-locks', body, {
          'idempotency-key': 'preparation-lock-key-700'
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('uses document-package:read for GET without requiring mutation CSRF', async () => {
    const downstream = vi.fn(() => response(200, { preparationLockId: 'preparation-lock_700' }));
    vi.stubGlobal('fetch', downstream);
    const readOnly = { ...principal, permissions: ['document-package:read'] } as WorkspacePrincipal;
    const result = await handler(client({ resolveWorkspace: () => Promise.resolve(readOnly) }))(
      request(
        'GET',
        '/api/markreg/preparation-locks/preparation-lock_700',
        undefined,
        {},
        { preparationLockId: 'preparation-lock_700' }
      )
    );
    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('requires read permission plus trusted Origin and CSRF for validate-current POST', async () => {
    const downstream = vi.fn(() => response(200, { valid: true }));
    vi.stubGlobal('fetch', downstream);
    const readOnly = { ...principal, permissions: ['document-package:read'] } as WorkspacePrincipal;
    const readHandler = handler(client({ resolveWorkspace: () => Promise.resolve(readOnly) }));
    const result = await readHandler(
      request(
        'POST',
        '/api/markreg/preparation-locks/preparation-lock_700/validate-current',
        {},
        {},
        { preparationLockId: 'preparation-lock_700' }
      )
    );
    expect(result.status).toBe(200);
    await expect(
      readHandler(
        request(
          'POST',
          '/api/markreg/preparation-locks/preparation-lock_700/validate-current',
          {},
          { 'x-markorbit-csrf-token': 'invalid' },
          { preparationLockId: 'preparation-lock_700' }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
  });

  it('keeps wrong Workspace and membership failures privacy-safe', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler(
        client({
          resolveWorkspace: () =>
            Promise.reject(
              new AuthenticationError('MEMBERSHIP_REQUIRED', 'Membership is required.')
            )
        })
      )(
        request(
          'GET',
          '/api/markreg/preparation-locks/preparation-lock_700',
          undefined,
          {},
          { preparationLockId: 'preparation-lock_700' }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409, 503])('preserves owner status %i and body', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response(status, { code: `OWNER_${status}` }))
    );
    const result = await handler()(
      request('POST', '/api/markreg/preparation-locks', body, {
        'idempotency-key': 'preparation-lock-key-700'
      })
    );
    expect(result.status).toBe(status);
    expect(result.body).toEqual({ code: `OWNER_${status}` });
  });

  it('maps transport failure to explicit 503 without legacy fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );
    await expect(
      handler()(
        request('POST', '/api/markreg/preparation-locks', body, {
          'idempotency-key': 'preparation-lock-key-700'
        })
      )
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  });

  it('fails closed without production auth but permits explicit fixture runtime compatibility', async () => {
    const downstream = vi.fn(() => response(200, { fixture: true }));
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler(
        null,
        {},
        false
      )(
        request('POST', '/api/markreg/preparation-locks', body, {
          'idempotency-key': 'preparation-lock-key-700'
        })
      )
    ).rejects.toMatchObject({ status: 503, code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
    const fixture = handler(null, { fixtureTestRuntime: true }, false);
    const result = await fixture(
      request('POST', '/api/markreg/preparation-locks', {
        documentPackageId: 'document-package_fixture',
        instructionLedgerId: 'instruction-ledger_fixture'
      })
    );
    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('fails closed for any non-Preparation tuple accidentally routed to the handler', async () => {
    await expect(
      handler()(request('POST', '/api/markreg/orders/order_700', {}))
    ).rejects.toMatchObject({
      status: 404,
      code: 'PREPARATION_LOCK_ROUTE_NOT_FOUND'
    });
  });
});
