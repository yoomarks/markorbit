import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { noEarlyFunnelAuthorityConsequences } from '@markorbit/contracts/markreg-early-funnel';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createProductionServicePricingSourceRoutes } from '../src/production-service-pricing-source-http.js';
import {
  MARKREG_SERVICE_PRICING_SOURCE_ID,
  MARKREG_SERVICE_PRICING_SOURCE_POLICY,
  ProductionServicePricingSourceError,
  type ProductionServicePricingSourceService,
  type ProductionServicePricingSourceV1
} from '../src/production-service-pricing-source.js';

const workspaceId = '60606060-6060-4606-8606-606060606060';
const otherWorkspaceId = '61616161-6161-4616-8616-616161616161';
const secret = 'markreg-service-pricing-source-secret-32-bytes';
const active: ServiceRuntime[] = [];
const intakeId = 'intake_task0946-http';
const intakeFingerprint = 'a'.repeat(64);

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0946_http',
  userId: 'user_task0946_http',
  workspaceId: workspace,
  membershipId: 'membership_task0946_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'order:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const headers = (value: WorkspacePrincipal) => ({
  'content-type': 'application/json',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
  'x-markorbit-workspace-id': value.workspaceId
});

const body = {
  schemaVersion: 1,
  intakeId,
  expectedIntakeVersion: 2,
  expectedIntakeFingerprintSha256: intakeFingerprint
} as const;

const pricingSource = (): ProductionServicePricingSourceV1 => ({
  schemaVersion: 1,
  workspaceId,
  intake: { id: intakeId, version: 2, fingerprintSha256: intakeFingerprint },
  source: {
    sourceKind: 'PRICING_SOURCE',
    sourceId: MARKREG_SERVICE_PRICING_SOURCE_ID,
    sourceVersion: 'product:product_trademark-filing@1|price:price_direct-filing-v1@1',
    fingerprintSha256: 'b'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: '2026-09-07T12:30:00.000Z',
    provenanceRefs: [
      'commercial-product:product_trademark-filing@1',
      'commercial-price:price_direct-filing-v1@1'
    ],
    assumptions: ['Exact commercial context remains applicable.'],
    limitations: ['Service fee only; official fees are excluded.']
  },
  material: {
    policyId: MARKREG_SERVICE_PRICING_SOURCE_POLICY,
    product: {
      productId: 'product_trademark-filing',
      version: 1,
      code: 'TRADEMARK_FILING',
      serviceType: 'TrademarkFiling'
    },
    price: {
      priceId: 'price_direct-filing-v1',
      priceVersion: 1,
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      amount: { amountMinor: 29900, currency: 'USD' },
      status: 'ACTIVE',
      validFrom: '2026-09-01T00:00:00.000Z'
    }
  },
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function stack(
  read: ProductionServicePricingSourceService['read'] = () => Promise.resolve(pricingSource())
) {
  const readMock = vi.fn(read) as unknown as ProductionServicePricingSourceService['read'];
  const runtime = createServiceRuntime(
    { name: 'markreg-service-pricing-source-http-test', port: 0, version: '1' },
    {
      routes: createProductionServicePricingSourceRoutes({
        internalServiceSecret: secret,
        service: { read: readMock }
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return { base: `http://127.0.0.1:${runtime.listeningPort}`, read: readMock };
}

describe('Production Service Pricing Source HTTP', () => {
  it('reads governed pricing from exact Intake under trusted Workspace authority', async () => {
    const runtime = await stack();
    const response = await fetch(
      `${runtime.base}/internal/v1/production-service-pricing-source/read`,
      {
        method: 'POST',
        headers: headers(principal()),
        body: JSON.stringify(body)
      }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pricingSource: pricingSource() });
    expect(runtime.read).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: 'user_task0946_http' }),
      body
    );
  });

  it('requires trusted internal authorization and exact Workspace identity', async () => {
    const runtime = await stack();
    const untrusted = await fetch(
      `${runtime.base}/internal/v1/production-service-pricing-source/read`,
      {
        method: 'POST',
        headers: {
          ...headers(principal()),
          'x-markorbit-internal-authorization': 'wrong-secret'
        },
        body: JSON.stringify(body)
      }
    );
    expect(untrusted.status).toBe(401);
    expect(await untrusted.json()).toMatchObject({ code: 'UNTRUSTED_INTERNAL_CALLER' });

    const mismatch = await fetch(
      `${runtime.base}/internal/v1/production-service-pricing-source/read`,
      {
        method: 'POST',
        headers: { ...headers(principal()), 'x-markorbit-workspace-id': otherWorkspaceId },
        body: JSON.stringify(body)
      }
    );
    expect(mismatch.status).toBe(404);
    expect(await mismatch.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });
  });

  it('rejects caller-supplied pricing selectors or authority fields before owner read', async () => {
    const runtime = await stack();
    for (const injected of [
      { workspaceId },
      { productId: 'product_attacker' },
      { priceId: 'price_attacker' },
      { amount: { amountMinor: 1, currency: 'USD' } },
      { channel: 'MARKREG_WHITE_LABEL' },
      { asOf: '2020-01-01T00:00:00.000Z' }
    ]) {
      const response = await fetch(
        `${runtime.base}/internal/v1/production-service-pricing-source/read`,
        {
          method: 'POST',
          headers: headers(principal()),
          body: JSON.stringify({ ...body, ...injected })
        }
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: 'INVALID_SERVICE_PRICING_SOURCE_REQUEST'
      });
    }
    expect(runtime.read).not.toHaveBeenCalled();
  });

  it('preserves explicit retryable dependency failure without fixture fallback', async () => {
    const runtime = await stack(() =>
      Promise.reject(
        new ProductionServicePricingSourceError(
          'PERSISTENCE_UNAVAILABLE',
          'Service-pricing source dependencies are unavailable.',
          503,
          true
        )
      )
    );
    const response = await fetch(
      `${runtime.base}/internal/v1/production-service-pricing-source/read`,
      {
        method: 'POST',
        headers: headers(principal()),
        body: JSON.stringify(body)
      }
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      retryable: true
    });
  });
});
