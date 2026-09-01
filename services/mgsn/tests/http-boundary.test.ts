/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- HTTP boundary assertions intentionally inspect JSON fixtures and captured commands. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime, type MgsnHttpServices } from '../src/index.js';
import {
  InMemoryNetworkParticipationRepository,
  NetworkParticipationService
} from '../src/network-participation.js';

const secret = 'wp07-mgsn-internal-secret-32-bytes';
const customerWorkspaceId = '11111111-1111-4111-8111-111111111111';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const otherProviderWorkspaceId = '33333333-3333-4333-8333-333333333333';
const allocationId = 'allocation_wp07';
const networkProviderId = 'provider_wp07';
let runtime: ServiceRuntime;
let base = '';
let captured: any;

function principal(workspaceId: string, manage = true): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: `session-${workspaceId}`,
    userId: workspaceId === providerWorkspaceId ? 'user_provider' : 'user_operator',
    workspaceId,
    membershipId: `membership-${workspaceId}`,
    role: manage ? 'WORKSPACE_ADMIN' : 'READ_ONLY',
    permissions: manage ? ['execution:read', 'execution:manage'] : ['execution:read'],
    sessionExpiresAt: '2026-08-10T00:00:00.000Z'
  };
}

function trustedHeaders(value: WorkspacePrincipal, key?: string) {
  return {
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId,
    ...(key ? { 'idempotency-key': key } : {})
  };
}

function networkOwnerHeaders(
  value: WorkspacePrincipal,
  authority: 'read' | 'manage',
  key?: string
) {
  return {
    ...trustedHeaders(value, key),
    'x-markorbit-network-participation-owner-authority': authority
  };
}

function services(): MgsnHttpServices {
  const allocation = {
    allocationId,
    workspaceId: customerWorkspaceId,
    version: 1,
    status: 'ACTIVE',
    provider: {
      providerId: 'provider_wp07',
      providerWorkspaceId,
      displayName: 'WP07 Provider',
      operationalStatus: 'ACTIVE'
    }
  };
  const networkParticipation = new NetworkParticipationService(
    new InMemoryNetworkParticipationRepository(),
    {
      findProviderById: (providerId) =>
        Promise.resolve(
          providerId === networkProviderId
            ? ({ providerId, providerWorkspaceId, operationalStatus: 'ACTIVE' } as any)
            : undefined
        )
    },
    () => '2026-09-01T00:00:00.000Z',
    () => 'network-participation_wp07'
  );
  return {
    providerRegistry: {
      listProviders: () => Promise.resolve([])
    },
    servicePackageEligibility: {
      getServicePackage: () =>
        Promise.resolve({
          servicePackageId: 'service-package_wp07',
          workspaceId: customerWorkspaceId
        })
    },
    allocationProviderAcceptance: {
      getAllocation: () => Promise.resolve(allocation),
      respondToAllocation: (command: unknown) => {
        captured = command;
        return Promise.resolve({
          providerAcceptanceId: 'provider-acceptance_wp07',
          workspaceId: customerWorkspaceId,
          version: 1,
          decision: 'ACCEPTED'
        });
      }
    },
    providerReturn: {},
    networkParticipation
  } as unknown as MgsnHttpServices;
}

beforeEach(async () => {
  captured = undefined;
  runtime = createRuntime({ port: 0, internalServiceSecret: secret, services: services() });
  await runtime.start();
  base = `http://127.0.0.1:${runtime.listeningPort}`;
});

afterEach(async () => runtime.stop());

describe('M4-WP-07 MGSN trusted HTTP boundary', () => {
  it('rejects callers without trusted internal service authorization', async () => {
    const response = await fetch(`${base}/v1/providers`, {
      headers: {
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal(customerWorkspaceId))
      }
    });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('UNTRUSTED_INTERNAL_CALLER');
  });

  it('requires execution:manage for controlled mutations', async () => {
    const response = await fetch(`${base}/v1/service-packages`, {
      method: 'POST',
      headers: {
        ...trustedHeaders(principal(customerWorkspaceId, false), 'readonly-key'),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ workspaceId: customerWorkspaceId })
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('PERMISSION_DENIED');
  });

  it('fails closed when operations target a different Workspace', async () => {
    const response = await fetch(`${base}/v1/service-packages`, {
      method: 'POST',
      headers: {
        ...trustedHeaders(principal(customerWorkspaceId), 'workspace-mismatch'),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ workspaceId: otherProviderWorkspaceId })
    });
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('WORKSPACE_MISMATCH');
  });

  it('requires and binds the Idempotency-Key for mutations', async () => {
    const value = principal(providerWorkspaceId);
    const response = await fetch(`${base}/v1/provider/allocations/${allocationId}/respond`, {
      method: 'POST',
      headers: {
        ...trustedHeaders(value),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId: customerWorkspaceId,
        expectedAllocationVersion: 1,
        decision: 'ACCEPTED',
        acknowledgement: 'accepted',
        correlationId: 'correlation_wp07'
      })
    });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(captured).toBeUndefined();
  });

  it('derives Provider Acceptance identity from the trusted Provider Workspace principal', async () => {
    const value = principal(providerWorkspaceId);
    const response = await fetch(`${base}/v1/provider/allocations/${allocationId}/respond`, {
      method: 'POST',
      headers: {
        ...trustedHeaders(value, 'provider-accept'),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId: customerWorkspaceId,
        expectedAllocationVersion: 1,
        decision: 'ACCEPTED',
        acknowledgement: 'accepted through trusted MGSN boundary',
        correlationId: 'correlation_wp07'
      })
    });
    expect(response.status).toBe(201);
    expect(captured.principal).toEqual({
      actorId: value.userId,
      providerWorkspaceId
    });
    expect(captured.workspaceId).toBe(customerWorkspaceId);
    expect(captured.idempotencyKey).toBe('provider-accept');
  });

  it('hides an Allocation from a different Provider Workspace', async () => {
    const response = await fetch(`${base}/v1/provider/allocations/${allocationId}`, {
      headers: trustedHeaders(principal(otherProviderWorkspaceId))
    });
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('NOT_FOUND');
  });
});

describe('Network Participation owner HTTP boundary', () => {
  const optInBody = (overrides: Record<string, unknown> = {}) => ({
    schemaVersion: 1,
    authorizationReference: 'authorization:owner-reviewed',
    reason: 'Provider Workspace owner explicitly opted in.',
    correlationId: 'correlation_wp07_network',
    ...overrides
  });

  it('requires trusted internal authorization and a valid principal', async () => {
    const missingTrust = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}`,
      {
        headers: {
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal(providerWorkspaceId)),
          'x-markorbit-network-participation-owner-authority': 'read'
        }
      }
    );
    expect(missingTrust.status).toBe(401);

    const invalidPrincipal = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}`,
      {
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-principal': 'not-a-principal',
          'x-markorbit-network-participation-owner-authority': 'read'
        }
      }
    );
    expect(invalidPrincipal.status).toBe(401);
    expect((await invalidPrincipal.json()).code).toBe('INVALID_INTERNAL_PRINCIPAL');
  });

  it('does not treat execution:manage or commercial authority as participation consent', async () => {
    const executionManager = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/opt-in`,
      {
        method: 'POST',
        headers: {
          ...trustedHeaders(principal(providerWorkspaceId), 'generic-manage'),
          'content-type': 'application/json'
        },
        body: JSON.stringify(optInBody())
      }
    );
    expect(executionManager.status).toBe(403);
    expect((await executionManager.json()).code).toBe(
      'NETWORK_PARTICIPATION_OWNER_AUTHORITY_REQUIRED'
    );

    const commercialOnly = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}`,
      {
        headers: {
          ...trustedHeaders(principal(providerWorkspaceId)),
          'x-markorbit-commercial-admin-authority': 'read'
        }
      }
    );
    expect(commercialOnly.status).toBe(403);
  });

  it('rejects body-selected authority before invoking the domain service', async () => {
    const response = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/opt-in`,
      {
        method: 'POST',
        headers: {
          ...networkOwnerHeaders(principal(providerWorkspaceId), 'manage', 'spoofed-owner'),
          'content-type': 'application/json'
        },
        body: JSON.stringify(
          optInBody({ workspaceId: otherProviderWorkspaceId, actorId: 'user_spoofed' })
        )
      }
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('SPOOFED_AUTHORITY_CONTEXT');
  });

  it('fails closed across Workspace bindings without revealing the owning Workspace', async () => {
    const response = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}`,
      { headers: networkOwnerHeaders(principal(otherProviderWorkspaceId), 'read') }
    );
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('NETWORK_PARTICIPATION_NOT_FOUND');
  });

  it('requires and exactly binds Idempotency-Key', async () => {
    const missing = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/opt-in`,
      {
        method: 'POST',
        headers: {
          ...networkOwnerHeaders(principal(providerWorkspaceId), 'manage'),
          'content-type': 'application/json'
        },
        body: JSON.stringify(optInBody())
      }
    );
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const mismatch = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/opt-in`,
      {
        method: 'POST',
        headers: {
          ...networkOwnerHeaders(principal(providerWorkspaceId), 'manage', 'header-key'),
          'content-type': 'application/json'
        },
        body: JSON.stringify(optInBody({ idempotencyKey: 'body-key' }))
      }
    );
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).code).toBe('IDEMPOTENCY_KEY_MISMATCH');
  });

  it('returns no-row PRIVATE, creates ACTIVE+PRIVATE, and replays exactly', async () => {
    const value = principal(providerWorkspaceId);
    const before = await fetch(`${base}/v1/network-participation/providers/${networkProviderId}`, {
      headers: networkOwnerHeaders(value, 'read')
    });
    expect(before.status).toBe(200);
    expect((await before.json()).networkParticipation).toMatchObject({
      state: 'NOT_PARTICIPATING',
      visibilityPolicy: { scope: 'PRIVATE', grants: [] }
    });

    const request = () =>
      fetch(`${base}/v1/network-participation/providers/${networkProviderId}/opt-in`, {
        method: 'POST',
        headers: {
          ...networkOwnerHeaders(value, 'manage', 'owner-opt-in'),
          'content-type': 'application/json'
        },
        body: JSON.stringify(optInBody())
      });
    const created = await request();
    const replay = await request();
    expect(created.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(await created.json());
  });

  it('maps changed replay payload, stale versions, and invalid visibility to 4xx', async () => {
    const value = principal(providerWorkspaceId);
    const headers = {
      ...networkOwnerHeaders(value, 'manage', 'owner-opt-in'),
      'content-type': 'application/json'
    };
    const createdResponse = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/opt-in`,
      { method: 'POST', headers, body: JSON.stringify(optInBody()) }
    );
    const created = (await createdResponse.json()).networkParticipation;
    const conflict = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/opt-in`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(optInBody({ reason: 'Changed payload.' }))
      }
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).code).toBe('IDEMPOTENCY_CONFLICT');

    const stale = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/state`,
      {
        method: 'POST',
        headers: {
          ...networkOwnerHeaders(value, 'manage', 'stale-state'),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          schemaVersion: 1,
          action: 'PAUSE',
          networkParticipationId: created.networkParticipationId,
          expectedParticipationVersion: 2,
          expectedVisibilityPolicyVersion: 1,
          authorizationReference: 'authorization:pause',
          reason: 'Pause with stale version.',
          correlationId: 'correlation_wp07_pause'
        })
      }
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('STALE_PARTICIPATION');

    const stalePolicy = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/visibility-policy`,
      {
        method: 'POST',
        headers: {
          ...networkOwnerHeaders(value, 'manage', 'stale-policy'),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          schemaVersion: 1,
          networkParticipationId: created.networkParticipationId,
          expectedParticipationVersion: 1,
          expectedVisibilityPolicyVersion: 2,
          replacement: { scope: 'PRIVATE', grants: [] },
          authorizationReference: 'authorization:stale-policy',
          reason: 'Policy replacement with a stale version.',
          correlationId: 'correlation_wp07_stale_policy'
        })
      }
    );
    expect(stalePolicy.status).toBe(409);
    expect((await stalePolicy.json()).code).toBe('STALE_VISIBILITY_POLICY');

    const invalidVisibility = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/visibility-policy`,
      {
        method: 'POST',
        headers: {
          ...networkOwnerHeaders(value, 'manage', 'invalid-policy'),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          schemaVersion: 1,
          networkParticipationId: created.networkParticipationId,
          expectedParticipationVersion: 1,
          expectedVisibilityPolicyVersion: 1,
          replacement: {
            scope: 'BOUNDED_PUBLIC',
            grants: [{ dataClass: 'SUPPLY_PROFILE', fields: ['rawCapacity'] }]
          },
          authorizationReference: 'authorization:visibility',
          reason: 'Invalid broad visibility.',
          correlationId: 'correlation_wp07_visibility'
        })
      }
    );
    expect(invalidVisibility.status).toBe(422);
    expect((await invalidVisibility.json()).code).toBe('INVALID_INPUT');

    const invalidCorrelation = await fetch(
      `${base}/v1/network-participation/providers/${networkProviderId}/state`,
      {
        method: 'POST',
        headers: {
          ...networkOwnerHeaders(value, 'manage', 'invalid-correlation'),
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          schemaVersion: 1,
          action: 'PAUSE',
          networkParticipationId: created.networkParticipationId,
          expectedParticipationVersion: 1,
          expectedVisibilityPolicyVersion: 1,
          authorizationReference: 'authorization:pause',
          reason: 'Malformed correlation must fail before persistence.',
          correlationId: null
        })
      }
    );
    expect(invalidCorrelation.status).toBe(422);
    expect((await invalidCorrelation.json()).code).toBe('INVALID_INPUT');
  });
});
