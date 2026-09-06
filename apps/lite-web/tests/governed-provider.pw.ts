import { expect, test } from '@playwright/test';
import {
  governedAllocationFixture,
  governedDiscoveryFixture,
  governedEligibilityFixture,
  governedFixtureWorkspaceId,
  governedHandoffFixture,
  governedHandoffValidationFixture,
  governedPreparationFixture,
  governedSelectionFixture,
  governedServicePackageFixture
} from '../src/features/opportunities/governed-action-fixtures.js';

test('human completes Candidate → Selection → Handoff → governed Allocation without authority spoofing', async ({
  page
}, testInfo) => {
  const mutations: Array<{
    path: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }> = [];

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-governed-browser-843' } })
  );

  await page.route('**/api/mgsn/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const body =
      request.method() === 'POST' ? (request.postDataJSON() as Record<string, unknown>) : {};
    if (request.method() === 'POST') mutations.push({ path, headers: request.headers(), body });

    if (path === `/api/mgsn/service-packages/${governedServicePackageFixture.servicePackageId}`)
      return route.fulfill({ json: { servicePackage: governedServicePackageFixture } });
    if (path === '/api/mgsn/governed-network/discovery/evaluate')
      return route.fulfill({ json: { providerDiscovery: governedDiscoveryFixture } });
    if (path === '/api/mgsn/governed-network/selections')
      return route.fulfill({ status: 201, json: { providerSelection: governedSelectionFixture } });
    if (path === '/api/mgsn/governed-network/handoffs/prepare')
      return route.fulfill({ json: { controlledHandoffPreparation: governedPreparationFixture } });
    if (path === '/api/mgsn/governed-network/handoffs')
      return route.fulfill({ status: 201, json: { controlledHandoff: governedHandoffFixture } });
    if (
      path ===
      `/api/mgsn/governed-network/handoffs/${governedHandoffFixture.envelope.controlledHandoffId}/validate-current`
    )
      return route.fulfill({
        json: { controlledHandoffValidation: governedHandoffValidationFixture }
      });
    if (
      path ===
      `/api/mgsn/service-packages/${governedServicePackageFixture.servicePackageId}/evaluate-provider`
    )
      return route.fulfill({
        status: 201,
        json: { eligibilityEvaluation: governedEligibilityFixture }
      });
    if (path === '/api/mgsn/governed-network/allocations')
      return route.fulfill({
        status: 201,
        json: { governedAllocation: governedAllocationFixture }
      });
    return route.fulfill({ status: 404, json: { code: 'UNEXPECTED_BROWSER_ROUTE' } });
  });

  await page.goto(
    `/?workspaceId=${governedFixtureWorkspaceId}&servicePackageId=${governedServicePackageFixture.servicePackageId}#opportunities-provider`
  );

  await expect(page.getByRole('heading', { name: 'Provider Progression' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Northstar Trademark Services' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orbit Counsel Network' })).toBeVisible();
  expect(mutations.filter((item) => item.path.endsWith('/selections'))).toHaveLength(0);

  await page.getByRole('button', { name: 'Review this Candidate' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Choose Northstar Trademark Services' })
  ).toBeVisible();
  expect(mutations.filter((item) => item.path.endsWith('/selections'))).toHaveLength(0);

  await page
    .getByRole('textbox', { name: 'Why this Candidate fits the reviewed need' })
    .fill('Reviewed current evidence, currentness cues, and limitations.');
  await page.getByRole('button', { name: 'Record human Selection' }).click();

  await expect(
    page.getByRole('heading', { name: 'Review exactly what will be disclosed' })
  ).toBeVisible();
  await expect(page.getByText('END_CLIENT_RELATIONSHIP_INFORMATION')).toBeVisible();
  const authorize = page.getByRole('button', { name: 'Authorize controlled Handoff' });
  await expect(authorize).toBeDisabled();
  await page.getByRole('checkbox').check();
  await authorize.click();

  await expect(page.getByRole('heading', { name: 'Exact Handoff is current' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare governed Allocation review' }).click();
  await expect(
    page.getByRole('heading', { name: 'Confirm internal provider routing' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirm governed Allocation' }).click();
  await expect(page.getByText(/Entered governed collaboration/)).toBeVisible();
  await expect(page.getByText(/Provider Acceptance remains separate/)).toBeVisible();

  expect(mutations.some((item) => item.path === '/api/mgsn/allocations')).toBe(false);
  expect(mutations.some((item) => item.path === '/api/mgsn/governed-network/allocations')).toBe(
    true
  );
  expect(
    mutations.every(
      ({ headers }) =>
        !headers['x-markorbit-internal-authorization'] &&
        !headers['x-markorbit-principal'] &&
        !headers['x-markorbit-governed-network-human-action']
    )
  ).toBe(true);

  const selection = mutations.find((item) => item.path.endsWith('/governed-network/selections'));
  expect(selection?.headers['x-markorbit-workspace-id']).toBe(governedFixtureWorkspaceId);
  expect(selection?.headers['x-markorbit-csrf-token']).toBe('csrf-governed-browser-843');
  expect(selection?.headers['idempotency-key']).toBeTruthy();
  expect(selection?.body).not.toHaveProperty('workspaceId');
  expect(selection?.body).not.toHaveProperty('actorId');
  expect(selection?.body).not.toHaveProperty('trustedHumanAuthority');

  const handoff = mutations.find((item) => item.path === '/api/mgsn/governed-network/handoffs');
  expect(handoff?.body).not.toHaveProperty('workspaceId');
  expect(handoff?.body).not.toHaveProperty('trustedHumanAuthority');
  expect(handoff?.body).toHaveProperty(
    'privacyPreviewAcknowledgement.previewFingerprintSha256',
    'a'.repeat(64)
  );

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: testInfo.outputPath('governed-provider-success.png'),
    fullPage: true
  });
});

test('503 Discovery authority is not rendered as an empty or positive state', async ({ page }) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-governed-browser-843' } })
  );
  await page.route('**/api/mgsn/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/mgsn/service-packages/${governedServicePackageFixture.servicePackageId}`)
      return route.fulfill({ json: { servicePackage: governedServicePackageFixture } });
    if (path === '/api/mgsn/governed-network/discovery/evaluate')
      return route.fulfill({
        json: {
          providerDiscovery: {
            ...governedDiscoveryFixture,
            status: 'AUTHORITY_UNAVAILABLE',
            candidates: [],
            authorityState: 'UNAVAILABLE',
            publicMessage:
              'Provider discovery is unavailable until current authority can be verified.'
          }
        }
      });
    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto(
    `/?workspaceId=${governedFixtureWorkspaceId}&servicePackageId=${governedServicePackageFixture.servicePackageId}#opportunities-provider`
  );
  await expect(
    page.getByRole('heading', { name: 'Current authority cannot be verified' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No authorized Provider Candidates' })
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Record human Selection' })).toHaveCount(0);
});
