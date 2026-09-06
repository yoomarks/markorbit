import { afterEach, describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type AuthenticatedUserPrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { customerContextLinkedWorkKinds } from '@markorbit/contracts/customer-context';
import { createServiceRuntime, json, type ServiceRuntime } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createRuntime as createGateway } from '../src/index.js';

const workspaceId = '72727272-7272-4727-8727-727272727272';
const otherWorkspaceId = '73737373-7373-4737-8737-737373737373';
const relationshipId = 'customer-relationship_gateway-847';
const secret = 'customer-context-gateway-internal-secret-32-bytes';
const active: ServiceRuntime[] = [];
const observations: Array<{
  path: string;
  query: Readonly<Record<string, string>>;
  headers: Readonly<Record<string, string | undefined>>;
}> = [];

afterEach(async () => {
  observations.splice(0);
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
});
function principal(token: string): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: `session_${token}`,
    userId: `user_${token}`,
    workspaceId,
    membershipId: `membership_${token}`,
    role: 'MATTER_MANAGER',
    permissions: token === 'denied' ? ['review:read'] : ['workspace:read'],
    sessionExpiresAt: '2026-09-07T00:00:00.000Z'
  };
}

const authenticationClient = {
  resolveWorkspace(token: string, requestedWorkspaceId: string) {
    if (token === 'expired')
      return Promise.reject(new AuthenticationError('INVALID_SESSION', 'Session expired.'));
    if (requestedWorkspaceId !== workspaceId)
      return Promise.reject(new AuthenticationError('MEMBERSHIP_REQUIRED', 'Membership required.'));
    return Promise.resolve(principal(token));
  },
  resolve(token: string): Promise<AuthenticatedUserPrincipal> {
    const workspacePrincipal = principal(token);
    return Promise.resolve({
      kind: 'AUTHENTICATED_USER',
      sessionId: workspacePrincipal.sessionId,
      userId: workspacePrincipal.userId,
      sessionExpiresAt: workspacePrincipal.sessionExpiresAt
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

const ownerRecord = {
  schemaVersion: 1,
  customerRelationshipId: relationshipId,
  workspaceId,
  displayName: 'Acme Brand Team',
  relationshipModel: 'DIRECT',
  identityStatus: 'UNVERIFIED',
  origin: 'WORKSPACE_EXPLICIT',
  status: 'ACTIVE',
  version: 3,
  source: {
    owner: 'MARKREG',
    kind: 'CUSTOMER_RELATIONSHIP',
    referenceId: relationshipId,
    referenceVersion: 3,
    currentness: 'CURRENT'
  },
  createdByPrincipalId: 'user_internal-creator',
  updatedByPrincipalId: 'user_internal-updater',
  createdAt: '2026-09-06T15:00:00.000Z',
  updatedAt: '2026-09-06T15:20:00.000Z',
  archivedAt: null
};

type OwnerMode = 'CURRENT' | 'EMPTY' | 'NOT_FOUND' | 'UNAVAILABLE' | 'MALFORMED';

async function stack(mode: OwnerMode = 'CURRENT', networkAvailable = true) {
  let markRegUrl = 'http://127.0.0.1:1';
  if (networkAvailable) {
    const markReg = createServiceRuntime(
      { name: 'markreg-customer-context-gateway-test', port: 0, version: '1' },
      {
        routes: [
          {
            method: 'GET',
            path: '/internal/v1/customer-relationships',
            handle: (request) => {
              observations.push({
                path: request.path,
                query: request.query,
                headers: request.headers
              });
              if (mode === 'UNAVAILABLE')
                return json(503, { code: 'PERSISTENCE_UNAVAILABLE', retryable: true });
              const items =
                mode === 'EMPTY'
                  ? []
                  : [
                      mode === 'MALFORMED'
                        ? { ...ownerRecord, workspaceId: otherWorkspaceId }
                        : ownerRecord
                    ];
              return json(200, {
                items,
                page: Number(request.query.page ?? '1'),
                pageSize: Number(request.query.pageSize ?? '20'),
                total: items.length
              });
            }
          },
          {
            method: 'GET',
            path: '/internal/v1/customer-relationships/:customerRelationshipId',
            handle: (request) => {
              observations.push({
                path: request.path,
                query: request.query,
                headers: request.headers
              });
              if (mode === 'NOT_FOUND')
                return json(404, {
                  code: 'NOT_FOUND',
                  message: 'Customer Relationship was not found.'
                });
              if (mode === 'UNAVAILABLE')
                return json(503, { code: 'PERSISTENCE_UNAVAILABLE', retryable: true });
              return json(200, {
                customerRelationship:
                  mode === 'MALFORMED'
                    ? { ...ownerRecord, source: { ...ownerRecord.source, referenceVersion: 2 } }
                    : ownerRecord
              });
            }
          }
        ]
      }
    );
    markRegUrl = await start(markReg);
  }
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

const listEndpoint = (base: string) => `${base}/api/customer-contexts`;
const detailEndpoint = (base: string) => `${base}/api/customer-contexts/${relationshipId}`;

describe('Canonical Customer Context V1 Gateway read', () => {
  it('projects only canonical MarkReg identity and strips owner-internal principals', async () => {
    const base = await stack();
    const response = await fetch(`${listEndpoint(base)}?page=1&pageSize=5&status=ACTIVE`, {
      headers: browserHeaders()
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('createdByPrincipalId');
    expect(body).not.toHaveProperty('customerContexts.items.0.createdByPrincipalId');
    expect(body).not.toHaveProperty('customerContexts.items.0.updatedByPrincipalId');
    expect(body).toMatchObject({
      customerContexts: {
        schemaVersion: 1,
        workspaceId,
        page: 1,
        pageSize: 5,
        total: 1,
        items: [
          {
            customerRelationshipId: relationshipId,
            displayName: 'Acme Brand Team',
            identityStatus: 'UNVERIFIED',
            status: 'ACTIVE',
            version: 3
          }
        ]
      }
    });
    expect(observations[0]?.query).toEqual({ page: '1', pageSize: '5', status: 'ACTIVE' });
  });

  it('returns detail with all linked work explicitly UNKNOWN until canonical linkage exists', async () => {
    const base = await stack();
    const response = await fetch(detailEndpoint(base), { headers: browserHeaders() });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      customerContext: {
        linkedWork: Array<{
          kind: string;
          owner: string;
          availability: { state: string; reasonCode?: string; references: unknown[] };
        }>;
        authorityConsequences: Record<string, boolean>;
      };
    };
    expect(body.customerContext.linkedWork).toHaveLength(customerContextLinkedWorkKinds.length);
    expect(body.customerContext.linkedWork.map((group) => group.kind)).toEqual(
      customerContextLinkedWorkKinds
    );
    expect(
      body.customerContext.linkedWork.every(
        (group) =>
          group.availability.state === 'UNKNOWN' &&
          group.availability.reasonCode === 'CANONICAL_LINK_NOT_ESTABLISHED' &&
          group.availability.references.length === 0
      )
    ).toBe(true);
    expect(Object.values(body.customerContext.authorityConsequences).every((value) => !value)).toBe(
      true
    );
  });

  it('derives trusted internal authority and ignores browser principal/header spoofing', async () => {
    const base = await stack();
    const trusted = principal('customer');
    const response = await fetch(detailEndpoint(base), {
      headers: {
        ...browserHeaders(),
        'x-markorbit-internal-authorization': 'browser-spoofed-secret',
        'x-markorbit-principal': 'browser-spoofed-principal',
        'x-request-id': 'request_customer-context-847'
      }
    });
    expect(response.status).toBe(200);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.headers['x-markorbit-internal-authorization']).toBe(secret);
    expect(observations[0]?.headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(observations[0]?.headers['x-markorbit-principal']).toBe(
      encodeInternalWorkspacePrincipal(trusted)
    );
    expect(observations[0]?.headers['x-request-id']).toBe('request_customer-context-847');
  });

  it('requires authenticated Workspace membership and workspace:read before owner access', async () => {
    const base = await stack();
    const unauthenticated = await fetch(detailEndpoint(base), {
      headers: { 'x-markorbit-workspace-id': workspaceId }
    });
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });

    const denied = await fetch(detailEndpoint(base), { headers: browserHeaders('denied') });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });

    const foreignWorkspace = await fetch(detailEndpoint(base), {
      headers: browserHeaders('customer', otherWorkspaceId)
    });
    expect(foreignWorkspace.status).toBe(403);
    expect(await foreignWorkspace.json()).toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });
    expect(observations).toHaveLength(0);
  });

  it('preserves known absence and source unavailable as distinct states', async () => {
    const notFoundBase = await stack('NOT_FOUND');
    const notFound = await fetch(detailEndpoint(notFoundBase), { headers: browserHeaders() });
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toMatchObject({ code: 'CUSTOMER_CONTEXT_NOT_FOUND' });

    const unavailableBase = await stack('UNAVAILABLE');
    const unavailable = await fetch(detailEndpoint(unavailableBase), { headers: browserHeaders() });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      code: 'CUSTOMER_CONTEXT_SOURCE_UNAVAILABLE',
      retryable: true
    });
  });

  it('keeps a successful empty owner list distinct from source failure', async () => {
    const base = await stack('EMPTY');
    const response = await fetch(listEndpoint(base), { headers: browserHeaders() });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      customerContexts: { workspaceId, total: 0, items: [] }
    });
  });

  it('fails closed on malformed owner identity and owner network failure', async () => {
    const malformedBase = await stack('MALFORMED');
    const malformed = await fetch(detailEndpoint(malformedBase), { headers: browserHeaders() });
    expect(malformed.status).toBe(502);
    expect(await malformed.json()).toMatchObject({
      code: 'MALFORMED_CUSTOMER_CONTEXT_OWNER_RESPONSE'
    });

    const unavailableBase = await stack('CURRENT', false);
    const unavailable = await fetch(detailEndpoint(unavailableBase), { headers: browserHeaders() });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      code: 'CUSTOMER_CONTEXT_SOURCE_UNAVAILABLE',
      retryable: true
    });
  });

  it('rejects unsupported list queries and exposes no mutation route', async () => {
    const base = await stack();
    const invalid = await fetch(`${listEndpoint(base)}?customerId=legacy_customer`, {
      headers: browserHeaders()
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(observations).toHaveLength(0);

    const mutation = await fetch(detailEndpoint(base), {
      method: 'POST',
      headers: { ...browserHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ customerId: 'legacy_customer' })
    });
    expect(mutation.status).toBe(405);
    expect(observations).toHaveLength(0);
  });
});
