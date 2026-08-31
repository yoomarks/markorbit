import type { Meta, StoryObj } from '@storybook/react';
import type { OrderClient, OrderListView, OrderView } from './api/order.js';
import { MarkregWorkspaceHome } from './WorkspaceHome.js';

const order = {
  orderId: '018f0000-0000-7000-8000-000000000801',
  orderType: 'TrademarkFiling',
  status: 'MatterCreated',
  version: 4,
  customerId: '018f0000-0000-7000-8000-000000000802',
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  source: {
    quoteId: '018f0000-0000-7000-8000-000000000803',
    quoteVersion: 'quote-v1',
    customerConfirmationId: '018f0000-0000-7000-8000-000000000804',
    customerConfirmationVersion: 1,
    applicantReference: 'applicant-1',
    trademarkReference: 'mark-1',
    jurisdictionReference: 'US',
    classNumbers: [9],
    selectedPlanId: '018f0000-0000-7000-8000-000000000805',
    selectedPlanVersion: 'plan-v1',
    snapshotSha256: 'a'.repeat(64)
  },
  matter: {
    formalMatterId: '018f0000-0000-7000-8000-000000000806',
    formalMatterVersion: 3,
    linkKind: 'CREATED_FROM_ORDER',
    linkedAt: '2026-08-31T00:00:00.000Z'
  },
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z'
} as unknown as OrderView;

const result = (items: readonly OrderView[]): OrderListView => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length
});

const client = (items: readonly OrderView[]) =>
  ({
    list: () => Promise.resolve(result(items))
  }) as unknown as OrderClient;

const meta = {
  title: 'MarkReg/Workspace Home',
  component: MarkregWorkspaceHome,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      sessionStorage.setItem('markorbit-workspace-id', '018f0000-0000-7000-8000-000000000899');
      return <Story />;
    }
  ]
} satisfies Meta<typeof MarkregWorkspaceHome>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithMatter: Story = {
  args: { client: client([order]) }
};

export const EmptyWorkspace: Story = {
  args: { client: client([]) }
};
