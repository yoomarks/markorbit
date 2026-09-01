import type { FormalMatter } from '@markorbit/contracts';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkregApiError } from '../api/errors.js';
import { GovernedRouteEntry } from './GovernedRouteEntry';

vi.mock('../LifecyclePanel.js', () => ({
  LifecyclePanel: ({ disabled }: { disabled: boolean }) => (
    <div>{disabled ? 'Lifecycle read only' : 'Lifecycle current'}</div>
  )
}));

const formalMatter = {
  schemaVersion: 1,
  formalMatterId: 'formal-matter_exact',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  kind: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 1,
  sourceCustomerConfirmationId: 'confirmation_exact',
  sourceCustomerConfirmationVersion: 1,
  sourceMatterDraftId: 'matter-draft_exact-source',
  sourceMatterDraftVersion: 2,
  sourceQuoteId: 'quote_exact-source',
  sourceQuoteVersion: 'quote-v1',
  sourceSnapshot: {
    schemaVersion: 1,
    customerConfirmation: { id: 'confirmation_exact', version: 1, status: 'CONFIRMED' },
    quote: { id: 'quote_exact-source', version: 'quote-v1', currency: 'USD', totalMinor: 100 },
    matterDraft: {
      id: 'matter-draft_exact-source',
      version: 2,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: {
        evaluatedAt: '2026-09-01T02:00:00.000Z',
        checks: [],
        readyForProfessionalReview: true
      }
    },
    preparation: {
      applicantName: 'Orbit Labs',
      applicantAddress: '1 Orbit Way',
      trademark: 'ORBIT',
      targetJurisdiction: 'US',
      classes: [9],
      goodsServices: 'Software',
      filingBasis: 'USE',
      representativeRequired: false,
      documentReferences: [],
      commercialScopeUnchanged: true
    }
  },
  snapshotSchemaVersion: 1,
  snapshotSha256: 'a'.repeat(64),
  createdByUserId: 'user_exact',
  createdAt: '2026-09-01T02:00:00.000Z',
  updatedAt: '2026-09-01T02:00:00.000Z'
} as unknown as FormalMatter;

afterEach(cleanup);
describe('MarkReg governed direct entry', () => {
  it('loads the exact record and reports version mismatch without mutation', async () => {
    const getGovernedRecord = vi.fn().mockResolvedValue({
      quote: { quoteId: 'quote_exact', pricingRuleVersion: 'v2', status: 'READY' }
    });
    render(
      <GovernedRouteEntry
        search="?view=quote&quoteId=quote_exact&quoteVersion=v1"
        client={{ createIntake: vi.fn(), getGovernedRecord }}
      />
    );
    expect(await screen.findByText('Version mismatch')).toBeTruthy();
    expect(screen.getByText('quote_exact')).toBeTruthy();
    expect(getGovernedRecord).toHaveBeenCalledWith('quote', 'quote_exact');
  });
  it('focuses recovery and retries the same identity after downstream failure', async () => {
    const getGovernedRecord = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue({
        matterDraft: { matterDraftId: 'matter-draft_exact', schemaVersion: 1, status: 'DRAFT' }
      });
    render(
      <GovernedRouteEntry
        search="?view=matter-draft&matterDraftId=matter-draft_exact&matterDraftVersion=1"
        client={{ createIntake: vi.fn(), getGovernedRecord }}
      />
    );
    const heading = await screen.findByRole('heading', {
      name: 'The governed record service is unavailable.'
    });
    expect(document.activeElement).toBe(heading);
    await userEvent.click(screen.getByRole('button', { name: 'Retry same identity and version' }));
    await waitFor(() => expect(getGovernedRecord).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('matter-draft_exact')).toBeTruthy();
  });
  it('renders durable Preparation unavailability as a stable non-retryable boundary', async () => {
    const getGovernedRecord = vi.fn().mockRejectedValue(
      new MarkregApiError(
        'recoverable',
        'Matter preparation is temporarily unavailable. Your saved Draft is unchanged.',
        undefined,
        'DURABLE_PREPARATION_NOT_AVAILABLE'
      )
    );
    render(
      <GovernedRouteEntry
        search="?view=preparation-lock&preparationLockId=preparation-lock_exact&preparationLockVersion=4%3A8"
        client={{ createIntake: vi.fn(), getGovernedRecord }}
      />
    );

    const heading = await screen.findByRole('heading', {
      name: 'Durable Preparation is not available yet'
    });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText(/Durable Document Packages are available/)).toBeTruthy();
    expect(
      screen.getByText(/will not fall back to the historical in-memory or fixture/)
    ).toBeTruthy();
    expect(
      screen.getByText(/No Preparation Lock was fabricated or treated as empty truth/)
    ).toBeTruthy();
    expect(screen.queryByText('The governed record service is unavailable.')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Retry same identity and version' })
    ).toBeNull();
    expect(getGovernedRecord).toHaveBeenCalledWith('preparation-lock', 'preparation-lock_exact');
  });
  it('uses the Formal Matter client boundary and renders the dedicated customer workspace', async () => {
    const getFormalMatter = vi.fn().mockResolvedValue({ formalMatter });
    render(
      <GovernedRouteEntry
        search="?view=formal-matter&formalMatterId=formal-matter_exact&formalMatterVersion=1"
        client={{ createIntake: vi.fn(), getFormalMatter }}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Trademark Matter' })).toBeTruthy();
    expect(screen.getByText('ORBIT')).toBeTruthy();
    expect(screen.getByText('Lifecycle current')).toBeTruthy();
    expect(screen.getByText(/Matter ≠ Filing/)).toBeTruthy();
    expect(getFormalMatter).toHaveBeenCalledWith('formal-matter_exact');
  });
});
