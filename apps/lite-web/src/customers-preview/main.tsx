import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import '../lite.css';
import { CustomersPreview } from '../features/customers/CustomersPreview.js';
import type { FixtureState } from '../features/shared/view-models.js';
import './customers-preview.css';

const states = new Set<FixtureState>(['ready', 'loading', 'empty', 'stale', 'error']);
const parameters = new URL(window.location.href).searchParams;
const requestedScenario = parameters.get('scenario')?.toLowerCase();
const initialState = states.has(requestedScenario as FixtureState)
  ? (requestedScenario as FixtureState)
  : 'ready';

function CustomersPreviewApp() {
  const [state, setState] = useState<FixtureState>(initialState);

  return (
    <main className="customers-preview lite-workspace">
      <Alert tone="info" title="Preview fixture · Relationship context only">
        Explore deterministic customer relationship context for UI review. These records do not
        establish verified legal identity, a live customer relationship, authority, or an
        instruction to act.
      </Alert>
      <CustomersPreview state={state} setState={setState} />
    </main>
  );
}

const root = document.getElementById('root');

if (!root) throw new Error('Customers preview root was not found.');

createRoot(root).render(
  <StrictMode>
    <CustomersPreviewApp />
  </StrictMode>
);
