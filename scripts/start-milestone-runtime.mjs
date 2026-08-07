import {
  milestoneAuth,
  milestoneConfiguration,
  startMilestoneRuntime
} from './milestone-runtime.mjs';

let runtime;
let stopPromise;
async function stop(signal, exitCode = 0) {
  if (stopPromise) return stopPromise;
  stopPromise = (async () => {
    process.stdout.write(`Milestone runtime received ${signal}; stopping children.\n`);
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
  const configuration = milestoneConfiguration();
  const authenticated = Boolean(process.env.MO_INTERNAL_SERVICE_SECRET);
  const definitions = authenticated
    ? [
        {
          name: 'auth-core',
          port: milestoneAuth.corePort,
          health: `${milestoneAuth.coreUrl}/health`,
          args: ['exec', 'tsx', 'scripts/milestone-auth-core.ts'],
          env: {
            PORT: String(milestoneAuth.corePort),
            MO_MILESTONE_WORKSPACE_ID: milestoneAuth.workspaceId,
            MO_MILESTONE_USER_ID: milestoneAuth.userId
          }
        },
        ...configuration.definitions
      ]
    : configuration.definitions;
  runtime = await startMilestoneRuntime({ detached: false, definitions });
  process.stdout.write(
    `Milestone runtime ready with ${definitions.length} runtimes${authenticated ? ' (authenticated)' : ''}. Logs: ${runtime.logDirectory}\n`
  );
  await new Promise(() => {});
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  if (error?.cleanupError)
    process.stderr.write(`Cleanup error: ${error.cleanupError.stack ?? error.cleanupError}\n`);
  await stop('STARTUP_FAILURE', 1);
}
