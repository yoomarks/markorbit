import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import { ExecutionReleaseWorkspace } from '../features/execution-release/ExecutionReleaseWorkspace.js';
import {
  clientForScenario,
  previewConsequences,
  previewTask,
  previewWorkspaceId,
  releasesForScenario,
  type ExecutionReleasePreviewScenario
} from './fixtures.js';
import '../lite.css';
import './execution-release-preview.css';

const supported = new Set<ExecutionReleasePreviewScenario>([
  'queue',
  'loading',
  'empty',
  'unauthorized',
  'permission',
  'missing',
  'conflict',
  'validation',
  'unavailable',
  'error',
  'partial',
  'blocked',
  'ready',
  'released',
  'stale',
  'withdrawn'
]);
const requested = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supported.has(requested as ExecutionReleasePreviewScenario)
  ? (requested as ExecutionReleasePreviewScenario)
  : 'queue';
const initialReleases = releasesForScenario(scenario);

function PreviewApp() {
  return (
    <main className="execution-release-preview lite-workspace">
      <div className="execution-release-preview__boundary">
        <Alert tone="info" title="Preview fixture · internal decision boundary">
          This deterministic Lite workspace records an internal release decision and one task draft.
          It never submits an application, sends documents, creates payment, appoints a
          professional, contacts an office or creates Official Truth.
        </Alert>
      </div>
      <ExecutionReleaseWorkspace
        workspaceId={previewWorkspaceId}
        client={clientForScenario(scenario)}
        {...(initialReleases === undefined ? {} : { initialReleases })}
        {...(scenario === 'released'
          ? { initialTask: previewTask, initialConsequences: previewConsequences }
          : {})}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Release review preview root was not found.');
createRoot(root).render(<PreviewApp />);
