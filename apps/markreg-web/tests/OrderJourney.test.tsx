import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerConfirmation } from '@markorbit/contracts';
import { MarkregApiError } from '../src/api/errors.js';
import type { OrderClient, OrderMatterConversionView, OrderView } from '../src/api/order.js';
import { OrderJourney } from '../src/OrderJourney.js';

const workspace = '45454545-4545-4454-8545-454545454545';
const now = '2026-08-09T00:00:00.000Z';
const confirmation = {
  schemaVersion: 1,
  confirmationId: 'confirmation_wp06',
  customerId: 'customer_wp06',
  quoteSnapshot: {
    quoteId: 'quote_wp06',
    quoteVersion: 'quote-v6',
    planId: 'plan_wp06',
    planVersion: 'plan-v6',
    currency: 'USD',
    totalMinor: 96000,
    lineItems: []
  },
  confirmedBy: 'user_wp06',
  confirmedAt: now,
  termsVersion: 'terms-v1',
  acknowledgements: [],
  status: 'CONFIRMED',
  createdAt: now,
  updatedAt: now,
  version: 3
} as CustomerConfirmation & { version: number };

const order = (status: OrderView['status'], version: number): OrderView => ({
  orderId: 'order_wp06',
  orderType: 'TrademarkFiling',
  status,
  version,
  customerId: 'customer_wp06',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  source: {
    quoteId: 'quote_wp06',
    quoteVersion: 'quote-v6',
    customerConfirmationId: 'confirmation_wp06',
    customerConfirmationVersion: 3,
    applicantReference: 'applicant:wp06',
    trademarkReference: 'mark:wp06',
    jurisdictionReference: 'US',
    classNumbers: [9, 42],
    selectedPlanId: 'plan_wp06',
    selectedPlanVersion: 'plan-v6',
    snapshotSha256: 'a'.repeat(64)
  },
  createdAt: now,
  updatedAt: now
});

const matterCreated = (): OrderView => ({
  ...order('MatterCreated', 5),
  matter: {
    formalMatterId: 'formal-matter_wp06',
    formalMatterVersion: 1,
    linkKind: 'CREATED_FROM_ORDER',
    linkedAt: now,
    linkedByUserId: 'user_wp06'
  }
});

const conversion: OrderMatterConversionView = {
  orderId: 'order_wp06',
  orderStatus: 'MatterCreated',
  orderVersion: 5,
  formalMatterId: 'formal-matter_wp06',
  formalMatterVersion: 1,
  linkKind: 'CREATED_FROM_ORDER',
  linkedAt: now
};

function mockClient(overrides: Partial<OrderClient> = {}): OrderClient {
  return {
    create: vi.fn().mockResolvedValue(order('Draft', 1)),
    get: vi.fn().mockResolvedValue(order('Draft', 1)),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    requestConfirmation: vi.fn().mockResolvedValue(order('PendingConfirmation', 2)),
    confirm: vi.fn().mockResolvedValue(order('Confirmed', 3)),
    evaluateReadiness: vi.fn().mockResolvedValue(order('ReadyForMatter', 4)),
    createMatter: vi.fn().mockResolvedValue(conversion),
    linkMatter: vi.fn().mockResolvedValue(conversion),
    cancel: vi.fn().mockResolvedValue(order('Cancelled', 2)),
    ...overrides
  };
}

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('markorbit-workspace-id', workspace);
  history.replaceState(null, '', '/');
});

describe('M3-WP-06 durable Order journey', () => {
  it('drives the explicit confirmation-to-MatterCreated path without financial or filing consequences', async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue(matterCreated()) });
    render(<OrderJourney source={{ confirmation }} client={client} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Order' }));
    await screen.findByText('Draft', { exact: true });
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: workspace,
        quoteId: 'quote_wp06',
        customerConfirmationId: 'confirmation_wp06',
        expectedCustomerConfirmationVersion: 3
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Request Order Confirmation' }));
    await screen.findByText('PendingConfirmation', { exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));
    await screen.findByText('Confirmed', { exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Validate Ready for Matter' }));
    await screen.findByText('ReadyForMatter', { exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Create Formal Matter' }));

    await screen.findByText('Formal Matter linked');
    expect(screen.getByText(/No external filing has been submitted/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Formal Matter' })).toHaveAttribute(
      'href',
      expect.stringContaining('view=formal-matter')
    );
    expect(screen.getAllByText('Not created').length).toBeGreaterThanOrEqual(4);
    expect(client.createMatter).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_wp06',
        expectedOrderVersion: 4,
        expectedCommercialSourceSha256: 'a'.repeat(64)
      })
    );
  });

  it('blocks a stale direct Order link until reload accepts the current durable version', async () => {
    const get = vi.fn().mockResolvedValue(order('ReadyForMatter', 4));
    const client = mockClient({ get });
    render(<OrderJourney orderId="order_wp06" expectedVersion="3" client={client} />);

    await screen.findByText('Order changed in another session');
    expect(
      screen.getByText(
        /direct link points to a different Order version than the current durable Order/
      )
    ).toBeVisible();
    expect(screen.getByText('4', { exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create Formal Matter' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get).toHaveBeenNthCalledWith(1, 'order_wp06');
    expect(get).toHaveBeenNthCalledWith(2, 'order_wp06');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create Formal Matter' })).toBeEnabled()
    );
    expect(screen.queryByText('Order changed in another session')).toBeNull();
    const params = new URLSearchParams(location.search);
    expect(params.get('view')).toBe('order');
    expect(params.get('orderId')).toBe('order_wp06');
    expect(params.get('orderVersion')).toBe('4');
  });

  it('keeps stale commercial source fail closed after the Order remains readable', async () => {
    const get = vi.fn().mockResolvedValue(order('Confirmed', 3));
    const client = mockClient({
      get,
      evaluateReadiness: vi
        .fn()
        .mockRejectedValue(
          new MarkregApiError('conflict', 'source changed', undefined, 'STALE_SOURCE')
        )
    });
    render(<OrderJourney orderId="order_wp06" expectedVersion="3" client={client} />);

    await screen.findByText('Confirmed', { exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Validate Ready for Matter' }));

    await screen.findByText('Commercial source changed');
    expect(screen.getByText(/Reloading this same Order does not make/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Validate Ready for Matter' })).toBeDisabled();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps stable policy failures fail closed without same-Order reload', async () => {
    const client = mockClient({
      get: vi.fn().mockResolvedValue(order('Confirmed', 3)),
      evaluateReadiness: vi
        .fn()
        .mockRejectedValue(
          new MarkregApiError('validation', 'scope not ready', undefined, 'POLICY_DENIED')
        )
    });
    render(<OrderJourney orderId="order_wp06" expectedVersion="3" client={client} />);

    await screen.findByText('Confirmed', { exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Validate Ready for Matter' }));

    await screen.findByText('Order journey cannot continue');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Validate Ready for Matter' })).toBeDisabled();
  });

  it('keeps read reload for a transient Order service failure', async () => {
    const get = vi.fn().mockResolvedValue(order('Confirmed', 3));
    const client = mockClient({
      get,
      evaluateReadiness: vi
        .fn()
        .mockRejectedValue(
          new MarkregApiError(
            'recoverable',
            'temporary failure',
            undefined,
            'PERSISTENCE_UNAVAILABLE'
          )
        )
    });
    render(<OrderJourney orderId="order_wp06" expectedVersion="3" client={client} />);

    await screen.findByText('Confirmed', { exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Validate Ready for Matter' }));
    await screen.findByText('Order service temporarily unavailable');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Order service temporarily unavailable')).toBeNull();
    expect(screen.getByRole('button', { name: 'Validate Ready for Matter' })).toBeEnabled();
  });

  it('does not blindly retry Order creation from a stale commercial source', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(
        new MarkregApiError('conflict', 'source changed', undefined, 'STALE_SOURCE')
      );
    const client = mockClient({ create });
    render(<OrderJourney source={{ confirmation }} client={client} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Order' }));

    await screen.findByText('Commercial source changed');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create Order' })).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('clears stale Order state when the Workspace changes', async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue(order('Draft', 1)) });
    render(<OrderJourney orderId="order_wp06" expectedVersion="1" client={client} />);
    await screen.findByText('Draft', { exact: true });
    sessionStorage.setItem('markorbit-workspace-id', '56565656-5656-4565-8565-565656565656');
    dispatchEvent(new PopStateEvent('popstate'));
    await screen.findByRole('heading', { name: 'No eligible commercial source' });
    await waitFor(() => expect(location.search).toBe(''));
  });

  it('shows an explicit empty boundary without inventing a latest source', () => {
    render(<OrderJourney client={mockClient()} />);
    expect(screen.getByRole('heading', { name: 'No eligible commercial source' })).toBeVisible();
    expect(screen.getByText(/No Order, Payment, Invoice, Formal Matter or Filing/)).toBeVisible();
  });
});
