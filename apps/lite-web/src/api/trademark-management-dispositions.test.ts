// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrademarkAssetClient } from './trademark-assets.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const assetId = 'trademark-asset_disposition-web' as const;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Trademark Asset management disposition browser client', () => {
  it('loads exact-current owner truth with credentials and Workspace header only', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      jsonResponse({
        schemaVersion: 1,
        workspaceId,
        asset: { id: assetId, version: 7 },
        items: [
          {
            signal: { id: 'trademark-asset-management-signal_current', version: 4 },
            disposition: null
          }
        ]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await createTrademarkAssetClient(workspaceId).loadManagementDispositions(assetId);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({
      'x-markorbit-workspace-id': workspaceId
    });
    expect(init.headers).not.toHaveProperty('x-markorbit-csrf-token');
    expect(init.headers).not.toHaveProperty('idempotency-key');
    expect(init.body).toBeUndefined();
  });

  it('posts only bounded disposition fields with CSRF and stable logical idempotency header', async () => {
    const idempotencyKey = 'logical-disposition-1';
    const input = {
      expectedTrademarkAssetVersion: 7,
      managementSignal: { id: 'trademark-asset-management-signal_current', version: 4 },
      recommendation: {
        id: 'trademark-asset-management-recommendation_current',
        version: 2
      },
      kind: 'WATCHED'
    } as const;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse({ csrfToken: 'csrf-browser-token' }))
      .mockImplementationOnce(() =>
        jsonResponse({
          disposition: {
            schemaVersion: 1,
            dispositionId: 'trademark-asset-management-disposition_saved',
            workspaceId,
            version: 1,
            asset: { id: assetId, version: 7 },
            signal: input.managementSignal,
            recommendation: input.recommendation,
            kind: 'WATCHED',
            subjectUserId: 'owner-resolved-server-side',
            recordedAt: '2026-09-03T01:00:00.000Z',
            officialTruthCreated: false,
            legalConclusionVerified: false,
            capabilityVerified: false
          }
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await createTrademarkAssetClient(workspaceId).recordManagementDisposition(
      assetId,
      input,
      idempotencyKey
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [sessionUrl, sessionInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(sessionUrl).toContain('/api/auth/session');
    expect(sessionInit.credentials).toBe('include');

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain(`/api/lite/trademark-assets/${assetId}/management-dispositions`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers).toMatchObject({
      'x-markorbit-workspace-id': workspaceId,
      'x-markorbit-csrf-token': 'csrf-browser-token',
      'idempotency-key': idempotencyKey
    });
    expect(JSON.parse(String(init.body))).toEqual(input);
    expect(JSON.parse(String(init.body))).not.toMatchObject({
      workspaceId,
      trademarkAssetId: assetId,
      subjectUserId: expect.anything(),
      workflowReference: expect.anything(),
      authority: expect.anything(),
      source: expect.anything(),
      provider: expect.anything(),
      model: expect.anything()
    });
  });
});
