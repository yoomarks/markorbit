import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  type UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createProductionUserSelectionRoutes } from '../src/production-user-selection-http.js';
import {
  ProductionUserSelectionError,
  type PostgresProductionUserSelectionService
} from '../src/production-user-selection.js';

const workspaceId = '62626262-6262-4626-8626-626262626262';
const otherWorkspaceId = '63636363-6363-4636-8636-636363636363';
const secret = 'markreg-production-selection-secret-32-bytes';
const active: ServiceRuntime[] = [];
const selectionId = 'selection_http-task0942';
const recommendationId = 'recommendation_http-task0942';

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0942_http',
  userId: 'user_task0942_http',
  workspaceId: workspace,
  membershipId: 'membership_task0942_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const headers = (value: WorkspacePrincipal) => ({
  'content-type': 'application/json',
  'idempotency-key': 'production-selection-http-task0942',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
  'x-markorbit-workspace-id': value.workspaceId,
  'x-correlation-id': 'correlation_task0942_http'
});

const command = {
  schemaVersion: 1,
  recommendationId,
  expectedRecommendationVersion: 1,
  selectedOptionCode: 'B',
  idempotencyKey: 'production-selection-http-task0942',
  correlationId: 'correlation_task0942_http'
} as const;

const selection = (): UserSelectionV1 => ({
  schemaVersion: 1,
  selectionId,
  workspaceId,
  version: 1,
  status: 'CURRENT',
  recommendation: {
    id: recommendationId,
    version: 1,
    fingerprintSha256: 'a'.repeat(64)
  },
  selectedOptionCode: 'B',
  selectedAt: '2026-09-07T06:00:00.000Z',
  fingerprintSha256: 'b'.repeat(64),
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function stack(
  overrides: Partial<{
    create: PostgresProductionUserSelectionService['create'];
    get: PostgresProductionUserSelectionService['get'];
  }> = {}
) {
  const create = vi.fn(
    overrides.create ?? (() => Promise.resolve(selection()))
  ) as unknown as PostgresProductionUserSelectionService['create'];
  const get = vi.fn(
    overrides.get ?? (() => Promise.resolve(selection()))
  ) as unknown as PostgresProductionUserSelectionService['get'];
  const service = { create, get } as Pick<PostgresProductionUserSelectionService, 'create' | 'get'>;
  const runtime = createServiceRuntime(
    { name: 'markreg-production-user-selection-http-test', port: 0, version: '1' },
    { routes: createProductionUserSelectionRoutes({ internalServiceSecret: secret, service }) }
  );
  active.push(runtime);
  await runtime.start();
  return {
    base: `http://127.0.0.1:${runtime.listeningPort}`,
    create,
    get
  };
}

describe('Production User Selection HTTP', () => {
  it('parses the shared V1 command and forwards only trusted Workspace authority', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/internal/v1/production-user-selections`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify(command)
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ selection: selection() });
    expect(runtime.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: 'user_task0942_http' }),
      command,
      'correlation_task0942_http'
    );
  });

  it('reads Selection through the same trusted Workspace boundary', async () => {
    const runtime = await stack();
    const response = await fetch(
      `${runtime.base}/internal/v1/production-user-selections/${selectionId}`,
      { headers: headers(principal()) }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ selection: selection() });
    expect(runtime.get).toHaveBeenCalledWith(expect.objectContaining({ workspaceId }), selectionId);
  });

  it('requires trusted internal auth and exact Workspace identity', async () => {
    const runtime = await stack();
    const untrusted = await fetch(
      `${runtime.base}/internal/v1/production-user-selections/${selectionId}`,
      {
        headers: {
          ...headers(principal()),
          'x-markorbit-internal-authorization': 'wrong-secret'
        }
      }
    );
    expect(untrusted.status).toBe(401);
    expect(await untrusted.json()).toMatchObject({ code: 'UNTRUSTED_INTERNAL_CALLER' });

    const mismatch = await fetch(
      `${runtime.base}/internal/v1/production-user-selections/${selectionId}`,
      {
        headers: {
          ...headers(principal()),
          'x-markorbit-workspace-id': otherWorkspaceId
        }
      }
    );
    expect(mismatch.status).toBe(404);
    expect(await mismatch.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });
  });

  it('rejects caller authority fields and idempotency mismatch before owner mutation', async () => {
    const runtime = await stack();
    const spoofed = await fetch(`${runtime.base}/internal/v1/production-user-selections`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify({ ...command, workspaceId })
    });
    expect(spoofed.status).toBe(400);
    expect(await spoofed.json()).toMatchObject({
      code: 'INVALID_PRODUCTION_USER_SELECTION_REQUEST'
    });

    const mismatched = await fetch(`${runtime.base}/internal/v1/production-user-selections`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify({ ...command, idempotencyKey: 'different-key' })
    });
    expect(mismatched.status).toBe(400);
    expect(await mismatched.json()).toMatchObject({
      code: 'INVALID_PRODUCTION_USER_SELECTION_REQUEST'
    });
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it('preserves retryable persistence failure without fixture fallback', async () => {
    const runtime = await stack({
      get: () =>
        Promise.reject(
          new ProductionUserSelectionError(
            'PERSISTENCE_UNAVAILABLE',
            'Production User Selection persistence is unavailable.',
            503,
            true
          )
        )
    });
    const response = await fetch(
      `${runtime.base}/internal/v1/production-user-selections/${selectionId}`,
      { headers: headers(principal()) }
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      retryable: true
    });
  });
});
