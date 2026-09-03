import { afterEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { JsonRoute, ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime } from '../src/index.js';
import { createProductionIntakeRoutes } from '../src/production-intake-http.js';
import type { PostgresProductionIntakeService } from '../src/production-intake.js';

const workspaceId = '60606060-6060-4606-8606-606060606060';
const secret = 'markreg-production-intake-runtime-secret-32-bytes';
const active: ServiceRuntime[] = [];
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_task0608_runtime',
  userId: 'user_task0608_runtime',
  workspaceId,
  membershipId: 'membership_task0608_runtime',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const command = {
  schemaVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Launch a software brand.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Intake Labs Ltd.', country: 'GB' },
    trademark: { type: 'WORD', representationText: 'ORBIT INTAKE' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Downloadable trademark portfolio software.' },
    filingGoal: 'Protect the core software brand.'
  },
  idempotencyKey: 'production-intake-runtime-task0608',
  correlationId: 'correlation_task0608_runtime'
} as const;
const intake: ProductionIntakeV1 = {
  schemaVersion: 1,
  intakeId: 'intake_runtime-task0608',
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
};

const headers = {
  'content-type': 'application/json',
  'idempotency-key': command.idempotencyKey,
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
  'x-markorbit-workspace-id': workspaceId,
  'x-correlation-id': command.correlationId
};

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function start(extraRoutes: readonly JsonRoute[]) {
  const runtime = createRuntime({
    port: 0,
    internalServiceSecret: secret,
    extraRoutes
  });
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

describe('Production Intake runtime composition', () => {
  it('registers the durable Production Intake boundary without reinterpreting legacy Intake', async () => {
    const service = {
      create: () => Promise.resolve(intake),
      get: () => Promise.resolve(intake)
    } as Pick<PostgresProductionIntakeService, 'create' | 'get'>;
    const base = await start(
      createProductionIntakeRoutes({ internalServiceSecret: secret, service })
    );

    const production = await fetch(`${base}/internal/v1/production-intakes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(command)
    });
    expect(production.status).toBe(200);
    expect(await production.json()).toEqual({ intake });

    const legacy = await fetch(`${base}/v1/intakes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(legacy.status).toBe(400);
    expect(await legacy.json()).toMatchObject({ code: 'INVALID_REQUEST' });
  });
});
