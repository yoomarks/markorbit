import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { LiteApp } from './App.js';
import { LiteAccountEntry } from './AccountEntry.js';
import { DocumentPackageWorkspace } from './features/document-package/DocumentPackageWorkspace.js';
import { GovernedWorkRouteEntry } from './routing/GovernedWorkRouteEntry.js';
const root = document.querySelector('#root');
if (!root) throw new Error('Root element missing');
const parameters = new URLSearchParams(window.location.search);
const fixtureEntry = import.meta.env.VITE_MARKORBIT_FIXTURE_ENTRY === '1';
const governedView = parameters.get('view');
const fixtureNeedsWorkspace =
  fixtureEntry &&
  !parameters.has('workspaceId') &&
  (!governedView || governedView === 'execution-release' || governedView === 'filing-task-draft');
if (fixtureNeedsWorkspace) {
  parameters.set('workspaceId', 'workspace_fixture');
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}?${parameters.toString()}${window.location.hash}`
  );
}

function ProductEntry() {
  const current = new URLSearchParams(window.location.search);
  const professionalReviewCaseId = current.get('professionalReviewCaseId') ?? undefined;
  const filingAuthorizationId = current.get('filingAuthorizationId');
  const filingAuthorizationVersion = Number(current.get('filingAuthorizationVersion'));
  const documentPackageId = current.get('documentPackageId') ?? undefined;
  const documentPackageReviewCaseId = current.get('documentPackageReviewCaseId') ?? undefined;
  const workspaceId = current.get('workspaceId') ?? '';

  if (documentPackageId || documentPackageReviewCaseId)
    return (
      <DocumentPackageWorkspace
        workspaceId={workspaceId}
        {...(documentPackageId ? { packageId: documentPackageId } : {})}
        {...(documentPackageReviewCaseId ? { reviewCaseId: documentPackageReviewCaseId } : {})}
      />
    );

  if (current.has('view')) return <GovernedWorkRouteEntry search={current.toString()} />;

  return (
    <LiteApp
      workspaceId={workspaceId}
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
}

createRoot(root).render(
  fixtureEntry ? <ProductEntry /> : <LiteAccountEntry renderProduct={() => <ProductEntry />} />
);
