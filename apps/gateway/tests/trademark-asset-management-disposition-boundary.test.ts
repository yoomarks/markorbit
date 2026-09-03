import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '52525252-5252-4525-8525-525252525252';
const trademarkAssetId = 'trademark-asset_651-boundary';
const routePath = '/api/lite/trademark-assets/:trademarkAssetId/management-dispositions';
const requestPath = `/api/lite/trademark-assets/${trademarkAssetId}/management-dispositions`;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '22222222-2222-4222-8222-222222222222',
  sessionId: 'session_integration_651_boundary',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_integration_651_boundary',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};
const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
const auth: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('issue is not expected')),
  resolve: () => Promise.reject(new Error('resolve is not expected')),
  resolveWorkspace,
  revoke: () => Promise.resolve()
};
const options = {
  liteUrl: 'http://lite.test',
  authenticationClient: auth,
  internalServiceSecret: 'integration-651-boundary-key-0123456789',
  csrfSecret: 'integration-651-boundary-csrf-0123456789',
  allowedOrigins: ['https://test.markorbit.local']
};
const baseBody = {
  expectedTrademarkAssetVersion: 9,
  managementSignal: { id: 'trademark-asset-management-signal_651_boundary', version: 4 },
  recommendation: {
    id: 'trademark-asset-management-recommendation_651_boundary',
    version: 2
  },
  note: 'Private management state only.'
};

function routes() {
  return createGatewayProductLoopRoutes(options).filter(
    (candidate) => candidate.path === routePath
  );
}

function route(method: 'GET' | 'POST') {
  const match = routes().find((candidate) => candidate.method === method);
  if (!match) throw new Error(`${method} ${routePath} route missing`);
  return match;
}

function headers(): Record<string, string> {
  return {
    cookie: 'mo_session=token-651-boundary',
    origin: 'https://test.markorbit.local',
    'x-markorbit-workspace-id': workspaceId,
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
    'idempotency-key': 'disposition-651-boundary',
    'x-correlation-id': 'correlation-651-boundary',
    'x-request-id': 'request-651-boundary'
  };
}

function request(method: 'GET' | 'POST', body?: unknown) {
  return {
    method,
    path: requestPath,
    params: { trademarkAssetId },
    query: {},
    headers: headers(),
    body: method === 'POST' ? body : undefined
  };
}

function jsonResponse(status: number, body: unknown): Promise<Response> {
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

describe('Gateway Trademark management disposition contract completion', () => {
  it('passes through exact-current owner projection including private, null and owner-resolved truth', async () => {
    const signal = (suffix: string, version: number) => ({
      id: `trademark-asset-management-signal_${suffix}`,
      version
    });
    const projection = {
      schemaVersion: 1,
      workspaceId,
      asset: { id: trademarkAssetId, version: 9 },
      items: [
        {
          signal: signal('dismissed', 1),
          disposition: { kind: 'DISMISSED', note: 'No action now.' }
        },
        {
          signal: signal('continued', 2),
          disposition: { kind: 'CONTINUED', note: 'Continue inside Product only.' }
        },
        { signal: signal('current-null', 3), disposition: null },
        {
          signal: signal('resolved', 4),
          disposition: {
            kind: 'RESOLVED_BY_WORKFLOW_REFERENCE',
            workflowReference: { kind: 'ORDER', owner: 'MARKREG', referenceId: 'order_651' }
          }
        }
      ]
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        expect(url).toBe(
          `http://lite.test/v1/trademark-assets/${trademarkAssetId}/management-dispositions`
        );
        expect(init.method).toBe('GET');
        return jsonResponse(200, projection);
      })
    );

    expect(await route('GET').handle(request('GET'))).toEqual({ status: 200, body: projection });
  });

  it.each(['WATCHED', 'DEFERRED', 'DISMISSED', 'CONTINUED'] as const)(
    'forwards browser-created %s without manufacturing authority',
    async (kind) => {
      const body = { ...baseBody, kind };
      const downstream = vi.fn((_url: string, init: RequestInit) => {
        expect(JSON.parse(init.body as string)).toEqual(body);
        return jsonResponse(201, {
          kind,
          officialTruthCreated: false,
          legalConclusionVerified: false,
          capabilityVerified: false
        });
      });
      vi.stubGlobal('fetch', downstream);

      expect(await route('POST').handle(request('POST', body))).toMatchObject({ status: 201 });
      expect(downstream).toHaveBeenCalledOnce();
    }
  );

  it('preserves owner rejection of workflow-resolved browser creation and unknown external-action input', async () => {
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      const message =
        body.kind === 'RESOLVED_BY_WORKFLOW_REFERENCE'
          ? 'kind must be WATCHED, DEFERRED, DISMISSED, or CONTINUED.'
          : 'Only exact-current disposition fields are accepted.';
      return jsonResponse(400, { code: 'INVALID_REQUEST', message });
    });
    vi.stubGlobal('fetch', downstream);

    const resolved = { ...baseBody, kind: 'RESOLVED_BY_WORKFLOW_REFERENCE' };
    expect(await route('POST').handle(request('POST', resolved))).toMatchObject({
      status: 400,
      body: { code: 'INVALID_REQUEST' }
    });

    const externalAction = {
      ...baseBody,
      kind: 'DISMISSED',
      externalAction: { filingAuthorized: true }
    };
    expect(await route('POST').handle(request('POST', externalAction))).toMatchObject({
      status: 400,
      body: { code: 'INVALID_REQUEST' }
    });
    expect(downstream).toHaveBeenCalledTimes(2);
  });

  it('keeps idempotency owner-governed rather than storing replay state in Gateway memory', async () => {
    const body = { ...baseBody, kind: 'WATCHED' };
    const ownerResult = {
      dispositionId: 'trademark-asset-management-disposition_651_boundary',
      kind: 'WATCHED'
    };
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>)['idempotency-key']).toBe(
        'disposition-651-boundary'
      );
      return jsonResponse(200, ownerResult);
    });
    vi.stubGlobal('fetch', downstream);

    expect(await route('POST').handle(request('POST', body))).toEqual({
      status: 200,
      body: ownerResult
    });
    expect(await route('POST').handle(request('POST', body))).toEqual({
      status: 200,
      body: ownerResult
    });
    expect(downstream).toHaveBeenCalledTimes(2);
  });

  it.each([
    [404, 'NOT_FOUND'],
    [400, 'INVALID_INPUT'],
    [403, 'PERMISSION_DENIED']
  ] as const)('preserves owner %s %s semantics', async (status, code) => {
    const ownerFailure = { code, message: `owner-${code.toLowerCase()}` };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse(status, ownerFailure))
    );

    expect(await route('POST').handle(request('POST', { ...baseBody, kind: 'DISMISSED' }))).toEqual(
      { status, body: ownerFailure }
    );
  });
});
