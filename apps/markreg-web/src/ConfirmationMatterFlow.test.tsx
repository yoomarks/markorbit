import { describe, expect, it } from 'vitest';
import { requireConfirmationWorkspaceId } from './ConfirmationMatterFlow.js';

describe('requireConfirmationWorkspaceId', () => {
  it('preserves the authenticated canonical Workspace identity', () => {
    expect(requireConfirmationWorkspaceId('55555555-5555-4555-8555-555555555555')).toBe(
      '55555555-5555-4555-8555-555555555555'
    );
  });

  it('fails closed when no authenticated Workspace identity is available', () => {
    expect(() => requireConfirmationWorkspaceId(undefined)).toThrow(
      'Authenticated Workspace is required to confirm the selected Quote.'
    );
    expect(() => requireConfirmationWorkspaceId('   ')).toThrow(
      'Authenticated Workspace is required to confirm the selected Quote.'
    );
  });
});
