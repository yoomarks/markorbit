import type {
  FormalMatter,
  FormalMatterListItem,
  ProfessionalReviewCase,
  ProfessionalReviewChecklistItem
} from '@markorbit/contracts';
import type {
  WorkspacePrivateCaseEvidenceReadResultV1,
  WorkspacePrivateCaseEvidenceReferenceListV1
} from '@markorbit/contracts/workspace-private-evidence';
import { MatterWorkspaceHttpError, type MatterWorkspaceClient } from '../api/matters.js';
import type { ProfessionalReviewClient } from '../api/professional-review.js';
import {
  privateEvidenceRead,
  privateEvidenceReferences
} from '../features/matters/private-case-evidence-fixtures.js';

export type MatterPreviewScenario =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'unauthorized'
  | 'permission'
  | 'error'
  | 'not-found'
  | 'evidence-empty'
  | 'partial-evidence'
  | 'stale-evidence'
  | 'review-error';

const workspaceId = privateEvidenceReferences.workspaceId;
const snapshotSha256 = '1'.repeat(64);
const readinessChecks = [
  {
    code: 'APPLICANT_IDENTITY_PRESENT' as const,
    status: 'PASS' as const,
    explanation: 'Applicant identity and address were captured in the exact Matter Draft.',
    blocking: true
  },
  {
    code: 'CLASS_SELECTION_PRESENT' as const,
    status: 'PASS' as const,
    explanation: 'Classes 9 and 42 were reviewed before Matter creation.',
    blocking: true
  },
  {
    code: 'REQUIRED_DOCUMENTS_PRESENT' as const,
    status: 'PASS' as const,
    explanation: 'Required preparation documents were present at creation.',
    blocking: true
  }
];

export const matterFixture: FormalMatter = {
  schemaVersion: 1,
  formalMatterId: privateEvidenceReferences.caseId as FormalMatter['formalMatterId'],
  workspaceId,
  kind: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 1,
  sourceCustomerConfirmationId: 'confirmation_fixture-matter-1452',
  sourceCustomerConfirmationVersion: 2,
  sourceMatterDraftId: 'matter-draft_fixture-matter-1452',
  sourceMatterDraftVersion: 4,
  sourceQuoteId: 'quote_fixture-matter-1452',
  sourceQuoteVersion: 'quote-v4',
  sourceSnapshot: {
    schemaVersion: 1,
    customerConfirmation: {
      id: 'confirmation_fixture-matter-1452',
      version: 2,
      status: 'CONFIRMED'
    },
    quote: {
      id: 'quote_fixture-matter-1452',
      version: 'quote-v4',
      currency: 'USD',
      totalMinor: 180000
    },
    matterDraft: {
      id: 'matter-draft_fixture-matter-1452',
      version: 4,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: {
        evaluatedAt: '2026-10-03T08:15:00.000Z',
        checks: readinessChecks,
        readyForProfessionalReview: true
      }
    },
    preparation: {
      applicantName: 'Orbit Shield Technologies Ltd.',
      applicantAddress: '120 Market Street, San Francisco, CA',
      trademark: 'ORBIT SHIELD',
      targetJurisdiction: 'US',
      classes: [9, 42],
      goodsServices: 'Downloadable security software and hosted monitoring services.',
      filingBasis: 'INTENT_TO_USE',
      representativeRequired: true,
      documentReferences: ['document_fixture-private-1452'],
      commercialScopeUnchanged: true
    }
  },
  snapshotSchemaVersion: 1,
  snapshotSha256,
  createdByUserId: 'user_fixture-matter-1452',
  createdAt: '2026-10-03T08:16:00.000Z',
  updatedAt: '2026-10-03T08:16:00.000Z'
};

const listItem = (matter: FormalMatter): FormalMatterListItem => ({
  formalMatterId: matter.formalMatterId,
  type: matter.kind,
  status: matter.status,
  version: matter.version,
  createdAt: matter.createdAt,
  createdBy: matter.createdByUserId,
  applicant: matter.sourceSnapshot.preparation.applicantName!,
  trademark: matter.sourceSnapshot.preparation.trademark!,
  jurisdiction: matter.sourceSnapshot.preparation.targetJurisdiction!,
  classes: matter.sourceSnapshot.preparation.classes,
  sourceMatterDraftId: matter.sourceMatterDraftId,
  sourceMatterDraftVersion: matter.sourceMatterDraftVersion,
  nextStep: 'PROFESSIONAL_REVIEW_AVAILABLE'
});

const secondaryMatter: FormalMatter = {
  ...matterFixture,
  formalMatterId: 'formal-matter_fixture-private-1453',
  sourceMatterDraftId: 'matter-draft_fixture-matter-1453',
  sourceSnapshot: {
    ...matterFixture.sourceSnapshot,
    matterDraft: {
      ...matterFixture.sourceSnapshot.matterDraft,
      id: 'matter-draft_fixture-matter-1453'
    },
    preparation: {
      ...matterFixture.sourceSnapshot.preparation,
      applicantName: 'Northstar Atlas Inc.',
      trademark: 'NORTHSTAR ATLAS',
      classes: [35]
    }
  },
  snapshotSha256: '8'.repeat(64)
};

const evidenceReferences: WorkspacePrivateCaseEvidenceReferenceListV1 = {
  ...privateEvidenceReferences,
  caseId: matterFixture.formalMatterId,
  caseVersion: matterFixture.version,
  caseSnapshotSha256: snapshotSha256,
  items: privateEvidenceReferences.items.map((item) => ({
    ...item,
    caseId: matterFixture.formalMatterId,
    caseVersion: matterFixture.version,
    caseSnapshotSha256: snapshotSha256
  }))
};

const evidenceRead: WorkspacePrivateCaseEvidenceReadResultV1 = {
  ...privateEvidenceRead,
  binding: {
    ...privateEvidenceRead.binding,
    caseId: matterFixture.formalMatterId,
    caseVersion: matterFixture.version,
    caseSnapshotSha256: snapshotSha256
  }
};

function ownerFailure(status: number, code: string, message: string): MatterWorkspaceHttpError {
  return new MatterWorkspaceHttpError(status, code, message, status >= 500);
}

export function matterClientForScenario(scenario: MatterPreviewScenario): MatterWorkspaceClient {
  let recoverableListFailure = scenario === 'error';
  return {
    list: (query) => {
      if (scenario === 'loading') return new Promise(() => undefined);
      if (scenario === 'unauthorized')
        return Promise.reject(ownerFailure(401, 'AUTHENTICATION_REQUIRED', 'Sign in is required.'));
      if (scenario === 'permission')
        return Promise.reject(
          ownerFailure(403, 'PERMISSION_DENIED', 'Current Workspace Matter access is required.')
        );
      if (recoverableListFailure) {
        recoverableListFailure = false;
        return Promise.reject(
          ownerFailure(
            503,
            'MATTER_OWNER_UNAVAILABLE',
            'MarkReg Matter data is temporarily unavailable.'
          )
        );
      }
      if (scenario === 'empty')
        return Promise.resolve({ items: [], page: 1, pageSize: 1, total: 0 });
      const candidates = [matterFixture, secondaryMatter].filter((matter) => {
        if (!query.search) return true;
        const value =
          `${matter.sourceSnapshot.preparation.trademark} ${matter.sourceSnapshot.preparation.applicantName}`.toLowerCase();
        return value.includes(query.search.toLowerCase());
      });
      const page = query.page ?? 1;
      const item = candidates[page - 1];
      return Promise.resolve({
        items: item ? [listItem(item)] : [],
        page,
        pageSize: 1,
        total: candidates.length
      });
    },
    load: (formalMatterId) => {
      if (scenario === 'not-found')
        return Promise.reject(
          ownerFailure(404, 'FORMAL_MATTER_NOT_FOUND', 'The exact Matter was not found.')
        );
      return Promise.resolve(
        formalMatterId === secondaryMatter.formalMatterId ? secondaryMatter : matterFixture
      );
    },
    startProfessionalReview: () =>
      scenario === 'review-error'
        ? Promise.reject(
            ownerFailure(
              503,
              'PROFESSIONAL_REVIEW_UNAVAILABLE',
              'Specialist review is temporarily unavailable; no review case was created.'
            )
          )
        : Promise.resolve({ reviewCaseId: reviewFixture.reviewCaseId, version: 1 }),
    listPrivateEvidence: (formalMatterId) => {
      if (formalMatterId !== matterFixture.formalMatterId)
        return Promise.resolve({ ...evidenceReferences, caseId: formalMatterId, items: [] });
      if (scenario === 'stale-evidence')
        return Promise.reject(
          ownerFailure(
            409,
            'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
            'The accepted binding no longer matches the current Matter.'
          )
        );
      if (scenario === 'evidence-empty')
        return Promise.resolve({ ...evidenceReferences, items: [] });
      return Promise.resolve(evidenceReferences);
    },
    readPrivateEvidence: () =>
      scenario === 'partial-evidence'
        ? Promise.reject(
            ownerFailure(
              503,
              'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
              'The accepted reference is current, but exact Knowledge retrieval is unavailable.'
            )
          )
        : Promise.resolve(evidenceRead)
  };
}

const reviewChecklist: ProfessionalReviewChecklistItem[] = [
  {
    code: 'SOURCE_MATTER_DRAFT_CURRENT',
    status: 'UNKNOWN',
    blocking: true,
    explanation: 'The exact current source must be reviewed.'
  },
  {
    code: 'APPLICANT_INFORMATION_REVIEWED',
    status: 'UNKNOWN',
    blocking: true,
    explanation: 'Applicant evidence awaits specialist review.'
  },
  {
    code: 'AUTHORITY_BOUNDARIES_ACKNOWLEDGED',
    status: 'UNKNOWN',
    blocking: true,
    explanation: 'Protected-action boundaries must be acknowledged.'
  }
];

const reviewFixture: ProfessionalReviewCase = {
  schemaVersion: 1,
  reviewCaseId: 'professional-review_fixture-matter-1452',
  workspaceId,
  formalMatterId: matterFixture.formalMatterId,
  sourceFormalMatterVersion: matterFixture.version,
  sourceSnapshotSha256: snapshotSha256,
  version: 1,
  source: {
    schemaVersion: 1,
    matterDraftId: matterFixture.sourceMatterDraftId,
    matterDraftVersion: String(matterFixture.sourceMatterDraftVersion),
    confirmationId: matterFixture.sourceCustomerConfirmationId,
    customerId: 'customer_fixture-matter-1452',
    status: 'READY_FOR_PROFESSIONAL_REVIEW',
    preparation: matterFixture.sourceSnapshot.preparation,
    readiness: matterFixture.sourceSnapshot.matterDraft.readiness,
    readinessTimestamp: matterFixture.sourceSnapshot.matterDraft.readiness.evaluatedAt
  },
  status: 'QUEUED',
  priority: 'HIGH',
  requestedBy: 'user_fixture-matter-1452',
  createdAt: '2026-10-03T08:18:00.000Z',
  updatedAt: '2026-10-03T08:18:00.000Z',
  assignment: { status: 'UNASSIGNED', professionalAppointed: false },
  checklist: reviewChecklist,
  evidence: []
};

export function professionalReviewFixtureClient(): ProfessionalReviewClient {
  let reviewCase = reviewFixture;
  const result = () => Promise.resolve({ reviewCase });
  return {
    list: () => Promise.resolve({ reviewCases: [reviewCase] }),
    get: () => result(),
    claim: (_id, reviewerId, expectedVersion) => {
      if (expectedVersion !== reviewCase.version)
        return Promise.reject(new Error('Review version conflict.'));
      reviewCase = {
        ...reviewCase,
        version: (reviewCase.version ?? 1) + 1,
        status: 'IN_REVIEW',
        updatedAt: '2026-10-03T08:32:00.000Z',
        assignment: {
          status: 'CLAIMED',
          claimedBy: reviewerId,
          claimedAt: '2026-10-03T08:32:00.000Z',
          professionalAppointed: false
        }
      };
      return result();
    },
    checklist: (_id, _reviewerId, updates, expectedVersion) => {
      if (expectedVersion !== reviewCase.version)
        return Promise.reject(new Error('Review version conflict.'));
      reviewCase = {
        ...reviewCase,
        version: (reviewCase.version ?? 1) + 1,
        updatedAt: '2026-10-03T08:36:00.000Z',
        checklist: updates.map((item, index) => ({
          ...reviewChecklist[index]!,
          ...item,
          reviewedAt: '2026-10-03T08:36:00.000Z'
        }))
      };
      return result();
    },
    complete: (_id, reviewerId, rationale, expectedVersion) => {
      if (expectedVersion !== reviewCase.version)
        return Promise.reject(new Error('Review version conflict.'));
      reviewCase = {
        ...reviewCase,
        version: (reviewCase.version ?? 1) + 1,
        status: 'REVIEWED_READY_FOR_NEXT_STEP',
        updatedAt: '2026-10-03T08:40:00.000Z',
        completedAt: '2026-10-03T08:40:00.000Z',
        completedBy: reviewerId,
        decision: {
          code: 'MARK_READY_FOR_NEXT_STEP',
          reviewerId,
          decidedAt: '2026-10-03T08:40:00.000Z',
          rationale,
          checklistSnapshot: reviewCase.checklist,
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
      return result();
    }
  };
}

export const previewWorkspaceId = workspaceId;
