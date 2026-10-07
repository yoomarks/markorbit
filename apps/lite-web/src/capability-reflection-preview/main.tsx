import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import { CapabilityCenter } from '../features/capability/CapabilityCenter.js';
import {
  clientForScenario,
  previewWorkspaceId,
  type CapabilityReflectionPreviewScenario
} from './fixtures.js';
import '../lite.css';
import './preview.css';

const supported = new Set<CapabilityReflectionPreviewScenario>([
  'ready',
  'loading',
  'empty',
  'partial',
  'permission',
  'error',
  'stale',
  'complete'
]);
const requested = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supported.has(requested as CapabilityReflectionPreviewScenario)
  ? (requested as CapabilityReflectionPreviewScenario)
  : 'ready';

function PreviewApp() {
  return (
    <main className="capability-reflection-preview lite-workspace">
      <Alert tone="info" title="Preview fixture · private reflection only">
        This deterministic workspace uses governed fixture evidence. Decisions stay in browser
        memory and never verify a Capability, publish a profile, change permissions, contact a
        provider, file, pay or create Official Truth.
      </Alert>
      <CapabilityCenter workspaceId={previewWorkspaceId} client={clientForScenario(scenario)} />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Capability Reflection preview root was not found.');
createRoot(root).render(<PreviewApp />);
