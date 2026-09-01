import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  LiteContentPreparationError,
  type PostgresLiteContentPreparationStore
} from '../src/content-preparation.js';
import { createContentStudioRoutes } from '../src/http.js';

const workspaceId = '53535353-5353-4353-8353-535353535353';
const otherWorkspaceId = '54545454-5454-4454-8454-545454545454';
const secret = 'lite-content-preparation-http-secret-0123456789';
const draftFingerprint = 'd'.repeat(64);
const opportunityFingerprint = 'e'.repeat(64);
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  workspaceId,
  userId: 'user_content_reviewer',
  sessionId: 'session_content_reviewer',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  membershipId: 'membership_content_reviewer',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};

function setup() {
  type ContentStore = Pick<
    PostgresLiteContentPreparationStore,
    | 'createDraft'
    | 'reviseDraft'
    | 'markDraftReadyForReview'
    | 'recordReview'
    | 'preparePublishPackage'
  >;
  const draft = {} as Awaited<ReturnType<ContentStore['createDraft']>>;
  const review = {} as Awaited<ReturnType<ContentStore['recordReview']>>;
  const publishPackage = {
    externalPublishExecuted: false
  } as Awaited<ReturnType<ContentStore['preparePublishPackage']>>;
  const contentStore = {
    createDraft: vi.fn<ContentStore['createDraft']>().mockResolvedValue(draft),
    reviseDraft: vi.fn<ContentStore['reviseDraft']>().mockResolvedValue(draft),
    markDraftReadyForReview: vi
      .fn<ContentStore['markDraftReadyForReview']>()
      .mockResolvedValue(draft),
    recordReview: vi.fn<ContentStore['recordReview']>().mockResolvedValue(review),
    preparePublishPackage: vi
      .fn<ContentStore['preparePublishPackage']>()
      .mockResolvedValue(publishPackage)
  } satisfies ContentStore;
  const routes = createContentStudioRoutes({
    internalServiceSecret: secret,
    reader: { list: vi.fn(), find: vi.fn() },
    contentStore
  });
  const mutations = routes.slice(2);
  const request = (
    index: number,
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
  ) => ({
    method: 'POST' as const,
    path: mutations[index]!.path,
    body,
    params: {
      contentOpportunityId: 'content-opportunity_http',
      contentDraftId: 'content-draft_http'
    },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': `http-command-${index}`,
      ...headers
    }
  });
  return { contentStore, mutations, request };
}

const bodies = [
  {
    contentOpportunityVersion: 3,
    expectedContentOpportunityFingerprintSha256: opportunityFingerprint,
    title: 'Initial draft',
    body: 'Initial body'
  },
  {
    expectedVersion: 7,
    expectedContentDraftFingerprintSha256: draftFingerprint,
    title: 'Revised draft',
    body: 'Revised body'
  },
  {
    expectedVersion: 8,
    expectedContentDraftFingerprintSha256: draftFingerprint
  },
  {
    contentDraftVersion: 9,
    expectedContentDraftFingerprintSha256: draftFingerprint,
    outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
    rationale: 'Human approval'
  },
  {
    contentDraftVersion: 9,
    expectedContentDraftFingerprintSha256: draftFingerprint,
    reviewDecisionId: 'content-review-decision_http',
    reviewDecisionVersion: 2
  }
] as const;

describe('#523 governed Content preparation HTTP mutations', () => {
  it('forwards the exact five commands through the existing store and never publishes externally', async () => {
    const { contentStore, mutations, request } = setup();
    const responses = [];
    for (let index = 0; index < mutations.length; index++)
      responses.push(await mutations[index]!.handle(request(index, bodies[index]!)));

    expect(responses.map(({ status }) => status)).toEqual([201, 200, 200, 201, 201]);
    expect(contentStore.createDraft).toHaveBeenCalledWith({
      workspaceId,
      contentOpportunity: { id: 'content-opportunity_http', version: 3 },
      expectedContentOpportunityFingerprintSha256: opportunityFingerprint,
      title: 'Initial draft',
      body: 'Initial body',
      idempotencyKey: 'http-command-0'
    });
    expect(contentStore.reviseDraft).toHaveBeenCalledWith({
      workspaceId,
      contentDraftId: 'content-draft_http',
      expectedVersion: 7,
      expectedContentDraftFingerprintSha256: draftFingerprint,
      title: 'Revised draft',
      body: 'Revised body',
      idempotencyKey: 'http-command-1'
    });
    expect(contentStore.markDraftReadyForReview).toHaveBeenCalledWith({
      workspaceId,
      contentDraftId: 'content-draft_http',
      expectedVersion: 8,
      expectedContentDraftFingerprintSha256: draftFingerprint,
      idempotencyKey: 'http-command-2'
    });
    expect(contentStore.recordReview).toHaveBeenCalledWith({
      workspaceId,
      contentDraft: { id: 'content-draft_http', version: 9 },
      expectedContentDraftFingerprintSha256: draftFingerprint,
      outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
      rationale: 'Human approval',
      reviewerPrincipalId: principal.userId,
      idempotencyKey: 'http-command-3'
    });
    expect(contentStore.preparePublishPackage).toHaveBeenCalledWith({
      workspaceId,
      contentDraft: { id: 'content-draft_http', version: 9 },
      expectedContentDraftFingerprintSha256: draftFingerprint,
      reviewDecision: { id: 'content-review-decision_http', version: 2 },
      idempotencyKey: 'http-command-4'
    });
    expect(responses[4]).toMatchObject({
      body: { externalPublishExecuted: false }
    });
  });

  it.each([0, 1, 2, 3, 4])(
    'requires trusted Principal Workspace, matter:manage, and Idempotency-Key for mutation %i',
    async (index) => {
      const { contentStore, mutations, request } = setup();
      await expect(
        mutations[index]!.handle(
          request(index, bodies[index]!, { 'x-markorbit-internal-authorization': '' })
        )
      ).rejects.toMatchObject({ code: 'UNTRUSTED_INTERNAL_CALLER', status: 401 });
      await expect(
        mutations[index]!.handle(
          request(index, bodies[index]!, { 'x-markorbit-principal': 'invalid' })
        )
      ).rejects.toMatchObject({ code: 'INVALID_INTERNAL_PRINCIPAL', status: 401 });
      await expect(
        mutations[index]!.handle(
          request(index, bodies[index]!, { 'x-markorbit-workspace-id': otherWorkspaceId })
        )
      ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH', status: 404 });
      await expect(
        mutations[index]!.handle(
          request(index, bodies[index]!, {
            'x-markorbit-principal': encodeInternalWorkspacePrincipal({
              ...principal,
              permissions: ['workspace:read']
            })
          })
        )
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
      await expect(
        mutations[index]!.handle(request(index, bodies[index]!, { 'idempotency-key': '' }))
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED', status: 400 });
      expect(Object.values(contentStore).every((method) => method.mock.calls.length === 0)).toBe(
        true
      );
    }
  );

  it.each(['reviewerPrincipalId', 'actorId', 'userId', 'confirmedByPrincipalId'])(
    'rejects client-supplied actor authority in %s',
    async (field) => {
      const { contentStore, mutations, request } = setup();
      await expect(
        mutations[3]!.handle(request(3, { ...bodies[3], [field]: 'user_spoofed' }))
      ).rejects.toMatchObject({ code: 'ACTOR_SPOOF_REJECTED', status: 400 });
      expect(contentStore.recordReview).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['INVALID_INPUT', 422],
    ['NOT_FOUND', 404],
    ['STALE_SOURCE', 409],
    ['SOURCE_VERSION_MISMATCH', 409],
    ['SOURCE_FINGERPRINT_MISMATCH', 409],
    ['HUMAN_REVIEW_REQUIRED', 409],
    ['IDEMPOTENCY_CONFLICT', 409],
    ['VERSION_CONFLICT', 409],
    ['INVALID_TRANSITION', 409],
    ['PERSISTENCE_UNAVAILABLE', 503]
  ] as const)('preserves owner error %s as HTTP %i', async (code, status) => {
    const { contentStore, mutations, request } = setup();
    contentStore.createDraft.mockRejectedValueOnce(
      new LiteContentPreparationError(code, 'owner failure', status, { evidence: 'exact' })
    );
    await expect(mutations[0]!.handle(request(0, bodies[0]))).rejects.toMatchObject({
      code,
      status,
      details: { evidence: 'exact' }
    });
  });
});
