import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '27272727-2727-4272-8272-272727272727';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_wp05_gateway',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_wp05_gateway',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};
const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
const auth: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('issue is not expected in this test')),
  resolve: () => Promise.reject(new Error('resolve is not expected in this test')),
  resolveWorkspace,
  revoke: () => Promise.resolve()
};
const options = {
  liteUrl: 'http://lite.test',
  authenticationClient: auth,
  internalServiceSecret: 'wp05-gateway-internal-key-0123456789',
  csrfSecret: 'wp05-gateway-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};
const migrationTabularBody = {
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
const migrationReviewBody = {
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

function route(method: string, path: string) {
  const value = createGatewayProductLoopRoutes(options).find(
    (candidate) => candidate.method === method && candidate.path === path
  );
  if (!value) throw new Error(`route ${method} ${path} missing`);
  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Lite Product-loop transport boundary', () => {
  it('serves Applicant discovery with server-owned Workspace request context', async () => {
    const dataEngineFetch = vi.fn<typeof fetch>((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      expect(url).toContain('/api/v1/us/applicants/by-name?');
      expect(url).toContain('requester_workspace_id=27272727-2727-4272-8272-272727272727');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
            engine_version: 'M1.9-test',
            source_owner: 'MARKORBIT_DATA_ENGINE',
            jurisdiction: 'US',
            resource_kind: 'APPLICANT_IDENTITY_DISCOVERY',
            authority: 'DATA_ENGINE_FACT_READ_MODEL',
            legal_conclusion: false,
            fact_state: 'not_found',
            payload: null
          }),
          {
            status: 200,
            headers: {
              'x-request-id': 'applicant-read-1',
              'x-correlation-id': 'applicant-read-1',
              'x-markorbit-contract-version': 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
              'x-markorbit-source-owner': 'MARKORBIT_DATA_ENGINE'
            }
          }
        )
      );
    });
    const value = createGatewayProductLoopRoutes({
      ...options,
      dataEngineUrl: 'https://data-engine.test',
      dataEngineApiKey: 'data-engine-test-key-01234567890123456789',
      dataEngineFetchImpl: dataEngineFetch
    }).find(
      (candidate) =>
        candidate.method === 'POST' && candidate.path === '/api/data-engine/applicants/discover'
    )!;

    const response = await value.handle({
      method: 'POST',
      path: '/api/data-engine/applicants/discover',
      params: {},
      query: {},
      headers: {
        cookie: 'mo_session=session_wp05_gateway',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'x-request-id': 'applicant-read-1'
      },
      body: { jurisdiction: 'US', input: { kind: 'NAME', value: 'Orbit LLC' }, pageSize: 10 }
    });

    expect(response.status).toBe(200);
    expect(dataEngineFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects caller-supplied Applicant discovery authority context', async () => {
    const value = createGatewayProductLoopRoutes(options).find(
      (candidate) =>
        candidate.method === 'POST' && candidate.path === '/api/data-engine/applicants/discover'
    )!;
    await expect(
      value.handle({
        method: 'POST',
        path: '/api/data-engine/applicants/discover',
        params: {},
        query: {},
        headers: {
          cookie: 'mo_session=session_wp05_gateway',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret)
        },
        body: {
          jurisdiction: 'US',
          input: { kind: 'NAME', value: 'Orbit LLC' },
          requestContext: { requester_workspace_id: 'forged', request_id: 'forged' }
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
  });

  it('forwards authenticated Workspace Principal on Today reads', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/today');
      expect(init.method).toBe('GET');
      return Promise.resolve(
        new Response(
          JSON.stringify({ schemaVersion: 1, workspaceId, items: [], recentFeedback: [] }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route('GET', '/api/lite/today').handle({
      method: 'GET',
      path: '/api/lite/today',
      params: {},
      query: {},
      headers: {
        cookie: 'mo_session=token',
        'x-markorbit-workspace-id': workspaceId
      },
      body: undefined
    });
    expect(result.status).toBe(200);
    expect(resolveWorkspace).toHaveBeenCalledWith('token', workspaceId, undefined);
    const init = downstream.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
    const encodedPrincipal = headers['x-markorbit-principal'];
    expect(encodedPrincipal).toBeTruthy();
    const envelope = JSON.parse(Buffer.from(encodedPrincipal!, 'base64url').toString('utf8')) as {
      schemaVersion: 1;
      principal: WorkspacePrincipal;
    };
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      principal: { userId: principal.userId, workspaceId: principal.workspaceId }
    });
  });

  it('forwards the authenticated Daily Workspace aggregate without mutation authority', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/daily-workspace');
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            workspaceId,
            subjectUserId: principal.userId,
            generatedAt: '2026-08-24T00:00:00.000Z',
            see: { orbitItems: [] },
            create: { contentPicks: [] },
            move: { todayItems: [] },
            partial: false,
            warnings: [],
            executionAuthorized: false,
            externalPublishExecuted: false,
            officialTruthCreated: false
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('GET', '/api/lite/daily-workspace').handle({
      method: 'GET',
      path: '/api/lite/daily-workspace',
      params: {},
      query: {},
      headers: {
        cookie: 'mo_session=token',
        'x-markorbit-workspace-id': workspaceId
      },
      body: undefined
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      subjectUserId: principal.userId,
      executionAuthorized: false,
      externalPublishExecuted: false,
      officialTruthCreated: false
    });
    expect(resolveWorkspace).toHaveBeenCalledWith('token', workspaceId, undefined);
    const headers = downstream.mock.calls[0]?.[1].headers as Record<string, string>;
    const envelope = JSON.parse(
      Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
    ) as { principal: WorkspacePrincipal };
    expect(envelope.principal).toMatchObject({
      userId: principal.userId,
      workspaceId: principal.workspaceId
    });
  });

  it('forwards the composed Trading Studio state as a read-only owner request', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/trading/studio-runs/trading-studio-run_1/state');
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return Promise.resolve(
        new Response(
          JSON.stringify({
            run: { studioRunId: 'trading-studio-run_1' },
            directionSet: null,
            selection: null
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route('GET', '/api/lite/trading/studio-runs/:studioRunId/state').handle({
      method: 'GET',
      path: '/api/lite/trading/studio-runs/trading-studio-run_1/state',
      params: { studioRunId: 'trading-studio-run_1' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        'x-markorbit-workspace-id': workspaceId
      },
      body: undefined
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      run: { studioRunId: 'trading-studio-run_1' },
      directionSet: null,
      selection: null
    });
    expect(resolveWorkspace).toHaveBeenCalledWith('token', workspaceId, undefined);
  });

  it('forwards an explicit Selection through the protected mutation boundary', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(
        'http://lite.test/v1/trading/direction-sets/commercial-direction-set_1/selection'
      );
      expect(init.method).toBe('POST');
      expect(init.body).toBe(
        JSON.stringify({
          expectedDirectionSetVersion: 1,
          selectedDirectionId: 'trading-ai-derived_commercial-direction_1',
          expectedDirectionVersion: 1
        })
      );
      const headers = init.headers as Record<string, string>;
      expect(headers['idempotency-key']).toBe('select-direction-1');
      expect(headers['x-correlation-id']).toBe('correlation_selection-1');
      return Promise.resolve(
        new Response(JSON.stringify({ selection: { directionSelectionId: 'selection_1' } }), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    vi.stubGlobal('fetch', downstream);
    const body = {
      expectedDirectionSetVersion: 1,
      selectedDirectionId: 'trading-ai-derived_commercial-direction_1',
      expectedDirectionVersion: 1
    };

    const result = await route(
      'POST',
      '/api/lite/trading/direction-sets/:directionSetId/selection'
    ).handle({
      method: 'POST',
      path: '/api/lite/trading/direction-sets/commercial-direction-set_1/selection',
      params: { directionSetId: 'commercial-direction-set_1' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'x-correlation-id': 'correlation_selection-1',
        'idempotency-key': 'select-direction-1'
      },
      body
    });

    expect(result.status).toBe(201);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('forwards feedback mutation with trusted principal and never accepts client actor identity', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/publish-packages/publish-package_1/use-feedback');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal.userId).toBe(principal.userId);
      expect(headers['idempotency-key']).toBe('feedback-1');
      expect(typeof init.body).toBe('string');
      const forwardedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(forwardedBody).not.toHaveProperty('recordedByPrincipalId');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            productLoopFeedbackId: 'product-loop-feedback_1',
            workspaceId,
            version: 1,
            publishPackage: { id: 'publish-package_1', version: 1 },
            outcome: 'USER_REPORTED_PUBLISHED',
            recordedByPrincipalId: principal.userId,
            recordedAt: '2026-08-11T14:30:00.000Z',
            externalActionExecutedByMarkOrbit: false,
            externalOutcomeVerifiedByMarkOrbit: false
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route(
      'POST',
      '/api/lite/publish-packages/:publishPackageId/use-feedback'
    ).handle({
      method: 'POST',
      path: '/api/lite/publish-packages/publish-package_1/use-feedback',
      params: { publishPackageId: 'publish-package_1' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'idempotency-key': 'feedback-1'
      },
      body: {
        workspaceId,
        publishPackageVersion: 1,
        expectedPublishPackageFingerprintSha256: 'a'.repeat(64),
        outcome: 'USER_REPORTED_PUBLISHED'
      }
    });

    expect(result.status).toBe(201);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('rejects client actor spoof fields before any Lite mutation', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      route('POST', '/api/lite/prepared-actions/:preparedActionId/confirm').handle({
        method: 'POST',
        path: '/api/lite/prepared-actions/prepared-action_1/confirm',
        params: { preparedActionId: 'prepared-action_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': 'unused-for-spoof-rejection',
          'idempotency-key': 'confirm-1'
        },
        body: {
          workspaceId,
          preparedActionVersion: 1,
          confirmedByPrincipalId: 'attacker'
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });

    await expect(
      route('POST', '/api/lite/publish-packages/:publishPackageId/use-feedback').handle({
        method: 'POST',
        path: '/api/lite/publish-packages/publish-package_1/use-feedback',
        params: { publishPackageId: 'publish-package_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': 'unused-for-spoof-rejection',
          'idempotency-key': 'feedback-spoof'
        },
        body: {
          workspaceId,
          publishPackageVersion: 1,
          expectedPublishPackageFingerprintSha256: 'a'.repeat(64),
          outcome: 'USER_REPORTED_USED',
          recordedByPrincipalId: 'attacker'
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });

    await expect(
      route('POST', '/api/lite/trading/direction-sets/:directionSetId/selection').handle({
        method: 'POST',
        path: '/api/lite/trading/direction-sets/commercial-direction-set_1/selection',
        params: { directionSetId: 'commercial-direction-set_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': 'unused-for-spoof-rejection',
          'idempotency-key': 'selection-spoof'
        },
        body: {
          expectedDirectionSetVersion: 1,
          selectedDirectionId: 'trading-ai-derived_commercial-direction_1',
          expectedDirectionVersion: 1,
          selectionMethod: 'AI_SELECTED'
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
  });

  it('rejects missing mutation idempotency and cross-Workspace body context', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      route('POST', '/api/lite/today/:todayRecommendationId/prepared-actions').handle({
        method: 'POST',
        path: '/api/lite/today/today-recommendation_1/prepared-actions',
        params: { todayRecommendationId: 'today-recommendation_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId
        },
        body: {
          workspaceId: '28282828-2828-4282-8282-282828282828',
          recommendationVersion: 1
        }
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
  });
  it('forwards tabular preparation as authenticated advisory POST without idempotency', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/trademark-asset-migrations/prepare-tabular');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['idempotency-key']).toBeUndefined();
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-markorbit-principal']).toBeTruthy();
      expect(JSON.parse(init.body as string)).toEqual(migrationTabularBody);
      return Promise.resolve(
        new Response(JSON.stringify({ schemaVersion: 1, workspaceId, ready: 1, unresolved: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(
      'POST',
      '/api/lite/trademark-asset-migrations/prepare-tabular'
    ).handle({
      method: 'POST',
      path: '/api/lite/trademark-asset-migrations/prepare-tabular',
      params: {},
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret)
      },
      body: migrationTabularBody
    });
    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('forwards preview as an idempotent durable migration mutation', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/trademark-asset-migrations/preview');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['idempotency-key']).toBe(
        'migration-preview-1'
      );
      expect(JSON.parse(init.body as string)).toEqual(migrationReviewBody);
      return Promise.resolve(
        new Response(
          JSON.stringify({ schemaVersion: 1, workspaceId, migrationKey: 'legacy-tabular-2026' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route('POST', '/api/lite/trademark-asset-migrations/preview').handle({
      method: 'POST',
      path: '/api/lite/trademark-asset-migrations/preview',
      params: {},
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'idempotency-key': 'migration-preview-1'
      },
      body: migrationReviewBody
    });
    expect(result.status).toBe(200);
  });

  it('forwards migration progress as a Workspace-scoped read', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/trademark-asset-migrations/legacy-tabular-2026');
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return Promise.resolve(
        new Response(
          JSON.stringify({ workspaceId, migrationKey: 'legacy-tabular-2026', status: 'PREVIEWED' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route('GET', '/api/lite/trademark-asset-migrations/:migrationKey').handle({
      method: 'GET',
      path: '/api/lite/trademark-asset-migrations/legacy-tabular-2026',
      params: { migrationKey: 'legacy-tabular-2026' },
      query: {},
      headers: { cookie: 'mo_session=token', 'x-markorbit-workspace-id': workspaceId },
      body: undefined
    });
    expect(result.status).toBe(200);
  });

  it('forwards commit only with matter management and idempotency governance', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/trademark-asset-migrations/legacy-tabular-2026/commit');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['idempotency-key']).toBe(
        'migration-commit-1'
      );
      return Promise.resolve(
        new Response(
          JSON.stringify({ workspaceId, migrationKey: 'legacy-tabular-2026', created: 1 }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(
      'POST',
      '/api/lite/trademark-asset-migrations/:migrationKey/commit'
    ).handle({
      method: 'POST',
      path: '/api/lite/trademark-asset-migrations/legacy-tabular-2026/commit',
      params: { migrationKey: 'legacy-tabular-2026' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'idempotency-key': 'migration-commit-1'
      },
      body: migrationReviewBody
    });
    expect(result.status).toBe(200);
  });

  it('rejects migration authority spoofing before forwarding to Lite', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route('POST', '/api/lite/trademark-asset-migrations/prepare-tabular').handle({
        method: 'POST',
        path: '/api/lite/trademark-asset-migrations/prepare-tabular',
        params: {},
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret)
        },
        body: { ...migrationTabularBody, workspaceId }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires CSRF for preparation and idempotency for durable migration mutations', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      route('POST', '/api/lite/trademark-asset-migrations/prepare-tabular').handle({
        method: 'POST',
        path: '/api/lite/trademark-asset-migrations/prepare-tabular',
        params: {},
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId
        },
        body: migrationTabularBody
      })
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    await expect(
      route('POST', '/api/lite/trademark-asset-migrations/preview').handle({
        method: 'POST',
        path: '/api/lite/trademark-asset-migrations/preview',
        params: {},
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret)
        },
        body: migrationReviewBody
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });

  it('denies commit without matter:manage and preserves downstream unavailability', async () => {
    resolveWorkspace.mockResolvedValueOnce({ ...principal, permissions: ['workspace:read'] });
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      route('POST', '/api/lite/trademark-asset-migrations/:migrationKey/commit').handle({
        method: 'POST',
        path: '/api/lite/trademark-asset-migrations/legacy-tabular-2026/commit',
        params: { migrationKey: 'legacy-tabular-2026' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
          'idempotency-key': 'migration-commit-denied'
        },
        body: migrationReviewBody
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });

    resolveWorkspace.mockResolvedValueOnce(principal);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );
    await expect(
      route('POST', '/api/lite/trademark-asset-migrations/prepare-tabular').handle({
        method: 'POST',
        path: '/api/lite/trademark-asset-migrations/prepare-tabular',
        params: {},
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret)
        },
        body: migrationTabularBody
      })
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE', retryable: true });
  });
  it('forwards Trademark Asset refresh as an authenticated durable owner mutation', async () => {
    const refreshBody = {
      sourceOwnerScope: ['MANAGED_COMMUNICATION'],
      observations: [],
      admittedClaims: [
        {
          claimClass: 'COMMUNICATION_CLAIM',
          claimId: 'claim_gateway_1',
          factKind: 'STATUS_TEXT',
          value: 'Office action received',
          source: {
            owner: 'MANAGED_COMMUNICATION',
            kind: 'MANAGED_COMMUNICATION_MESSAGE',
            sourceId: 'managed-message_gateway-1',
            sourceVersion: '1',
            observedAt: '2026-09-15T10:00:00.000Z',
            freshness: 'CURRENT'
          },
          reviewedAt: '2026-09-15T10:05:00.000Z'
        }
      ]
    };
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/trademark-assets/trademark-asset_gateway-1/refresh');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(refreshBody);
      const headers = init.headers as Record<string, string>;
      expect(headers['idempotency-key']).toBe('refresh-gateway-1');
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-markorbit-principal']).toBeTruthy();
      return Promise.resolve(
        new Response(JSON.stringify({ refreshRunId: 'trademark-asset-refresh_gateway-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(
      'POST',
      '/api/lite/trademark-assets/:trademarkAssetId/refresh'
    ).handle({
      method: 'POST',
      path: '/api/lite/trademark-assets/trademark-asset_gateway-1/refresh',
      params: { trademarkAssetId: 'trademark-asset_gateway-1' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'idempotency-key': 'refresh-gateway-1'
      },
      body: refreshBody
    });
    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('rejects Trademark Asset refresh authority spoofing, missing idempotency and missing permission', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const baseRequest = {
      method: 'POST' as const,
      path: '/api/lite/trademark-assets/trademark-asset_gateway-1/refresh',
      params: { trademarkAssetId: 'trademark-asset_gateway-1' },
      query: {},
      headers: {
        cookie: 'mo_session=token',
        origin: 'https://test.markorbit.local',
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
        'idempotency-key': 'refresh-gateway-guard'
      },
      body: { sourceOwnerScope: ['WORKSPACE_USER'], observations: [] }
    };
    const refreshRoute = route('POST', '/api/lite/trademark-assets/:trademarkAssetId/refresh');
    await expect(
      refreshRoute.handle({ ...baseRequest, body: { ...baseRequest.body, workspaceId } })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    await expect(
      refreshRoute.handle({
        ...baseRequest,
        headers: Object.fromEntries(
          Object.entries(baseRequest.headers).filter(([key]) => key !== 'idempotency-key')
        )
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    resolveWorkspace.mockResolvedValueOnce({ ...principal, permissions: ['workspace:read'] });
    await expect(refreshRoute.handle(baseRequest)).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(downstream).not.toHaveBeenCalled();
  });
});
