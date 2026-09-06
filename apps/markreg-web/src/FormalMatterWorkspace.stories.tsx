import type { FormalMatter } from '@markorbit/contracts';
import type { Meta, StoryObj } from '@storybook/react';
import { Alert, Card } from '@markorbit/ui';
import { FormalMatterWorkspace } from './FormalMatterWorkspace.js';
import { TruthContext } from './TruthContext.js';

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
    <div className="markreg-truth-row">
      <TruthContext truthClass="GOVERNED_INTERNAL_WORKFLOW" detail="Current action context" />
    </div>
    <strong>{disabled ? 'Lifecycle actions disabled' : 'Review the latest evidence'}</strong>
    <p>Story-only presentation seam. Production uses the live LifecyclePanel.</p>
  </Card>
);

const examination = () => (
  <Card>
    <div className="markreg-truth-row">
      <TruthContext truthClass="GOVERNED_INTERNAL_WORKFLOW" detail="Examination workflow" />
      <TruthContext truthClass="REVIEWED_EVIDENCE" />
    </div>
    <strong>Customer action needed</strong>
    <p>Current reviewed evidence requires bounded internal workflow attention.</p>
  </Card>
);

const evidence = () => (
  <Card>
    <div className="markreg-truth-row">
      <TruthContext truthClass="REVIEWED_EVIDENCE" detail="Current Matter source" />
    </div>
    <strong>1 current Document Package</strong>
    <p>Story-only presentation seam. Production uses the live FormalMatterEvidencePanel.</p>
  </Card>
);

const intelligence = () => (
  <Card>
    <div className="markreg-truth-row">
      <TruthContext truthClass="REVIEWED_EVIDENCE" detail="Descriptive analytical context" />
    </div>
    <strong>180 days · P50_TO_P75</strong>
    <p>Current Human Review: CONFIRMED</p>
    <p>Story-only presentation seam. Production uses the live MatterIntelligencePanel.</p>
  </Card>
);

const unavailableEvidence = () => (
  <Alert tone="warning" title="Formal Matter evidence unavailable">
    The supporting evidence projection could not be loaded. Current Matter and action truth remain
    visible above.
  </Alert>
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
    renderExamination: examination,
    renderEvidence: evidence,
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
    renderExamination: examination,
    renderEvidence: evidence,
    renderIntelligence: intelligence
  }
};

export const SecondaryEvidenceUnavailable: Story = {
  args: {
    matter,
    expectedVersion: '5',
    actualVersion: '5',
    renderLifecycle: lifecycle,
    renderExamination: examination,
    renderEvidence: unavailableEvidence,
    renderIntelligence: intelligence
  }
};
