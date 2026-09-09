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
const knowledgeOwnerHealth = {
  protocolVersion: '1.0',
  objectType: 'CONTROL_PLANE_EVIDENCE_SUPPLY_HEALTH_OWNER_RESULT',
  owner: 'KNOWLEDGE',
  access: 'READ_ONLY',
  requiredUpstreamAuthority: 'control-plane:knowledge:read',
  sourceReadModel: 'evidence-supply-health.v1',
  workspaceId: 'workspace-916',
  observedAt: '2026-09-06T14:19:00.000Z',
  items: [
    {
      targetId: 'target-uspto',
      jurisdiction: 'US',
      authorityName: 'USPTO',
      authorityLevel: 'PRIMARY',
      family: 'TRADEMARK',
      displayName: 'USPTO trademark evidence',
      sourceIds: [],
      state: 'UNKNOWN',
      reasonCodes: ['NO_ACQUISITION_EVIDENCE'],
      coverage: { state: 'PARTIAL', reasons: ['No acquisition evidence'] },
      freshness: { state: 'UNOBSERVED', lastSuccessfulAcquisitionAt: null },
      schedule: { state: 'UNCONFIGURED' },
      reliability: { attempts: 0, failed: 0, unrecoveredFailure: false },
      latency: { windowDays: 30 },
      changeActivity: { updates30d: 0, lastObservedChangeAt: null },
      observedAt: '2026-09-06T14:19:00.000Z'
    }
  ],
  summary: {
    total: 1,
    byState: { HEALTHY: 0, DEGRADED: 0, STALE: 0, BLOCKED: 0, PARTIAL: 0, UNKNOWN: 1 },
    coverage: { COMPLETE: 0, PARTIAL: 1, UNKNOWN: 0 },
    requiringAttention: 1,
    stale: 0,
    blocked: 0,
    recentChanges30d: 0
  }
};
const mgsnOwnerProviders = [
  {
    schemaVersion: 1,
    providerId: 'provider-super-admin-001',
    providerWorkspaceId: 'workspace-provider-001',
    displayName: 'Orbit Provider One',
    operationalStatus: 'ACTIVE',
    version: 2,
    createdBy: 'user-ops',
    updatedBy: 'user-ops',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-08T05:00:00.000Z'
  }
];
const knowledgePlatformAdministration = {
  schemaVersion: 1,
  objectType: 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT',
  owner: 'KNOWLEDGE',
  access: 'READ_ONLY',
  requiredUpstreamAuthority: 'control-plane:knowledge:read',
  observedAt: '2026-09-08T11:00:00.000Z',
  portfolio: {
    availability: 'NOT_YET_MODELED',
    reason: 'Canonical Evidence Supply Health is currently Workspace-scoped.'
  }
};
const executionOwnerAdministration = {
  schemaVersion: 1,
  objectType: 'EXECUTION_ADMINISTRATION_PROJECTION',
  owner: 'EXECUTION',
  access: 'READ_ONLY',
  requiredAuthority: 'execution-admin:read',
  observedAt: '2026-09-08T14:10:00.000Z',
  portfolio: {
    availability: 'NOT_YET_MODELED',
    reason: 'No canonical durable global Execution portfolio is modeled.'
  }
};
const systemOwnerAdministration = {
  schemaVersion: 1,
  objectType: 'SYSTEM_ADMINISTRATION_PROJECTION',
  owner: 'CORE_CONTROL_PLANE',
  access: 'READ_ONLY',
  requiredAuthority: 'system-admin:read',
  observedAt: '2026-09-09T00:10:00.000Z',
  portfolio: {
    availability: 'NOT_YET_MODELED',
    reason: 'No canonical durable global System administration portfolio is modeled.'
  }
};
const governanceOwnerAdministration = {
  schemaVersion: 1,
  objectType: 'GOVERNANCE_ADMINISTRATION_PROJECTION',
  owner: 'CORE_CONTROL_PLANE',
  access: 'READ_ONLY',
  requiredAuthority: 'governance-admin:read',
  observedAt: '2026-09-09T03:20:00.000Z',
  portfolio: {
    availability: 'NOT_YET_MODELED',
    reason: 'No canonical durable cross-owner Governance and Audit portfolio is modeled.'
  }
};
const liteOwnerAdministration = {
  schemaVersion: 1,
  objectType: 'LITE_ADMINISTRATION_PROJECTION',
  owner: 'LITE',
  access: 'READ_ONLY',
  requiredAuthority: 'lite-admin:read',
  observedAt: '2026-09-08T10:00:00.000Z',
  portfolio: {
    availability: 'NOT_YET_MODELED',
    reason: 'No canonical durable global Lite portfolio is modeled.'
  }
};
const workspaceOwnerPortfolio = {
  schemaVersion: 1,
  objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT',
  owner: 'CORE',
  access: 'READ_ONLY',
  requiredAuthority: 'workspace-admin:read',
  observedAt: '2026-09-08T05:00:00.000Z',
  page: 1,
  pageSize: 25,
  sort: 'UPDATED_AT',
  direction: 'DESC',
  total: 1,
  summary: { total: 1, byStatus: { ACTIVE: 1, ARCHIVED: 0 } },
  items: [
    {
      workspaceId: 'workspace-global-001',
      name: 'Orbit Demo Workspace',
      slug: 'orbit-demo-workspace',
      status: 'ACTIVE',
      version: 3,
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-09-08T04:45:00.000Z',
      membershipCount: 4,
      activeMembershipCount: 3
    }
  ]
};
test('MarkOrbit Super Admin exposes truthful governed operator surfaces @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  let dataOwnerReads = 0;
  let knowledgeOwnerReads = 0;
  await page.route(
    '**/api/internal/control-plane/knowledge/evidence-supply-health',
    async (route) => {
      knowledgeOwnerReads += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(knowledgeOwnerHealth)
      });
    }
  );
  await page.route('**/api/internal/control-plane/data/summary', async (route) => {
    dataOwnerReads += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(dataOwnerSummary)
    });
  });
  await page.route('**/api/internal/super-admin/knowledge', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(knowledgePlatformAdministration)
    });
  });
  await page.route('**/api/internal/super-admin/execution', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(executionOwnerAdministration)
    });
  });
  await page.route('**/api/internal/super-admin/system', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(systemOwnerAdministration)
    });
  });
  await page.route('**/api/internal/super-admin/governance', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(governanceOwnerAdministration)
    });
  });
  await page.route('**/api/internal/super-admin/lite', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(liteOwnerAdministration)
    });
  });
  await page.route('**/api/internal/commercial-admin/providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mgsnOwnerProviders)
    });
  });
  await page.route('**/api/internal/super-admin/workspaces*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(workspaceOwnerPortfolio)
    });
  });
  await page.addInitScript(() => {
    sessionStorage.setItem('markorbit-workspace-id', 'workspace-916');
  });
  await page.goto(urls.operations);
  await expect(page.getByText('Internal only')).toBeVisible();
  await expect(page.getByText('MarkOrbit Super Admin')).toBeVisible();
  const primaryNavigation = page.getByRole('navigation', { name: 'Primary' });
  await expect(primaryNavigation).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Super admin overview' })).toBeVisible();
  for (const label of [
    'Overview',
    'Core',
    'Workspace',
    'Brain',
    'Capability',
    'MarkReg',
    'Lite',
    'MGSN',
    'Knowledge',
    'Data Engine',
    'Execution',
    'Commercial / Payment',
    'System',
    'Governance & Audit'
  ]) {
    await expect(primaryNavigation.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  for (const heading of [
    'Connected governed surfaces',
    'Aggregate platform health',
    'Cognitive platform',
    'Specialist administration'
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Knowledge', exact: true }).click();
  await expect(page).toHaveURL(/#super-admin-knowledge$/);
  const knowledgeAdmin = page.locator('#super-admin-knowledge');
  await expect(
    knowledgeAdmin.getByRole('heading', { name: 'Knowledge', exact: true })
  ).toBeVisible();
  await expect(
    knowledgeAdmin.getByText('Global Knowledge portfolio not yet modeled')
  ).toBeVisible();
  await expect(knowledgeAdmin.getByText('NOT_YET_MODELED')).toBeVisible();
  expect(knowledgeOwnerReads).toBe(0);
  await expect(page.locator('#knowledge-platform')).toBeVisible();
  const loadKnowledgeOwnerHealth = page.locator('#knowledge-platform').getByRole('button', {
    name: 'Load owner health'
  });
  await loadKnowledgeOwnerHealth.click();
  await expect(page.getByText('Knowledge owner-reported evidence supply health')).toBeVisible();
  expect(knowledgeOwnerReads).toBe(1);
  await page.getByRole('link', { name: 'Execution', exact: true }).click();
  await expect(page).toHaveURL(/#super-admin-execution$/);
  const executionAdmin = page.locator('#super-admin-execution');
  await expect(
    executionAdmin.getByRole('heading', { name: 'Execution', exact: true })
  ).toBeVisible();
  await expect(
    executionAdmin.getByText('Global Execution portfolio not yet modeled')
  ).toBeVisible();
  await expect(executionAdmin.getByText('NOT_YET_MODELED')).toBeVisible();
  await page.getByRole('link', { name: 'System', exact: true }).click();
  await expect(page).toHaveURL(/#super-admin-system$/);
  const systemAdmin = page.locator('#super-admin-system');
  await expect(systemAdmin.getByRole('heading', { name: 'System', exact: true })).toBeVisible();
  await expect(systemAdmin.getByText('Global System portfolio not yet modeled')).toBeVisible();
  await expect(systemAdmin.getByText('NOT_YET_MODELED')).toBeVisible();
  await primaryNavigation.getByRole('link', { name: 'Governance & Audit', exact: true }).click();
  await expect(page).toHaveURL(/#super-admin-governance$/);
  const governanceAdmin = page.locator('#super-admin-governance');
  await expect(
    governanceAdmin.getByRole('heading', { name: 'Governance & Audit', exact: true })
  ).toBeVisible();
  await expect(
    governanceAdmin.getByText('Cross-owner Governance and Audit portfolio not yet modeled')
  ).toBeVisible();
  await expect(governanceAdmin.getByText('NOT_YET_MODELED')).toBeVisible();
  await page.getByRole('link', { name: 'Data Engine', exact: true }).click();
  await expect(page).toHaveURL(/#data-platform$/);
  await expect(page.getByRole('heading', { name: 'Data', exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'No Data Engine owner summary loaded. Load owner summary to determine current owner state.'
    )
  ).toBeVisible();
  const loadOwnerSummary = page.getByRole('button', { name: 'Load owner summary' });
  await expect(loadOwnerSummary).toBeVisible();
  expect(dataOwnerReads).toBe(0);
  await loadOwnerSummary.click();
  await expect(page.getByText('Data Engine owner-reported dependency health')).toBeVisible();
  expect(dataOwnerReads).toBe(1);
  await expect(page.getByRole('heading', { name: 'Commercial / Payment' })).toBeVisible();
  for (const staleHeading of [
    'Service health',
    'Failed operations',
    'Manual review',
    'Event summary'
  ]) {
    await expect(page.getByRole('heading', { name: staleHeading })).toHaveCount(0);
  }
  await expect(page.getByText('1,248')).toHaveCount(0);
  await expect(
    page.locator('#super-admin-workspace').getByRole('heading', { name: 'Workspace', exact: true })
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectVisibleFocus(page);
  if (testInfo.project.name.startsWith('desktop')) {
    await capture(page, 'operations-console-desktop');
  }
  assertHealthy();
});
