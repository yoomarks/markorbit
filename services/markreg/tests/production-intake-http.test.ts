import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createProductionIntakeRoutes } from '../src/production-intake-http.js';
import {
  ProductionIntakeError,
  type PostgresProductionIntakeService
} from '../src/production-intake.js';

const workspaceId = '60606060-6060-4606-8606-606060606060';
const otherWorkspaceId = '61616161-6161-4616-8616-616161616161';
const secret = 'markreg-production-intake-secret-32-bytes';
const active: ServiceRuntime[] = [];
const intakeId = 'intake_http-task0608';

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0608_http',
  userId: 'user_task0608_http',
  workspaceId: workspace,
  membershipId: 'membership_task0608_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const headers = (value: WorkspacePrincipal) => ({
  'content-type': 'application/json',
  'idempotency-key': 'production-intake-http-task0608',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
  'x-markorbit-workspace-id': value.workspaceId,
  'x-correlation-id': 'correlation_task0608_http'
});

const command = {
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch a software brand.',
    applicant: {
      type: 'ORGANIZATION',
      name: 'Orbit Intake Labs Ltd.',
      country: 'GB'
    },
    trademark: {
      type: 'WORD',
      representationText: 'ORBIT INTAKE'
    },
    targetJurisdictions: ['US'],
    goodsServices: {
      sourceText: 'Downloadable trademark portfolio software.'
    },
    filingGoal: 'Protect the core software brand.'
  },
  idempotencyKey: 'production-intake-http-task0608',
  correlationId: 'correlation_task0608_http'
} as const;

const intake = (): ProductionIntakeV1 => ({
  schemaVersion: 1,
  intakeId,
  workspaceId,
  version: 1,
  status: 'RECEIVED',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: command.input,
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-02T13:00:00.000Z',
  updatedAt: '2026-09-02T13:00:00.000Z',
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function stack(
  overrides: Partial<{
    create: PostgresProductionIntakeService['create'];
    get: PostgresProductionIntakeService['get'];
  }> = {}
) {
  const create = vi.fn(
    overrides.create ?? (() => Promise.resolve(intake()))
  ) as unknown as PostgresProductionIntakeService['create'];
  const get = vi.fn(
    overrides.get ?? (() => Promise.resolve(intake()))
  ) as unknown as PostgresProductionIntakeService['get'];
  const service = { create, get } as Pick<PostgresProductionIntakeService, 'create' | 'get'>;
  const runtime = createServiceRuntime(
    { name: 'markreg-production-intake-http-test', port: 0, version: '1' },
    { routes: createProductionIntakeRoutes({ internalServiceSecret: secret, service }) }
  );
  active.push(runtime);
  await runtime.start();
  return {
    base: `http://127.0.0.1:${runtime.listeningPort}`,
    create,
    get
  };
}

describe('Production Intake HTTP', () => {
  it('parses the V1 command and forwards trusted Workspace authority only', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/internal/v1/production-intakes`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify(command)
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ intake: intake() });
    expect(runtime.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: 'user_task0608_http' }),
      command,
      'correlation_task0608_http'
    );
  });

  it('reads an exact Intake through the same Workspace principal', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/internal/v1/production-intakes/${intakeId}`, {
      headers: headers(principal())
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ intake: intake() });
    expect(runtime.get).toHaveBeenCalledWith(expect.objectContaining({ workspaceId }), intakeId);
  });

  it('requires trusted internal auth and exact Workspace identity', async () => {
    const runtime = await stack();
    const untrusted = await fetch(`${runtime.base}/internal/v1/production-intakes/${intakeId}`, {
      headers: {
        ...headers(principal()),
        'x-markorbit-internal-authorization': 'wrong-secret'
      }
    });
    expect(untrusted.status).toBe(401);
    expect(await untrusted.json()).toMatchObject({ code: 'UNTRUSTED_INTERNAL_CALLER' });

    const mismatch = await fetch(`${runtime.base}/internal/v1/production-intakes/${intakeId}`, {
      headers: {
        ...headers(principal()),
        'x-markorbit-workspace-id': otherWorkspaceId
      }
    });
    expect(mismatch.status).toBe(404);
    expect(await mismatch.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });
  });

  it('rejects browser authority fields and mismatched idempotency before owner mutation', async () => {
    const runtime = await stack();
    const spoofed = await fetch(`${runtime.base}/internal/v1/production-intakes`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify({ ...command, workspaceId })
    });
    expect(spoofed.status).toBe(400);
    expect(await spoofed.json()).toMatchObject({ code: 'INVALID_PRODUCTION_INTAKE_REQUEST' });

    const mismatched = await fetch(`${runtime.base}/internal/v1/production-intakes`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify({ ...command, idempotencyKey: 'different-key' })
    });
    expect(mismatched.status).toBe(400);
    expect(await mismatched.json()).toMatchObject({ code: 'INVALID_PRODUCTION_INTAKE_REQUEST' });
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it('preserves retryable persistence failure without fixture fallback', async () => {
    const runtime = await stack({
      get: () =>
        Promise.reject(
          new ProductionIntakeError(
            'PERSISTENCE_UNAVAILABLE',
            'Production Intake persistence is unavailable.',
            503,
            true
          )
        )
    });
    const response = await fetch(`${runtime.base}/internal/v1/production-intakes/${intakeId}`, {
      headers: headers(principal())
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      retryable: true
    });
  });
});
