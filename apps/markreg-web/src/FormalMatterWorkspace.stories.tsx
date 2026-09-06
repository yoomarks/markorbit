import type { FormalMatter } from '@markorbit/contracts';
import type { Meta, StoryObj } from '@storybook/react';
import { Alert, Card } from '@markorbit/ui';
import { ExaminationPanel } from './ExaminationPanel.js';
import { FormalMatterWorkspace } from './FormalMatterWorkspace.js';
import { LifecyclePanel } from './LifecyclePanel.js';
import { TruthBadge, TruthContext } from './TruthContext.js';
import type {
  ExaminationStageClient,
  ExaminationStageProjection
} from './api/examination-stage.js';
import { MarkregApiError } from './api/errors.js';
import type { CustomerLifecycleClient, CustomerLifecycleSurface } from './api/lifecycle.js';
import './markreg.css';

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

const lifecycleBase = {
  lifecycle: {
    lifecycleViewId: 'lifecycle-view_story-one',
    formalMatter: { id: matter.formalMatterId, version: 5 },
    version: 2,
    state: 'APPLICATION_PENDING',
    customerSafeLabel: 'Application pending review',
    customerSafeSummary: 'The current governed Matter is awaiting the next reviewed event.',
    officialStatusVerified: false,
    updatedAt: '2026-09-01T02:15:00.000Z'
  },
  timeline: [],
  recommendedAction: null,
  noAction: true
} satisfies CustomerLifecycleSurface;

const lifecycleWithAction: CustomerLifecycleSurface = {
  ...lifecycleBase,
  recommendedAction: {
    recommendedActionId: 'recommended-action_story-one',
    formalMatter: { id: matter.formalMatterId, version: 5 },
    version: 3,
    title: 'Review the latest evidence',
    explanation: 'New reviewed evidence is available for this Matter.',
    timingBasis: 'Review before deciding whether to continue.',
    status: 'OPEN',
    executionAuthorized: false,
    updatedAt: '2026-09-01T02:16:00.000Z'
  },
  noAction: false
};

const lifecycleClient = (value: CustomerLifecycleSurface): CustomerLifecycleClient => ({
  get: () => Promise.resolve(value),
  acknowledge: () => Promise.resolve(),
  dismiss: () => Promise.resolve()
});

const examinationEstablished = {
  status: 'ESTABLISHED',
  current: {
    customerSafeLabel: 'Customer review needed',
    customerSafeSummary: 'Reviewed evidence requires bounded internal workflow attention.',
    workflowState: 'CUSTOMER_ACTION_NEEDED',
    sourceCurrentness: 'CURRENT'
  },
  history: [],
  deadlineStatus: 'UNAVAILABLE'
} as unknown as ExaminationStageProjection;
const examinationNotEstablished = {
  ...examinationEstablished,
  status: 'NOT_ESTABLISHED',
  current: null
} as unknown as ExaminationStageProjection;

const examinationClient = (value: ExaminationStageProjection): ExaminationStageClient => ({
  get: () => Promise.resolve(value)
});

const staleExaminationClient: ExaminationStageClient = {
  get: () =>
    Promise.reject(
      new MarkregApiError(
        'conflict',
        'Examination source changed.',
        undefined,
        'EXAMINATION_SOURCE_STALE',
        409
      )
    )
};

const unavailableExaminationClient: ExaminationStageClient = {
  get: () =>
    Promise.reject(
      new MarkregApiError(
        'recoverable',
        'Examination source unavailable.',
        undefined,
        'EXAMINATION_TRUTH_UNAVAILABLE',
        503
      )
    )
};
const lifecycleRenderer =
  (value: CustomerLifecycleSurface) =>
  ({ formalMatterId, disabled }: { formalMatterId: string; disabled: boolean }) => (
    <LifecyclePanel
      formalMatterId={formalMatterId}
      disabled={disabled}
      embedded
      client={lifecycleClient(value)}
    />
  );

const examinationRenderer =
  (client: ExaminationStageClient) =>
  ({ formalMatterId }: { formalMatterId: string }) => (
    <ExaminationPanel formalMatterId={formalMatterId} client={client} />
  );

const evidence = () => (
  <Card>
    <TruthContext kind="REVIEWED_EVIDENCE">1 current reviewed document package</TruthContext>
    <p>Human-readable evidence summary first. Package IDs and fingerprints remain in disclosure.</p>
  </Card>
);

const intelligence = () => (
  <Card>
    <TruthContext kind="HISTORICAL">Descriptive analytical evidence</TruthContext>
    <p>180 days · P50_TO_P75 · Human Review CONFIRMED</p>
  </Card>
);

const unavailableEvidence = () => (
  <Alert tone="warning" title="Formal Matter evidence unavailable">
    <TruthBadge kind="UNAVAILABLE_STALE" /> Secondary evidence is unavailable; primary Matter truth
    remains visible.
  </Alert>
);
const unavailableIntelligence = () => (
  <Alert tone="warning" title="Matter intelligence unavailable">
    <TruthBadge kind="UNAVAILABLE_STALE" /> Secondary analysis is unavailable; no empty truth is
    fabricated.
  </Alert>
);

const meta = {
  title: 'MarkReg/Formal Matter Workspace V2',
  component: FormalMatterWorkspace,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof FormalMatterWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;

const currentArgs = {
  matter,
  expectedVersion: '5',
  actualVersion: '5',
  renderLifecycle: lifecycleRenderer(lifecycleWithAction),
  renderExamination: examinationRenderer(examinationClient(examinationEstablished)),
  renderEvidence: evidence,
  renderIntelligence: intelligence
};

export const CurrentActionEstablishedExamination: Story = {
  args: currentArgs
};

export const NoActionExaminationNotEstablished: Story = {
  args: {
    ...currentArgs,
    renderLifecycle: lifecycleRenderer(lifecycleBase),
    renderExamination: examinationRenderer(examinationClient(examinationNotEstablished))
  }
};
export const StaleDirectLink: Story = {
  args: {
    ...currentArgs,
    expectedVersion: '4',
    versionMismatch: true,
    renderExamination: examinationRenderer(staleExaminationClient)
  }
};

export const SecondaryUnavailable: Story = {
  args: {
    ...currentArgs,
    renderExamination: examinationRenderer(unavailableExaminationClient),
    renderEvidence: unavailableEvidence,
    renderIntelligence: unavailableIntelligence
  }
};

export const Mobile390CurrentAction: Story = {
  args: currentArgs,
  parameters: {
    viewport: {
      viewports: {
        markreg390: {
          name: 'MarkReg 390px',
          styles: { width: '390px', height: '844px' }
        }
      },
      defaultViewport: 'markreg390'
    }
  }
};
