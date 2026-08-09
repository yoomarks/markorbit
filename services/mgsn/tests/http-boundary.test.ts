/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- HTTP boundary assertions intentionally inspect JSON fixtures and captured commands. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import { createRuntime, type MgsnHttpServices } from '../src/index.js';

const secret = 'wp07-mgsn-internal-secret-32-bytes';
const customerWorkspaceId = '11111111-1111-4111-8111-111111111111';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const otherProviderWorkspaceId = '33333333-3333-4333-8333-333333333333';
const allocationId = 'allocation_wp07';
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
  return {
    providerRegistry: {
      listProviders: () => Promise.resolve([])
    },
    servicePackageEligibility: {
      getServicePackage: () =>
        Promise.resolve({ servicePackageId: 'service-package_wp07', workspaceId: customerWorkspaceId })
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
    providerReturn: {}
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
    expect(((await response.json()) as any).code).toBe('UNTRUSTED_INTERNAL_CALLER');
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
    expect(((await response.json()) as any).code).toBe('PERMISSION_DENIED');
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
    expect(((await response.json()) as any).code).toBe('WORKSPACE_MISMATCH');
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
    expect(((await response.json()) as any).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
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
    expect(((await response.json()) as any).code).toBe('NOT_FOUND');
  });
});
