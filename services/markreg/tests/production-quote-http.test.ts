import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  noEarlyFunnelAuthorityConsequences,
  type ProductionQuoteV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createProductionQuoteRoutesV1 } from '../src/production-quote-http.js';
import {
  ProductionQuoteError,
  type PostgresProductionQuoteServiceV1
} from '../src/production-quote.js';

const workspaceId = '73737373-7373-4737-8737-737373737373';
const otherWorkspaceId = '74747474-7474-4747-8747-747474747474';
const secret = 'markreg-production-quote-secret-32-bytes';
const active: ServiceRuntime[] = [];
const quoteId = 'quote_wif06-http';
const intakeId = 'intake_wif06-http';
const recommendationId = 'recommendation_wif06-http';
const selectionId = 'selection_wif06-http';
const at = '2026-09-15T04:00:00.000Z';

const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_wif06_http',
  userId: 'user_wif06_http',
  workspaceId: workspace,
  membershipId: 'membership_wif06_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'order:read', 'order:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});
const headers = (value: WorkspacePrincipal) => ({
  'content-type': 'application/json',
  'idempotency-key': 'quote-wif06-http-key',
  'x-markorbit-internal-authorization': secret,
  'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
  'x-markorbit-workspace-id': value.workspaceId,
  'x-correlation-id': 'correlation_quote-wif06-http'
});

const command = {
  schemaVersion: 1,
  intakeId,
  expectedIntakeVersion: 2,
  recommendationId,
  expectedRecommendationVersion: 1,
  selectionId,
  expectedSelectionVersion: 1,
  idempotencyKey: 'quote-wif06-http-key',
  correlationId: 'correlation_quote-wif06-http'
} as const;

const quote = (): ProductionQuoteV1 => ({
  schemaVersion: 1,
  quoteId,
  workspaceId,
  version: 1,
  admissionClass: 'PRODUCTION_ADMISSIBLE',
  status: 'READY',
  intake: { id: intakeId, version: 2, fingerprintSha256: 'a'.repeat(64) },
  recommendation: {
    id: recommendationId,
    version: 1,
    fingerprintSha256: 'b'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT'
  },
  selection: {
    id: selectionId,
    version: 1,
    fingerprintSha256: 'c'.repeat(64),
    currentness: 'CURRENT'
  },
  pricingSource: {
    sourceKind: 'PRICING_SOURCE',
    sourceId: 'markreg.production-quote.composite-pricing.v1',
    sourceVersion: 'official:1|service:1',
    fingerprintSha256: 'd'.repeat(64),
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    currentness: 'CURRENT',
    currentnessCheckedAt: at,
    provenanceRefs: ['official-fee:wif06', 'service-price:wif06'],
    assumptions: [],
    limitations: ['Quote is a commercial proposal only.']
  },
  currency: 'USD',
  lines: [
    {
      code: 'official',
      description: 'Estimated official fee',
      category: 'OFFICIAL_FEE',
      amount: { amountMinor: 70000, currency: 'USD' },
      sourceReference: { sourceId: 'official-fee:wif06', sourceVersion: '4' }
    },
    {
      code: 'service',
      description: 'Professional service fee',
      category: 'SERVICE_FEE',
      amount: { amountMinor: 29900, currency: 'USD' },
      sourceReference: { sourceId: 'service-price:wif06', sourceVersion: '2' }
    }
  ],
  subtotal: { amountMinor: 99900, currency: 'USD' },
  estimatedOfficialFees: { amountMinor: 70000, currency: 'USD' },
  estimatedServiceFees: { amountMinor: 29900, currency: 'USD' },
  estimatedDisbursements: { amountMinor: 0, currency: 'USD' },
  estimatedTaxes: { amountMinor: 0, currency: 'USD' },
  total: { amountMinor: 99900, currency: 'USD' },
  assumptions: [
    { code: 'CURRENT_SOURCE', text: 'Current governed pricing sources remain applicable.' }
  ],
  limitations: ['Quote is not an Order, Payment, Invoice or filing authorization.'],
  validUntil: '2026-09-29T04:00:00.000Z',
  createdAt: at,
  fingerprintSha256: 'e'.repeat(64),
  authorityConsequences: noEarlyFunnelAuthorityConsequences
});
afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

async function stack(
  overrides: Partial<{
    create: PostgresProductionQuoteServiceV1['create'];
    get: PostgresProductionQuoteServiceV1['get'];
  }> = {}
) {
  const create = vi.fn(
    overrides.create ?? (() => Promise.resolve(quote()))
  ) as unknown as PostgresProductionQuoteServiceV1['create'];
  const get = vi.fn(
    overrides.get ?? (() => Promise.resolve(quote()))
  ) as unknown as PostgresProductionQuoteServiceV1['get'];
  const service = { create, get } as Pick<PostgresProductionQuoteServiceV1, 'create' | 'get'>;
  const runtime = createServiceRuntime(
    { name: 'markreg-production-quote-http-test', port: 0, version: '1' },
    { routes: createProductionQuoteRoutesV1({ internalServiceSecret: secret, service }) }
  );
  active.push(runtime);
  await runtime.start();
  return { base: `http://127.0.0.1:${runtime.listeningPort}`, create, get };
}

describe('Production Quote HTTP', () => {
  it('creates a Quote from exact upstream artifact identities under trusted Workspace authority', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/internal/v1/production-quotes`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify(command)
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ quote: quote() });
    expect(runtime.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: 'user_wif06_http' }),
      command,
      'correlation_quote-wif06-http'
    );
  });

  it('reads Quote through the same trusted Workspace boundary', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/internal/v1/production-quotes/${quoteId}`, {
      headers: headers(principal())
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ quote: quote() });
    expect(runtime.get).toHaveBeenCalledWith(expect.objectContaining({ workspaceId }), quoteId);
  });

  it('rejects untrusted callers, Workspace mismatch and caller-derived pricing authority', async () => {
    const runtime = await stack();
    const untrusted = await fetch(`${runtime.base}/internal/v1/production-quotes/${quoteId}`, {
      headers: { ...headers(principal()), 'x-markorbit-internal-authorization': 'wrong-secret' }
    });
    expect(untrusted.status).toBe(401);

    const mismatch = await fetch(`${runtime.base}/internal/v1/production-quotes/${quoteId}`, {
      headers: { ...headers(principal()), 'x-markorbit-workspace-id': otherWorkspaceId }
    });
    expect(mismatch.status).toBe(404);
    for (const injected of [
      { workspaceId },
      { amount: { amountMinor: 1, currency: 'USD' } },
      { currency: 'BTC' },
      { pricingSource: { sourceId: 'attacker' } },
      { officialFee: 1 },
      { serviceFee: 1 },
      { status: 'CONFIRMED' },
      { validUntil: '2030-01-01T00:00:00.000Z' },
      { admissionClass: 'PRODUCTION_ADMISSIBLE' },
      { fingerprintSha256: 'f'.repeat(64) },
      { supersedesQuoteId: 'quote_attacker' }
    ]) {
      const response = await fetch(`${runtime.base}/internal/v1/production-quotes`, {
        method: 'POST',
        headers: headers(principal()),
        body: JSON.stringify({ ...command, ...injected })
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'INVALID_PRODUCTION_QUOTE_REQUEST' });
    }
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it('rejects body/header idempotency mismatch before owner mutation', async () => {
    const runtime = await stack();
    const response = await fetch(`${runtime.base}/internal/v1/production-quotes`, {
      method: 'POST',
      headers: headers(principal()),
      body: JSON.stringify({ ...command, idempotencyKey: 'different-key' })
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_PRODUCTION_QUOTE_REQUEST' });
    expect(runtime.create).not.toHaveBeenCalled();
  });

  it('preserves retryable persistence failure without fixture fallback', async () => {
    const runtime = await stack({
      get: () =>
        Promise.reject(
          new ProductionQuoteError(
            'PERSISTENCE_UNAVAILABLE',
            'Production Quote persistence is unavailable.',
            503,
            true
          )
        )
    });
    const response = await fetch(`${runtime.base}/internal/v1/production-quotes/${quoteId}`, {
      headers: headers(principal())
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      retryable: true
    });
  });
});
