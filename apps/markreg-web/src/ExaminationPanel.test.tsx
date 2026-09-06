import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkregApiError } from './api/errors.js';
import type {
  ExaminationStageClient,
  ExaminationStageHistoryEntry,
  ExaminationStageProjection,
  ExaminationWorkflowState
} from './api/examination-stage.js';
import { ExaminationPanel } from './ExaminationPanel.js';

const workflowCases = [
  ['INTERNAL_PROCESSING', 'Internal processing'],
  ['REVIEWED_PROVIDER_EVIDENCE', 'Reviewed provider evidence'],
  ['WAITING_NO_ACTION', 'Waiting — no action indicated by the current internal workflow'],
  ['CUSTOMER_ACTION_NEEDED', 'Customer action needed'],
  ['CORRECTION_OR_REVIEW_ISSUE', 'Correction or review issue']
] as const satisfies readonly (readonly [ExaminationWorkflowState, string])[];

const eventCodeByState = {
  INTERNAL_PROCESSING: 'EXAMINATION_INTERNAL_PROCESSING',
  REVIEWED_PROVIDER_EVIDENCE: 'EXAMINATION_REVIEWED_EVIDENCE',
  WAITING_NO_ACTION: 'EXAMINATION_WAITING_NO_ACTION',
  CUSTOMER_ACTION_NEEDED: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
  CORRECTION_OR_REVIEW_ISSUE: 'EXAMINATION_CORRECTION_OR_REVIEW_ISSUE'
} as const;

const authorityConsequences = {
  protectedActionAuthorized: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentCreated: false,
  providerContacted: false,
  officeMutationCreated: false,
  officialTruthCreated: false
} as const;

const source = {
  reviewedSourceAdmission: {
    id: 'source-admission_one',
    version: 1,
    fingerprintSha256: 'a'.repeat(64)
  },
  evidenceReviewDecision: { id: 'evidence-review_one', version: 2 },
  evidenceReceipt: { id: 'evidence-receipt_one', version: 3 },
  providerReturn: { id: 'provider-return_one', version: 4 },
  formalMatter: { id: 'formal-matter_one', version: 5 }
} as const;

function historyEntry(
  workflowState: ExaminationWorkflowState = 'REVIEWED_PROVIDER_EVIDENCE'
): ExaminationStageHistoryEntry {
  return {
    lifecycleEvent: {
      id: `lifecycle-event_${workflowState}`,
      version: 1,
      fingerprintSha256: 'b'.repeat(64)
    },
    workflowState,
    eventCode: eventCodeByState[workflowState],
    customerSafeLabel: `Historical ${workflowState}`,
    customerSafeSummary: 'Historical reviewed evidence was projected into the internal workflow.',
    sourceClass: 'REVIEWED_EXTERNAL_EVIDENCE',
    projectionClass: 'INTERNAL_PRODUCT_PROJECTION',
    sourceCurrentness: 'HISTORICAL',
    source,
    occurredAt: '2026-09-01T10:00:00.000Z',
    projectedAt: '2026-09-01T10:05:00.000Z',
    officialStatusVerified: false
  };
}

function projection(
  workflowState: ExaminationWorkflowState = 'CUSTOMER_ACTION_NEEDED',
  history: readonly ExaminationStageHistoryEntry[] = []
): ExaminationStageProjection {
  return {
    schemaVersion: 1,
    workspaceId: '11111111-1111-4111-8111-111111111111',
    formalMatter: { id: 'formal-matter_one', version: 5 },
    status: 'ESTABLISHED',
    current: {
      ...historyEntry(workflowState),
      lifecycleEvent: {
        id: `lifecycle-event_current-${workflowState}`,
        version: 2,
        fingerprintSha256: 'c'.repeat(64)
      },
      lifecycleView: {
        id: 'lifecycle-view_one',
        version: 3,
        fingerprintSha256: 'd'.repeat(64)
      },
      customerSafeLabel: `Current ${workflowState}`,
      customerSafeSummary:
        'Current reviewed evidence requires bounded internal workflow attention.',
      sourceCurrentness: 'CURRENT'
    },
    history,
    deadline: null,
    deadlineStatus: 'UNAVAILABLE',
    officialStatusVerified: false,
    authorityConsequences
  };
}

function successfulClient(value: ExaminationStageProjection): ExaminationStageClient {
  return { get: () => Promise.resolve(value) };
}

function failedClient(status: number): ExaminationStageClient {
  return {
    get: () =>
      Promise.reject(
        new MarkregApiError(
          status === 409 ? 'conflict' : status === 503 ? 'recoverable' : 'blocking',
          'bounded test error',
          undefined,
          status === 409
            ? 'EXAMINATION_SOURCE_STALE'
            : status === 503
              ? 'EXAMINATION_TRUTH_UNAVAILABLE'
              : undefined,
          status
        )
      )
  };
}

afterEach(cleanup);

describe('ExaminationPanel', () => {
  it.each(workflowCases)('renders deterministic treatment for %s', async (state, label) => {
    render(
      <ExaminationPanel
        formalMatterId="formal-matter_one"
        client={successfulClient(projection(state))}
      />
    );

    expect(await screen.findByText(`Current ${state}`)).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('Reviewed external evidence')).toBeTruthy();
    expect(screen.getByText('Current')).toBeTruthy();
    expect(screen.getByText('Unavailable from this Examination projection')).toBeTruthy();
    expect(screen.getByText('Governed internal workflow')).toBeTruthy();
    expect(screen.getByText('Reviewed evidence')).toBeTruthy();
    expect(screen.getByText(/not trademark-office status or deadline truth/i)).toBeTruthy();
    expect(screen.queryByText('Official verified')).toBeNull();
  });

  it('renders NOT_ESTABLISHED as a neutral governed empty state without negative office truth', async () => {
    const value: ExaminationStageProjection = {
      ...projection(),
      status: 'NOT_ESTABLISHED',
      current: null
    };
    const { container } = render(
      <ExaminationPanel formalMatterId="formal-matter_one" client={successfulClient(value)} />
    );

    expect(
      await screen.findByText(
        'No governed Examination stage is currently established from available MarkReg lifecycle evidence.'
      )
    ).toBeTruthy();
    expect(screen.getByText(/does not establish whether examination has begun/i)).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).not.toContain('No office action');
    expect(text).not.toContain('Examination not started');
    expect(text).not.toContain('Application clear');
  });

  it('keeps historical entries explicitly historical and separate from current workflow truth', async () => {
    const prior = historyEntry();
    render(
      <ExaminationPanel
        formalMatterId="formal-matter_one"
        client={successfulClient(projection('CUSTOMER_ACTION_NEEDED', [prior]))}
      />
    );

    expect(await screen.findByText('Current CUSTOMER_ACTION_NEEDED')).toBeTruthy();
    expect(screen.getByText('Historical Examination context (1)')).toBeTruthy();
    expect(screen.getByText('Historical')).toBeTruthy();
    expect(
      screen.getByText('Historical REVIEWED_PROVIDER_EVIDENCE', { exact: false })
    ).toBeTruthy();
  });

  it.each([
    [409, 'Examination source needs review'],
    [503, 'Examination source temporarily unavailable']
  ] as const)('fails closed for owner %s without rendering absence', async (status, title) => {
    render(<ExaminationPanel formalMatterId="formal-matter_one" client={failedClient(status)} />);

    expect(await screen.findByText(title)).toBeTruthy();
    expect(
      screen.queryByText(
        'No governed Examination stage is currently established from available MarkReg lifecycle evidence.'
      )
    ).toBeNull();
  });

  it.each([
    [404, 'Formal Matter not available'],
    [401, 'Session required']
  ] as const)('uses bounded existing read conventions for %s', async (status, title) => {
    render(<ExaminationPanel formalMatterId="formal-matter_one" client={failedClient(status)} />);
    expect(await screen.findByText(title)).toBeTruthy();
  });

  it('does not guess a current state when an established owner envelope lacks the current entry', async () => {
    const value: ExaminationStageProjection = { ...projection(), current: null };
    render(
      <ExaminationPanel formalMatterId="formal-matter_one" client={successfulClient(value)} />
    );

    expect(await screen.findByText('Examination projection unavailable')).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.queryByText(
          'No governed Examination stage is currently established from available MarkReg lifecycle evidence.'
        )
      ).toBeNull();
    });
  });
});
