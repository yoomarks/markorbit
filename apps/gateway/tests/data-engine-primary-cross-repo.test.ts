import { createServer, type Server, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createRuntime } from '../src/index.js';

const crossRepoDescribe = process.env.MO_DE_G1_CROSS_REPO === '1' ? describe : describe.skip;
const workspaceId = '92929292-9292-4929-8929-929292929292';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_mo_de_009_cross_repo',
  sessionId: 'session_mo_de_009_cross_repo',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_mo_de_009_cross_repo',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};

function authenticationClient(): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not used')),
    resolve: () => Promise.reject(new Error('not used')),
    resolveWorkspace: async (token, requestedWorkspaceId) => {
      if (token !== 'token_mo_de_009_cross_repo') throw new Error('Unexpected test session token.');
      if (requestedWorkspaceId !== workspaceId) throw new Error('Unexpected test Workspace.');
      return principal;
    },
    revoke: () => Promise.resolve()
  };
}

function gatewayHeaders(requestId: string, correlationId: string) {
  return {
    cookie: 'mo_session=token_mo_de_009_cross_repo',
    'x-markorbit-workspace-id': workspaceId,
    'x-request-id': requestId,
    'x-correlation-id': correlationId
  };
}

type ContractBody = {
  contract_version?: unknown;
  security?: { auth_mode?: unknown };
  g0_contract?: { security?: { g1_target_mode?: unknown } };
};

type GatewayErrorBody = {
  code?: unknown;
  retryable?: unknown;
  details?: {
    integrationErrorCode?: unknown;
    factState?: unknown;
    coverageState?: unknown;
    retryAfterSeconds?: unknown;
  };
};

crossRepoDescribe('MO-DE-009 primary Gateway real cross-repo acceptance', () => {
  const providerUrl = process.env.MO_DE_G1_PROVIDER_URL!;
  const rateLimitProviderUrl = process.env.MO_DE_G1_PRIMARY_RATE_LIMIT_PROVIDER_URL!;
  const invalidConfigProviderUrl = process.env.MO_DE_G1_INVALID_CONFIG_PROVIDER_URL!;
  const apiKey = process.env.MO_DE_G1_API_KEY!;
  const runtime = createRuntime({
    port: 0,
    authenticationClient: authenticationClient(),
    dataEngineUrl: providerUrl,
    dataEngineApiKey: apiKey,
    dataEngineTimeoutMs: 2_000
  });
  let gatewayUrl = '';

  beforeAll(async () => {
    expect(providerUrl).toMatch(/^http:\/\/127\.0\.0\.1:/u);
    expect(rateLimitProviderUrl).toMatch(/^http:\/\/127\.0\.0\.1:/u);
    expect(invalidConfigProviderUrl).toMatch(/^http:\/\/127\.0\.0\.1:/u);
    expect(apiKey.length).toBeGreaterThanOrEqual(32);
    await runtime.start();
    gatewayUrl = `http://127.0.0.1:${runtime.listeningPort}`;
  });

  afterAll(async () => {
    await runtime.stop();
  });

  it('proves authenticated client -> primary createRuntime() -> auth-required Data Engine with tracing', async () => {
    const response = await fetch(`${gatewayUrl}/api/data-engine/contract`, {
      headers: gatewayHeaders('mo-de-009-provider-hop-1', 'mo-de-009-correlation-1')
    });
    const body = (await response.json()) as ContractBody;

    expect(response.status).toBe(200);
    expect(body.contract_version).toBe('MARKORBIT_DATA_ENGINE_INTEGRATION_V1');
    expect(body.security?.auth_mode).toBe('required');
    expect(body.g0_contract?.security?.g1_target_mode).toBe('required');
    expect(response.headers.get('x-correlation-id')).toBe('mo-de-009-correlation-1');
    expect(response.headers.get('x-data-engine-request-id')).toBe('mo-de-009-provider-hop-1');
    expect(response.headers.get('x-data-engine-contract-version')).toBe(
      'MARKORBIT_DATA_ENGINE_INTEGRATION_V1'
    );
    expect(response.headers.get('x-data-engine-source-owner')).toBe('MARKORBIT_DATA_ENGINE');
  });

  it('proves a wrong Gateway-held provider credential remains a real 401 and never becomes a factual negative', async () => {
    const wrongKeyRuntime = createRuntime({
      port: 0,
      authenticationClient: authenticationClient(),
      dataEngineUrl: providerUrl,
      dataEngineApiKey: `wrong-${'x'.repeat(40)}`,
      dataEngineTimeoutMs: 2_000
    });
    await wrongKeyRuntime.start();
    try {
      const response = await fetch(
        `http://127.0.0.1:${wrongKeyRuntime.listeningPort}/api/data-engine/contract`,
        { headers: gatewayHeaders('mo-de-009-wrong-key-1', 'mo-de-009-wrong-key-corr') }
      );
      const body = (await response.json()) as GatewayErrorBody;
      expect(response.status).toBe(401);
      expect(body.retryable).toBe(false);
      expect(body.details?.integrationErrorCode).toBe('DATA_ENGINE_AUTH_FAILED');
      expect(body.details?.factState).toBeUndefined();
    } finally {
      await wrongKeyRuntime.stop();
    }
  });

  it('proves real provider not_found remains coverage unknown through the primary Gateway', async () => {
    const response = await fetch(
      `${gatewayUrl}/api/data-engine/cn/cases/999999999999999999999999`,
      { headers: gatewayHeaders('mo-de-009-not-found-1', 'mo-de-009-not-found-corr') }
    );
    const body = (await response.json()) as GatewayErrorBody;

    expect(response.status).toBe(404);
    expect(body.retryable).toBe(false);
    expect(body.details?.integrationErrorCode).toBe('DATA_ENGINE_NOT_FOUND');
    expect(body.details?.factState).toBe('not_found');
    expect(body.details?.coverageState).toBe('unknown');
  });

  it('proves real provider backpressure is preserved as retryable 429 through the primary Gateway', async () => {
    const rateRuntime = createRuntime({
      port: 0,
      authenticationClient: authenticationClient(),
      dataEngineUrl: rateLimitProviderUrl,
      dataEngineApiKey: apiKey,
      dataEngineTimeoutMs: 2_000
    });
    await rateRuntime.start();
    try {
      const url = `http://127.0.0.1:${rateRuntime.listeningPort}/api/data-engine/contract`;
      const first = await fetch(url, {
        headers: gatewayHeaders('mo-de-009-rate-first', 'mo-de-009-rate-corr')
      });
      expect(first.status).toBe(200);

      const second = await fetch(url, {
        headers: gatewayHeaders('mo-de-009-rate-second', 'mo-de-009-rate-corr')
      });
      const body = (await second.json()) as GatewayErrorBody;
      expect(second.status).toBe(429);
      expect(body.retryable).toBe(true);
      expect(body.details?.integrationErrorCode).toBe('DATA_ENGINE_RATE_LIMITED');
      expect(typeof body.details?.retryAfterSeconds).toBe('number');
    } finally {
      await rateRuntime.stop();
    }
  });

  it('proves invalid required-mode provider configuration fails closed as service_unavailable through the primary Gateway', async () => {
    const invalidRuntime = createRuntime({
      port: 0,
      authenticationClient: authenticationClient(),
      dataEngineUrl: invalidConfigProviderUrl,
      dataEngineApiKey: apiKey,
      dataEngineTimeoutMs: 2_000
    });
    await invalidRuntime.start();
    try {
      const response = await fetch(
        `http://127.0.0.1:${invalidRuntime.listeningPort}/api/data-engine/contract`,
        { headers: gatewayHeaders('mo-de-009-invalid-config-1', 'mo-de-009-invalid-config-corr') }
      );
      const body = (await response.json()) as GatewayErrorBody;
      expect(response.status).toBe(503);
      expect(body.retryable).toBe(true);
      expect(body.details?.integrationErrorCode).toBe('DATA_ENGINE_UNAVAILABLE');
      expect(body.details?.factState).toBe('service_unavailable');
    } finally {
      await invalidRuntime.stop();
    }
  });

  it('proves timeout remains retryable service_unavailable through primary createRuntime()', async () => {
    let stalledServer: Server | undefined;
    const stalledSockets = new Set<Socket>();
    try {
      stalledServer = createServer((socket) => {
        stalledSockets.add(socket);
        socket.once('close', () => stalledSockets.delete(socket));
      });
      await new Promise<void>((resolve, reject) => {
        stalledServer!.once('error', reject);
        stalledServer!.listen(0, '127.0.0.1', resolve);
      });
      const address = stalledServer.address();
      if (!address || typeof address === 'string')
        throw new Error('Stalled transport did not bind.');

      const timeoutRuntime = createRuntime({
        port: 0,
        authenticationClient: authenticationClient(),
        dataEngineUrl: `http://127.0.0.1:${address.port}`,
        dataEngineApiKey: apiKey,
        dataEngineTimeoutMs: 25
      });
      await timeoutRuntime.start();
      try {
        const response = await fetch(
          `http://127.0.0.1:${timeoutRuntime.listeningPort}/api/data-engine/contract`,
          { headers: gatewayHeaders('mo-de-009-timeout-1', 'mo-de-009-timeout-corr') }
        );
        const body = (await response.json()) as GatewayErrorBody;
        expect(response.status).toBe(503);
        expect(body.retryable).toBe(true);
        expect(body.details?.integrationErrorCode).toBe('DATA_ENGINE_UNAVAILABLE');
        expect(body.details?.factState).toBe('service_unavailable');
      } finally {
        await timeoutRuntime.stop();
      }
    } finally {
      for (const socket of stalledSockets) socket.destroy();
      if (stalledServer)
        await new Promise<void>((resolve) => stalledServer!.close(() => resolve()));
    }
  });
});
