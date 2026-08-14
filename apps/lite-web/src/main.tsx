import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { LiteApp } from './App.js';
import { LiteAccountEntry } from './AccountEntry.js';
import { DocumentPackageWorkspace } from './features/document-package/DocumentPackageWorkspace.js';
import { GovernedWorkRouteEntry } from './routing/GovernedWorkRouteEntry.js';
const root = document.querySelector('#root');
if (!root) throw new Error('Root element missing');
const parameters = new URLSearchParams(window.location.search);
const professionalReviewCaseId = parameters.get('professionalReviewCaseId') ?? undefined;
const filingAuthorizationId = parameters.get('filingAuthorizationId');
const filingAuthorizationVersion = Number(parameters.get('filingAuthorizationVersion'));
const documentPackageId = parameters.get('documentPackageId') ?? undefined;
const documentPackageReviewCaseId = parameters.get('documentPackageReviewCaseId') ?? undefined;
const workspaceId = parameters.get('workspaceId') ?? '';
const product = () => (
  <LiteApp
    {...(professionalReviewCaseId ? { initialReviewCaseId: professionalReviewCaseId } : {})}
    {...(filingAuthorizationId && filingAuthorizationVersion
      ? {
          initialFilingAuthorization: {
            id: filingAuthorizationId,
            version: filingAuthorizationVersion
          }
        }
      : {})}
  />
);
createRoot(root).render(
  documentPackageId || documentPackageReviewCaseId ? (
    <DocumentPackageWorkspace
      workspaceId={workspaceId}
      {...(documentPackageId ? { packageId: documentPackageId } : {})}
      {...(documentPackageReviewCaseId ? { reviewCaseId: documentPackageReviewCaseId } : {})}
    />
  ) : parameters.has('view') ? (
    <GovernedWorkRouteEntry />
  ) : (
    <LiteAccountEntry renderProduct={product} />
  )
);
