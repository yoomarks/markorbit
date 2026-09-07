import { expect, test } from '@playwright/test';

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`;

test('Commerce Profile edit uses the returned fixture truth on desktop and mobile', async ({
  page
}) => {
  await page.goto(story('lite-trademark-asset-sell-side-workspace--existing-commerce-profile'));
  await expect(page.getByRole('heading', { name: 'Commerce Profile' })).toBeVisible();
  await expect(page.getByText(/seller-provided, non-binding context/i)).toBeVisible();
  await expect(page.getByText('Broker / representative')).toBeVisible();
  await expect(page.getByText(/not ownership or authority verification/i)).toBeVisible();

  await page.getByRole('button', { name: 'Edit sale context' }).click();
  const sellerRelationship = page.getByRole('combobox', { name: 'Seller relationship' });
  await expect(sellerRelationship).toHaveValue('BROKER_REPRESENTATIVE');
  await sellerRelationship.selectOption('OTHER');
  const headline = page.getByRole('textbox', { name: 'Headline' });
  await headline.fill('Unsaved browser draft');
  await page.getByRole('button', { name: 'Save sale context' }).click();

  await expect(page.getByText(/saved from server-returned state/i)).toBeVisible();
  await expect(page.getByText('Broker / representative')).toBeVisible();
  await expect(page.getByText('Established NORTH STAR brand context')).toBeVisible();
  await expect(page.getByText('Unsaved browser draft')).toHaveCount(0);
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});

test('Marketplace-added Commerce Profile is visibly read-only', async ({ page }) => {
  await page.goto(story('lite-trademark-asset-sell-side-workspace--marketplace-added-read-only'));

  await expect(page.getByRole('note')).toContainText('cannot be changed here');
  await expect(page.getByText(/remain owned by Marketplace/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /sale context/i })).toHaveCount(0);
});

test('no-profile state does not imply a Marketplace or transaction outcome', async ({ page }) => {
  await page.goto(story('lite-trademark-asset-sell-side-workspace--no-commerce-profile'));

  await expect(page.getByText('No sell-side profile has been set up.')).toBeVisible();
  await expect(page.getByText(/does not determine whether/i)).toBeVisible();
  await expect(page.getByText('Listed', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Published', { exact: true })).toHaveCount(0);
});

test('AI Guide keeps advisory output tied to exact Asset evidence without authority actions', async ({
  page
}) => {
  await page.goto(story('lite-trademark-asset-sell-side-workspace--ai-guide-prepared'));

  await expect(page.getByRole('heading', { name: 'AI Asset Guide' })).toBeVisible();
  await expect(page.getByText(/Exact Asset trademark-asset_story · version 3/)).toBeVisible();
  await expect(page.getByText('Asset context summary')).toBeVisible();
  await expect(page.getByText(/matter_story@3/).first()).toBeVisible();
  await expect(page.getByText(/AI Guide is advisory, not authority/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /execute|file|contact|pay|publish/i })).toHaveCount(
    0
  );
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});

test('AI Guide stale evidence warning remains prominent at 390px', async ({ page }) => {
  await page.goto(
    story('lite-trademark-asset-sell-side-workspace--ai-guide-stale-evidence-mobile-390')
  );

  await expect(page.getByRole('alert')).toContainText('Stale or conflicting evidence is present');
  await expect(page.getByRole('alert')).toContainText('does not resolve source conflicts');
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});

test('Contextual Guide opens one exact Trademark Asset without portfolio rediscovery', async ({
  page
}) => {
  await page.goto(story('lite-guide-contextual-ai-guide--exact-asset-context'));

  await expect(page.getByRole('heading', { name: 'NORTH STAR' })).toBeVisible();
  await expect(
    page
      .locator('p')
      .filter({ hasText: 'trademark-asset_guide-story' })
      .filter({ hasText: 'exact version 9' })
  ).toBeVisible();
  await expect(page.getByText(/exact version 9/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Back to Trademark Asset/i })).toBeVisible();
  await expect(page.getByText(/advisory, not a universal assistant authority/i)).toBeVisible();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});

test('Contextual Guide makes handoff version drift explicit at 390px', async ({ page }) => {
  await page.goto(story('lite-guide-contextual-ai-guide--version-drift-mobile-390'));

  const drift = page
    .getByRole('status')
    .filter({ hasText: 'Trademark Asset changed since Guide handoff' });
  await expect(drift).toContainText('Trademark Asset changed since Guide handoff');
  await expect(drift).toContainText('version 8');
  await expect(drift).toContainText('version 9');
  await expect(page.getByText(/exact version 9/i)).toBeVisible();
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(
    true
  );
});

test('Contextual Guide keeps explicit owner outage distinct from empty state', async ({ page }) => {
  await page.goto(story('lite-guide-contextual-ai-guide--explicit-asset-unavailable'));

  await expect(page.getByRole('heading', { name: 'AI Guide source unavailable' })).toBeVisible();
  await expect(page.getByText(/No fixture or local suggestion was substituted/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare AI guidance' })).toHaveCount(0);
});
