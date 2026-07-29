import { expect, test, type Page } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';
const at = '2026-07-29T12:00:00.000Z';
const consequences = {
  orderCreated: false,
  paymentCreated: false,
  invoiceCreated: false,
  formalMatterCreated: false,
  professionalAppointed: false,
  providerAssignedExternally: false,
  filingCreated: false,
  filingSubmitted: false,
  officialApplicationCreated: false,
  officialApplicationNumberReceived: false,
  customerMessageSent: false,
  externalDocumentSent: false,
  trademarkOfficeContacted: false
};
const lock = {
  schemaVersion: 1,
  preparationLockId: 'preparation-lock_e2e012',
  documentPackageId: 'document-package_e2e012',
  documentPackageVersion: 2,
  instructionLedgerId: 'instruction-ledger_e2e012',
  instructionLedgerVersion: 3,
  lockedAt: at,
  snapshot: {
    sourceReviewDecisionVersion: 'review-v12',
    sourceMatterDraftVersion: 'matter-v12',
    commercialScopeUnchanged: true,
    documentPackage: {
      schemaVersion: 1,
      documentPackageId: 'document-package_e2e012',
      version: 2,
      professionalReviewCaseId: 'professional-review_e2e012',
      professionalReviewDecisionVersion: 'review-v12',
      matterDraftId: 'matter-draft_e2e012',
      matterDraftVersion: 'matter-v12',
      customerConfirmationId: 'confirmation_e2e012',
      customerId: 'customer_e2e012',
      jurisdiction: 'GB',
      trademarkReference: 'MARKORBIT',
      requirements: [],
      documentItems: [],
      validationChecks: [],
      missingRequirements: [],
      status: 'LOCKED_FOR_PREPARATION',
      createdAt: at,
      updatedAt: at,
      lockedAt: at
    },
    instructionLedger: {
      schemaVersion: 1,
      instructionLedgerId: 'instruction-ledger_e2e012',
      version: 3,
      documentPackageId: 'document-package_e2e012',
      documentPackageVersion: 2,
      customerId: 'customer_e2e012',
      matterDraftId: 'matter-draft_e2e012',
      matterDraftVersion: 'matter-v12',
      professionalReviewCaseId: 'professional-review_e2e012',
      professionalReviewDecisionVersion: 'review-v12',
      entries: [],
      acknowledgements: [],
      status: 'LOCKED_FOR_PREPARATION',
      currentEffectiveInstructionSet: {},
      createdAt: at,
      updatedAt: at,
      lockedAt: at
    }
  },
  nextPermittedAction: 'GOVERNED_FILING_AUTHORITY_REVIEW',
  consequences
};
const scope = {
  jurisdiction: 'GB',
  applicantOwnerReference: 'MarkOrbit Labs Ltd',
  trademarkReference: 'MARKORBIT',
  classes: ['9', '35', '42'],
  goodsServices: [
    'A deliberately long immutable governed software and business administration description that wraps safely at 390 pixels without hiding any protected action warning.'
  ],
  filingBasis: 'INTENT_TO_USE',
  useLockedDocuments: true,
  representativeUse: 'NOT_REQUIRED',
  permittedFilingChannel: 'OFFICE_PORTAL',
  permittedExecutionWindow: { startsAt: at, endsAt: '2026-08-29T12:00:00.000Z' }
};
let authorization = {
  schemaVersion: 1,
  version: 1,
  filingAuthorizationId: 'filing-authorization_e2e012',
  preparationLockId: lock.preparationLockId,
  preparationLockVersion: `2:3:${at}`,
  preparationSnapshot: lock.snapshot,
  professionalReviewCaseId: 'professional-review_e2e012',
  professionalReviewVersion: 'review-v12',
  customerId: 'customer_e2e012',
  authorizedParty: { partyId: 'customer_e2e012', displayName: 'Alex Owner' },
  authorizationCapacity: 'OWNER',
  jurisdiction: 'GB',
  applicantOwnerReference: 'MarkOrbit Labs Ltd',
  trademarkReference: 'MARKORBIT',
  classes: scope.classes,
  goodsServices: scope.goodsServices,
  filingBasis: 'INTENT_TO_USE',
  representativeRequirement: 'NOT_REQUIRED',
  scope,
  termsVersion: 'filing-authorization-terms-v1',
  acknowledgements: [],
  evidence: [],
  status: 'PENDING_CONFIRMATION',
  createdAt: at,
  updatedAt: at
};
let release = {
  schemaVersion: 1,
  version: 1,
  executionReleaseId: 'execution-release_e2e012',
  filingAuthorizationId: authorization.filingAuthorizationId,
  filingAuthorizationVersion: 2,
  preparationLockId: lock.preparationLockId,
  preparationLockVersion: `2:3:${at}`,
  professionalReviewCaseId: 'professional-review_e2e012',
  professionalReviewVersion: 'review-v12',
  customerId: 'customer_e2e012',
  jurisdiction: 'GB',
  requestedExecutionChannel: 'OFFICE_PORTAL',
  checks: [
    {
      code: 'COMMERCIAL_SCOPE_UNCHANGED',
      status: 'UNKNOWN',
      blocking: true,
      explanation: 'Fixture-backed evidence must be evaluated.',
      source: 'EXECUTION_RELEASE_POLICY_V1',
      checkedAt: at
    }
  ],
  assignment: {},
  evidence: [],
  status: 'BLOCKED',
  createdAt: at,
  updatedAt: at
};
async function install(page: Page) {
  await page.route('**/api/markreg/preparation-locks/**', (r) => r.fulfill({ json: lock }));
  await page.route('**/api/execution/filing-authorizations', (r) =>
    r.fulfill({ json: { filingAuthorization: authorization, consequences } })
  );
  await page.route('**/api/execution/filing-authorizations/*/confirm', (r) => {
    authorization = {
      ...authorization,
      version: 2,
      status: 'AUTHORIZED',
      authorizedAt: at,
      acknowledgements: []
    };
    return r.fulfill({ json: { filingAuthorization: authorization, consequences } });
  });
  await page.route('**/api/execution/execution-releases', (r) =>
    r.fulfill({ json: { executionReleases: [release], consequences } })
  );
  await page.route(/\/api\/execution\/execution-releases\/execution-release_e2e012$/, (r) =>
    r.fulfill({ json: { executionRelease: release, consequences } })
  );
  await page.route('**/api/execution/execution-releases/*/release', (r) => {
    release = { ...release, status: 'RELEASED_FOR_EXECUTION', version: 2, releasedAt: at };
    return r.fulfill({
      json: {
        releaseResult: {
          release,
          taskDraft: {
            schemaVersion: 1,
            filingExecutionTaskDraftId: 'filing-task-draft_e2e012',
            executionReleaseId: release.executionReleaseId,
            filingAuthorizationId: authorization.filingAuthorizationId,
            preparationLockId: lock.preparationLockId,
            executionSnapshot: scope,
            jurisdiction: 'GB',
            applicant: 'MarkOrbit Labs Ltd',
            trademark: 'MARKORBIT',
            classes: scope.classes,
            goodsServices: scope.goodsServices,
            filingBasis: 'INTENT_TO_USE',
            documentReferences: [],
            instructionReferences: [],
            representativeRequirement: 'NOT_REQUIRED',
            executionChannel: 'OFFICE_PORTAL',
            internalAssigneeReference: 'executor_fixture',
            status: 'PREPARED',
            createdAt: at
          }
        },
        consequences
      }
    });
  });
  await page.route('**/api/execution/execution-releases/*/assignment', (r) => {
    release = {
      ...release,
      assignment: { internalExecutorId: 'executor_fixture', assignedAt: at }
    };
    return r.fulfill({ json: { executionRelease: release, consequences } });
  });
  await page.route('**/api/execution/execution-releases/*/evaluate', (r) => {
    release = {
      ...release,
      status: 'READY_FOR_RELEASE',
      checks: release.checks.map((c) => ({ ...c, status: 'PASS' }))
    };
    return r.fulfill({ json: { executionRelease: release, consequences } });
  });
}
test('Preparation Lock to authorized internal task draft remains non-executing @visual', async ({
  page
}, testInfo) => {
  const healthy = watchPage(page);
  authorization = {
    ...authorization,
    version: 1,
    status: 'PENDING_CONFIRMATION',
    authorizedAt: undefined
  };
  release = {
    ...release,
    status: 'BLOCKED',
    checks: release.checks.map((c) => ({ ...c, status: 'UNKNOWN' })),
    assignment: {}
  };
  await install(page);
  await page.goto(`${urls.markreg}?preparationLockId=${lock.preparationLockId}`);
  await expect(page.getByText(lock.preparationLockId, { exact: false }).first()).toBeVisible();
  const checks = page.getByRole('checkbox');
  await expect(checks).toHaveCount(9);
  for (const check of await checks.all()) await expect(check).not.toBeChecked();
  const confirm = page.getByRole('button', { name: 'Confirm Filing Authorization' });
  await expect(confirm).toBeDisabled();
  for (const check of await checks.all()) await check.click();
  await expect(confirm).toBeEnabled();
  await expectVisibleFocus(page);
  await capture(page, `markreg-authorization-acknowledgements-${testInfo.project.name}`);
  await confirm.click();
  await expect(
    page.getByText('Authorized for internal execution review — not submitted')
  ).toBeVisible();
  await capture(page, `markreg-authorization-receipt-${testInfo.project.name}`);
  await expectNoHorizontalOverflow(page);
  await page.goto(`${urls.lite}#work-execution-release`);
  await page.getByRole('button', { name: 'Execution Release' }).click();
  await page.getByLabel('Status').selectOption('BLOCKED');
  const open = page.getByRole('button', { name: 'Open release' });
  await open.click();
  await expect(page.getByText(/COMMERCIAL_SCOPE_UNCHANGED.*UNKNOWN/)).toBeVisible();
  await expect(page.getByText(lock.preparationLockId, { exact: false })).toBeVisible();
  await capture(page, `lite-blocked-release-${testInfo.project.name}`);
  await page.getByRole('button', { name: 'Evaluate release' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'COMMERCIAL_SCOPE_UNCHANGED' })
  ).toContainText('PASS');
  await page.getByRole('button', { name: 'Assign internal executor' }).click();
  await expect(page.getByText('executor_fixture')).toBeVisible();
  await page.getByLabel('Internal release rationale').fill('All governed evidence passed.');
  await page.getByRole('button', { name: 'Release for execution' }).click();
  await expect(
    page.getByText('Released for execution — no external filing performed')
  ).toBeVisible();
  await expect(page.getByText('filing-task-draft_e2e012')).toBeVisible();
  for (const key of Object.keys(consequences)) await expect(page.getByText(key)).toBeVisible();
  await capture(page, `lite-released-receipt-${testInfo.project.name}`);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: /Back to release queue/ }).click();
  await expect(page.getByLabel('Status')).toHaveValue('BLOCKED');
  await expect(page.getByRole('button', { name: 'Open release' })).toBeFocused();
  healthy();
});
