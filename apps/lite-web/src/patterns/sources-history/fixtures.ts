import type { SourcesHistoryFixture } from './SourcesHistoryDisclosure.js';

const officialSource = {
  id: 'official-status',
  label: 'Official status record',
  kind: 'official',
  summary: 'Status accepted on 16 September 2026.',
  observedAt: 'Checked 18 minutes ago'
} as const;

const workspaceSource = {
  id: 'workspace-instruction',
  label: 'Client instruction',
  kind: 'workspace',
  summary: 'Alex Morgan requested an update after a substantive status change.',
  observedAt: 'Recorded yesterday at 4:12 PM'
} as const;

const interpretation = {
  summary: 'The status change may require a client update.',
  assumption: 'The client expects updates after substantive examination events.'
} as const;

export const sourcesHistoryFixtures = {
  normal: {
    state: 'normal',
    sources: [officialSource, workspaceSource],
    interpretation
  },
  partial: {
    state: 'partial',
    sources: [workspaceSource],
    interpretation: {
      summary: 'A client update may be expected, but the official status is still missing.',
      assumption: interpretation.assumption
    }
  },
  conflicting: {
    state: 'conflicting',
    sources: [
      officialSource,
      { ...workspaceSource, summary: 'Workspace due date: 18 September 2026.' }
    ],
    interpretation: {
      summary: 'The date difference needs human review before the next step is chosen.',
      assumption: 'Both records refer to the same examination event.'
    }
  },
  unavailable: {
    state: 'unavailable',
    sources: []
  }
} as const satisfies Record<SourcesHistoryFixture['state'], SourcesHistoryFixture>;
