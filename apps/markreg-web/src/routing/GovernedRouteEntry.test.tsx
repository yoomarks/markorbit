import type { FormalMatter } from '@markorbit/contracts';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DurablePreparationClient } from '../api/durable-preparation.js';
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

const durableLock = {
  schemaVersion: 1 as const,
  preparationLockId: 'preparation-lock_exact' as const,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  version: 1 as const,
  source: {
    documentPackageId: 'document-package_exact' as const,
    documentPackageVersion: 7,
    canonicalEvidenceHash: 'a'.repeat(64),
    formalMatterId: 'formal-matter_exact' as const,
    formalMatterVersion: 1,
    formalMatterHash: 'b'.repeat(64),
    professionalReviewCaseId: 'professional-review_exact' as const,
    reviewVersion: 4,
    completedDecisionId: 'decision_exact',
    completedDecisionHash: 'c'.repeat(64),
    instructionEntryCount: 2,
    instructionEntries: [
      { instructionEntryId: 'instruction-entry_1', sequence: 1, canonicalFingerprint: 'd'.repeat(64) },
      { instructionEntryId: 'instruction-entry_2', sequence: 2, canonicalFingerprint: 'e'.repeat(64) }
    ],
    instructionSetHash: 'f'.repeat(64)
  },
  lockPayloadHash: '1'.repeat(64),
  createdBy: 'user_exact',
  createdAt: '2026-09-04T08:00:00.000Z',
  authority: {
    filingAuthorizationCreated: false as const,
    executionReleaseCreated: false as const,
    externalFilingCreated: false as const,
    paymentCreated: false as const,
    providerContacted: false as const,
    officialTruthCreated: false as const
  }
};

const unusedPreparationClient = (): DurablePreparationClient => ({
  create: vi.fn(),
  get: vi.fn(),
  validateCurrent: vi.fn()
});

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
        preparationClient={unusedPreparationClient()}
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
        preparationClient={unusedPreparationClient()}
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
  it('fails closed on permission denial instead of presenting a transient service retry', async () => {
    const denied = new MarkregApiError(
      'blocking',
      'You do not have permission to change this Matter Draft.',
      undefined,
      'PERMISSION_DENIED'
    );
    const getGovernedRecord = vi.fn().mockRejectedValue(denied);
    render(
      <GovernedRouteEntry
        search="?view=quote&quoteId=quote_exact&quoteVersion=v1"
        client={{ createIntake: vi.fn(), getGovernedRecord }}
        preparationClient={unusedPreparationClient()}
      />
    );

    const heading = await screen.findByRole('heading', { name: 'Workspace permission required' });
    expect(document.activeElement).toBe(heading);
    expect(screen.queryByText('The governed record service is unavailable.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry same identity and version' })).toBeNull();
  });
  it('keeps not-found governed reads stable and non-retryable', async () => {
    const notFound = new MarkregApiError(
      'blocking',
      'This Matter Draft was not found in the current Workspace.',
      undefined,
      'RECORD_NOT_FOUND'
    );
    const getGovernedRecord = vi.fn().mockRejectedValue(notFound);
    render(
      <GovernedRouteEntry
        search="?view=quote&quoteId=quote_missing&quoteVersion=v1"
        client={{ createIntake: vi.fn(), getGovernedRecord }}
        preparationClient={unusedPreparationClient()}
      />
    );

    const heading = await screen.findByRole('heading', {
      name: 'The requested record was not found. No latest record was selected.'
    });
    expect(document.activeElement).toBe(heading);
    expect(screen.queryByRole('button', { name: 'Retry same identity and version' })).toBeNull();
  });
  it('revalidates and renders exact durable Preparation Lock owner truth', async () => {
    const validateCurrent = vi.fn().mockResolvedValue(durableLock);
    const preparationClient: DurablePreparationClient = {
      create: vi.fn(),
      get: vi.fn(),
      validateCurrent
    };
    const getGovernedRecord = vi.fn();
    render(
      <GovernedRouteEntry
        search="?view=preparation-lock&preparationLockId=preparation-lock_exact&preparationLockVersion=1"
        client={{ createIntake: vi.fn(), getGovernedRecord }}
        preparationClient={preparationClient}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Preparation Lock' })).toBeTruthy();
    expect(screen.getByText('Current durable Preparation Lock')).toBeTruthy();
    expect(screen.getByText(/document-package_exact/)).toBeTruthy();
    expect(screen.getByText('Governed Filing Authorization review only')).toBeTruthy();
    expect(screen.getByText(/Preparation Lock ≠ Filing Authorization/)).toBeTruthy();
    expect(validateCurrent).toHaveBeenCalledWith('preparation-lock_exact');
    expect(getGovernedRecord).not.toHaveBeenCalled();
  });
  it('fails closed when durable Preparation Lock currentness is stale', async () => {
    const stale = new MarkregApiError(
      'conflict',
      'Preparation Lock source no longer matches current durable READY package truth.',
      undefined,
      'STALE_PREPARATION_SOURCE'
    );
    const preparationClient: DurablePreparationClient = {
      create: vi.fn(),
      get: vi.fn(),
      validateCurrent: vi.fn().mockRejectedValue(stale)
    };
    render(
      <GovernedRouteEntry
        search="?view=preparation-lock&preparationLockId=preparation-lock_exact&preparationLockVersion=1"
        client={{ createIntake: vi.fn() }}
        preparationClient={preparationClient}
      />
    );

    const heading = await screen.findByRole('heading', {
      name: 'The governed record changed and cannot be loaded from this exact link.'
    });
    expect(document.activeElement).toBe(heading);
    expect(screen.queryByText('Current durable Preparation Lock')).toBeNull();
    expect(screen.queryByRole('button', { name: /Filing Authorization/ })).toBeNull();
  });
  it('uses the Formal Matter client boundary and renders the dedicated customer workspace', async () => {
    const getFormalMatter = vi.fn().mockResolvedValue({ formalMatter });
    render(
      <GovernedRouteEntry
        search="?view=formal-matter&formalMatterId=formal-matter_exact&formalMatterVersion=1"
        client={{ createIntake: vi.fn(), getFormalMatter }}
        preparationClient={unusedPreparationClient()}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Trademark Matter' })).toBeTruthy();
    expect(screen.getByText('ORBIT')).toBeTruthy();
    expect(screen.getByText('Lifecycle current')).toBeTruthy();
    expect(screen.getByText(/Matter ≠ Filing/)).toBeTruthy();
    expect(getFormalMatter).toHaveBeenCalledWith('formal-matter_exact');
  });
});
