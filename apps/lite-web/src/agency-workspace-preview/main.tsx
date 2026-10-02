import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import { AgencyIaPrototype } from '../features/agency-ia-prototype/AgencyIaPrototype.js';
import type {
  AgencyPrototypeState,
  AgencyPrototypeSurface
} from '../features/agency-ia-prototype/fixtures.js';

const surfaces = new Set<AgencyPrototypeSurface>([
  'today',
  'cases',
  'case-detail',
  'trademarks',
  'trademark-change',
  'clients',
  'inbox',
  'more',
  'sources',
  'diagnostics'
]);
const states = new Set<AgencyPrototypeState>([
  'loading',
  'empty',
  'populated',
  'partial',
  'stale',
  'unavailable',
  'permission',
  'error',
  'success'
]);
const messageIds = {
  unlinked: 'msg-outside-counsel',
  client: 'msg-client-aurora',
  partial: 'msg-provider-partial'
} as const;

const parameters = new URL(window.location.href).searchParams;
const requestedSurface = parameters.get('surface')?.toLowerCase();
const requestedState = parameters.get('state')?.toLowerCase();
const requestedMessage = parameters.get('message')?.toLowerCase();
const initialSurface = surfaces.has(requestedSurface as AgencyPrototypeSurface)
  ? (requestedSurface as AgencyPrototypeSurface)
  : 'today';
const state = states.has(requestedState as AgencyPrototypeState)
  ? (requestedState as AgencyPrototypeState)
  : 'populated';
const initialMessageId =
  requestedMessage && requestedMessage in messageIds
    ? messageIds[requestedMessage as keyof typeof messageIds]
    : undefined;
const root = document.getElementById('root');

if (!root) throw new Error('Agency Workspace preview root was not found.');

createRoot(root).render(
  <StrictMode>
    <Alert tone="info" title="Preview fixture · Synthetic workspace">
      Explore the Northstar IP workflow with deterministic sample data. This preview does not send
      messages, file applications, change official records, or connect to an external provider.
    </Alert>
    <AgencyIaPrototype
      initialSurface={initialSurface}
      state={state}
      {...(initialMessageId ? { initialMessageId } : {})}
      mobile={parameters.get('mobile') === '1'}
    />
  </StrictMode>
);
