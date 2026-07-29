import { startMilestoneRuntime } from './milestone-runtime.mjs';
let runtime;
let stopPromise;
async function stop(signal, exitCode = 0) {
  if (stopPromise) return stopPromise;
  stopPromise = (async () => {
    process.stdout.write(`Milestone runtime received ${signal}; stopping six children.\n`);
    try {
      await runtime?.stop();
    } catch (error) {
      process.stderr.write(
        `Milestone runtime cleanup failed: ${error instanceof Error ? error.stack : error}\n`
      );
      exitCode = 1;
    }
    process.exitCode = exitCode;
  })();
  return stopPromise;
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => void stop(signal));
try {
  runtime = await startMilestoneRuntime({ detached: false });
  process.stdout.write(
    `Milestone runtime ready with six runtimes. Logs: ${runtime.logDirectory}\n`
  );
  await new Promise(() => {});
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  if (error?.cleanupError)
    process.stderr.write(`Cleanup error: ${error.cleanupError.stack ?? error.cleanupError}\n`);
  await stop('STARTUP_FAILURE', 1);
}
