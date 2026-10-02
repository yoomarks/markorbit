import { expect, test, type Page } from '@playwright/test';

const workspaceId = '018f0000-0000-7000-8000-000000000501';
const otherWorkspaceId = '018f0000-0000-7000-8000-000000000601';

const entry = (id: string, name: string) => ({
  workspace: {
    workspaceId: id,
    name,
    slug: name.toLowerCase().replace(/\s+/gu, '-'),
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z'
  },
  membership: {
    membershipId: `${id.slice(0, -1)}9`,
    workspaceId: id,
    userId: '018f0000-0000-7000-8000-000000000503',
    role: 'WORKSPACE_ADMIN',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z'
  }
});

async function installAccountBoundary(page: Page) {
  let authenticated = false;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill(
      authenticated
        ? {
            json: {
              authenticated: true,
              userId: '018f0000-0000-7000-8000-000000000503',
              sessionId: '018f0000-0000-7000-8000-000000000504',
              sessionExpiresAt: '2026-10-01T00:00:00.000Z',
              csrfToken: 'lite-deep-link-csrf'
            }
          }
        : {
            status: 401,
            json: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
          }
    )
  );
  await page.route('**/api/auth/login', async (route) => {
    authenticated = true;
    await route.fulfill({
      json: {
        authenticated: true,
        userId: '018f0000-0000-7000-8000-000000000503',
        sessionId: '018f0000-0000-7000-8000-000000000504',
        sessionExpiresAt: '2026-10-01T00:00:00.000Z',
        csrfToken: 'lite-deep-link-csrf',
        account: {
          userId: '018f0000-0000-7000-8000-000000000503',
          email: 'professional@example.com',
          displayName: 'Professional',
          accountType: 'PROFESSIONAL'
        }
      }
    });
  });
  await page.route('**/api/workspaces', (route) =>
    route.fulfill({
      json: {
        workspaces: [
          entry(workspaceId, 'Professional Practice'),
          entry(otherWorkspaceId, 'International Team')
        ]
      }
    })
  );
}

async function signInAndChooseWorkspace(page: Page) {
  await expect(page.getByRole('heading', { name: 'Sign in to Lite' })).toBeVisible();
  await page.getByLabel('Work email').fill('professional@example.com');
  await page.getByLabel('Password').fill('secure professional password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Choose your workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Professional Practice' }).click();
}

test('production Work deep link authenticates before restoring the exact record and version', async ({
  page
}, testInfo) => {
  await installAccountBoundary(page);
  let protectedDetailReads = 0;
  await page.route('**/api/lite/professional-review-cases/professional-review_exact', (route) => {
    protectedDetailReads += 1;
    return route.fulfill({
      json: {
        reviewCase: {
          reviewCaseId: 'professional-review_exact',
          status: 'REVIEWED_READY_FOR_NEXT_STEP',
          updatedAt: 'review-v1'
        }
      }
    });
  });
  const original =
    '/?section=work&view=professional-review&workspaceId=workspace-untrusted&professionalReviewCaseId=professional-review_exact&professionalReviewCaseVersion=review-v1';

  await page.goto(original);
  await expect(page.getByRole('heading', { name: 'Sign in to Lite' })).toBeVisible();
  expect(protectedDetailReads).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath('governed-deep-link-sign-in.png'),
    fullPage: true
  });

  await signInAndChooseWorkspace(page);
  await expect(page.getByText('professional-review_exact', { exact: true })).toBeVisible();
  await expect(page.getByText('review-v1', { exact: true })).toHaveCount(2);
  expect(protectedDetailReads).toBe(1);
  const restored = new URL(page.url());
  expect(restored.searchParams.get('workspaceId')).toBe(workspaceId);
  expect(restored.searchParams.get('professionalReviewCaseId')).toBe('professional-review_exact');
  expect(restored.searchParams.get('professionalReviewCaseVersion')).toBe('review-v1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath('governed-deep-link-restored.png'),
    fullPage: true
  });
});

test('production Document Package deep link waits for authentication and Workspace selection', async ({
  page
}, testInfo) => {
  await installAccountBoundary(page);
  let protectedDetailReads = 0;
  await page.route(
    'http://127.0.0.1:4000/api/markreg/document-packages/document-package_exact',
    (route) => {
      protectedDetailReads += 1;
      expect(route.request().headers()['x-markorbit-workspace-id']).toBe(workspaceId);
      return route.fulfill({
        json: {
          documentPackageId: 'document-package_exact',
          workspaceId,
          formalMatterId: 'formal-matter_exact',
          sourceFormalMatterVersion: 2,
          sourceFormalMatterHash: 'a'.repeat(64),
          professionalReviewCaseId: 'professional-review_exact',
          sourceReviewVersion: 6,
          sourceCompletedDecisionId: 'decision_exact',
          sourceCompletedDecisionHash: 'b'.repeat(64),
          status: 'READY_FOR_PREPARATION_LOCK',
          version: 8,
          schemaVersion: 1,
          requirements: [],
          draft: {},
          documentItems: [],
          instructionEntries: [],
          createdBy: 'user_exact',
          updatedBy: 'user_exact',
          createdAt: '2026-09-30T00:00:00.000Z',
          updatedAt: '2026-09-30T00:01:00.000Z',
          readyAt: '2026-09-30T00:01:00.000Z',
          readyBy: 'user_exact',
          canonicalEvidenceHash: 'c'.repeat(64)
        }
      });
    }
  );

  await page.goto('/?documentPackageId=document-package_exact');
  await expect(page.getByRole('heading', { name: 'Sign in to Lite' })).toBeVisible();
  expect(protectedDetailReads).toBe(0);

  await signInAndChooseWorkspace(page);
  await expect(page.getByText('document-package_exact', { exact: true })).toBeVisible();
  await expect(page.getByText('8', { exact: true })).toBeVisible();
  expect(protectedDetailReads).toBe(1);
  const restored = new URL(page.url());
  expect(restored.searchParams.get('workspaceId')).toBe(workspaceId);
  expect(restored.searchParams.get('documentPackageId')).toBe('document-package_exact');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath('document-package-deep-link-restored.png'),
    fullPage: true
  });
});
