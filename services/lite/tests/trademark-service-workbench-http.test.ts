import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import { createTrademarkServiceWorkbenchRoutes } from '../src/trademark-service-workbench-http.js';
import type { PostgresTrademarkServiceWorkPackageStore } from '../src/trademark-service-work-package.js';

const workspaceId = '96969696-9696-4969-8969-969696969696';
const otherWorkspaceId = '97979797-9797-4979-8979-979797979797';
const secret = 'lite-reviewed-draft-http-secret-0123456789';
const workPackageId = 'trademark-service-work-package_http-reviewed';
const preparationId = 'trademark-service-preparation_http-reviewed';
const draft = {
  preparationId,
  kind: 'CLIENT_INFORMATION_REQUEST',
  subject: 'Information needed',
  body: 'Please confirm the applicant name.',
  recipientReference: 'workspace-directory-entry_http-client',
  sent: false,
  externalContactAuthorized: false
} as const;

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  workspaceId,
  userId: 'user_reviewed_draft_http',
  sessionId: 'session_reviewed_draft_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  membershipId: 'membership_reviewed_draft_http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'review:perform']
};

function setup() {
  type Store = Pick<
    PostgresTrademarkServiceWorkPackageStore,
    'saveReviewedCommunicationDraft' | 'getCurrentReviewedCommunicationDraft'
  >;
  const workPackage = {
    workPackageId,
    workspaceId,
    version: 2,
    communicationDrafts: [draft],
    protectedActionAuthorized: false
  } as unknown as Awaited<ReturnType<Store['saveReviewedCommunicationDraft']>>;
  const reviewedDraft = {
    workPackage: { id: workPackageId, version: 2 },
    draft,
    draftFingerprintSha256: 'a'.repeat(64)
  } as Awaited<ReturnType<Store['getCurrentReviewedCommunicationDraft']>>;
  const store = {
    saveReviewedCommunicationDraft: vi
      .fn<Store['saveReviewedCommunicationDraft']>()
      .mockResolvedValue(workPackage),
    getCurrentReviewedCommunicationDraft: vi
      .fn<Store['getCurrentReviewedCommunicationDraft']>()
      .mockResolvedValue(reviewedDraft)
  } satisfies Store;
  const query = { query: vi.fn() } as unknown as QueryClient;
  const routes = createTrademarkServiceWorkbenchRoutes({
    internalServiceSecret: secret,
    workPackages: store as unknown as PostgresTrademarkServiceWorkPackageStore,
    query
  });
  const save = routes.find(
    (route) =>
      route.method === 'POST' &&
      route.path ===
        '/v1/trademark-service-work-packages/:workPackageId/reviewed-communication-drafts'
  )!;
  const read = routes.find(
    (route) =>
      route.method === 'GET' &&
      route.path ===
        '/v1/trademark-service-work-packages/:workPackageId/reviewed-communication-drafts/:preparationId'
  )!;
  const request = (
    method: 'GET' | 'POST',
    body: Record<string, unknown> | undefined,
    actor: WorkspacePrincipal = principal,
    headers: Record<string, string> = {}
  ) => ({
    method,
    path: method === 'POST' ? save.path : read.path,
    params: { workPackageId, preparationId },
    query: {},
    body,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(actor),
      'x-markorbit-workspace-id': actor.workspaceId,
      ...(method === 'POST' ? { 'idempotency-key': 'reviewed-draft-http-command' } : {}),
      ...headers
    }
  });
  return { store, save, read, request };
}

describe('#1184 reviewed communication draft Workbench HTTP', () => {
  it('persists only through an authenticated review mutation and exposes the current owner snapshot', async () => {
    const { store, save, read, request } = setup();
    const saved = await save.handle(request('POST', { expectedWorkPackageVersion: 1, draft }));
    expect(saved.status).toBe(201);
    expect(store.saveReviewedCommunicationDraft).toHaveBeenCalledWith({
      workspaceId,
      workPackageId,
      expectedVersion: 1,
      draft,
      idempotencyKey: 'reviewed-draft-http-command'
    });

    const current = await read.handle(request('GET', undefined));
    expect(current.status).toBe(200);
    expect(store.getCurrentReviewedCommunicationDraft).toHaveBeenCalledWith(
      workspaceId,
      workPackageId,
      preparationId
    );
  });

  it('rejects actor spoofing, missing idempotency and missing review authority before persistence', async () => {
    const { store, save, request } = setup();
    await expect(
      save.handle(
        request('POST', {
          expectedWorkPackageVersion: 1,
          draft,
          reviewedByPrincipalId: 'spoofed-user'
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    await expect(
      save.handle(
        request('POST', { expectedWorkPackageVersion: 1, draft }, principal, {
          'idempotency-key': ''
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    const readerOnly: WorkspacePrincipal = {
      ...principal,
      userId: 'reader_only',
      permissions: ['workspace:read']
    };
    await expect(
      save.handle(request('POST', { expectedWorkPackageVersion: 1, draft }, readerOnly))
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(store.saveReviewedCommunicationDraft).not.toHaveBeenCalled();
  });

  it('keeps current reviewed-draft reads Workspace-scoped', async () => {
    const { store, read, request } = setup();
    await expect(
      read.handle(
        request('GET', undefined, principal, { 'x-markorbit-workspace-id': otherWorkspaceId })
      )
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
    expect(store.getCurrentReviewedCommunicationDraft).not.toHaveBeenCalled();
  });
});
