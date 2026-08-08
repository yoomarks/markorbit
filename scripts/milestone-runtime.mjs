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

const milestoneWorkspaceId = '55555555-5555-4555-8555-555555555555';
export const milestoneAuth = Object.freeze({
  corePort: 4301,
  coreUrl: 'http://127.0.0.1:4301',
  workspaceId: milestoneWorkspaceId,
  userId: 'user_milestone_golden',
  sessionId: '0198a2a0-0000-7000-8000-000000000001',
  sessionValue: `${milestoneWorkspaceId}.browser-session`
});

export const milestoneUrls = Object.freeze({
  gateway: `http://127.0.0.1:${milestonePorts.gateway}`,
  capability: `http://127.0.0.1:${milestonePorts.capability}`,
  execution: `http://127.0.0.1:${milestonePorts.execution}`,
  markreg: `http://127.0.0.1:${milestonePorts.markreg}`,
  liteWeb: `http://127.0.0.1:${milestonePorts.liteWeb}`,
  markregWeb: `http://127.0.0.1:${milestonePorts.markregWeb}`
});

export function milestoneConfiguration(ports = milestonePorts) {
  const urls = Object.freeze({
    gateway: `http://127.0.0.1:${ports.gateway}`,
    capability: `http://127.0.0.1:${ports.capability}`,
    execution: `http://127.0.0.1:${ports.execution}`,
    markreg: `http://127.0.0.1:${ports.markreg}`,
    liteWeb: `http://127.0.0.1:${ports.liteWeb}`,
    markregWeb: `http://127.0.0.1:${ports.markregWeb}`
  });
  const definitions = [
    {
      name: 'capability-engine',
      port: ports.capability,
      health: `${urls.capability}/health`,
      args: ['--filter', '@markorbit/capability-engine', 'dev'],
      env: { PORT: String(ports.capability) }
    },
    {
      name: 'markreg',
      port: ports.markreg,
      health: `${urls.markreg}/health`,
      args: ['--filter', '@markorbit/markreg-service', 'dev'],
      env: {
        PORT: String(ports.markreg),
        EXECUTION_URL: urls.execution,
        CAPABILITY_ENGINE_URL: urls.capability,
        MO_MILESTONE_TEST_RUNTIME: '1'
      }
    },
    {
      name: 'execution',
      port: ports.execution,
      health: `${urls.execution}/health`,
      args: ['--filter', '@markorbit/execution-service', 'dev'],
      env: {
        PORT: String(ports.execution),
        MARKREG_URL: urls.markreg,
        MO_MILESTONE_TEST_RUNTIME: '1'
      }
    },
    {
      name: 'gateway',
      port: ports.gateway,
      health: `${urls.gateway}/health`,
      args: ['--filter', '@markorbit/gateway', 'dev'],
      env: {
        PORT: String(ports.gateway),
        MARKREG_URL: urls.markreg,
        EXECUTION_URL: urls.execution,
        CORE_URL: milestoneAuth.coreUrl,
        WEB_ORIGINS: `${urls.markregWeb},${urls.liteWeb}`,
        MO_MILESTONE_TEST_RUNTIME: '1'
      }
    },
    {
      name: 'markreg-web',
      port: ports.markregWeb,
      health: urls.markregWeb,
      args: [
        '--filter',
        '@markorbit/markreg-web',
        'dev',
        '--host',
        '127.0.0.1',
        '--port',
        String(ports.markregWeb),
        '--strictPort'
      ],
      env: { VITE_MARKREG_GATEWAY_URL: urls.gateway }
    },
    {
      name: 'lite-web',
      port: ports.liteWeb,
      health: urls.liteWeb,
      args: [
        '--filter',
        '@markorbit/lite-web',
        'dev',
        '--host',
        '127.0.0.1',
        '--port',
        String(ports.liteWeb),
        '--strictPort'
      ],
      env: { VITE_LITE_GATEWAY_URL: urls.gateway }
    }
  ];
  return { ports, urls, definitions };
}

const definitions = milestoneConfiguration().definitions;

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

const delay = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      cleanup();
      resolvePromise(false);
    }, timeoutMs);
    const done = () => {
      cleanup();
      resolvePromise(true);
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off('exit', done);
      child.off('close', done);
    };
    child.once('exit', done);
    child.once('close', done);
  });
}
async function waitForPorts(ports, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  for (const port of ports) {
    while (true) {
      try {
        await assertPortAvailable(port);
        break;
      } catch (error) {
        if (Date.now() >= deadline) throw error;
        await delay(50);
      }
    }
  }
}

export async function startMilestoneRuntime(options = {}) {
  const root = options.root ?? process.cwd();
  const configuration = milestoneConfiguration(options.ports ?? milestonePorts);
  const logDirectory = resolve(root, options.logDirectory ?? '.artifacts/milestone-runtime');
  const selected = options.definitions ?? configuration.definitions;
  const selectedPorts = selected.map((value) => value.port);
  mkdirSync(logDirectory, { recursive: true });
  for (const definition of selected) await assertPortAvailable(definition.port);
  const children = [];
  let stopPromise;
  const stop = () => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      const errors = [];
      for (const entry of [...children].reverse()) {
        const { child, log } = entry;
        try {
          if (child.exitCode === null && child.signalCode === null) {
            try {
              if (entry.detached) process.kill(-child.pid, 'SIGTERM');
              else child.kill('SIGTERM');
            } catch {
              child.kill('SIGTERM');
            }
            if (!(await waitForExit(child, options.termTimeoutMs ?? 5_000))) {
              try {
                if (entry.detached) process.kill(-child.pid, 'SIGKILL');
                else child.kill('SIGKILL');
              } catch {
                child.kill('SIGKILL');
              }
              if (!(await waitForExit(child, options.killTimeoutMs ?? 2_000)))
                throw new Error(`${entry.name} did not exit after SIGKILL.`);
            }
          }
        } catch (error) {
          errors.push(error);
        } finally {
          await new Promise((resolvePromise) => log.end(resolvePromise));
        }
      }
      try {
        await waitForPorts(selectedPorts, options.portReleaseTimeoutMs);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length) throw new AggregateError(errors, 'Milestone runtime cleanup failed.');
    })();
    return stopPromise;
  };
  try {
    for (const definition of selected) {
      const log = createWriteStream(resolve(logDirectory, `${definition.name}.log`), {
        flags: 'a'
      });
      const detached = options.detached ?? true;
      const child = spawn(definition.command ?? 'pnpm', definition.args, {
        cwd: root,
        env: { ...process.env, ...definition.env },
        detached,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      const entry = { ...definition, child, log, detached };
      children.push(entry);
      child.stdout.pipe(log);
      child.stderr.pipe(log);
      await waitForHealth(definition.name, definition.health, child, options.timeoutMs);
    }
    return { children, logDirectory, ports: configuration.ports, urls: configuration.urls, stop };
  } catch (error) {
    try {
      await stop();
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
}
