import { describe, expect, it, vi } from 'vitest';
import { OwnerReadError } from './owner-read-error.js';
import { loadWorkspaceAdminPortfolio, renameWorkspaceDisplayName } from './workspace-admin.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const managedWorkspace = {
  workspaceId,
  name: 'Renamed Workspace',
  slug: 'alpha-workspace',
  status: 'ACTIVE',
  version: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-08T00:30:00.000Z'
} as const;

const portfolio = {
  schemaVersion: 1,
  objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT',
  owner: 'CORE',
  access: 'READ_ONLY',
  requiredAuthority: 'workspace-admin:read',
  observedAt: '2026-09-28T01:00:00.000Z',
  page: 1,
  pageSize: 50,
  sort: 'UPDATED_AT',
  direction: 'DESC',
  total: 1,
  summary: { total: 1, byStatus: { ACTIVE: 1, ARCHIVED: 0 } },
  items: [
    {
      ...managedWorkspace,
      name: 'Acme IP',
      membershipCount: 12,
      activeMembershipCount: 11
    }
  ]
} as const;

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestBody(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') throw new Error('Expected JSON request body.');
  return JSON.parse(init.body) as unknown;
}

function response(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

async function readOwnerError(promise: Promise<unknown>): Promise<OwnerReadError> {
  try {
    await promise;
  } catch (cause: unknown) {
    if (cause instanceof OwnerReadError) return cause;
    throw cause;
  }
  throw new Error('Expected the owner read to fail.');
}

describe('Workspace Admin rename client', () => {
  it('gets CSRF from the browser session and sends the bounded owner command', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls += 1;
        const target = requestUrl(input);
        if (calls === 1) {
          expect(target).toBe('/api/auth/session');
          expect(init?.method).toBe('GET');
          return response({ csrfToken: 'csrf-token' });
        }
        expect(target).toBe(`/api/internal/super-admin/workspaces/${workspaceId}/display-name`);
        expect(init?.method).toBe('PATCH');
        const headers = new Headers(init?.headers);
        expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-token');
        expect(headers.get('idempotency-key')).toBeTruthy();
        expect(requestBody(init)).toEqual({
          expectedVersion: 3,
          displayName: 'Renamed Workspace',
          reason: 'Correct display name.'
        });
        return response(managedWorkspace);
      }
    );
    await expect(
      renameWorkspaceDisplayName(
        workspaceId,
        3,
        'Renamed Workspace',
        'Correct display name.',
        fetchImpl
      )
    ).resolves.toEqual(managedWorkspace);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not send a mutation when the authenticated session has no CSRF token', async () => {
    const fetchImpl: typeof fetch = vi.fn(() => response({ authenticated: true }));
    await expect(
      renameWorkspaceDisplayName(workspaceId, 3, 'Renamed Workspace', 'Reason', fetchImpl)
    ).rejects.toThrow('Workspace management session is unavailable.');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a malformed successful owner response', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = vi.fn(() => {
      calls += 1;
      return calls === 1
        ? response({ csrfToken: 'csrf-token' })
        : response({ ...managedWorkspace, version: 0 });
    });
    await expect(
      renameWorkspaceDisplayName(workspaceId, 3, 'Renamed Workspace', 'Reason', fetchImpl)
    ).rejects.toThrow('Workspace rename owner response is malformed');
  });
});

describe('Workspace Admin portfolio client', () => {
  const query = {
    page: 1,
    pageSize: 50,
    sort: 'UPDATED_AT',
    direction: 'DESC'
  } as const;

  it('reads the bounded Core portfolio with browser credentials', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        expect(requestUrl(input)).toContain('/api/internal/super-admin/workspaces?');
        expect(init?.credentials).toBe('include');
        return response(portfolio);
      }
    );
    await expect(loadWorkspaceAdminPortfolio(query, fetchImpl)).resolves.toEqual(portfolio);
  });

  it('keeps permission failure distinct from empty owner truth', async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      response({ code: 'WORKSPACE_ADMIN_READ_FORBIDDEN' }, 403)
    );
    const error = await readOwnerError(loadWorkspaceAdminPortfolio(query, fetchImpl));
    expect(error.kind).toBe('permission');
  });

  it('fails closed when a successful owner payload is malformed', async () => {
    const fetchImpl: typeof fetch = vi.fn(() => response({ ...portfolio, owner: 'BROWSER' }));
    const error = await readOwnerError(loadWorkspaceAdminPortfolio(query, fetchImpl));
    expect(error.kind).toBe('contract');
  });
});
