import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import test from 'node:test';
import {
  assertPortAvailable,
  milestoneConfiguration,
  milestonePorts,
  startMilestoneRuntime,
  waitForHealth
} from './milestone-runtime.mjs';

const serverScript = `const http=require('http');const port=Number(process.env.PORT);const server=http.createServer((q,r)=>{r.writeHead(200);r.end('ok')});server.listen(port,'127.0.0.1');for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));`;
async function freePort() {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
  return port;
}
async function fixtureDefinitions(count = 6, failure = {}) {
  const result = [];
  for (let index = 0; index < count; index++) {
    const port = await freePort();
    const behavior = failure.index === index ? failure.behavior : 'healthy';
    const args =
      behavior === 'exit'
        ? ['-e', `process.exit(${failure.code ?? 17})`]
        : behavior === 'timeout'
          ? ['-e', 'setInterval(()=>{},1000)']
          : ['-e', serverScript];
    result.push({
      name: `fixture-${index}`,
      port,
      health: `http://127.0.0.1:${port}`,
      command: process.execPath,
      args,
      env: { PORT: String(port) }
    });
  }
  return result;
}
async function allAvailable(definitions) {
  for (const { port } of definitions) await assertPortAvailable(port);
}

test('occupied port fails before any child starts', async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await assert.rejects(
    startMilestoneRuntime({
      definitions: [
        {
          name: 'occupied',
          port,
          health: `http://127.0.0.1:${port}`,
          command: process.execPath,
          args: ['-e', serverScript],
          env: { PORT: String(port) }
        }
      ]
    }),
    /occupied/
  );
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
});
test('waitForHealth reports runtime name and exit code', async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(17)']);
  await assert.rejects(
    waitForHealth('fixture-downstream', 'http://127.0.0.1:1', child, 2000),
    /fixture-downstream exited.*17/
  );
});
test('middle service failure cleans every registered child', async () => {
  const definitions = await fixtureDefinitions(6, { index: 2, behavior: 'exit', code: 23 });
  await assert.rejects(
    startMilestoneRuntime({ definitions, timeoutMs: 2000 }),
    /fixture-2 exited.*23/
  );
  await allAvailable(definitions);
});
test('web runtime failure cleans all preceding services', async () => {
  const definitions = await fixtureDefinitions(6, { index: 5, behavior: 'exit', code: 29 });
  await assert.rejects(
    startMilestoneRuntime({ definitions, timeoutMs: 2000 }),
    /fixture-5 exited.*29/
  );
  await allAvailable(definitions);
});
test('readiness timeout leaves no occupied port', async () => {
  const definitions = await fixtureDefinitions(6, { index: 3, behavior: 'timeout' });
  await assert.rejects(
    startMilestoneRuntime({ definitions, timeoutMs: 1_000, termTimeoutMs: 500 }),
    /fixture-3 did not become healthy/
  );
  await allAvailable(definitions);
});
test('stop is idempotent and successful shutdown releases six ports', async () => {
  const definitions = await fixtureDefinitions();
  const runtime = await startMilestoneRuntime({ definitions, timeoutMs: 2000 });
  await Promise.all([runtime.stop(), runtime.stop()]);
  await allAvailable(definitions);
});
test('custom port map derives independent six-runtime URLs', async () => {
  const ports = {
    gateway: await freePort(),
    capability: await freePort(),
    execution: await freePort(),
    markreg: await freePort(),
    liteWeb: await freePort(),
    markregWeb: await freePort()
  };
  const configuration = milestoneConfiguration(ports);
  assert.equal(configuration.definitions.length, 6);
  assert.match(configuration.urls.liteWeb, new RegExp(String(ports.liteWeb)));
  const markregWeb = configuration.definitions.find(({ name }) => name === 'markreg-web');
  const liteWeb = configuration.definitions.find(({ name }) => name === 'lite-web');
  assert.equal(markregWeb?.env?.VITE_MARKORBIT_FIXTURE_ENTRY, '1');
  assert.equal(liteWeb?.env?.VITE_MARKORBIT_FIXTURE_ENTRY, '1');
  await allAvailable(configuration.definitions);
});
test('starts six real runtimes and releases every default port', { timeout: 60000 }, async () => {
  const runtime = await startMilestoneRuntime({ timeoutMs: 30000 });
  assert.equal(runtime.children.length, 6);
  for (const url of [
    runtime.urls.markreg,
    runtime.urls.execution,
    runtime.urls.gateway,
    runtime.urls.markregWeb,
    runtime.urls.liteWeb
  ])
    assert.equal(
      (
        await fetch(
          url.endsWith('05') || url.endsWith('04') || url.endsWith('00') ? `${url}/health` : url
        )
      ).status,
      200
    );
  await runtime.stop();
  for (const port of Object.values(milestonePorts)) await assertPortAvailable(port);
});
