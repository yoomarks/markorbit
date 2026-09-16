import { expect, test, type Page, type TestInfo } from '@playwright/test';

const sourcesStory = (name: string) =>
  `/iframe.html?id=patterns-prototype-sources-and-history-disclosure--${name}&viewMode=story`;

async function expectContained(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await expectContained(page);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

test('Sources & history keeps trust states distinct at working and review widths', async ({
  page
}, testInfo) => {
  await page.goto(sourcesStory('normal-desktop'));
  await expect(page.getByRole('heading', { name: 'Recorded information' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What this may mean' })).toBeVisible();
  await expect(page.locator('details')).not.toHaveAttribute('open', '');
  await capture(page, testInfo, 'sources-normal-diagnostics-closed');

  await page.goto(sourcesStory('partial-desktop'));
  await expect(page.getByRole('status')).toContainText('Some source information is unavailable');
  await expect(page.getByText('Client instruction')).toBeVisible();
  await capture(page, testInfo, 'sources-partial');

  await page.goto(sourcesStory('unavailable-desktop'));
  await expect(page.getByRole('status')).toContainText('Source information is unavailable');
  await expect(page.getByRole('heading', { name: 'Recorded information' })).toHaveCount(0);
  await capture(page, testInfo, 'sources-unavailable');

  await page.goto(sourcesStory('diagnostics-open-desktop'));
  await expect(page.locator('details')).toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: 'Diagnostics' })).toBeVisible();
  await expect(page.getByText('formal-matter_01J8NORTHSTAR')).toBeVisible();
  await capture(page, testInfo, 'sources-diagnostics-open-long-identifiers');
});

test('representative mature Lite stories contain long content without horizontal overflow', async ({
  page
}, testInfo) => {
  await page.goto('/iframe.html?id=products-lite-execution-release--long-content&viewMode=story');
  await page.getByRole('button', { name: 'Open release' }).click();
  await expect(
    page.getByText(/Current authenticated Workspace evidence still requires/)
  ).toBeVisible();
  await capture(page, testInfo, 'execution-release-long-content');
});

test('disabled and final-confirmation actions explain their safety conditions', async ({
  page
}, testInfo) => {
  await page.goto(
    '/iframe.html?id=products-lite-opportunity-center-governed-provider-progression--disabled-action-explanation&viewMode=story'
  );
  const selection = page.getByRole('button', { name: 'Record human Selection' });
  await expect(selection).toBeDisabled();
  const descriptionId = await selection.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  await expect(page.locator(`#${descriptionId!}`)).toContainText('Explain why this Candidate fits');
  await capture(page, testInfo, 'governed-selection-disabled');

  await page.goto('/iframe.html?id=products-lite-execution-release--assigned&viewMode=story');
  await page.getByRole('button', { name: 'Open release' }).click();
  const release = page.getByRole('button', { name: 'Release for execution' });
  await expect(release).toBeDisabled();
  await page.getByLabel('Internal release rationale').fill('Reviewed current release evidence.');
  await expect(release).toBeEnabled();
  await capture(page, testInfo, 'execution-release-final-confirmation-ready');
});
