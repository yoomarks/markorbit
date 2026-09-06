import type { FormalMatter } from '@markorbit/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
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
  it('prioritizes human-readable Matter identity and current work before technical provenance', () => {
    const renderLifecycle = vi.fn(() => <div>Recommended action truth</div>);
    const renderExamination = vi.fn(() => <div>Examination Stage truth</div>);
    const renderEvidence = vi.fn(() => <div>Evidence Projection truth</div>);
    const renderIntelligence = vi.fn(() => <div>Matter Intelligence truth</div>);
    const { container } = render(
      <FormalMatterWorkspace
        matter={matter}
        expectedVersion="5"
        actualVersion="5"
        renderLifecycle={renderLifecycle}
        renderExamination={renderExamination}
        renderEvidence={renderEvidence}
        renderIntelligence={renderIntelligence}
      />
    );

    expect(screen.getByRole('heading', { name: 'ORBIT' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Current matter' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Examination' })).toBeTruthy();
    expect(screen.getAllByText('ORBIT').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Truth class: Customer supplied')).toBeTruthy();
    expect(screen.queryByLabelText('Truth class: Official verified')).toBeNull();
    expect(screen.getByText('Orbit Labs Inc.')).toBeTruthy();
    expect(screen.getByText('US')).toBeTruthy();
    expect(screen.getByText('9, 42')).toBeTruthy();
    expect(screen.getByText(/Matter ≠ Filing/)).toBeTruthy();
    expect(screen.getByText('Recommended action truth')).toBeTruthy();
    expect(screen.getByText('Examination Stage truth')).toBeTruthy();
    expect(screen.getByText('Evidence Projection truth')).toBeTruthy();
    expect(screen.getByText('Matter Intelligence truth')).toBeTruthy();

    const textContent = container.textContent ?? '';
    expect(textContent.indexOf('Recommended action truth')).toBeLessThan(
      textContent.indexOf('Record details and source lineage')
    );
    expect(textContent.indexOf('Examination Stage truth')).toBeLessThan(
      textContent.indexOf('Record details and source lineage')
    );
    expect(textContent.indexOf('Evidence Projection truth')).toBeLessThan(
      textContent.indexOf('Record details and source lineage')
    );
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    ).toEqual([
      'Overview',
      'Needs attention',
      'Examination',
      'Documents & Evidence',
      'Intelligence',
      'Record'
    ]);

    const recordDetails = screen.getByText('Record details and source lineage').closest('details');
    expect(recordDetails?.open).toBe(false);
    expect(screen.getByText(/confirmation_workspace-one · version 2/)).toBeTruthy();
    expect(screen.getByText(/matter-draft_workspace-one · version 3/)).toBeTruthy();
    expect(screen.getByText(/quote_workspace-one · version quote-v4/)).toBeTruthy();
    const confirmationLink = screen.getByRole('link', {
      name: 'Open Customer Confirmation',
      hidden: true
    });
    expect(confirmationLink.getAttribute('href')).toContain('confirmationVersion=2');
    const quoteLink = screen.getByRole('link', { name: 'Open source Quote', hidden: true });
    expect(quoteLink.getAttribute('href')).toContain('quoteVersion=quote-v4');
    expect(screen.queryByRole('link', { name: /Matter Draft/, hidden: true })).toBeNull();

    expect(renderLifecycle).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one',
      disabled: false
    });
    expect(renderExamination).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
    expect(renderEvidence).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
    expect(renderIntelligence).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
  });

  it('keeps read-only Examination truth visible while version mismatch disables lifecycle actions', () => {
    const renderLifecycle = vi.fn(({ disabled }: { disabled: boolean }) => (
      <div>{disabled ? 'Lifecycle disabled' : 'Lifecycle enabled'}</div>
    ));
    const renderExamination = vi.fn(() => <div>Read-only Examination</div>);
    const renderEvidence = vi.fn(() => <div>Read-only evidence</div>);
    const renderIntelligence = vi.fn(() => <div>Read-only intelligence</div>);
    render(
      <FormalMatterWorkspace
        matter={matter}
        expectedVersion="4"
        actualVersion="5"
        versionMismatch
        renderLifecycle={renderLifecycle}
        renderExamination={renderExamination}
        renderEvidence={renderEvidence}
        renderIntelligence={renderIntelligence}
      />
    );

    expect(screen.getByText('Version mismatch')).toBeTruthy();
    expect(screen.getByText(/expected version 4/i)).toBeTruthy();
    expect(screen.getByText('Lifecycle disabled')).toBeTruthy();
    expect(screen.getByText('Read-only Examination')).toBeTruthy();
    expect(screen.getByText('Read-only evidence')).toBeTruthy();
    expect(screen.getByText('Read-only intelligence')).toBeTruthy();
    expect(renderLifecycle).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one',
      disabled: true
    });
    expect(renderExamination).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
    expect(renderEvidence).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
    expect(renderIntelligence).toHaveBeenCalledWith({
      formalMatterId: 'formal-matter_workspace-one'
    });
  });

  it('keeps primary Matter truth visible when secondary evidence and intelligence are unavailable', () => {
    render(
      <FormalMatterWorkspace
        matter={matter}
        expectedVersion="5"
        actualVersion="5"
        renderLifecycle={() => <div>Review required action</div>}
        renderExamination={() => <div>Current internal Examination</div>}
        renderEvidence={() => <div role="alert">Formal Matter evidence unavailable</div>}
        renderIntelligence={() => <div role="alert">Matter intelligence unavailable</div>}
      />
    );
    expect(screen.getByRole('heading', { name: 'ORBIT' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByText('Review required action')).toBeTruthy();
    expect(screen.getByText('Current internal Examination')).toBeTruthy();
    expect(screen.getByText('Formal Matter evidence unavailable')).toBeTruthy();
    expect(screen.getByText('Matter intelligence unavailable')).toBeTruthy();
  });

  it('remounts Matter panel truth when the Formal Matter identity changes', () => {
    function StickyProbe({ formalMatterId }: { formalMatterId: string }) {
      const [capturedId] = useState(formalMatterId);
      return <div>Captured panel truth: {capturedId}</div>;
    }
    const renderLifecycle = ({ formalMatterId }: { formalMatterId: string }) => (
      <StickyProbe formalMatterId={formalMatterId} />
    );
    const quiet = () => <div>Secondary panel</div>;
    const otherMatter = {
      ...matter,
      formalMatterId: 'formal-matter_workspace-two',
      sourceSnapshot: {
        ...matter.sourceSnapshot,
        preparation: { ...matter.sourceSnapshot.preparation, trademark: 'NOVA' }
      }
    } as FormalMatter;
    const { rerender } = render(
      <FormalMatterWorkspace
        matter={matter}
        expectedVersion="5"
        actualVersion="5"
        renderLifecycle={renderLifecycle}
        renderExamination={quiet}
        renderEvidence={quiet}
        renderIntelligence={quiet}
      />
    );
    expect(screen.getByText('Captured panel truth: formal-matter_workspace-one')).toBeTruthy();
    rerender(
      <FormalMatterWorkspace
        matter={otherMatter}
        expectedVersion="5"
        actualVersion="5"
        renderLifecycle={renderLifecycle}
        renderExamination={quiet}
        renderEvidence={quiet}
        renderIntelligence={quiet}
      />
    );
    expect(screen.getByText('Captured panel truth: formal-matter_workspace-two')).toBeTruthy();
    expect(screen.queryByText('Captured panel truth: formal-matter_workspace-one')).toBeNull();
  });
});
