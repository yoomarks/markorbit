// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DurableDocumentPackageView } from '@markorbit/contracts';
import { DocumentPackageWorkspace } from './DocumentPackageWorkspace.js';

const ready: DurableDocumentPackageView = {
  documentPackageId: 'document-package_test025',
  workspaceId: 'workspace-test025',
  formalMatterId: 'formal-matter_test025',
  sourceFormalMatterVersion: 2,
  sourceFormalMatterHash: 'a'.repeat(64),
  professionalReviewCaseId: 'professional-review_test025',
  sourceReviewVersion: 6,
  sourceCompletedDecisionId: 'decision-test025',
  sourceCompletedDecisionHash: 'b'.repeat(64),
  status: 'READY_FOR_PREPARATION_LOCK',
  version: 8,
  schemaVersion: 1,
  requirements: [
    {
      requirementKey: 'MARK_REPRESENTATION_FILE',
      displayName: 'Mark representation',
      blocking: true
    }
  ],
  draft: {},
  documentItems: [
    {
      documentItemId: 'document-item_test025',
      requirementKey: 'MARK_REPRESENTATION_FILE',
      verificationStatus: 'RECORDED'
    }
  ],
  instructionEntries: [
    {
      instructionEntryId: 'instruction-entry_test025_1',
      sequence: 1,
      instructionType: 'FILING_SCOPE',
      structuredPayload: { text: 'First' }
    },
    {
      instructionEntryId: 'instruction-entry_test025_2',
      sequence: 2,
      instructionType: 'FILING_SCOPE',
      structuredPayload: { text: 'Replacement' },
      supersedesEntryId: 'instruction-entry_test025_1'
    }
  ],
  createdBy: 'user_test025',
  updatedBy: 'user_test025',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:01:00.000Z',
  readyAt: '2026-08-01T00:01:00.000Z',
  readyBy: 'user_test025',
  canonicalEvidenceHash: 'c'.repeat(64)
};
describe('Document Package workspace', () => {
  it('renders exact ready semantics and complete append-only supersession history read-only', () => {
    render(<DocumentPackageWorkspace workspaceId={ready.workspaceId} initialPackage={ready} />);
    expect(screen.getAllByText('Ready for Preparation Lock').length).toBeGreaterThan(0);
    expect(screen.getByText(/Supersedes instruction-entry_test025_1/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mark Ready/ })).toBeNull();
    expect(screen.getByText(/does not authorize filing/)).toBeTruthy();
  });
});
