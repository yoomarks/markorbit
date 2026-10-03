import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import type { WorkspaceInsightsClient } from '../api/workspace-insights.js';
import { workspaceInsightsFixture } from '../features/insights/fixtures.js';
import { TodayWorkspace } from '../features/today/TodayWorkspace.js';
import '../lite.css';
import './today-workspace-preview.css';
import { fixtureWorkspaceId, previewClients, type TodayPreviewScenario } from './fixture.js';

const scenarios = new Set<TodayPreviewScenario>([
  'ready',
  'loading',
  'empty',
  'partial',
  'unauthorized',
  'permission',
  'error'
]);
const requestedScenario = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = scenarios.has(requestedScenario as TodayPreviewScenario)
  ? (requestedScenario as TodayPreviewScenario)
  : 'ready';
const { todayClient, dailyClient } = previewClients(scenario);
const insightsClient: WorkspaceInsightsClient = {
  load: () => Promise.resolve(workspaceInsightsFixture(fixtureWorkspaceId))
};
const root = document.getElementById('root');

if (!root) throw new Error('Today Workspace preview root was not found.');

createRoot(root).render(
  <main className="today-workspace-preview lite-workspace">
    <Alert tone="info" title="Preview fixture · Governed Daily Workspace only">
      Signals, preferences and state changes stay in this deterministic browser session. They do not
      publish externally, spend money, establish Official Truth, or change production owner data.
    </Alert>
    <TodayWorkspace
      workspaceId={fixtureWorkspaceId}
      client={todayClient}
      dailyClient={dailyClient}
      insightsClient={insightsClient}
    />
  </main>
);
