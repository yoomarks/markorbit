import { describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  parseInternalWorkspacePrincipal,
  PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
  type WorkspacePrincipal
} from '../src/index.js';

const principal = (role: WorkspacePrincipal['role']): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_order-permission',
  userId: 'user_order-permission',
  workspaceId: '44444444-4444-4444-8444-444444444444',
  membershipId: 'membership_order-permission',
  role,
  permissions: ROLE_PERMISSION_MATRIX[role],
  sessionExpiresAt: '2026-08-09T00:00:00.000Z'
});

describe('Milestone 3 Order permission canon', () => {
  it('adds each bounded Order permission exactly once', () => {
    const orderPermissions = [
      'order:create',
      'order:read',
      'order:update',
      'order:confirm',
      'order:matter:create',
      'order:cancel',
      'order:audit:read'
    ] as const;
    expect(PERMISSIONS).toEqual(expect.arrayContaining([...orderPermissions]));
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('gives administrators and Matter managers protected Order authority', () => {
    for (const role of ['WORKSPACE_ADMIN', 'MATTER_MANAGER'] as const)
      expect(ROLE_PERMISSION_MATRIX[role]).toEqual(
        expect.arrayContaining([
          'order:create',
          'order:read',
          'order:update',
          'order:confirm',
          'order:matter:create',
          'order:cancel',
          'order:audit:read'
        ])
      );
  });

  it('keeps reviewer and read-only Order authority read-only', () => {
    for (const role of ['REVIEWER', 'READ_ONLY'] as const) {
      expect(ROLE_PERMISSION_MATRIX[role]).toContain('order:read');
      expect(ROLE_PERMISSION_MATRIX[role]).not.toEqual(expect.arrayContaining(['order:create']));
      expect(ROLE_PERMISSION_MATRIX[role]).not.toEqual(expect.arrayContaining(['order:update']));
      expect(ROLE_PERMISSION_MATRIX[role]).not.toEqual(expect.arrayContaining(['order:confirm']));
      expect(ROLE_PERMISSION_MATRIX[role]).not.toEqual(expect.arrayContaining(['order:cancel']));
    }
  });

  it('round-trips the new permissions through the internal Principal boundary', () => {
    const manager = principal('MATTER_MANAGER');
    expect(parseInternalWorkspacePrincipal(encodeInternalWorkspacePrincipal(manager))).toEqual(
      manager
    );
  });

  it('rejects a forged permission outside the canonical permission vocabulary', () => {
    const forged = {
      schemaVersion: 1,
      principal: {
        ...principal('MATTER_MANAGER'),
        permissions: [...ROLE_PERMISSION_MATRIX.MATTER_MANAGER, 'order:file-externally']
      }
    };
    const encoded = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url');
    expect(() => parseInternalWorkspacePrincipal(encoded)).toThrow(/invalid/i);
  });
});
