// @vitest-environment jsdom
import type { FormalMatterListQuery, FormalMatterListResponse } from '@markorbit/contracts';
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

  it('applies bounded Matter filters without reloading Service Orders and distinguishes filtered empty', async () => {
    const user = userEvent.setup();
    const listOrders = vi.fn(() => Promise.resolve(orderPage([order])));
    const listMatters = vi.fn((query?: Partial<FormalMatterListQuery>) =>
      Promise.resolve(query?.search ? matterPage([]) : matterPage([matter]))
    );
    render(
      <MarkregWorkspaceHome
        client={orderClient(listOrders)}
        matterClient={matterClient(listMatters)}
      />
    );

    expect(await screen.findByText(matter.formalMatterId)).toBeTruthy();
    await user.type(screen.getByLabelText('Search Formal Matters'), ' orbit ');
    await user.selectOptions(screen.getByLabelText('Matter status'), 'OPEN');
    await user.selectOptions(screen.getByLabelText('Matter type'), 'TRADEMARK_REGISTRATION');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() =>
      expect(listMatters).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        search: 'orbit',
        status: 'OPEN',
        type: 'TRADEMARK_REGISTRATION'
      })
    );
    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole('heading', { name: 'No Formal Matters match these filters' })
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'No Formal Matters yet' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(listMatters).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 }));
    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(matter.formalMatterId)).toBeTruthy();
  });

  it('adds full UTC-day creation bounds to the existing Matter filters', async () => {
    const user = userEvent.setup();
    const listOrders = vi.fn(() => Promise.resolve(orderPage([order])));
    const listMatters = vi.fn((query?: Partial<FormalMatterListQuery>) =>
      Promise.resolve(query?.createdFrom ? matterPage([]) : matterPage([matter]))
    );
    render(
      <MarkregWorkspaceHome
        client={orderClient(listOrders)}
        matterClient={matterClient(listMatters)}
      />
    );

    expect(await screen.findByText(matter.formalMatterId)).toBeTruthy();
    await user.type(screen.getByLabelText('Search Formal Matters'), ' orbit ');
    await user.selectOptions(screen.getByLabelText('Matter status'), 'OPEN');
    await user.selectOptions(screen.getByLabelText('Matter type'), 'TRADEMARK_REGISTRATION');
    fireEvent.change(screen.getByLabelText('Created from (UTC)'), {
      target: { value: '2026-08-01' }
    });
    fireEvent.change(screen.getByLabelText('Created to (UTC)'), {
      target: { value: '2026-08-31' }
    });
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() =>
      expect(listMatters).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        search: 'orbit',
        status: 'OPEN',
        type: 'TRADEMARK_REGISTRATION',
        createdFrom: '2026-08-01T00:00:00.000Z',
        createdTo: '2026-08-31T23:59:59.999Z'
      })
    );
    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole('heading', { name: 'No Formal Matters match these filters' })
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(listMatters).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 }));
    expect(screen.getByLabelText('Created from (UTC)')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Created to (UTC)')).toHaveProperty('value', '');
    expect(listOrders).toHaveBeenCalledTimes(1);
  });

  it('rejects an inverted creation range without replacing durable Matter results', async () => {
    const user = userEvent.setup();
    const listOrders = vi.fn(() => Promise.resolve(orderPage([order])));
    const listMatters = vi.fn(() => Promise.resolve(matterPage([matter])));
    render(
      <MarkregWorkspaceHome
        client={orderClient(listOrders)}
        matterClient={matterClient(listMatters)}
      />
    );

    expect(await screen.findByText(matter.formalMatterId)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Created from (UTC)'), {
      target: { value: '2026-09-01' }
    });
    fireEvent.change(screen.getByLabelText('Created to (UTC)'), {
      target: { value: '2026-08-31' }
    });
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    const filterAlert = await screen.findByRole('alert');
    expect(filterAlert.textContent).toContain(
      'Created from must not be later than Created to. Existing durable results are unchanged.'
    );
    expect(listMatters).toHaveBeenCalledTimes(1);
    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByText(matter.formalMatterId)).toBeTruthy();
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

  it('clears both collections and Matter filters after Workspace context changes', async () => {
    const user = userEvent.setup();
    const listOrders = vi.fn(() =>
      Promise.resolve(
        orderPage(
          sessionStorage.getItem('markorbit-workspace-id') === workspaceTwo
            ? [secondOrder]
            : [order]
        )
      )
    );
    const listMatters = vi.fn((query?: Partial<FormalMatterListQuery>) =>
      Promise.resolve(
        matterPage(
          query?.search
            ? []
            : sessionStorage.getItem('markorbit-workspace-id') === workspaceTwo
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
    await user.type(screen.getByLabelText('Search Formal Matters'), 'old workspace');
    fireEvent.change(screen.getByLabelText('Created from (UTC)'), {
      target: { value: '2026-08-01' }
    });
    fireEvent.change(screen.getByLabelText('Created to (UTC)'), {
      target: { value: '2026-08-31' }
    });
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(
      await screen.findByRole('heading', { name: 'No Formal Matters match these filters' })
    ).toBeTruthy();

    sessionStorage.setItem('markorbit-workspace-id', workspaceTwo);
    fireEvent(window, new Event('focus'));

    await waitFor(() => expect(screen.queryByText(order.orderId)).toBeNull());
    expect(await screen.findByText(secondOrder.orderId)).toBeTruthy();
    expect(await screen.findByText(secondMatter.formalMatterId)).toBeTruthy();
    expect(screen.getByLabelText('Search Formal Matters')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Created from (UTC)')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Created to (UTC)')).toHaveProperty('value', '');
    expect(listOrders).toHaveBeenCalledTimes(2);
    expect(listMatters).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });
});
