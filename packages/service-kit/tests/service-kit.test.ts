import { afterEach, describe, expect, it } from 'vitest';
import { createHealthResponse, createServiceRuntime, type ServiceRuntime } from '../src/index.js';

const active: ServiceRuntime[] = [];
afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

describe('independent service runtime', () => {
  it('returns the stable health contract', () => {
    expect(createHealthResponse({ name: 'test-service', port: 0, version: '0.1.0' })).toEqual({
      status: 'ok',
      service: 'test-service',
      version: '0.1.0'
    });
  });

  it('starts and stops idempotently without leaking a listener', async () => {
    const runtime = createServiceRuntime({ name: 'test-service', port: 0, version: '0.1.0' });
    active.push(runtime);

    await runtime.start();
    await runtime.start();
    expect(runtime.isRunning).toBe(true);
    expect(runtime.listeningPort).toBeTypeOf('number');

    await runtime.stop();
    await runtime.stop();
    expect(runtime.isRunning).toBe(false);
  });

  it('serves health and returns a governed 404 response', async () => {
    const runtime = createServiceRuntime({ name: 'test-service', port: 0, version: '0.1.0' });
    active.push(runtime);
    await runtime.start();
    const port = runtime.listeningPort;
    expect(port).toBeTypeOf('number');

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      status: 'ok',
      service: 'test-service',
      version: '0.1.0'
    });

    const missing = await fetch(`http://127.0.0.1:${port}/missing`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ code: 'NOT_FOUND', message: 'Route not found.' });
  });
});
