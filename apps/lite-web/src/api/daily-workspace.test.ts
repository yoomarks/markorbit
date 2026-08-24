import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentKit, VisualBrief } from '@markorbit/contracts/daily-workspace';
import { createDailyWorkspaceClient } from './daily-workspace.js';

const workspaceId = '71717171-7171-4717-8717-717171717171';
const csrf = 'csrf-m9-wp07';

const kit: ContentKit = {
  schemaVersion: 1,
  contentKitId: 'content-kit_wp07',
  workspaceId,
  version: 3,
  contentPick: { id: 'content-pick_wp07', version: 1 },
  contentOpportunity: { id: 'content-opportunity_wp07', version: 1 },
  sources: [],
  whyItMatters: 'A governed source matters.',
  whyPublish: 'It is useful to explain.',
  angles: [],
  audience: 'Trademark practitioners',
  platformVariants: [],
  draftReferences: [],
  publishPackageReferences: [],
  visualBriefReferences: [],
  externalPublishExecuted: false,
  createdAt: '2026-08-18T06:00:00.000Z',
  updatedAt: '2026-08-18T06:00:00.000Z'
};

const brief: VisualBrief = {
  schemaVersion: 1,
  visualBriefId: 'visual-brief_wp07',
  workspaceId,
  version: 1,
  contentKit: { id: kit.contentKitId, version: kit.version },
  title: 'Trademark update',
  keyMessage: 'Explain the update.',
  audience: 'Trademark practitioners',
  outputKind: 'XIAOHONGSHU_COVER',
  aspectRatio: '3:4',
  styleIntent: 'MarkOrbit Lite editorial visual',
  requestedIpPackage: 'MOKI',
  sceneIntent: 'MOKI explains the update.',
  reuseFirstRequired: true,
  paidExecutionAuthorized: false,
  createdAt: '2026-08-18T06:01:00.000Z'
};

const visualRecord = {
  brief,
  visualBriefFingerprintSha256: 'a'.repeat(64)
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function parsedBody(init: RequestInit | undefined): Record<string, unknown> {
  expect(typeof init?.body).toBe('string');
  if (typeof init?.body !== 'string') throw new Error('Expected JSON request body.');
  return JSON.parse(init.body) as Record<string, unknown>;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Daily Workspace preference event wiring', () => {
  it('records CONTENT_STARTED and preserves exact Visual Brief read-your-writes continuity', async () => {
    const preferenceBodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.endsWith('/api/auth/session'))
        return Promise.resolve(jsonResponse({ csrfToken: csrf }));
      if (url.includes('/api/lite/content-kits/content-pick_wp07/visual-briefs'))
        return Promise.resolve(jsonResponse(visualRecord, 201));
      if (url.endsWith('/api/lite/content-kits/content-pick_wp07'))
        return Promise.resolve(jsonResponse(kit));
      if (url.endsWith('/api/lite/product-preference-events')) {
        preferenceBodies.push(parsedBody(init));
        return Promise.resolve(jsonResponse({ event: {}, preference: {} }, 201));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createDailyWorkspaceClient(workspaceId);
    const result = await client.createVisualBrief('content-pick_wp07', kit, {
      requestedIpPackage: 'MOKI',
      outputKind: 'XIAOHONGSHU_COVER',
      sceneIntent: 'MOKI explains the update.'
    });
    const exactReference = { id: brief.visualBriefId, version: brief.version };
    const readAfterWrite = await client.loadContentKit('content-pick_wp07');
    const exactRecordAfterWrite = await client.loadVisualBrief(exactReference);

    expect(result).toEqual(visualRecord);
    expect(readAfterWrite.visualBriefReferences).toEqual([exactReference]);
    expect(exactRecordAfterWrite).toEqual(visualRecord);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        requestUrl(input).includes('/api/lite/visual-briefs/visual-brief_wp07')
      )
    ).toBe(false);
    expect(preferenceBodies).toEqual([
      {
        workspaceId,
        kind: 'CONTENT_STARTED',
        targetType: 'CONTENT_KIT',
        targetId: kit.contentKitId,
        targetVersion: kit.version
      }
    ]);
  });

  it('records requested/generated Visual evidence without letting preference failure rewrite the primary result', async () => {
    const preferenceBodies: Record<string, unknown>[] = [];
    let preferenceAttempt = 0;
    const output = {
      schemaVersion: 1 as const,
      visualOutputReferenceId: 'visual-output_wp07',
      workspaceId,
      version: 1,
      visualBrief: { id: brief.visualBriefId, version: brief.version },
      owner: 'VISUAL_ENGINE' as const,
      requestReference: 'illustration-request://wp07',
      outputReference: 'delivery://wp07-ready',
      status: 'READY' as const,
      providerExecutionAuthorizedByLite: false as const,
      paidExecutionAuthorizedByLite: false as const,
      createdAt: '2026-08-18T06:02:00.000Z'
    };
    const primary = {
      requestReference: output.requestReference,
      output,
      acceptedAt: output.createdAt
    };
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.endsWith('/api/auth/session'))
        return Promise.resolve(jsonResponse({ csrfToken: csrf }));
      if (url.includes('/api/lite/visual-briefs/visual-brief_wp07/request'))
        return Promise.resolve(jsonResponse(primary, 201));
      if (url.endsWith('/api/lite/product-preference-events')) {
        preferenceBodies.push(parsedBody(init));
        preferenceAttempt += 1;
        if (preferenceAttempt === 1)
          return Promise.resolve(
            jsonResponse(
              { code: 'PREFERENCE_TEMPORARILY_UNAVAILABLE', message: 'Preference unavailable.' },
              503
            )
          );
        return Promise.resolve(jsonResponse({ event: {}, preference: {} }, 201));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createDailyWorkspaceClient(workspaceId).startVisualRequest(visualRecord);

    expect(result).toEqual(primary);
    expect(preferenceBodies.map((body) => body.kind)).toEqual([
      'VISUAL_REQUESTED',
      'VISUAL_GENERATED'
    ]);
    for (const body of preferenceBodies)
      expect(body).toMatchObject({
        workspaceId,
        targetType: 'VISUAL_OUTPUT',
        targetId: output.visualOutputReferenceId,
        targetVersion: output.version
      });
  });

  it('records only VISUAL_REQUESTED when the Visual Engine requires more planning', async () => {
    const preferenceBodies: Record<string, unknown>[] = [];
    const output = {
      schemaVersion: 1 as const,
      visualOutputReferenceId: 'visual-output_wp07-planning',
      workspaceId,
      version: 1,
      visualBrief: { id: brief.visualBriefId, version: brief.version },
      owner: 'VISUAL_ENGINE' as const,
      requestReference: 'illustration-request://wp07-planning',
      status: 'PLANNING_REQUIRED' as const,
      providerExecutionAuthorizedByLite: false as const,
      paidExecutionAuthorizedByLite: false as const,
      createdAt: '2026-08-18T06:03:00.000Z'
    };
    const primary = {
      requestReference: output.requestReference,
      output,
      acceptedAt: output.createdAt
    };
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.endsWith('/api/auth/session'))
        return Promise.resolve(jsonResponse({ csrfToken: csrf }));
      if (url.includes('/api/lite/visual-briefs/visual-brief_wp07/request'))
        return Promise.resolve(jsonResponse(primary, 201));
      if (url.endsWith('/api/lite/product-preference-events')) {
        preferenceBodies.push(parsedBody(init));
        return Promise.resolve(jsonResponse({ event: {}, preference: {} }, 201));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createDailyWorkspaceClient(workspaceId).startVisualRequest(visualRecord);

    expect(result).toEqual(primary);
    expect(preferenceBodies.map((body) => body.kind)).toEqual(['VISUAL_REQUESTED']);
    expect(preferenceBodies[0]).toMatchObject({
      workspaceId,
      targetType: 'VISUAL_OUTPUT',
      targetId: output.visualOutputReferenceId,
      targetVersion: output.version
    });
  });
});
