import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import { FilingAuthorizationWorkspace } from '../features/filing-authorization/FilingAuthorizationWorkspace.js';
import {
  authorizationForScenario,
  clientForScenario,
  previewAuthorizationId,
  previewConsequences,
  previewWorkspaceId,
  type FilingAuthorizationPreviewScenario
} from './fixtures.js';
import '../lite.css';
import './filing-authorization-preview.css';

const supported = new Set<FilingAuthorizationPreviewScenario>([
  'ready',
  'loading',
  'partial',
  'unauthorized',
  'permission',
  'missing',
  'conflict',
  'validation',
  'unavailable',
  'error',
  'confirming',
  'authorized',
  'stale',
  'expired',
  'withdrawn'
]);
const requested = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supported.has(requested as FilingAuthorizationPreviewScenario)
  ? (requested as FilingAuthorizationPreviewScenario)
  : 'ready';
const requiresLoad = ['loading', 'unauthorized', 'missing', 'unavailable', 'error'].includes(
  scenario
);

function PreviewApp() {
  return (
    <main className="filing-authorization-preview lite-workspace">
      <div className="filing-authorization-preview__boundary">
        <Alert tone="info" title="Preview fixture · governed authority boundary">
          This deterministic MarkReg experience records only a Filing Authorization. It never
          submits an application, releases execution, creates payment, appoints a professional,
          contacts a provider or creates Official Truth.
        </Alert>
      </div>
      <FilingAuthorizationWorkspace
        workspaceId={previewWorkspaceId}
        filingAuthorizationId={previewAuthorizationId}
        client={clientForScenario(scenario)}
        {...(requiresLoad
          ? {}
          : {
              initialAuthorization: authorizationForScenario(scenario),
              initialConsequences: previewConsequences
            })}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Filing Authorization preview root was not found.');
createRoot(root).render(<PreviewApp />);
