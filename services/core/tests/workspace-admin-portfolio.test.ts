import { describe, expect, it, vi } from 'vitest';
import { PostgresWorkspaceAdminPortfolioReaderV1 } from '../src/workspace-admin-portfolio.js';

const row = {
  workspace_id: '018f0000-0000-7000-8000-000000000967',
  name: 'Alpha Workspace',
  slug: 'alpha-workspace',
  status: 'ACTIVE',
  version: 3,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-06T00:00:00.000Z',
  membership_count: 4,
  active_membership_count: 3,
  total_count: 12
};

function reader(rows: Record<string, unknown>[]) {
  const query = vi.fn((sql: string, values?: readonly unknown[]) => {
    void sql;
    void values;
    return Promise.resolve({ rows });
  });
  return {
    query,
    reader: new PostgresWorkspaceAdminPortfolioReaderV1(
      { query } as never,
      () => new Date('2026-09-07T10:00:00.000Z')
    )
  };
}
describe('Workspace admin portfolio reader', () => {
  it('returns bounded Core-owned Workspace and membership facts', async () => {
    const { reader: service } = reader([row]);
    await expect(
      service.read({ page: 2, pageSize: 10, status: 'ACTIVE', search: 'Alpha Workspace' })
    ).resolves.toEqual({
      schemaVersion: 1,
      objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT',
      owner: 'CORE',
      access: 'READ_ONLY',
      requiredAuthority: 'workspace-admin:read',
      observedAt: '2026-09-07T10:00:00.000Z',
      page: 2,
      pageSize: 10,
      total: 12,
      items: [
        expect.objectContaining({
          workspaceId: row.workspace_id,
          membershipCount: 4,
          activeMembershipCount: 3
        })
      ]
    });
  });

  it('uses one deterministic owner-local aggregate query without cross-service joins', async () => {
    const { query, reader: service } = reader([row]);
    await service.read({ page: 2, pageSize: 10, status: 'ARCHIVED' });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, values] = query.mock.calls[0]!;
    expect(String(sql)).toContain('workspace_memberships');
    expect(String(sql)).toContain('ORDER BY lower(name), workspace_id');
    expect(String(sql)).not.toMatch(/orders|payments|matters|knowledge|data_engine/iu);
    expect(values).toEqual(['ARCHIVED', null, 10, 10]);
  });
  it('keeps an out-of-range page empty while preserving the owner total', async () => {
    const { reader: service } = reader([{ workspace_id: null, total_count: 12 }]);
    await expect(service.read({ page: 9, pageSize: 50 })).resolves.toMatchObject({
      owner: 'CORE',
      total: 12,
      items: []
    });
  });
  it('returns zero only when the owner query reports no Workspaces', async () => {
    const { reader: service } = reader([{ workspace_id: null, total_count: 0 }]);
    await expect(service.read({ page: 1, pageSize: 50 })).resolves.toMatchObject({
      owner: 'CORE',
      total: 0,
      items: []
    });
  });
});
