import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { ReviewedSourceAdmissionWorkspace } from '../reviewed-source-admission/ReviewedSourceAdmissionWorkspace.js';
import {
  clientForScenario,
  decisionForScenario,
  previewTargets,
  stateForScenario,
  type AdmissionPreviewScenario
} from './fixtures.js';

const supported = new Set<AdmissionPreviewScenario>([
  'ready',
  'loading',
  'empty',
  'unauthorized',
  'unavailable',
  'error',
  'partial',
  'nonadmissible',
  'permission',
  'decision-conflict',
  'matter-conflict'
]);
const requested = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supported.has(requested as AdmissionPreviewScenario)
  ? (requested as AdmissionPreviewScenario)
  : 'ready';

const root = document.getElementById('root');
if (!root) throw new Error('Reviewed Source Admission preview root was not found.');

createRoot(root).render(
  <ReviewedSourceAdmissionWorkspace
    decision={decisionForScenario(scenario)}
    targets={previewTargets}
    client={clientForScenario(scenario)}
    state={stateForScenario(scenario)}
  />
);
