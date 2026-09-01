/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- HTTP assertions inspect JSON response bodies and captured trusted inputs. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime,
  ProviderWorkReadModelError,
  type MgsnHttpServices,
  type ProviderWorkPrincipal
} from '../src/index.js';

const secret = 'provider-work-read-secret';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
let runtime: ServiceRuntime;
let base = '';
let captured:
  { principal: ProviderWorkPrincipal; query?: unknown; allocationId?: string } | undefined;
let unavailable = false;

function principal(
  workspaceId = providerWorkspaceId,
  permissions: WorkspacePrincipal['permissions'] = ['execution:read']
): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: `session-${workspaceId}`,
    userId: `user-${workspaceId}`,
    workspaceId,
    membershipId: `membership-${workspaceId}`,
    role: permissions.includes('execution:manage') ? 'WORKSPACE_ADMIN' : 'READ_ONLY',
    permissions,
    sessionExpiresAt: '2026-09-02T00:00:00.000Z'
  };
}

function headers(value = principal()) {
  return {
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value)
  };
}

function services(): MgsnHttpServices {
  return {
    providerWorkRead: {
      list: (trustedPrincipal: ProviderWorkPrincipal, query: { limit?: number }) => {
        captured = { principal: trustedPrincipal, query };
        if (unavailable)
          return Promise.reject(
            new ProviderWorkReadModelError(
              'PERSISTENCE_UNAVAILABLE',
              'Provider work persistence is unavailable.',
              503
            )
          );
        if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit > 100))
          return Promise.reject(
            new ProviderWorkReadModelError('INVALID_QUERY', 'limit must be between 1 and 100.', 422)
          );
        return Promise.resolve({
          schemaVersion: 1 as const,
          providerWorkspaceId: trustedPrincipal.workspaceId,
          principalReference: 'principal:test',
          workspaceAuthorityReference: 'workspace-membership:test',
          checkedAt: '2026-09-01T12:00:00.000Z',
          items: [{ allocation: { allocationId: 'allocation_own' } }] as any,
          page: { limit: query.limit ?? 50 },
          readAuthorityDoesNotAuthorizeMutation: true as const
        });
      },
      read: (trustedPrincipal: ProviderWorkPrincipal, allocationId: string) => {
        captured = { principal: trustedPrincipal, allocationId };
        if (unavailable)
          return Promise.resolve({
            schemaVersion: 1 as const,
            decision: 'SOURCE_UNAVAILABLE' as const,
            checkedAt: '2026-09-01T12:00:00.000Z',
            item: null,
            existenceDisclosed: false as const,
            retryable: true as const,
            publicReason: 'Provider work source is temporarily unavailable.' as const,
            readAuthorityDoesNotAuthorizeMutation: true as const
          });
        if (
          trustedPrincipal.workspaceId !== providerWorkspaceId ||
          allocationId !== 'allocation_own'
        )
          return Promise.resolve({
            schemaVersion: 1 as const,
            decision: 'NOT_FOUND_OR_NOT_AUTHORIZED' as const,
            checkedAt: '2026-09-01T12:00:00.000Z',
            item: null,
            existenceDisclosed: false as const,
            publicReason:
              'Provider work item was not found or is not available to this Workspace.' as const,
            readAuthorityDoesNotAuthorizeMutation: true as const
          });
        return Promise.resolve({
          schemaVersion: 1 as const,
          decision: 'AUTHORIZED' as const,
          providerWorkspaceId,
          principalReference: 'principal:test',
          workspaceAuthorityReference: 'workspace-membership:test',
          checkedAt: '2026-09-01T12:00:00.000Z',
          item: { allocation: { allocationId } } as any,
          existenceDisclosed: true as const,
          readAuthorityDoesNotAuthorizeMutation: true as const
        });
      }
    },
    providerRegistry: {},
    servicePackageEligibility: {},
    allocationProviderAcceptance: {},
    providerReturn: {},
    networkParticipation: {}
  } as unknown as MgsnHttpServices;
}

beforeEach(async () => {
  captured = undefined;
  unavailable = false;
  runtime = createRuntime({ port: 0, internalServiceSecret: secret, services: services() });
  await runtime.start();
  base = `http://127.0.0.1:${runtime.listeningPort}`;
});

afterEach(async () => runtime.stop());

describe('Provider Workspace own-work HTTP boundary', () => {
  it('requires trusted internal authentication and a Workspace Principal', async () => {
    const untrusted = await fetch(`${base}/v1/provider/work-items`, {
      headers: { 'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal()) }
    });
    expect(untrusted.status).toBe(401);

    const missingPrincipal = await fetch(`${base}/v1/provider/work-items`, {
      headers: { 'x-markorbit-internal-authorization': secret }
    });
    expect(missingPrincipal.status).toBe(401);
    expect((await missingPrincipal.json()).code).toBe('INVALID_INTERNAL_PRINCIPAL');
  });

  it('requires the existing Provider read permission convention', async () => {
    const response = await fetch(`${base}/v1/provider/work-items`, {
      headers: headers(principal(providerWorkspaceId, []))
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('PERMISSION_DENIED');
  });

  it('derives list authority only from the trusted principal and returns own work', async () => {
    const value = principal();
    const response = await fetch(`${base}/v1/provider/work-items?limit=20`, {
      headers: headers(value)
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(captured).toEqual({
      principal: {
        workspaceId: value.workspaceId,
        userId: value.userId,
        membershipId: value.membershipId
      },
      query: { limit: 20 }
    });
    expect(body.providerWorkItemList.items[0].allocation.allocationId).toBe('allocation_own');
  });

  it('rejects browser-selected Provider identity even when it names the same Provider', async () => {
    const response = await fetch(
      `${base}/v1/provider/work-items?providerWorkspaceId=${providerWorkspaceId}`,
      { headers: headers() }
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('SPOOFED_AUTHORITY_CONTEXT');
    expect(captured).toBeUndefined();
  });

  it('uses the same privacy-safe 404 for wrong Workspace and unknown detail', async () => {
    const wrong = await fetch(`${base}/v1/provider/work-items/allocation_own`, {
      headers: headers(principal(otherWorkspaceId))
    });
    const unknown = await fetch(`${base}/v1/provider/work-items/allocation_unknown`, {
      headers: headers()
    });

    expect(wrong.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it('rejects an over-maximum limit and maps persistence failure to 503', async () => {
    const malformed = await fetch(`${base}/v1/provider/work-items?limit=101`, {
      headers: headers()
    });
    expect(malformed.status).toBe(422);
    expect((await malformed.json()).code).toBe('INVALID_QUERY');

    unavailable = true;
    const failedList = await fetch(`${base}/v1/provider/work-items`, { headers: headers() });
    const failedDetail = await fetch(`${base}/v1/provider/work-items/allocation_own`, {
      headers: headers()
    });
    expect(failedList.status).toBe(503);
    expect(failedDetail.status).toBe(503);
    expect((await failedDetail.json()).code).toBe('PROVIDER_WORK_SOURCE_UNAVAILABLE');
  });

  it('introduces no mutation route', async () => {
    const response = await fetch(`${base}/v1/provider/work-items`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: '{}'
    });
    expect(response.status).toBe(405);
  });
});
