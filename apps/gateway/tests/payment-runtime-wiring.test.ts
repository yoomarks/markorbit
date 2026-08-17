import { afterEach, describe, expect, it } from 'vitest';
import { createRuntime } from '../src/index.js';

const runtimes: ReturnType<typeof createRuntime>[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
});

describe('Gateway Payment runtime wiring', () => {
  it('mounts /api/payments on the actual Gateway runtime and fails closed without auth service', async () => {
    const runtime = createRuntime({
      port: 0,
      csrfSecret: 'runtime-wire-test-secret',
      allowedOrigins: ['https://markorbit.test']
    });
    runtimes.push(runtime);
    await runtime.start();
    const response = await fetch(`http://127.0.0.1:${runtime.listeningPort}/api/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutSessionId: 'checkout_runtime-wire' })
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });
  });
});
