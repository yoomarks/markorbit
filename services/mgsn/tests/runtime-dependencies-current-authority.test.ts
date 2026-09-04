import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpCoreCurrentWorkspaceAuthoritySource } from '../src/runtime-dependencies.js';

const workspaceId = '018f0000-0000-7000-8000-000000000715';
const userId = '018f0000-0000-7000-8000-000000000716';
const membershipId = '018f0000-0000-7000-8000-000000000717';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MGSN Core current Workspace authority HTTP adapter', () => {
  it('sends only bounded non-bearer identity references and accepts an exact positive response', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        response(200, {
          schemaVersion: 1,
          authorityAvailable: true,
          workspaceCurrent: true,
          userCurrent: true,
          membershipCurrent: true,
          bindingMatches: true,
          permissionCurrent: null,
          workspace: { workspaceId, version: 2 },
          user: { userId, version: 3 },
          membership: {
            membershipId,
            workspaceId,
            userId,
            role: 'OWNER',
            version: 4
          },
          requiredPermission: null
        })
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const source = new HttpCoreCurrentWorkspaceAuthoritySource(
      'http://core.internal',
      'internal-secret'
    );

    await expect(source.validateCurrent({ workspaceId, userId, membershipId })).resolves.toEqual({
      authorityAvailable: true,
      current: true,
      authorityReferences: [
        `core-workspace:${workspaceId}:v2`,
        `core-user:${userId}:v3`,
        `core-membership:${membershipId}:v4`
      ]
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe('internal-secret');
    expect(headers.authorization).toBeUndefined();
    expect(JSON.parse(String(init?.body))).toEqual({ workspaceId, userId, membershipId });
  });

  it('maps known Core denials to current=false without leaking account state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response(409, { code: 'CURRENT_AUTHORITY_DENIED' })))
    );
    const source = new HttpCoreCurrentWorkspaceAuthoritySource(
      'http://core.internal',
      'internal-secret'
    );

    await expect(source.validateCurrent({ workspaceId, userId, membershipId })).resolves.toEqual({
      authorityAvailable: true,
      current: false,
      authorityReferences: []
    });
  });

  it('maps service-auth, transport and malformed positive responses to authority unavailable', async () => {
    const source = new HttpCoreCurrentWorkspaceAuthoritySource(
      'http://core.internal',
      'internal-secret'
    );

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response(401, {}))));
    await expect(source.validateCurrent({ workspaceId, userId, membershipId })).resolves.toEqual({
      authorityAvailable: false,
      current: false,
      authorityReferences: []
    });

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response(200, { schemaVersion: 1 }))));
    await expect(source.validateCurrent({ workspaceId, userId, membershipId })).resolves.toEqual({
      authorityAvailable: false,
      current: false,
      authorityReferences: []
    });

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network unavailable'))));
    await expect(source.validateCurrent({ workspaceId, userId, membershipId })).resolves.toEqual({
      authorityAvailable: false,
      current: false,
      authorityReferences: []
    });
  });
});
