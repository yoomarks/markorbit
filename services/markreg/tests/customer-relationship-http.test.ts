import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createCustomerRelationshipRoutes } from '../src/customer-relationship-http.js';
import {
  CustomerRelationshipError,
  type CustomerRelationshipRecord,
  type PostgresCustomerRelationshipStore
} from '../src/customer-relationship.js';

const workspaceId = '70707070-7070-4707-8707-707070707070';
const otherWorkspaceId = '71717171-7171-4717-8717-717171717171';
const secret = 'markreg-customer-relationship-secret-32-bytes';
const relationshipId = 'customer-relationship_http-914' as const;
const active: ServiceRuntime[] = [];

const principal = (
  workspace = workspaceId,
  permissions: readonly Permission[] = ['workspace:read', 'workspace:manage']
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_customer-relationship-http',
  userId: 'user_customer-relationship-http',
  workspaceId: workspace,
  membershipId: 'membership_customer-relationship-http',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const headers = (value = principal()) => ({
  'content-type': 'application/json',
  'idempotency-key': 'customer-relationship-http-914',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
  'x-markorbit-workspace-id': value.workspaceId
});

const record = (
  overrides: Partial<CustomerRelationshipRecord> = {}
): CustomerRelationshipRecord => ({
  schemaVersion: 1,
  customerRelationshipId: relationshipId,
  workspaceId,
  displayName: 'Acme Brand Team',
  relationshipModel: 'DIRECT',
  identityStatus: 'UNVERIFIED',
  origin: 'WORKSPACE_EXPLICIT',
  status: 'ACTIVE',
  version: 1,
  source: {
    owner: 'MARKREG',
    kind: 'CUSTOMER_RELATIONSHIP',
    referenceId: relationshipId,
    referenceVersion: 1,
    currentness: 'CURRENT'
  },
  createdByPrincipalId: 'user_customer-relationship-http',
  updatedByPrincipalId: 'user_customer-relationship-http',
  createdAt: '2026-09-06T13:30:00.000Z',
  updatedAt: '2026-09-06T13:30:00.000Z',
  archivedAt: null,
  ...overrides
});

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

type StoreMethod = PostgresCustomerRelationshipStore[
  'create' | 'get' | 'list' | 'update' | 'archive'];

async function stack(
  overrides: Partial<Record<'create' | 'get' | 'list' | 'update' | 'archive', StoreMethod>> = {}
) {
  const create = vi.fn(overrides.create ?? (() => Promise.resolve(record()))) as never;
  const get = vi.fn(overrides.get ?? (() => Promise.resolve(record()))) as never;
  const list = vi.fn(
    overrides.list ??
      (() => Promise.resolve({ items: [record()], page: 1, pageSize: 20, total: 1 }))
  ) as never;
  const update = vi.fn(
    overrides.update ?? (() => Promise.resolve(record({ version: 2 })))
  ) as never;
  const archive = vi.fn(
    overrides.archive ?? (() => Promise.resolve(record({ status: 'ARCHIVED', version: 2 })))
  ) as never;
  const store = { create, get, list, update, archive } as unknown as Pick<
    PostgresCustomerRelationshipStore,
    'create' | 'get' | 'list' | 'update' | 'archive'
  >;
  const runtime = createServiceRuntime(
    { name: 'markreg-customer-relationship-http-test', port: 0, version: '1' },
    { routes: createCustomerRelationshipRoutes({ internalServiceSecret: secret, store }) }
  );
  active.push(runtime);
  await runtime.start();
  return {
    base: `http://127.0.0.1:${runtime.listeningPort}`,
    create,
    get,
    list,
    update,
    archive
  };
}

describe('Customer Relationship HTTP', () => {
  it('derives Workspace and actor from the trusted Principal, never request body identity', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/internal/v1/customer-relationships`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        displayName: 'Acme Brand Team',
        relationshipModel: 'DIRECT',
        principalId: 'user_spoofed',
        customerId: 'customer_legacy-spoof'
      })
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ customerRelationship: record() });
    expect(runtime.create).toHaveBeenCalledWith({
      workspaceId,
      displayName: 'Acme Brand Team',
      relationshipModel: 'DIRECT',
      principalId: 'user_customer-relationship-http',
      idempotencyKey: 'customer-relationship-http-914'
    });
  });

  it('keeps Workspace mismatch privacy-safe before the owner store is called', async () => {
    const runtime = await stack();
    const response = await fetch(
      `${runtime.base}/internal/v1/customer-relationships/${relationshipId}`,
      {
        headers: {
          ...headers(),
          'x-markorbit-workspace-id': otherWorkspaceId
        }
      }
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    expect(runtime.get).not.toHaveBeenCalled();
  });

  it('requires trusted internal auth and existing Workspace permissions', async () => {
    const runtime = await stack();
    const untrusted = await fetch(`${runtime.base}/internal/v1/customer-relationships`, {
      headers: {
        ...headers(),
        'x-markorbit-internal-authorization': 'wrong-secret'
      }
    });
    expect(untrusted.status).toBe(401);
    expect(await untrusted.json()).toMatchObject({ code: 'UNTRUSTED_INTERNAL_CALLER' });

    const readDenied = await fetch(`${runtime.base}/internal/v1/customer-relationships`, {
      headers: headers(principal(workspaceId, ['matter:read']))
    });
    expect(readDenied.status).toBe(403);
    expect(await readDenied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });

    const writeDenied = await fetch(`${runtime.base}/internal/v1/customer-relationships`, {
      method: 'POST',
      headers: headers(principal(workspaceId, ['workspace:read'])),
      body: JSON.stringify({ displayName: 'Denied', relationshipModel: 'DIRECT' })
    });
    expect(writeDenied.status).toBe(403);
    expect(await writeDenied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(runtime.create).not.toHaveBeenCalled();
  });
  it('forwards bounded list/update/archive commands with Principal-derived authority', async () => {
    const runtime = await stack();
    const listResponse = await fetch(
      `${runtime.base}/internal/v1/customer-relationships?status=ACTIVE&page=1&pageSize=20`,
      { headers: headers() }
    );
    expect(listResponse.status).toBe(200);
    expect(runtime.list).toHaveBeenCalledWith(workspaceId, {
      status: 'ACTIVE',
      page: 1,
      pageSize: 20
    });

    const updateResponse = await fetch(
      `${runtime.base}/internal/v1/customer-relationships/${relationshipId}`,
      {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          expectedVersion: 1,
          displayName: 'Acme Updated',
          principalId: 'spoof'
        })
      }
    );
    expect(updateResponse.status).toBe(200);
    expect(runtime.update).toHaveBeenCalledWith({
      workspaceId,
      customerRelationshipId: relationshipId,
      expectedVersion: 1,
      displayName: 'Acme Updated',
      principalId: 'user_customer-relationship-http'
    });
    const archiveResponse = await fetch(
      `${runtime.base}/internal/v1/customer-relationships/${relationshipId}/archive`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ expectedVersion: 1, principalId: 'spoof' })
      }
    );
    expect(archiveResponse.status).toBe(200);
    expect(runtime.archive).toHaveBeenCalledWith(
      workspaceId,
      relationshipId,
      1,
      'user_customer-relationship-http'
    );
  });

  it('preserves owner unavailability as retryable 503, never empty/absence', async () => {
    const runtime = await stack({
      get: (() =>
        Promise.reject(
          new CustomerRelationshipError(
            'PERSISTENCE_UNAVAILABLE',
            'Customer Relationship persistence is unavailable.',
            503
          )
        )) as never
    });
    const response = await fetch(
      `${runtime.base}/internal/v1/customer-relationships/${relationshipId}`,
      { headers: headers() }
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      retryable: true
    });
  });
});
