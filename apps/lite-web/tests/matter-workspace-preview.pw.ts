import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/matter-workspace-preview.html');
});

test('presents MarkReg-owned Formal Matters without implying protected authority', async ({
  page
}) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Matters' })).toBeVisible();
  await expect(page.getByText('Read-only operational view')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ORBIT SHIELD' })).toBeVisible();
  await expect(page.getByText('MarkReg live data')).toBeVisible();
  await expect(page.getByText(/nothing here executes a protected action/)).toBeVisible();
});

test('opens current Matter, verifies exact private evidence, and preserves lineage', async ({
  page
}) => {
  await page.getByRole('button', { name: 'View Matter details' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'ORBIT SHIELD' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current state' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Creation readiness' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exact private Case evidence' })).toBeVisible();
  await expect(page.getByText('rdp_fixture_private_1452')).toBeVisible();

  await page.getByRole('button', { name: 'Open exact source' }).click();
  await expect(page.getByText(/exact refusal basis in this private source chunk/)).toBeVisible();
  await expect(page.getByText(/Page numbers and text offsets are unavailable/)).toBeVisible();
  await expect(page.getByText('All currentness checks passed')).toBeVisible();

  await page.getByText('Exact Matter evidence and immutable lineage').click();
  await expect(page.getByText(/SHA-256 captured/)).toBeVisible();
  await page.getByRole('button', { name: '← Back to Matters' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Matters' })).toBeVisible();
});

test('continues into bounded Professional Review and records no automatic consequences', async ({
  page
}) => {
  await page.goto('/matter-workspace-preview.html?view=detail');
  await page.getByRole('button', { name: 'Start or Resume Professional Review' }).click();

  await expect(page).toHaveURL(/#work-professional-review$/);
  await expect(
    page.getByText('Professional Review Case professional-review_fixture-matter-1452')
  ).toBeVisible();
  await expect(page.getByText(/UNKNOWN never counts as PASS/)).toBeVisible();
  await page.getByRole('button', { name: 'Claim review' }).click();
  await page
    .getByLabel('Professional finding')
    .fill('Exact Matter and private source evidence reviewed.');
  await page.getByRole('button', { name: 'Save Review Draft' }).click();
  await page
    .getByLabel('Review decision rationale')
    .fill('Review is ready for the next bounded preparation step.');
  await page.getByRole('button', { name: 'Mark reviewed and ready for next step' }).click();

  await expect(page.getByText('Ready for next step — no action executed')).toBeVisible();
  await expect(page.getByText(/orderCreated: false/)).toBeVisible();
  await expect(page.getByText(/filingCreated: false/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start or resume Document Package' })).toBeVisible();
});

test('keeps owner access and availability failures distinct and recoverable', async ({ page }) => {
  await page.goto('/matter-workspace-preview.html?scenario=loading');
  await expect(page.getByText('Loading durable Matters', { exact: true })).toBeVisible();

  await page.goto('/matter-workspace-preview.html?scenario=empty');
  await expect(page.getByRole('heading', { name: 'No Matters found' })).toBeVisible();

  await page.goto('/matter-workspace-preview.html?scenario=unauthorized');
  await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();

  await page.goto('/matter-workspace-preview.html?scenario=permission');
  await expect(page.getByRole('heading', { name: 'Matter access denied' })).toBeVisible();

  await page.goto('/matter-workspace-preview.html?scenario=not-found');
  await expect(page.getByRole('heading', { name: 'Matter not found' })).toBeVisible();

  await page.goto('/matter-workspace-preview.html?scenario=error');
  await expect(page.getByRole('heading', { name: 'Matter service unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Matters' })).toBeVisible();
});

test('retains accepted evidence reference when exact retrieval is unavailable', async ({
  page
}) => {
  await page.goto('/matter-workspace-preview.html?scenario=partial-evidence');
  await expect(page.getByText('rdp_fixture_private_1452')).toBeVisible();
  await page.getByRole('button', { name: 'Open exact source' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Private evidence service unavailable' })
  ).toBeVisible();
  await expect(page.getByText('rdp_fixture_private_1452')).toBeVisible();

  await page.goto('/matter-workspace-preview.html?scenario=stale-evidence');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Private evidence is no longer current' })
  ).toBeVisible();

  await page.goto('/matter-workspace-preview.html?scenario=review-error');
  await page.getByRole('button', { name: 'Start or Resume Professional Review' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Professional Review unavailable' })
  ).toBeVisible();
  await expect(page.getByText(/no review case was created/)).toBeVisible();
});

test('390px detail preserves action, state, evidence, and lineage order without overflow', async ({
  page
}) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.goto('/matter-workspace-preview.html?view=detail');
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const actionTop = await page
    .getByRole('heading', { name: 'Review the current Matter before moving it forward' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const stateTop = await page
    .getByRole('heading', { name: 'Current state' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const evidenceTop = await page
    .getByRole('heading', { name: 'Exact private Case evidence' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(actionTop).toBeLessThan(stateTop);
  expect(stateTop).toBeLessThan(evidenceTop);
});
