import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const expectedHead = process.env.M5_EXPECTED_HEAD_SHA?.trim();
if (expectedHead && head !== expectedHead)
  throw new Error(
    `Milestone 5 reliability checkout mismatch: expected ${expectedHead}, got ${head}.`
  );

const common = {
  ...process.env,
  EXECUTION_EVIDENCE_REVIEW_POSTGRES_REQUIRED: '1',
  MARKREG_POSTGRES_TEST_REQUIRED: '1',
  M5_REVIEWED_SOURCE_HANDOFF_POSTGRES_REQUIRED: '1'
};

const groups = [
  {
    id: 'preflight',
    command: 'pnpm',
    args: ['build']
  },
  {
    id: 'contracts',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/contracts',
      'exec',
      'vitest',
      'run',
      'tests/evidence-lifecycle-contract.test.ts'
    ]
  },
  {
    id: 'topology',
    command: 'pnpm',
    args: ['validate:persistence-boundaries']
  },
  {
    id: 'evidence-review-postgres',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/execution-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/evidence-review-postgres.test.ts'
    ]
  },
  {
    id: 'lifecycle-postgres',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/lifecycle-projection-postgres.test.ts'
    ]
  },
  {
    id: 'recommended-action-postgres',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/recommended-action-postgres.test.ts'
    ]
  },
  {
    id: 'reviewed-source-handoff',
    command: 'pnpm',
    args: [
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'scripts/milestone5-reviewed-source-handoff.integration.test.ts'
    ]
  },
  {
    id: 'authenticated-surfaces',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/gateway',
      'exec',
      'vitest',
      'run',
      'tests/lifecycle-http.test.ts'
    ]
  },
  {
    id: 'markreg-surface',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      'tests/lifecycle-surface-http.test.ts'
    ]
  },
  {
    id: 'execution-provenance-surface',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/execution-service',
      'exec',
      'vitest',
      'run',
      'tests/evidence-provenance-http.test.ts'
    ]
  },
  {
    id: 'customer-ui',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/markreg-web',
      'exec',
      'vitest',
      'run',
      'tests/LifecyclePanel.test.tsx'
    ]
  },
  {
    id: 'browser-real-runtime',
    command: 'pnpm',
    args: ['exec', 'playwright', 'test', '--config', 'playwright.real-runtime.config.ts']
  },
  {
    id: 'repeatability-evidence-review',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/execution-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/evidence-review-postgres.test.ts'
    ]
  },
  {
    id: 'repeatability-markreg',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/markreg-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/lifecycle-projection-postgres.test.ts',
      'tests/recommended-action-postgres.test.ts'
    ]
  },
  {
    id: 'evidence-inventory',
    command: 'node',
    args: ['scripts/validate-milestone5-reliability-matrix.mjs']
  }
];

const results = [];
await mkdir('.artifacts', { recursive: true });

async function persist() {
  await writeFile(
    '.artifacts/milestone-5-reliability-evidence.json',
    `${JSON.stringify(
      {
        schemaVersion: 1,
        milestone: 5,
        workPackage: 'M5-WP-07',
        headSha: head,
        expectedHeadSha: expectedHead ?? null,
        exactHead: !expectedHead || head === expectedHead,
        authority: {
          evidenceReviewDecisionCreatesOfficialTruth: false,
          reviewAdmissionEqualsFilingSubmission: false,
          lifecycleProjectionCreatesOfficialStatus: false,
          recommendedActionAuthorizesExecution: false,
          crossServiceSqlAllowed: false,
          paymentOrInvoiceCreated: false,
          legalAppointmentCreated: false,
          formalMatterCompletedAutomatically: false,
          userCapabilityVerifiedAutomatically: false
        },
        results
      },
      null,
      2
    )}\n`
  );
}

for (const group of groups) {
  process.stdout.write(`\n=== M5-WP-07 ${group.id} ===\n`);
  const startedAt = new Date().toISOString();
  const run = spawnSync(group.command, group.args, {
    cwd: process.cwd(),
    env: common,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    maxBuffer: 24 * 1024 * 1024
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

process.stdout.write(`\nM5-WP-07 exact-head reliability PASS ${head}\n`);
