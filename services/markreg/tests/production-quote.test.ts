import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  noRecommendationSourceAuthorityConsequences,
  type ProductionIntakeV1,
  type CreateProductionQuoteCommandV1,
  type ProductionQuoteV1,
  type ProductionRecommendationV1,
  type UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import type { QueryClient } from '@markorbit/persistence';
import {
  PostgresProductionQuoteServiceV1,
  type ProductionQuoteTransactionHost
} from '../src/production-quote.js';
import type { ProductionServicePricingSourceV1 } from '../src/production-service-pricing-source.js';
import type { ProductionOfficialFeeSourceV1 } from '../src/production-official-fee-source.js';

const workspaceId = '72727272-7272-4727-8727-727272727272';
const at = '2026-09-15T04:00:00.000Z';
const fingerprintA = 'a'.repeat(64);
const fingerprintB = 'b'.repeat(64);
const fingerprintC = 'c'.repeat(64);
const fingerprintD = 'd'.repeat(64);

const principal = (): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_wif06_quote',
  userId: 'user_wif06_quote',
  workspaceId,
  membershipId: 'membership_wif06_quote',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'order:read', 'order:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});
const intake = (): ProductionIntakeV1 => ({
  schemaVersion: 1,
  intakeId: 'intake_wif06-quote',
  workspaceId,
  version: 2,
  status: 'RECOMMENDATION_READY',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  input: {
    businessContext: 'Prepare a governed trademark filing quote.',
    applicant: { type: 'ORGANIZATION', name: 'Orbit Labs LLC', country: 'US' },
    trademark: { type: 'WORD', representationText: 'MARK ORBIT' },
    targetJurisdictions: ['US'],
    goodsServices: { sourceText: 'Trademark portfolio software.' },
    filingGoal: 'Review filing strategy before commercial quote.'
  },
  sourceClass: 'CUSTOMER_SUPPLIED',
  fingerprintSha256: fingerprintA,
  createdAt: '2026-09-15T03:00:00.000Z',
  updatedAt: '2026-09-15T03:10:00.000Z',
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

const recommendation = (): ProductionRecommendationV1 => ({
  schemaVersion: 1,
  recommendationId: 'recommendation_wif06-quote',
  workspaceId,
  version: 1,
  intake: { id: intake().intakeId, version: 2, fingerprintSha256: fingerprintA },
  admissionClass: 'PRODUCTION_ADMISSIBLE',
  currentness: 'CURRENT',
  source: {
    sourceKind: 'CAPABILITY_RESULT',
    sourceId: 'markreg.us-trademark-mark-representation-strategy-source',
    sourceVersion: '1.0.0',
    fingerprintSha256: fingerprintB,
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: at,
    provenanceRefs: ['capability-source:wif06'],
    assumptions: [],
    limitations: [],
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  },
  options: [
    { code: 'A', title: 'A', description: 'Essential protection.' },
    { code: 'B', title: 'B', description: 'Balanced protection.' },
    { code: 'C', title: 'C', description: 'Extended protection.' }
  ],
  rationale: 'Bounded production recommendation.',
  assumptions: [],
  limitations: ['Recommendation is not filing authorization.'],
  provenanceRefs: ['production-intake:wif06'],
  generatedAt: '2026-09-15T03:20:00.000Z',
  fingerprintSha256: fingerprintC,
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

const selection = (): UserSelectionV1 => ({
  schemaVersion: 1,
  selectionId: 'selection_wif06-quote',
  workspaceId,
  version: 1,
  status: 'CURRENT',
  recommendation: {
    id: recommendation().recommendationId,
    version: 1,
    fingerprintSha256: fingerprintC
  },
  selectedOptionCode: 'B',
  selectedAt: '2026-09-15T03:30:00.000Z',
  fingerprintSha256: fingerprintD,
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

const servicePricing = (): ProductionServicePricingSourceV1 => ({
  schemaVersion: 1,
  workspaceId,
  intake: { id: intake().intakeId, version: 2, fingerprintSha256: fingerprintA },
  source: {
    sourceKind: 'PRICING_SOURCE',
    sourceId: 'markreg.service-pricing.trademark-filing',
    sourceVersion: 'product:product_trademark-filing@3|price:price_direct@2',
    fingerprintSha256: 'e'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: at,
    provenanceRefs: ['commercial-price:price_direct@2'],
    assumptions: ['Exact commercial context remains applicable.'],
    limitations: ['Service fee only.']
  },
  material: {
    policyId: 'markreg.service-pricing-source.trademark-filing.v1',
    product: {
      productId: 'product_trademark-filing',
      version: 3,
      code: 'TRADEMARK_FILING',
      serviceType: 'TrademarkFiling'
    },
    price: {
      priceId: 'price_direct',
      priceVersion: 2,
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT',
      amount: { amountMinor: 29900, currency: 'USD' },
      status: 'ACTIVE',
      validFrom: '2026-09-01T00:00:00.000Z'
    }
  },
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

const officialFee = (): ProductionOfficialFeeSourceV1 => ({
  schemaVersion: 1,
  workspaceId,
  intake: { id: intake().intakeId, version: 2, fingerprintSha256: fingerprintA },
  feeFacts: { id: 'fee-facts_wif06-quote', version: 1, fingerprintSha256: 'f'.repeat(64) },
  source: {
    sourceKind: 'PRICING_SOURCE',
    sourceId: 'resolver.uspto-official-fee-base-application-per-class',
    sourceVersion: '1.0.0|reference:official-fee-ref_wif06@4|evidence:source-evidence_wif06',
    fingerprintSha256: '1'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: at,
    provenanceRefs: ['official-fee-reference:wif06'],
    assumptions: ['Exact current fee facts remain applicable.'],
    limitations: ['Base application fee only.']
  },
  material: {
    filingBasis: 'SECTION_1',
    classCount: 2,
    feePerClass: { amountMinor: 35000, currency: 'USD' },
    totalOfficialFee: { amountMinor: 70000, currency: 'USD' },
    referenceId: 'official-fee-ref_wif06',
    referenceVersion: '4',
    effectiveFrom: '2025-01-18T00:00:00.000Z',
    productionEvidenceId: 'source-evidence_wif06'
  },
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});

const command = (): CreateProductionQuoteCommandV1 => ({
  schemaVersion: 1 as const,
  intakeId: intake().intakeId,
  expectedIntakeVersion: 2,
  recommendationId: recommendation().recommendationId,
  expectedRecommendationVersion: 1,
  selectionId: selection().selectionId,
  expectedSelectionVersion: 1,
  idempotencyKey: 'quote-wif06-1',
  correlationId: 'correlation_quote-wif06-1'
});
function testRuntime(
  selectionState = 'CURRENT',
  pricing = servicePricing(),
  official = officialFee()
) {
  let receipt: { fingerprint: string; quote: ProductionQuoteV1 } | undefined;
  const inserts: Array<{ sql: string; params: readonly unknown[] }> = [];
  const query = vi.fn(async (sqlValue: string, paramsValue?: readonly unknown[]) => {
    await Promise.resolve();
    const sql = String(sqlValue);
    const params = paramsValue ?? [];
    if (
      sql.includes('FROM markreg_early_funnel_commands') &&
      sql.includes("command_type='CREATE_QUOTE'")
    ) {
      return receipt
        ? {
            rowCount: 1,
            rows: [
              { request_fingerprint_sha256: receipt.fingerprint, response_data: receipt.quote }
            ]
          }
        : { rowCount: 0, rows: [] };
    }
    if (sql.includes('FROM markreg_early_funnel_intakes') && sql.includes('FOR UPDATE')) {
      return {
        rowCount: 1,
        rows: [{ version: 2, status: 'RECOMMENDATION_READY', fingerprint_sha256: fingerprintA }]
      };
    }
    if (sql.includes('FROM markreg_early_funnel_recommendations') && sql.includes('FOR UPDATE')) {
      return {
        rowCount: 1,
        rows: [
          {
            version: 1,
            fingerprint_sha256: fingerprintC,
            currentness: 'CURRENT',
            admission_class: 'PRODUCTION_ADMISSIBLE',
            intake_id: intake().intakeId,
            intake_version: 2,
            intake_fingerprint_sha256: fingerprintA
          }
        ]
      };
    }
    if (sql.includes('FROM markreg_early_funnel_selections s')) {
      return {
        rowCount: 1,
        rows: [
          {
            version: 1,
            fingerprint_sha256: fingerprintD,
            recommendation_id: recommendation().recommendationId,
            recommendation_version: 1,
            effective_state: selectionState
          }
        ]
      };
    }
    if (sql.includes('FROM markreg_production_fee_facts f')) {
      return {
        rowCount: 1,
        rows: [
          {
            fee_facts_id: official.feeFacts.id,
            version: official.feeFacts.version,
            fingerprint_sha256: official.feeFacts.fingerprintSha256,
            state: 'CURRENT'
          }
        ]
      };
    }
    if (sql.includes('FROM markreg_early_funnel_quotes q')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('INSERT')) {
      inserts.push({ sql, params });
      if (sql.includes('markreg_early_funnel_commands')) {
        receipt = {
          fingerprint: String(params[2]),
          quote: JSON.parse(String(params[4])) as ProductionQuoteV1
        };
      }
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected SQL in Production Quote test: ${sql}`);
  });
  const client = { query } as unknown as QueryClient;
  const database: ProductionQuoteTransactionHost = {
    transact: (work) => work(client)
  };
  const dependencies = {
    intakes: { get: vi.fn(() => Promise.resolve(intake())) },
    recommendations: { get: vi.fn(() => Promise.resolve(recommendation())) },
    selections: { get: vi.fn(() => Promise.resolve(selection())) },
    servicePricing: { read: vi.fn(() => Promise.resolve(pricing)) },
    officialFees: { resolve: vi.fn(() => Promise.resolve(official)) }
  };
  const service = new PostgresProductionQuoteServiceV1(database, client, dependencies, () => at);
  return { service, query, inserts, dependencies };
}

describe('Production Quote', () => {
  it('materializes and persists a governed READY Quote from exact current sources', async () => {
    const runtime = testRuntime();
    const quote = await runtime.service.create(principal(), command());

    expect(quote).toMatchObject({
      workspaceId,
      status: 'READY',
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      intake: { id: intake().intakeId, version: 2 },
      recommendation: { id: recommendation().recommendationId, currentness: 'CURRENT' },
      selection: { id: selection().selectionId, currentness: 'CURRENT' },
      estimatedOfficialFees: { amountMinor: 70000, currency: 'USD' },
      estimatedServiceFees: { amountMinor: 29900, currency: 'USD' },
      total: { amountMinor: 99900, currency: 'USD' },
      authorityConsequences: noEarlyFunnelAuthorityConsequences
    });
    expect(quote.lines).toHaveLength(2);
    expect(quote.lines[0]!.sourceReference.sourceVersion).toContain(
      `#${officialFee().source.fingerprintSha256}`
    );
    expect(quote.lines[1]!.sourceReference.sourceVersion).toContain(
      `#${servicePricing().source.fingerprintSha256}`
    );
    expect(runtime.inserts.some((entry) => entry.sql.includes('markreg_early_funnel_quotes'))).toBe(
      true
    );
    const receipt = runtime.inserts.find((entry) =>
      entry.sql.includes('markreg_early_funnel_commands')
    );
    expect(receipt?.params[1]).toBe(command().idempotencyKey);
  });
  it('replays the exact first Quote before re-reading external pricing sources', async () => {
    const runtime = testRuntime();
    const first = await runtime.service.create(principal(), command());
    runtime.dependencies.servicePricing.read.mockClear();
    runtime.dependencies.officialFees.resolve.mockClear();

    const replay = await runtime.service.create(principal(), command());
    expect(replay).toEqual(first);
    expect(runtime.dependencies.servicePricing.read).not.toHaveBeenCalled();
    expect(runtime.dependencies.officialFees.resolve).not.toHaveBeenCalled();
  });

  it('fails closed when Selection is superseded during the serializable admission window', async () => {
    const runtime = testRuntime('SUPERSEDED');
    await expect(runtime.service.create(principal(), command())).rejects.toMatchObject({
      code: 'SELECTION_NOT_CURRENT',
      status: 409
    });
    expect(runtime.inserts).toHaveLength(0);
  });

  it('fails closed before persistence when official and service currencies conflict', async () => {
    const base = officialFee();
    const conflicting: ProductionOfficialFeeSourceV1 = {
      ...base,
      material: {
        ...base.material,
        totalOfficialFee: { ...base.material.totalOfficialFee, currency: 'EUR' }
      }
    };
    const runtime = testRuntime('CURRENT', servicePricing(), conflicting);
    await expect(runtime.service.create(principal(), command())).rejects.toMatchObject({
      code: 'QUOTE_CURRENCY_CONFLICT',
      status: 409
    });
    expect(runtime.inserts).toHaveLength(0);
  });
});
