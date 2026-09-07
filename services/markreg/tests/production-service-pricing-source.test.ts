import { describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  CommercialCatalogItem,
  CommercialPrice,
  CommercialProduct
} from '@markorbit/contracts/commercial';
import {
  noEarlyFunnelAuthorityConsequences,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  MARKREG_SERVICE_PRICING_SOURCE_ID,
  MARKREG_SERVICE_PRICING_SOURCE_POLICY,
  ProductionServicePricingSourceService,
  productionServicePricingSourceSha256,
  type ReadProductionServicePricingSourceV1
} from '../src/production-service-pricing-source.js';

const workspaceId = '60606060-6060-4606-8606-606060606060';
const at = '2026-09-07T12:30:00.000Z';

const principal = (
  permissions: WorkspacePrincipal['permissions'] = ['workspace:read', 'order:read']
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task0946',
  userId: 'user_task0946',
  workspaceId,
  membershipId: 'membership_task0946',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

const intake = (): ProductionIntakeV1 => ({
  schemaVersion: 1,
  intakeId: 'intake_task0946',
  workspaceId,
  version: 2,
  status: 'RECOMMENDATION_READY',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Prepare a governed trademark filing plan.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs LLC', country: 'US' },
    trademark: { type: 'WORD', representationText: 'MARK ORBIT' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Trademark portfolio software.' },
    filingGoal: 'Review filing strategy before commercial quote.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: 'a'.repeat(64),
  createdAt: '2026-09-07T12:00:00.000Z',
  updatedAt: '2026-09-07T12:10:00.000Z',
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

const product = (): CommercialProduct => ({
  schemaVersion: 1,
  productId: 'product_trademark-filing',
  code: 'TRADEMARK_FILING',
  name: 'Trademark filing',
  serviceType: 'TrademarkFiling',
  status: 'ACTIVE',
  version: 3,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z'
});

const price = (overrides: Partial<CommercialPrice> = {}): CommercialPrice => ({
  schemaVersion: 1,
  priceId: 'price_direct-filing-v2',
  productId: product().productId,
  priceVersion: 2,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  amount: { amountMinor: 29900, currency: 'USD' },
  status: 'ACTIVE',
  validFrom: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides
});

const request = (overrides: Partial<ReadProductionServicePricingSourceV1> = {}) => ({
  schemaVersion: 1 as const,
  intakeId: intake().intakeId,
  expectedIntakeVersion: 2,
  expectedIntakeFingerprintSha256: intake().fingerprintSha256,
  ...overrides
});

function catalog(items: CommercialCatalogItem[]) {
  const products = new Map(items.map((item) => [item.product.productId, item.product]));
  const prices = new Map(
    items.flatMap((item) => item.prices.map((value) => [value.priceId, value]))
  );
  return {
    listCatalog: () => Promise.resolve(structuredClone(items)),
    findProduct: (id: CommercialProduct['productId']) =>
      Promise.resolve(structuredClone(products.get(id) ?? null)),
    findPrice: (id: CommercialPrice['priceId']) =>
      Promise.resolve(structuredClone(prices.get(id) ?? null))
  };
}

const single = (): CommercialCatalogItem[] => [{ product: product(), prices: [price()] }];

describe('Production Service Pricing Source', () => {
  it('projects deterministic governed service-price material from exact Intake + Commercial Price', async () => {
    const service = new ProductionServicePricingSourceService(
      { get: () => Promise.resolve(intake()) },
      catalog(single()),
      () => at
    );
    const first = await service.read(principal(), request());
    const second = await service.read(principal(), request());

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      workspaceId,
      intake: { id: intake().intakeId, version: 2, fingerprintSha256: 'a'.repeat(64) },
      source: {
        sourceKind: 'PRICING_SOURCE',
        sourceId: MARKREG_SERVICE_PRICING_SOURCE_ID,
        admissionClass: 'PRODUCTION_ADMISSIBLE',
        currentness: 'CURRENT',
        currentnessCheckedAt: at
      },
      material: {
        policyId: MARKREG_SERVICE_PRICING_SOURCE_POLICY,
        product: { productId: product().productId, version: 3, code: 'TRADEMARK_FILING' },
        price: {
          priceId: price().priceId,
          priceVersion: 2,
          amount: { amountMinor: 29900, currency: 'USD' },
          channel: 'MARKREG_DIRECT',
          relationshipModel: 'DIRECT'
        }
      },
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
    expect(first.source.fingerprintSha256).toBe(
      productionServicePricingSourceSha256({ intake: first.intake, material: first.material })
    );
    expect(first.source.limitations.join(' ')).toMatch(/excludes official fees/i);
  });

  it('fails closed when current commercial pricing is ambiguous', async () => {
    const items: CommercialCatalogItem[] = [
      {
        product: product(),
        prices: [price(), price({ priceId: 'price_direct-filing-v3', priceVersion: 3 })]
      }
    ];
    const service = new ProductionServicePricingSourceService(
      { get: () => Promise.resolve(intake()) },
      catalog(items),
      () => at
    );
    await expect(service.read(principal(), request())).rejects.toMatchObject({
      code: 'AMBIGUOUS_SERVICE_PRICE',
      status: 409
    });
  });

  it('fails closed when Product/Price drifts after catalog selection', async () => {
    const listed = single();
    const service = new ProductionServicePricingSourceService(
      { get: () => Promise.resolve(intake()) },
      {
        listCatalog: () => Promise.resolve(listed),
        findProduct: () => Promise.resolve(product()),
        findPrice: () => Promise.resolve(price({ amount: { amountMinor: 30900, currency: 'USD' } }))
      },
      () => at
    );
    await expect(service.read(principal(), request())).rejects.toMatchObject({
      code: 'SERVICE_PRICE_VERSION_DRIFT',
      status: 409
    });
  });

  it('requires exact current Intake identity and commercial read permission', async () => {
    const service = new ProductionServicePricingSourceService(
      { get: () => Promise.resolve(intake()) },
      catalog(single()),
      () => at
    );
    await expect(
      service.read(principal(), request({ expectedIntakeFingerprintSha256: 'b'.repeat(64) }))
    ).rejects.toMatchObject({ code: 'INTAKE_VERSION_CONFLICT', status: 409 });
    await expect(service.read(principal(['workspace:read']), request())).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      status: 403
    });
  });
});
