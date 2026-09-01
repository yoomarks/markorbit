/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- boundary tests inspect forwarded domain commands. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createMgsnRuntime,
  NetworkParticipationError,
  type MgsnHttpServices
} from '../../../services/mgsn/src/index.js';
import {
  createRuntime as createGateway,
  csrfToken,
  PROVIDER_WORKSPACE_HEADER_NAME,
  type CoreAuthenticationClient
} from '../src/index.js';

const secret = 'network-participation-internal-secret';
const csrfSecret = 'network-participation-csrf-secret';
const origin = 'https://provider.markorbit.test';
const providerId = 'provider_network_participation' as ProviderId;
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const executionOnlyWorkspaceId = '33333333-3333-4333-8333-333333333333';
const wrongWorkspaceId = '44444444-4444-4444-8444-444444444444';
const active: ServiceRuntime[] = [];
let base = '';
let capturedRead: any;
let capturedMutation: any;

function principal(workspaceId: string): WorkspacePrincipal {
  if (workspaceId === executionOnlyWorkspaceId)
    return {
      kind: 'WORKSPACE',
      sessionId: 'session-execution-only',
      userId: 'user_execution_only',
      workspaceId,
      membershipId: 'membership-execution-only',
      role: 'MATTER_MANAGER',
      permissions: ['workspace:read', 'execution:read', 'execution:manage'],
      sessionExpiresAt: '2026-09-02T00:00:00.000Z'
    };
  return {
    kind: 'WORKSPACE',
    sessionId: `session-${workspaceId}`,
    userId: workspaceId === providerWorkspaceId ? 'user_provider_admin' : 'user_wrong_workspace',
    workspaceId,
    membershipId: `membership-${workspaceId}`,
    role: 'WORKSPACE_ADMIN',
    permissions: ['workspace:read', 'workspace:manage'],
    sessionExpiresAt: '2026-09-02T00:00:00.000Z'
  };
}

const authentication: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('not used')),
  resolve: () =>
    Promise.resolve({
      kind: 'AUTHENTICATED_USER',
      sessionId: 'session-user',
      userId: 'user_provider_admin',
      sessionExpiresAt: '2026-09-02T00:00:00.000Z'
    }),
  resolveWorkspace: (_token, workspaceId) => Promise.resolve(principal(workspaceId)),
  revoke: () => Promise.resolve()
};

function assertProviderWorkspace(context: { workspaceId: string }) {
  if (context.workspaceId !== providerWorkspaceId)
    throw new NetworkParticipationError(
      'PROVIDER_WORKSPACE_MISMATCH',
      'Provider does not belong to the trusted Workspace.',
      403
    );
}

function noRowSnapshot() {
  return {
    schemaVersion: 1,
    providerId,
    workspaceId: providerWorkspaceId,
    networkParticipationId: null,
    participationVersion: null,
    state: 'NOT_PARTICIPATING',
    visibilityPolicy: {
      version: null,
      scope: 'PRIVATE',
      grants: []
    },
    authorityConsequences: {}
  };
}

function services(): MgsnHttpServices {
  return {
    networkParticipation: {
      read: (context: any, requestedProviderId: ProviderId) => {
        assertProviderWorkspace(context);
        capturedRead = { context, providerId: requestedProviderId };
        return Promise.resolve(noRowSnapshot());
      },
      optIn: (context: any, command: any) => {
        assertProviderWorkspace(context);
        capturedMutation = { operation: 'OPT_IN', context, command };
        return Promise.resolve({ ...noRowSnapshot(), state: 'ACTIVE', participationVersion: 1 });
      },
      changeState: (context: any, command: any) => {
        assertProviderWorkspace(context);
        capturedMutation = { operation: 'STATE', context, command };
        if (command.reason === 'force-stale')
          throw new NetworkParticipationError(
            'STALE_PARTICIPATION',
            'Network Participation changed.',
            409
          );
        return Promise.resolve({ ...noRowSnapshot(), state: command.action });
      },
      replaceVisibilityPolicy: (context: any, command: any) => {
        assertProviderWorkspace(context);
        capturedMutation = { operation: 'VISIBILITY_POLICY', context, command };
        if (command.reason === 'force-idempotency-conflict')
          throw new NetworkParticipationError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has a different payload.',
            409
          );
        return Promise.resolve(noRowSnapshot());
      }
    },
    providerRegistry: {},
    servicePackageEligibility: {},
    allocationProviderAcceptance: {},
    providerReturn: {}
  } as unknown as MgsnHttpServices;
}

function headers(workspaceId: string, mutation = false, includeIdempotency = true) {
  const p = principal(workspaceId);
  return {
    cookie: 'mo_session=opaque',
    [PROVIDER_WORKSPACE_HEADER_NAME]: workspaceId,
    ...(mutation
      ? {
          origin,
          'x-markorbit-csrf-token': csrfToken(p.sessionId, csrfSecret),
          ...(includeIdempotency ? { 'idempotency-key': 'network-participation-key' } : {})
        }
      : {})
  };
}

beforeEach(async () => {
  capturedRead = undefined;
  capturedMutation = undefined;
  const mgsn = createMgsnRuntime({
    port: 0,
    internalServiceSecret: secret,
    services: services()
  });
  active.push(mgsn);
  await mgsn.start();
  const gateway = createGateway({
    port: 0,
    mgsnUrl: `http://127.0.0.1:${mgsn.listeningPort}`,
    authenticationClient: authentication,
    internalServiceSecret: secret,
    csrfSecret,
    allowedOrigins: [origin]
  });
  active.push(gateway);
  await gateway.start();
  base = `http://127.0.0.1:${gateway.listeningPort}`;
});

afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
});

describe('authenticated Network Participation Gateway owner boundary', () => {
  it('reads fail-closed no-row state through reviewed workspace:read authority', async () => {
    const response = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}`,
      { headers: headers(providerWorkspaceId) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.networkParticipation.state).toBe('NOT_PARTICIPATING');
    expect(body.networkParticipation.visibilityPolicy.scope).toBe('PRIVATE');
    expect(capturedRead).toEqual({
      context: { workspaceId: providerWorkspaceId, actorId: 'user_provider_admin' },
      providerId
    });
  });

  it('does not treat execution:manage as Network Participation consent authority', async () => {
    const response = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}/opt-in`,
      {
        method: 'POST',
        headers: { ...headers(executionOnlyWorkspaceId, true), 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          authorizationReference: 'authorization_execution_only',
          reason: 'must be denied',
          correlationId: 'correlation_execution_only'
        })
      }
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('PERMISSION_DENIED');
    expect(capturedMutation).toBeUndefined();
  });

  it('rejects caller-supplied Workspace, actor and Provider identity', async () => {
    const response = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}/opt-in`,
      {
        method: 'POST',
        headers: { ...headers(providerWorkspaceId, true), 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          workspaceId: wrongWorkspaceId,
          actorId: 'spoofed_actor',
          providerId: 'provider_spoofed',
          authorizationReference: 'authorization_spoofed',
          reason: 'spoofed',
          correlationId: 'correlation_spoofed'
        })
      }
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe(
      'NETWORK_PARTICIPATION_AUTHORITY_PAYLOAD_FORBIDDEN'
    );
    expect(capturedMutation).toBeUndefined();
  });

  it('requires trusted Origin, CSRF and idempotency before owner mutation', async () => {
    const noCsrf = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}/opt-in`,
      {
        method: 'POST',
        headers: {
          cookie: 'mo_session=opaque',
          [PROVIDER_WORKSPACE_HEADER_NAME]: providerWorkspaceId,
          origin,
          'idempotency-key': 'no-csrf',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ schemaVersion: 1 })
      }
    );
    expect(noCsrf.status).toBe(403);

    const noIdempotency = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}/opt-in`,
      {
        method: 'POST',
        headers: {
          ...headers(providerWorkspaceId, true, false),
          'content-type': 'application/json'
        },
        body: JSON.stringify({ schemaVersion: 1 })
      }
    );
    expect(noIdempotency.status).toBe(400);
    expect((await noIdempotency.json()).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(capturedMutation).toBeUndefined();
  });

  it('binds opt-in to the authenticated Provider Workspace and exact URL Provider', async () => {
    const response = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}/opt-in`,
      {
        method: 'POST',
        headers: { ...headers(providerWorkspaceId, true), 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          authorizationReference: 'authorization_provider_admin',
          reason: 'explicit provider workspace opt-in',
          correlationId: 'correlation_provider_admin'
        })
      }
    );
    expect(response.status).toBe(201);
    expect(capturedMutation.context).toEqual({
      workspaceId: providerWorkspaceId,
      actorId: 'user_provider_admin'
    });
    expect(capturedMutation.command.providerId).toBe(providerId);
    expect(capturedMutation.command.idempotencyKey).toBe('network-participation-key');
  });

  it('fails closed across Workspaces without disclosing Provider binding details', async () => {
    const response = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}`,
      { headers: headers(wrongWorkspaceId) }
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as any;
    expect(body.code).toBe('NETWORK_PARTICIPATION_NOT_FOUND');
    expect(JSON.stringify(body)).not.toContain(providerWorkspaceId);
  });

  it('preserves stale-version and idempotency conflicts from the MGSN owner authority', async () => {
    const stale = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}/state`,
      {
        method: 'POST',
        headers: { ...headers(providerWorkspaceId, true), 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          action: 'PAUSE',
          networkParticipationId: 'network-participation_test',
          expectedParticipationVersion: 1,
          expectedVisibilityPolicyVersion: 1,
          authorizationReference: 'authorization_provider_admin',
          reason: 'force-stale',
          correlationId: 'correlation_stale'
        })
      }
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('STALE_PARTICIPATION');

    const conflict = await fetch(
      `${base}/api/mgsn/network-participation/providers/${providerId}/visibility-policy`,
      {
        method: 'POST',
        headers: { ...headers(providerWorkspaceId, true), 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          networkParticipationId: 'network-participation_test',
          expectedParticipationVersion: 1,
          expectedVisibilityPolicyVersion: 1,
          replacement: { scope: 'PRIVATE', grants: [] },
          authorizationReference: 'authorization_provider_admin',
          reason: 'force-idempotency-conflict',
          correlationId: 'correlation_conflict'
        })
      }
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).code).toBe('IDEMPOTENCY_CONFLICT');
  });
});
