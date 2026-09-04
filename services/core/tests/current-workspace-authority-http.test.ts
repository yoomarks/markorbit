import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';
import { createCurrentWorkspaceAuthorityRoutes } from '../src/current-workspace-authority-http.js';
import {
  CurrentWorkspaceAuthorityError,
  type CurrentWorkspaceAuthorityRequest,
  type CurrentWorkspaceAuthorityResult
} from '../src/current-workspace-authority.js';

const secret = 'core-current-authority-secret-32-bytes';
const ids = {
  user: '018f0000-0000-7000-8000-000000000001',
  workspace: '018f0000-0000-7000-8000-000000000002',
  membership: '018f0000-0000-7000-8000-000000000003'
};

const command: CurrentWorkspaceAuthorityRequest = {
  workspaceId: ids.workspace,
  userId: ids.user,
  membershipId: ids.membership,
  expectedMembershipVersion: 3,
  requiredPermission: 'review:perform'
};

const result: CurrentWorkspaceAuthorityResult = {
  schemaVersion: 1,
  authorityAvailable: true,
  workspaceCurrent: true,
  userCurrent: true,
  membershipCurrent: true,
  bindingMatches: true,
  permissionCurrent: true,
  workspace: { workspaceId: ids.workspace, version: 4 },
  user: { userId: ids.user, version: 2 },
  membership: {
    membershipId: ids.membership,
    workspaceId: ids.workspace,
    userId: ids.user,
    role: 'REVIEWER',
    version: 3
  },
  requiredPermission: 'review:perform'
};

function request(body: unknown = command, authorization: string | undefined = secret): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/auth/workspace-authority/validate-current',
    params: {},
    query: {},
    headers: { 'x-markorbit-internal-authorization': authorization },
    body
  };
}

function route(
  validate: (
    input: Readonly<CurrentWorkspaceAuthorityRequest>
  ) =>
    Promise<Readonly<CurrentWorkspaceAuthorityResult>> | Readonly<CurrentWorkspaceAuthorityResult>
) {
  return createCurrentWorkspaceAuthorityRoutes({
    internalServiceSecret: secret,
    service: { validate }
  })[0]!;
}

describe('current Workspace authority HTTP boundary', () => {
  it('authenticates the internal caller and forwards only the bounded authority request', async () => {
    const validate = vi.fn(() => Promise.resolve(result));
    const response = await route(validate).handle(request());

    expect(response).toEqual({ status: 200, body: result });
    expect(validate).toHaveBeenCalledOnce();
    expect(validate).toHaveBeenCalledWith(command);
  });

  it('rejects an invalid internal caller before consulting current authority sources', async () => {
    const validate = vi.fn(() => result);
    await expect(
      route(validate).handle(request(command, 'wrong-secret-value-xxxxxxxxxxxxx'))
    ).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
    expect(validate).not.toHaveBeenCalled();
  });

  it('rejects bearer/session material and other caller-expanded fields', async () => {
    const validate = vi.fn(() => result);
    await expect(
      route(validate).handle(request({ ...command, token: 'historical-browser-token' }))
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_CURRENT_AUTHORITY_REQUEST'
    });
    await expect(
      route(validate).handle(request({ ...command, principal: { kind: 'WORKSPACE' } }))
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_CURRENT_AUTHORITY_REQUEST'
    });
    expect(validate).not.toHaveBeenCalled();
  });

  it('rejects unknown permissions instead of accepting caller-defined authority classes', async () => {
    const validate = vi.fn(() => result);
    await expect(
      route(validate).handle(request({ ...command, requiredPermission: 'provider:appoint' }))
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_CURRENT_AUTHORITY_REQUEST'
    });
    expect(validate).not.toHaveBeenCalled();
  });

  it.each([
    ['CURRENT_AUTHORITY_NOT_FOUND', 404, false],
    ['CURRENT_AUTHORITY_STALE', 409, false],
    ['CURRENT_AUTHORITY_DENIED', 409, false],
    ['CURRENT_AUTHORITY_PERMISSION_DENIED', 403, false],
    ['CURRENT_AUTHORITY_SOURCE_UNAVAILABLE', 503, true]
  ] as const)(
    'preserves %s as an explicit fail-closed HTTP result',
    async (code, status, retryable) => {
      const validate = vi.fn(() => {
        throw new CurrentWorkspaceAuthorityError(code, `forced ${code}`, status, retryable);
      });

      await expect(route(validate).handle(request())).rejects.toMatchObject({
        status,
        code,
        retryable
      });
      expect(validate).toHaveBeenCalledOnce();
    }
  );
});
