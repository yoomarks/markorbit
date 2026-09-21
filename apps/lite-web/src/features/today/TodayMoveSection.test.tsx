// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  OpportunityCandidate,
  OpportunityQualificationDecision,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayHttpError, type TodayProductLoopSnapshot } from '../../api/product-loop.js';
import { TodayMoveSection } from './TodayMoveSection.js';

afterEach(cleanup);

const workspaceId = '25252525-2525-4252-8252-252525252525';
const source = {
  schemaVersion: 1 as const,
  owner: 'LITE' as const,
  kind: 'OPPORTUNITY_CANDIDATE' as const,
  sourceId: 'opportunity-candidate_move-1424',
  sourceVersion: 2,
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-09-21T10:00:00.000Z'
};
const recommendation: TodayRecommendation = {
  schemaVersion: 1,
  todayRecommendationId: 'today-recommendation_move-1424',
  workspaceId,
  version: 1,
  kind: 'OPPORTUNITY_REVIEW',
  title: 'Qualified renewal service review',
  explanation: 'Review exact qualified Candidate evidence before preparing a Formal Opportunity.',
  sources: [source],
  status: 'OPEN',
  recommendationFingerprintSha256: 'b'.repeat(64),
  executionAuthorized: false,
  createdAt: '2026-09-21T10:01:00.000Z',
  updatedAt: '2026-09-21T10:01:00.000Z'
};
const candidate: OpportunityCandidate = {
  schemaVersion: 1,
  opportunityCandidateId: source.sourceId,
  workspaceId,
  version: 3,
  kind: 'TRADEMARK_SERVICE',
  title: 'Renewal service Candidate',
  serviceNeedSummary: 'Exact evidence reviewed by a professional.',
  sources: [],
  status: 'DISPOSITIONED',
  opportunityCandidateFingerprintSha256: 'c'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-09-21T09:00:00.000Z',
  updatedAt: '2026-09-21T10:00:30.000Z'
};
const qualification: OpportunityQualificationDecision = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_move-1424',
  workspaceId,
  version: 1,
  candidate: { id: candidate.opportunityCandidateId, version: 2 },
  expectedCandidateFingerprintSha256: source.sourceFingerprintSha256,
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: '11111111-1111-4111-8111-111111111111',
  rationale: 'Human reviewer confirmed the exact Candidate evidence.',
  decidedAt: '2026-09-21T10:00:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
};

function today(): TodayProductLoopSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt: '2026-09-21T10:02:00.000Z',
    items: [{ recommendation, preparedActions: [] }],
    partial: false,
    warnings: [],
    recentFeedback: [],
    feedbackPendingPackages: []
  };
}

describe('Today Opportunity Review MOVE card', () => {
  it('requires explicit relationship model after exact owner evidence is visible', async () => {
    const onPrepareOpportunity = vi.fn();
    render(
      <TodayMoveSection
        workspaceId={workspaceId}
        today={today()}
        selectionRecommendationId={recommendation.todayRecommendationId}
        busy=""
        feedbackBusyPackageId=""
        loadOpportunityReview={() =>
          Promise.resolve({ source, candidate, qualification })
        }
        onPrepare={vi.fn()}
        onPrepareOpportunity={onPrepareOpportunity}
        onConfirm={vi.fn()}
        onRecordFeedback={vi.fn()}
      />
    );

    expect(screen.getByText('Loading exact Candidate and Qualification evidence…')).toBeVisible();
    await screen.findByText('Human reviewer confirmed the exact Candidate evidence.');
    expect(screen.getByText(source.sourceFingerprintSha256)).toBeVisible();
    expect(screen.getByText(/will not infer one from Seed or Candidate data/)).toBeVisible();

    const prepare = screen.getByRole('button', {
      name: 'Prepare Formal Opportunity action'
    });
    expect(prepare).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'Co-delivery' }));
    expect(prepare).toBeEnabled();
    fireEvent.click(prepare);

    expect(onPrepareOpportunity).toHaveBeenCalledWith(recommendation, 'CO_DELIVERY');
    expect(screen.getByText(/does not prove a current Customer Relationship/)).toBeVisible();
  });

  it('keeps stale evidence explicit and exposes no prepare action', async () => {
    render(
      <TodayMoveSection
        workspaceId={workspaceId}
        today={today()}
        selectionRecommendationId={recommendation.todayRecommendationId}
        busy=""
        feedbackBusyPackageId=""
        loadOpportunityReview={() =>
          Promise.reject(
            new TodayHttpError(
              409,
              'STALE_OPPORTUNITY_EVIDENCE',
              'Qualification evidence no longer matches the reviewed Candidate.'
            )
          )
        }
        onPrepare={vi.fn()}
        onPrepareOpportunity={vi.fn()}
        onConfirm={vi.fn()}
        onRecordFeedback={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByText('Opportunity evidence changed after qualification')
      ).toBeVisible()
    );
    expect(
      screen.queryByRole('button', { name: 'Prepare Formal Opportunity action' })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/no longer matches the reviewed Candidate/)).toBeVisible();
  });
});
