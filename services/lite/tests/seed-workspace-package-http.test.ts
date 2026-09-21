import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  seedWorkspacePackageFingerprintSha256V1,
  type SeedWorkspacePackageV1
} from '@markorbit/contracts/seed-workspace-package';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createSeedWorkspacePackageRoutes } from '../src/seed-workspace-package-http.js';

const secret = 'seed-workspace-package-http-secret-0123456789';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_seed_owner',
  sessionId: 'session_seed_owner',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_seed_owner',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'workspace:manage']
};

function packageFor(preparedByWorkspaceId = workspaceId): SeedWorkspacePackageV1 {
  const base: Omit<SeedWorkspacePackageV1, 'packageFingerprintSha256'> = {
    schemaVersion: 1,
    seedWorkspacePackageId: 'seed-workspace-package_http-001',
    version: 1,
    stage: 'PREPARED',
    preparedByWorkspaceId,
    target: {
      kind: 'AGENCY',
      displayName: 'Example IP Agency',
      sourceRefs: [
        {
          owner: 'DATA_ENGINE',
          kind: 'CNIPA_AGENCY',
          id: 'agency-http-001',
          version: 1,
          fingerprintSha256: '1'.repeat(64),
          observedAt: '2026-09-21T00:00:00.000Z'
        }
      ]
    },
    collections: {},
    preparedAt: '2026-09-21T00:00:00.000Z',
    expiresAt: '2026-10-21T00:00:00.000Z',
    authorityConsequences: {
      accountCreated: false,
      workspaceActivated: false,
      organizationAuthorityEstablished: false,
      customerRelationshipEstablished: false,
      managedAssetEstablished: false,
      opportunityQualified: false,
      marketingConsentInferred: false,
      externalInvitationSent: false,
      externalActionAuthorized: false
    }
  };
  return {
    ...base,
    packageFingerprintSha256: seedWorkspacePackageFingerprintSha256V1(base)
  };
}

type Method = JsonRequest['method'];

function setup() {
  const item = packageFor();
  const preview = {
    schemaVersion: 1 as const,
    seedWorkspacePackageId: item.seedWorkspacePackageId,
    target: { kind: item.target.kind, displayName: item.target.displayName },
    counts: {},
    preparedAt: item.preparedAt,
    expiresAt: item.expiresAt
  };
  const store = {
    savePrepared: vi.fn().mockResolvedValue(item),
    readForWorkspace: vi.fn().mockResolvedValue(item),
    previewInvitation: vi.fn().mockResolvedValue(preview)
  };
  const claimResult = {
    package: item,
    claim: {
      schemaVersion: 1 as const,
      seedWorkspacePackageId: item.seedWorkspacePackageId,
      packageFingerprintSha256: item.packageFingerprintSha256,
      educationCommunityJourneyId: 'education-journey_http',
      journeyVersion: 3,
      journeyFingerprintSha256: '2'.repeat(64),
      activatedWorkspaceId: workspaceId,
      workspaceActivationVersion: 1,
      workspaceActivationFingerprintSha256: '3'.repeat(64),
      workspaceActivationObservedAt: '2026-09-21T01:00:00.000Z',
      claimedByPrincipalId: principal.userId,
      claimedAt: '2026-09-21T01:00:00.000Z'
    },
    journey: {
      stage: 'WORKSPACE_ACTIVATED'
    }
  };
  const claims = { claim: vi.fn().mockResolvedValue(claimResult) };
  const firstValueResult = {
    workItem: {
      owner: 'LITE' as const,
      kind: 'LITE_WORK_ITEM' as const,
      id: 'lite-work-item_seed-first-value',
      version: 1,
      fingerprintSha256: '4'.repeat(64),
      observedAt: '2026-09-21T01:05:00.000Z'
    },
    journey: { stage: 'FIRST_VALUE_RECORDED', version: 4 }
  };
  const firstValue = { record: vi.fn().mockResolvedValue(firstValueResult) };
  const routes = createSeedWorkspacePackageRoutes({
    internalServiceSecret: secret,
    store,
    claims,
    firstValue
  });
  const route = (method: Method, path: string) => {
    const found = routes.find(
      (candidate) => candidate.method === method && candidate.path === path
    );
    if (!found) throw new Error(`Missing ${method} ${path}`);
    return found;
  };
  return {
    item,
    preview,
    store,
    claims,
    firstValue,
    firstValueResult,
    routes,
    route,
    claimResult
  };
}

function request(input: {
  method: Method;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}): JsonRequest {
  return {
    method: input.method,
    path: input.path,
    params: input.params ?? {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      ...input.headers
    },
    body: input.body
  };
}

describe('Seed Workspace Package HTTP owner boundary', () => {
  it('exposes only preview, prepare, scoped read, claim and first-value routes', () => {
    const { routes } = setup();
    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /v1/seed-workspace-invitations/preview',
      'POST /v1/seed-workspace-packages',
      'GET /v1/seed-workspace-packages/:packageId',
      'POST /v1/seed-workspace-claims',
      'POST /v1/seed-workspace-packages/:packageId/first-value'
    ]);
    expect(
      routes.some(({ path }) => /send|customer|managed|opportunity|publish|filing/i.test(path))
    ).toBe(false);
  });

  it('previews only sanitized package metadata from the invitation bearer token', async () => {
    const { route, item, preview, store } = setup();
    expect(
      await route('POST', '/v1/seed-workspace-invitations/preview').handle(
        request({
          method: 'POST',
          path: '/v1/seed-workspace-invitations/preview',
          body: {
            packageId: item.seedWorkspacePackageId,
            invitationClaimToken: 'opaque-invitation-token'
          },
          headers: {
            'x-markorbit-principal': '',
            'x-markorbit-workspace-id': ''
          }
        })
      )
    ).toEqual({ status: 200, body: preview });
    expect(store.previewInvitation).toHaveBeenCalledWith({
      packageId: item.seedWorkspacePackageId,
      invitationClaimToken: 'opaque-invitation-token'
    });
    expect(JSON.stringify(preview)).not.toContain('sourceRefs');
  });

  it('persists only a package prepared by the authenticated Workspace', async () => {
    const { route, item, store } = setup();
    expect(
      await route('POST', '/v1/seed-workspace-packages').handle(
        request({
          method: 'POST',
          path: '/v1/seed-workspace-packages',
          body: item
        })
      )
    ).toEqual({ status: 201, body: item });
    expect(store.savePrepared).toHaveBeenCalledWith(item);

    await expect(
      route('POST', '/v1/seed-workspace-packages').handle(
        request({
          method: 'POST',
          path: '/v1/seed-workspace-packages',
          body: packageFor(otherWorkspaceId)
        })
      )
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
    expect(store.savePrepared).toHaveBeenCalledTimes(1);
  });

  it('reads only through Workspace-scoped owner access', async () => {
    const { route, item, store } = setup();
    expect(
      await route('GET', '/v1/seed-workspace-packages/:packageId').handle(
        request({
          method: 'GET',
          path: `/v1/seed-workspace-packages/${item.seedWorkspacePackageId}`,
          params: { packageId: item.seedWorkspacePackageId }
        })
      )
    ).toEqual({ status: 200, body: item });
    expect(store.readForWorkspace).toHaveBeenCalledWith(workspaceId, item.seedWorkspacePackageId);
  });

  it('claims with the existing invitation token and exact authenticated Workspace principal', async () => {
    const { route, item, claims, claimResult } = setup();
    expect(
      await route('POST', '/v1/seed-workspace-claims').handle(
        request({
          method: 'POST',
          path: '/v1/seed-workspace-claims',
          headers: { 'idempotency-key': 'seed-claim-http-001' },
          body: {
            packageId: item.seedWorkspacePackageId,
            invitationClaimToken: 'opaque-invitation-token'
          }
        })
      )
    ).toEqual({ status: 200, body: claimResult });
    expect(claims.claim).toHaveBeenCalledWith({
      packageId: item.seedWorkspacePackageId,
      workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: 'seed-claim-http-001',
      invitationClaimToken: 'opaque-invitation-token'
    });
  });

  it('records first value only through exact authenticated Workspace lineage', async () => {
    const { route, item, firstValue, firstValueResult } = setup();
    expect(
      await route('POST', '/v1/seed-workspace-packages/:packageId/first-value').handle(
        request({
          method: 'POST',
          path: `/v1/seed-workspace-packages/${item.seedWorkspacePackageId}/first-value`,
          params: { packageId: item.seedWorkspacePackageId },
          headers: { 'idempotency-key': 'seed-first-value-http-001' },
          body: { workItemId: 'lite-work-item_seed-first-value' }
        })
      )
    ).toEqual({ status: 200, body: firstValueResult });
    expect(firstValue.record).toHaveBeenCalledWith({
      packageId: item.seedWorkspacePackageId,
      workspaceId,
      actorPrincipalId: principal.userId,
      idempotencyKey: 'seed-first-value-http-001',
      workItemId: 'lite-work-item_seed-first-value'
    });
  });

  it('fails closed for missing idempotency, insufficient permission and untrusted callers', async () => {
    const { route, item, claims } = setup();
    await expect(
      route('POST', '/v1/seed-workspace-claims').handle(
        request({
          method: 'POST',
          path: '/v1/seed-workspace-claims',
          body: {
            packageId: item.seedWorkspacePackageId,
            invitationClaimToken: 'opaque-invitation-token'
          }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(claims.claim).not.toHaveBeenCalled();

    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    await expect(
      route('POST', '/v1/seed-workspace-claims').handle(
        request({
          method: 'POST',
          path: '/v1/seed-workspace-claims',
          headers: {
            'idempotency-key': 'denied',
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly)
          },
          body: {
            packageId: item.seedWorkspacePackageId,
            invitationClaimToken: 'opaque-invitation-token'
          }
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });

    await expect(
      route('GET', '/v1/seed-workspace-packages/:packageId').handle(
        request({
          method: 'GET',
          path: `/v1/seed-workspace-packages/${item.seedWorkspacePackageId}`,
          params: { packageId: item.seedWorkspacePackageId },
          headers: { 'x-markorbit-internal-authorization': 'wrong' }
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });
  });
});
