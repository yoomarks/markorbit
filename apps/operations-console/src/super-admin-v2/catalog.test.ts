import { describe, expect, it } from 'vitest';
import {
  adminModules,
  adminNavigationGroups,
  DEFAULT_ROUTE,
  resolveRoute,
  routeFor
} from './catalog.js';
import { DEMO_FIXTURE_NOTICE, demoRecords, moduleMetrics } from './fixtures.js';
import { DATA_ENGINE_PAGE_IDS } from './DataEnginePages.js';
import { KNOWLEDGE_PAGE_IDS } from './KnowledgePages.js';
import { BATCH_A_PAGE_IDS } from './ControlPlanePages.js';
import { BATCH_B_PAGE_IDS } from './OrganizationPages.js';
import { BATCH_C_PAGE_IDS } from './IntelligencePages.js';
import { BATCH_D_PAGE_IDS } from './TrustPages.js';
import { COMMERCIAL_PAGE_IDS } from './CommercialManagementPages.js';

describe('Super Admin V2 navigation catalog', () => {
  it('freezes twelve unique first-level modules with addressable secondary pages', () => {
    expect(adminModules).toHaveLength(12);
    expect(new Set(adminModules.map((module) => module.id))).toHaveLength(12);
    expect(adminModules.every((module) => module.pages.length >= 5)).toBe(true);

    const routes = adminModules.flatMap((module) =>
      module.pages.map((page) => routeFor(module, page))
    );
    expect(new Set(routes).size).toBe(routes.length);
    for (const path of routes) {
      const resolved = resolveRoute(path);
      expect(routeFor(resolved.module, resolved.page)).toBe(path);
    }
  });

  it('places every owner module in exactly one task-oriented navigation group', () => {
    const groupedModuleIds = adminNavigationGroups.flatMap((group) => group.moduleIds);
    expect(adminNavigationGroups).toHaveLength(5);
    expect(groupedModuleIds).toHaveLength(adminModules.length);
    expect(new Set(groupedModuleIds)).toEqual(new Set(adminModules.map((module) => module.id)));
  });

  it('marks unknown paths invalid while retaining a safe navigation fallback', () => {
    expect(resolveRoute('/not-super-admin').isValid).toBe(false);
    expect(resolveRoute('/super-admin-v2/missing/page').isValid).toBe(false);
    expect(routeFor(resolveRoute('/not-super-admin').module)).toBe(DEFAULT_ROUTE);
  });

  it('provides explicitly labelled fixtures and module-specific review evidence', () => {
    expect(DEMO_FIXTURE_NOTICE).toContain('演示数据');
    expect(DEMO_FIXTURE_NOTICE).toContain('不代表');
    for (const module of adminModules) {
      expect(moduleMetrics[module.id]).toHaveLength(4);
      expect(demoRecords(module.id).length).toBeGreaterThanOrEqual(3);
      expect(demoRecords(module.id).every((record) => record.owner.length > 0)).toBe(true);
    }
  });

  it('has a dedicated V2.1 workspace renderer for every Data Engine and Knowledge page', () => {
    expect(DATA_ENGINE_PAGE_IDS).toEqual(
      adminModules.find((module) => module.id === 'data')?.pages.map((page) => page.id)
    );
    expect(KNOWLEDGE_PAGE_IDS).toEqual(
      adminModules.find((module) => module.id === 'knowledge')?.pages.map((page) => page.id)
    );
  });

  it('has a dedicated V2.2 batch A definition for every overview, operations and integration page', () => {
    for (const moduleId of ['overview', 'operations', 'integrations'] as const) {
      expect(BATCH_A_PAGE_IDS[moduleId]).toEqual(
        adminModules.find((module) => module.id === moduleId)?.pages.map((page) => page.id)
      );
    }
  });

  it('has a dedicated V2.2 batch B definition for every Workspace, user and product page', () => {
    for (const moduleId of ['workspaces', 'users', 'products'] as const) {
      expect(BATCH_B_PAGE_IDS[moduleId]).toEqual(
        adminModules.find((module) => module.id === moduleId)?.pages.map((page) => page.id)
      );
    }
  });

  it('has a dedicated V2.2 batch C definition for every Brain and Capability page', () => {
    for (const moduleId of ['brain', 'capabilities'] as const) {
      expect(BATCH_C_PAGE_IDS[moduleId]).toEqual(
        adminModules.find((module) => module.id === moduleId)?.pages.map((page) => page.id)
      );
    }
  });

  it('has dedicated commercial and governance definitions for every page', () => {
    expect(COMMERCIAL_PAGE_IDS).toEqual(
      adminModules.find((module) => module.id === 'billing')?.pages.map((page) => page.id)
    );
    expect(BATCH_D_PAGE_IDS.governance).toEqual(
      adminModules.find((module) => module.id === 'governance')?.pages.map((page) => page.id)
    );
  });
});
