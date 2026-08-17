import { AuthenticationError } from '@markorbit/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createRuntime } from '../src/index.js';

const runtimes: ReturnType<typeof createRuntime>[] = [];
const authenticationUnavailable = () =>
  Promise.reject(
    new AuthenticationError(
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.'
    )
  );
const unavailableAuthenticationClient: CoreAuthenticationClient = {
  issue: authenticationUnavailable,
  resolve: authenticationUnavailable,
  resolveWorkspace: authenticationUnavailable,
  revoke: authenticationUnavailable
};

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
});

describe('Gateway Payment runtime wiring', () => {
  it('mounts /api/payments on the actual Gateway runtime and fails closed when auth is unavailable', async () => {
    const runtime = createRuntime({
      port: 0,
      authenticationClient: unavailableAuthenticationClient,
      csrfSecret: 'runtime-wire-test-secret',
      allowedOrigins: ['https://markorbit.test']
    });
    runtimes.push(runtime);
    await runtime.start();
    const response = await fetch(`http://127.0.0.1:${runtime.listeningPort}/api/payments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'mo_session=runtime-wire-token',
        'idempotency-key': 'payment-runtime-wire',
        'x-markorbit-workspace-id': 'workspace_runtime-wire'
      },
      body: JSON.stringify({ checkoutSessionId: 'checkout_runtime-wire' })
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });
  });
});
