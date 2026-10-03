import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/opportunity-center-preview.html');
});

test('shows Candidate evidence without inflating its authority', async ({ page }) => {
  await expect(page.getByRole('status').filter({ hasText: 'Preview fixture' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Opportunity Center' })).toBeVisible();
  await expect(page.getByText('Candidate is not confirmed customer demand.')).toBeVisible();
  await expect(page.getByText('Candidate status: UNDER_REVIEW')).toBeVisible();
  await expect(page.getByText('KNOWLEDGE · TRADEMARK_CONTEXT')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review Candidate details' })).toBeVisible();
});

test('records explicit human Qualification and reloads owner truth', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Review Candidate details' });
  await opener.click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Review a possible trademark monitoring service need'
    })
  ).toBeVisible();
  await expect(page.getByText('b'.repeat(64))).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source Evidence / Provenance' })).toBeVisible();
  await expect(page.getByText('No Qualification Decision recorded')).toBeVisible();

  await page.getByLabel('Qualified for MarkReg').check();
  await page
    .getByLabel('Human rationale')
    .fill('Exact fixture evidence supports later MarkReg review.');
  await page.getByRole('button', { name: 'Record human Qualification' }).click();

  await expect(page.getByText('Qualification outcome: QUALIFIED_FOR_MARKREG')).toBeVisible();
  await expect(
    page.getByText('Exact fixture evidence supports later MarkReg review.')
  ).toBeVisible();
  await expect(page.getByText('Formal Opportunity createdNo')).toBeVisible();
  await expect(page.getByText('Customer contactedNo')).toBeVisible();
  await expect(
    page.getByText(/does not contact a customer; create a Formal Opportunity/)
  ).toBeVisible();

  await page.getByRole('button', { name: '← Back to Candidate Review' }).click();
  await expect(opener).toBeFocused();
});

test('preserves evidence and rationale when Qualification conflicts', async ({ page }) => {
  await page.goto('/opportunity-center-preview.html?scenario=conflict');
  await page.getByLabel('Defer Candidate').check();
  await page.getByLabel('Human rationale').fill('Wait for exact current evidence.');
  await page.getByRole('button', { name: 'Record human Qualification' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Qualification was not recorded' })
  ).toBeVisible();
  await expect(page.getByText(/conflicted with the current Candidate version/)).toBeVisible();
  await expect(page.getByLabel('Human rationale')).toHaveValue('Wait for exact current evidence.');
  await expect(page.getByText('b'.repeat(64))).toBeVisible();
});

test('keeps loading, empty, partial, auth, permission and owner errors distinct', async ({
  page
}) => {
  await page.goto('/opportunity-center-preview.html?scenario=loading');
  await expect(page.getByText('Loading Opportunity Candidates', { exact: true })).toBeVisible();

  await page.goto('/opportunity-center-preview.html?scenario=empty');
  await expect(page.getByRole('heading', { name: 'No Opportunity Candidates' })).toBeVisible();

  await page.goto('/opportunity-center-preview.html?scenario=partial');
  await page.getByRole('button', { name: 'Load more Candidates' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'More Candidates could not be loaded' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review Candidate details' })).toBeVisible();

  await page.goto('/opportunity-center-preview.html?scenario=unauthorized');
  await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();

  await page.goto('/opportunity-center-preview.html?scenario=permission');
  await expect(page.getByRole('heading', { name: 'Candidate Review unavailable' })).toBeVisible();

  await page.goto('/opportunity-center-preview.html?scenario=detail-error');
  await expect(
    page.getByRole('heading', { name: 'Candidate Review temporarily unavailable' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  await page.goto('/opportunity-center-preview.html?scenario=error');
  await expect(
    page.getByRole('heading', { name: 'Candidate Review temporarily unavailable' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Opportunity Center' })).toBeVisible();
});

test('390px detail remains ordered and free of horizontal overflow', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-390', 'mobile-only acceptance');
  await page.goto('/opportunity-center-preview.html?view=detail');

  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
  const candidateTop = await page
    .getByRole('heading', { name: 'Candidate', exact: true })
    .evaluate((element) => element.getBoundingClientRect().top);
  const sourceTop = await page
    .getByRole('heading', { name: 'Source Evidence / Provenance' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const decisionTop = await page
    .getByRole('heading', { name: 'Qualification Decision' })
    .evaluate((element) => element.getBoundingClientRect().top);
  const actionTop = await page
    .getByRole('heading', { name: 'Record human Qualification' })
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(candidateTop).toBeLessThan(sourceTop);
  expect(sourceTop).toBeLessThan(decisionTop);
  expect(decisionTop).toBeLessThan(actionTop);
});
