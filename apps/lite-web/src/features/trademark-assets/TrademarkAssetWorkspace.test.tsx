// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import { TrademarkAssetWorkspace } from './TrademarkAssetWorkspace.js';

const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_1',
  sourceVersion: '7',
  observedAt: '2026-08-19T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const view: TrademarkAssetView = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_test',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  anchorVersion: 3,
  anchor: {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_test',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 3,
    identity: { jurisdiction: 'US', markText: 'MARK ORBIT' },
    externalIdentifiers: [],
    workspaceRelationships: [{ kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }],
    sourceReferences: [source],
    relations: [],
    workspaceTags: [],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z'
  },
  observedFacts: [
    {
      kind: 'OWNER_NAME',
      value: 'Example Owner',
      source,
      freshness: 'CURRENT',
      consequential: true,
      officialTruthVerifiedByLite: false
    }
  ],
  contextSignals: [],
  conflicts: [],
  sourceReferences: [source],
  freshness: 'CURRENT',
  composedAt: '2026-08-19T00:00:00.000Z',
  officialTruthVerifiedByLite: false,
  legalDeadlineCertified: false,
  protectedActionAuthorized: false
};

afterEach(cleanup);

describe('TrademarkAssetWorkspace', () => {
  it('shows source ownership and the Lite authority boundary without execution controls', () => {
    render(<TrademarkAssetWorkspace view={view} />);

    expect(screen.getByRole('heading', { name: 'MARK ORBIT' })).toBeInTheDocument();
    expect(screen.getByText('REPRESENTED')).toBeInTheDocument();
    expect(screen.getByText(/Example Owner/)).toBeInTheDocument();
    expect(screen.getByText(/Lite does not verify official truth/)).toBeInTheDocument();
    expect(screen.getByText(/Source facts are read-only/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /owner/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /fil|pay|transfer|publish/i })
    ).not.toBeInTheDocument();
  });

  it('labels Marketplace-added assets as source read-only', () => {
    render(
      <TrademarkAssetWorkspace
        view={{
          ...view,
          anchor: {
            ...view.anchor,
            workspaceRelationships: [
              { kind: 'MARKETPLACE_ADDED', sourceAssetEditableByWorkspace: false }
            ]
          }
        }}
      />
    );

    expect(screen.getAllByText('Marketplace source · read-only')).toHaveLength(2);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each(['OWNED', 'MANAGED', 'REPRESENTED'] as const)(
    'allows Commerce Profile editing for an %s relationship',
    (kind) => {
      render(
        <TrademarkAssetWorkspace
          view={{
            ...view,
            anchor: {
              ...view.anchor,
              workspaceRelationships: [{ kind, sourceAssetEditableByWorkspace: true }]
            }
          }}
        />
      );

      expect(screen.getByRole('button', { name: 'Set up sale context' })).toBeInTheDocument();
    }
  );

  it('allows Commerce Profile editing when Marketplace and owner relationships are mixed', () => {
    render(
      <TrademarkAssetWorkspace
        view={{
          ...view,
          anchor: {
            ...view.anchor,
            workspaceRelationships: [
              { kind: 'MARKETPLACE_ADDED', sourceAssetEditableByWorkspace: false },
              { kind: 'OWNED', sourceAssetEditableByWorkspace: true }
            ]
          }
        }}
      />
    );

    expect(screen.getByRole('button', { name: 'Set up sale context' })).toBeInTheDocument();
    expect(screen.queryByText('Marketplace source · read-only')).not.toBeInTheDocument();
  });
});
