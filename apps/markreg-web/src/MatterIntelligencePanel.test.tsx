import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  MatterIntelligenceClient,
  MatterIntelligenceProjection
} from './api/matter-intelligence.js';
import { MatterIntelligencePanel } from './MatterIntelligencePanel.js';

const observation = {
  matterIntelligenceObservationId: 'matter-intelligence-observation_one',
  formalMatter: {
    id: 'formal-matter_one',
    version: 3,
    snapshotSha256: 'a'.repeat(64)
  },
  observationKind: 'CN_COMPLETED_DURATION_HISTORICAL_BAND',
  observedCompletedDurationDays: 180,
  historicalBand: 'P50_TO_P75',
  datasetRefId: 'dataset-one',
  capability: {
    id: 'interpretation.cn-completed-duration-historical-band',
    version: '1.0.0',
    inputSchemaId: 'input-v1',
    outputSchemaId: 'output-v1'
  },
  capabilityRequestId: 'request-one',
  capabilityInvocationId: 'invocation-one',
  capabilityOutcomeId: 'outcome-one',
  capabilityReturnId: 'return-one',
  sessionReceiptId: 'receipt-one',
  implementation: {
    id: 'implementation-one',
    version: 1,
    implementationKey: 'implementation-key-one'
  },
  methodPackageRef: 'method-package-one',
  methodRef: 'method-one',
  methodVersionRef: 'method-v1',
  evaluationRef: 'evaluation-one',
  researchDatasetRef: 'research-dataset-one',
  evidenceRefs: ['evidence-one'],
  evidenceFingerprintSha256: 'b'.repeat(64),
  inputFingerprintSha256: 'c'.repeat(64),
  outputFingerprintSha256: 'd'.repeat(64),
  recordedByPrincipalId: 'user-one',
  recordedAt: '2026-09-01T10:00:00.000Z'
};

const currentReview = {
  matterIntelligenceReviewId: 'matter-intelligence-review_two',
  reviewVersion: 2,
  outcome: 'CONFIRMED' as const,
  rationale: 'The descriptive observation is consistent with the reviewed source.',
  reviewedByPrincipalId: 'reviewer-one',
  reviewedAt: '2026-09-01T12:00:00.000Z',
  supersedes: {
    reviewId: 'matter-intelligence-review_one',
    reviewVersion: 1
  }
};

const priorReview = {
  matterIntelligenceReviewId: 'matter-intelligence-review_one',
  reviewVersion: 1,
  outcome: 'INCONCLUSIVE' as const,
  reason: 'INCONCLUSIVE_EVIDENCE',
  reviewedByPrincipalId: 'reviewer-one',
  reviewedAt: '2026-09-01T11:00:00.000Z'
};

const projection = {
  formalMatter: {
    id: 'formal-matter_one',
    version: 4,
    snapshotSha256: 'e'.repeat(64)
  },
  items: [
    {
      observation,
      matterSourceCurrent: false,
      currentReview,
      reviewHistory: [currentReview, priorReview],
      reviewHistoryTotal: 2,
      reviewHistoryComplete: true,
      reviewState: 'REVIEWED'
    }
  ],
  page: 1,
  pageSize: 10,
  total: 1,
  reviewHistoryLimit: 5,
  semantics: {
    descriptiveHistoricalEvidence: true,
    prediction: false,
    deadline: false,
    serviceLevelAgreement: false,
    officialStatus: false
  },
  authorityConsequences: {
    officialTruthCreated: false,
    lifecycleStateMutated: false,
    formalMatterMutated: false,
    filingAuthorized: false,
    paymentAuthorized: false,
    externalActionExecuted: false
  }
} as MatterIntelligenceProjection;

afterEach(cleanup);

describe('MatterIntelligencePanel', () => {
  it('renders governed analytical truth without creating authority', async () => {
    const client = {
      get: vi.fn(() => Promise.resolve(projection))
    } as MatterIntelligenceClient;

    render(<MatterIntelligencePanel formalMatterId="formal-matter_one" client={client} />);

    await waitFor(() => expect(screen.getByText('180 days')).toBeTruthy());
    expect(screen.getByText('P50_TO_P75')).toBeTruthy();
    expect(screen.getByText('Historical source')).toBeTruthy();
    expect(screen.getByText(/CONFIRMED/)).toBeTruthy();
    expect(screen.getByText(/not external certification or Official Truth/i)).toBeTruthy();
    expect(screen.getByText('method-package-one')).toBeTruthy();
    expect(screen.getByText('evidence-one')).toBeTruthy();
    expect(screen.getByText(/not a prediction, deadline/i)).toBeTruthy();
    expect(client.get).toHaveBeenCalledWith('formal-matter_one');
  });

  it('distinguishes a successful empty projection from read failure', async () => {
    const client = {
      get: vi.fn(() =>
        Promise.resolve({
          ...projection,
          items: [],
          total: 0
        })
      )
    } as MatterIntelligenceClient;

    render(<MatterIntelligencePanel formalMatterId="formal-matter_one" client={client} />);

    await waitFor(() =>
      expect(
        screen.getByText(/No governed Matter Intelligence observations are recorded/i)
      ).toBeTruthy()
    );
    expect(screen.queryByText('Matter intelligence unavailable')).toBeNull();
  });

  it('keeps dependency failure explicit instead of converting it to empty truth', async () => {
    const client = {
      get: vi.fn(() => Promise.reject(new Error('downstream unavailable')))
    } as MatterIntelligenceClient;

    render(<MatterIntelligencePanel formalMatterId="formal-matter_one" client={client} />);

    await waitFor(() => expect(screen.getByText('Matter intelligence unavailable')).toBeTruthy());
    expect(
      screen.queryByText(/No governed Matter Intelligence observations are recorded/i)
    ).toBeNull();
  });
});
