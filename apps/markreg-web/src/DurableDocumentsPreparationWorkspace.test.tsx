import type { DurableDocumentPackageView, ProfessionalReviewCase } from '@markorbit/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DurableDocumentPackageClient } from './api/durable-document-package.js';
import type { DurablePreparationClient } from './api/durable-preparation.js';
import { DurableDocumentsPreparationWorkspace } from './DurableDocumentsPreparationWorkspace.js';

const review = {
  reviewCaseId: 'professional-review_exact',
  status: 'REVIEWED_READY_FOR_NEXT_STEP',
  version: 4,
  completedAt: '2026-09-04T08:00:00.000Z',
  decision: { decision: 'READY_FOR_NEXT_STEP', decidedAt: '2026-09-04T08:00:00.000Z' }
} as unknown as ProfessionalReviewCase;

const readyPackage: DurableDocumentPackageView = {
  documentPackageId: 'document-package_exact',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  formalMatterId: 'formal-matter_exact',
  sourceFormalMatterVersion: 1,
  sourceFormalMatterHash: '1'.repeat(64),
  professionalReviewCaseId: 'professional-review_exact',
  sourceReviewVersion: 4,
  sourceCompletedDecisionId: '2026-09-04T08:00:00.000Z',
  sourceCompletedDecisionHash: '2'.repeat(64),
  status: 'READY_FOR_PREPARATION_LOCK',
  version: 5,
  schemaVersion: 1,
  requirements: [],
  draft: {},
  documentItems: [],
  instructionEntries: [{ instructionEntryId: 'instruction-entry_exact' }],
  createdBy: 'user_exact',
  updatedBy: 'user_exact',
  createdAt: '2026-09-04T08:00:00.000Z',
  updatedAt: '2026-09-04T08:10:00.000Z',
  readyAt: '2026-09-04T08:10:00.000Z',
  readyBy: 'user_exact',
  canonicalEvidenceHash: 'a'.repeat(64)
};

const draftPackage: DurableDocumentPackageView = {
  documentPackageId: readyPackage.documentPackageId,
  workspaceId: readyPackage.workspaceId,
  formalMatterId: readyPackage.formalMatterId,
  sourceFormalMatterVersion: readyPackage.sourceFormalMatterVersion,
  sourceFormalMatterHash: readyPackage.sourceFormalMatterHash,
  professionalReviewCaseId: readyPackage.professionalReviewCaseId,
  sourceReviewVersion: readyPackage.sourceReviewVersion,
  sourceCompletedDecisionId: readyPackage.sourceCompletedDecisionId,
  sourceCompletedDecisionHash: readyPackage.sourceCompletedDecisionHash,
  status: 'DRAFT',
  version: 2,
  schemaVersion: 1,
  requirements: [{ requirementKey: 'IDENTITY', displayName: 'Applicant identity', blocking: true }],
  draft: {},
  documentItems: [],
  instructionEntries: [],
  createdBy: readyPackage.createdBy,
  updatedBy: readyPackage.updatedBy,
  createdAt: readyPackage.createdAt,
  updatedAt: readyPackage.updatedAt
};

const currentLock = {
  schemaVersion: 1 as const,
  preparationLockId: 'preparation-lock_exact' as const,
  workspaceId: readyPackage.workspaceId,
  version: 1 as const,
  source: {
    documentPackageId: readyPackage.documentPackageId,
    documentPackageVersion: readyPackage.version,
    canonicalEvidenceHash: readyPackage.canonicalEvidenceHash!,
    formalMatterId: readyPackage.formalMatterId,
    formalMatterVersion: readyPackage.sourceFormalMatterVersion,
    formalMatterHash: readyPackage.sourceFormalMatterHash,
    professionalReviewCaseId: readyPackage.professionalReviewCaseId,
    reviewVersion: readyPackage.sourceReviewVersion,
    completedDecisionId: readyPackage.sourceCompletedDecisionId,
    completedDecisionHash: readyPackage.sourceCompletedDecisionHash,
    instructionEntryCount: 1,
    instructionEntries: [
      {
        instructionEntryId: 'instruction-entry_exact',
        sequence: 1,
        canonicalFingerprint: '3'.repeat(64)
      }
    ],
    instructionSetHash: '4'.repeat(64)
  },
  lockPayloadHash: '5'.repeat(64),
  createdBy: 'user_exact',
  createdAt: '2026-09-04T08:11:00.000Z',
  authority: {
    filingAuthorizationCreated: false as const,
    executionReleaseCreated: false as const,
    externalFilingCreated: false as const,
    paymentCreated: false as const,
    providerContacted: false as const,
    officialTruthCreated: false as const
  }
};

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('durable Documents → Preparation workspace', () => {
  it('creates and reads back the durable package, then locks exact owner version/hash', async () => {
    const createFromCompletedReview = vi.fn().mockResolvedValue(readyPackage);
    const getPackage = vi.fn().mockResolvedValue(readyPackage);
    const createPreparationLock = vi.fn().mockResolvedValue(currentLock);
    const validateCurrent = vi.fn().mockResolvedValue(currentLock);
    const packageClient: DurableDocumentPackageClient = {
      createFromCompletedReview,
      get: getPackage,
      upsertEvidence: vi.fn(),
      appendInstruction: vi.fn(),
      markReady: vi.fn()
    };
    const preparationClient: DurablePreparationClient = {
      create: createPreparationLock,
      get: vi.fn(),
      validateCurrent
    };

    render(
      <DurableDocumentsPreparationWorkspace
        review={review}
        packageClient={packageClient}
        preparationClient={preparationClient}
      />
    );

    expect(screen.getByText('2026-09-04T08:00:00.000Z', { exact: true })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Create durable Document Package' }));
    expect(createFromCompletedReview).toHaveBeenCalledWith(
      review,
      'document-package-professional-review_exact-4'
    );
    expect(getPackage).toHaveBeenCalledWith('document-package_exact');

    await userEvent.click(
      screen.getByRole('button', { name: 'Lock exact package for preparation' })
    );
    await waitFor(() => expect(validateCurrent).toHaveBeenCalled());
    expect(createPreparationLock).toHaveBeenCalledWith({
      documentPackageId: 'document-package_exact',
      expectedDocumentPackageVersion: 5,
      expectedCanonicalEvidenceHash: 'a'.repeat(64),
      idempotencyKey: `preparation-lock-document-package_exact-5-${'a'.repeat(64)}`
    });
    expect(await screen.findByText('Locked for preparation — not submitted')).toBeTruthy();
    expect(screen.getByText('Filing Authorization remains gated')).toBeTruthy();
    expect(screen.getByText(/#731/)).toBeTruthy();
  });

  it('records real evidence metadata with exact CAS version and never fabricates fixture evidence', async () => {
    sessionStorage.setItem(
      'markreg-durable-document-package:professional-review_exact',
      'document-package_exact'
    );
    const updated = {
      ...draftPackage,
      version: 3,
      documentItems: [
        {
          requirementKey: 'IDENTITY',
          displayName: 'Passport evidence',
          verificationStatus: 'RECORDED'
        }
      ]
    } satisfies DurableDocumentPackageView;
    const upsertEvidence = vi.fn().mockResolvedValue(updated);
    const packageClient: DurableDocumentPackageClient = {
      createFromCompletedReview: vi.fn(),
      get: vi.fn().mockResolvedValue(draftPackage),
      upsertEvidence,
      appendInstruction: vi.fn(),
      markReady: vi.fn()
    };
    const preparationClient: DurablePreparationClient = {
      create: vi.fn(),
      get: vi.fn(),
      validateCurrent: vi.fn()
    };

    render(
      <DurableDocumentsPreparationWorkspace
        review={review}
        packageClient={packageClient}
        preparationClient={preparationClient}
      />
    );

    expect(await screen.findByRole('option', { name: 'Applicant identity' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Requirement'), { target: { value: 'IDENTITY' } });
    await userEvent.type(screen.getByLabelText('Evidence display name'), 'Passport evidence');
    await userEvent.type(screen.getByLabelText('SHA-256 checksum'), 'b'.repeat(64));
    await userEvent.type(
      screen.getByLabelText('External storage/reference (optional)'),
      'vault://passport'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Record evidence metadata' }));

    expect(upsertEvidence).toHaveBeenCalledWith(
      'document-package_exact',
      2,
      {
        requirementKey: 'IDENTITY',
        documentType: 'IDENTITY',
        displayName: 'Passport evidence',
        evidenceType: 'EXTERNAL_REFERENCE',
        checksum: 'b'.repeat(64),
        storageReference: 'vault://passport',
        verificationStatus: 'RECORDED'
      },
      'document-evidence-document-package_exact-2-IDENTITY'
    );
    expect(JSON.stringify(upsertEvidence.mock.calls)).not.toContain('FIXTURE');
  });
});
