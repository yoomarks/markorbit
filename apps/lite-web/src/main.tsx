import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { LiteApp } from './App.js';
const root = document.querySelector('#root');
if (!root) throw new Error('Root element missing');
const parameters = new URLSearchParams(window.location.search);
const professionalReviewCaseId = parameters.get('professionalReviewCaseId') ?? undefined;
const filingAuthorizationId = parameters.get('filingAuthorizationId');
const filingAuthorizationVersion = Number(parameters.get('filingAuthorizationVersion'));
createRoot(root).render(
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
