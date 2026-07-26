import { afterEach, describe, expect, it } from 'vitest';
import {
  createHealthResponse,
  createServiceRuntime,
  json,
  type ServiceRuntime
} from '../src/index.js';

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
    expect(await missing.json()).toEqual({
      code: 'NOT_FOUND',
      message: 'Route not found.',
      correlationId: 'correlation_unknown',
      retryable: false
    });
  });

  it('returns safe errors for methods, content types, malformed JSON, oversized bodies and handlers', async () => {
    const runtime = createServiceRuntime(
      { name: 'test-service', port: 0, version: '0.1.0' },
      {
        bodyLimitBytes: 16,
        routes: [
          { method: 'POST', path: '/echo', handle: ({ body }) => json(200, body) },
          {
            method: 'POST',
            path: '/failure',
            handle: () => {
              throw new Error('private implementation detail');
            }
          }
        ]
      }
    );
    active.push(runtime);
    await runtime.start();
    const url = `http://127.0.0.1:${runtime.listeningPort}`;

    const method = await fetch(`${url}/echo`);
    expect(method.status).toBe(405);
    expect(await method.json()).toMatchObject({
      code: 'METHOD_NOT_ALLOWED',
      correlationId: 'correlation_unknown',
      retryable: false
    });

    const contentType = await fetch(`${url}/echo`, { method: 'POST', body: '{}' });
    expect(contentType.status).toBe(400);
    expect(await contentType.json()).toMatchObject({ code: 'INVALID_REQUEST' });

    const malformed = await fetch(`${url}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{'
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: 'INVALID_REQUEST' });

    const oversized = await fetch(`${url}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'too large' })
    });
    expect(oversized.status).toBe(400);

    const failure = await fetch(`${url}/failure`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': 'correlation_runtime'
      },
      body: '{}'
    });
    expect(failure.status).toBe(500);
    const safe: unknown = await failure.json();
    expect(safe).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
      correlationId: 'correlation_runtime',
      retryable: false
    });
    expect(JSON.stringify(safe)).not.toContain('private implementation detail');
  });
});
