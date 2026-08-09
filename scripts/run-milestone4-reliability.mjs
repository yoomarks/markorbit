import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const expectedHead = process.env.M4_EXPECTED_HEAD_SHA?.trim();
if (expectedHead && head !== expectedHead)
  throw new Error(
    `Milestone 4 reliability checkout mismatch: expected ${expectedHead}, got ${head}.`
  );

const common = {
  ...process.env,
  MGSN_PROVIDER_REGISTRY_POSTGRES_REQUIRED: '1',
  MGSN_SERVICE_PACKAGE_POSTGRES_REQUIRED: '1',
  MGSN_ALLOCATION_POSTGRES_REQUIRED: '1',
  MGSN_PROVIDER_RETURN_POSTGRES_REQUIRED: '1',
  EXECUTION_PROVIDER_RETURN_EVIDENCE_POSTGRES_REQUIRED: '1'
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
      'tests/provider-execution-contract.test.ts'
    ]
  },
  {
    id: 'topology',
    command: 'pnpm',
    args: ['validate:persistence-boundaries']
  },
  {
    id: 'provider-registry',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/mgsn-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/provider-registry-postgres.test.ts'
    ]
  },
  {
    id: 'eligibility',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/mgsn-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/service-package-eligibility-postgres.test.ts'
    ]
  },
  {
    id: 'allocation',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/mgsn-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/allocation-provider-acceptance-postgres.test.ts'
    ]
  },
  {
    id: 'provider-return',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/mgsn-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/provider-return-postgres.test.ts'
    ]
  },
  {
    id: 'execution-evidence',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/execution-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/provider-return-evidence-postgres.test.ts'
    ]
  },
  {
    id: 'trusted-http',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/mgsn-service',
      'exec',
      'vitest',
      'run',
      'tests/http-boundary.test.ts'
    ]
  },
  {
    id: 'gateway',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/gateway',
      'exec',
      'vitest',
      'run',
      'tests/mgsn-provider-journey.test.ts',
      'tests/mgsn-outage.test.ts'
    ]
  },
  {
    id: 'repeatability-mgsn',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/mgsn-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/allocation-provider-acceptance-postgres.test.ts',
      'tests/provider-return-postgres.test.ts'
    ]
  },
  {
    id: 'repeatability-execution',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/execution-service',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      'tests/provider-return-evidence-postgres.test.ts'
    ]
  },
  {
    id: 'evidence-inventory',
    command: 'node',
    args: ['scripts/validate-milestone4-reliability-matrix.mjs']
  }
];

const results = [];
await mkdir('.artifacts', { recursive: true });

async function persist() {
  await writeFile(
    '.artifacts/milestone-4-reliability-evidence.json',
    `${JSON.stringify(
      {
        schemaVersion: 1,
        milestone: 4,
        workPackage: 'M4-WP-08',
        headSha: head,
        expectedHeadSha: expectedHead ?? null,
        exactHead: !expectedHead || head === expectedHead,
        authority: {
          eligibilityIsNotAllocation: true,
          allocationIsNotProviderAcceptance: true,
          providerAcceptanceIsNotLegalAppointment: true,
          providerReturnIsNotOfficialTruth: true,
          evidenceHandoffIsNotFilingSubmission: true,
          paymentOrInvoiceCreated: false,
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
  process.stdout.write(`\n=== M4-WP-08 ${group.id} ===\n`);
  const startedAt = new Date().toISOString();
  const run = spawnSync(group.command, group.args, {
    cwd: process.cwd(),
    env: common,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024
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

process.stdout.write(`\nM4-WP-08 exact-head reliability PASS ${head}\n`);
