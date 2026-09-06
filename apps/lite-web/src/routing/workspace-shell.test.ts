import { describe, expect, it } from 'vitest';
import {
  LITE_PRIMARY_NAV,
  LITE_SURFACES,
  liteHashForSurface,
  litePrimaryForSurface,
  liteSurfaceFromHash
} from './workspace-shell.js';

describe('Workspace Shell registry', () => {
  it('keeps the primary shell intentionally bounded to five destinations', () => {
    expect(LITE_PRIMARY_NAV.map((item) => item.label)).toEqual([
      'Today',
      'Matters',
      'Create',
      'Portfolio',
      'Work'
    ]);
  });

  it('preserves every Phase 1 deep-link hash', () => {
    for (const definition of Object.values(LITE_SURFACES)) {
      expect(liteSurfaceFromHash(definition.hash)).toBe(definition.surface);
      expect(liteHashForSurface(definition.surface)).toBe(definition.hash);
    }
  });

  it('groups specialist tools under Work without changing their deep links', () => {
    for (const surface of [
      'opportunities',
      'capability',
      'guide',
      'professional-review',
      'execution-release',
      'customers'
    ] as const) {
      expect(litePrimaryForSurface(surface)).toBe('work');
    }
  });
});
