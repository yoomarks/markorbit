// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type {
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementSignal
} from '@markorbit/contracts/trademark-asset-management';
import type { CurrentTrademarkAssetManagementDispositionProjection } from '../../api/trademark-assets.js';
import { TrademarkAssetWorkspace } from './TrademarkAssetWorkspace.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
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

const signal: TrademarkAssetManagementSignal = {
  schemaVersion: 1,
  managementSignalId: 'trademark-asset-management-signal_current',
  workspaceId,
  version: 4,
  asset: { id: view.trademarkAssetId, version: 3 },
  dimension: 'USER_PRIORITY',
  severity: 'IMPORTANT',
  reason: 'Private management attention is required.',
  changes: [],
  evidence: [source],
  freshness: 'CURRENT',
  generatedAt: '2026-09-03T01:00:00.000Z',
  legalDeadlineCertified: false,
  officialStatusVerifiedByLite: false,
  legalConclusionVerified: false,
  conflictResolvedByLite: false,
  executionAuthorized: false
};

const recommendation: TrademarkAssetManagementRecommendation = {
  schemaVersion: 1,
  recommendationId: 'trademark-asset-management-recommendation_current',
  workspaceId,
  version: 2,
  asset: { id: view.trademarkAssetId, version: 3 },
  signalReferences: [{ id: signal.managementSignalId, version: signal.version }],
  kind: 'WATCH',
  title: 'Watch this signal',
  explanation: 'Keep this Product signal under private review.',
  evidence: [source],
  relatedOwnerReferences: [],
  staleOrConflictingEvidencePresent: false,
  userConfirmationRequired: true,
  officialTruthVerified: false,
  legalDeadlineCertified: false,
  filingAuthorized: false,
  customerOrProviderContactAuthorized: false,
  externalPublicationAuthorized: false,
  paidExecutionAuthorized: false,
  capabilityVerified: false,
  createdAt: '2026-09-03T01:00:00.000Z'
};

function projection(
  disposition: CurrentTrademarkAssetManagementDispositionProjection['items'][number]['disposition'],
  version = signal.version
): CurrentTrademarkAssetManagementDispositionProjection {
  return {
    schemaVersion: 1,
    workspaceId,
    asset: { id: view.trademarkAssetId, version: 3 },
    items: [{ signal: { id: signal.managementSignalId, version }, disposition }]
  };
}

function durableDisposition(kind: 'WATCHED' | 'RESOLVED_BY_WORKFLOW_REFERENCE') {
  return {
    schemaVersion: 1,
    dispositionId: 'trademark-asset-management-disposition_current',
    workspaceId,
    version: 1,
    asset: { id: view.trademarkAssetId, version: 3 },
    signal: { id: signal.managementSignalId, version: signal.version },
    recommendation: { id: recommendation.recommendationId, version: recommendation.version },
    kind,
    subjectUserId: '22222222-2222-4222-8222-222222222222',
    recordedAt: '2026-09-03T01:02:00.000Z',
    officialTruthCreated: false,
    legalConclusionVerified: false,
    capabilityVerified: false
  } as const;
}

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

  it('renders exact-current durable truth and ignores an old Signal version', () => {
    const watched = durableDisposition('WATCHED');
    const { rerender } = render(
      <TrademarkAssetWorkspace
        view={view}
        managementSignals={[signal]}
        recommendations={[recommendation]}
        managementDispositions={projection(watched)}
      />
    );

    expect(screen.getByText(/Durable disposition:/)).toHaveTextContent('Watched');

    rerender(
      <TrademarkAssetWorkspace
        view={view}
        managementSignals={[signal]}
        recommendations={[recommendation]}
        managementDispositions={projection(watched, signal.version - 1)}
      />
    );

    expect(
      screen.getByText(/No durable disposition for this exact current Signal version/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Durable disposition:/)).not.toBeInTheDocument();
  });

  it('keeps an owner-resolved disposition read-only in the browser', () => {
    render(
      <TrademarkAssetWorkspace
        view={view}
        managementSignals={[signal]}
        recommendations={[recommendation]}
        managementDispositions={projection(durableDisposition('RESOLVED_BY_WORKFLOW_REFERENCE'))}
        onRecordManagementDisposition={vi.fn()}
        onReloadManagementDispositions={vi.fn()}
      />
    );

    expect(screen.getByText(/owner-governed read truth/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watch' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Defer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('posts once, then stays locked when durable reload remains null', async () => {
    const record = vi.fn().mockResolvedValue(durableDisposition('WATCHED'));
    const reload = vi.fn().mockResolvedValue(projection(null));
    const user = userEvent.setup();
    render(
      <TrademarkAssetWorkspace
        view={view}
        managementSignals={[signal]}
        recommendations={[recommendation]}
        managementDispositions={projection(null)}
        onRecordManagementDisposition={record}
        onReloadManagementDispositions={reload}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Watch' }));

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record.mock.calls[0]?.[0]).toEqual({
      expectedTrademarkAssetVersion: 3,
      managementSignal: { id: signal.managementSignalId, version: signal.version },
      recommendation: { id: recommendation.recommendationId, version: recommendation.version },
      kind: 'WATCHED'
    });
    expect(record.mock.calls[0]?.[1]).toMatch(/^trademark-disposition-/);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/action remains locked/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watch' })).toBeDisabled();
  });
});
