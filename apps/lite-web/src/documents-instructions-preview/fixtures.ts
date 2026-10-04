import type {
  DurableDocumentEvidenceInput,
  DurableDocumentPackageView,
  DurableInstructionInput,
  ProfessionalReviewCase,
  ProfessionalReviewChecklistItem
} from '@markorbit/contracts';
import { PackageHttpError, type DocumentPackageClient } from '../api/document-package.js';
import type { ProfessionalReviewClient } from '../api/professional-review.js';
import { matterFixture } from '../matter-workspace-preview/fixtures.js';

export type DocumentsInstructionsPreviewScenario =
  | 'from-review'
  | 'draft'
  | 'loading'
  | 'unauthorized'
  | 'permission'
  | 'missing'
  | 'conflict'
  | 'review-unavailable'
  | 'unavailable'
  | 'error'
  | 'success';

export const previewWorkspaceId = matterFixture.workspaceId;
export const previewReviewCaseId = 'professional-review_fixture-documents-1476';
export const previewPackageId = 'document-package_fixture-documents-1476';

const completedChecklist: ProfessionalReviewChecklistItem[] = [
  {
    code: 'SOURCE_MATTER_DRAFT_CURRENT',
    status: 'PASS',
    blocking: true,
    explanation: 'The exact current Matter Draft was reviewed.'
  },
  {
    code: 'APPLICANT_INFORMATION_REVIEWED',
    status: 'PASS',
    blocking: true,
    explanation: 'Applicant identity evidence was reviewed.'
  },
  {
    code: 'AUTHORITY_BOUNDARIES_ACKNOWLEDGED',
    status: 'PASS',
    blocking: true,
    explanation: 'Protected-action boundaries were acknowledged.'
  }
];

export const completedReviewFixture: ProfessionalReviewCase = {
  schemaVersion: 1,
  reviewCaseId: previewReviewCaseId,
  workspaceId: previewWorkspaceId,
  formalMatterId: matterFixture.formalMatterId,
  sourceFormalMatterVersion: matterFixture.version,
  sourceSnapshotSha256: matterFixture.snapshotSha256,
  version: 4,
  source: {
    schemaVersion: 1,
    matterDraftId: matterFixture.sourceMatterDraftId,
    matterDraftVersion: String(matterFixture.sourceMatterDraftVersion),
    confirmationId: matterFixture.sourceCustomerConfirmationId,
    customerId: 'customer_fixture-documents-1476',
    status: 'READY_FOR_PROFESSIONAL_REVIEW',
    preparation: matterFixture.sourceSnapshot.preparation,
    readiness: matterFixture.sourceSnapshot.matterDraft.readiness,
    readinessTimestamp: matterFixture.sourceSnapshot.matterDraft.readiness.evaluatedAt
  },
  status: 'REVIEWED_READY_FOR_NEXT_STEP',
  priority: 'HIGH',
  requestedBy: 'user_fixture-documents-1476',
  createdAt: '2026-10-03T08:18:00.000Z',
  updatedAt: '2026-10-03T08:40:00.000Z',
  assignment: {
    status: 'CLAIMED',
    claimedBy: 'reviewer_fixture-documents-1476',
    claimedAt: '2026-10-03T08:32:00.000Z',
    professionalAppointed: false
  },
  checklist: completedChecklist,
  evidence: [],
  completedAt: '2026-10-03T08:40:00.000Z',
  completedBy: 'reviewer_fixture-documents-1476',
  decision: {
    code: 'MARK_READY_FOR_NEXT_STEP',
    reviewerId: 'reviewer_fixture-documents-1476',
    decidedAt: '2026-10-03T08:40:00.000Z',
    rationale: 'Exact Matter and private source evidence were reviewed.',
    checklistSnapshot: completedChecklist,
    evidenceReferences: [matterFixture.snapshotSha256],
    sourceMatterDraftVersion: String(matterFixture.sourceMatterDraftVersion),
    consequences: {
      orderCreated: false,
      paymentCreated: false,
      formalMatterCreated: false,
      providerAppointed: false,
      filingCreated: false,
      customerMessageSent: false
    }
  }
};

const draftPackage: DurableDocumentPackageView = {
  documentPackageId: previewPackageId,
  workspaceId: previewWorkspaceId,
  formalMatterId: matterFixture.formalMatterId,
  sourceFormalMatterVersion: matterFixture.version,
  sourceFormalMatterHash: matterFixture.snapshotSha256,
  professionalReviewCaseId: completedReviewFixture.reviewCaseId,
  sourceReviewVersion: completedReviewFixture.version ?? 1,
  sourceCompletedDecisionId: completedReviewFixture.decision!.decidedAt,
  sourceCompletedDecisionHash: '2'.repeat(64),
  status: 'DRAFT',
  version: 1,
  schemaVersion: 1,
  requirements: [
    {
      requirementKey: 'MARK_REPRESENTATION_FILE',
      displayName: 'Reviewed mark representation',
      blocking: true
    },
    {
      requirementKey: 'APPLICANT_AUTHORIZATION',
      displayName: 'Applicant authorization evidence',
      blocking: true
    }
  ],
  draft: { note: 'Keep all evidence bound to the completed Review.' },
  documentItems: [
    {
      documentItemId: 'document-item_fixture-documents-1476-mark',
      requirementKey: 'MARK_REPRESENTATION_FILE',
      originalFileName: 'orbit-shield-reviewed-mark.pdf',
      verificationStatus: 'RECORDED'
    }
  ],
  instructionEntries: [],
  createdBy: 'user_fixture-documents-1476',
  updatedBy: 'user_fixture-documents-1476',
  createdAt: '2026-10-03T08:42:00.000Z',
  updatedAt: '2026-10-03T08:42:00.000Z'
};

const readyPackage: DurableDocumentPackageView = {
  ...draftPackage,
  status: 'READY_FOR_PREPARATION_LOCK',
  version: 5,
  documentItems: [
    ...draftPackage.documentItems,
    {
      documentItemId: 'document-item_fixture-documents-1476-authorization',
      requirementKey: 'APPLICANT_AUTHORIZATION',
      originalFileName: 'applicant-authorization.pdf',
      verificationStatus: 'RECORDED'
    }
  ],
  instructionEntries: [
    {
      instructionEntryId: 'instruction-entry_fixture-documents-1476-1',
      sequence: 1,
      instructionType: 'FILING_SCOPE',
      structuredPayload: { text: 'Use the reviewed US classes 9 and 42 scope.' }
    },
    {
      instructionEntryId: 'instruction-entry_fixture-documents-1476-2',
      sequence: 2,
      instructionType: 'FILING_SCOPE',
      structuredPayload: { text: 'Use the final reviewed US classes 9 and 42 scope.' },
      supersedesEntryId: 'instruction-entry_fixture-documents-1476-1'
    }
  ],
  updatedAt: '2026-10-03T08:52:00.000Z',
  readyAt: '2026-10-03T08:52:00.000Z',
  readyBy: 'user_fixture-documents-1476',
  canonicalEvidenceHash: '3'.repeat(64)
};

const clonePackage = (value: DurableDocumentPackageView): DurableDocumentPackageView => ({
  ...value,
  requirements: value.requirements.map((item) => ({ ...item })),
  draft: { ...value.draft },
  documentItems: value.documentItems.map((item) => ({ ...item })),
  instructionEntries: value.instructionEntries.map((item) => ({ ...item }))
});

const failure = (status: number, code: string, message: string) =>
  Promise.reject(new PackageHttpError(status, code, message));

function createFixturePackageClient(initial = draftPackage): DocumentPackageClient {
  let current = clonePackage(initial);
  const result = () => Promise.resolve(clonePackage(current));
  const assertCurrent = (id: string, expectedVersion: number) => {
    if (id !== current.documentPackageId)
      throw new PackageHttpError(404, 'DOCUMENT_PACKAGE_NOT_FOUND', 'Package was not found.');
    if (expectedVersion !== current.version)
      throw new PackageHttpError(
        409,
        'DOCUMENT_PACKAGE_VERSION_CONFLICT',
        'The exact Package version changed. Reload before continuing.'
      );
    if (current.status !== 'DRAFT')
      throw new PackageHttpError(409, 'DOCUMENT_PACKAGE_IMMUTABLE', 'Ready evidence is read only.');
  };
  return {
    create: (input) => {
      if (
        input.professionalReviewCaseId !== completedReviewFixture.reviewCaseId ||
        input.expectedReviewVersion !== completedReviewFixture.version ||
        input.expectedCompletedDecisionId !== completedReviewFixture.decision?.decidedAt
      )
        return failure(
          409,
          'PROFESSIONAL_REVIEW_CHANGED',
          'The completed Review changed before Package creation.'
        );
      current = clonePackage(draftPackage);
      return result();
    },
    get: (id) =>
      id === current.documentPackageId
        ? result()
        : failure(404, 'DOCUMENT_PACKAGE_NOT_FOUND', 'Package was not found.'),
    save: (id, expectedVersion, draft) => {
      assertCurrent(id, expectedVersion);
      current = {
        ...current,
        version: current.version + 1,
        draft: { ...current.draft, ...draft },
        updatedAt: '2026-10-03T08:44:00.000Z'
      };
      return result();
    },
    evidence: (id, expectedVersion, evidence: DurableDocumentEvidenceInput) => {
      assertCurrent(id, expectedVersion);
      current = {
        ...current,
        version: current.version + 1,
        documentItems: [
          ...current.documentItems,
          {
            documentItemId: `document-item_fixture-documents-1476-${evidence.requirementKey.toLowerCase()}`,
            ...evidence
          }
        ],
        updatedAt: '2026-10-03T08:46:00.000Z'
      };
      return result();
    },
    append: (id, expectedVersion, instruction: DurableInstructionInput) => {
      assertCurrent(id, expectedVersion);
      const sequence = current.instructionEntries.length + 1;
      current = {
        ...current,
        version: current.version + 1,
        instructionEntries: [
          ...current.instructionEntries,
          {
            instructionEntryId: `instruction-entry_fixture-documents-1476-${sequence}`,
            sequence,
            ...instruction
          }
        ],
        updatedAt: '2026-10-03T08:48:00.000Z'
      };
      return result();
    },
    supersede: (id, entryId, expectedVersion, instruction) => {
      assertCurrent(id, expectedVersion);
      if (!current.instructionEntries.some((entry) => entry.instructionEntryId === entryId))
        throw new PackageHttpError(
          404,
          'INSTRUCTION_ENTRY_NOT_FOUND',
          'The instruction to supersede was not found.'
        );
      const sequence = current.instructionEntries.length + 1;
      current = {
        ...current,
        version: current.version + 1,
        instructionEntries: [
          ...current.instructionEntries,
          {
            instructionEntryId: `instruction-entry_fixture-documents-1476-${sequence}`,
            sequence,
            supersedesEntryId: entryId,
            ...instruction
          }
        ],
        updatedAt: '2026-10-03T08:50:00.000Z'
      };
      return result();
    },
    ready: (id, expectedVersion) => {
      assertCurrent(id, expectedVersion);
      const missing = current.requirements.filter(
        (requirement) =>
          requirement.blocking &&
          !current.documentItems.some((item) => item.requirementKey === requirement.requirementKey)
      );
      if (missing.length || current.instructionEntries.length === 0)
        throw new PackageHttpError(
          422,
          'DOCUMENT_PACKAGE_INCOMPLETE',
          'Record every blocking document and at least one instruction before marking ready.'
        );
      current = {
        ...current,
        status: 'READY_FOR_PREPARATION_LOCK',
        version: current.version + 1,
        updatedAt: '2026-10-03T08:52:00.000Z',
        readyAt: '2026-10-03T08:52:00.000Z',
        readyBy: 'user_fixture-documents-1476',
        canonicalEvidenceHash: '3'.repeat(64)
      };
      return result();
    }
  };
}

export function packageClientForScenario(
  scenario: DocumentsInstructionsPreviewScenario
): DocumentPackageClient {
  const client = createFixturePackageClient(scenario === 'success' ? readyPackage : draftPackage);
  if (scenario === 'loading')
    return {
      ...client,
      get: () => new Promise<DurableDocumentPackageView>(() => undefined)
    };
  if (scenario === 'unauthorized')
    return {
      ...client,
      get: () => failure(401, 'SESSION_REQUIRED', 'Sign in before reading Package evidence.')
    };
  if (scenario === 'permission')
    return {
      ...client,
      get: () =>
        failure(403, 'PACKAGE_ACCESS_DENIED', 'This Workspace does not grant Package access.')
    };
  if (scenario === 'missing')
    return {
      ...client,
      get: () => failure(404, 'DOCUMENT_PACKAGE_NOT_FOUND', 'Package was not found.')
    };
  if (scenario === 'conflict')
    return {
      ...client,
      get: () =>
        failure(
          409,
          'DOCUMENT_PACKAGE_VERSION_CONFLICT',
          'The exact Package version changed. Reload before continuing.'
        )
    };
  if (scenario === 'unavailable')
    return {
      ...client,
      get: () => failure(503, 'PACKAGE_SERVICE_UNAVAILABLE', 'Package service is unavailable.')
    };
  if (scenario === 'error')
    return {
      ...client,
      get: () => failure(500, 'PACKAGE_REQUEST_FAILED', 'Package evidence could not be loaded.')
    };
  return client;
}

export function reviewClientForScenario(
  scenario: DocumentsInstructionsPreviewScenario
): ProfessionalReviewClient {
  const unsupported = () => Promise.reject(new Error('This preview Review is read only.'));
  return {
    list: () => Promise.resolve({ reviewCases: [completedReviewFixture] }),
    get: () =>
      scenario === 'review-unavailable'
        ? failure(503, 'REVIEW_SERVICE_UNAVAILABLE', 'Completed Review evidence is unavailable.')
        : Promise.resolve({ reviewCase: completedReviewFixture }),
    claim: unsupported,
    checklist: unsupported,
    complete: unsupported
  };
}

export const draftPackageFixture = clonePackage(draftPackage);
export const readyPackageFixture = clonePackage(readyPackage);
