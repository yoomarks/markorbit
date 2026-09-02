// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrademarkAssetAiGuidePreparedResult } from '@markorbit/contracts/trademark-asset-ai-guide';
import { TrademarkAssetHttpError } from '../../api/trademark-assets.js';
import { TrademarkAssetAiGuide } from './TrademarkAssetAiGuide.js';

const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_guide',
  sourceVersion: '7',
  observedAt: '2026-09-02T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const result: TrademarkAssetAiGuidePreparedResult = {
  schemaVersion: 1,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  subjectUserId: 'server-user',
  trademarkAssetId: 'trademark-asset_test',
  trademarkAssetVersion: 9,
  contextReferences: [
    {
      kind: 'ASSET_COMPOSITION',
      referenceId: 'trademark-asset_test',
      referenceVersion: '9',
      fingerprintSha256: 'exact-context-fingerprint'
    }
  ],
  evidence: [source],
  suggestions: [
    {
      schemaVersion: 1,
      aiGuideSuggestionId: 'ai-guide-suggestion_test',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      version: 1,
      asset: { id: 'trademark-asset_test', version: 9 },
      kind: 'EXPLAIN_ASSET',
      title: 'Asset context summary',
      explanation: 'A bounded explanation grounded in the returned owner evidence.',
      evidence: [source],
      staleOrConflictingEvidencePresent: false,
      userConfirmationRequiredForAnyConsequence: true,
      externalActionAuthorized: false,
      filingAuthorized: false,
      customerOrProviderContactAuthorized: false,
      paidExecutionAuthorized: false,
      officialTruthVerified: false,
      capabilityVerified: false,
      createdAt: '2026-09-02T01:00:00.000Z'
    }
  ],
  staleOrConflictingEvidencePresent: false,
  officialTruthCreatedByGuide: false,
  officialStatusVerifiedByGuide: false,
  deadlineCertifiedByGuide: false,
  externalActionAuthorizedByGuide: false,
  customerOrProviderContactAuthorizedByGuide: false,
  paidExecutionAuthorizedByGuide: false,
  generatedAt: '2026-09-02T01:00:00.000Z'
};

afterEach(cleanup);

describe('TrademarkAssetAiGuide', () => {
  it('intentionally requests the supported first set for the exact loaded version', async () => {
    const onPrepare = vi.fn().mockResolvedValue(result);
    const user = userEvent.setup();
    render(
      <TrademarkAssetAiGuide
        assetId="trademark-asset_test"
        assetVersion={9}
        onPrepare={onPrepare}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Prepare AI guidance' }));

    await waitFor(() =>
      expect(onPrepare).toHaveBeenCalledWith({
        expectedTrademarkAssetVersion: 9,
        requestedKinds: ['EXPLAIN_ASSET', 'IDENTIFY_MISSING_INFORMATION', 'PREPARE_CHECKLIST']
      })
    );
    expect(await screen.findByText('Asset context summary')).toBeInTheDocument();
    expect(screen.getByText('exact-context-fingerprint', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText(/matter_guide@7/)).toHaveLength(2);
    expect(screen.getByText(result.generatedAt)).toBeInTheDocument();
    expect(screen.getByText(/not official truth or verified official status/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /execute|file|contact|pay|publish/i })
    ).not.toBeInTheDocument();
  });

  it('prominently warns when the owner returns stale or conflicting evidence', () => {
    render(
      <TrademarkAssetAiGuide
        assetId="trademark-asset_test"
        assetVersion={9}
        initialResult={{ ...result, staleOrConflictingEvidencePresent: true }}
        onPrepare={() => Promise.resolve(result)}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Stale or conflicting evidence is present');
    expect(screen.getByRole('alert')).toHaveTextContent('does not resolve source conflicts');
  });

  it.each([
    [401, 'Session required'],
    [403, 'AI Guide permission denied'],
    [404, 'Asset unavailable for AI Guide'],
    [409, 'Asset truth changed or evidence conflicts'],
    [422, 'Suggestion request not supported'],
    [503, 'AI Guide temporarily unavailable']
  ])('keeps the loaded Asset context visible for a %s response', async (status, title) => {
    const user = userEvent.setup();
    render(
      <TrademarkAssetAiGuide
        assetId="trademark-asset_test"
        assetVersion={9}
        onPrepare={() =>
          Promise.reject(new TrademarkAssetHttpError(status, 'GUIDE_FAILED', 'Guide failed.'))
        }
      />
    );

    await user.click(screen.getByRole('button', { name: 'Prepare AI guidance' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(title);
    expect(screen.getByText(/Exact Asset trademark-asset_test · version 9/)).toBeInTheDocument();
    expect(
      screen.getByText(/loaded Trademark Asset workspace remains unchanged/i)
    ).toBeInTheDocument();
  });
});
