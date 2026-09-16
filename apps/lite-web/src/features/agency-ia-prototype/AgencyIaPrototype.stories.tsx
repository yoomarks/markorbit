import type { Meta, StoryObj } from '@storybook/react';
import { AgencyIaPrototype } from './AgencyIaPrototype.js';

const meta = {
  title: 'Prototypes/Agency task-language IA',
  component: AgencyIaPrototype,
  parameters: { layout: 'fullscreen', a11y: { disable: false } },
  argTypes: {
    initialSurface: {
      control: 'select',
      options: [
        'today',
        'cases',
        'case-detail',
        'trademarks',
        'clients',
        'inbox',
        'more',
        'sources',
        'diagnostics'
      ]
    },
    state: {
      control: 'select',
      options: [
        'loading',
        'empty',
        'populated',
        'partial',
        'stale',
        'unavailable',
        'permission',
        'error',
        'success'
      ]
    }
  },
  args: { state: 'populated' }
} satisfies Meta<typeof AgencyIaPrototype>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AgencyShellCandidateIa: Story = { args: { initialSurface: 'today' } };
export const TodayMorningTriage: Story = { args: { initialSurface: 'today' } };
export const CasesList: Story = { args: { initialSurface: 'cases' } };
export const CaseDetail: Story = { args: { initialSurface: 'case-detail' } };
export const TrademarksLargeTable: Story = { args: { initialSurface: 'trademarks' } };
export const ClientDetail: Story = { args: { initialSurface: 'clients' } };
export const InboxThreeColumn: Story = {
  args: { initialSurface: 'inbox', initialMessageId: 'msg-client-aurora' }
};
export const InboxUnlinkedMessage: Story = {
  args: { initialSurface: 'inbox', initialMessageId: 'msg-outside-counsel' }
};
export const SourcesAndHistory: Story = { args: { initialSurface: 'sources' } };
export const DiagnosticsLayer: Story = { args: { initialSurface: 'diagnostics' } };
export const NewMenu: Story = {
  args: { initialSurface: 'today' },
  play: ({ canvasElement }) => {
    (canvasElement.querySelector('button')
      ? Array.from(canvasElement.querySelectorAll('button')).find((button) =>
          button.textContent?.includes('+ New')
        )
      : undefined
    )?.click();
  }
};
export const AskMoContextualEntry: Story = {
  args: { initialSurface: 'case-detail' },
  play: ({ canvasElement }) => {
    Array.from(canvasElement.querySelectorAll('button'))
      .find((button) => button.textContent === 'Ask MO')
      ?.click();
  }
};

const mobile = {
  viewport: {
    defaultViewport: 'mobile1',
    viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
  }
};
export const MobileToday: Story = {
  args: { initialSurface: 'today', mobile: true },
  parameters: mobile
};
export const MobileMessageApprovalAndQuickReply: Story = {
  args: { initialSurface: 'inbox', initialMessageId: 'msg-outside-counsel', mobile: true },
  parameters: mobile
};

export const Loading: Story = { args: { initialSurface: 'today', state: 'loading' } };
export const Empty: Story = { args: { initialSurface: 'cases', state: 'empty' } };
export const Partial: Story = { args: { initialSurface: 'inbox', state: 'partial' } };
export const Stale: Story = { args: { initialSurface: 'trademarks', state: 'stale' } };
export const Unavailable: Story = { args: { initialSurface: 'clients', state: 'unavailable' } };
export const PermissionRestricted: Story = {
  args: { initialSurface: 'cases', state: 'permission' }
};
export const Error: Story = { args: { initialSurface: 'today', state: 'error' } };
export const Success: Story = { args: { initialSurface: 'case-detail', state: 'success' } };
