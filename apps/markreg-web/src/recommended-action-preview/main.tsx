import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import '../markreg.css';
import { RecommendedActionWorkspace } from '../recommended-action/RecommendedActionWorkspace.js';
import { clientForScenario, previewMatter, type RecommendedActionScenario } from './fixtures.js';

const supported = new Set<RecommendedActionScenario>([
  'open',
  'acknowledged',
  'dismissed',
  'no-action',
  'read-only',
  'partial',
  'loading',
  'empty',
  'unauthorized',
  'unavailable',
  'stale-version',
  'mutation-error'
]);
const requested = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supported.has(requested as RecommendedActionScenario)
  ? (requested as RecommendedActionScenario)
  : 'open';
const root = document.getElementById('root');
if (!root) throw new Error('Recommended Action preview root was not found.');

createRoot(root).render(
  <RecommendedActionWorkspace
    matter={previewMatter}
    client={clientForScenario(scenario)}
    readOnly={scenario === 'read-only'}
    partial={scenario === 'partial'}
  />
);
