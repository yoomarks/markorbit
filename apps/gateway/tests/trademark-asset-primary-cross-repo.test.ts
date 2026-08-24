import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createRuntime } from '../src/index.js';

const crossRepoDescribe = process.env.MO_DE_G1_CROSS_REPO === '1' ? describe : describe.skip;
const workspaceId = '78787878-7878-4787-8787-787878787878';
const assetId = 'trademark-asset_mo-de-010-cross-repo';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_mo_de_010_cross_repo',
  sessionId: 'session_mo_de_010_cross_repo',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_mo_de_010_cross_repo',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};

function authenticationClient(): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not used')),
    resolve: () => Promise.reject(new Error('not used')),
    resolveWorkspace: (token, requestedWorkspaceId) => {
      if (token !== 'token_mo_de_010_cross_repo')
        return Promise.reject(new Error('Unexpected test session token.'));
      if (requestedWorkspaceId !== workspaceId)
        return Promise.reject(new Error('Unexpected test Workspace.'));
      return Promise.resolve(principal);
    },
    revoke: () => Promise.resolve()
  };
}

function baseDetail() {
  return {
    view: {
      schemaVersion: 1,
      trademarkAssetId: assetId,
      workspaceId,
      anchorVersion: 1,
      anchor: {
        schemaVersion: 1,
        trademarkAssetId: assetId,
        workspaceId,
        version: 1,
        identity: { jurisdiction: 'US', markText: 'MO-DE-010 ACCEPTANCE' },
        externalIdentifiers: [
          {
            kind: 'APPLICATION_NUMBER',
            jurisdiction: 'US',
            value: '98123456',
            officialTruthVerifiedByLite: false
          }
        ],
        workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
        sourceReferences: [],
        relations: [],
        workspaceTags: [],
        workspaceNotes: [],
        officialTruthVerifiedByLite: false,
        filingExecutedByLite: false,
        createdAt: '2026-08-24T01:00:00.000Z',
        updatedAt: '2026-08-24T01:00:00.000Z'
      },
      observedFacts: [],
      contextSignals: [],
      conflicts: [],
      sourceReferences: [],
      freshness: 'UNKNOWN',
      composedAt: '2026-08-24T01:00:00.000Z',
      officialTruthVerifiedByLite: false,
      legalDeadlineCertified: false,
      protectedActionAuthorized: false
    },
    attention: [],
    managementSignals: [],
    recommendations: []
  };
}

crossRepoDescribe('MO-DE-010 primary Gateway real provider product admission', () => {
  const providerUrl = process.env.MO_DE_G1_PROVIDER_URL!;
  const apiKey = process.env.MO_DE_G1_API_KEY!;
  const internalServiceSecret = 'mo-de-010-cross-repo-internal-secret-012345';
  let liteServer: Server;
  let liteUrl = '';
  let gatewayUrl = '';
  let receivedFacts: Array<Record<string, unknown>> = [];
  let runtime: ReturnType<typeof createRuntime>;
  const previousEnvironment = {
    url: process.env.DATA_ENGINE_URL,
    key: process.env.DATA_ENGINE_API_KEY,
    timeout: process.env.DATA_ENGINE_TIMEOUT_MS
  };

  beforeAll(async () => {
    expect(providerUrl).toMatch(/^http:\/\/127\.0\.0\.1:/u);
    expect(apiKey.length).toBeGreaterThanOrEqual(32);
    liteServer = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        response.setHeader('content-type', 'application/json');
        if (request.method === 'GET' && request.url === `/v1/trademark-assets/${assetId}`) {
          response.statusCode = 200;
          response.end(JSON.stringify(baseDetail()));
          return;
        }
        if (
          request.method === 'POST' &&
          request.url === `/internal/v1/workspaces/${workspaceId}/trademark-assets/${assetId}/compose`
        ) {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            facts?: Array<Record<string, unknown>>;
          };
          receivedFacts = body.facts ?? [];
          const base = baseDetail();
          response.statusCode = 200;
          response.end(
            JSON.stringify({
              ...base,
              view: {
                ...base.view,
                observedFacts: receivedFacts,
                officialTruthVerifiedByLite: false,
                legalDeadlineCertified: false,
                protectedActionAuthorized: false
              }
            })
          );
          return;
        }
        response.statusCode = 404;
        response.end(JSON.stringify({ code: 'NOT_FOUND' }));
      });
    });
    await new Promise<void>((resolve, reject) => {
      liteServer.once('error', reject);
      liteServer.listen(0, '127.0.0.1', resolve);
    });
    const address = liteServer.address();
    if (!address || typeof address === 'string') throw new Error('Lite acceptance server did not bind.');
    liteUrl = `http://127.0.0.1:${address.port}`;

    process.env.DATA_ENGINE_URL = providerUrl;
    process.env.DATA_ENGINE_API_KEY = apiKey;
    process.env.DATA_ENGINE_TIMEOUT_MS = '2000';
    runtime = createRuntime({
      port: 0,
      liteUrl,
      authenticationClient: authenticationClient(),
      internalServiceSecret,
      csrfSecret: 'mo-de-010-cross-repo-csrf-secret-0123456789',
      allowedOrigins: ['https://app.markorbit.test']
    });
    await runtime.start();
    gatewayUrl = `http://127.0.0.1:${runtime.listeningPort}`;
  });

  afterAll(async () => {
    if (runtime) await runtime.stop();
    if (liteServer) await new Promise<void>((resolve) => liteServer.close(() => resolve()));
    if (previousEnvironment.url === undefined) delete process.env.DATA_ENGINE_URL;
    else process.env.DATA_ENGINE_URL = previousEnvironment.url;
    if (previousEnvironment.key === undefined) delete process.env.DATA_ENGINE_API_KEY;
    else process.env.DATA_ENGINE_API_KEY = previousEnvironment.key;
    if (previousEnvironment.timeout === undefined) delete process.env.DATA_ENGINE_TIMEOUT_MS;
    else process.env.DATA_ENGINE_TIMEOUT_MS = previousEnvironment.timeout;
  });

  it('proves authenticated primary Gateway -> real auth-required Data Engine -> Lite fact recomposition', async () => {
    const response = await fetch(`${gatewayUrl}/api/lite/trademark-assets/${assetId}`, {
      headers: {
        cookie: 'mo_session=token_mo_de_010_cross_repo',
        'x-markorbit-workspace-id': workspaceId,
        'x-request-id': 'mo-de-010-provider-hop-1',
        'x-correlation-id': 'mo-de-010-correlation-1'
      }
    });
    const body = (await response.json()) as {
      view?: {
        observedFacts?: Array<Record<string, unknown>>;
        officialTruthVerifiedByLite?: unknown;
        legalDeadlineCertified?: unknown;
        protectedActionAuthorized?: unknown;
      };
    };

    expect(response.status).toBe(200);
    expect(receivedFacts.map((fact) => fact.kind)).toEqual([
      'APPLICATION_STATUS',
      'APPLICATION_DATE',
      'REGISTRATION_DATE',
      'RENEWAL_DATE',
      'OWNER_NAME',
      'NICE_CLASSES'
    ]);
    expect(receivedFacts.every((fact) => (fact.source as Record<string, unknown>).owner === 'DATA_ENGINE')).toBe(true);
    expect(body.view?.observedFacts).toEqual(receivedFacts);
    expect(body.view?.officialTruthVerifiedByLite).toBe(false);
    expect(body.view?.legalDeadlineCertified).toBe(false);
    expect(body.view?.protectedActionAuthorized).toBe(false);
  });
});
