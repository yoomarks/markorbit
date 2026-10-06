import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { ExecutionEvidenceReviewWorkspace } from '../evidence-review/ExecutionEvidenceReviewWorkspace.js';
import {
  clientForScenario,
  itemsForScenario,
  previewState,
  type EvidenceReviewPreviewScenario
} from './fixtures.js';

const supported = new Set<EvidenceReviewPreviewScenario>([
  'queue',
  'loading',
  'empty',
  'unauthorized',
  'unavailable',
  'error',
  'partial',
  'permission',
  'conflict'
]);
const requested = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supported.has(requested as EvidenceReviewPreviewScenario)
  ? (requested as EvidenceReviewPreviewScenario)
  : 'queue';

const root = document.getElementById('root');
if (!root) throw new Error('Evidence Review preview root was not found.');
createRoot(root).render(
  <ExecutionEvidenceReviewWorkspace
    items={itemsForScenario(scenario)}
    client={clientForScenario(scenario)}
    state={previewState(scenario)}
  />
);
