import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it, onTestFinished } from 'vitest';
import { AuthenticationError, type AuthenticatedUserPrincipal } from '@markorbit/contracts';
import {
  GovernedHumanActionReceiptClientError,
  HttpCoreAuthenticationClient,
  type GovernedHumanActionReceiptMaterializationV1,
  type GovernedHumanActionReceiptV1
} from '../src/auth.js';
import { createRuntime } from '../src/index.js';

const secret = 'm20-c7-synthetic-internal-secret-000000000000';
const correlationId = 'm20-c7-correlation';
const workspaceId = '01900000-0000-7000-8000-000000000002';
const principal: AuthenticatedUserPrincipal = {
  kind: 'AUTHENTICATED_USER',
  userId: '01900000-0000-7000-8000-000000000001',
  sessionId: '01900000-0000-7000-8000-000000000003',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const materialization: GovernedHumanActionReceiptMaterializationV1 = {
  workspaceId,
  userId: principal.userId,
  membershipId: '01900000-0000-7000-8000-000000000004',
  principalReference: 'synthetic-principal',
  kind: 'CONTROLLED_HANDOFF',
  mutationRoute: '/api/synthetic-governed-action',
  reviewedActionDigest: 'synthetic-reviewed-digest',
  idempotencyKey: 'synthetic-idempotency-key',
  authenticatedAt: '2026-10-10T15:00:00.000Z'
};
const receipt: GovernedHumanActionReceiptV1 = {
  ...materialization,
  schemaVersion: 1,
  receiptId: '01900000-0000-7000-8000-000000000005',
  receiptVersion: 1,
  authorityReference: 'synthetic-authority',
  authorityVersion: 1,
  affirmativeHumanActionEvidenceReference: 'synthetic-human-evidence',
  source: 'CORE',
  actorKind: 'HUMAN_USER',
  workspaceVersion: 1,
  userVersion: 1,
  membershipVersion: 1,
  createdAt: materialization.authenticatedAt
};

async function localCore(status: number, body: string, incomplete = false) {
  const requests: Array<{
    path: string;
    method: string;
    authorization: string;
    correlation: string;
  }> = [];
  let resolveClosed!: (aborted: boolean) => void;
  const closed = new Promise<boolean>((resolve) => {
    resolveClosed = resolve;
  });
  const server = createServer((request, response) => {
    requests.push({
      path: request.url!,
      method: request.method!,
      authorization: request.headers['x-markorbit-internal-authorization'] as string,
      correlation: request.headers['x-correlation-id'] as string
    });
    response.writeHead(status, { 'content-type': 'application/json' });
    if (!incomplete) {
      response.end(body);
      return;
    }
    response.write(body);
    // EOF bounds the failing baseline; the assertions require client abort before this watchdog.
    const watchdog = setTimeout(() => response.end(), 1_500);
    response.once('close', () => {
      clearTimeout(watchdog);
      resolveClosed(!response.writableEnded);
    });
  });
  onTestFinished(async () => {
    const stopped = once(server, 'close');
    server.close();
    server.closeAllConnections();
    await stopped;
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected local Core TCP fixture.');
  return { url: `http://127.0.0.1:${address.port}`, requests, closed };
}

function authentication(coreUrl: string) {
  return new HttpCoreAuthenticationClient(coreUrl, secret, 250);
}

async function gateway(coreUrl: string, dataEngineUrl?: string) {
  const runtime = createRuntime({
    port: 0,
    authenticationClient: authentication(coreUrl),
    csrfSecret: secret,
    allowedOrigins: ['https://m20-c7.test'],
    ...(dataEngineUrl ? { dataEngineUrl, dataEngineApiKey: secret } : {})
  });
  onTestFinished(() => runtime.stop());
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

describe('real Core authentication HTTP body failures', () => {
  it.each([200, 401])(
    'maps an incomplete %i body to authentication unavailable',
    async (status) => {
      const core = await localCore(status, '{', true);
      const result = authentication(core.url).resolve('opaque', correlationId);
      await expect(result).rejects.toBeInstanceOf(AuthenticationError);
      await expect(result).rejects.toMatchObject({ code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
      expect(await core.closed).toBe(true);
      expect(core.requests).toEqual([
        {
          path: '/internal/auth/sessions/resolve',
          method: 'POST',
          authorization: secret,
          correlation: correlationId
        }
      ]);
    }
  );

  it.each([200, 401])(
    'maps completed malformed %i JSON to authentication unavailable',
    async (status) => {
      const core = await localCore(status, '{');
      await expect(authentication(core.url).resolve('opaque')).rejects.toMatchObject({
        code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      });
    }
  );

  it.each([
    [401, 'INVALID_SESSION'],
    [403, 'MEMBERSHIP_SUSPENDED']
  ] as const)('preserves a completed %i owner decision %s', async (status, code) => {
    const core = await localCore(status, JSON.stringify({ code }));
    const result = authentication(core.url).resolveWorkspace('opaque', workspaceId);
    await expect(result).rejects.toBeInstanceOf(AuthenticationError);
    await expect(result).rejects.toMatchObject({ code });
  });

  it('preserves successful POST principals and GET Workspace reads', async () => {
    const post = await localCore(200, JSON.stringify(principal));
    expect(await authentication(post.url).resolve('opaque', correlationId)).toEqual(principal);
    const read = await localCore(200, JSON.stringify({ workspaces: [] }));
    expect(await authentication(read.url).listWorkspaces(principal.userId, correlationId)).toEqual(
      []
    );
    expect(read.requests).toEqual([
      {
        path: `/internal/onboarding/users/${principal.userId}/workspaces`,
        method: 'GET',
        authorization: secret,
        correlation: correlationId
      }
    ]);
  });

  it.each([200, 401])(
    'returns retryable Gateway 503 for an incomplete %i session body',
    async (status) => {
      const core = await localCore(status, '{', true);
      const base = await gateway(core.url);
      const response = await fetch(`${base}/api/auth/session`, {
        headers: { cookie: 'mo_session=opaque' },
        signal: AbortSignal.timeout(3_000)
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: 'AUTHENTICATION_SERVICE_UNAVAILABLE',
        retryable: true
      });
      expect(await core.closed).toBe(true);
    }
  );

  it('denies protected Applicant reads without reaching Data Engine when authentication body stalls', async () => {
    const core = await localCore(200, '{', true);
    const provider = await localCore(200, '{}');
    const base = await gateway(core.url, provider.url);
    const response = await fetch(`${base}/api/data-engine/applicants/discover`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'mo_session=opaque',
        'x-markorbit-workspace-id': workspaceId
      },
      body: JSON.stringify({
        jurisdiction: 'US',
        input: { kind: 'NAME', value: 'Synthetic Owner' },
        pageSize: 10
      }),
      signal: AbortSignal.timeout(3_000)
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE',
      retryable: true
    });
    expect(await core.closed).toBe(true);
    expect(core.requests[0]?.path).toBe('/internal/auth/workspace-principals/resolve');
    expect(provider.requests).toEqual([]);
  });
});

describe('real governed human-action receipt HTTP body failures', () => {
  it.each([200, 409])(
    'maps an incomplete %i receipt body to source unavailable',
    async (status) => {
      const core = await localCore(status, '{', true);
      const result = authentication(core.url).materializeGovernedHumanActionReceipt(
        materialization,
        correlationId
      );
      await expect(result).rejects.toBeInstanceOf(GovernedHumanActionReceiptClientError);
      await expect(result).rejects.toMatchObject({
        status: 503,
        code: 'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE'
      });
      expect(await core.closed).toBe(true);
      expect(core.requests[0]?.path).toBe('/internal/auth/governed-human-actions/receipts');
    }
  );

  it.each([200, 409])(
    'maps completed malformed %i receipt JSON to source unavailable',
    async (status) => {
      const core = await localCore(status, '{');
      await expect(
        authentication(core.url).materializeGovernedHumanActionReceipt(materialization)
      ).rejects.toMatchObject({
        status: 503,
        code: 'GOVERNED_HUMAN_ACTION_SOURCE_UNAVAILABLE'
      });
    }
  );

  it.each(['GOVERNED_HUMAN_ACTION_RECEIPT_STALE', 'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT'])(
    'preserves completed receipt conflict %s',
    async (code) => {
      const core = await localCore(409, JSON.stringify({ code }));
      await expect(
        authentication(core.url).materializeGovernedHumanActionReceipt(materialization)
      ).rejects.toMatchObject({ status: 409, code });
    }
  );

  it('preserves a complete owner receipt', async () => {
    const core = await localCore(200, JSON.stringify(receipt));
    expect(
      await authentication(core.url).materializeGovernedHumanActionReceipt(
        materialization,
        correlationId
      )
    ).toEqual(receipt);
  });
});
