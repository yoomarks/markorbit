import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/documents-instructions-preview.html');
});

test('starts from exact completed Review evidence without implying downstream authority', async ({
  page
}) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Documents and Instructions' })
  ).toBeVisible();
  await expect(page.getByText('Completed Review — Package not started')).toBeVisible();
  await expect(page.getByText(/does not create a Preparation Lock/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Package' })).toBeEnabled();
});

test('records required evidence and append-only instructions before explicit readiness', async ({
  page
}) => {
  await page.getByRole('button', { name: 'Start Package' }).click();

  await expect(page.getByRole('heading', { name: 'Exact Package' })).toBeVisible();
  await expect(page.locator('.mo-badge').getByText('DRAFT', { exact: true })).toBeVisible();
  await expect(page.getByText(/orbit-shield-reviewed-mark.pdf/)).toBeVisible();
  await expect(page.getByText('Applicant authorization evidence')).toBeVisible();

  await page
    .getByLabel('Structured evidence note')
    .fill('Applicant authorization verified against the completed Review.');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.getByRole('button', { name: 'Record evidence' }).click();
  await expect(page.getByText(/review-evidence.pdf/)).toBeVisible();

  await page
    .getByLabel('Structured filing instruction')
    .fill('Use the reviewed US classes 9 and 42 scope.');
  await page.getByRole('button', { name: 'Append instruction' }).click();
  await expect(page.getByText(/Use the reviewed US classes 9 and 42 scope/)).toBeVisible();

  await page
    .getByLabel('Structured filing instruction')
    .fill('Use the final reviewed US classes 9 and 42 scope.');
  await page.getByRole('button', { name: 'Supersede latest instruction' }).click();
  await expect(
    page.getByText(/Supersedes instruction-entry_fixture-documents-1476-1/)
  ).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Mark Ready for Preparation Lock' }).click();
  await expect(page.getByText('Ready for Preparation Lock — read only')).toBeVisible();
  await expect(page.getByText(/does not authorize filing/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Ready for Preparation Lock' })).toHaveCount(
    0
  );
  await expect(page).toHaveURL(/documentPackageId=document-package_fixture-documents-1476/);
});

test('keeps owner access, currentness, absence, and availability failures distinct', async ({
  page
}) => {
  const cases = [
    ['loading', 'Loading exact Document Package'],
    ['unauthorized', 'Sign in required'],
    ['permission', 'Package permission denied'],
    ['missing', 'Document Package not found'],
    ['conflict', 'Package version conflict'],
    ['review-unavailable', 'Package service unavailable'],
    ['unavailable', 'Package service unavailable'],
    ['error', 'Document Package unavailable']
  ] as const;
  for (const [scenario, expected] of cases) {
    await page.goto(`/documents-instructions-preview.html?scenario=${scenario}`);
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  }

  await page.goto('/documents-instructions-preview.html?scenario=success');
  await expect(page.getByText('Ready for Preparation Lock — read only')).toBeVisible();
  await expect(page.getByText(/3{64}/)).toBeVisible();
});

test('390px keeps exact source, documents, ledger, and action in order without overflow', async ({
  page
}) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.goto('/documents-instructions-preview.html?scenario=draft');
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const exactTop = await page
    .getByRole('heading', { name: 'Exact Package' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const documentsTop = await page
    .getByRole('heading', { name: 'Required documents' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const ledgerTop = await page
    .getByRole('heading', { name: 'Instruction Ledger' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const actionTop = await page
    .getByRole('button', { name: 'Mark Ready for Preparation Lock' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(exactTop).toBeLessThan(documentsTop);
  expect(documentsTop).toBeLessThan(ledgerTop);
  expect(ledgerTop).toBeLessThan(actionTop);
});
