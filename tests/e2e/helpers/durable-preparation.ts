/* eslint-disable @typescript-eslint/no-explicit-any -- Browser route fixtures model public Gateway JSON. */
import type { Page, Route } from '@playwright/test';
import { intakeDraft } from './markreg.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const at = '2026-09-04T12:00:00.000Z';
const canonicalEvidenceHash = 'a'.repeat(64);

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export async function installDurablePreparationGatewayFixture(page: Page) {
  const review = {
    schemaVersion: 1,
    reviewCaseId: 'professional-review_e2e011',
    version: 11,
    completedAt: at,
    source: {
      schemaVersion: 1,
      matterDraftId: 'matter-draft_e2e011',
      matterDraftVersion: 'matter-v11',
      confirmationId: 'confirmation_e2e011',
      customerId: 'customer_e2e011',
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      preparation: {
        applicantName: 'Northstar International Holdings',
        applicantAddress: '1 Orbit Way',
        trademark: 'NORTHSTAR ORBIT',
        targetJurisdiction: 'US',
        classes: [9, 42],
        goodsServices: `${intakeDraft.goodsServicesSummary} ${'long governed scope '.repeat(12)}`,
        filingBasis: 'INTENT_TO_USE',
        representativeRequired: false,
        documentReferences: [],
        commercialScopeUnchanged: true
      },
      readiness: { evaluatedAt: at, checks: [], readyForProfessionalReview: true },
      readinessTimestamp: at
    },
    status: 'REVIEWED_READY_FOR_NEXT_STEP',
    priority: 'NORMAL',
    requestedBy: 'customer_e2e011',
    createdAt: at,
    updatedAt: at,
    assignment: { status: 'CLAIMED', professionalAppointed: false },
    checklist: [],
    evidence: [],
    decision: {
      decision: 'READY_FOR_NEXT_STEP',
      code: 'MARK_READY_FOR_NEXT_STEP',
      reviewerId: 'reviewer_e2e011',
      decidedAt: 'decision-v11',
      rationale: 'Ready',
      checklistSnapshot: [],
      evidenceReferences: [],
      sourceMatterDraftVersion: 'matter-v11',
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

  const requirement = {
    requirementKey: 'APPLICANT_IDENTITY_EVIDENCE',
    displayName: 'Applicant identity evidence',
    blocking: true
  };
  let pkg: any = {
    schemaVersion: 1,
    documentPackageId: 'document-package_e2e011',
    workspaceId,
    formalMatterId: 'formal-matter_e2e011',
    sourceFormalMatterVersion: 1,
    sourceFormalMatterHash: '1'.repeat(64),
    professionalReviewCaseId: review.reviewCaseId,
    sourceReviewVersion: review.version,
    sourceCompletedDecisionId: review.decision.decidedAt,
    sourceCompletedDecisionHash: '2'.repeat(64),
    status: 'DRAFT',
    version: 1,
    requirements: [requirement],
    draft: {},
    documentItems: [],
    instructionEntries: [],
    createdBy: 'user_e2e011',
    updatedBy: 'user_e2e011',
    createdAt: at,
    updatedAt: at
  };

  const requireVersion = async (route: Route, expectedVersion: unknown) => {
    if (expectedVersion === pkg.version) return true;
    await json(route, { code: 'VERSION_CONFLICT', message: 'Expected exact current package version.' }, 409);
    return false;
  };

  await page.route('**/api/lite/professional-review-cases/professional-review_e2e011', (route) =>
    json(route, { reviewCase: review })
  );
  await page.route('**/api/markreg/document-packages', (route) => json(route, pkg, 201));
  await page.route('**/api/markreg/document-packages/document-package_e2e011', (route) =>
    json(route, pkg)
  );
  await page.route('**/api/markreg/document-packages/document-package_e2e011/documents', async (route) => {
    const body = route.request().postDataJSON() as any;
    if (!(await requireVersion(route, body.expectedVersion))) return;
    pkg = {
      ...pkg,
      version: pkg.version + 1,
      updatedAt: at,
      updatedBy: 'user_e2e011',
      documentItems: [
        {
          documentItemId: 'document-item_e2e011',
          ...body.evidence
        }
      ]
    };
    await json(route, pkg);
  });
  await page.route('**/api/markreg/document-packages/document-package_e2e011/instructions', async (route) => {
    const body = route.request().postDataJSON() as any;
    if (!(await requireVersion(route, body.expectedVersion))) return;
    pkg = {
      ...pkg,
      version: pkg.version + 1,
      updatedAt: at,
      updatedBy: 'user_e2e011',
      instructionEntries: [
        {
          instructionEntryId: 'instruction-entry_e2e011',
          sequence: 1,
          canonicalFingerprint: '3'.repeat(64),
          ...body.instruction
        }
      ]
    };
    await json(route, pkg);
  });
  await page.route('**/api/markreg/document-packages/document-package_e2e011/mark-ready', async (route) => {
    const body = route.request().postDataJSON() as any;
    if (!(await requireVersion(route, body.expectedVersion))) return;
    if (pkg.documentItems.length === 0 || pkg.instructionEntries.length === 0) {
      await json(route, { code: 'PACKAGE_NOT_READY', message: 'Evidence and preparation instruction are required.' }, 409);
      return;
    }
    pkg = {
      ...pkg,
      version: pkg.version + 1,
      status: 'READY_FOR_PREPARATION_LOCK',
      canonicalEvidenceHash,
      readyAt: at,
      readyBy: 'user_e2e011',
      updatedAt: at
    };
    await json(route, pkg);
  });

  const lock = () => ({
    schemaVersion: 1,
    preparationLockId: 'preparation-lock_e2e011',
    workspaceId,
    version: 1,
    source: {
      documentPackageId: pkg.documentPackageId,
      documentPackageVersion: pkg.version,
      canonicalEvidenceHash,
      formalMatterId: pkg.formalMatterId,
      formalMatterVersion: pkg.sourceFormalMatterVersion,
      formalMatterHash: pkg.sourceFormalMatterHash,
      professionalReviewCaseId: pkg.professionalReviewCaseId,
      reviewVersion: pkg.sourceReviewVersion,
      completedDecisionId: pkg.sourceCompletedDecisionId,
      completedDecisionHash: pkg.sourceCompletedDecisionHash,
      instructionEntryCount: pkg.instructionEntries.length,
      instructionEntries: pkg.instructionEntries.map((entry: any) => ({
        instructionEntryId: entry.instructionEntryId,
        sequence: entry.sequence,
        canonicalFingerprint: entry.canonicalFingerprint
      })),
      instructionSetHash: '4'.repeat(64)
    },
    lockPayloadHash: '5'.repeat(64),
    createdBy: 'user_e2e011',
    createdAt: at,
    authority: {
      filingAuthorizationCreated: false,
      executionReleaseCreated: false,
      externalFilingCreated: false,
      paymentCreated: false,
      providerContacted: false,
      officialTruthCreated: false
    }
  });

  await page.route('**/api/markreg/preparation-locks', async (route) => {
    const body = route.request().postDataJSON() as any;
    if (
      body.documentPackageId !== pkg.documentPackageId ||
      body.expectedDocumentPackageVersion !== pkg.version ||
      body.expectedCanonicalEvidenceHash !== canonicalEvidenceHash
    ) {
      await json(route, { code: 'SOURCE_NOT_CURRENT', message: 'Preparation Lock source must be exact and current.' }, 409);
      return;
    }
    await json(route, lock(), 201);
  });
  await page.route('**/api/markreg/preparation-locks/preparation-lock_e2e011/validate-current', (route) =>
    json(route, lock())
  );
}