import { expect, test, type Locator } from '@playwright/test';
import type { ProfessionalReviewCase } from '@markorbit/contracts';
import type {
  HistoricalTrademarkAssetPreparationReceipt,
  HistoricalTrademarkAssetTabularPreparationRequest,
  TrademarkAssetMigrationPreview
} from '../../apps/lite-web/src/api/trademark-asset-migrations.js';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';

const legacyLiteNavigation = [
  'Today',
  'Matters',
  'Content',
  'Opportunities',
  'Trademarks',
  'Work',
  'Capability',
  'Guide'
];
const workspaceShellV2Navigation = ['Today', 'Matters', 'Create', 'Portfolio', 'Work'];

async function expectWorkspaceShellRolloutNavigation(navigation: Locator) {
  const labels = await navigation.getByRole('link').allTextContents();
  expect(labels).toEqual(
    labels.includes('Create') ? workspaceShellV2Navigation : legacyLiteNavigation
  );
}

test('Lite shell provides its fixed semantic navigation and responsive fixture workspace @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(urls.lite + '#work-customers');
  await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary' });
  await expect(navigation).toBeVisible();
  await expectWorkspaceShellRolloutNavigation(navigation);
  await expect(page.getByRole('alert')).toContainText('Demonstration only');
  await expectNoHorizontalOverflow(page);
  await expectVisibleFocus(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `lite-today-${viewport}`);
  assertHealthy();
});

test('Lite filters survive customer detail navigation', async ({ page }) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.lite}#work-customers`);
  await page.getByLabel('Search customers').fill('Northwind');
  await page.getByLabel('Customer status').selectOption('Active');
  await page.getByLabel('Country / region').selectOption('US');
  const customerAction = page.getByRole('button', { name: /View customer (details|preview)/ });
  await expect(customerAction).toHaveCount(1);
  const customerActionName = (await customerAction.textContent())?.trim();
  if (!customerActionName) throw new Error('Expected a customer fixture action label.');
  expect(['View customer details', 'View customer preview']).toContain(customerActionName);
  await customerAction.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Northwind Outdoor' })).toBeVisible();
  await expect(page.getByText('Customer Record ≠ Verified Legal Identity')).toBeVisible();
  await page.getByRole('button', { name: 'Back to customers' }).click();
  await expect(page.getByRole('button', { name: customerActionName })).toBeFocused();
  await expect(page.getByLabel('Search customers')).toHaveValue('Northwind');
  await expect(page.getByLabel('Customer status')).toHaveValue('Active');
  await assertHealthy();
});

test('Lite governed professional review preserves filters, focus, and authority boundaries @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  const at = '2026-07-28T15:40:00.000Z';
  let review: ProfessionalReviewCase = {
    schemaVersion: 1,
    reviewCaseId: 'professional-review_visual',
    source: {
      schemaVersion: 1,
      matterDraftId: 'matter-draft_visual',
      matterDraftVersion: at,
      confirmationId: 'confirmation_visual',
      customerId: 'customer_visual',
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      preparation: {
        classes: [9],
        documentReferences: [],
        trademark: 'VISUAL MARK',
        targetJurisdiction: 'EU',
        goodsServices: 'Visual fixture goods'
      },
      readiness: { evaluatedAt: at, readyForProfessionalReview: true, checks: [] },
      readinessTimestamp: at
    },
    status: 'REVIEWED_READY_FOR_NEXT_STEP',
    priority: 'NORMAL',
    requestedBy: 'actor_visual',
    createdAt: at,
    updatedAt: at,
    assignment: {
      status: 'CLAIMED',
      claimedBy: 'reviewer_milestone',
      claimedAt: at,
      assignedReviewerId: 'reviewer_milestone',
      assignedAt: at,
      professionalAppointed: false
    },
    checklist: [
      {
        code: 'SOURCE_MATTER_DRAFT_CURRENT',
        status: 'PASS',
        blocking: true,
        explanation: 'Review required.'
      }
    ],
    evidence: [],
    decision: {
      code: 'MARK_READY_FOR_NEXT_STEP',
      reviewerId: 'reviewer_milestone',
      decidedAt: at,
      rationale: 'Visual evidence reviewed.',
      checklistSnapshot: [],
      evidenceReferences: [],
      sourceMatterDraftVersion: at,
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        formalMatterCreated: false,
        providerAppointed: false,
        filingCreated: false,
        customerMessageSent: false
      }
    }
  };
  await page.route('**/api/lite/professional-review-cases**', async (route) => {
    const url = route.request().url();
    const path = new URL(url).pathname;
    if (path.endsWith('/claim'))
      review = {
        ...review,
        status: 'IN_REVIEW',
        assignment: {
          status: 'CLAIMED',
          claimedBy: 'reviewer_milestone',
          claimedAt: at,
          assignedReviewerId: 'reviewer_milestone',
          assignedAt: at,
          professionalAppointed: false
        }
      };
    else if (path.endsWith('/checklist'))
      review = {
        ...review,
        checklist: review.checklist.map((item) => ({ ...item, status: 'PASS' }))
      };
    else if (path.endsWith('/complete'))
      review = {
        ...review,
        status: 'REVIEWED_READY_FOR_NEXT_STEP',
        decision: {
          code: 'MARK_READY_FOR_NEXT_STEP',
          reviewerId: 'reviewer_milestone',
          decidedAt: at,
          rationale: 'Visual evidence reviewed.',
          checklistSnapshot: review.checklist,
          evidenceReferences: [],
          sourceMatterDraftVersion: at,
          consequences: {
            orderCreated: false,
            paymentCreated: false,
            formalMatterCreated: false,
            providerAppointed: false,
            filingCreated: false,
            customerMessageSent: false
          }
        }
      };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        path.endsWith('professional-review-cases')
          ? { reviewCases: [review] }
          : { reviewCase: review }
      )
    });
  });
  await page.goto(`${urls.lite}#work-professional-review`);
  await page.getByLabel('Status').selectOption('REVIEWED_READY_FOR_NEXT_STEP');
  await page.getByRole('button', { name: 'Open professional review' }).click();
  await expect(page.getByRole('heading', { name: 'Exact Matter Draft snapshot' })).toBeVisible();
  await expect(page.getByText('2026-07-28T15:40:00.000Z', { exact: true })).toBeVisible();
  await expect(page.getByText(/orderCreated: false/)).toContainText('filingCreated: false');
  await expectNoHorizontalOverflow(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `lite-professional-review-${viewport}`);
  await page.getByRole('button', { name: 'Back to review queue' }).click();
  await expect(page.getByRole('button', { name: 'Open professional review' })).toBeFocused();
  await expect(page.getByLabel('Status')).toHaveValue('REVIEWED_READY_FOR_NEXT_STEP');
  assertHealthy();
});

test('Historical migration requires separate review and commit and reloads Portfolio (fixture) @visual', async ({
  page
}, testInfo) => {
  // This is UI fixture acceptance, not real-runtime import or permission evidence.
  const assertHealthy = watchPage(page);
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  let preparation: HistoricalTrademarkAssetPreparationReceipt;
  let preview: TrademarkAssetMigrationPreview;
  let previewCalls = 0;
  let commitCalls = 0;
  let portfolioReads = 0;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: { csrfToken: 'fixture-only-csrf-token' }
    })
  );
  await page.route('**/api/lite/trademark-assets?*', (route) => {
    portfolioReads += 1;
    return route.fulfill({
      json: {
        schemaVersion: 1,
        workspaceId,
        assets: [],
        hasMore: false,
        officialTruthVerifiedByLite: false
      }
    });
  });
  await page.route('**/api/lite/trademark-asset-migrations/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    if (path.endsWith('/prepare-tabular')) {
      const input = body as HistoricalTrademarkAssetTabularPreparationRequest;
      const row = input.rows[0]!;
      preparation = {
        schemaVersion: 1,
        workspaceId,
        migrationKey: input.migrationKey,
        sourceFingerprintSha256: input.sourceFingerprintSha256!,
        manifestFingerprintSha256: 'b'.repeat(64),
        total: 1,
        ready: 1,
        unresolved: 0,
        readyRows: [
          {
            rowKey: row.rowKey,
            sourceIndex: 0,
            item: {
              identity: { jurisdiction: 'US', markText: 'ALPHA' },
              externalIdentifiers: [
                {
                  kind: 'APPLICATION_NUMBER',
                  jurisdiction: 'US',
                  value: '000123',
                  officialTruthVerifiedByLite: false
                }
              ],
              workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: true }],
              sourceReferences: [
                {
                  owner: 'WORKSPACE_USER',
                  kind: 'WORKSPACE_ADMISSION',
                  sourceId: input.sourceArtifactId,
                  sourceVersion: input.sourceArtifactVersion,
                  observedAt: input.observedAt,
                  freshness: 'UNKNOWN'
                }
              ]
            }
          }
        ],
        unresolvedRows: [],
        officialTruthVerifiedByLite: false,
        assetsCreatedAutomatically: false,
        matterCreatedAutomatically: false
      };
      preparation = {
        ...preparation,
        migrationInput: {
          workspaceId,
          migrationKey: preparation.migrationKey,
          sourceFingerprintSha256: preparation.sourceFingerprintSha256!,
          rows: preparation.readyRows.map(({ rowKey, item }) => ({ rowKey, item }))
        }
      };
      await route.fulfill({ json: preparation });
      return;
    }
    const { workspaceId: preparedWorkspace, ...reviewedInput } = preparation!.migrationInput!;
    expect(preparedWorkspace).toBe(workspaceId);
    expect(body).toEqual(reviewedInput);
    expect(body).not.toHaveProperty('workspaceId');
    expect(route.request().headers()['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(route.request().headers()['idempotency-key']).toBeTruthy();
    if (path.endsWith('/preview')) {
      previewCalls += 1;
      preview = {
        schemaVersion: 1,
        workspaceId,
        migrationKey: preparation!.migrationKey,
        sourceFingerprintSha256: preparation!.sourceFingerprintSha256!,
        fingerprint: 'c'.repeat(64),
        total: 1,
        chunkCount: 1,
        chunks: [
          {
            chunkIndex: 0,
            startIndex: 0,
            endExclusive: 1,
            rowKeys: [reviewedInput.rows[0]!.rowKey]
          }
        ],
        rows: [{ rowKey: reviewedInput.rows[0]!.rowKey, importIndex: 0 }],
        officialTruthVerifiedByLite: false,
        matterCreatedAutomatically: false
      };
      await route.fulfill({ json: preview });
      return;
    }
    expect(path).toBe(
      `/api/lite/trademark-asset-migrations/${encodeURIComponent(preparation!.migrationKey)}/commit`
    );
    commitCalls += 1;
    await route.fulfill({
      json: {
        schemaVersion: 1,
        workspaceId,
        migrationKey: preparation!.migrationKey,
        sourceFingerprintSha256: preparation!.sourceFingerprintSha256,
        fingerprint: preview!.fingerprint,
        total: 1,
        chunkCount: 1,
        created: 1,
        duplicates: 0,
        rejected: 0,
        items: [{ rowKey: reviewedInput.rows[0]!.rowKey, importIndex: 0, status: 'CREATED' }],
        officialTruthVerifiedByLite: false,
        matterCreatedAutomatically: false
      }
    });
  });
  await page.goto(`${urls.lite}?workspaceId=${workspaceId}#trademarks`);
  await expect(page.getByRole('heading', { name: 'No Trademark Assets found' })).toBeVisible();
  await page.getByRole('button', { name: 'Import historical assets' }).click();
  const panel = page.locator('.historical-import');
  await panel.getByLabel('Local CSV or XLSX file').setInputFiles({
    name: 'historical-fixture.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Country,Mark,Application\nUS,ALPHA,000123\n')
  });
  await panel.getByLabel('Worksheet').selectOption('CSV');
  await panel.getByLabel('Header row').fill('1');
  await panel.getByLabel('Workspace relationship', { exact: true }).selectOption('MANAGED');
  await panel.getByLabel('Jurisdiction · required').selectOption('Country');
  await panel.getByLabel('Mark text · required').selectOption('Mark');
  await panel.getByLabel('Application number', { exact: true }).selectOption('Application');
  await panel.getByRole('button', { name: 'Prepare import review' }).click();
  await expect(panel.getByRole('heading', { name: 'READY rows for your review' })).toBeVisible();
  expect(previewCalls).toBe(0);
  expect(commitCalls).toBe(0);
  await expect(panel.getByRole('button', { name: 'Preview reviewed migration' })).toBeDisabled();
  await panel.getByRole('checkbox', { name: /I have reviewed the READY rows/ }).check();
  await panel.getByRole('button', { name: 'Preview reviewed migration' }).click();
  await expect(
    panel.getByRole('heading', { name: 'Migration preview', exact: true })
  ).toBeVisible();
  expect(previewCalls).toBe(1);
  expect(commitCalls).toBe(0);
  await expect(panel.getByRole('button', { name: 'Commit reviewed import' })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `lite-historical-migration-preview-${viewport}`);
  const readsBeforeCommit = portfolioReads;
  await panel.getByRole('checkbox', { name: /I confirm importing these reviewed rows/ }).check();
  await panel.getByRole('button', { name: 'Commit reviewed import' }).click();
  await expect(panel.getByRole('heading', { name: 'Import completed' })).toBeVisible();
  expect(commitCalls).toBe(1);
  await expect.poll(() => portfolioReads).toBe(readsBeforeCommit + 1);
  await expect(panel.getByRole('button', { name: 'Commit reviewed import' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await capture(page, `lite-historical-migration-completed-${viewport}`);
  assertHealthy();
});

test('Lite Site Manager previews durable owner state and reloads an explicit revision @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  let site = {
    schemaVersion: 1,
    siteId: 'site_e2e',
    workspaceId,
    coreSiteInstallationRef: { installationId: 'install_e2e', version: 2 },
    version: 4,
    kind: 'WORKSPACE_BRANDED',
    lifecycle: 'ACTIVE',
    currentConfigurationVersion: 3,
    effectiveAt: '2026-09-15T00:00:00.000Z',
    recordedAt: '2026-09-15T00:00:00.000Z',
    sourceRef: 'fixture:site-e2e'
  };
  let displayName = 'Orbit IP';
  let configurationVersion = 3;
  let revisionCalls = 0;
  const corsHeaders = {
    'access-control-allow-origin': new URL(urls.lite).origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers':
      'content-type,x-markorbit-workspace-id,x-markorbit-csrf-token,idempotency-key'
  };
  const configuration = () => ({
    schemaVersion: 1,
    siteId: site.siteId,
    workspaceId,
    version: configurationVersion,
    brand: {
      displayName,
      theme: { primaryColor: '#102030', accentColor: '#abcdef', colorMode: 'LIGHT' }
    },
    localization: {
      defaultLocale: 'en-US',
      supportedLocales: ['en-US'],
      defaultMarket: 'US',
      jurisdictions: ['US']
    },
    roles: {
      surfaceOwnerWorkspaceId: workspaceId,
      customerRelationshipWorkspaceId: 'workspace_relationship',
      offerOwnerRef: 'markreg:catalog',
      merchantOwnerRef: 'payment:markreg',
      fulfillmentOwnerRef: 'markreg:fulfillment'
    },
    services: [],
    contentSlots: [],
    recordedAt: '2026-09-15T00:00:00.000Z',
    sourceRef: 'fixture:site-e2e'
  });
  const bindings = [
    {
      schemaVersion: 1,
      bindingId: 'site_host_e2e',
      siteId: site.siteId,
      workspaceId,
      normalizedHostname: 'brand.example.com',
      bindingType: 'PRIMARY',
      version: 3,
      status: 'ACTIVE',
      verificationMethod: 'DNS_TXT',
      verificationEvidenceRef: 'dns:fixture',
      verifiedAt: '2026-09-15T00:00:00.000Z',
      recordedAt: '2026-09-15T00:00:00.000Z'
    }
  ];
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { csrfToken: 'site-manager-csrf' } })
  );
  await page.route(/\/api\/sites(?:\/.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (request.method() === 'GET' && path === '/api/sites') {
      await route.fulfill({ json: [site], headers: corsHeaders });
      return;
    }
    if (request.method() === 'GET' && path.endsWith('/configuration')) {
      await route.fulfill({ json: configuration(), headers: corsHeaders });
      return;
    }
    if (request.method() === 'GET' && path.endsWith('/host-bindings')) {
      await route.fulfill({ json: bindings, headers: corsHeaders });
      return;
    }
    if (request.method() === 'POST' && path.endsWith('/configurations')) {
      revisionCalls += 1;
      expect(request.headers()['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(request.headers()['x-markorbit-csrf-token']).toBe('site-manager-csrf');
      expect(request.headers()['idempotency-key']).toContain(
        'site-manager:configuration:site_e2e:'
      );
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).not.toHaveProperty('workspaceId');
      expect(body).not.toHaveProperty('actor');
      const input = body['configuration'] as { brand: { displayName: string } };
      displayName = input.brand.displayName;
      configurationVersion += 1;
      site = {
        ...site,
        version: site.version + 1,
        lifecycle: 'DRAFT',
        currentConfigurationVersion: configurationVersion
      };
      await route.fulfill({ json: site, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'NOT_FOUND', message: `Unexpected fixture route ${path}` })
    });
  });
  await page.goto(`${urls.lite}?workspaceId=${workspaceId}#work`);
  await page.getByRole('button', { name: 'Open Site Manager' }).click();
  await expect(page).toHaveURL(new RegExp(`#work-site-manager$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Site Manager' })).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveValue('Orbit IP');
  await expect(page.getByText('brand.example.com', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Site' })).toHaveAttribute(
    'href',
    'https://brand.example.com'
  );
  await page.getByRole('button', { name: 'Preview current projection' }).click();
  await expect(
    page.getByRole('heading', { name: 'Current durable projection preview' })
  ).toBeVisible();
  await expect(page.getByText('Preview only / config v3')).toBeVisible();
  await expect(page.getByText(/Previewing does not publish/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `lite-site-manager-preview-${viewport}`);

  await page.getByLabel('Display name').fill('Orbit IP Updated');
  await expect(page.getByRole('button', { name: 'Save configuration version' })).toBeDisabled();
  await page
    .getByRole('checkbox', {
      name: /I understand this revision requires a separate activation step/
    })
    .check();
  await page.getByRole('button', { name: 'Save configuration version' }).click();
  await expect(page.getByLabel('Display name')).toHaveValue('Orbit IP Updated');
  await expect(page.getByRole('definition').filter({ hasText: 'DRAFT' })).toBeVisible();
  await expect(page.getByText(/New Site configuration version saved/)).toBeVisible();
  expect(revisionCalls).toBe(1);
  await expect(page.getByRole('link', { name: 'Open Site' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await capture(page, `lite-site-manager-revised-${viewport}`);
  assertHealthy();
});
