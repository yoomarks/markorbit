import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { PreparedActionJourney } from '@markorbit/contracts/product-loop';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import {
  SeedContextualWorkbench,
  type SeedWorkbenchSurfaceState,
  type SeedWorkbenchTask
} from '../features/agency-ia-prototype/SeedContextualWorkbench.js';
import {
  completedClientActionPreview,
  completedOpportunityPreview,
  contextualWorkbenchPreviewContext,
  pendingOpportunityPreview,
  preparedClientActionPreview,
  preparedOpportunityPreview
} from '../features/agency-ia-prototype/seed-contextual-workbench-fixture.js';
import './contextual-workbench-preview.css';

type PreviewTask = 'customer' | 'opportunity' | 'client';
type PreviewScenario =
  | SeedWorkbenchSurfaceState
  | 'prepared'
  | 'pending'
  | 'committed'
  | 'prepare-error'
  | 'confirm-error';

const tasks: Record<PreviewTask, SeedWorkbenchTask> = {
  customer: 'SEED_CUSTOMER_REVIEW',
  opportunity: 'OPPORTUNITY_REVIEW',
  client: 'CLIENT_ACTION_DRAFT'
};
const scenarios = new Set<PreviewScenario>([
  'loading',
  'ready',
  'empty',
  'error',
  'permission',
  'partial',
  'prepared',
  'pending',
  'committed',
  'prepare-error',
  'confirm-error'
]);
const surfaceStates = new Set<SeedWorkbenchSurfaceState>([
  'loading',
  'ready',
  'empty',
  'error',
  'permission',
  'partial'
]);

const parameters = new URL(window.location.href).searchParams;
const requestedTask = parameters.get('task')?.toLowerCase();
const requestedScenario = parameters.get('scenario')?.toLowerCase();
const previewTask =
  requestedTask && requestedTask in tasks ? (requestedTask as PreviewTask) : 'opportunity';
const task = tasks[previewTask];
const scenario = scenarios.has(requestedScenario as PreviewScenario)
  ? (requestedScenario as PreviewScenario)
  : 'ready';
const state = surfaceStates.has(scenario as SeedWorkbenchSurfaceState)
  ? (scenario as SeedWorkbenchSurfaceState)
  : 'ready';
const preparedJourney =
  task === 'CLIENT_ACTION_DRAFT' ? preparedClientActionPreview : preparedOpportunityPreview;
const completedJourney =
  task === 'CLIENT_ACTION_DRAFT' ? completedClientActionPreview : completedOpportunityPreview;
const pendingJourney =
  task === 'CLIENT_ACTION_DRAFT'
    ? ({ ...preparedClientActionPreview, handoffState: 'HANDOFF_PENDING' } as PreparedActionJourney)
    : pendingOpportunityPreview;
const initialJourney =
  scenario === 'prepared'
    ? preparedJourney
    : scenario === 'pending'
      ? pendingJourney
      : scenario === 'committed'
        ? completedJourney
        : undefined;
const root = document.getElementById('root');

if (!root) throw new Error('Contextual Workbench preview root was not found.');

createRoot(root).render(
  <StrictMode>
    <div className="contextual-workbench-preview">
      <Alert tone="info" title="Preview fixture · Working context only">
        Conversation updates only this deterministic browser session. Prepare and Confirm return
        owner-shaped fixture results; they do not create a Customer, Opportunity, message, filing,
        payment, or Official Truth.
      </Alert>
      <SeedContextualWorkbench
        task={task}
        context={contextualWorkbenchPreviewContext}
        state={state}
        {...(task === 'SEED_CUSTOMER_REVIEW'
          ? { structuredReviewHref: '#fixture-structured-customer-review' }
          : {
              onPrepare: () =>
                scenario === 'prepare-error'
                  ? Promise.reject(new Error('Preview preparation dependency is unavailable.'))
                  : Promise.resolve(preparedJourney),
              onConfirm: (journey: Readonly<PreparedActionJourney>) =>
                scenario === 'confirm-error'
                  ? Promise.reject(new Error('Preview confirmation dependency is unavailable.'))
                  : Promise.resolve(
                      journey.handoffState === 'HANDOFF_COMPLETED' ? journey : completedJourney
                    ),
              receiptHref: '#fixture-result-receipt'
            })}
        {...(initialJourney ? { initialJourney } : {})}
      />
    </div>
  </StrictMode>
);
