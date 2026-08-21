// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type { TrademarkAssetClient } from '../../api/trademark-assets.js';
import { TrademarkAssetPortfolio } from './TrademarkAssetPortfolio.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_1',
  sourceVersion: '7',
  observedAt: '2026-08-20T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const view: TrademarkAssetView = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_test',
  workspaceId,
  anchorVersion: 3,
  anchor: {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_test',
    workspaceId,
    version: 3,
    identity: { jurisdiction: 'US', markText: 'MARK ORBIT' },
    externalIdentifiers: [],
    workspaceRelationships: [{ kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }],
    sourceReferences: [source],
    relations: [],
    workspaceTags: ['priority'],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z'
  },
  observedFacts: [],
  contextSignals: [],
  conflicts: [],
  sourceReferences: [source],
  freshness: 'UNKNOWN',
  composedAt: '2026-08-20T01:00:00.000Z',
  officialTruthVerifiedByLite: false,
  legalDeadlineCertified: false,
  protectedActionAuthorized: false
};

describe('TrademarkAssetPortfolio', () => {
  it('loads the workspace portfolio and opens a read-only composed view', async () => {
    const load = vi.fn().mockResolvedValue({ view });
    const loadServiceWorkPackage = vi.fn().mockResolvedValue(undefined);
    const client: TrademarkAssetClient = {
      search: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        workspaceId,
        assets: [view.anchor],
        hasMore: false,
        officialTruthVerifiedByLite: false
      }),
      load,
      loadServiceWorkPackage,
      prepareServiceWorkPackage: vi.fn()
    };
    const user = userEvent.setup();

    render(<TrademarkAssetPortfolio workspaceId={workspaceId} client={client} />);

    expect(await screen.findByRole('heading', { name: 'MARK ORBIT' })).toBeInTheDocument();
    expect(screen.getByText(/source truth is not verified by Lite/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View asset details' }));

    await waitFor(() => expect(load).toHaveBeenCalledWith('trademark-asset_test'));
    expect(loadServiceWorkPackage).toHaveBeenCalledWith('trademark-asset_test');
    expect(await screen.findByText(/Source facts are read-only/i)).toBeInTheDocument();
    expect(screen.getByText(/AI output is advisory/i)).toBeInTheDocument();
  });
});
