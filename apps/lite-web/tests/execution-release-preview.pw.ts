import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/execution-release-preview.html');
});

test('triages recorded evidence and records one internal task receipt', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Release review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review exact evidence' })).toHaveCount(3);
  await page.getByLabel('Status').selectOption('BLOCKED');
  await expect(page.getByRole('button', { name: 'Review exact evidence' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Review exact evidence' }).click();

  await expect(
    page.getByText('preparation-lock_fixture-1478 · 1:', { exact: false })
  ).toBeVisible();
  await expect(page.getByText('Needs review')).toBeVisible();
  const release = page.getByRole('button', { name: 'Release for internal execution' });
  await expect(release).toBeDisabled();
  await page.getByRole('button', { name: 'Evaluate current evidence' }).click();
  await expect(page.getByText('8 / 8')).toBeVisible();
  await page.getByRole('button', { name: 'Assign to me' }).click();
  await expect(page.getByText('user_fixture-riley-operator')).toBeVisible();
  await page
    .getByLabel('Internal release rationale')
    .fill('All blocking owner evidence passes and the exact scope is unchanged.');
  await expect(release).toBeEnabled();
  await release.click();

  await expect(
    page.getByText('Released for execution — no external filing performed')
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Filing Execution Task Draft' })).toBeVisible();
  await expect(page.getByText('filing-task-draft_fixture-1480')).toBeVisible();
  await expect(page.getByLabel('External actions not performed').getByText('No')).toHaveCount(13);
  await expect(page.getByRole('button', { name: /submit application/i })).toHaveCount(0);
  await expect(page).toHaveURL(/scenario=released/);
});

test('keeps permission, conflict, validation and owner-load failures distinct', async ({
  page
}) => {
  const passive = [
    ['loading', 'Loading exact release evidence'],
    ['unauthorized', 'Sign in required'],
    ['missing', 'Release review not found'],
    ['unavailable', 'Execution governance unavailable'],
    ['error', 'Release review unavailable']
  ] as const;
  for (const [scenario, expected] of passive) {
    await page.goto(`/execution-release-preview.html?scenario=${scenario}`);
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  }

  await page.goto('/execution-release-preview.html?scenario=permission');
  await page.getByRole('button', { name: 'Review exact evidence' }).click();
  await page.getByRole('button', { name: 'Evaluate current evidence' }).click();
  await expect(page.getByText('Release review permission denied')).toBeVisible();

  await page.goto('/execution-release-preview.html?scenario=conflict');
  await page.getByRole('button', { name: 'Review exact evidence' }).click();
  await page.getByRole('button', { name: 'Evaluate current evidence' }).click();
  await expect(page.getByText('Release evidence changed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Release for internal execution' })).toHaveCount(0);

  await page.goto('/execution-release-preview.html?scenario=validation');
  await page.getByRole('button', { name: 'Review exact evidence' }).click();
  await page.getByRole('button', { name: 'Evaluate current evidence' }).click();
  await page.getByRole('button', { name: 'Assign to me' }).click();
  await page.getByLabel('Internal release rationale').fill('Invalid fixture rationale.');
  await page.getByRole('button', { name: 'Release for internal execution' }).click();
  await expect(page.getByText('Release decision is incomplete')).toBeVisible();
});

test('preserves empty, partial and terminal owner states', async ({ page }) => {
  await page.goto('/execution-release-preview.html?scenario=empty');
  await expect(page.getByText('No matching release reviews')).toBeVisible();

  await page.goto('/execution-release-preview.html?scenario=partial');
  await page.getByRole('button', { name: 'Review exact evidence' }).click();
  await expect(
    page.getByText('No evidence references are recorded. Release remains blocked.')
  ).toBeVisible();

  for (const scenario of ['stale', 'withdrawn'] as const) {
    await page.goto(`/execution-release-preview.html?scenario=${scenario}`);
    await page.getByLabel('Status').selectOption('ALL');
    await page.getByRole('button', { name: 'Review exact evidence' }).click();
    await expect(page.getByText(/decision controls unavailable/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Evaluate current evidence' })).toHaveCount(0);
  }

  await page.goto('/execution-release-preview.html?scenario=released');
  await page.getByRole('button', { name: 'Review exact evidence' }).click();
  await expect(page.getByRole('heading', { name: 'Filing Execution Task Draft' })).toBeVisible();
});

test('390px preserves lineage, checks, decision and receipt order without overflow', async ({
  page
}) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.getByLabel('Status').selectOption('BLOCKED');
  await page.getByRole('button', { name: 'Review exact evidence' }).click();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const top = async (name: string) =>
    page.getByRole('heading', { name }).evaluate((element) => element.getBoundingClientRect().top);
  const lineageTop = await top('Governed lineage');
  const checksTop = await top('Release checks');
  const decisionTop = await top('Internal release decision');
  expect(lineageTop).toBeLessThan(checksTop);
  expect(checksTop).toBeLessThan(decisionTop);
});
