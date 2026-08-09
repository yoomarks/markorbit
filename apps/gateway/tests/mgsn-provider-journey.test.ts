/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- HTTP vertical-slice assertions intentionally inspect JSON fixtures and captured commands. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createMgsnRuntime,
  type MgsnHttpServices
} from '../../../services/mgsn/src/index.js';
import {
  createRuntime as createGateway,
  csrfToken,
  PROVIDER_WORKSPACE_HEADER_NAME,
  type CoreAuthenticationClient
} from '../src/index.js';

const secret = 'wp07-internal-secret-32-bytes-minimum';
const csrfSecret = 'wp07-csrf-secret-32-bytes-minimum';
const origin = 'https://ops.markorbit.test';
const customerWorkspaceId = '11111111-1111-4111-8111-111111111111';
const providerWorkspaceId = '22222222-2222-4222-8222-222222222222';
const readOnlyWorkspaceId = '33333333-3333-4333-8333-333333333333';
const allocationId = 'allocation_wp07';
let base = '';
let capturedResponseCommand: any;
let capturedReturnCommand: any;
let capturedAllocationCommand: any;
const active: ServiceRuntime[] = [];

function principal(workspaceId: string): WorkspacePrincipal {
  const readOnly = workspaceId === readOnlyWorkspaceId;
  return {
    kind: 'WORKSPACE',
    sessionId: `session-${workspaceId}`,
    userId: readOnly
      ? 'user_read_only'
      : workspaceId === providerWorkspaceId
        ? 'user_provider'
        : 'user_operator',
    workspaceId,
    membershipId: `membership-${workspaceId}`,
    role: readOnly ? 'READ_ONLY' : 'WORKSPACE_ADMIN',
    permissions: readOnly ? ['execution:read'] : ['execution:read', 'execution:manage'],
    sessionExpiresAt: '2026-08-10T00:00:00.000Z'
  };
}

const authentication: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('not used')),
  resolve: () =>
    Promise.resolve({
      kind: 'AUTHENTICATED_USER',
      sessionId: 'session-user',
      userId: 'user_operator',
      sessionExpiresAt: '2026-08-10T00:00:00.000Z'
    }),
  resolveWorkspace: (_token, workspaceId) => Promise.resolve(principal(workspaceId)),
  revoke: () => Promise.resolve()
};

function services(): MgsnHttpServices {
  const allocationRecord = {
    allocationId,
    workspaceId: customerWorkspaceId,
    version: 1,
    status: 'ACTIVE',
    provider: { providerWorkspaceId }
  };
  return {
    providerRegistry: {
      listProviders: () => Promise.resolve([])
    },
    servicePackageEligibility: {},
    allocationProviderAcceptance: {
      getAllocation: () => Promise.resolve(allocationRecord),
      allocateProvider: (command: unknown) => {
        capturedAllocationCommand = command;
        return Promise.resolve({ ...allocationRecord, allocationId: 'allocation_ops_wp07' });
      },
      respondToAllocation: (command: unknown) => {
        capturedResponseCommand = command;
        return Promise.resolve({
          providerAcceptanceId: 'provider-acceptance_wp07',
          workspaceId: customerWorkspaceId,
          version: 1,
          allocation: { id: allocationId, version: 1 },
          providerWorkspaceId,
          decision: 'ACCEPTED'
        });
      }
    },
    providerReturn: {
      createProviderReturn: (command: unknown) => {
        capturedReturnCommand = command;
        return Promise.resolve({
          providerReturnId: 'provider-return_wp07',
          workspaceId: customerWorkspaceId,
          providerWorkspaceId,
          version: 1,
          status: 'CURRENT'
        });
      }
    }
  } as unknown as MgsnHttpServices;
}

function headers(workspaceId: string, mutation = true) {
  const p = principal(workspaceId);
  return {
    cookie: 'mo_session=opaque',
    ...(workspaceId === providerWorkspaceId || workspaceId === readOnlyWorkspaceId
      ? { [PROVIDER_WORKSPACE_HEADER_NAME]: workspaceId }
      : { 'x-markorbit-workspace-id': workspaceId }),
    ...(mutation
      ? {
          origin,
          'x-markorbit-csrf-token': csrfToken(p.sessionId, csrfSecret),
          'idempotency-key': 'wp07-key'
        }
      : {})
  };
}

beforeEach(async () => {
  capturedResponseCommand = undefined;
  capturedReturnCommand = undefined;
  capturedAllocationCommand = undefined;
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

describe('M4-WP-07 authenticated Gateway provider journey', () => {
  it('requires a browser session before provider reads', async () => {
    const response = await fetch(`${base}/api/provider/allocations/${allocationId}`, {
      headers: { [PROVIDER_WORKSPACE_HEADER_NAME]: providerWorkspaceId }
    });
    expect(response.status).toBe(401);
    expect(((await response.json()) as any).code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('requires trusted Origin and CSRF before operations mutations', async () => {
    const response = await fetch(`${base}/api/mgsn/allocations`, {
      method: 'POST',
      headers: {
        cookie: 'mo_session=opaque',
        'content-type': 'application/json',
        'x-markorbit-workspace-id': customerWorkspaceId,
        'idempotency-key': 'ops-no-csrf'
      },
      body: JSON.stringify({ workspaceId: customerWorkspaceId })
    });
    expect(response.status).toBe(403);
    expect(capturedAllocationCommand).toBeUndefined();
  });

  it('denies provider mutations without execution:manage', async () => {
    const response = await fetch(`${base}/api/provider/allocations/${allocationId}/respond`, {
      method: 'POST',
      headers: {
        ...headers(readOnlyWorkspaceId),
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
    expect(response.status).toBe(403);
    expect(capturedResponseCommand).toBeUndefined();
  });

  it('rejects caller-supplied provider identity before forwarding', async () => {
    const response = await fetch(`${base}/api/provider/allocations/${allocationId}/respond`, {
      method: 'POST',
      headers: {
        ...headers(providerWorkspaceId),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId: customerWorkspaceId,
        providerId: 'provider_spoofed',
        expectedAllocationVersion: 1,
        decision: 'ACCEPTED',
        acknowledgement: 'accepted',
        correlationId: 'correlation_wp07'
      })
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as any).code).toBe('PROVIDER_IDENTITY_PAYLOAD_FORBIDDEN');
    expect(capturedResponseCommand).toBeUndefined();
  });

  it('binds Provider Acceptance to the authenticated Provider Workspace principal', async () => {
    const response = await fetch(`${base}/api/provider/allocations/${allocationId}/respond`, {
      method: 'POST',
      headers: {
        ...headers(providerWorkspaceId),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId: customerWorkspaceId,
        expectedAllocationVersion: 1,
        decision: 'ACCEPTED',
        acknowledgement: 'accepted through governed provider route',
        correlationId: 'correlation_wp07'
      })
    });
    expect(response.status).toBe(201);
    expect(capturedResponseCommand.principal).toEqual({
      actorId: 'user_provider',
      providerWorkspaceId
    });
    expect(capturedResponseCommand.workspaceId).toBe(customerWorkspaceId);
    expect(capturedResponseCommand.idempotencyKey).toBe('wp07-key');
  });

  it('binds Provider Return identity to the same authenticated Provider Workspace', async () => {
    const response = await fetch(`${base}/api/provider/returns`, {
      method: 'POST',
      headers: {
        ...headers(providerWorkspaceId),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId: customerWorkspaceId,
        allocationId,
        expectedAllocationVersion: 1,
        providerAcceptanceId: 'provider-acceptance_wp07',
        expectedProviderAcceptanceVersion: 1,
        servicePackageId: 'service-package_wp07',
        expectedServicePackageVersion: 1,
        workStatusClaim: 'WORK_COMPLETED',
        artifacts: [{ reference: 'artifact_wp07' }],
        assertions: [],
        correlationId: 'correlation_wp07'
      })
    });
    expect(response.status).toBe(201);
    expect(capturedReturnCommand.principal).toEqual({
      actorId: 'user_provider',
      providerWorkspaceId
    });
    expect(capturedReturnCommand.workspaceId).toBe(customerWorkspaceId);
    expect(capturedReturnCommand.idempotencyKey).toBe('wp07-key');
  });
});
