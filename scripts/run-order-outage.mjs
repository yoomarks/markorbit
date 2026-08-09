import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  MILESTONE2_OUTAGE_REQUIRED: '1',
  MARKREG_ORDER_POSTGRES_REQUIRED: '1',
  MARKREG_ORDER_MATTER_POSTGRES_REQUIRED: '1'
};

const groups = [
  [
    'MarkReg startup outage and restoration',
    [
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'scripts/milestone2-startup-outage.integration.test.ts',
      '-t',
      'OUT-MARKREG-STARTUP'
    ]
  ],
  [
    'Order runtime outage mapping',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/order-postgres.test.ts',
      'tests/order-matter-conversion-postgres.test.ts',
      '-t',
      'maps unavailable reads|maps a database outage'
    ]
  ]
];

for (const [name, args] of groups) {
  process.stdout.write(`\n--- ${name} ---\n`);
  const run = spawnSync('pnpm', args, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe']
  });
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status ?? 1);
}
