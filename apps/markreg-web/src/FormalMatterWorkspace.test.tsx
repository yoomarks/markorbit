import '@testing-library/jest-dom/vitest';
import type { FormalMatter } from '@markorbit/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormalMatterWorkspace } from './FormalMatterWorkspace.js';

const matter = {
  schemaVersion: 1,
  formalMatterId: 'formal-matter_workspace-one',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  kind: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 5,
  sourceCustomerConfirmationId: 'confirmation_workspace-one',
  sourceCustomerConfirmationVersion: 2,
  sourceMatterDraftId: 'matter-draft_workspace-one',
  sourceMatterDraftVersion: 3,
  sourceQuoteId: 'quote_workspace-one',
  sourceQuoteVersion: 'quote-v4',
  sourceSnapshot: {
    schemaVersion: 1,
    customerConfirmation: {
      id: 'confirmation_workspace-one',
      version: 2,
      status: 'CONFIRMED'
    },
    quote: {
      id: 'quote_workspace-one',
      version: 'quote-v4',
      currency: 'USD',
      totalMinor: 42000
    },
    matterDraft: {
      id: 'matter-draft_workspace-one',
      version: 3,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: {
        evaluatedAt: '2026-09-01T02:00:00.000Z',
        checks: [],
        readyForProfessionalReview: true
      }
    },
    preparation: {
      applicantName: 'Orbit Labs Inc.',
      applicantAddress: '1 Orbit Way',
      trademark: 'ORBIT',
      targetJurisdiction: 'US',
      classes: [9, 42],
      goodsServices: 'Downloadable software; software as a service.',
      filingBasis: 'USE',
      representativeRequired: false,
      documentReferences: ['doc_1'],
      commercialScopeUnchanged: true
    }
  },
  snapshotSchemaVersion: 1,
  snapshotSha256: 'a'.repeat(64),
  createdByUserId: 'user_workspace-one',
  createdAt: '2026-09-01T02:05:00.000Z',
  updatedAt: '2026-09-01T02:10:00.000Z'
} as unknown as FormalMatter;

afterEach(cleanup);

describe('FormalMatterWorkspace', () => {
  it('turns durable Formal Matter truth into a customer workspace without fabricating authority', () => {
    const renderLifecycle = vi.fn(() => <div>Lifecycle truth</div>);
    render(
      <FormalMatterWorkspace
        matter={matter}
        expectedVersion="5"
        actualVersion="5"
        renderLifecycle={renderLifecycle}
      />
    );

    expect(screen.getByRole('heading', { name: 'Trademark Matter' })).toBeInTheDocument();
    expect(screen.getByText('ORBIT')).toBeInTheDocument();
    expect(screen.getByText('Orbit Labs Inc.')).toBeInTheDocument();
    expect(screen.getByText('US')).toBeInTheDocument();
    expect(screen.getByText('9, 42')).toBeInTheDocument();
    expect(screen.getByText(/Matter ≠ Filing/)).toBeInTheDocument();
    expect(screen.getByText(/confirmation_workspace-one · version 2/)).toBeInTheDocument();
    expect(screen.getByText(/matter-draft_workspace-one · version 3/)).toBeInTheDocument();
    expect(screen.getByText(/quote_workspace-one · version quote-v4/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Customer Confirmation' })).toHaveAttribute(
      'href',
      expect.stringContaining('confirmationVersion=2')
    );
    expect(screen.getByRole('link', { name: 'Open source Quote' })).toHaveAttribute(
      'href',
      expect.stringContaining('quoteVersion=quote-v4')
    );
    expect(screen.queryByRole('link', { name: /Matter Draft/ })).not.toBeInTheDocument();
    expect(screen.getByText(/does not mean no intelligence exists/i)).toBeInTheDocument();
    expect(renderLifecycle).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one',
      disabled: false
    });
  });

  it('makes an exact-version mismatch visibly read only and disables lifecycle actions', () => {
    const renderLifecycle = vi.fn(({ disabled }: { disabled: boolean }) => (
      <div>{disabled ? 'Lifecycle disabled' : 'Lifecycle enabled'}</div>
    ));
    render(
      <FormalMatterWorkspace
        matter={matter}
        expectedVersion="4"
        actualVersion="5"
        versionMismatch
        renderLifecycle={renderLifecycle}
      />
    );

    expect(screen.getByText('Version mismatch')).toBeInTheDocument();
    expect(screen.getByText(/expected version 4/i)).toBeInTheDocument();
    expect(screen.getByText('Lifecycle disabled')).toBeInTheDocument();
    expect(renderLifecycle).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one',
      disabled: true
    });
  });
});
