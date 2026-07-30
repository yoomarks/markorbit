import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import './markreg.css';
import { MarkregApp } from './App.js';
import { GovernedRouteEntry } from './routing/GovernedRouteEntry.js';
const root = document.querySelector('#root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(
  new URLSearchParams(window.location.search).has('view') ? <GovernedRouteEntry /> : <MarkregApp />
);
