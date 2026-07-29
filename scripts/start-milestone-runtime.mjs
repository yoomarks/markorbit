import { startMilestoneRuntime } from './milestone-runtime.mjs';

const runtime = await startMilestoneRuntime();
process.stdout.write(`Milestone runtime ready. Logs: ${runtime.logDirectory}\n`);
let stopping = false;
const stop = async (signal) => {
  if (stopping) return;
  stopping = true;
  process.stdout.write(`Milestone runtime received ${signal}; stopping children.\n`);
  await runtime.stop();
  process.exit(0);
};
process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));
await new Promise(() => {});
