import { describe, expect, it } from 'vitest';
import { superAdminDomainLandings } from './domain-landings.js';
import { superAdminNavigationItems } from './shell.js';

const expectedNavigation = [
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
] as const;

describe('Super Admin shell', () => {
  it('freezes the platform-wide top-level navigation', () => {
    expect(superAdminNavigationItems.map((item) => item.label)).toEqual(expectedNavigation);
    expect(new Set(superAdminNavigationItems.map((item) => item.href)).size).toBe(
      expectedNavigation.length
    );
  });

  it('gives every not-yet-connected domain an explicit truthful landing', () => {
    const navigationTargets = new Set<string>(superAdminNavigationItems.map((item) => item.href));
    expect(superAdminDomainLandings.map((item) => item.title)).toEqual([
      'Core',
      'MarkReg',
      'Lite',
      'MGSN',
      'Execution',
      'System',
      'Governance & Audit'
    ]);
    for (const landing of superAdminDomainLandings) {
      expect(navigationTargets.has(`#${landing.id}`)).toBe(true);
      expect(landing.status.length).toBeGreaterThan(0);
      expect(landing.boundary.length).toBeGreaterThan(0);
    }
  });
});
