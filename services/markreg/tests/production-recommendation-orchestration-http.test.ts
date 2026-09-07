import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { ProductionRecommendationV1 } from '@markorbit/contracts/markreg-early-funnel';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createProductionRecommendationOrchestrationRoutesV1 } from '../src/production-recommendation-orchestration-http.js';
import {
  ProductionRecommendationOrchestrationError,
  type ProductionRecommendationOrchestrationServiceV1
} from '../src/production-recommendation-orchestration.js';

const workspaceId = '71717171-7171-4717-8717-717171717171';
const secret = 'markreg-recommendation-orchestration-secret-32-bytes';
const active: ServiceRuntime[] = [];
const principal = (): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_948_http',
  userId: 'user_948_http',
  workspaceId,
  membershipId: 'membership_948_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});
const recommendation = {
  recommendationId: 'recommendation_948_http'
} as unknown as ProductionRecommendationV1;
const headers = () => ({
  'content-type': 'application/json',
  'idempotency-key': 'orchestration-http-948',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal()),
  'x-markorbit-workspace-id': workspaceId
});
afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function stack(createImpl?: ProductionRecommendationOrchestrationServiceV1['create']) {
  const create = vi.fn(
    createImpl ?? (() => Promise.resolve(recommendation))
  ) as unknown as ProductionRecommendationOrchestrationServiceV1['create'];
  const runtime = createServiceRuntime(
    { name: 'markreg-recommendation-orchestration-http-test', port: 0, version: '1' },
    {
      routes: createProductionRecommendationOrchestrationRoutesV1({
        internalServiceSecret: secret,
        service: { create }
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return { base: `http://127.0.0.1:${runtime.listeningPort}`, create };
}

const body = () => ({
  schemaVersion: 1,
  intakeId: 'intake_http_948',
  expectedIntakeVersion: 1,
  expectedIntakeFingerprintSha256: 'a'.repeat(64),
  idempotencyKey: 'orchestration-http-948',
  correlationId: 'correlation_http_948'
});
describe('Production Recommendation orchestration HTTP', () => {
  it('forwards only the exact Intake command under trusted Workspace authority', async () => {
    const runtime = await stack();
    const response = await fetch(
      `${runtime.base}/internal/v1/production-recommendation-orchestrations`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body())
      }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recommendation });
    expect(runtime.create).toHaveBeenCalledWith(
      principal(),
      expect.objectContaining({
        intakeId: 'intake_http_948',
        expectedIntakeVersion: 1,
        expectedIntakeFingerprintSha256: 'a'.repeat(64),
        idempotencyKey: 'orchestration-http-948'
      })
    );
  });

  it('rejects capability, producer and authority injection before owner service', async () => {
    const runtime = await stack();
    for (const injected of [
      { capabilityId: 'attacker' },
      { producerReference: {} },
      { userId: 'attacker' },
      { workspaceId: workspaceId }
    ]) {
      const response = await fetch(
        `${runtime.base}/internal/v1/production-recommendation-orchestrations`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ ...body(), ...injected })
        }
      );
      expect(response.status).toBe(400);
    }
    expect(runtime.create).not.toHaveBeenCalled();
  });
  it('maps owner conflict/unavailability and rejects untrusted internal callers', async () => {
    const conflict = await stack(() =>
      Promise.reject(
        new ProductionRecommendationOrchestrationError(
          'PRODUCTION_INTAKE_CONFLICT',
          'Intake drifted.',
          409
        )
      )
    );
    const conflictResponse = await fetch(
      `${conflict.base}/internal/v1/production-recommendation-orchestrations`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body())
      }
    );
    expect(conflictResponse.status).toBe(409);

    const untrusted = await stack();
    const badHeaders = { ...headers(), 'x-markorbit-internal-authorization': 'wrong-secret' };
    const response = await fetch(
      `${untrusted.base}/internal/v1/production-recommendation-orchestrations`,
      {
        method: 'POST',
        headers: badHeaders,
        body: JSON.stringify(body())
      }
    );
    expect(response.status).toBe(401);
    expect(untrusted.create).not.toHaveBeenCalled();
  });
});
