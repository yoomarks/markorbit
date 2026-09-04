import {
  encodeInternalOperatorPrincipal,
  encodeInternalWorkspacePrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';

import { createBrainCognitiveReadRoutesV1 } from '../src/brain-cognitive-read-http.js';

const secret = 'core-cognitive-read-secret-32-bytes';
const projection = {
  schemaVersion: 1 as const,
  generatedAt: '2026-09-04T14:30:00.000Z',
  source: {
    domain: 'CORE' as const,
    authority: 'BRAIN_REGISTRIES' as const,
    availability: 'AVAILABLE' as const
  },
  brainAssets: [],
  brainGaps: [],
  summary: { brainAssetCount: 0, brainGapCount: 0, openBrainGapCount: 0 }
};

function operator(
  capabilities: readonly (
    | 'commercial-admin:read'
    | 'commercial-admin:operate'
    | 'control-plane:cognitive:read'
  )[]
): string {
  return encodeInternalOperatorPrincipal({
    kind: 'INTERNAL_OPERATOR',
    sessionId: 'session-1',
    userId: 'operator-1',
    capabilities,
    sessionExpiresAt: '2026-09-05T00:00:00.000Z'
  });
}

function request(principal?: string, authorization: string | undefined = secret): JsonRequest {
  return {
    method: 'GET',
    path: '/internal/control-plane/cognitive',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': authorization,
      ...(principal ? { 'x-markorbit-principal': principal } : {})
    },
    body: undefined
  };
}

function route(read = vi.fn(() => Promise.resolve(projection))) {
  return {
    read,
    route: createBrainCognitiveReadRoutesV1({
      service: { read },
      internalServiceSecret: secret
    })[0]!
  };
}

describe('bounded Brain cognitive read HTTP authority', () => {
  it('allows only a trusted Internal Operator carrying the exact cognitive read capability', async () => {
    const { read, route: cognitiveRoute } = route();

    await expect(
      cognitiveRoute.handle(request(operator(['control-plane:cognitive:read'])))
    ).resolves.toEqual({ status: 200, body: projection });
    expect(read).toHaveBeenCalledOnce();
  });

  it('rejects missing internal service identity before reading owner truth', async () => {
    const { read, route: cognitiveRoute } = route();

    await expect(
      cognitiveRoute.handle(request(operator(['control-plane:cognitive:read']), undefined))
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ['missing principal', undefined],
    ['malformed principal', 'not-a-principal']
  ])('rejects %s before reading owner truth', async (_label, principal) => {
    const { read, route: cognitiveRoute } = route();

    await expect(cognitiveRoute.handle(request(principal))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ['no capabilities', []],
    ['commercial read only', ['commercial-admin:read']],
    ['commercial operate only', ['commercial-admin:operate']],
    ['both commercial capabilities', ['commercial-admin:read', 'commercial-admin:operate']]
  ] as const)('does not let %s imply cognitive read authority', async (_label, capabilities) => {
    const { read, route: cognitiveRoute } = route();

    await expect(cognitiveRoute.handle(request(operator(capabilities)))).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('fails closed when the trusted principal vocabulary contains an unknown capability', async () => {
    const { read, route: cognitiveRoute } = route();
    const unknown = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        principal: {
          kind: 'INTERNAL_OPERATOR',
          sessionId: 'session-1',
          userId: 'operator-1',
          capabilities: ['control-plane:cognitive:read', 'brain:manage'],
          sessionExpiresAt: '2026-09-05T00:00:00.000Z'
        }
      }),
      'utf8'
    ).toString('base64url');

    await expect(cognitiveRoute.handle(request(unknown))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('does not accept Workspace authority as cognitive operator authority', async () => {
    const { read, route: cognitiveRoute } = route();
    const workspacePrincipal = encodeInternalWorkspacePrincipal({
      kind: 'WORKSPACE',
      sessionId: 'session-1',
      userId: 'operator-1',
      workspaceId: 'workspace-1',
      membershipId: 'membership-1',
      role: 'WORKSPACE_ADMIN',
      permissions: [],
      sessionExpiresAt: '2026-09-05T00:00:00.000Z'
    });

    await expect(cognitiveRoute.handle(request(workspacePrincipal))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(read).not.toHaveBeenCalled();
  });
});
