import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@testing-library/react';
import { SourcesHistoryDisclosure } from './SourcesHistoryDisclosure.js';
import { sourcesHistoryFixtures } from './fixtures.js';

const diagnostics = [
  { key: 'Owner reference', value: 'formal-matter_01J8NORTHSTAR' },
  { key: 'Exact version', value: '7' },
  { key: 'Source ID', value: 'uspto-tess-84210911' },
  { key: 'Fingerprint', value: 'sha256:09fa…72bc' },
  { key: 'Receipt', value: 'review-receipt_0182' },
  { key: 'Internal ID', value: 'observation_8421' }
] as const;

const narrow = {
  viewport: {
    defaultViewport: 'sourcesNarrow',
    viewports: {
      sourcesNarrow: { name: '390px narrow', styles: { width: '390px', height: '844px' } }
    }
  }
};

const meta = {
  title: 'Patterns/Prototype/Sources and history disclosure',
  component: SourcesHistoryDisclosure,
  parameters: { layout: 'fullscreen', a11y: { disable: false } },
  args: { ...sourcesHistoryFixtures.normal, diagnostics }
} satisfies Meta<typeof SourcesHistoryDisclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NormalDesktop: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const advanced = canvas.getByText('Advanced');
    advanced.focus();
    const focusStyle = getComputedStyle(advanced);
    if (
      advanced.tagName !== 'SUMMARY' ||
      advanced.tabIndex < 0 ||
      focusStyle.outlineStyle === 'none' ||
      focusStyle.outlineWidth === '0px'
    ) {
      throw new Error('Advanced must be keyboard reachable with a visible focus indicator.');
    }
    advanced.click();
    if (!advanced.closest('details')?.open || document.activeElement !== advanced) {
      throw new Error('Advanced must open from the keyboard without moving focus.');
    }
    advanced.click();
  }
};
export const NormalNarrow: Story = { parameters: narrow };

export const PartialDesktop: Story = { args: sourcesHistoryFixtures.partial };
export const PartialNarrow: Story = { args: sourcesHistoryFixtures.partial, parameters: narrow };

export const ConflictingDesktop: Story = { args: sourcesHistoryFixtures.conflicting };
export const ConflictingNarrow: Story = {
  args: sourcesHistoryFixtures.conflicting,
  parameters: narrow
};

export const UnavailableDesktop: Story = {
  args: sourcesHistoryFixtures.unavailable,
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('status');
    if (!status.textContent?.includes('Source information is unavailable')) {
      throw new Error('Unavailable source truth must be announced as a status.');
    }
    if (canvas.queryByRole('heading', { name: 'Recorded information' })) {
      throw new Error('Unavailable source truth must not render as recorded information.');
    }
  }
};
export const UnavailableNarrow: Story = {
  args: sourcesHistoryFixtures.unavailable,
  parameters: narrow
};

export const DiagnosticsOpenDesktop: Story = {
  args: { diagnosticsOpen: true },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const advanced = canvas.getByText('Advanced');
    const details = advanced.closest('details');
    if (!details?.open || !canvas.getByRole('heading', { name: 'Diagnostics' })) {
      throw new Error('The diagnostics-open fixture must expose its labelled diagnostics region.');
    }
    advanced.focus();
    advanced.click();
    if (details.open || document.activeElement !== advanced) {
      throw new Error('Closing Advanced must return focus to its disclosure control.');
    }
    advanced.click();
  }
};
export const DiagnosticsOpenNarrow: Story = {
  args: { diagnosticsOpen: true },
  parameters: narrow
};
