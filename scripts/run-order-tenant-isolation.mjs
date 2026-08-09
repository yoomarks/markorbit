import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  MARKREG_ORDER_HTTP_REQUIRED: '1',
  MARKREG_ORDER_MATTER_POSTGRES_REQUIRED: '1'
};

const groups = [
  [
    'Authenticated Order HTTP tenant boundary',
    [
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'scripts/order-http.integration.test.ts',
      '-t',
      'enforces typed auth, spoof, tenant and conflict boundaries'
    ]
  ],
  [
    'Order-to-Matter cross-Workspace concealment',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/order-matter-conversion-postgres.test.ts',
      '-t',
      'conceals a cross-Workspace compatibility Matter'
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
