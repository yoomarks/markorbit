import { expect, test } from '@playwright/test';
import {
  capture,
  expectNoHorizontalOverflow,
  expectVisibleFocus,
  urls,
  watchPage
} from './helpers/page.js';
import {
  adminModules,
  routeFor
} from '../../apps/operations-console/src/super-admin-v2/catalog.js';

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
const coreOwnerAdministration = {
  schemaVersion: 1,
  objectType: 'CORE_ADMINISTRATION_PROJECTION',
  owner: 'CORE',
  access: 'READ_ONLY',
  requiredAuthority: 'core-admin:read',
  observedAt: '2026-09-09T10:00:00.000Z',
  portfolio: {
    availability: 'NOT_YET_MODELED',
    reason:
      'Core does not yet expose one canonical durable platform administration portfolio for Users, Internal Operators, Sessions, Access Control, API Keys, Feature Flags and Audit.'
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
const workspaceOwnerPortfolioV2 = {
  ...workspaceOwnerPortfolio,
  observedAt: '2026-09-28T05:00:00.000Z',
  pageSize: 50,
  total: 2,
  summary: { total: 2, byStatus: { ACTIVE: 1, ARCHIVED: 1 } },
  items: [
    workspaceOwnerPortfolio.items[0],
    {
      workspaceId: 'workspace-archive-002',
      name: 'Archived Brand Workspace',
      slug: 'archived-brand-workspace',
      status: 'ARCHIVED',
      version: 7,
      createdAt: '2025-01-12T08:00:00.000Z',
      updatedAt: '2026-09-20T04:45:00.000Z',
      membershipCount: 2,
      activeMembershipCount: 0
    }
  ]
};
test('MarkOrbit Super Admin exposes truthful governed operator surfaces @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  let dataOwnerReads = 0;
  let knowledgeOwnerReads = 0;
  let coreOwnerReads = 0;
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
  await page.route('**/api/internal/super-admin/core', async (route) => {
    coreOwnerReads += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(coreOwnerAdministration)
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
  await primaryNavigation.getByRole('link', { name: 'Core', exact: true }).click();
  await expect(page).toHaveURL(/#super-admin-core$/);
  const coreAdmin = page.locator('#super-admin-core');
  await expect(coreAdmin.getByRole('heading', { name: 'Core', exact: true })).toBeVisible();
  await expect(coreAdmin.getByText('Global Core portfolio not yet modeled')).toBeVisible();
  await expect(coreAdmin.getByText('core-admin:read', { exact: true })).toBeVisible();
  await expect(coreAdmin.getByText('NOT_YET_MODELED')).toBeVisible();
  await expect(
    page.getByText('Global Core administration is not connected in this shell yet.')
  ).toHaveCount(0);
  expect(coreOwnerReads).toBeGreaterThanOrEqual(1);
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

test('Super Admin V2 preview is complete, refresh-safe and truthfully interactive @visual', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.operations}/super-admin-v2/overview/platform`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('.sa2-module-name')).toHaveText('总览');
  await expect(page.getByText('演示数据 · 仅供产品评审')).toBeVisible();
  await expect(page.getByText('演示评审', { exact: true })).toBeVisible();

  if (testInfo.project.name.startsWith('mobile')) {
    await page.getByRole('button', { name: '打开导航' }).click();
  }
  const primary = page.getByRole('navigation', { name: '全局一级导航' });
  await expect(primary.getByRole('link')).toHaveCount(12);
  await primary.getByRole('link', { name: '数据', exact: true }).click();
  await expect(page).toHaveURL(/\/super-admin-v2\/data\/overview$/);
  await expect(page.getByTestId('data-page-overview')).toBeVisible();

  await page.getByRole('link', { name: '采集任务', exact: true }).click();
  await expect(page).toHaveURL(/\/super-admin-v2\/data\/jobs$/);
  await page.reload();
  await expect(page.getByTestId('data-page-jobs')).toBeVisible();

  const filter = page.getByLabel('搜索运行');
  await filter.fill('CNIPA');
  await expect(page.getByRole('button', { name: /CNIPA 公告增量/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /WIPO Madrid 解析/ })).toHaveCount(0);
  await page.getByRole('button', { name: '审核并继续' }).click();
  const protectedDialog = page.getByRole('dialog', { name: /批准冻结计划并继续/ });
  await expect(protectedDialog.getByText('此预览不会执行生产操作')).toBeVisible();
  await protectedDialog.getByRole('button', { name: '确认演示路径' }).click();
  const demoFeedback = page.getByRole('status');
  await expect(demoFeedback.getByText('未调用 owner API')).toBeVisible();
  await demoFeedback.getByRole('button', { name: '关闭 Demo 反馈' }).click();

  const reviewToolsToggle = page.getByRole('button', { name: '展开评审工具' });
  if (await reviewToolsToggle.isVisible()) await reviewToolsToggle.click();
  await page.getByLabel('模拟页面状态').selectOption('permission');
  await expect(page.getByRole('status').getByText('缺少精确读取权限')).toBeVisible();
  await page.getByLabel('模拟页面状态').selectOption('partial');
  await expect(page.getByText('部分数据不可用')).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await page.getByLabel('搜索当前模块').focus();
  await expectVisibleFocus(page);
  await page.getByLabel('模拟页面状态').selectOption('success');
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await capture(
    page,
    testInfo.project.name.startsWith('desktop')
      ? 'super-admin-v2-data-jobs-desktop'
      : 'super-admin-v2-data-jobs-mobile'
  );
  assertHealthy();
});

test('Super Admin V2 Knowledge evidence review preserves the protected decision boundary', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.operations}/super-admin-v2/knowledge/evidence`);
  await expect(page.getByTestId('knowledge-page-evidence')).toBeVisible();
  await expect(
    page.getByText('这是证据供应审核，不是 Capability 验证或 canon mutation。')
  ).toBeVisible();
  await page.getByRole('button', { name: '批准证据' }).click();
  const protectedDialog = page.getByRole('dialog', { name: /批准证据 EVD-11842/ });
  await expect(protectedDialog.getByText('此预览不会执行生产操作')).toBeVisible();
  await protectedDialog.getByRole('button', { name: '确认演示路径' }).click();
  const demoFeedback = page.getByRole('status');
  await expect(demoFeedback.getByText('未调用 owner API')).toBeVisible();
  await demoFeedback.getByRole('button', { name: '关闭 Demo 反馈' }).click();
  await expectNoHorizontalOverflow(page);
  if (testInfo.project.name.startsWith('mobile')) {
    await capture(page, 'super-admin-v2-knowledge-evidence-mobile');
  }
  assertHealthy();
});

test('Super Admin V2 batch A links incidents, recovery evidence and integration layers', async ({
  page
}) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.operations}/super-admin-v2/overview/platform`);
  await expect(page.getByTestId('overview-page-platform')).toBeVisible();
  await page
    .getByRole('button', { name: /Data Engine CN 批次等待批准/ })
    .first()
    .click();
  await expect(page.getByTestId('overview-platform-detail')).toContainText('Checkpoint CP-88421');

  await page.goto(`${urls.operations}/super-admin-v2/operations/recovery`);
  await expect(page.getByTestId('operations-page-recovery')).toBeVisible();
  await page
    .getByRole('button', { name: /CN publish from checkpoint/ })
    .last()
    .click();
  await expect(page.getByTestId('operations-recovery-detail')).toContainText('Plan hash matches');
  await page.getByRole('button', { name: '预演主要操作' }).click();
  await expect(page.getByRole('dialog', { name: /审阅恢复条件/ })).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();

  await page.goto(`${urls.operations}/super-admin-v2/integrations/switches`);
  await expect(page.getByTestId('integrations-page-switches')).toBeVisible();
  await expect(page.getByText('GLOBAL POLICY')).toBeVisible();
  await expect(page.getByText('PRODUCT ENTITLEMENT')).toBeVisible();
  await expect(page.getByText('WORKSPACE CONFIG')).toBeVisible();
  await expect(page.getByText('CONNECTION HEALTH', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertHealthy();
});

test('Super Admin V2 batch B keeps Workspace, identity and product truths separate', async ({
  page
}) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.operations}/super-admin-v2/workspaces/directory`);
  await page
    .getByRole('button', { name: /Global Brand LLC/ })
    .first()
    .click();
  await expect(page.getByTestId('workspaces-directory-detail')).toContainText('SUB-GB');
  await expect(page.getByTestId('workspaces-directory-detail')).toContainText('4 个 Site');
  await page.getByRole('button', { name: /Global Brand Europe/ }).click();
  await expect(page.getByTestId('workspace-site-detail')).toContainText('SITE-GB-EU');

  await page.goto(`${urls.operations}/super-admin-v2/users/relationships`);
  await expect(page.getByTestId('users-page-relationships')).toBeVisible();
  await page
    .getByRole('button', { name: /Sarah Chen → MO Labs/ })
    .first()
    .click();
  await expect(page.getByTestId('users-relationships-detail')).toContainText('MEM-LABS-SC');

  await page.goto(`${urls.operations}/super-admin-v2/products/entitlements`);
  await expect(page.getByTestId('products-page-entitlements')).toBeVisible();
  await page
    .getByRole('button', { name: /Starter → Brain/ })
    .first()
    .click();
  await expect(page.getByTestId('products-page-entitlements')).toContainText(
    '实际启用仍由 Workspace 配置决定'
  );
  await expect(page.getByTestId('products-entitlements-detail')).toContainText(
    'Alternative FS-LITE-AI'
  );
  await expectNoHorizontalOverflow(page);
  assertHealthy();
});

test('Super Admin V2 batch C links Brain execution to governed Capability evidence', async ({
  page
}) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.operations}/super-admin-v2/brain/runs`);
  await page
    .getByRole('button', { name: /Matter opportunity analysis/ })
    .first()
    .click();
  const brainRun = page.getByTestId('brain-runs-detail');
  await expect(brainRun).toContainText('CAP-ANALYZE-001');
  await expect(brainRun).toContainText('provider receipt pr-118');

  await page.goto(`${urls.operations}/super-admin-v2/capabilities/catalog`);
  await page
    .getByRole('button', { name: /Analyze trademark opportunity/ })
    .first()
    .click();
  const capability = page.getByTestId('capabilities-catalog-detail');
  await expect(capability).toContainText('Outcome contract');
  await expect(capability).toContainText('Implementation IMP-42');
  await expect(capability).toContainText('Run BRUN-8821');
  await expect(capability).toContainText('Reflection Candidate');
  await expectNoHorizontalOverflow(page);
  assertHealthy();
});

test('Super Admin V2 batch D preserves financial owners and protects risky actions', async ({
  page
}) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.operations}/super-admin-v2/billing/payments`);
  await page.getByRole('button', { name: /Site 演示支付/ }).click();
  const payment = page.getByTestId('commercial-object-detail');
  await expect(payment).toContainText('payment_demo_failed');
  await expect(payment).toContainText('Payment Owner 边界');
  await expect(payment).toContainText('commercial-admin:read · READ ONLY');
  await expect(payment).toContainText('不执行收款、退款、提现、资金划拨或对账处置');

  await page.goto(`${urls.operations}/super-admin-v2/governance/risk`);
  await page
    .getByRole('button', { name: /Billing role escalation/ })
    .first()
    .click();
  const risk = page.getByTestId('governance-risk-detail');
  await expect(risk).toContainText('Would grant invoice management to 1 user');
  await expect(risk).toContainText('governance.risk:approve');
  await page.getByRole('button', { name: '预演主要操作' }).click();
  await expect(page.getByRole('dialog', { name: /审阅风险操作/ })).toContainText(
    '不会写入任何服务或数据库'
  );
  await page.getByRole('button', { name: '取消' }).click();
  await expectNoHorizontalOverflow(page);
  assertHealthy();
});

test('commercial offer-version draft is structured, bilingual and remains local', async ({
  page
}) => {
  const assertHealthy = watchPage(page);
  const writes: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method()))
      writes.push(`${request.method()} ${request.url()}`);
  });
  await page.goto(`${urls.operations}/super-admin-v2/billing/plans`);
  await page.getByRole('button', { name: '新建版本草稿' }).click();
  const draft = page.getByTestId('commercial-offer-draft');
  await draft.getByLabel('显示名称').fill('Lite Growth 2027');
  await draft.getByLabel('币种').selectOption('USD');
  await draft.getByLabel('计费周期').selectOption('YEAR');
  await draft.getByLabel('金额（主单位）').fill('1299');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(draft.getByLabel('Display name')).toHaveValue('Lite Growth 2027');
  await expect(draft.getByLabel('Currency')).toHaveValue('USD');
  await draft.getByRole('button', { name: 'Save local draft only' }).click();
  await expect(page.getByRole('status')).toContainText('Local Demo draft saved');
  await draft.getByRole('button', { name: 'Request Demo review' }).click();
  await expect(page.getByRole('dialog')).toContainText('PROTECTED ACTION · DEMO');
  await expect(page.getByRole('dialog')).toContainText(
    'This preview will not perform production operations'
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes).toEqual([]);
  assertHealthy();
});

test('commercial promotion and coupon decisions expose deterministic eligibility reasons', async ({
  page
}) => {
  await page.goto(`${urls.operations}/super-admin-v2/billing/promotions`);
  const eligibility = page.getByTestId('promotion-eligibility');
  await expect(eligibility).toContainText('符合条件');
  await eligibility.getByLabel('评估 Workspace').selectOption('WSP-SUNRISE');
  await expect(eligibility).toContainText('不符合条件');
  await expect(eligibility).toContainText('MARKET_NOT_APPLICABLE');
  await expect(eligibility).toContainText('不会生成折扣或核销记录');

  await page.goto(`${urls.operations}/super-admin-v2/billing/coupons`);
  const outcome = page.getByTestId('coupon-outcome');
  const scenario = outcome.getByLabel('演示场景');
  for (const [value, reason] of [
    ['EXPIRED', 'COUPON_EXPIRED'],
    ['DUPLICATE', 'COUPON_ALREADY_REDEEMED'],
    ['EXHAUSTED', 'COUPON_CAPACITY_EXHAUSTED'],
    ['PERMISSION', 'COMMERCIAL_PERMISSION_DENIED']
  ] as const) {
    await scenario.selectOption(value);
    await expect(outcome).toContainText(reason);
  }
  await expect(outcome).toContainText('不创建 Coupon Redemption');
});

test('commercial order preserves the exact offer, promotion, coupon and final-price snapshot', async ({
  page
}) => {
  await page.goto(`${urls.operations}/super-admin-v2/billing/orders`);
  await page.getByRole('button', { name: /Lite Pro 新购演示/ }).click();
  const snapshot = page.getByTestId('commercial-price-snapshot');
  await expect(snapshot).toContainText('OFFER-LITE-PRO v4');
  await expect(snapshot).toContainText('PROMO-Q4-LITE v1');
  await expect(snapshot).toContainText('COUPON-WELCOME-100 v1');
  await expect(snapshot).toContainText('¥169 CNY');
  await expect(snapshot).toContainText('后续调价不会追溯修改');
});

test('commercial workspaces remain usable in Chinese and English at review viewports', async ({
  page
}, testInfo) => {
  const mobile = testInfo.project.name.startsWith('mobile');
  await page.goto(`${urls.operations}/super-admin-v2/billing/promotions`);
  await expect(page.getByRole('heading', { level: 1, name: '营销活动' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, `super-admin-v2-commercial-promotions-zh-${mobile ? '390' : '1440'}`);

  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Promotions' })).toBeVisible();
  await expect(page.getByTestId('promotion-eligibility')).toContainText('Workspace eligibility');
  await expectNoHorizontalOverflow(page);
  await capture(page, `super-admin-v2-commercial-promotions-en-${mobile ? '390' : '1440'}`);

  if (!mobile) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${urls.operations}/super-admin-v2/billing/orders`);
    await expectNoHorizontalOverflow(page);
    await capture(page, 'super-admin-v2-commercial-order-en-1366');
  }
});

test('V2.2.1 keeps Data task selection, filters and deterministic query results aligned', async ({
  page
}, testInfo) => {
  await page.goto(`${urls.operations}/super-admin-v2/data/jobs`);
  await page.getByRole('button', { name: /WIPO Madrid 解析/ }).click();
  await expect(page.getByTestId('data-jobs-detail')).toContainText('RUN-WO-5531');
  await expect(page.getByTestId('data-jobs-detail')).toContainText('CP-55318');
  await capture(
    page,
    `super-admin-v221-data-selection-${testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop'}`
  );

  await page.getByLabel('运行状态').selectOption('运行中');
  await expect(page.getByTestId('data-jobs-detail')).toContainText('RUN-US-9914');
  await expect(page.getByRole('button', { name: /审核并继续/ })).toHaveCount(0);

  await page.getByLabel('搜索运行').fill('does-not-exist');
  await expect(page.getByTestId('data-jobs-empty')).toBeVisible();
  await expect(page.getByTestId('data-jobs-detail')).toHaveCount(0);

  await page.goto(`${urls.operations}/super-admin-v2/data/query`);
  await page.getByLabel('查询值').fill('87342156');
  await page.getByRole('button', { name: '执行只读查询' }).click();
  await expect(page.getByText('1 条演示结果')).toBeVisible();
  await expect(page.getByText('案件 US-87342156')).toBeVisible();
  await page.getByLabel('查询值').fill('NO-MATCH');
  await page.getByRole('button', { name: '执行只读查询' }).click();
  await expect(page.getByText('0 条演示结果')).toBeVisible();
  await expect(page.getByTestId('data-query-empty')).toBeVisible();
});

test('V2.2.1 keeps Knowledge evidence, approval target, search and Package detail aligned', async ({
  page
}, testInfo) => {
  await page.goto(`${urls.operations}/super-admin-v2/knowledge/evidence`);
  await page.getByRole('button', { name: /Classification practice update/ }).click();
  const evidence = page.getByTestId('knowledge-evidence-detail');
  await expect(evidence).toContainText('CNIPA Examination Guide · Chapter 3 §2.4');
  await expect(evidence).toContainText('EVD-11841');
  await capture(
    page,
    `super-admin-v221-knowledge-selection-${testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop'}`
  );
  await page.getByRole('button', { name: '批准证据' }).click();
  await expect(page.getByRole('dialog', { name: /批准证据 EVD-11841/ })).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();

  await page.goto(`${urls.operations}/super-admin-v2/knowledge/search`);
  await page.getByLabel('知识检索词').fill('CNIPA');
  await page.getByRole('button', { name: '检索', exact: true }).click();
  await expect(page.getByText('1 条演示结果')).toBeVisible();
  await expect(page.getByRole('heading', { name: '整体观察与显著部分的关系' })).toBeVisible();
  await page.getByLabel('知识检索词').fill('no-known-evidence');
  await page.getByRole('button', { name: '检索', exact: true }).click();
  await expect(page.getByText('0 条演示结果')).toBeVisible();
  await expect(page.getByTestId('knowledge-search-empty')).toBeVisible();

  await page.goto(`${urls.operations}/super-admin-v2/knowledge/packages`);
  await page.getByRole('button', { name: /RPK-4207/ }).click();
  await expect(page.getByTestId('knowledge-package-detail')).toContainText('RPK-4207');
  await expect(page.getByTestId('knowledge-package-detail')).toContainText('18 evidence items');
});

test('V2.2.1 protected dialog traps focus, closes with Escape and restores the invoking control', async ({
  page
}) => {
  await page.goto(`${urls.operations}/super-admin-v2/data/overview`);
  await page.getByRole('button', { name: /CNIPA Gazette/ }).click();
  await page.getByRole('button', { name: '进入受保护操作' }).click();
  const dialog = page.getByRole('dialog', { name: /处理/ });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.sa2-inspector')).toHaveAttribute('inert', '');
  await expect(dialog.getByLabel('演示理由')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '进入受保护操作' })).toBeFocused();
});

test('V2.2.2 isolates Knowledge review drafts by evidence version and confirms the exact target', async ({
  page
}, testInfo) => {
  await page.goto(`${urls.operations}/super-admin-v2/knowledge/evidence`);
  await page.getByLabel('审核说明').fill('EVD-11842 专属草稿');
  await page.getByLabel('定位准确性').selectOption('需修正');

  await page.getByRole('button', { name: /Classification practice update/ }).click();
  await expect(page.getByLabel('审核说明')).toHaveValue('Locator 与原文一致；保留适用范围限定。');
  await expect(page.getByLabel('定位准确性')).toHaveValue('准确');
  await page.getByLabel('审核说明').fill('EVD-11841 独立审核意见');

  await page.getByRole('button', { name: '批准证据' }).click();
  const dialog = page.getByRole('dialog', { name: /批准证据 EVD-11841/ });
  await expect(dialog).toContainText('CNIPA Examination Guide · Chapter 3 §2.4');
  await expect(dialog).toContainText('c42…18a · lines 2260–2274');
  await expect(dialog).toContainText('2026.09');
  await expect(dialog).toContainText('EVD-11841 独立审核意见');
  await capture(
    page,
    `super-admin-v222-evidence-confirm-${testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop'}`
  );
  await dialog.getByRole('button', { name: '取消' }).click();

  await page.getByRole('button', { name: /Absolute grounds/ }).click();
  await expect(page.getByLabel('审核说明')).toHaveValue('EVD-11842 专属草稿');
  await expect(page.getByLabel('定位准确性')).toHaveValue('需修正');
});

test('V2.2.2 protected dialog traverses every control in DOM order before wrapping focus', async ({
  page
}) => {
  await page.goto(`${urls.operations}/super-admin-v2/data/overview`);
  await page.getByRole('button', { name: /CNIPA Gazette/ }).click();
  await page.getByRole('button', { name: '进入受保护操作' }).click();
  const dialog = page.getByRole('dialog', { name: /处理/ });
  const reason = dialog.getByLabel('演示理由');
  const chinese = dialog.getByRole('button', { name: '简体中文', exact: true });
  const english = dialog.getByRole('button', { name: 'English', exact: true });
  const cancel = dialog.getByRole('button', { name: '取消' });
  const confirm = dialog.getByRole('button', { name: '确认演示路径' });

  await expect(reason).toBeFocused();
  await reason.fill('键盘可达的本地演示理由');
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(chinese).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(english).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reason).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(english).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '进入受保护操作' })).toBeFocused();
});

test('V2.2.2 object detail is an honest non-modal region with keyboard close and focus return', async ({
  page
}) => {
  await page.goto(`${urls.operations}/super-admin-v2/data/overview`);
  const trigger = page.getByRole('button', { name: /CNIPA Gazette/ });
  await trigger.click();
  const detail = page.getByRole('complementary', { name: /CNIPA Gazette/ });
  await expect(detail).toBeVisible();
  await expect(detail).not.toHaveAttribute('aria-modal');
  await expect(detail.getByRole('button', { name: '关闭详情' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('V2.2.1 overview alert deep-link returns with alert context restored', async ({ page }) => {
  await page.goto(`${urls.operations}/super-admin-v2/overview/alerts`);
  await page
    .getByRole('button', { name: /WIPO 转换连续失败/ })
    .first()
    .click();
  await page.getByRole('button', { name: '打开关联处理页面' }).click();
  await expect(page).toHaveURL(/\/super-admin-v2\/knowledge\/transforms\?/);
  await expect(page.getByText('来自告警 ALT-7718')).toBeVisible();
  await expect(page.getByRole('button', { name: '返回告警调查' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/super-admin-v2\/overview\/alerts$/);
  await expect(page.getByTestId('overview-alerts-detail')).toContainText('ALT-7718');
  await expect(page.getByText('已恢复告警 ALT-7718 的调查上下文')).toBeVisible();
});

test('V2.2.2 Data Package metadata controls open the selected file metadata', async ({ page }) => {
  await page.goto(`${urls.operations}/super-admin-v2/data/packages`);
  await page.getByRole('button', { name: /PKG-US-2409/ }).click();
  await page.getByRole('button', { name: /查看 applications.parquet 元数据/ }).click();
  const metadata = page.getByTestId('data-package-file-metadata');
  await expect(metadata).toContainText('PKG-US-2409');
  await expect(metadata).toContainText('applications.parquet');
  await expect(metadata).toContainText('12.8 GB');
});

test('V2.2.2 Knowledge Raw Files and Transforms bind every selection to its own detail', async ({
  page
}) => {
  await page.goto(`${urls.operations}/super-admin-v2/knowledge/raw-files`);
  await page.getByRole('button', { name: /CNIPA/ }).click();
  await expect(page.getByTestId('knowledge-raw-detail')).toContainText('CNIPA');
  await page.getByRole('button', { name: /gazette-2026-09-23/ }).click();
  await expect(page.getByTestId('knowledge-raw-detail')).toContainText('RAW-99214');
  await expect(page.getByTestId('knowledge-raw-detail')).toContainText('gazette-2026-09-23');

  await page.goto(`${urls.operations}/super-admin-v2/knowledge/transforms`);
  await page.getByRole('button', { name: /CONV-9813/ }).click();
  const transform = page.getByTestId('knowledge-transform-detail');
  await expect(transform).toContainText('CONV-9813');
  await expect(transform).toContainText('RAW-88413');
  await expect(transform).toContainText('worker-convert-02');
  await expect(transform).toContainText('REC-9813');
});

test('V2.2.2 Knowledge currentness filter is mutually exclusive and changes results', async ({
  page
}) => {
  await page.goto(`${urls.operations}/super-admin-v2/knowledge/search`);
  await expect(page.getByText('3 条演示结果')).toBeVisible();
  await page.getByLabel('包括历史版本').check();
  await expect(page.getByText('4 条演示结果')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Distinctive character · 2025 archive' })
  ).toBeVisible();
  await expect(page.getByLabel('仅当前版本')).not.toBeChecked();
});

test('V2.2.2 alert deep-link targets the exact owner object and survives refresh', async ({
  page
}) => {
  await page.goto(`${urls.operations}/super-admin-v2/overview/alerts`);
  await page
    .getByRole('button', { name: /WIPO 转换连续失败/ })
    .first()
    .click();
  await page.getByRole('button', { name: '打开关联处理页面' }).click();
  await expect(page).toHaveURL(/knowledge\/transforms\?.*focus=CONV-9813.*alert=ALT-7718/);
  await expect(page.getByTestId('knowledge-transform-detail')).toContainText('CONV-9813');
  await page.reload();
  await expect(page.getByText('来自告警 ALT-7718')).toBeVisible();
  await expect(page.getByTestId('knowledge-transform-detail')).toContainText('CONV-9813');
});

test('V2.2.2 unknown Super Admin routes render an explicit not-found state', async ({ page }) => {
  await page.goto(`${urls.operations}/super-admin-v2/nonexisting/module`);
  await expect(page).toHaveURL(/\/super-admin-v2\/nonexisting\/module$/);
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await expect(page.getByRole('link', { name: '返回平台总览' })).toHaveAttribute(
    'href',
    '/super-admin-v2/overview/platform'
  );
  await expect(page.getByText('平台总览', { exact: true })).toHaveCount(0);
});

test('V2.2.2 prioritizes the 390px evidence workspace and keeps approval text readable', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${urls.operations}/super-admin-v2/knowledge/evidence`);
  await expect(page.getByLabel('模拟页面状态')).toBeHidden();
  const firstEvidence = page.getByRole('button', { name: /Absolute grounds/ });
  const position = await firstEvidence.boundingBox();
  expect(position?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(720);
  const historySize = await page
    .locator('.sa2-review-history span')
    .first()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(historySize).toBeGreaterThanOrEqual(13);
  await capture(
    page,
    `super-admin-v222-evidence-workspace-${testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop'}`
  );
  await page.getByRole('button', { name: '展开评审工具' }).click();
  await expect(page.getByLabel('模拟页面状态')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('V2.2.3 representative pages expose one useful H1 and move work into the desktop fold', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop hierarchy evidence.');
  await page.setViewportSize({ width: 1440, height: 900 });
  const cases = [
    [
      '/super-admin-v2/overview/usage',
      '跨产品使用情况',
      '.sa2-operator-workspace',
      620,
      'overview-usage'
    ],
    ['/super-admin-v2/data/jobs', '任务与调度中心', '.sa2-jobs-toolbar', 520, 'data-jobs'],
    [
      '/super-admin-v2/knowledge/evidence',
      '证据审核',
      '.sa2-evidence-workspace',
      520,
      'knowledge-evidence'
    ]
  ] as const;
  for (const [path, title, workspace, maxY, screenshotName] of cases) {
    await page.goto(`${urls.operations}${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const y = await page
      .locator(workspace)
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(y).toBeLessThan(maxY);
    await capture(page, `super-admin-v223-after-${screenshotName}-desktop`);
  }
});

test('V2.2.3 representative mobile workspaces start before repeated chrome consumes the fold', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('desktop'), 'Mobile hierarchy evidence.');
  await page.setViewportSize({ width: 390, height: 844 });
  const cases = [
    ['/super-admin-v2/overview/usage', '.sa2-operator-workspace', 800, 'overview-usage'],
    ['/super-admin-v2/data/jobs', '.sa2-jobs-toolbar', 560, 'data-jobs'],
    ['/super-admin-v2/knowledge/evidence', '.sa2-evidence-workspace', 500, 'knowledge-evidence']
  ] as const;
  for (const [path, workspace, maxY, screenshotName] of cases) {
    await page.goto(`${urls.operations}${path}`);
    const y = await page
      .locator(workspace)
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(y).toBeLessThan(maxY);
    await expectNoHorizontalOverflow(page);
    await capture(page, `super-admin-v223-after-${screenshotName}-mobile`);
  }
});

test('V2.2.3 representative workspaces remain primary at common laptop size', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Laptop hierarchy evidence.');
  await page.setViewportSize({ width: 1366, height: 768 });
  const cases = [
    ['/super-admin-v2/overview/usage', '.sa2-operator-workspace', 'overview-usage'],
    ['/super-admin-v2/data/jobs', '.sa2-jobs-toolbar', 'data-jobs'],
    ['/super-admin-v2/knowledge/evidence', '.sa2-evidence-workspace', 'knowledge-evidence']
  ] as const;
  for (const [path, workspace, screenshotName] of cases) {
    await page.goto(`${urls.operations}${path}`);
    await expect(page.locator(workspace)).toBeVisible();
    expect(
      await page.locator(workspace).evaluate((element) => element.getBoundingClientRect().top)
    ).toBeLessThan(620);
    await expectNoHorizontalOverflow(page);
    await capture(page, `super-admin-v223-after-${screenshotName}-laptop`);
  }
});

test('Productized Workspace dossier keeps organization, entitlement and exact Site context together', async ({
  page
}, testInfo) => {
  const assertHealthy = watchPage(page);
  await page.goto(`${urls.operations}/super-admin-v2/workspaces/directory`);

  const dossier = page.getByTestId('workspaces-directory-detail');
  await expect(dossier).toContainText('平台管理权限边界');
  await expect(dossier).toContainText('不授予客户文件、私有知识、案件或机构内部操作权限');
  await expect(dossier.getByRole('button')).toHaveCount(3);
  await dossier.getByRole('button', { name: /Acme 中国站/ }).click();
  await expect(page.getByTestId('workspace-site-detail')).toContainText('SITE-ACME-CN');
  await expect(page.getByTestId('workspace-site-detail')).toContainText('Regional Site');

  await page
    .getByRole('button', { name: /Sunrise Trading/ })
    .first()
    .click();
  await expect(dossier).toContainText('1 个 Site');
  await expect(page.getByTestId('workspace-site-detail')).toContainText('SITE-SUN-COM');
  await expect(page.getByTestId('workspace-site-detail')).toContainText('域名异常');
  await expectNoHorizontalOverflow(page);
  await capture(
    page,
    `super-admin-productized-workspace-${testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop'}`
  );
  assertHealthy();
});

test('Real Workspace directory preserves Core owner truth and exposes integration gaps', async ({
  page
}, testInfo) => {
  const observedQueries: URL[] = [];
  await page.route('**/api/internal/super-admin/workspaces?**', async (route) => {
    const requestUrl = new URL(route.request().url());
    observedQueries.push(requestUrl);
    const search = requestUrl.searchParams.get('search')?.toLowerCase();
    const status = requestUrl.searchParams.get('status');
    const items = workspaceOwnerPortfolioV2.items.filter(
      (item) =>
        (!search ||
          item.name.toLowerCase().includes(search) ||
          item.workspaceId.toLowerCase().includes(search)) &&
        (!status || item.status === status)
    );
    await route.fulfill({
      status: 200,
      json: {
        ...workspaceOwnerPortfolioV2,
        total: items.length,
        items
      }
    });
  });

  await page.goto(`${urls.operations}/super-admin-v2/workspaces/directory?mode=real`);
  await expect(page.getByRole('heading', { level: 1, name: 'Workspace 真实目录' })).toBeVisible();
  await expect(page.getByText('workspace-admin:read', { exact: true })).toBeVisible();
  await expect(page.getByTestId('real-workspace-detail')).toContainText('workspace-global-001');
  await expect(page.getByTestId('real-workspace-detail')).toContainText('客户私有数据边界');
  await expect(page.getByTestId('real-workspace-detail').getByText('暂未接入')).toHaveCount(4);
  await expect(page.getByText('SUB-ACME')).toHaveCount(0);

  await page.getByLabel('Workspace 名称或 ID').fill('archive');
  await page.getByRole('button', { name: '查询真实目录' }).click();
  await expect(page.getByTestId('real-workspace-detail')).toContainText('workspace-archive-002');
  await expect.poll(() => observedQueries.at(-1)?.searchParams.get('search')).toBe('archive');
  await expectNoHorizontalOverflow(page);
  await capture(
    page,
    `super-admin-real-workspace-${testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop'}`
  );
});

test('Real Workspace directory distinguishes permission failure from a valid empty result', async ({
  page
}) => {
  await page.route('**/api/internal/super-admin/workspaces?**', (route) =>
    route.fulfill({ status: 403, json: { code: 'WORKSPACE_ADMIN_READ_FORBIDDEN' } })
  );
  await page.goto(`${urls.operations}/super-admin-v2/workspaces/directory?mode=real&case=403`);
  await expect(page.getByTestId('real-workspace-directory')).toContainText('无读取权限');
  await expect(page.getByTestId('real-workspace-directory')).not.toContainText(
    '没有匹配的 Workspace'
  );

  await page.unroute('**/api/internal/super-admin/workspaces?**');
  await page.route('**/api/internal/super-admin/workspaces?**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        ...workspaceOwnerPortfolioV2,
        total: 0,
        summary: { total: 0, byStatus: { ACTIVE: 0, ARCHIVED: 0 } },
        items: []
      }
    })
  );
  await page.goto(`${urls.operations}/super-admin-v2/workspaces/directory?mode=real&case=empty`);
  await expect(page.getByTestId('real-workspace-directory')).toContainText('没有匹配的 Workspace');
  await expect(page.getByTestId('real-workspace-directory')).not.toContainText('Owner 暂不可用');
});

test('V2.3 Real platform overview reads three governed owners without Demo leakage', async ({
  page
}, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem('markorbit-workspace-id', 'workspace-916'));
  await page.route('**/api/internal/control-plane/data/summary', (route) =>
    route.fulfill({ status: 200, json: dataOwnerSummary })
  );
  await page.route('**/api/internal/control-plane/knowledge/evidence-supply-health', (route) =>
    route.fulfill({ status: 200, json: knowledgeOwnerHealth })
  );
  await page.route('**/api/internal/super-admin/workspaces?**', (route) =>
    route.fulfill({ status: 200, json: workspaceOwnerPortfolioV2 })
  );

  await page.goto(`${urls.operations}/super-admin-v2/overview/platform?mode=real`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('.sa2-real-banner > span')).toHaveText('真实只读');
  await expect(page.locator('.sa2-review-tools')).toHaveCount(0);
  await expect(page.getByText('DEMO REVIEW', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('real-owner-workspaces')).toContainText('CORE');
  await expect(page.getByTestId('real-owner-workspaces')).toContainText('2 Workspaces');
  await expect(page.getByTestId('real-owner-data')).toContainText('MARKORBIT_DATA_ENGINE');
  await expect(page.getByTestId('real-owner-data')).toContainText('2026');
  await expect(page.getByTestId('real-owner-knowledge')).toContainText('KNOWLEDGE');
  await expect(page.getByTestId('real-owner-knowledge')).toContainText('workspace-916');
  await expect(page.getByTestId('real-owner-data')).not.toContainText('CNIPA Gazette');
  await expectNoHorizontalOverflow(page);
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  await capture(page, `super-admin-v23-real-platform-${viewport}`);

  const dataLink = page.getByRole('link', { name: '查看 Data Engine' });
  await expect(dataLink).toHaveAttribute('href', '/super-admin-v2/data/overview?mode=real');
  await dataLink.click();
  await expect(page).toHaveURL(/\/super-admin-v2\/data\/overview\?mode=real$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Data Engine 真实摘要' })).toBeVisible();
  await expect(page.getByText('MARKORBIT_DATA_ENGINE', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, `super-admin-v23-real-data-${viewport}`);

  await page.goto(`${urls.operations}/super-admin-v2/knowledge/overview?mode=real`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Knowledge 真实摘要' })).toBeVisible();
  await expect(page.getByTestId('real-owner-knowledge')).toContainText('evidence-supply-health.v1');
  await expectNoHorizontalOverflow(page);
  await capture(page, `super-admin-v23-real-knowledge-${viewport}`);
});

test('V2.3 keeps one available owner usable when its sibling is unavailable', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('markorbit-workspace-id', 'workspace-916'));
  await page.route('**/api/internal/control-plane/data/summary', (route) =>
    route.fulfill({
      status: 503,
      json: { code: 'DATA_ENGINE_UNAVAILABLE', message: 'Data owner unavailable.' }
    })
  );
  await page.route('**/api/internal/control-plane/knowledge/evidence-supply-health', (route) =>
    route.fulfill({ status: 200, json: knowledgeOwnerHealth })
  );
  await page.route('**/api/internal/super-admin/workspaces?**', (route) =>
    route.fulfill({ status: 200, json: workspaceOwnerPortfolioV2 })
  );

  await page.goto(`${urls.operations}/super-admin-v2/overview/platform?mode=real`);
  await expect(page.getByTestId('real-owner-data')).toContainText('Owner 暂不可用');
  await expect(page.getByTestId('real-owner-data')).not.toContainText('0 个任务');
  await expect(page.getByTestId('real-owner-workspaces')).toContainText('2 Workspaces');
  await expect(page.getByTestId('real-owner-knowledge')).toContainText('workspace-916');
  await expect(page.getByTestId('real-owner-knowledge')).toContainText('部分可用');
});

test('V2.3 distinguishes authentication, permission and timeout failures', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('markorbit-workspace-id', 'workspace-916'));
  const scenarios = [
    [401, 'AUTHENTICATION_REQUIRED', '需要登录'],
    [403, 'PERMISSION_DENIED', '无读取权限'],
    [504, 'DATA_ENGINE_TIMEOUT', '读取超时']
  ] as const;

  for (const [status, code, expected] of scenarios) {
    await page.unroute('**/api/internal/control-plane/data/summary');
    await page.route('**/api/internal/control-plane/data/summary', (route) =>
      route.fulfill({ status, json: { code, message: code } })
    );
    await page.goto(`${urls.operations}/super-admin-v2/data/overview?mode=real&case=${status}`);
    await expect(page.getByTestId('real-owner-data')).toContainText(expected);
    await expect(page.getByTestId('real-owner-data')).not.toContainText('CNIPA Gazette');
  }
});

test('V2.3 preserves explicit Knowledge stale and partial owner states', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('markorbit-workspace-id', 'workspace-916'));
  const staleKnowledge = {
    ...knowledgeOwnerHealth,
    items: [
      {
        ...knowledgeOwnerHealth.items[0],
        state: 'STALE',
        coverage: { state: 'PARTIAL', reasons: ['One source is not current'] },
        freshness: {
          state: 'STALE',
          lastSuccessfulAcquisitionAt: '2026-09-01T08:00:00.000Z'
        }
      }
    ],
    summary: {
      ...knowledgeOwnerHealth.summary,
      byState: {
        HEALTHY: 0,
        DEGRADED: 0,
        STALE: 1,
        BLOCKED: 0,
        PARTIAL: 0,
        UNKNOWN: 0
      },
      stale: 1
    }
  };
  await page.route('**/api/internal/control-plane/knowledge/evidence-supply-health', (route) =>
    route.fulfill({ status: 200, json: staleKnowledge })
  );

  await page.goto(`${urls.operations}/super-admin-v2/knowledge/overview?mode=real`);
  await expect(page.getByTestId('real-owner-knowledge')).toContainText('数据过期');
  await expect(page.getByTestId('real-owner-knowledge')).toContainText('部分可用');
});

test('V2.3 renders a successful empty Knowledge owner result without a failure fallback', async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'The empty-state semantics are viewport independent.'
  );
  await page.addInitScript(() => sessionStorage.setItem('markorbit-workspace-id', 'workspace-916'));
  await page.route('**/api/internal/control-plane/knowledge/evidence-supply-health', (route) =>
    route.fulfill({
      status: 200,
      json: {
        ...knowledgeOwnerHealth,
        items: [],
        summary: {
          total: 0,
          byState: {
            HEALTHY: 0,
            DEGRADED: 0,
            STALE: 0,
            BLOCKED: 0,
            PARTIAL: 0,
            UNKNOWN: 0
          },
          coverage: { COMPLETE: 0, PARTIAL: 0, UNKNOWN: 0 },
          requiringAttention: 0,
          stale: 0,
          blocked: 0,
          recentChanges30d: 0
        }
      }
    })
  );

  await page.goto(`${urls.operations}/super-admin-v2/knowledge/overview?mode=real`);
  await expect(page.getByTestId('real-owner-knowledge')).toContainText(
    'Owner 成功返回 0 个 target'
  );
  await expect(page.getByTestId('real-owner-knowledge')).not.toContainText('Owner 暂不可用');
});

test('V2.3 Real mode never backfills unconnected pages with Demo fixtures', async ({ page }) => {
  await page.goto(`${urls.operations}/super-admin-v2/data/jobs?mode=real`);
  await expect(page.getByRole('heading', { level: 1, name: '采集任务' })).toBeVisible();
  await expect(page.getByText('暂未接入', { exact: true })).toBeVisible();
  await expect(page.getByText('CNIPA 公告增量', { exact: true })).toHaveCount(0);
  await expect(page.locator('.sa2-review-tools')).toHaveCount(0);
});

test('V2.2.1 Copy ID writes the selected object ID locally and labels the effect', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`${urls.operations}/super-admin-v2/data/overview`);
  await page.getByRole('button', { name: /CNIPA Gazette/ }).click();
  await page.getByRole('button', { name: '复制对象 ID（本地）' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DATA-CNIPA');
  await expect(page.getByRole('status')).toContainText(
    '已在本地剪贴板复制 Demo 对象 ID DATA-CNIPA'
  );
});

test('V2.2.1 filters invalidate hidden selections across every page renderer family', async ({
  page
}) => {
  const families = [
    [
      '/super-admin-v2/overview/platform',
      /Data Engine CN 批次等待批准/,
      'INC-2048',
      'overview-platform-detail'
    ],
    [
      '/super-admin-v2/workspaces/directory',
      /Global Brand LLC/,
      'WSP-ACME',
      'workspaces-directory-detail'
    ],
    ['/super-admin-v2/brain/runs', /Trademark classification/, 'BRUN-8821', 'brain-runs-detail'],
    [
      '/super-admin-v2/billing/payments',
      /Site 演示支付/,
      'payment_demo_failed',
      'commercial-object-detail'
    ]
  ] as const;
  for (const [route, selectedName, visibleId, detailId] of families) {
    await page.goto(`${urls.operations}${route}`);
    await page.getByRole('button', { name: selectedName }).first().click();
    await page.getByLabel('搜索当前模块').fill(visibleId);
    await expect(page.getByTestId(detailId)).toContainText(visibleId);
    await page.getByLabel('搜索当前模块').fill('NO-SUCH-OBJECT');
    await expect(page.getByTestId(detailId)).toHaveCount(0);
    await expect(page.locator('.sa2-inline-empty, .sa2-commerce-empty')).toContainText('没有匹配');
  }

  await page.goto(`${urls.operations}/super-admin-v2/data/packages`);
  await page.getByRole('button', { name: /PKG-WO-2408/ }).click();
  await page.getByLabel('数据包质量状态').selectOption('Ready');
  await expect(page.locator('.sa2-package-detail')).toContainText('PKG-US-2409');
  await expect(page.locator('.sa2-package-detail')).not.toContainText('PKG-WO-2408');
});

const v221ModuleTasks = [
  [
    'overview',
    '/super-admin-v2/overview/platform',
    /Data Engine CN 批次等待批准/,
    'overview-platform-detail',
    'INC-2051'
  ],
  [
    'workspaces',
    '/super-admin-v2/workspaces/directory',
    /Sunrise Trading/,
    'workspaces-directory-detail',
    'WSP-SUNRISE'
  ],
  [
    'users',
    '/super-admin-v2/users/relationships',
    /Sarah Chen → MO Labs/,
    'users-relationships-detail',
    'REL-1008-LABS'
  ],
  [
    'products',
    '/super-admin-v2/products/entitlements',
    /Pro → Site/,
    'products-entitlements-detail',
    'ENT-PRO-SITE'
  ],
  ['data', '/super-admin-v2/data/jobs', /USPTO TSDR 同步/, 'data-jobs-detail', 'RUN-US-9914'],
  [
    'knowledge',
    '/super-admin-v2/knowledge/evidence',
    /Classification practice update/,
    'knowledge-evidence-detail',
    'EVD-11841'
  ],
  [
    'brain',
    '/super-admin-v2/brain/runs',
    /Evidence summary|证据摘要/,
    'brain-runs-detail',
    'BRUN-8814'
  ],
  [
    'capabilities',
    '/super-admin-v2/capabilities/catalog',
    /Summarize governed evidence/,
    'capabilities-catalog-detail',
    'CAP-EVIDENCE-SUMMARY'
  ],
  [
    'integrations',
    '/super-admin-v2/integrations/switches',
    /Stripe · Global Brand/,
    'integrations-switches-detail',
    'AVL-STRIPE'
  ],
  [
    'operations',
    '/super-admin-v2/operations/recovery',
    /WIPO conversion replay/,
    'operations-recovery-detail',
    'RCV-9813'
  ],
  [
    'billing',
    '/super-admin-v2/billing/payments',
    /Site 演示支付/,
    'commercial-object-detail',
    'payment_demo_failed'
  ],
  [
    'governance',
    '/super-admin-v2/governance/risk',
    /Billing role escalation/,
    'governance-risk-detail',
    'RSK-1108'
  ]
] as const;

for (const [moduleId, route, objectName, detailId, objectId] of v221ModuleTasks) {
  test(`V2.2.1 ${moduleId} task selects an object and binds detail to it`, async ({ page }) => {
    await page.goto(`${urls.operations}${route}`);
    await page.getByRole('button', { name: objectName }).first().click();
    await expect(page.getByTestId(detailId)).toContainText(objectId);
    await expect(
      page.getByRole('button', { name: /预演|查看|批准|审核|处理|Sunrise Corporate/ }).last()
    ).toBeVisible();
  });
}

test('V2.2.1 stays operable at 390px and 200 percent page zoom', async ({
  page,
  context
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith('mobile'),
    'Narrow acceptance runs in mobile project.'
  );
  await page.goto(`${urls.operations}/super-admin-v2/knowledge/evidence`);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(2);
  await page.getByRole('button', { name: /Classification practice update/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('knowledge-evidence-detail')).toContainText('EVD-11841');
  await expect(page.getByRole('button', { name: '批准证据' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await expect(page.getByRole('button', { name: 'Approve evidence' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await capture(page, 'super-admin-v2-i18n-knowledge-evidence-en-200-percent');
});

test('every Super Admin V2 first and second-level route is directly reviewable', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'The route matrix is viewport-independent.'
  );
  const assertHealthy = watchPage(page);

  for (const module of adminModules) {
    for (const secondaryPage of module.pages) {
      await page.goto(`${urls.operations}${routeFor(module, secondaryPage)}`);
      await expect(page.locator('.sa2-module-name')).toHaveText(module.label);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const headings = await page
        .locator('main h1, main h2, main h3, main h4, main h5, main h6')
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const style = getComputedStyle(element);
              return style.display !== 'none' && style.visibility !== 'hidden';
            })
            .map((element) => ({
              level: Number(element.tagName.slice(1)),
              text: element.textContent?.replace(/\s+/g, ' ').trim() ?? ''
            }))
        );
      expect(headings[0]?.level).toBe(1);
      for (let index = 1; index < headings.length; index += 1) {
        expect(headings[index].level - headings[index - 1].level).toBeLessThanOrEqual(1);
        expect(headings[index].text).not.toBe(headings[index - 1].text);
      }
      await expect(
        page
          .getByRole('navigation', { name: `${module.label} 二级导航` })
          .getByRole('link', { name: secondaryPage.label, exact: true })
      ).toHaveAttribute('aria-current', 'page');

      if (
        module.id === 'data' ||
        module.id === 'knowledge' ||
        module.id === 'overview' ||
        module.id === 'operations' ||
        module.id === 'integrations' ||
        module.id === 'workspaces' ||
        module.id === 'users' ||
        module.id === 'products' ||
        module.id === 'brain' ||
        module.id === 'capabilities' ||
        module.id === 'billing' ||
        module.id === 'governance'
      ) {
        await expect(page.getByTestId(`${module.id}-page-${secondaryPage.id}`)).toBeVisible();
        await capture(page, `super-admin-v2-${module.id}-${secondaryPage.id}-desktop`);
      }
    }
  }

  assertHealthy();
});

const simplifiedNavigationTasks = [
  ['系统状态', '/super-admin-v2/overview/health'],
  ['查找工作空间', '/super-admin-v2/workspaces/directory'],
  ['查看用户权限', '/super-admin-v2/users/roles'],
  ['处理失败任务', '/super-admin-v2/operations/recovery'],
  ['检查数据源', '/super-admin-v2/data/sources'],
  ['管理产品', '/super-admin-v2/products/portfolio'],
  ['查看 API 状态', '/super-admin-v2/integrations/health'],
  ['查询审计日志', '/super-admin-v2/governance/audit']
] as const;

test('Super Admin V2 groups modules by operator task and keeps exact owner routes', async ({
  page
}, testInfo) => {
  const mobile = testInfo.project.name.startsWith('mobile');
  await page.goto(`${urls.operations}/super-admin-v2/overview/platform`);
  if (mobile) await page.getByRole('button', { name: '打开导航' }).click();

  const primary = page.getByRole('navigation', { name: '全局一级导航' });
  for (const group of ['工作台', '业务管理', '数据与智能', 'AI 与能力', '平台运维']) {
    await expect(primary.getByText(group, { exact: true })).toBeVisible();
  }
  await expect(primary.getByRole('link')).toHaveCount(12);
  await expect(primary.getByRole('link', { name: 'AI 编排', exact: true })).toHaveAttribute(
    'href',
    '/super-admin-v2/brain/overview'
  );
  await expect(primary.getByRole('link', { name: '能力目录', exact: true })).toHaveAttribute(
    'href',
    '/super-admin-v2/capabilities/overview'
  );
  await capture(page, `super-admin-v2-simplified-navigation-zh-${mobile ? 'mobile' : 'desktop'}`);

  await page.locator('.sa2-task-menu').getByText('常用任务', { exact: true }).click();
  const taskNav = page.getByRole('navigation', { name: '常用任务' });
  await expect(taskNav.getByRole('link')).toHaveCount(simplifiedNavigationTasks.length);
  for (const [label, route] of simplifiedNavigationTasks) {
    await expect(taskNav.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      route
    );
  }
  if (mobile) {
    const governanceLink = primary.getByRole('link', { name: '安全与审计', exact: true });
    await governanceLink.scrollIntoViewIfNeeded();
    await expect(governanceLink).toBeVisible();
  }
  await capture(page, `super-admin-v2-common-tasks-zh-${mobile ? 'mobile' : 'desktop'}`);

  await taskNav.getByRole('link', { name: '处理失败任务', exact: true }).click();
  await expect(page).toHaveURL(/\/super-admin-v2\/operations\/recovery$/);
  await expect(page.getByTestId('operations-page-recovery')).toBeVisible();

  await page.goto(`${urls.operations}/super-admin-v2/overview/platform?mode=real`);
  if (mobile) await page.getByRole('button', { name: '打开导航' }).click();
  await page.locator('.sa2-task-menu').getByText('常用任务', { exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: '常用任务' }).getByRole('link', {
      name: '检查数据源',
      exact: true
    })
  ).toHaveAttribute('href', '/super-admin-v2/data/sources?mode=real');

  if (mobile) await page.locator('.sa2-close-nav').click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.goto(`${urls.operations}/super-admin-v2/overview/platform`);
  if (mobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  const englishPrimary = page.getByRole('navigation', { name: 'Primary navigation' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await englishPrimary.evaluate((element) => element.scrollTo(0, 0));
  for (const group of [
    'Workspace',
    'Business Management',
    'Data & Intelligence',
    'AI & Capabilities',
    'Platform Operations'
  ]) {
    await expect(englishPrimary.getByText(group, { exact: true })).toBeVisible();
  }
  await expect(englishPrimary.getByRole('link', { name: 'AI Orchestration' })).toHaveAttribute(
    'href',
    '/super-admin-v2/brain/overview'
  );
  await expect(englishPrimary.getByRole('link', { name: 'Capability Catalog' })).toHaveAttribute(
    'href',
    '/super-admin-v2/capabilities/overview'
  );
  await capture(page, `super-admin-v2-simplified-navigation-en-${mobile ? 'mobile' : 'desktop'}`);
});

test('Super Admin V2 defaults to Chinese and restores an English preference without losing task context', async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'State and persistence semantics are viewport independent.'
  );
  await page.addInitScript(() => {
    if (sessionStorage.getItem('sa2-i18n-test-started')) return;
    localStorage.removeItem('markorbit.super-admin-v2.locale');
    sessionStorage.setItem('sa2-i18n-test-started', 'true');
  });
  await page.goto(`${urls.operations}/super-admin-v2/data/jobs`);

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: '简体中文', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: /USPTO TSDR/ }).click();
  await expect(page.getByTestId('data-jobs-detail')).toContainText('RUN-US-9914');

  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.getByTestId('data-jobs-detail')).toContainText('RUN-US-9914');
  await expect(page).toHaveURL(/\/super-admin-v2\/data\/jobs$/);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('Super Admin V2 language switching preserves an evidence draft and protected confirmation', async ({
  page
}) => {
  await page.addInitScript(() => localStorage.setItem('markorbit.super-admin-v2.locale', 'zh-CN'));
  await page.goto(`${urls.operations}/super-admin-v2/knowledge/evidence`);
  await page.getByRole('button', { name: /Classification practice update/ }).click();
  await page.getByLabel('审核说明').fill('EVD-11841 双语评审草稿');
  await page.getByLabel('定位准确性').selectOption('需修正');
  await page.getByRole('button', { name: '批准证据' }).click();

  const dialog = page.getByRole('dialog');
  const reason = dialog.locator('textarea');
  await reason.fill('双语确认仍绑定 EVD-11841');
  await dialog.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await expect(reason).toHaveValue('双语确认仍绑定 EVD-11841');
  await expect(dialog).toContainText('EVD-11841');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByTestId('knowledge-evidence-detail')).toContainText('EVD-11841');
  await expect(page.getByLabel('Review note')).toHaveValue('EVD-11841 双语评审草稿');
  await expect(page.getByLabel('Locator accuracy')).toHaveValue('需修正');
});

test('Super Admin V2 keeps API credential and permission selections stable across locales', async ({
  page
}) => {
  await page.addInitScript(() => localStorage.setItem('markorbit.super-admin-v2.locale', 'zh-CN'));

  await page.goto(`${urls.operations}/super-admin-v2/integrations/credentials`);
  await page.locator('.sa2-object-browser > button').filter({ hasText: 'CRED-STR-04' }).click();
  await expect(page.getByTestId('integrations-credentials-detail')).toContainText('CRED-STR-04');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByTestId('integrations-credentials-detail')).toContainText('CRED-STR-04');

  await page.goto(`${urls.operations}/super-admin-v2/users/roles`);
  await page.locator('.sa2-object-browser > button').filter({ hasText: 'ROLE-IP-ADMIN' }).click();
  await expect(page.getByTestId('users-roles-detail')).toContainText('ROLE-IP-ADMIN');
  await page.getByRole('button', { name: '简体中文', exact: true }).click();
  await expect(page.getByTestId('users-roles-detail')).toContainText('ROLE-IP-ADMIN');
});

test('Super Admin V2 bilingual representatives remain usable at desktop and 390px', async ({
  page
}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('markorbit.super-admin-v2.locale', 'zh-CN'));
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  const representatives = [
    ['/super-admin-v2/overview/platform', 'overview'],
    ['/super-admin-v2/workspaces/directory', 'workspace-directory'],
    ['/super-admin-v2/data/jobs', 'data-jobs'],
    ['/super-admin-v2/knowledge/evidence', 'knowledge-evidence']
  ] as const;

  for (const [route, name] of representatives) {
    await page.goto(`${urls.operations}${route}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await capture(page, `super-admin-v2-i18n-${name}-zh-${viewport}`);

    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page.locator('.sa2-i18n-root')).toHaveAttribute('data-i18n-missing-count', '0');
    await expectNoHorizontalOverflow(page);
    await capture(page, `super-admin-v2-i18n-${name}-en-${viewport}`);
    await page.getByRole('button', { name: '简体中文', exact: true }).click();
  }

  if (!testInfo.project.name.startsWith('mobile')) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${urls.operations}/super-admin-v2/workspaces/directory`);
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expectNoHorizontalOverflow(page);
    await capture(page, 'super-admin-productized-workspace-en-laptop');
  }
});

test('Super Admin V2 English locale has no untranslated visible UI across every registered route', async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'The translation-key route audit is viewport independent.'
  );
  await page.addInitScript(() => localStorage.setItem('markorbit.super-admin-v2.locale', 'en-US'));
  const failures: string[] = [];

  for (const module of adminModules) {
    for (const secondaryPage of module.pages) {
      const route = routeFor(module, secondaryPage);
      await page.goto(`${urls.operations}${route}`);
      const root = page.locator('.sa2-i18n-root');
      await expect(root).toHaveAttribute('data-locale', 'en-US');
      await expect.poll(async () => root.getAttribute('data-i18n-missing-count')).not.toBeNull();
      const missing = await root.getAttribute('data-i18n-missing');
      if (missing) failures.push(`${route}: ${missing}`);
    }
  }

  expect(failures, failures.join('\n')).toEqual([]);
});
