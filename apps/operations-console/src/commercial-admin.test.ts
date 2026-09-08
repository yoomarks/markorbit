import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ADMIN_BOUNDARY_TEXT,
  COMMERCIAL_ADMIN_NOT_MODELED_TEXT,
  COMMERCIAL_ADMIN_SCOPE_TEXT
} from './commercial-admin.js';

describe('Super Admin Commercial / Payment semantics', () => {
  it('keeps platform and Workspace scopes distinct', () => {
    const scope = COMMERCIAL_ADMIN_SCOPE_TEXT.toLowerCase();
    expect(scope).toContain('platform-level owner reads');
    expect(scope).toContain('workspace-scoped');
    expect(scope).toContain('does not grant authority');
  });

  it('does not infer plan, entitlement or paid-state from history', () => {
    const text = COMMERCIAL_ADMIN_NOT_MODELED_TEXT.toLowerCase();
    expect(text).toContain('not_yet_modeled');
    expect(text).toContain('historical orders or payments');
    expect(text).toContain('must not be used to infer');
  });

  it('locks owner objects away from adjacent authority semantics', () => {
    const boundary = COMMERCIAL_ADMIN_BOUNDARY_TEXT.toLowerCase();
    for (const term of [
      'product/price',
      'entitlement',
      'formal matter',
      'provider acceptance',
      'official truth'
    ])
      expect(boundary).toContain(term);
  });
});
