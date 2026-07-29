import { expect, test } from '@playwright/test';
import { applicationUrl } from './applications';

// Deterministic interception in this ordinary-E2E suite validates UI recovery presentation only.
// It is not real-runtime evidence; the isolated real-runtime spec never intercepts governed APIs.
test('MarkReg governed targets direct-load exact identity, refresh, and never mutate during recovery', async ({
  page
}) => {
  const targets = [
    [
      'consultation',
      'consultationId',
      'consultationVersion',
      'intake',
      'intakeId',
      'intake_exact',
      '1',
      'RECOMMENDATION_READY'
    ],
    [
      'recommendation-plan',
      'recommendationId',
      'recommendationVersion',
      'recommendation',
      'recommendationId',
      'recommendation_exact',
      '1',
      'FIXTURE_ONLY'
    ],
    ['quote', 'quoteId', 'quoteVersion', 'quote', 'quoteId', 'quote_exact', 'pricing-v1', 'READY'],
    [
      'customer-confirmation',
      'confirmationId',
      'confirmationVersion',
      'confirmation',
      'confirmationId',
      'confirmation_exact',
      '1',
      'CONFIRMED'
    ],
    [
      'matter-draft',
      'matterDraftId',
      'matterDraftVersion',
      'matterDraft',
      'matterDraftId',
      'matter-draft_exact',
      '1',
      'READY_FOR_PROFESSIONAL_REVIEW'
    ],
    [
      'documents',
      'professionalReviewCaseId',
      'reviewDecisionVersion',
      'reviewCase',
      'reviewCaseId',
      'professional-review_exact',
      '2026-07-29T00:00:00.000Z',
      'REVIEWED_READY_FOR_NEXT_STEP'
    ],
    [
      'preparation-lock',
      'preparationLockId',
      'preparationLockVersion',
      'preparationLock',
      'preparationLockId',
      'preparation-lock_exact',
      '1',
      'LOCKED_FOR_PREPARATION'
    ],
    [
      'filing-authorization',
      'filingAuthorizationId',
      'filingAuthorizationVersion',
      'filingAuthorization',
      'filingAuthorizationId',
      'filing-authorization_exact',
      '4',
      'AUTHORIZED'
    ]
  ] as const;
  const methods: string[] = [];
  await page.route('http://127.0.0.1:4000/**', async (route) => {
    methods.push(route.request().method());
    const target = targets.find((x) => route.request().url().includes(x[5]));
    if (!target) return route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
    const version = target[6];
    await route.fulfill({
      status: 200,
      json: {
        [target[3]]: {
          [target[4]]: target[5],
          status: target[7],
          schemaVersion: version === '1' ? 1 : undefined,
          version: Number(version) || undefined,
          pricingRuleVersion: target[0] === 'quote' ? version : undefined,
          updatedAt: target[0] === 'documents' ? version : undefined
        }
      }
    });
  });
  for (const [view, idKey, versionKey, , , id, version] of targets) {
    await page.goto(
      `${applicationUrl('markreg')}/?view=${view}&${idKey}=${id}&${versionKey}=${encodeURIComponent(version)}`
    );
    await expect(page.getByText(id)).toBeVisible();
    await page.reload();
    await expect(page.getByText(id)).toBeVisible();
  }
  expect(methods.every((x) => x === 'GET')).toBeTruthy();
  await page.goto(`${applicationUrl('markreg')}/?view=quote`);
  await expect(page.getByRole('heading', { name: /required/ })).toBeFocused();
  await page.goto(`${applicationUrl('markreg')}/?view=open-latest`);
  await expect(page.getByRole('heading', { name: /Unsupported/ })).toBeFocused();
});

test('Lite Work targets load exact detail without opening first/latest queue record', async ({
  page
}) => {
  const targets = [
    [
      'professional-review',
      'professionalReviewCaseId',
      'professionalReviewCaseVersion',
      'reviewCase',
      'reviewCaseId',
      'professional-review_exact',
      'review-v1',
      'REVIEWED_READY_FOR_NEXT_STEP'
    ],
    [
      'execution-release',
      'executionReleaseId',
      'executionReleaseVersion',
      'executionRelease',
      'executionReleaseId',
      'execution-release_exact',
      '3',
      'RELEASED_FOR_EXECUTION'
    ],
    [
      'filing-task-draft',
      'filingExecutionTaskDraftId',
      'filingExecutionTaskDraftVersion',
      'filingExecutionTaskDraft',
      'filingExecutionTaskDraftId',
      'filing-task-draft_exact',
      '1',
      'PREPARED'
    ]
  ] as const;
  const methods: string[] = [];
  await page.route('http://127.0.0.1:4000/**', async (route) => {
    methods.push(route.request().method());
    const target = targets.find((x) => route.request().url().includes(x[5]));
    if (!target) return route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
    await route.fulfill({
      status: 200,
      json: {
        [target[3]]: {
          [target[4]]: target[5],
          status: target[7],
          version: Number(target[6]) || undefined,
          updatedAt: target[0] === 'professional-review' ? target[6] : undefined,
          schemaVersion: target[0] === 'filing-task-draft' ? 1 : undefined
        }
      }
    });
  });
  for (const [view, idKey, versionKey, , , id, version] of targets) {
    await page.goto(
      `${applicationUrl('lite')}/?section=work&view=${view}&${idKey}=${id}&${versionKey}=${version}`
    );
    await expect(page.getByText(id)).toBeVisible();
    await page.reload();
    await expect(page.getByText(id)).toBeVisible();
  }
  expect(methods.every((x) => x === 'GET')).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBeTruthy();
  await page.goto(`${applicationUrl('lite')}/?section=work&view=execution-release`);
  await expect(page.getByRole('heading', { name: /required/ })).toBeFocused();
});
