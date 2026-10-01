import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { OaWorkbench } from '../features/oa-workbench/OaWorkbench.js';
import type { WorkbenchScenario } from '../features/oa-workbench/model.js';

const scenarios = new Set<WorkbenchScenario>([
  'READY',
  'AMBIGUOUS_MATCH',
  'PARTIAL_FILE',
  'DEADLINE_UNKNOWN',
  'STALE_SOURCE',
  'PERMISSION',
  'WRONG_WORKSPACE',
  'SOURCE_UNAVAILABLE',
  'CONFLICTED_EVIDENCE',
  'EMPTY',
  'LOADING',
  'PREPARING',
  'PREPARED',
  'REVIEW_PENDING',
  'SAVED_DEMO'
]);

const unavailableStorage = {
  getItem(): string | null {
    throw new Error('Demo storage unavailable');
  },
  setItem(): void {
    throw new Error('Demo storage unavailable');
  }
};

const parameters = new URL(window.location.href).searchParams;
const requestedScenario = parameters.get('scenario')?.toUpperCase() ?? 'READY';
const scenario: WorkbenchScenario = scenarios.has(requestedScenario as WorkbenchScenario)
  ? (requestedScenario as WorkbenchScenario)
  : 'READY';
const initialLocale = parameters.get('locale') === 'en' ? 'en' : 'zh';
const trustedPrincipalId = parameters.get('session') === 'memory' ? '' : 'preview-oa-professional';
const storage = requestedScenario === 'STORAGE_FAILURE' ? unavailableStorage : window.localStorage;
const root = document.getElementById('root');

if (!root) throw new Error('OA workbench preview root was not found.');

createRoot(root).render(
  <StrictMode>
    <OaWorkbench
      scenario={scenario}
      initialLocale={initialLocale}
      trustedPrincipalId={trustedPrincipalId}
      storage={storage}
    />
  </StrictMode>
);
