import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  noRecommendationSourceAuthorityConsequences,
  type ProductionRecommendationV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createProductionRecommendationRoutes } from '../src/production-recommendation-http.js';
import {
  ProductionRecommendationError,
  type PostgresProductionRecommendationService
} from '../src/production-recommendation.js';

const workspaceId = '60606060-6060-4606-8606-606060606060';
const otherWorkspaceId = '61616161-6161-4616-8616-616161616161';
const secret = 'markreg-production-recommendation-secret-32-bytes';
const active: ServiceRuntime[] = [];
const recommendationId = 'recommendation_http-task0757';

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0757_http',
  userId: 'user_task0757_http',
  workspaceId: workspace,
  membershipId: 'membership_task0757_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const headers = (value: WorkspacePrincipal) => ({
  'content-type': 'application/json',
  'idempotency-key': 'production-recommendation-http-task0757',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
  'x-markorbit-workspace-id': value.workspaceId,
  'x-correlation-id': 'correlation_task0757_http'
});

const producerReference = {
  schemaVersion: 1,
  idempotencyKey: 'capability-strategy-http-task0757',
  requestFingerprintSha256: 'a'.repeat(64),
  capabilityRequestId: 'capreq_strategy-http-task0757',
  sessionReceiptId: 'session-receipt_strategy-http-task0757'
} as const;

const command = {
  schemaVersion: 1,
  intakeId: 'intake_http-task0757',
  expectedIntakeVersion: 1,
  producerReference,
  idempotencyKey: 'production-recommendation-http-task0757',
  correlationId: 'correlation_task0757_http'
} as const;

const recommendation = (): ProductionRecommendationV1 => ({
  schemaVersion: 1,
  recommendationId,
  workspaceId,
  version: 1,
  intake: { id: 'intake_http-task0757', version: 1, fingerprintSha256: 'b'.repeat(64) },
  admissionClass: 'PRODUCTION_ADMISSIBLE',
  currentness: 'CURRENT',
  source: {
    sourceKind: 'CAPABILITY_RESULT',
    sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
    sourceVersion: '1.0.0|runtime:test',
    fingerprintSha256: 'c'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: '2026-09-07T04:00:00.000Z',
    provenanceRefs: ['source:test'],
    assumptions: [],
    limitations: ['Human review required.'],
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  },
  options: [
    { code: 'A', title: 'A', description: 'A bounded review option.' },
    { code: 'B', title: 'B', description: 'A bounded review option.' },
    { code: 'C', title: 'C', description: 'A bounded review option.' }
  ],
  rationale: 'Bounded review only.',
  assumptions: [],
  limitations: ['No filing authorization.'],
  provenanceRefs: ['source:test'],
  generatedAt: '2026-09-07T04:01:00.000Z',
  fingerprintSha256: 'd'.repeat(64),
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function stack(
  overrides: Partial<{
    create: PostgresProductionRecommendationService['create'];
    get: PostgresProductionRecommendationService['get'];
  }> = {}
) {
  const create = vi.fn(
    overrides.create ?? (() => Promise.resolve(recommendation()))
  ) as unknown as PostgresProductionRecommendationService['create'];
  const get = vi.fn(
    overrides.get ?? (() => Promise.resolve(recommendation()))
  ) as unknown as PostgresProductionRecommendationService['get'];
  const service = { create, get } as Pick<
    PostgresProductionRecommendationService,
    'create' | 'get'
  >;
  const runtime = createServiceRuntime(
    { name: 'markreg-production-recommendation-http-test', port: 0, version: '1' },
    { routes: createProductionRecommendationRoutes({ internalServiceSecret: secret, service }) }
  );
  active.push(runtime);
  await runtime.start();
  return { base: `http://127.0.0.1:${runtime.listeningPort}`, create, get };
}

describe('Production Recommendation HTTP', () => {
  it('forwards the exact producer reference under trusted Workspace authority', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/internal/v1/production-recommendations`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify(command)
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recommendation: recommendation() });
    expect(runtime.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: 'user_task0757_http' }),
      command,
      'correlation_task0757_http'
    );
  });

  it('reads only through the exact trusted Workspace', async () => {
    const runtime = await stack();
    const response = await fetch(
      `${runtime.base}/internal/v1/production-recommendations/${recommendationId}`,
      { headers: headers(principal()) }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recommendation: recommendation() });
    expect(runtime.get).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId }),
      recommendationId
    );
  });

  it('rejects untrusted callers, Workspace mismatch, authority spoofing and key mismatch', async () => {
    const runtime = await stack();
    const untrusted = await fetch(
      `${runtime.base}/internal/v1/production-recommendations/${recommendationId}`,
      { headers: { ...headers(principal()), 'x-markorbit-internal-authorization': 'wrong' } }
    );
    expect(untrusted.status).toBe(401);

    const mismatch = await fetch(
      `${runtime.base}/internal/v1/production-recommendations/${recommendationId}`,
      { headers: { ...headers(principal()), 'x-markorbit-workspace-id': otherWorkspaceId } }
    );
    expect(mismatch.status).toBe(404);

    const spoofed = await fetch(`${runtime.base}/internal/v1/production-recommendations`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify({ ...command, workspaceId })
    });
    expect(spoofed.status).toBe(400);

    const badKey = await fetch(`${runtime.base}/internal/v1/production-recommendations`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify({ ...command, idempotencyKey: 'different-key' })
    });
    expect(badKey.status).toBe(400);
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it('preserves retryable source/persistence failure without fixture fallback', async () => {
    const runtime = await stack({
      create: () =>
        Promise.reject(
          new ProductionRecommendationError(
            'RECOMMENDATION_SOURCE_UNAVAILABLE',
            'Capability Recommendation source is unavailable.',
            503,
            true
          )
        )
    });
    const response = await fetch(`${runtime.base}/internal/v1/production-recommendations`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify(command)
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'RECOMMENDATION_SOURCE_UNAVAILABLE',
      retryable: true
    });
  });
});
