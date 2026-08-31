// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApiError } from './api/errors.js';
import type { OrderClient, OrderListView, OrderView } from './api/order.js';
import { MarkregWorkspaceHome } from './WorkspaceHome.js';

const workspaceOne = '018f0000-0000-7000-8000-000000000501';
const workspaceTwo = '018f0000-0000-7000-8000-000000000502';

const order = {
  orderId: '018f0000-0000-7000-8000-000000000601',
  orderType: 'TrademarkFiling',
  status: 'MatterCreated',
  version: 4,
  customerId: '018f0000-0000-7000-8000-000000000602',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  source: {
    quoteId: '018f0000-0000-7000-8000-000000000603',
    quoteVersion: 'quote-v1',
    customerConfirmationId: '018f0000-0000-7000-8000-000000000604',
    customerConfirmationVersion: 1,
    applicantReference: 'applicant-1',
    trademarkReference: 'mark-1',
    jurisdictionReference: 'US',
    classNumbers: [9],
    selectedPlanId: '018f0000-0000-7000-8000-000000000605',
    selectedPlanVersion: 'plan-v1',
    snapshotSha256: 'a'.repeat(64)
  },
  matter: {
    formalMatterId: '018f0000-0000-7000-8000-000000000606',
    formalMatterVersion: 3,
    linkKind: 'CREATED_FROM_ORDER',
    linkedAt: '2026-08-31T00:00:00.000Z'
  },
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z'
} as unknown as OrderView;

const secondOrder = {
  ...order,
  orderId: '018f0000-0000-7000-8000-000000000701',
  version: 1,
  matter: undefined
} as unknown as OrderView;

const page = (items: readonly OrderView[], currentPage = 1): OrderListView => ({
  items,
  page: currentPage,
  pageSize: 10,
  total: items.length
});

const client = (list: OrderClient['list']) =>
  ({
    list
  }) as unknown as OrderClient;

describe('MarkReg durable Workspace Home', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('markorbit-workspace-id', workspaceOne);
  });

  it('loads durable Orders and links exact Order and Formal Matter versions', async () => {
    const list = vi.fn(() => Promise.resolve(page([order])));
    render(<MarkregWorkspaceHome client={client(list)} />);

    expect(await screen.findByRole('heading', { name: 'Service Orders' })).toBeTruthy();
    expect(screen.getByText(order.orderId)).toBeTruthy();
    expect(screen.getByText('MatterCreated')).toBeTruthy();
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getByRole('link', { name: 'Open Order' }).getAttribute('href')).toBe(
      `?view=order&orderId=${order.orderId}&orderVersion=4`
    );
    expect(screen.getByRole('link', { name: 'Open Formal Matter' }).getAttribute('href')).toBe(
      `?view=formal-matter&formalMatterId=${order.matter!.formalMatterId}&formalMatterVersion=3`
    );
    expect(screen.getByText(/Order ≠ Matter ≠ Payment ≠ Invoice ≠ Filing/)).toBeTruthy();
  });

  it('shows an honest empty Workspace and keeps planning separate', async () => {
    const list = vi.fn(() => Promise.resolve(page([])));
    const user = userEvent.setup();
    render(
      <MarkregWorkspaceHome
        client={client(list)}
        renderPlanning={() => <div>Fixture planning consultation</div>}
      />
    );

    expect(await screen.findByRole('heading', { name: 'No service Orders yet' })).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Plan a new filing' })[0]!);
    expect(await screen.findByText('Fixture planning consultation')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Workspace' })).toBeTruthy();
  });

  it('does not convert an Order service failure into an empty Workspace', async () => {
    const list = vi.fn(() =>
      Promise.reject(
        new MarkregApiError(
          'recoverable',
          'temporary failure',
          undefined,
          'PERSISTENCE_UNAVAILABLE'
        )
      )
    );
    render(<MarkregWorkspaceHome client={client(list)} />);

    expect(
      await screen.findByRole('heading', { name: 'Workspace temporarily unavailable' })
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'No service Orders yet' })).toBeNull();
  });

  it('clears prior Workspace truth and reloads after Workspace context changes', async () => {
    const list = vi.fn(() =>
      Promise.resolve(
        page(
          sessionStorage.getItem('markorbit-workspace-id') === workspaceTwo
            ? [secondOrder]
            : [order]
        )
      )
    );
    render(<MarkregWorkspaceHome client={client(list)} />);

    expect(await screen.findByText(order.orderId)).toBeTruthy();
    sessionStorage.setItem('markorbit-workspace-id', workspaceTwo);
    fireEvent(window, new Event('focus'));

    await waitFor(() => expect(screen.queryByText(order.orderId)).toBeNull());
    expect(await screen.findByText(secondOrder.orderId)).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });
});
