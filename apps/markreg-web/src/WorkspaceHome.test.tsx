// @vitest-environment jsdom
import type { FormalMatterListResponse } from '@markorbit/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApiError } from './api/errors.js';
import type { FormalMatterListClient } from './api/formal-matter.js';
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

type FormalMatterListItem = FormalMatterListResponse['items'][number];
const matter = {
  formalMatterId: 'formal-matter_018f0000-0000-7000-8000-000000000608',
  type: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 1,
  createdAt: '2026-08-31T01:00:00.000Z',
  createdBy: 'user_workspace',
  applicant: 'Example Holdings LLC',
  trademark: 'ORBIT MARK',
  jurisdiction: 'US',
  classes: [9, 42],
  sourceMatterDraftId: 'matter-draft_018f0000-0000-7000-8000-000000000609',
  sourceMatterDraftVersion: 2,
  nextStep: 'PROFESSIONAL_REVIEW_AVAILABLE'
} as unknown as FormalMatterListItem;

const secondMatter = {
  ...matter,
  formalMatterId: 'formal-matter_018f0000-0000-7000-8000-000000000708',
  trademark: 'SECOND MARK'
} as unknown as FormalMatterListItem;

const orderPage = (items: readonly OrderView[], currentPage = 1): OrderListView => ({
  items,
  page: currentPage,
  pageSize: 10,
  total: items.length
});

const matterPage = (
  items: readonly FormalMatterListItem[],
  currentPage = 1
): FormalMatterListResponse => ({
  items: [...items],
  page: currentPage,
  pageSize: 10,
  total: items.length
});

const orderClient = (list: OrderClient['list']) =>
  ({
    list
  }) as unknown as OrderClient;

const matterClient = (list: FormalMatterListClient['list']) => ({ list });

describe('MarkReg durable Workspace Home', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('markorbit-workspace-id', workspaceOne);
  });

  it('loads durable Orders and independently discoverable Formal Matters with exact routes', async () => {
    const listOrders = vi.fn(() => Promise.resolve(orderPage([order])));
    const listMatters = vi.fn(() => Promise.resolve(matterPage([matter])));
    render(
      <MarkregWorkspaceHome
        client={orderClient(listOrders)}
        matterClient={matterClient(listMatters)}
      />
    );

    expect(await screen.findByText(order.orderId)).toBeTruthy();
    expect(await screen.findByText(matter.formalMatterId)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Service Orders' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Formal Matters' })).toBeTruthy();
    expect(listOrders).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(listMatters).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getByRole('link', { name: 'Open Order' }).getAttribute('href')).toBe(
      `?view=order&orderId=${order.orderId}&orderVersion=4`
    );
    expect(
      screen.getByRole('link', { name: 'Open linked Formal Matter' }).getAttribute('href')
    ).toBe(
      `?view=formal-matter&formalMatterId=${order.matter!.formalMatterId}&formalMatterVersion=3`
    );
    expect(screen.getByRole('link', { name: 'Open Matter' }).getAttribute('href')).toBe(
      `?view=formal-matter&formalMatterId=${matter.formalMatterId}&formalMatterVersion=1`
    );
    expect(screen.getByText('ORBIT MARK')).toBeTruthy();
    expect(screen.getByText('9, 42')).toBeTruthy();
    expect(screen.getByText(/Order ≠ Matter ≠ Payment ≠ Invoice ≠ Filing/)).toBeTruthy();
  });

  it('keeps Formal Matters visible when Service Orders are empty and planning remains separate', async () => {
    const user = userEvent.setup();
    render(
      <MarkregWorkspaceHome
        client={orderClient(() => Promise.resolve(orderPage([])))}
        matterClient={matterClient(() => Promise.resolve(matterPage([matter])))}
        renderPlanning={() => <div>Fixture planning consultation</div>}
      />
    );

    expect(await screen.findByRole('heading', { name: 'No service Orders yet' })).toBeTruthy();
    expect(await screen.findByText(matter.formalMatterId)).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Plan a new filing' })[0]!);
    expect(await screen.findByText('Fixture planning consultation')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Workspace' })).toBeTruthy();
  });

  it('does not convert a Formal Matter failure into empty truth or hide successful Orders', async () => {
    render(
      <MarkregWorkspaceHome
        client={orderClient(() => Promise.resolve(orderPage([order])))}
        matterClient={matterClient(() =>
          Promise.reject(
            new MarkregApiError(
              'recoverable',
              'temporary failure',
              undefined,
              'PERSISTENCE_UNAVAILABLE'
            )
          )
        )}
      />
    );

    expect(await screen.findByText(order.orderId)).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Formal Matters temporarily unavailable' })
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'No Formal Matters yet' })).toBeNull();
  });

  it('does not convert an Order failure into empty truth or hide successful Formal Matters', async () => {
    render(
      <MarkregWorkspaceHome
        client={orderClient(() =>
          Promise.reject(
            new MarkregApiError(
              'recoverable',
              'temporary failure',
              undefined,
              'PERSISTENCE_UNAVAILABLE'
            )
          )
        )}
        matterClient={matterClient(() => Promise.resolve(matterPage([matter])))}
      />
    );

    expect(await screen.findByText(matter.formalMatterId)).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Service Orders temporarily unavailable' })
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'No service Orders yet' })).toBeNull();
  });

  it('clears both prior Workspace collections and reloads after Workspace context changes', async () => {
    const listOrders = vi.fn(() =>
      Promise.resolve(
        orderPage(
          sessionStorage.getItem('markorbit-workspace-id') === workspaceTwo
            ? [secondOrder]
            : [order]
        )
      )
    );
    const listMatters = vi.fn(() =>
      Promise.resolve(
        matterPage(
          sessionStorage.getItem('markorbit-workspace-id') === workspaceTwo
            ? [secondMatter]
            : [matter]
        )
      )
    );
    render(
      <MarkregWorkspaceHome
        client={orderClient(listOrders)}
        matterClient={matterClient(listMatters)}
      />
    );

    expect(await screen.findByText(order.orderId)).toBeTruthy();
    expect(await screen.findByText(matter.formalMatterId)).toBeTruthy();
    sessionStorage.setItem('markorbit-workspace-id', workspaceTwo);
    fireEvent(window, new Event('focus'));

    await waitFor(() => expect(screen.queryByText(order.orderId)).toBeNull());
    await waitFor(() => expect(screen.queryByText(matter.formalMatterId)).toBeNull());
    expect(await screen.findByText(secondOrder.orderId)).toBeTruthy();
    expect(await screen.findByText(secondMatter.formalMatterId)).toBeTruthy();
    expect(listOrders).toHaveBeenCalledTimes(2);
    expect(listMatters).toHaveBeenCalledTimes(2);
  });
});
