// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrademarkAssetAiGuidePreparedResult } from '@markorbit/contracts/trademark-asset-ai-guide';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import { TrademarkAssetHttpError, type TrademarkAssetClient } from '../../api/trademark-assets.js';
import { GuideWorkspace } from './GuideWorkspace.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_guide_workspace',
  sourceVersion: '12',
  observedAt: '2026-09-05T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const view: TrademarkAssetView = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_guide',
  workspaceId,
  anchorVersion: 9,
  anchor: {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_guide',
    workspaceId,
    version: 9,
    identity: { jurisdiction: 'US', markText: 'MARK ORBIT GUIDE' },
    externalIdentifiers: [],
    workspaceRelationships: [{ kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }],
    sourceReferences: [source],
    relations: [],
    workspaceTags: ['guide-ready'],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z'
  },
  observedFacts: [],
  contextSignals: [],
  conflicts: [],
  sourceReferences: [source],
  freshness: 'CURRENT',
  composedAt: '2026-09-05T00:01:00.000Z',
  officialTruthVerifiedByLite: false,
  legalDeadlineCertified: false,
  protectedActionAuthorized: false
};

const prepared: TrademarkAssetAiGuidePreparedResult = {
  schemaVersion: 1,
  workspaceId,
  subjectUserId: 'server-user',
  trademarkAssetId: view.trademarkAssetId,
  trademarkAssetVersion: 9,
  contextReferences: [
    {
      kind: 'ASSET_COMPOSITION',
      referenceId: view.trademarkAssetId,
      referenceVersion: '9'
    }
  ],
  evidence: [source],
  suggestions: [],
  staleOrConflictingEvidencePresent: false,
  officialTruthCreatedByGuide: false,
  officialStatusVerifiedByGuide: false,
  deadlineCertifiedByGuide: false,
  externalActionAuthorizedByGuide: false,
  customerOrProviderContactAuthorizedByGuide: false,
  paidExecutionAuthorizedByGuide: false,
  generatedAt: '2026-09-05T00:02:00.000Z'
};

function guideClient(overrides: Partial<TrademarkAssetClient> = {}): TrademarkAssetClient {
  return {
    search: vi.fn().mockResolvedValue({
      schemaVersion: 1,
      workspaceId,
      assets: [view.anchor],
      hasMore: false,
      officialTruthVerifiedByLite: false,
      management: {
        totalSignals: 0,
        urgentSignals: 0,
        importantSignals: 0,
        changedAssets: 0,
        generatedAt: '2026-09-05T00:00:00.000Z'
      },
      managementByAsset: []
    }),
    load: vi.fn().mockResolvedValue({ view, commerceProfile: null }),
    loadManagementDispositions: vi.fn(),
    recordManagementDisposition: vi.fn(),
    prepareAiGuide: vi.fn().mockResolvedValue(prepared),
    saveCommerceProfile: vi.fn(),
    loadServiceWorkPackage: vi.fn(),
    prepareServiceWorkPackage: vi.fn(),
    ...overrides
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('GuideWorkspace', () => {
  it('requires explicit Asset selection and prepares against the exact loaded current version', async () => {
    const load = vi.fn().mockResolvedValue({ view, commerceProfile: null });
    const prepareAiGuide = vi.fn().mockResolvedValue(prepared);
    const client = guideClient({ load, prepareAiGuide });
    const user = userEvent.setup();

    render(<GuideWorkspace workspaceId={workspaceId} client={client} />);

    expect(await screen.findByRole('heading', { name: 'MARK ORBIT GUIDE' })).toBeInTheDocument();
    expect(screen.getByText(/advisory, not a universal assistant authority/i)).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Use AI Guide' }));

    await waitFor(() => expect(load).toHaveBeenCalledWith('trademark-asset_guide'));
    expect(await screen.findByText(/exact version 9/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Prepare AI guidance' }));

    await waitFor(() =>
      expect(prepareAiGuide).toHaveBeenCalledWith('trademark-asset_guide', {
        expectedTrademarkAssetVersion: 9,
        requestedKinds: ['EXPLAIN_ASSET', 'IDENTIFY_MISSING_INFORMATION', 'PREPARE_CHECKLIST']
      })
    );
    expect(screen.getByText(prepared.generatedAt)).toBeInTheDocument();
  });

  it('fails closed when current Workspace Assets cannot be loaded', async () => {
    const client = guideClient({
      search: vi
        .fn()
        .mockRejectedValue(
          new TrademarkAssetHttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Assets unavailable.', true)
        )
    });

    render(<GuideWorkspace workspaceId={workspaceId} client={client} />);

    expect(
      await screen.findByRole('heading', { name: 'AI Guide assets unavailable' })
    ).toBeVisible();
    expect(screen.getByText(/No fixture or local Guide context was substituted/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Prepare AI guidance' })).not.toBeInTheDocument();
  });

  it('keeps an unavailable selected Asset distinct from a generated Guide result', async () => {
    const prepareAiGuide = vi.fn().mockResolvedValue(prepared);
    const client = guideClient({
      load: vi
        .fn()
        .mockRejectedValue(
          new TrademarkAssetHttpError(404, 'ASSET_NOT_FOUND', 'Asset unavailable.', false)
        ),
      prepareAiGuide
    });
    const user = userEvent.setup();

    render(<GuideWorkspace workspaceId={workspaceId} client={client} />);
    await user.click(await screen.findByRole('button', { name: 'Use AI Guide' }));

    expect(
      await screen.findByRole('heading', { name: 'Trademark Asset unavailable for Guide' })
    ).toBeVisible();
    expect(screen.getByText(/No local Guide context was substituted/i)).toBeVisible();
    expect(prepareAiGuide).not.toHaveBeenCalled();
  });

  it('opens an explicit Asset context directly without rediscovering the portfolio', async () => {
    const search = vi.fn();
    const load = vi.fn().mockResolvedValue({ view, commerceProfile: null });
    const client = guideClient({ search, load });
    const user = userEvent.setup();
    window.history.replaceState(
      null,
      '',
      `/?workspaceId=${workspaceId}&trademarkAssetId=${view.trademarkAssetId}&trademarkAssetVersion=9#guide`
    );

    render(
      <GuideWorkspace
        workspaceId={workspaceId}
        initialTrademarkAssetId={view.trademarkAssetId}
        initialTrademarkAssetVersion={9}
        client={client}
      />
    );

    await waitFor(() => expect(load).toHaveBeenCalledWith(view.trademarkAssetId));
    expect(search).not.toHaveBeenCalled();
    expect(await screen.findByText(/exact version 9/i)).toBeVisible();
    expect(screen.queryByText(/changed since Guide handoff/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back to Trademark Asset/i }));
    expect(window.location.hash).toBe('#trademarks');
    expect(window.location.search).toContain(`workspaceId=${workspaceId}`);
    expect(window.location.search).toContain(`trademarkAssetId=${view.trademarkAssetId}`);
  });

  it('surfaces version drift and prepares only against current owner truth', async () => {
    const prepareAiGuide = vi.fn().mockResolvedValue(prepared);
    const client = guideClient({ prepareAiGuide });
    const user = userEvent.setup();

    render(
      <GuideWorkspace
        workspaceId={workspaceId}
        initialTrademarkAssetId={view.trademarkAssetId}
        initialTrademarkAssetVersion={8}
        client={client}
      />
    );

    expect(
      await screen.findByText(/handoff referenced version 8; current owner truth is version 9/i)
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Prepare AI guidance' }));
    await waitFor(() =>
      expect(prepareAiGuide).toHaveBeenCalledWith(view.trademarkAssetId, {
        expectedTrademarkAssetVersion: 9,
        requestedKinds: ['EXPLAIN_ASSET', 'IDENTIFY_MISSING_INFORMATION', 'PREPARE_CHECKLIST']
      })
    );
  });

  it.each([
    [403, 'AI Guide permission required'],
    [404, 'Trademark Asset unavailable for Guide'],
    [503, 'AI Guide source unavailable']
  ])('fails closed for explicit Asset context when detail returns %s', async (status, title) => {
    const search = vi.fn();
    const prepareAiGuide = vi.fn();
    const client = guideClient({
      search,
      load: vi
        .fn()
        .mockRejectedValue(new TrademarkAssetHttpError(status, 'DETAIL_FAILED', 'Detail failed.')),
      prepareAiGuide
    });

    render(
      <GuideWorkspace
        workspaceId={workspaceId}
        initialTrademarkAssetId={view.trademarkAssetId}
        client={client}
      />
    );

    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    expect(search).not.toHaveBeenCalled();
    expect(prepareAiGuide).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Prepare AI guidance' })).not.toBeInTheDocument();
  });
});
