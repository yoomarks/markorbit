import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createTrademarkAssetMigrationRoutes } from '../src/trademark-asset-migration-http.js';
import {
  TrademarkAssetMigrationInterruptedError,
  TrademarkAssetMigrationOrchestrationError
} from '../src/trademark-asset-migration.js';
import { TrademarkAssetMigrationRunPersistenceError } from '../src/trademark-asset-migration-postgres.js';

const secret = 'historical-migration-http-secret-0123456789';
const workspaceId = '45454545-4545-4454-8454-454545454545';
const otherWorkspaceId = '56565656-5656-4565-8565-565656565656';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_migration_owner',
  sessionId: 'session_migration_owner',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_migration_owner',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
const sourceFingerprintSha256 = 'a'.repeat(64);
const row = {
  rowKey: 'legacy-row-1',
  item: {
    identity: { jurisdiction: 'US', markText: 'ALPHA' },
    externalIdentifiers: [
      {
        kind: 'APPLICATION_NUMBER' as const,
        jurisdiction: 'US',
        value: '98123456',
        officialTruthVerifiedByLite: false as const
      }
    ],
    workspaceRelationships: [{ kind: 'MANAGED' as const, sourceAssetEditableByWorkspace: true }],
    sourceReferences: [
      {
        owner: 'WORKSPACE_USER' as const,
        kind: 'WORKSPACE_ADMISSION' as const,
        sourceId: 'legacy.csv#row:1',
        sourceVersion: 'v1',
        observedAt: '2026-09-14T00:00:00.000Z',
        freshness: 'UNKNOWN' as const
      }
    ]
  }
};
const body = {
  migrationKey: 'legacy-portfolio-2026',
  sourceFingerprintSha256,
  rows: [row]
};
const normalizedRows = [
  {
    ...row,
    item: { ...row.item, workspaceTags: [], workspaceNotes: [] }
  }
];
const preview = {
  schemaVersion: 1 as const,
  workspaceId,
  migrationKey: body.migrationKey,
  sourceFingerprintSha256,
  fingerprint: 'b'.repeat(64),
  total: 1,
  chunkCount: 1,
  chunks: [{ chunkIndex: 0, startIndex: 0, endExclusive: 1, rowKeys: [row.rowKey] }],
  rows: [{ rowKey: row.rowKey, importIndex: 0 }],
  officialTruthVerifiedByLite: false as const,
  matterCreatedAutomatically: false as const
};
const progress = {
  ...preview,
  status: 'PREVIEWED' as const,
  nextChunkIndex: 0,
  rowKeys: [row.rowKey],
  created: 0,
  duplicates: 0,
  rejected: 0,
  items: [],
  updatedAt: '2026-09-14T00:01:00.000Z'
};
const completed = {
  ...preview,
  created: 1,
  duplicates: 0,
  rejected: 0,
  items: [
    {
      rowKey: row.rowKey,
      importIndex: 0,
      status: 'CREATED' as const,
      trademarkAssetId: 'trademark-asset_1' as const
    }
  ]
};
type Method = JsonRequest['method'];

function setup() {
  const service = {
    preview: vi.fn().mockResolvedValue(preview),
    progress: vi.fn().mockResolvedValue(progress),
    commit: vi.fn().mockResolvedValue(completed)
  };
  const routes = createTrademarkAssetMigrationRoutes({
    internalServiceSecret: secret,
    service
  });
  const route = (method: Method, path: string) => {
    const found = routes.find(
      (candidate) => candidate.method === method && candidate.path === path
    );
    if (!found) throw new Error(`Missing ${method} ${path}`);
    return found;
  };
  return { service, routes, route };
}

function request(input: {
  method: Method;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}): JsonRequest {
  return {
    method: input.method,
    path: input.path,
    params: input.params ?? {},
    query: input.query ?? {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      ...input.headers
    },
    body: input.body
  };
}

describe('Trademark Asset historical migration HTTP owner boundary', () => {
  it('registers only preview, progress and commit routes', () => {
    const { routes } = setup();
    expect(routes.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /v1/trademark-asset-migrations/preview',
      'GET /v1/trademark-asset-migrations/:migrationKey',
      'POST /v1/trademark-asset-migrations/:migrationKey/commit'
    ]);
  });

  it('previews only inside the trusted Workspace', async () => {
    const { route, service } = setup();
    const response = await route('POST', '/v1/trademark-asset-migrations/preview').handle(
      request({ method: 'POST', path: '/v1/trademark-asset-migrations/preview', body })
    );
    expect(response).toEqual({ status: 200, body: preview });
    expect(service.preview).toHaveBeenCalledWith({
      workspaceId,
      migrationKey: body.migrationKey,
      sourceFingerprintSha256,
      rows: normalizedRows
    });
  });

  it('allows read-only preview/progress but denies commit', async () => {
    const readOnly = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    } satisfies WorkspacePrincipal;
    const { route, service } = setup();
    const headers = { 'x-markorbit-principal': encodeInternalWorkspacePrincipal(readOnly) };

    await route('POST', '/v1/trademark-asset-migrations/preview').handle(
      request({
        method: 'POST',
        path: '/v1/trademark-asset-migrations/preview',
        headers,
        body
      })
    );
    await route('GET', '/v1/trademark-asset-migrations/:migrationKey').handle(
      request({
        method: 'GET',
        path: `/v1/trademark-asset-migrations/${body.migrationKey}`,
        params: { migrationKey: body.migrationKey },
        headers
      })
    );
    await expect(
      route('POST', '/v1/trademark-asset-migrations/:migrationKey/commit').handle(
        request({
          method: 'POST',
          path: `/v1/trademark-asset-migrations/${body.migrationKey}/commit`,
          params: { migrationKey: body.migrationKey },
          headers,
          body
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(service.commit).not.toHaveBeenCalled();
  });

  it.each([
    { workspaceId: otherWorkspaceId },
    { actorPrincipalId: 'spoofed' },
    { status: 'COMPLETED' },
    { version: 99 }
  ])('rejects server-owned top-level field %j', async (extra) => {
    const { route, service } = setup();
    await expect(
      route('POST', '/v1/trademark-asset-migrations/preview').handle(
        request({
          method: 'POST',
          path: '/v1/trademark-asset-migrations/preview',
          body: { ...body, ...extra }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'OWNER_FIELD_SPOOF_REJECTED' });
    expect(service.preview).not.toHaveBeenCalled();
  });
  it.each([
    { workspaceId },
    { idempotencyKey: 'nested-spoof' },
    { actorPrincipalId: 'nested-spoof' }
  ])('rejects unsupported or server-owned migration item field %j', async (extra) => {
    const { route, service } = setup();
    await expect(
      route('POST', '/v1/trademark-asset-migrations/preview').handle(
        request({
          method: 'POST',
          path: '/v1/trademark-asset-migrations/preview',
          body: {
            ...body,
            rows: [{ ...row, item: { ...row.item, ...extra } }]
          }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'OWNER_FIELD_SPOOF_REJECTED' });
    expect(service.preview).not.toHaveBeenCalled();
  });

  it('rejects malformed nested Asset input before preview persistence', async () => {
    const { route, service } = setup();
    await expect(
      route('POST', '/v1/trademark-asset-migrations/preview').handle(
        request({
          method: 'POST',
          path: '/v1/trademark-asset-migrations/preview',
          body: {
            ...body,
            rows: [{ ...row, item: { ...row.item, identity: 'not-an-object' } }]
          }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_INPUT' });
    expect(service.preview).not.toHaveBeenCalled();
  });

  it('reads progress in the trusted Workspace and keeps absence distinct', async () => {
    const { route, service } = setup();
    const progressRoute = route('GET', '/v1/trademark-asset-migrations/:migrationKey');
    expect(
      await progressRoute.handle(
        request({
          method: 'GET',
          path: `/v1/trademark-asset-migrations/${body.migrationKey}`,
          params: { migrationKey: body.migrationKey }
        })
      )
    ).toEqual({ status: 200, body: progress });
    expect(service.progress).toHaveBeenCalledWith(workspaceId, body.migrationKey);
    service.progress.mockResolvedValueOnce(undefined);
    await expect(
      progressRoute.handle(
        request({
          method: 'GET',
          path: '/v1/trademark-asset-migrations/missing',
          params: { migrationKey: 'missing' }
        })
      )
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('commits only the exact reviewed path/input key', async () => {
    const { route, service } = setup();
    const commitRoute = route('POST', '/v1/trademark-asset-migrations/:migrationKey/commit');
    expect(
      await commitRoute.handle(
        request({
          method: 'POST',
          path: `/v1/trademark-asset-migrations/${body.migrationKey}/commit`,
          params: { migrationKey: body.migrationKey },
          body
        })
      )
    ).toEqual({ status: 200, body: completed });
    expect(service.commit).toHaveBeenCalledWith({
      workspaceId,
      migrationKey: body.migrationKey,
      sourceFingerprintSha256,
      rows: normalizedRows
    });

    await expect(
      commitRoute.handle(
        request({
          method: 'POST',
          path: '/v1/trademark-asset-migrations/other/commit',
          params: { migrationKey: 'other' },
          body
        })
      )
    ).rejects.toMatchObject({ status: 409, code: 'MIGRATION_KEY_MISMATCH' });
  });

  it.each([
    ['x-markorbit-internal-authorization', 'wrong', 401, 'UNTRUSTED_INTERNAL_CALLER'],
    ['x-markorbit-principal', 'invalid', 401, 'INVALID_INTERNAL_PRINCIPAL'],
    ['x-markorbit-workspace-id', otherWorkspaceId, 404, 'WORKSPACE_MISMATCH']
  ] as const)('rejects invalid trusted header %s', async (header, value, status, code) => {
    const { route, service } = setup();
    await expect(
      route('POST', '/v1/trademark-asset-migrations/preview').handle(
        request({
          method: 'POST',
          path: '/v1/trademark-asset-migrations/preview',
          headers: { [header]: value },
          body
        })
      )
    ).rejects.toMatchObject({ status, code });
    expect(service.preview).not.toHaveBeenCalled();
  });
  it('preserves retryable persistence unavailability instead of returning absence', async () => {
    const { route, service } = setup();
    service.progress.mockRejectedValueOnce(
      new TrademarkAssetMigrationRunPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'migration store unavailable',
        503,
        true
      )
    );
    await expect(
      route('GET', '/v1/trademark-asset-migrations/:migrationKey').handle(
        request({
          method: 'GET',
          path: `/v1/trademark-asset-migrations/${body.migrationKey}`,
          params: { migrationKey: body.migrationKey }
        })
      )
    ).rejects.toMatchObject({
      status: 503,
      code: 'PERSISTENCE_UNAVAILABLE',
      retryable: true
    });
  });
  it('preserves retryable owner interruption instead of claiming commit success', async () => {
    const { route, service } = setup();
    service.commit.mockRejectedValueOnce(
      new TrademarkAssetMigrationInterruptedError(progress, true)
    );
    await expect(
      route('POST', '/v1/trademark-asset-migrations/:migrationKey/commit').handle(
        request({
          method: 'POST',
          path: `/v1/trademark-asset-migrations/${body.migrationKey}/commit`,
          params: { migrationKey: body.migrationKey },
          body
        })
      )
    ).rejects.toMatchObject({
      status: 503,
      code: 'OWNER_INTERRUPTED',
      retryable: true
    });
  });

  it.each([
    ['INVALID_INPUT', 400],
    ['PREVIEW_REQUIRED', 409],
    ['RUN_MISMATCH', 409]
  ] as const)('preserves orchestration error %s', async (code, status) => {
    const { route, service } = setup();
    service.preview.mockRejectedValueOnce(
      new TrademarkAssetMigrationOrchestrationError(code, `owner ${code}`)
    );
    await expect(
      route('POST', '/v1/trademark-asset-migrations/preview').handle(
        request({
          method: 'POST',
          path: '/v1/trademark-asset-migrations/preview',
          body
        })
      )
    ).rejects.toMatchObject({ status, code, retryable: false });
  });
});
