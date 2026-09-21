import { afterEach, describe, expect, it } from 'vitest';
import { createServiceRuntime, json, type JsonRequest } from '../src/index.js';

const active: Array<ReturnType<typeof createServiceRuntime>> = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

describe('service runtime request body parsers', () => {
  it('keeps routes JSON-only by default', async () => {
    const runtime = createServiceRuntime(
      { name: 'service-kit-json-default-test', port: 0, version: 'test' },
      {
        routes: [
          {
            method: 'POST',
            path: '/default',
            handle: () => json(200, { ok: true })
          }
        ]
      }
    );
    active.push(runtime);
    await runtime.start();
    const response = await fetch(`http://127.0.0.1:${runtime.listeningPort}/default`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'a=1'
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'Content-Type must be application/json.'
    });
  });

  it('preserves all form pairs and raw bytes only for an opted-in route', async () => {
    let captured: JsonRequest | undefined;
    const runtime = createServiceRuntime(
      { name: 'service-kit-form-test', port: 0, version: 'test' },
      {
        routes: [
          {
            method: 'POST',
            path: '/form',
            bodyParser: 'FORM_URLENCODED',
            bodyLimitBytes: 4_096,
            handle: (request) => {
              captured = request;
              return json(200, { ok: true });
            }
          }
        ]
      }
    );
    active.push(runtime);
    await runtime.start();
    const wire = 'MessageSid=SM123&FutureField=one&FutureField=two&Body=hello%2Bworld';
    const response = await fetch(`http://127.0.0.1:${runtime.listeningPort}/form`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: wire
    });
    expect(response.status).toBe(200);
    expect(captured?.body).toEqual([
      ['MessageSid', 'SM123'],
      ['FutureField', 'one'],
      ['FutureField', 'two'],
      ['Body', 'hello+world']
    ]);
    expect(Buffer.from(captured?.rawBody ?? []).toString('utf8')).toBe(wire);
  });
});
