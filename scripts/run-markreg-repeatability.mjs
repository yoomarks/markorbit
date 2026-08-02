import { spawnSync } from 'node:child_process';

const groups = [
  [
    'TASK 025A PostgreSQL combined',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/audit-postgres.test.ts',
      'tests/formal-matter-postgres.test.ts',
      'tests/document-package-postgres.test.ts'
    ]
  ],
  [
    'Customer Confirmation and Matter Draft PostgreSQL',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/customer-confirmation-postgres.test.ts'
    ]
  ],
  [
    'Formal Matter PostgreSQL',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/formal-matter-postgres.test.ts'
    ]
  ],
  [
    'Document Package PostgreSQL',
    [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/document-package-postgres.test.ts'
    ]
  ],
  [
    'authenticated audit, Formal Matter, Document Package and Lite Matter HTTP',
    [
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'scripts/audit-idempotency-http.integration.test.ts',
      'scripts/formal-matter-http.integration.test.ts',
      'scripts/document-package-http.integration.test.ts'
    ]
  ]
];
const env = {
  ...process.env,
  MARKREG_POSTGRES_TEST_REQUIRED: '1',
  MARKREG_DOCUMENT_PACKAGE_POSTGRES_REQUIRED: '1',
  MARKREG_AUDIT_POSTGRES_REQUIRED: '1',
  MARKREG_AUDIT_HTTP_REQUIRED: '1'
};
const results = [];
for (let cycle = 1; cycle <= 2; cycle++)
  for (const [name, args] of groups) {
    process.stdout.write(`\n=== MarkReg repeatability cycle ${cycle}: ${name} ===\n`);
    const run = spawnSync('pnpm', args, { cwd: process.cwd(), env, encoding: 'utf8' });
    process.stdout.write(run.stdout ?? '');
    process.stderr.write(run.stderr ?? '');
    if (run.error) throw run.error;
    if (run.status !== 0) process.exit(run.status ?? 1);
    const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
    const passed = [...output.matchAll(/Tests\s+(\d+) passed/gu)].at(-1)?.[1];
    const skipped = /\bskipped\b|\bskip\b/iu.test(output.replace(/0 skipped/gu, ''));
    if (!passed) throw new Error(`No passed-test total was reported for ${name}.`);
    if (skipped) throw new Error(`Required group ${name} reported skipped tests.`);
    results.push({ cycle, name, passed: Number(passed) });
  }
for (let index = 0; index < groups.length; index++)
  if (results[index]?.passed !== results[index + groups.length]?.passed)
    throw new Error(`Repeatability total drift for ${groups[index]?.[0]}.`);
process.stdout.write(`\nMarkReg repeatability PASS ${JSON.stringify(results)}\n`);
