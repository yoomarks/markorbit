import type { Meta, StoryObj } from '@storybook/react';
import './markreg.css';
import { TruthBadge, type TruthClass } from './TruthContext.js';

const classes: readonly TruthClass[] = [
  'CUSTOMER_SUPPLIED',
  'GOVERNED_INTERNAL',
  'REVIEWED_EVIDENCE',
  'UNAVAILABLE_STALE',
  'HISTORICAL'
];

function TruthGrammar({ includeFutureOfficial = false }: { includeFutureOfficial?: boolean }) {
  const items = includeFutureOfficial ? [...classes, 'OFFICIAL_VERIFIED' as const] : classes;
  return (
    <main className="markreg-workspace-home" aria-label="MarkReg Truth UX grammar">
      <h1>Truth UX grammar</h1>
      <p>Semantic labels remain readable without relying on color.</p>
      <div className="markreg-truth-grammar-grid">
        {items.map((kind) => (
          <div key={kind} className="markreg-truth-grammar-item">
            <TruthBadge kind={kind} />
          </div>
        ))}
      </div>
    </main>
  );
}

const meta = {
  title: 'MarkReg/Truth UX Grammar',
  component: TruthGrammar,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof TruthGrammar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProductionClasses: Story = {};

export const FutureSafeOfficialFixture: Story = {
  args: { includeFutureOfficial: true }
};
