import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import test from 'node:test';
import {
  assertPortAvailable,
  milestonePorts,
  milestoneUrls,
  startMilestoneRuntime,
  waitForHealth
} from './milestone-runtime.mjs';

test('occupied ports fail clearly', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await assert.rejects(assertPortAvailable(address.port), /occupied/);
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

test('a downstream start failure is reported', async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(17)']);
  await assert.rejects(
    waitForHealth('fixture-downstream', 'http://127.0.0.1:1/health', child, 2_000),
    /exited before/
  );
});

test(
  'starts five real runtimes, exposes health and shuts down gracefully',
  { timeout: 60_000 },
  async () => {
    const runtime = await startMilestoneRuntime({ timeoutMs: 30_000 });
    assert.equal(runtime.children.length, 6);
    for (const url of [milestoneUrls.markreg, milestoneUrls.execution, milestoneUrls.gateway]) {
      const response = await fetch(`${url}/health`);
      assert.equal(response.status, 200);
    }
    for (const downstream of ['markreg', 'execution']) {
      const response = await fetch(`${milestoneUrls.gateway}/health/${downstream}`);
      assert.equal(response.status, 200);
    }
    for (const url of [milestoneUrls.markregWeb, milestoneUrls.liteWeb])
      assert.equal((await fetch(url)).status, 200);
    const markregClient = await (
      await fetch(`${milestoneUrls.markregWeb}/src/api/client.ts`)
    ).text();
    const liteClient = await (await fetch(`${milestoneUrls.liteWeb}/src/api/execution.ts`)).text();
    assert.match(markregClient, new RegExp(milestoneUrls.gateway.replaceAll('.', '\\.')));
    assert.match(liteClient, new RegExp(milestoneUrls.gateway.replaceAll('.', '\\.')));
    const allowed = await fetch(`${milestoneUrls.gateway}/api/execution/execution-releases`, {
      method: 'OPTIONS',
      headers: { origin: milestoneUrls.liteWeb }
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), milestoneUrls.liteWeb);
    const denied = await fetch(`${milestoneUrls.gateway}/api/execution/execution-releases`, {
      method: 'OPTIONS',
      headers: { origin: 'https://untrusted.example' }
    });
    assert.equal(denied.status, 403);
    await runtime.stop();
    for (const port of Object.values(milestonePorts)) await assertPortAvailable(port);
  }
);
