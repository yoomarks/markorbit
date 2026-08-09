import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

const groups = [
  [
    'Order repository PostgreSQL',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/order-postgres.test.ts'
    ]
  ],
  [
    'Order lifecycle PostgreSQL',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/order-service-postgres.test.ts'
    ]
  ],
  [
    'Order-to-Matter PostgreSQL',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/order-matter-conversion-postgres.test.ts'
    ]
  ],
  [
    'Authenticated Order HTTP boundary',
    [
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'scripts/order-http.integration.test.ts'
    ]
  ]
];

const env = {
  ...process.env,
  MARKREG_ORDER_POSTGRES_REQUIRED: '1',
  MARKREG_ORDER_SERVICE_POSTGRES_REQUIRED: '1',
  MARKREG_ORDER_MATTER_POSTGRES_REQUIRED: '1',
  MARKREG_ORDER_HTTP_REQUIRED: '1'
};
const results = [];

for (let cycle = 1; cycle <= 2; cycle++)
  for (const [name, args] of groups) {
    process.stdout.write(`\n=== M3 Order repeatability cycle ${cycle}: ${name} ===\n`);
    const run = spawnSync('pnpm', args, { cwd: process.cwd(), env, encoding: 'utf8' });
    process.stdout.write(run.stdout ?? '');
    process.stderr.write(run.stderr ?? '');
    if (run.error) throw run.error;
    if (run.status !== 0) process.exit(run.status ?? 1);
    const output = stripVTControlCharacters(`${run.stdout ?? ''}\n${run.stderr ?? ''}`);
    const passed = [...output.matchAll(/Tests\s+(\d+) passed/gu)].at(-1)?.[1];
    const skipped = /\bskipped\b|\bskip\b/iu.test(output.replace(/0 skipped/gu, ''));
    if (!passed) throw new Error(`No passed-test total was reported for ${name}.`);
    if (skipped) throw new Error(`Required group ${name} reported skipped tests.`);
    results.push({ cycle, name, passed: Number(passed) });
  }

for (let index = 0; index < groups.length; index++)
  if (results[index]?.passed !== results[index + groups.length]?.passed)
    throw new Error(`Repeatability total drift for ${groups[index]?.[0]}.`);

process.stdout.write(`\nM3 Order repeatability PASS ${JSON.stringify(results)}\n`);
