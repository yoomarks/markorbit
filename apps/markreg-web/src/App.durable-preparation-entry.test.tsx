import type { ProfessionalReviewCase } from '@markorbit/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkregClient } from './api/markreg.js';
import { MarkregApp } from './App.js';

const completedReview = {
  reviewCaseId: 'professional-review_exact',
  status: 'REVIEWED_READY_FOR_NEXT_STEP',
  version: 4,
  source: {
    matterDraftVersion: 'matter-v4',
    customerId: 'customer_exact'
  },
  decision: {
    decision: 'READY_FOR_NEXT_STEP',
    decidedAt: '2026-09-04T08:00:00.000Z'
  }
} as unknown as ProfessionalReviewCase;

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(
    {},
    '',
    '/?professionalReviewCaseId=professional-review_exact'
  );
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('MarkReg completed-review preparation entry', () => {
  it('opens the durable Documents and Preparation consumer instead of the legacy workspace', async () => {
    const getProfessionalReview = vi.fn().mockResolvedValue({ reviewCase: completedReview });
    const client = {
      createIntake: vi.fn(),
      getProfessionalReview
    } as unknown as MarkregClient;

    render(<MarkregApp client={client} />);

    expect(
      await screen.findByRole('heading', { name: 'Professional Review complete' })
    ).toBeTruthy();
    expect(getProfessionalReview).toHaveBeenCalledWith('professional-review_exact');

    await userEvent.click(screen.getByRole('button', { name: 'Open Documents and Instructions' }));

    expect(screen.getByRole('button', { name: 'Create durable Document Package' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create Document Package' })).toBeNull();
  });
});
