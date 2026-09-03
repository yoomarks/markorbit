import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import './markreg.css';
import { MarkregApp } from './App.js';
import { MarkregAccountEntry } from './AccountEntry.js';
import { ProductionIntakePlanning } from './ProductionIntakePlanning.js';
import { GovernedRouteEntry } from './routing/GovernedRouteEntry.js';
import { MarkregWorkspaceHome } from './WorkspaceHome.js';
const root = document.querySelector('#root');
if (!root) throw new Error('Root element missing');
const parameters = new URLSearchParams(window.location.search);
const fixtureEntry = import.meta.env.VITE_MARKORBIT_FIXTURE_ENTRY === '1';
createRoot(root).render(
  parameters.has('view') ? (
    <GovernedRouteEntry />
  ) : fixtureEntry ? (
    <MarkregApp />
  ) : (
    <MarkregAccountEntry
      renderProduct={() => (
        <MarkregWorkspaceHome renderPlanning={() => <ProductionIntakePlanning />} />
      )}
    />
  )
);
