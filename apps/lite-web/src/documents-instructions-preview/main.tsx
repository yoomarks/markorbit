import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import { DocumentPackageWorkspace } from '../features/document-package/DocumentPackageWorkspace.js';
import {
  packageClientForScenario,
  previewPackageId,
  previewReviewCaseId,
  previewWorkspaceId,
  reviewClientForScenario,
  type DocumentsInstructionsPreviewScenario
} from './fixtures.js';
import '../lite.css';
import './documents-instructions-preview.css';

const supportedScenarios = new Set<DocumentsInstructionsPreviewScenario>([
  'from-review',
  'draft',
  'loading',
  'unauthorized',
  'permission',
  'missing',
  'conflict',
  'review-unavailable',
  'unavailable',
  'error',
  'success'
]);
const requestedScenario = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supportedScenarios.has(requestedScenario as DocumentsInstructionsPreviewScenario)
  ? (requestedScenario as DocumentsInstructionsPreviewScenario)
  : 'from-review';
const startsFromReview = scenario === 'from-review' || scenario === 'review-unavailable';
const packageClient = packageClientForScenario(scenario);
const reviewClient = reviewClientForScenario(scenario);

function PreviewApp() {
  return (
    <main className="documents-instructions-preview lite-workspace">
      <div className="documents-instructions-preview__boundary">
        <Alert tone="info" title="Preview fixture · exact evidence and bounded preparation">
          This deterministic browser session demonstrates MarkReg-owned documents and an append-only
          instruction history. Marking the Package ready does not create a Preparation Lock,
          authorize filing or payment, release execution, contact a customer or provider, submit an
          application, or create Official Truth.
        </Alert>
      </div>
      <DocumentPackageWorkspace
        workspaceId={previewWorkspaceId}
        {...(startsFromReview
          ? { reviewCaseId: previewReviewCaseId }
          : { packageId: previewPackageId })}
        packageClient={packageClient}
        reviewClient={reviewClient}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Documents and Instructions preview root was not found.');
createRoot(root).render(<PreviewApp />);
