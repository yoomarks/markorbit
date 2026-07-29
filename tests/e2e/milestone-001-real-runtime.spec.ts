import { expect, test } from '@playwright/test';
import { milestoneUrls } from '../../scripts/milestone-runtime.mjs';
import { MilestoneLineageRecorder } from './lineage-recorder.js';

test.describe('Milestone 001 real runtime golden path', () => {
  test('creates an exact Plan and Quote lineage through the real Gateway @real-runtime', async ({
    page
  }) => {
    const lineage = new MilestoneLineageRecorder();
    await page.goto(milestoneUrls.markregWeb);
    await page.getByRole('button', { name: 'Start consultation' }).click();
    await page.getByLabel('Applicant type').selectOption({ label: 'Company' });
    await page
      .getByLabel('Applicant name')
      .fill('Milestone 001 Golden Path Applicant With A Deliberately Long Legal Name Limited');
    await page.getByLabel('Applicant country').selectOption('GB');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Trademark type').selectOption({ label: 'Word mark' });
    await page.getByLabel('Trademark text').fill('MARKORBIT GOLDEN PATH');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Target countries (select one or more)').selectOption(['US', 'GB']);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page
      .getByLabel('Goods / services summary')
      .fill(
        'Long fixture-backed goods and services description for deterministic browser wrapping and runtime-boundary validation.'
      );
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Business context').fill('Milestone 001 fixture-only validation.');
    await page.getByLabel('Filing goal').fill('Prepare only; do not submit or contact an office.');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Submit intake' }).click();
    await expect(
      page.getByRole('heading', { name: 'Compare your protection options' })
    ).toBeVisible();

    const recommendation = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('markreg-recommendation-v1') ?? 'null')
    );
    lineage.record('plan', {
      id: recommendation.recommendation.recommendationId,
      version: recommendation.recommendation.version ?? 'fixture-v1'
    });
    await page.getByRole('button', { name: /Request quote/i }).click();
    await expect(page.getByRole('heading', { name: 'Review your fixture quote' })).toBeVisible();
    const quote = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('markreg-quote-v1') ?? 'null')
    );
    lineage.record('quote', { id: quote.quote.quoteId, version: quote.quote.pricingRuleVersion });
    expect(lineage.require('quote').id).toMatch(/^quote_/);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Review your fixture quote' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
    await expect(page.locator('body')).toContainText('not');
  });
});
