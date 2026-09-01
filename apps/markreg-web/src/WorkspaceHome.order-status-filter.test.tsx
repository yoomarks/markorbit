// @vitest-environment jsdom
import type { FormalMatterListResponse } from '@markorbit/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormalMatterListClient } from './api/formal-matter.js';
import type { OrderClient, OrderListView, OrderView } from './api/order.js';
import { MarkregWorkspaceHome } from './WorkspaceHome.js';

const workspaceOne = '018f0000-0000-7000-8000-000000000801';
const workspaceTwo = '018f0000-0000-7000-8000-000000000802';

const order = {
  orderId: 'order_018f0000-0000-7000-8000-000000000811',
  status: 'MatterCreated',
  version: 4,
  updatedAt: '2026-09-01T00:00:00.000Z'
} as unknown as OrderView;

const secondOrder = {
  ...order,
  orderId: 'order_018f0000-0000-7000-8000-000000000812',
  status: 'InProgress',
  version: 2
} as unknown as OrderView;

type OrderListQuery = Parameters<OrderClient['list']>[0];

const orderPage = (items: readonly OrderView[]): OrderListView => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length
});

const pagedOrders = (page: number, total: number): OrderListView => ({
  ...orderPage([order]),
  page,
  total
});

const emptyMatterPage = (): FormalMatterListResponse => ({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0
});

const orderClient = (list: OrderClient['list']) =>
  ({
    list
  }) as unknown as OrderClient;

const matterClient = (list: FormalMatterListClient['list']) => ({ list });

describe('MarkReg Workspace Home Service Order status filter', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('markorbit-workspace-id', workspaceOne);
  });

  it('applies and clears canonical Order status without reloading Formal Matters', async () => {
    const user = userEvent.setup();
    const listOrders = vi.fn((query?: OrderListQuery) => {
      if (query?.status) {
        return Promise.resolve(orderPage([]));
      }
      return Promise.resolve(pagedOrders(query?.page ?? 1, 11));
    });
    const listMatters = vi.fn(() => Promise.resolve(emptyMatterPage()));
    render(
      <MarkregWorkspaceHome
        client={orderClient(listOrders)}
        matterClient={matterClient(listMatters)}
      />
    );

    expect(await screen.findByText(order.orderId)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listOrders).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 }));

    await user.selectOptions(screen.getByLabelText('Order status'), 'Completed');
    await user.click(screen.getByRole('button', { name: 'Apply Order filter' }));

    await waitFor(() =>
      expect(listOrders).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        status: 'Completed'
      })
    );
    expect(listMatters).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole('heading', { name: 'No Service Orders match this status' })
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'No service Orders yet' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear Order filter' }));
    await waitFor(() => expect(listOrders).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 }));
    expect(screen.getByLabelText('Order status')).toHaveProperty('value', '');
    expect(await screen.findByText(order.orderId)).toBeTruthy();
    expect(listMatters).toHaveBeenCalledTimes(1);
  });

  it('clears the Order status filter before reading a newly selected Workspace', async () => {
    const user = userEvent.setup();
    const listOrders = vi.fn((query?: OrderListQuery) => {
      if (query?.status) {
        return Promise.resolve(orderPage([]));
      }
      if (sessionStorage.getItem('markorbit-workspace-id') === workspaceTwo) {
        return Promise.resolve(orderPage([secondOrder]));
      }
      return Promise.resolve(orderPage([order]));
    });
    const listMatters = vi.fn(() => Promise.resolve(emptyMatterPage()));
    render(
      <MarkregWorkspaceHome
        client={orderClient(listOrders)}
        matterClient={matterClient(listMatters)}
      />
    );

    expect(await screen.findByText(order.orderId)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Order status'), 'Completed');
    await user.click(screen.getByRole('button', { name: 'Apply Order filter' }));
    expect(
      await screen.findByRole('heading', { name: 'No Service Orders match this status' })
    ).toBeTruthy();
    expect(listMatters).toHaveBeenCalledTimes(1);

    sessionStorage.setItem('markorbit-workspace-id', workspaceTwo);
    fireEvent(window, new Event('focus'));

    expect(await screen.findByText(secondOrder.orderId)).toBeTruthy();
    expect(screen.getByLabelText('Order status')).toHaveProperty('value', '');
    expect(listOrders).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
    expect(listMatters).toHaveBeenCalledTimes(2);
  });
});
