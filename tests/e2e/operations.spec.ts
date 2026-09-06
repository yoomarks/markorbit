import { expect, test } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

const dataOwnerSummary = {
  contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
  engine_version: 'M1.9',
  source_owner: 'MARKORBIT_DATA_ENGINE',
  authority: 'DATA_ENGINE_FACT_READ_MODEL',
  read_only: true,
  generated_at: '2026-09-05T08:30:00+00:00',
  health: { status: 'degraded' },
  operations: {
    version: 'MARKORBIT_OPERATIONS_V2',
    action_authority:
      'ADVISORY_ONLY_EXISTING_DOMAIN_GATES_AND_CHECKPOINT_VALIDATORS_REMAIN_AUTHORITATIVE',
    summary: {
      operation_count: 7,
      state_counts: { RUNNING: 1, BLOCKED: 2 },
      resume_candidates: 1,
      retry_candidates: 1,
      operator_required: 2,
      partial_state_preservation_required: 3
    }
  },
  domain_progress: {
    version: 'MARKORBIT_ADMIN_PROGRESS_V2',
    active_count: 1
  }
};

test('MO Control Center exposes truthful governed operator surfaces @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  let dataOwnerReads = 0;
  await page.route('**/api/internal/control-plane/data/summary', async (route) => {
    dataOwnerReads += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dataOwnerSummary)
    });
  });
  await page.goto(urls.operations);
  await expect(page.getByText('Internal only')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Control center overview' })).toBeVisible();
  for (const heading of [
    'Connected governed surfaces',
    'Aggregate platform health',
    'Cognitive platform',
    'Specialist administration'
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Data', exact: true })).toBeVisible();
  await expect(
    page.getByText('No Data Engine owner summary loaded. Load owner summary to determine current owner state.')
  ).toBeVisible();
  const loadOwnerSummary = page.getByRole('button', { name: 'Load owner summary' });
  await expect(loadOwnerSummary).toBeVisible();
  expect(dataOwnerReads).toBe(0);
  await loadOwnerSummary.click();
  await expect(page.getByText('Data Engine owner-reported dependency health')).toBeVisible();
  expect(dataOwnerReads).toBe(1);
  await expect(page.getByRole('heading', { name: 'Commercial operations' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Data' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commercial' })).toBeVisible();
  for (const staleHeading of [
    'Service health',
    'Failed operations',
    'Manual review',
    'Event summary'
  ]) {
    await expect(page.getByRole('heading', { name: staleHeading })).toHaveCount(0);
  }
  await expect(page.getByText('1,248')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectVisibleFocus(page);
  if (testInfo.project.name.startsWith('desktop')) {
    await capture(page, 'operations-console-desktop');
  }
  assertHealthy();
});