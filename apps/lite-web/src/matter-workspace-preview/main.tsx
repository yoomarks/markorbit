import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import { MatterWorkspace } from '../features/matters/MatterWorkspace.js';
import { ProfessionalReview } from '../features/professional-review/ProfessionalReview.js';
import { updateLiteLocation } from '../routing/workspace-navigation.js';
import {
  matterClientForScenario,
  matterFixture,
  professionalReviewFixtureClient,
  previewWorkspaceId,
  type MatterPreviewScenario
} from './fixtures.js';
import '../lite.css';
import './matter-workspace-preview.css';

const supportedScenarios = new Set<MatterPreviewScenario>([
  'ready',
  'loading',
  'empty',
  'unauthorized',
  'permission',
  'error',
  'not-found',
  'evidence-empty',
  'partial-evidence',
  'stale-evidence',
  'review-error'
]);
const parameters = new URL(window.location.href).searchParams;
const requestedScenario = parameters.get('scenario')?.toLowerCase();
const scenario = supportedScenarios.has(requestedScenario as MatterPreviewScenario)
  ? (requestedScenario as MatterPreviewScenario)
  : 'ready';
const startsInDetail =
  parameters.get('view') === 'detail' ||
  ['not-found', 'evidence-empty', 'partial-evidence', 'stale-evidence', 'review-error'].includes(
    scenario
  );

if (startsInDetail && !parameters.has('formalMatterId')) {
  const url = new URL(window.location.href);
  url.searchParams.set('formalMatterId', matterFixture.formalMatterId);
  url.hash = '#matters';
  window.history.replaceState({}, '', url);
}

const matterClient = matterClientForScenario(scenario);
const reviewClient = professionalReviewFixtureClient();

function PreviewApp() {
  const [routeKey, setRouteKey] = useState(() => `${location.search}${location.hash}`);
  useEffect(() => {
    const followLocation = () => setRouteKey(`${location.search}${location.hash}`);
    addEventListener('popstate', followLocation);
    return () => removeEventListener('popstate', followLocation);
  }, []);
  const query = new URLSearchParams(location.search);
  const reviewCaseId = query.get('professionalReviewCaseId') ?? undefined;
  const reviewRoute = location.hash === '#work-professional-review' && reviewCaseId;

  return (
    <main className="matter-workspace-preview lite-workspace" data-route-key={routeKey}>
      <Alert tone="info" title="Preview fixture · owner truth and protected-action boundaries">
        This deterministic browser session demonstrates MarkReg-owned Matter evidence and bounded
        specialist review. It does not contact a customer, authorize payment or filing, appoint a
        provider, submit an application, or create Official Truth.
      </Alert>
      {reviewRoute ? (
        <>
          <div className="matter-workspace-preview__return">
            <Button
              variant="secondary"
              onClick={() =>
                updateLiteLocation({
                  surface: 'matters',
                  workspaceId: previewWorkspaceId,
                  params: {
                    professionalReviewCaseId: undefined,
                    professionalReviewCaseVersion: undefined,
                    formalMatterId: matterFixture.formalMatterId
                  }
                })
              }
            >
              ← Return to Matter preview
            </Button>
          </div>
          <ProfessionalReview
            state="ready"
            initialSelected={reviewCaseId}
            client={reviewClient}
            workspaceId={previewWorkspaceId}
          />
        </>
      ) : (
        <MatterWorkspace workspaceId={previewWorkspaceId} client={matterClient} />
      )}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Matter Workspace preview root was not found.');
createRoot(root).render(<PreviewApp />);
