import { describe, expect, it, vi } from 'vitest';
import { renameWorkspaceDisplayName } from './workspace-admin.js';

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
