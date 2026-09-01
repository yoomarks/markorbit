import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import type { ContentOpportunity } from '@markorbit/contracts/product-loop';
import {
  ContentStudioError,
  PostgresContentStudioReader,
  type ContentStudioWorkList
} from '../src/content-studio.js';
import { createContentStudioRoutes } from '../src/http.js';

const workspaceId = '37373737-3737-4373-8373-373737373737';
const opportunity: ContentOpportunity = {
  schemaVersion: 1,
  workspaceId,
  contentOpportunityId: 'content-opportunity_unit',
  version: 1,
  sourceRecommendation: { id: 'today-recommendation_unit', version: 1 },
  title: 'Content work',
  rationale: 'Durable reason',
  sources: [
    {
      schemaVersion: 1,
      owner: 'KNOWLEDGE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: 'rdp_unit',
      sourceVersion: 1,
      sourceFingerprintSha256: 'a'.repeat(64),
      observedAt: '2026-08-31T00:00:00.000Z'
    }
  ],
  status: 'ACCEPTED_FOR_PREPARATION',
  contentOpportunityFingerprintSha256: 'b'.repeat(64),
  publishAuthorized: false,
  formalBusinessOpportunityCreated: false,
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z'
};
const row = {
  workspace_id: workspaceId,
  content_opportunity_id: opportunity.contentOpportunityId,
  version: 1,
  source_recommendation_id: opportunity.sourceRecommendation.id,
  source_recommendation_version: 1,
  content_opportunity_fingerprint_sha256: opportunity.contentOpportunityFingerprintSha256,
  document_json: opportunity
};
const secret = 'lite-content-studio-test-secret-0123456789';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  workspaceId,
  userId: 'user_studio',
  sessionId: 'session_studio',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  membershipId: 'membership_studio',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};
const empty: ContentStudioWorkList = {
  schemaVersion: 1,
  workspaceId,
  items: [],
  nextAfter: null,
  partial: true,
  warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
};

describe('#372 Content Studio failure and HTTP boundaries', () => {
  it.each([0, 1, 2, 3, 4])(
    'fails explicitly when persistence query %i fails, never absent artifacts',
    async (failedQuery) => {
      let count = 0;
      const query = vi.fn(() => {
        const index = count++;
        if (index === failedQuery) throw new Error('database connection lost');
        return Promise.resolve({ rows: index === 0 ? [row] : [], rowCount: index === 0 ? 1 : 0 });
      });
      const transact = vi.fn(async (operation: (client: QueryClient) => Promise<unknown>) =>
        operation({ query } as unknown as QueryClient)
      );
      const reader = new PostgresContentStudioReader({
        transact
      } as unknown as ConstructorParameters<typeof PostgresContentStudioReader>[0]);
      await expect(
        reader.find(workspaceId, opportunity.contentOpportunityId)
      ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE', status: 503 });
      expect(transact).toHaveBeenCalledWith(expect.any(Function), {
        isolation: 'REPEATABLE READ',
        readOnly: true
      });
    }
  );

  it('does not convert a failed list query into an empty Workspace', async () => {
    const reader = new PostgresContentStudioReader({
      transact: () => Promise.reject(new Error('offline'))
    });
    await expect(reader.list(workspaceId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    });
  });

  it('rejects invalid Workspace, work IDs and unbounded pagination before persistence', async () => {
    const transact = vi.fn();
    const reader = new PostgresContentStudioReader({ transact });
    await expect(reader.list('invalid')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(reader.find(workspaceId, '../other')).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
    for (const limit of [0, -1, 51, 1.5, NaN, Infinity])
      await expect(reader.list(workspaceId, { limit })).rejects.toMatchObject({
        code: 'INVALID_INPUT'
      });
    await expect(reader.list(workspaceId, { after: '' })).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
    expect(transact).not.toHaveBeenCalled();
  });

  function setup() {
    const reader = {
      list: vi.fn(() => Promise.resolve(empty)),
      find: vi.fn(() =>
        Promise.reject(
          new ContentStudioError('CONTENT_WORK_NOT_FOUND', 'Content work was not found.', 404)
        )
      )
    };
    const contentStore = {
      createDraft: vi.fn(),
      reviseDraft: vi.fn(),
      markDraftReadyForReview: vi.fn(),
      recordReview: vi.fn(),
      preparePublishPackage: vi.fn()
    };
    const routes = createContentStudioRoutes({
      internalServiceSecret: secret,
      reader,
      contentStore
    });
    const request = (headers: Record<string, string> = {}, query: Record<string, string> = {}) => ({
      method: 'GET' as const,
      path: '/v1/content-studio/works',
      body: undefined,
      params: { contentOpportunityId: opportunity.contentOpportunityId },
      query,
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
        'x-markorbit-workspace-id': workspaceId,
        ...headers
      }
    });
    return { reader, routes, request };
  }

  it('registers governed Content Studio routes, passes trusted Workspace to reads, and preserves 404', async () => {
    const { reader, routes, request } = setup();
    expect(routes.map(({ method, path }) => [method, path])).toEqual([
      ['GET', '/v1/content-studio/works'],
      ['GET', '/v1/content-studio/works/:contentOpportunityId'],
      ['POST', '/v1/content-studio/works/:contentOpportunityId/drafts'],
      ['POST', '/v1/content-drafts/:contentDraftId/revisions'],
      ['POST', '/v1/content-drafts/:contentDraftId/ready-for-review'],
      ['POST', '/v1/content-drafts/:contentDraftId/reviews'],
      ['POST', '/v1/content-drafts/:contentDraftId/publish-packages']
    ]);
    expect(
      await routes[0]!.handle(request({}, { limit: '2', after: 'content-opportunity_a' }))
    ).toMatchObject({ status: 200, body: empty });
    expect(reader.list).toHaveBeenCalledWith(workspaceId, {
      limit: 2,
      after: 'content-opportunity_a'
    });
    await expect(routes[1]!.handle(request())).rejects.toMatchObject({
      code: 'CONTENT_WORK_NOT_FOUND',
      status: 404
    });
    expect(reader.find).toHaveBeenCalledWith(workspaceId, opportunity.contentOpportunityId);
  });

  it.each([0, 1])(
    'authenticates and enforces read authority before route %i accesses data',
    async (index) => {
      const { reader, routes, request } = setup();
      const route = routes[index]!;
      for (const [headers, status] of [
        [{ 'x-markorbit-internal-authorization': '' }, 401],
        [{ 'x-markorbit-principal': 'invalid' }, 401],
        [{ 'x-markorbit-workspace-id': '' }, 404],
        [{ 'x-markorbit-workspace-id': '38383838-3838-4383-8383-383838383838' }, 404],
        [
          {
            'x-markorbit-principal': encodeInternalWorkspacePrincipal({
              ...principal,
              permissions: []
            })
          },
          403
        ]
      ] as const)
        await expect(route.handle(request(headers))).rejects.toMatchObject({ status });
      expect(reader.list).not.toHaveBeenCalled();
      expect(reader.find).not.toHaveBeenCalled();
    }
  );

  it('rejects unsupported filters and malformed pagination instead of silently accepting them', async () => {
    const { reader, routes, request } = setup();
    for (const query of [
      { limit: '1.5' },
      { limit: '' },
      { status: 'CANDIDATE' },
      { subjectUserId: 'user_other' }
    ])
      await expect(routes[0]!.handle(request({}, query))).rejects.toMatchObject({ status: 400 });
    await expect(routes[1]!.handle(request({}, { version: '1' }))).rejects.toMatchObject({
      status: 400
    });
    expect(reader.list).not.toHaveBeenCalled();
    expect(reader.find).not.toHaveBeenCalled();
  });
});
