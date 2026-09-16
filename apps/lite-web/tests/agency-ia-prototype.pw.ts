import { expect, test } from '@playwright/test';

const story =
  '/iframe.html?id=prototypes-agency-task-language-ia--today-morning-triage&viewMode=story';

test('agency morning triage stays in professional task language', async ({ page }) => {
  await page.goto(story);

  await expect(page.getByRole('heading', { name: 'Needs your attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3 emails need attention' })).toBeVisible();

  await page.getByRole('button', { name: 'Review in Inbox' }).click();
  await expect(
    page.getByRole('heading', { name: /USPTO status and specimen question/ })
  ).toBeVisible();
  await expect(page.getByText('AI suggestion')).toBeVisible();

  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.getByText('US Section 8 maintenance')).toBeVisible();

  await page.getByRole('button', { name: 'Create follow-up' }).click();
  await expect(page.getByText(/Follow-up created/)).toBeVisible();

  await page.getByRole('button', { name: 'Prepare client update' }).click();
  await expect(
    page.getByText('This is a draft. Nothing has been sent to the client or outside counsel.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Today' }).first().click();
  await page.getByRole('button', { name: 'Review change' }).click();
  await expect(page.getByRole('heading', { name: 'NORTHSTAR status change' })).toBeVisible();
  await expect(page.getByText('Response received')).toBeVisible();
  await expect(page.getByText('Response accepted').first()).toBeVisible();
  await expect(page.getByText('United States Patent and Trademark Office')).toBeVisible();
  await page.getByRole('button', { name: 'Prepare client update' }).click();
  await expect(
    page.getByText('This is a draft. Nothing has been sent to the client or outside counsel.')
  ).toBeVisible();
});

test('case approval remains visibly separate from filing', async ({ page }) => {
  await page.goto(story);
  await page.getByRole('button', { name: 'Cases' }).first().click();
  await page.getByRole('button', { name: 'NORTHSTAR' }).click();

  await expect(page.getByRole('heading', { name: 'Review evidence of use' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready to file' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve draft' }).click();
  await expect(page.getByText(/It has not been filed/)).toBeVisible();
});
