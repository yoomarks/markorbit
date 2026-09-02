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
    const renderEvidence = vi.fn(() => <div>Evidence Projection truth</div>);
    const renderIntelligence = vi.fn(() => <div>Matter Intelligence truth</div>);
    render(
      <FormalMatterWorkspace
        matter={matter}
        expectedVersion="5"
        actualVersion="5"
        renderLifecycle={renderLifecycle}
        renderEvidence={renderEvidence}
        renderIntelligence={renderIntelligence}
      />
    );

    expect(screen.getByRole('heading', { name: 'Trademark Matter' })).toBeTruthy();
    expect(screen.getByText('ORBIT')).toBeTruthy();
    expect(screen.getByText('Orbit Labs Inc.')).toBeTruthy();
    expect(screen.getByText('US')).toBeTruthy();
    expect(screen.getByText('9, 42')).toBeTruthy();
    expect(screen.getByText(/Matter ≠ Filing/)).toBeTruthy();
    expect(screen.getByText(/confirmation_workspace-one · version 2/)).toBeTruthy();
    expect(screen.getByText(/matter-draft_workspace-one · version 3/)).toBeTruthy();
    expect(screen.getByText(/quote_workspace-one · version quote-v4/)).toBeTruthy();
    const confirmationLink = screen.getByRole('link', { name: 'Open Customer Confirmation' });
    expect(confirmationLink.getAttribute('href')).toContain('confirmationVersion=2');
    const quoteLink = screen.getByRole('link', { name: 'Open source Quote' });
    expect(quoteLink.getAttribute('href')).toContain('quoteVersion=quote-v4');
    expect(screen.queryByRole('link', { name: /Matter Draft/ })).toBeNull();
    expect(screen.getByText('Evidence Projection truth')).toBeTruthy();
    expect(screen.getByText('Matter Intelligence truth')).toBeTruthy();
    expect(renderLifecycle).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one',
      disabled: false
    });
    expect(renderEvidence).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
    expect(renderIntelligence).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
  });

  it('makes an exact-version mismatch visibly read only and disables lifecycle actions', () => {
    const renderLifecycle = vi.fn(({ disabled }: { disabled: boolean }) => (
      <div>{disabled ? 'Lifecycle disabled' : 'Lifecycle enabled'}</div>
    ));
    const renderEvidence = vi.fn(() => <div>Read-only evidence</div>);
    const renderIntelligence = vi.fn(() => <div>Read-only intelligence</div>);
    render(
      <FormalMatterWorkspace
        matter={matter}
        expectedVersion="4"
        actualVersion="5"
        versionMismatch
        renderLifecycle={renderLifecycle}
        renderEvidence={renderEvidence}
        renderIntelligence={renderIntelligence}
      />
    );

    expect(screen.getByText('Version mismatch')).toBeTruthy();
    expect(screen.getByText(/expected version 4/i)).toBeTruthy();
    expect(screen.getByText('Lifecycle disabled')).toBeTruthy();
    expect(screen.getByText('Read-only evidence')).toBeTruthy();
    expect(screen.getByText('Read-only intelligence')).toBeTruthy();
    expect(renderLifecycle).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one',
      disabled: true
    });
    expect(renderEvidence).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
    expect(renderIntelligence).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
  });
});
