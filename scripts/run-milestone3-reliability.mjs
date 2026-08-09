import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const expectedHead = process.env.M3_EXPECTED_HEAD_SHA?.trim();
if (expectedHead && head !== expectedHead)
  throw new Error(`Milestone 3 reliability checkout mismatch: expected ${expectedHead}, got ${head}.`);

const common = {
  ...process.env,
  MARKREG_ORDER_POSTGRES_REQUIRED: '1',
  MARKREG_ORDER_SERVICE_POSTGRES_REQUIRED: '1',
  MARKREG_ORDER_MATTER_POSTGRES_REQUIRED: '1',
  MARKREG_ORDER_HTTP_REQUIRED: '1'
};

const groups = [
  {
    id: 'preflight',
    command: 'pnpm',
    args: ['build:order-journey-deps']
  },
  {
    id: 'topology',
    command: 'node',
    args: ['--test', 'scripts/milestone3-reliability-command.test.mjs']
  },
  {
    id: 'migration',
    command: 'pnpm',
    args: [
      '--filter', '@markorbit/markreg-service', 'exec', 'vitest', 'run', '--no-file-parallelism',
      'tests/order-postgres.test.ts', '-t', 'applies owner migration|upgrades the prior Milestone 2'
    ]
  },
  {
    id: 'restart',
    command: 'pnpm',
    args: [
      '--filter', '@markorbit/markreg-service', 'exec', 'vitest', 'run', '--no-file-parallelism',
      'tests/order-service-postgres.test.ts', 'tests/order-matter-conversion-postgres.test.ts',
      '-t', 'persists exact lifecycle|returns exact replay after restart'
    ]
  },
  {
    id: 'outage',
    command: 'pnpm',
    args: [
      'exec', 'vitest', 'run', '--no-file-parallelism',
      'scripts/milestone2-startup-outage.integration.test.ts',
      'services/markreg/tests/order-postgres.test.ts',
      'services/markreg/tests/order-matter-conversion-postgres.test.ts',
      '-t', 'OUT-MARKREG-STARTUP|maps unavailable reads|maps a database outage'
    ],
    env: { MILESTONE2_OUTAGE_REQUIRED: '1' }
  },
  {
    id: 'concurrency',
    command: 'pnpm',
    args: [
      '--filter', '@markorbit/markreg-service', 'exec', 'vitest', 'run', '--no-file-parallelism',
      'tests/order-postgres.test.ts', 'tests/order-matter-conversion-postgres.test.ts',
      '-t', 'replays identical create|serializes concurrent writers|serializes concurrent identical conversion|rejects stale Order version|rolls back the Order|rolls back newly created Matter'
    ]
  },
  {
    id: 'tenant',
    command: 'pnpm',
    args: [
      'exec', 'vitest', 'run', '--no-file-parallelism',
      'scripts/order-http.integration.test.ts',
      'services/markreg/tests/order-matter-conversion-postgres.test.ts',
      '-t', 'enforces typed auth, spoof, tenant and conflict boundaries|conceals a cross-Workspace compatibility Matter'
    ]
  },
  {
    id: 'repeatability',
    command: 'node',
    args: ['scripts/run-order-repeatability.mjs']
  },
  {
    id: 'browser',
    command: 'pnpm',
    args: ['test:order:journey:browser']
  },
  {
    id: 'evidence',
    command: 'node',
    args: ['scripts/validate-milestone3-reliability-matrix.mjs']
  }
];

const results = [];
await mkdir('.artifacts', { recursive: true });

async function persist() {
  await writeFile(
    '.artifacts/milestone-3-reliability-evidence.json',
    `${JSON.stringify({
      schemaVersion: 1,
      milestone: 3,
      workPackage: 'M3-WP-07',
      headSha: head,
      expectedHeadSha: expectedHead ?? null,
      exactHead: !expectedHead || head === expectedHead,
      orderIsNotMatter: true,
      confirmedIsNotPaid: true,
      matterCreatedIsNotFiled: true,
      results
    }, null, 2)}\n`
  );
}

for (const group of groups) {
  process.stdout.write(`\n=== M3-WP-07 ${group.id} ===\n`);
  const startedAt = new Date().toISOString();
  const run = spawnSync(group.command, group.args, {
    cwd: process.cwd(),
    env: { ...common, ...(group.env ?? {}) },
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe']
  });
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  results.push({
    id: group.id,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode: run.status ?? 1,
    passed: run.status === 0
  });
  await persist();
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status ?? 1);
}

process.stdout.write(`\nM3-WP-07 exact-head reliability PASS ${head}\n`);
