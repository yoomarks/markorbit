import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import { PreparationLockWorkspace } from '../features/preparation-lock/PreparationLockWorkspace.js';
import {
  lockClientForScenario,
  packageClientForScenario,
  previewLock,
  previewPackage,
  previewPackageId,
  previewWorkspaceId,
  type PreparationLockPreviewScenario
} from './fixtures.js';
import '../lite.css';
import './preparation-lock-preview.css';

const supported = new Set<PreparationLockPreviewScenario>([
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
  'locked',
  'stale'
]);
const requested = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supported.has(requested as PreparationLockPreviewScenario)
  ? (requested as PreparationLockPreviewScenario)
  : 'ready';

function PreviewApp() {
  return (
    <main className="preparation-lock-preview lite-workspace">
      <div className="preparation-lock-preview__boundary">
        <Alert tone="info" title="Preview fixture · governed preparation boundary">
          This deterministic session creates only a MarkReg-owned Preparation Lock. It does not
          authorize filing, release execution, create payment, contact a provider, submit an
          application or create Official Truth.
        </Alert>
      </div>
      <PreparationLockWorkspace
        workspaceId={previewWorkspaceId}
        packageId={previewPackageId}
        packageClient={packageClientForScenario(scenario)}
        preparationClient={lockClientForScenario(scenario)}
        {...(scenario === 'locked'
          ? { initialPackage: previewPackage, initialLock: previewLock }
          : {})}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Preparation Lock preview root was not found.');
createRoot(root).render(<PreviewApp />);
