import type { Meta, StoryObj } from '@storybook/react';
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

export const NormalDesktop: Story = {};
export const NormalNarrow: Story = { parameters: narrow };

export const PartialDesktop: Story = { args: sourcesHistoryFixtures.partial };
export const PartialNarrow: Story = { args: sourcesHistoryFixtures.partial, parameters: narrow };

export const ConflictingDesktop: Story = { args: sourcesHistoryFixtures.conflicting };
export const ConflictingNarrow: Story = {
  args: sourcesHistoryFixtures.conflicting,
  parameters: narrow
};

export const UnavailableDesktop: Story = { args: sourcesHistoryFixtures.unavailable };
export const UnavailableNarrow: Story = {
  args: sourcesHistoryFixtures.unavailable,
  parameters: narrow
};

export const DiagnosticsOpenDesktop: Story = { args: { diagnosticsOpen: true } };
export const DiagnosticsOpenNarrow: Story = {
  args: { diagnosticsOpen: true },
  parameters: narrow
};
