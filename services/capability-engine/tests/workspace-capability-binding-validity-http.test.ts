import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';
import { createWorkspaceCapabilityBindingValidityRoutesV1 } from '../src/workspace-capability-binding-validity-http.js';
import { WorkspaceCapabilityBindingValidityServiceError } from '../src/workspace-capability-binding-validity.js';

const SECRET = 'workspace-capability-validity-secret-32-bytes';
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const BINDING_ID = `workspace-capability-binding_${'a'.repeat(64)}` as const;
const COMMAND = { workspaceId: WORKSPACE, bindingId: BINDING_ID } as const;

function request(path: string, body: unknown, secret: string | undefined = SECRET): JsonRequest {
  return {
    method: 'POST',
    path,
    params: {},
    query: {},
    headers: secret ? { 'x-markorbit-internal-authorization': secret } : {},
    body
  };
}

function result(status: 'CURRENT' | 'REVOKED' | 'NOT_FOUND' | 'DEPENDENCY_UNAVAILABLE') {
  return {
    schemaVersion: 1 as const,
    status,
    evaluated: status === 'CURRENT' || status === 'REVOKED',
    currentUsable: status === 'CURRENT',
    reference: COMMAND,
    reason: status,
    retryable: status === 'DEPENDENCY_UNAVAILABLE'
  };
}

describe('Workspace Capability binding validity HTTP', () => {
  it('authenticates before evaluating current validity', async () => {
    const evaluate = vi.fn(() => Promise.resolve(result('CURRENT')));
    const [route] = createWorkspaceCapabilityBindingValidityRoutesV1({
      internalServiceSecret: SECRET,
      validity: { evaluate }
    });
    await expect(route!.handle(request(route!.path, COMMAND, ''))).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it.each([
    ['CURRENT', 200],
    ['REVOKED', 409],
    ['NOT_FOUND', 404],
    ['DEPENDENCY_UNAVAILABLE', 503]
  ] as const)('maps %s to HTTP %s', async (status, expectedStatus) => {
    const [route] = createWorkspaceCapabilityBindingValidityRoutesV1({
      internalServiceSecret: SECRET,
      validity: { evaluate: () => Promise.resolve(result(status)) }
    });
    const response = await route!.handle(request(route!.path, COMMAND));
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toMatchObject({ status, currentUsable: status === 'CURRENT' });
  });

  it('maps invalid governed commands to a bounded 400 response', async () => {
    const [route] = createWorkspaceCapabilityBindingValidityRoutesV1({
      internalServiceSecret: SECRET,
      validity: {
        evaluate: () =>
          Promise.reject(
            new WorkspaceCapabilityBindingValidityServiceError(
              'INVALID_COMMAND',
              'Only canonical Workspace and binding identities are accepted.'
            )
          )
      }
    });

    await expect(
      route!.handle(request(route!.path, { workspaceId: WORKSPACE }))
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_COMMAND'
    });
  });
});
