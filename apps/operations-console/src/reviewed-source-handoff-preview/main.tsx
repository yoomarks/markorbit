import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { ReviewedSourceHandoffWorkspace } from '../reviewed-source-handoff/ReviewedSourceHandoffWorkspace.js';
import {
  clientForScenario,
  initialOutcomeForScenario,
  sourceForScenario,
  stateForScenario,
  type HandoffPreviewScenario
} from './fixtures.js';

const supported = new Set<HandoffPreviewScenario>([
  'ready',
  'loading',
  'empty',
  'unauthorized',
  'unavailable',
  'error',
  'partial',
  'dependency-unavailable',
  'permission',
  'stale-admission',
  'idempotency-conflict',
  'delivered'
]);
const requested = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supported.has(requested as HandoffPreviewScenario)
  ? (requested as HandoffPreviewScenario)
  : 'ready';
const root = document.getElementById('root');
if (!root) throw new Error('Reviewed Source Handoff preview root was not found.');
createRoot(root).render(
  <ReviewedSourceHandoffWorkspace
    source={sourceForScenario(scenario)}
    client={clientForScenario(scenario)}
    state={stateForScenario(scenario)}
    {...(initialOutcomeForScenario(scenario)
      ? { initialOutcome: initialOutcomeForScenario(scenario) }
      : {})}
  />
);
