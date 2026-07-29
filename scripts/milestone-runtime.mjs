import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

export const milestonePorts = Object.freeze({
  gateway: 4300,
  capability: 4302,
  execution: 4304,
  markreg: 4305,
  liteWeb: 4371,
  markregWeb: 4372
});

export const milestoneUrls = Object.freeze({
  gateway: `http://127.0.0.1:${milestonePorts.gateway}`,
  capability: `http://127.0.0.1:${milestonePorts.capability}`,
  execution: `http://127.0.0.1:${milestonePorts.execution}`,
  markreg: `http://127.0.0.1:${milestonePorts.markreg}`,
  liteWeb: `http://127.0.0.1:${milestonePorts.liteWeb}`,
  markregWeb: `http://127.0.0.1:${milestonePorts.markregWeb}`
});

const definitions = [
  {
    name: 'capability-engine',
    port: milestonePorts.capability,
    health: `${milestoneUrls.capability}/health`,
    args: ['--filter', '@markorbit/capability-engine', 'dev'],
    env: { PORT: String(milestonePorts.capability) }
  },
  {
    name: 'markreg',
    port: milestonePorts.markreg,
    health: `${milestoneUrls.markreg}/health`,
    args: ['--filter', '@markorbit/markreg-service', 'dev'],
    env: {
      PORT: String(milestonePorts.markreg),
      EXECUTION_URL: milestoneUrls.execution,
      CAPABILITY_ENGINE_URL: milestoneUrls.capability
    }
  },
  {
    name: 'execution',
    port: milestonePorts.execution,
    health: `${milestoneUrls.execution}/health`,
    args: ['--filter', '@markorbit/execution-service', 'dev'],
    env: { PORT: String(milestonePorts.execution), MARKREG_URL: milestoneUrls.markreg }
  },
  {
    name: 'gateway',
    port: milestonePorts.gateway,
    health: `${milestoneUrls.gateway}/health`,
    args: ['--filter', '@markorbit/gateway', 'dev'],
    env: {
      PORT: String(milestonePorts.gateway),
      MARKREG_URL: milestoneUrls.markreg,
      EXECUTION_URL: milestoneUrls.execution,
      WEB_ORIGINS: `${milestoneUrls.markregWeb},${milestoneUrls.liteWeb}`,
      MO_MILESTONE_TEST_RUNTIME: '1'
    }
  },
  {
    name: 'markreg-web',
    port: milestonePorts.markregWeb,
    health: milestoneUrls.markregWeb,
    args: [
      '--filter',
      '@markorbit/markreg-web',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(milestonePorts.markregWeb),
      '--strictPort'
    ],
    env: { VITE_MARKREG_GATEWAY_URL: milestoneUrls.gateway }
  },
  {
    name: 'lite-web',
    port: milestonePorts.liteWeb,
    health: milestoneUrls.liteWeb,
    args: [
      '--filter',
      '@markorbit/lite-web',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(milestonePorts.liteWeb),
      '--strictPort'
    ],
    env: { VITE_LITE_GATEWAY_URL: milestoneUrls.gateway }
  }
];

export async function assertPortAvailable(port) {
  await new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Milestone runtime port ${port} is occupied.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolvePromise));
  });
}

export async function waitForHealth(name, url, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `${name} exited before its health check became ready (exit ${child.exitCode}).`
      );
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* the process is still starting */
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`${name} did not become healthy at ${url} within ${timeoutMs}ms.`);
}

export async function startMilestoneRuntime(options = {}) {
  const root = options.root ?? process.cwd();
  const logDirectory = resolve(root, options.logDirectory ?? '.artifacts/milestone-runtime');
  const selected = options.definitions ?? definitions;
  mkdirSync(logDirectory, { recursive: true });
  for (const definition of selected) await assertPortAvailable(definition.port);
  const children = [];
  const stop = async () => {
    await Promise.all(
      children.map(
        ({ child }) =>
          new Promise((done) => {
            if (child.exitCode !== null) return done();
            child.once('exit', done);
            try {
              process.kill(-child.pid, 'SIGTERM');
            } catch {
              child.kill('SIGTERM');
            }
            setTimeout(() => {
              if (child.exitCode === null) {
                try {
                  process.kill(-child.pid, 'SIGKILL');
                } catch {
                  child.kill('SIGKILL');
                }
              }
            }, 5_000).unref();
          })
      )
    );
  };
  try {
    for (const definition of selected) {
      const log = createWriteStream(resolve(logDirectory, `${definition.name}.log`), {
        flags: 'a'
      });
      const child = spawn('pnpm', definition.args, {
        cwd: root,
        env: { ...process.env, ...definition.env },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.pipe(log);
      child.stderr.pipe(log);
      children.push({ ...definition, child, log });
      await waitForHealth(definition.name, definition.health, child, options.timeoutMs);
    }
    return { children, logDirectory, ports: milestonePorts, urls: milestoneUrls, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
