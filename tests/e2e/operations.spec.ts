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

  await expect(page.getByRole('heading', { name: '总览', exact: true })).toBeVisible();
  await expect(page.getByText('演示数据 · 仅供产品评审')).toBeVisible();
  await expect(page.getByText('DEMO REVIEW', { exact: true })).toBeVisible();

  if (testInfo.project.name.startsWith('mobile')) {
    await page.getByRole('button', { name: '打开导航' }).click();
  }
  const primary = page.getByRole('navigation', { name: '全局一级导航' });
  await expect(primary.getByRole('link')).toHaveCount(12);
  await primary.getByRole('link', { name: /^Data Engine/ }).click();
  await expect(page).toHaveURL(/\/super-admin-v2\/data\/overview$/);
  await expect(page.getByTestId('data-page-overview')).toBeVisible();

  await page.getByRole('link', { name: '任务与调度', exact: true }).click();
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
  await expect(page.getByTestId('workspaces-directory-detail')).toContainText(
    'Subscription SUB-GB'
  );

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

test('every Super Admin V2 first and second-level route is directly reviewable', async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'The route matrix is viewport-independent.'
  );
  const assertHealthy = watchPage(page);

  for (const module of adminModules) {
    for (const secondaryPage of module.pages) {
      await page.goto(`${urls.operations}${routeFor(module, secondaryPage)}`);
      await expect(page.getByRole('heading', { name: module.label, exact: true })).toBeVisible();
      await expect(page.locator('.sa2-page-intro h2')).toHaveText(secondaryPage.label);
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
        module.id === 'capabilities'
      ) {
        await expect(page.getByTestId(`${module.id}-page-${secondaryPage.id}`)).toBeVisible();
        await capture(page, `super-admin-v2-${module.id}-${secondaryPage.id}-desktop`);
      }
    }
  }

  assertHealthy();
});
