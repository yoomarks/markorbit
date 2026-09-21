// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  OpportunityCandidate,
  OpportunityQualificationDecision,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  QualifiedOpportunityReviewEvidence,
  TodayClient,
  TodayProductLoopSnapshot
} from '../../api/product-loop.js';
import { TodayHttpError } from '../../api/product-loop.js';
import { TodayMoveSection } from './TodayMoveSection.js';

afterEach(cleanup);

const workspaceId = '25252525-2525-4252-8252-252525252525';
const candidateId = 'opportunity-candidate_move-test';
const fingerprint = 'a'.repeat(64);

function opportunityRecommendation(suffix: string): TodayRecommendation {
  return {
    schemaVersion: 1,
    todayRecommendationId: `today-recommendation_${suffix}`,
    workspaceId,
    version: 1,
    kind: 'OPPORTUNITY_REVIEW',
    title: `Qualified opportunity ${suffix}`,
    explanation: 'Human Qualification is ready for exact review.',
    sources: [
      {
        schemaVersion: 1,
        owner: 'LITE',
        kind: 'OPPORTUNITY_CANDIDATE',
        sourceId: suffix === 'selected' ? candidateId : `opportunity-candidate_${suffix}`,
        sourceVersion: 1,
        sourceFingerprintSha256: fingerprint,
        observedAt: '2026-09-21T10:00:00.000Z'
      }
    ],
    status: 'OPEN',
    recommendationFingerprintSha256: 'b'.repeat(64),
    executionAuthorized: false,
    createdAt: '2026-09-21T10:00:00.000Z',
    updatedAt: '2026-09-21T10:00:00.000Z'
  };
}

const selectedRecommendation = opportunityRecommendation('selected');
const otherRecommendation = opportunityRecommendation('other');

const candidate: OpportunityCandidate = {
  schemaVersion: 1,
  opportunityCandidateId: candidateId,
  workspaceId,
  version: 2,
  kind: 'TRADEMARK_SERVICE',
  title: 'Qualified Candidate',
  serviceNeedSummary: 'Human-reviewed service need.',
  sources: [],
  status: 'DISPOSITIONED',
  opportunityCandidateFingerprintSha256: 'c'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-09-21T09:00:00.000Z',
  updatedAt: '2026-09-21T10:01:00.000Z'
};

const qualificationDecision: OpportunityQualificationDecision = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_move-test',
  workspaceId,
  version: 1,
  candidate: { id: candidateId, version: 1 },
  expectedCandidateFingerprintSha256: fingerprint,
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: 'principal_move-test',
  rationale: 'Human reviewer qualified this exact Candidate.',
  decidedAt: '2026-09-21T10:01:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
};

const evidence: QualifiedOpportunityReviewEvidence = {
  source: selectedRecommendation.sources[0]!,
  candidate,
  qualificationDecision
};

function snapshot(): TodayProductLoopSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt: '2026-09-21T10:02:00.000Z',
    items: [
      { recommendation: selectedRecommendation, preparedActions: [] },
      { recommendation: otherRecommendation, preparedActions: [] }
    ],
    partial: false,
    warnings: [],
    recentFeedback: [],
    feedbackPendingPackages: []
  };
}

function client(load = vi.fn(() => Promise.resolve(evidence))): TodayClient {
  return {
    loadToday: () => Promise.resolve(snapshot()),
    loadPreparedAction: () => Promise.reject(new Error('unused')),
    loadQualifiedOpportunityReview: load,
    prepareContent: () => Promise.reject(new Error('unused')),
    prepareQualifiedOpportunity: () => Promise.reject(new Error('unused')),
    confirm: () => Promise.reject(new Error('unused')),
    recordUseFeedback: () => Promise.reject(new Error('unused'))
  };
}

describe('Today Opportunity Review preparation', () => {
  it('loads only the selected exact Candidate evidence and requires explicit relationship model', async () => {
    const load = vi.fn(() => Promise.resolve(evidence));
    const onPrepareOpportunity = vi.fn();

    render(
      <TodayMoveSection
        workspaceId={workspaceId}
        today={snapshot()}
        selectionRecommendationId={selectedRecommendation.todayRecommendationId}
        busy=""
        feedbackBusyPackageId=""
        client={client(load)}
        onSelectRecommendation={vi.fn()}
        onPrepare={vi.fn()}
        onPrepareOpportunity={onPrepareOpportunity}
        onConfirm={vi.fn()}
        onRecordFeedback={vi.fn()}
      />
    );

    expect(await screen.findByText(/Human reviewer qualified this exact Candidate/)).toBeVisible();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(selectedRecommendation);
    expect(screen.getByText(/does not verify a Customer Relationship/)).toBeVisible();

    const prepare = screen.getByRole('button', {
      name: 'Prepare Formal Opportunity action'
    });
    expect(prepare).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Relationship model'), {
      target: { value: 'CO_DELIVERY' }
    });
    expect(prepare).toBeEnabled();
    fireEvent.click(prepare);

    expect(onPrepareOpportunity).toHaveBeenCalledWith(
      selectedRecommendation,
      evidence,
      'CO_DELIVERY'
    );
    expect(screen.getByRole('button', { name: 'Review qualified Candidate' })).toBeVisible();
  });

  it('keeps stale or unavailable Qualification evidence distinct from a ready state', async () => {
    const load = vi.fn(() =>
      Promise.reject(
        new TodayHttpError(
          409,
          'STALE_OPPORTUNITY_REVIEW',
          'Qualification fingerprint no longer matches.'
        )
      )
    );

    render(
      <TodayMoveSection
        workspaceId={workspaceId}
        today={{
          ...snapshot(),
          items: [{ recommendation: selectedRecommendation, preparedActions: [] }]
        }}
        selectionRecommendationId={selectedRecommendation.todayRecommendationId}
        busy=""
        feedbackBusyPackageId=""
        client={client(load)}
        onSelectRecommendation={vi.fn()}
        onPrepare={vi.fn()}
        onPrepareOpportunity={vi.fn()}
        onConfirm={vi.fn()}
        onRecordFeedback={vi.fn()}
      />
    );

    expect(await screen.findByText('Qualification fingerprint no longer matches.')).toBeVisible();
    expect(screen.queryByLabelText('Relationship model')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry exact evidence' }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
