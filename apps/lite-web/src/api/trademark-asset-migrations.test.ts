import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTrademarkAssetMigrationClient,
  type HistoricalTrademarkAssetTabularPreparationRequest,
  type ReviewableTrademarkAssetMigrationRequest
} from './trademark-asset-migrations.js';
import type { TrademarkAssetHttpError } from './trademark-assets.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const tabular: HistoricalTrademarkAssetTabularPreparationRequest = {
  migrationKey: 'legacy-tabular-2026',
  sourceFingerprintSha256: 'a'.repeat(64),
  sourceArtifactId: 'legacy-portfolio.xlsx',
  sourceArtifactVersion: 'sheet1-v1',
  observedAt: '2026-09-15T00:00:00.000Z',
  relationshipKind: 'REPRESENTED',
  headers: ['Jurisdiction', 'Mark', 'Application No.'],
  columns: { jurisdiction: 'Jurisdiction', markText: 'Mark', applicationNumber: 'Application No.' },
  rows: [{ rowKey: 'sheet-row-1', cells: ['US', 'ALPHA', '98123456'] }]
};
const review: ReviewableTrademarkAssetMigrationRequest = {
  migrationKey: 'legacy-tabular-2026',
  sourceFingerprintSha256: 'a'.repeat(64),
  rows: [
    {
      rowKey: 'sheet-row-1',
      item: {
        identity: { jurisdiction: 'US', markText: 'ALPHA' },
        externalIdentifiers: [
          {
            kind: 'APPLICATION_NUMBER',
            jurisdiction: 'US',
            value: '98123456',
            officialTruthVerifiedByLite: false
          }
        ],
        workspaceRelationships: [{ kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }],
        sourceReferences: [
          {
            owner: 'WORKSPACE_USER',
            kind: 'WORKSPACE_ADMISSION',
            sourceId: 'legacy-portfolio.xlsx#row:1',
            sourceVersion: 'sheet1-v1',
            observedAt: '2026-09-15T00:00:00.000Z',
            freshness: 'UNKNOWN'
          }
        ]
      }
    }
  ]
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('Trademark Asset historical migration client', () => {
  it('prepares decoded tabular rows with CSRF but without idempotency or Workspace spoofing', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        calls.push({ url, ...(init ? { init } : {}) });
        if (url.endsWith('/api/auth/session'))
          return Promise.resolve(response({ csrfToken: 'csrf-prepare' }));
        return Promise.resolve(
          response({
            schemaVersion: 1,
            workspaceId,
            migrationKey: tabular.migrationKey,
            manifestFingerprintSha256: 'b'.repeat(64),
            total: 1,
            ready: 1,
            unresolved: 0,
            readyRows: [],
            unresolvedRows: [],
            officialTruthVerifiedByLite: false,
            assetsCreatedAutomatically: false,
            matterCreatedAutomatically: false
          })
        );
      })
    );

    const result = await createTrademarkAssetMigrationClient(workspaceId).prepareTabular(tabular);
    expect(result.ready).toBe(1);
    expect(calls).toHaveLength(2);
    const mutation = calls[1]!;
    expect(mutation.url).toContain('/api/lite/trademark-asset-migrations/prepare-tabular');
    expect(mutation.init?.method).toBe('POST');
    const headers = new Headers(mutation.init?.headers);
    expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-prepare');
    expect(headers.has('idempotency-key')).toBe(false);
    const body = JSON.parse(mutation.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual(tabular);
    expect(body).not.toHaveProperty('workspaceId');
  });

  it('previews reviewed rows with CSRF and explicit idempotency', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        calls.push({ url, ...(init ? { init } : {}) });
        if (url.endsWith('/api/auth/session'))
          return Promise.resolve(response({ csrfToken: 'csrf-preview' }));
        return Promise.resolve(
          response({
            schemaVersion: 1,
            workspaceId,
            migrationKey: review.migrationKey,
            fingerprint: 'b'.repeat(64),
            total: 1,
            chunkCount: 1,
            chunks: [],
            rows: [],
            officialTruthVerifiedByLite: false,
            matterCreatedAutomatically: false
          })
        );
      })
    );

    const result = await createTrademarkAssetMigrationClient(workspaceId).preview(
      review,
      'preview-key-1'
    );
    expect(result.migrationKey).toBe(review.migrationKey);
    expect(calls).toHaveLength(2);
    const mutation = calls[1]!;
    expect(mutation.url).toContain('/api/lite/trademark-asset-migrations/preview');
    const headers = new Headers(mutation.init?.headers);
    expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-preview');
    expect(headers.get('idempotency-key')).toBe('preview-key-1');
    const body = JSON.parse(mutation.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual(review);
    expect(body).not.toHaveProperty('workspaceId');
  });

  it('loads migration progress without a CSRF session round-trip', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        calls.push({ url, ...(init ? { init } : {}) });
        return Promise.resolve(
          response({
            schemaVersion: 1,
            workspaceId,
            migrationKey: 'legacy/key 1',
            fingerprint: 'b'.repeat(64),
            total: 1,
            created: 0,
            duplicates: 0,
            rejected: 0,
            chunkCount: 1,
            items: [],
            officialTruthVerifiedByLite: false,
            matterCreatedAutomatically: false,
            status: 'PREVIEWED',
            nextChunkIndex: 0,
            rowKeys: ['sheet-row-1'],
            updatedAt: '2026-09-15T00:01:00.000Z'
          })
        );
      })
    );

    const result = await createTrademarkAssetMigrationClient(workspaceId).progress('legacy/key 1');
    expect(result.status).toBe('PREVIEWED');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('/api/lite/trademark-asset-migrations/legacy%2Fkey%201');
    expect(calls[0]?.init?.method).toBe('GET');
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(headers.has('x-markorbit-csrf-token')).toBe(false);
  });

  it('commits the exact reviewed migration with CSRF and idempotency', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        calls.push({ url, ...(init ? { init } : {}) });
        if (url.endsWith('/api/auth/session'))
          return Promise.resolve(response({ csrfToken: 'csrf-commit' }));
        return Promise.resolve(
          response({
            schemaVersion: 1,
            workspaceId,
            migrationKey: review.migrationKey,
            fingerprint: 'b'.repeat(64),
            total: 1,
            created: 1,
            duplicates: 0,
            rejected: 0,
            chunkCount: 1,
            items: [],
            officialTruthVerifiedByLite: false,
            matterCreatedAutomatically: false
          })
        );
      })
    );

    const result = await createTrademarkAssetMigrationClient(workspaceId).commit(
      'legacy/key 1',
      review,
      'commit-key-1'
    );
    expect(result.created).toBe(1);
    expect(calls).toHaveLength(2);
    const mutation = calls[1]!;
    expect(mutation.url).toContain('/api/lite/trademark-asset-migrations/legacy%2Fkey%201/commit');
    const headers = new Headers(mutation.init?.headers);
    expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-commit');
    expect(headers.get('idempotency-key')).toBe('commit-key-1');
    const body = JSON.parse(mutation.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual(review);
    expect(body).not.toHaveProperty('workspaceId');
  });

  it('maps network and owner HTTP failures without manufacturing success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: 'csrf-error' }))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createTrademarkAssetMigrationClient(workspaceId).prepareTabular(tabular)
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE', retryable: true });

    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          response({ code: 'RUN_MISMATCH', message: 'review changed', retryable: false }, 409)
        )
      )
    );
    await expect(
      createTrademarkAssetMigrationClient(workspaceId).progress('legacy-tabular-2026')
    ).rejects.toEqual(
      expect.objectContaining<Partial<TrademarkAssetHttpError>>({
        status: 409,
        code: 'RUN_MISMATCH',
        retryable: false
      })
    );
  });
});
