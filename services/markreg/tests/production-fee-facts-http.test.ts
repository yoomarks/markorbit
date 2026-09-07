import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  type ProductionFeeFactsV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createProductionFeeFactsRoutes } from '../src/production-fee-facts-http.js';
import {
  ProductionFeeFactsError,
  type PostgresProductionFeeFactsService
} from '../src/production-fee-facts.js';

const workspaceId = '64646464-6464-4646-8646-646464646464';
const secret = 'markreg-production-fee-facts-secret-32-bytes';
const active: ServiceRuntime[] = [];
const intakeId = 'intake_task0944_http';
const feeFactsId = 'fee-facts_task0944_http';

const principal = (): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0944_http',
  userId: 'user_task0944_http',
  workspaceId,
  membershipId: 'membership_task0944_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const headers = () => ({
  'content-type': 'application/json',
  'idempotency-key': 'fee-facts-http-task0944',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal()),
  'x-markorbit-workspace-id': workspaceId,
  'x-correlation-id': 'correlation_task0944_http'
});

const command = {
  schemaVersion: 1,
  intakeId,
  expectedIntakeVersion: 1,
  filingBasis: 'SECTION_1',
  niceClasses: [9, 42],
  filingBasisSourceClass: 'CUSTOMER_SUPPLIED',
  classSelectionSourceClass: 'CUSTOMER_SUPPLIED',
  idempotencyKey: 'fee-facts-http-task0944',
  correlationId: 'correlation_task0944_http'
} as const;

const feeFacts = (): ProductionFeeFactsV1 => ({
  schemaVersion: 1,
  feeFactsId,
  workspaceId,
  version: 1,
  currentness: 'CURRENT',
  intake: { id: intakeId, version: 1, fingerprintSha256: 'a'.repeat(64) },
  filingBasis: 'SECTION_1',
  niceClasses: [9, 42],
  classCount: 2,
  filingBasisProvenance: {
    sourceClass: 'CUSTOMER_SUPPLIED',
    actorId: 'user_task0944_http',
    membershipId: 'membership_task0944_http',
    establishedAt: '2026-09-07T05:00:00.000Z'
  },
  classSelectionProvenance: {
    sourceClass: 'CUSTOMER_SUPPLIED',
    actorId: 'user_task0944_http',
    membershipId: 'membership_task0944_http',
    establishedAt: '2026-09-07T05:00:00.000Z'
  },
  recordedAt: '2026-09-07T05:00:00.000Z',
  fingerprintSha256: 'b'.repeat(64),
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

afterEach(async () => Promise.all(active.splice(0).map((runtime) => runtime.stop())));

async function stack() {
  const createMock = vi.fn(() => Promise.resolve(feeFacts()));
  const getCurrentMock = vi.fn(() => Promise.resolve(feeFacts()));
  const create = createMock as unknown as PostgresProductionFeeFactsService['create'];
  const getCurrent = getCurrentMock as unknown as PostgresProductionFeeFactsService['getCurrent'];
  const runtime = createServiceRuntime(
    { name: 'markreg-production-fee-facts-http-test', port: 0, version: '1' },
    {
      routes: createProductionFeeFactsRoutes({
        internalServiceSecret: secret,
        service: { create, getCurrent }
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return {
    base: `http://127.0.0.1:${runtime.listeningPort}`,
    create: createMock,
    getCurrent: getCurrentMock
  };
}

describe('Production fee facts HTTP', () => {
  it('writes explicit facts with trusted Workspace authority and reads exact current Intake binding', async () => {
    const runtime = await stack();
    const created = await fetch(`${runtime.base}/internal/v1/production-fee-facts`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(command)
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({ feeFacts: feeFacts() });
    expect(runtime.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: 'user_task0944_http' }),
      command,
      'correlation_task0944_http'
    );

    const read = await fetch(
      `${runtime.base}/internal/v1/production-intakes/${intakeId}/fee-facts/current?expectedIntakeVersion=1`,
      { headers: headers() }
    );
    expect(read.status).toBe(200);
    expect(runtime.getCurrent).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId }),
      intakeId,
      1
    );
  });

  it('rejects caller-supplied derived facts/provenance and Workspace spoofing', async () => {
    const runtime = await stack();
    for (const body of [
      { ...command, classCount: 2 },
      { ...command, filingBasisProvenance: { actorId: 'attacker' } },
      { ...command, workspaceId }
    ]) {
      const response = await fetch(`${runtime.base}/internal/v1/production-fee-facts`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body)
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'INVALID_PRODUCTION_FEE_FACTS_REQUEST' });
    }
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it('fails closed on invalid exact-version reads and preserves owner failures', async () => {
    const runtime = await stack();
    const invalid = await fetch(
      `${runtime.base}/internal/v1/production-intakes/${intakeId}/fee-facts/current?expectedIntakeVersion=0`,
      { headers: headers() }
    );
    expect(invalid.status).toBe(400);

    runtime.getCurrent.mockRejectedValueOnce(
      new ProductionFeeFactsError('PRODUCTION_FEE_FACTS_STALE', 'Fee facts are stale.', 409)
    );
    const stale = await fetch(
      `${runtime.base}/internal/v1/production-intakes/${intakeId}/fee-facts/current?expectedIntakeVersion=1`,
      { headers: headers() }
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'PRODUCTION_FEE_FACTS_STALE' });
  });
});
