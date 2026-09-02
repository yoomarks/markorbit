import type { FormalMatter } from '@markorbit/contracts';
import type { Meta, StoryObj } from '@storybook/react';
import { Alert, Card } from '@markorbit/ui';
import { FormalMatterWorkspace } from './FormalMatterWorkspace.js';

const matter = {
  schemaVersion: 1,
  formalMatterId: 'formal-matter_story-one',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  kind: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 5,
  sourceCustomerConfirmationId: 'confirmation_story-one',
  sourceCustomerConfirmationVersion: 2,
  sourceMatterDraftId: 'matter-draft_story-one',
  sourceMatterDraftVersion: 3,
  sourceQuoteId: 'quote_story-one',
  sourceQuoteVersion: 'quote-v4',
  sourceSnapshot: {
    schemaVersion: 1,
    customerConfirmation: { id: 'confirmation_story-one', version: 2, status: 'CONFIRMED' },
    quote: { id: 'quote_story-one', version: 'quote-v4', currency: 'USD', totalMinor: 42000 },
    matterDraft: {
      id: 'matter-draft_story-one',
      version: 3,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: {
        evaluatedAt: '2026-09-01T02:00:00.000Z',
        checks: [],
        readyForProfessionalReview: true
      }
    },
    preparation: {
      applicantName: 'Orbit Labs Inc.',
      applicantAddress: '1 Orbit Way',
      trademark: 'ORBIT',
      targetJurisdiction: 'US',
      classes: [9, 42],
      goodsServices: 'Downloadable software; software as a service.',
      filingBasis: 'USE',
      representativeRequired: false,
      documentReferences: ['doc_1'],
      commercialScopeUnchanged: true
    }
  },
  snapshotSchemaVersion: 1,
  snapshotSha256: 'a'.repeat(64),
  createdByUserId: 'user_story-one',
  createdAt: '2026-09-01T02:05:00.000Z',
  updatedAt: '2026-09-01T02:10:00.000Z'
} as unknown as FormalMatter;

const lifecycle = ({ disabled }: { disabled: boolean }) => (
  <Card>
    <strong>{disabled ? 'Lifecycle actions disabled' : 'Governed lifecycle available'}</strong>
    <p>Story-only presentation seam. Production uses the live LifecyclePanel.</p>
  </Card>
);

const intelligence = () => (
  <>
    <Alert tone="info" title="Descriptive analytical evidence">
      Historical evidence only — not prediction, legal conclusion, office status, or Official Truth.
    </Alert>
    <Card>
      <strong>180 days · P50_TO_P75</strong>
      <p>Current Human Review: CONFIRMED</p>
      <p>Story-only presentation seam. Production uses the live MatterIntelligencePanel.</p>
    </Card>
  </>
);

const meta = {
  title: 'MarkReg/Formal Matter Workspace',
  component: FormalMatterWorkspace,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof FormalMatterWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentMatter: Story = {
  args: {
    matter,
    expectedVersion: '5',
    actualVersion: '5',
    renderLifecycle: lifecycle,
    renderIntelligence: intelligence
  }
};

export const StaleDirectLink: Story = {
  args: {
    matter,
    expectedVersion: '4',
    actualVersion: '5',
    versionMismatch: true,
    renderLifecycle: lifecycle,
    renderIntelligence: intelligence
  }
};
