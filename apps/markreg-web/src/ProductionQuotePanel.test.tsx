// @vitest-environment jsdom
import type {
  ProductionIntakeV1,
  ProductionQuoteV1,
  ProductionRecommendationV1,
  UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApiError } from './api/errors.js';
import type { ProductionQuoteClient } from './api/production-quote.js';
import { ProductionQuotePanel } from './ProductionQuotePanel.js';

const workspaceId = '64646464-6464-4646-8646-646464646464';
const intake = {
  intakeId: 'production-intake_wif07_panel',
  workspaceId,
  version: 1,
  fingerprintSha256: 'a'.repeat(64),
  channel: 'MARKREG_WHITE_LABEL',
  relationshipModel: 'WHITE_LABEL'
} as unknown as ProductionIntakeV1;
const recommendation = {
  recommendationId: 'production-recommendation_wif07_panel',
  workspaceId,
  version: 2,
  fingerprintSha256: 'b'.repeat(64)
} as unknown as ProductionRecommendationV1;
const selection = {
  selectionId: 'production-selection_wif07_panel',
  workspaceId,
  version: 3,
  fingerprintSha256: 'c'.repeat(64),
  selectedOptionCode: 'B',
  selectedAt: '2026-09-15T06:03:00.000Z'
} as unknown as UserSelectionV1;
const quote = {
  quoteId: 'quote_wif07_panel',
  workspaceId,
  version: 1,
  status: 'READY',
  intake: { id: intake.intakeId, version: 1, fingerprintSha256: intake.fingerprintSha256 },
  recommendation: {
    id: recommendation.recommendationId,
    version: 2,
    fingerprintSha256: recommendation.fingerprintSha256
  },
  selection: {
    id: selection.selectionId,
    version: 3,
    fingerprintSha256: selection.fingerprintSha256
  },
  pricingSource: { sourceId: 'markreg.production-quote.composite-pricing.v1' },
  currency: 'USD',
  lines: [
    {
      description: 'Estimated official fee',
      amount: { amountMinor: 35000, currency: 'USD' }
    },
    {
      description: 'Professional service fee',
      amount: { amountMinor: 29900, currency: 'USD' }
    }
  ],
  total: { amountMinor: 64900, currency: 'USD' },
  subtotal: { amountMinor: 64900, currency: 'USD' },
  estimatedOfficialFees: { amountMinor: 35000, currency: 'USD' },
  estimatedServiceFees: { amountMinor: 29900, currency: 'USD' },
  estimatedDisbursements: { amountMinor: 0, currency: 'USD' },
  estimatedTaxes: { amountMinor: 0, currency: 'USD' },
  assumptions: [{ code: 'CURRENT_SOURCE', text: 'Current governed pricing applies.' }],
  limitations: ['Quote does not create an Order, Payment, Invoice, or filing authorization.'],
  validUntil: '2026-09-29T06:04:00.000Z',
  createdAt: '2026-09-15T06:04:00.000Z',
  fingerprintSha256: 'f'.repeat(64)
} as unknown as ProductionQuoteV1;

function client(overrides: Partial<ProductionQuoteClient> = {}): ProductionQuoteClient {
  return {
    create: vi.fn(() => Promise.resolve({ quote })),
    get: vi.fn(() => Promise.resolve({ quote })),
    ...overrides
  };
}

const pointerKey = `markreg-production-quote-pointer-v1:${workspaceId}:${selection.selectionId}:${selection.version}`;

beforeEach(() => sessionStorage.clear());

describe('ProductionQuotePanel', () => {
  it('auto-creates from exact durable lineage and reads owner Quote before rendering money', async () => {
    const create = vi.fn<ProductionQuoteClient['create']>(() => Promise.resolve({ quote }));
    const get = vi.fn<ProductionQuoteClient['get']>(() => Promise.resolve({ quote }));
    render(
      <ProductionQuotePanel
        intake={intake}
        recommendation={recommendation}
        selection={selection}
        client={client({ create, get })}
      />
    );

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0]![0]).toMatchObject({
      intakeId: intake.intakeId,
      expectedIntakeVersion: intake.version,
      recommendationId: recommendation.recommendationId,
      expectedRecommendationVersion: recommendation.version,
      selectionId: selection.selectionId,
      expectedSelectionVersion: selection.version
    });
    await waitFor(() => expect(get).toHaveBeenCalledWith(quote.quoteId));
    expect(await screen.findByRole('heading', { name: 'Governed Production Quote' })).toBeTruthy();
    expect(screen.getByText('$649.00')).toBeTruthy();
    expect(
      screen.getAllByText(/does not create an Order, Payment, Invoice/i).length
    ).toBeGreaterThan(0);
    expect(sessionStorage.getItem(pointerKey)).toContain(quote.quoteId);
  });

  it('continues the exact production Quote into Customer Confirmation', async () => {
    const user = userEvent.setup();
    render(
      <ProductionQuotePanel
        intake={intake}
        recommendation={recommendation}
        selection={selection}
        client={client()}
      />
    );
    await user.click(
      await screen.findByRole('button', { name: 'Continue to confirmation and Order' })
    );
    expect(await screen.findByRole('heading', { name: 'Customer Confirmation' })).toBeTruthy();
    expect(screen.getByText(/quote_wif07_panel/)).toBeTruthy();
  });

  it('fails closed on missing Fee Facts and retries after an explicit facts-save signal', async () => {
    const create = vi
      .fn<ProductionQuoteClient['create']>()
      .mockRejectedValueOnce(
        new MarkregApiError(
          'blocking',
          'fee facts missing',
          'correlation_wif07',
          'PRODUCTION_FEE_FACTS_NOT_FOUND',
          404
        )
      )
      .mockResolvedValueOnce({ quote });
    const get = vi.fn<ProductionQuoteClient['get']>(() => Promise.resolve({ quote }));
    const api = client({ create, get });
    const rendered = render(
      <ProductionQuotePanel
        intake={intake}
        recommendation={recommendation}
        selection={selection}
        client={api}
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Quote needs current application fee facts' })
    ).toBeTruthy();
    expect(get).not.toHaveBeenCalled();

    rendered.rerender(
      <ProductionQuotePanel
        intake={intake}
        recommendation={recommendation}
        selection={selection}
        retryToken="fee-facts-fingerprint-v2"
        client={api}
      />
    );

    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[1]![0].idempotencyKey).not.toBe(
      create.mock.calls[0]![0].idempotencyKey
    );
    await waitFor(() => expect(get).toHaveBeenCalledWith(quote.quoteId));
    expect(await screen.findByRole('heading', { name: 'Governed Production Quote' })).toBeTruthy();
  });

  it('uses a saved Quote pointer only for owner readback and does not repost', async () => {
    sessionStorage.setItem(pointerKey, JSON.stringify({ quoteId: quote.quoteId }));
    const create = vi.fn<ProductionQuoteClient['create']>();
    const get = vi.fn<ProductionQuoteClient['get']>(() => Promise.resolve({ quote }));
    render(
      <ProductionQuotePanel
        intake={intake}
        recommendation={recommendation}
        selection={selection}
        client={client({ create, get })}
      />
    );
    await waitFor(() => expect(get).toHaveBeenCalledWith(quote.quoteId));
    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Governed Production Quote' })).toBeTruthy();
  });

  it('retries uncertain durable readback without creating a second Quote', async () => {
    const user = userEvent.setup();
    const create = vi.fn<ProductionQuoteClient['create']>(() => Promise.resolve({ quote }));
    const get = vi
      .fn<ProductionQuoteClient['get']>()
      .mockRejectedValueOnce(
        new MarkregApiError(
          'recoverable',
          'read unavailable',
          'correlation_wif07',
          'DOWNSTREAM_UNAVAILABLE',
          503
        )
      )
      .mockResolvedValueOnce({ quote });
    render(
      <ProductionQuotePanel
        intake={intake}
        recommendation={recommendation}
        selection={selection}
        client={client({ create, get })}
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Quote saved; durable readback is uncertain' })
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Governed Production Quote' })).toBeTruthy();
  });
});
