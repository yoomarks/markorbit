import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  GovernedHumanActionReceiptClientError,
  csrfToken,
  type CoreAuthenticationClient,
  type GovernedHumanActionReceiptMaterializationV1,
  type GovernedHumanActionReceiptV1
} from '../src/auth.js';
import { authorizeGovernedWorkspaceMutation } from '../src/governed-action.js';

const workspaceId = '018f0000-0000-7000-8000-000000000840';
const userId = '018f0000-0000-7000-8000-000000000841';
const membershipId = '018f0000-0000-7000-8000-000000000842';
const sessionId = '018f0000-0000-7000-8000-000000000843';
const csrfSecret = 'integration-840-csrf-secret-0123456789';
const authenticatedAt = '2026-09-06T00:30:00.000Z';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  workspaceId,
  membershipId,
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'workspace:manage', 'matter:create'],
  sessionCreatedAt: authenticatedAt,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};

function client(overrides: Partial<CoreAuthenticationClient> = {}): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected')),
    resolve: () => Promise.reject(new Error('resolve is not expected')),
    resolveWorkspace: vi.fn(() => Promise.resolve(principal)),
    revoke: () => Promise.resolve(),
    ...overrides
  };
}

function request(
  body: Record<string, unknown> = { value: 'reviewed', idempotencyKey: 'key-840' },
  headers: Record<string, string> = {},
  path = '/api/example/governed-action'
): JsonRequest {
  return {
    method: 'POST',
    path,
    body,
    params: {},
    query: {},
    headers: {
      cookie: 'mo_session=token-840',
      origin: 'https://app.example',
      'x-markorbit-workspace-id': workspaceId,
      'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
      'idempotency-key': 'key-840',
      'x-correlation-id': 'correlation-840',
      ...headers
    }
  };
}

const options = (authenticationClient: CoreAuthenticationClient) => ({
  authenticationClient,
  csrfSecret,
  allowedOrigins: ['https://app.example']
});

const standardPolicy = {
  permission: 'matter:create' as const,
  idempotency: 'REQUIRED' as const,
  bodyIdempotency: 'MATCH_IF_PRESENT' as const,
  forbiddenBodyFields: ['workspaceId', 'userId', 'membershipId'],
  browserAuthorityError: {
    code: 'ACTOR_SPOOF_REJECTED',
    message: (field: string) => `${field} is trusted authority context.`
  },
  bindTrustedWorkspaceField: 'workspaceId'
};

function receipt(
  input: GovernedHumanActionReceiptMaterializationV1,
  overrides: Partial<GovernedHumanActionReceiptV1> = {}
): GovernedHumanActionReceiptV1 {
  const receiptId = '018f0000-0000-7000-8000-000000000844';
  return {
    ...input,
    schemaVersion: 1,
    receiptId,
    receiptVersion: 1,
    authorityReference: `core-governed-human-action-receipt:${receiptId}:v1`,
    authorityVersion: 1,
    affirmativeHumanActionEvidenceReference: `core-governed-human-action-evidence:${receiptId}:v1`,
    source: 'CORE',
    actorKind: 'HUMAN_USER',
    workspaceVersion: 1,
    userVersion: 1,
    membershipVersion: 1,
    createdAt: authenticatedAt,
    ...overrides
  };
}

describe('Governed Gateway action framework', () => {
  it('binds trusted Workspace and exact idempotency after authentication and mutation guards', async () => {
    const authentication = client();
    const result = await authorizeGovernedWorkspaceMutation(
      request(),
      options(authentication),
      standardPolicy
    );

    expect(result.principal).toEqual(principal);
    expect(result.idempotencyKey).toBe('key-840');
    expect(result.body).toMatchObject({ value: 'reviewed', workspaceId });
    expect(authentication.resolveWorkspace).toHaveBeenCalledWith(
      'token-840',
      workspaceId,
      'correlation-840'
    );
  });

  it.each([
    ['missing session', { cookie: '' }, 401, 'AUTHENTICATION_REQUIRED'],
    ['untrusted origin', { origin: 'https://evil.example' }, 403, 'UNTRUSTED_ORIGIN'],
    ['invalid csrf', { 'x-markorbit-csrf-token': 'bad-token' }, 403, 'INVALID_CSRF_TOKEN'],
    ['missing idempotency', { 'idempotency-key': '' }, 400, 'IDEMPOTENCY_KEY_REQUIRED']
  ] as const)('fails closed for %s', async (_name, headers, status, code) => {
    await expect(
      authorizeGovernedWorkspaceMutation(request(undefined, headers), options(client()), standardPolicy)
    ).rejects.toMatchObject({ status, code });
  });

  it('rejects browser authority before returning a trusted command context', async () => {
    await expect(
      authorizeGovernedWorkspaceMutation(
        request({ value: 'reviewed', workspaceId }),
        options(client()),
        standardPolicy
      )
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
  });

  it('requires the exact declared permission', async () => {
    const denied = client({
      resolveWorkspace: () =>
        Promise.resolve({ ...principal, permissions: ['workspace:read'] })
    });
    await expect(
      authorizeGovernedWorkspaceMutation(request(), options(denied), standardPolicy)
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('rejects a body idempotency value that conflicts with the trusted header', async () => {
    await expect(
      authorizeGovernedWorkspaceMutation(
        request({ value: 'changed', idempotencyKey: 'different-key' }),
        options(client()),
        standardPolicy
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });

  it('materializes and exact-binds a durable HUMAN_USER receipt for a reviewed action', async () => {
    const materialize = vi.fn((input: GovernedHumanActionReceiptMaterializationV1) =>
      Promise.resolve(receipt(input))
    );
    const result = await authorizeGovernedWorkspaceMutation(
      request({ candidateId: 'candidate-840' }),
      options(client({ materializeGovernedHumanActionReceipt: materialize })),
      {
        permission: 'workspace:manage',
        idempotency: 'REQUIRED',
        humanAction: 'PROVIDER_SELECTION'
      }
    );

    expect(materialize).toHaveBeenCalledTimes(1);
    const input = materialize.mock.calls[0]![0];
    expect(input).toMatchObject({
      workspaceId,
      userId,
      membershipId,
      kind: 'PROVIDER_SELECTION',
      mutationRoute: '/api/example/governed-action',
      idempotencyKey: 'key-840',
      authenticatedAt
    });
    expect(input.reviewedActionDigest).toMatch(/^[0-9a-f]{64}$/);
    const envelope = JSON.parse(
      Buffer.from(result.humanActionEnvelope!, 'base64url').toString('utf8')
    ) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      kind: 'PROVIDER_SELECTION',
      actorKind: 'HUMAN_USER',
      workspaceId,
      userId,
      membershipId,
      payloadIdentityAuthoritative: false
    });
  });

  it('fails closed when a receipt from the wrong human-action domain is returned', async () => {
    const materialize = (input: GovernedHumanActionReceiptMaterializationV1) =>
      Promise.resolve(receipt(input, { kind: 'PROVIDER_SELECTION' }));
    await expect(
      authorizeGovernedWorkspaceMutation(
        request({ projection: ['mark'] }),
        options(client({ materializeGovernedHumanActionReceipt: materialize })),
        {
          permission: 'workspace:manage',
          idempotency: 'REQUIRED',
          humanAction: 'CONTROLLED_HANDOFF'
        }
      )
    ).rejects.toMatchObject({
      status: 503,
      code: 'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE'
    });
  });

  it.each([
    [409, 'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT'],
    [503, 'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE']
  ] as const)('preserves governed receipt failure %s/%s', async (status, code) => {
    const materialize = () =>
      Promise.reject(
        new GovernedHumanActionReceiptClientError(
          status,
          code,
          'Governed human-action receipt failed.'
        )
      );
    await expect(
      authorizeGovernedWorkspaceMutation(
        request({ candidateId: 'candidate-840' }),
        options(client({ materializeGovernedHumanActionReceipt: materialize })),
        {
          permission: 'workspace:manage',
          idempotency: 'REQUIRED',
          humanAction: 'PROVIDER_SELECTION'
        }
      )
    ).rejects.toMatchObject({ status, code });
  });

  it('rejects browser-supplied internal human-action authority headers', async () => {
    await expect(
      authorizeGovernedWorkspaceMutation(
        request({}, { 'x-internal-human-action': 'browser-value' }),
        options(client()),
        {
          permission: 'workspace:manage',
          idempotency: 'REQUIRED',
          forbiddenHeaders: ['x-internal-human-action'],
          browserAuthorityError: {
            code: 'BROWSER_GOVERNED_AUTHORITY_FORBIDDEN',
            message: () => 'Browser human-action authority is forbidden.'
          }
        }
      )
    ).rejects.toMatchObject({ status: 400, code: 'BROWSER_GOVERNED_AUTHORITY_FORBIDDEN' });
  });
});
