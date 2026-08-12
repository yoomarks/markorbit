import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const expectedHead = process.env.M6_EXPECTED_HEAD_SHA?.trim();
if (expectedHead && head !== expectedHead)
  throw new Error(
    `Milestone 6 reliability checkout mismatch: expected ${expectedHead}, got ${head}.`
  );

const databaseUrls = {
  registry: process.env.M6_REGISTRY_DATABASE_URL,
  ledger: process.env.M6_LEDGER_DATABASE_URL,
  candidate: process.env.M6_CANDIDATE_DATABASE_URL,
  disposition: process.env.M6_DISPOSITION_DATABASE_URL,
  browser: process.env.M6_BROWSER_DATABASE_URL
};
for (const [name, value] of Object.entries(databaseUrls))
  if (!value) throw new Error(`M6_${name.toUpperCase()}_DATABASE_URL is required.`);

const groups = [
  {
    id: 'preflight',
    command: 'pnpm',
    args: [
      'exec',
      'turbo',
      'run',
      'build',
      '--filter=@markorbit/contracts...',
      '--filter=@markorbit/core-service...',
      '--filter=@markorbit/execution-service...',
      '--filter=@markorbit/capability-engine...',
      '--filter=@markorbit/gateway...',
      '--filter=@markorbit/lite-web...'
    ]
  },
  {
    id: 'contracts-authority',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/contracts',
      'exec',
      'vitest',
      'run',
      'tests/capability-learning-contract.test.ts'
    ]
  },
  {
    id: 'topology',
    command: 'pnpm',
    args: ['validate:persistence-boundaries']
  },
  {
    id: 'runtime-registry-postgres',
    command: 'pnpm',
    args: ['--filter', '@markorbit/capability-engine', 'test:runtime-registry:postgres'],
    env: {
      CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED: '1',
      CAPABILITY_ENGINE_TEST_DATABASE_URL: databaseUrls.registry
    }
  },
  {
    id: 'governed-source-authority',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/capability-engine',
      'exec',
      'vitest',
      'run',
      'tests/capability-observation-source.test.ts'
    ]
  },
  {
    id: 'execution-source-authority',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/execution-service',
      'exec',
      'vitest',
      'run',
      'tests/capability-observation-source-http.test.ts'
    ]
  },
  {
    id: 'observation-ledger-postgres',
    command: 'pnpm',
    args: ['--filter', '@markorbit/capability-engine', 'test:observation-ledger:postgres'],
    env: {
      CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED: '1',
      CAPABILITY_ENGINE_TEST_DATABASE_URL: databaseUrls.ledger
    }
  },
  {
    id: 'reflection-candidate-postgres',
    command: 'pnpm',
    args: ['--filter', '@markorbit/capability-engine', 'test:reflection-candidates:postgres'],
    env: {
      CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED: '1',
      CAPABILITY_ENGINE_TEST_DATABASE_URL: databaseUrls.candidate
    }
  },
  {
    id: 'reflection-disposition-postgres',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/capability-engine',
      'test:reflection-disposition-profile:postgres'
    ],
    env: {
      CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED: '1',
      CAPABILITY_ENGINE_TEST_DATABASE_URL: databaseUrls.disposition
    }
  },
  {
    id: 'capability-center-owner-http',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/capability-engine',
      'exec',
      'vitest',
      'run',
      'tests/capability-center-http.test.ts'
    ]
  },
  {
    id: 'gateway-privacy-authority',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/gateway',
      'exec',
      'vitest',
      'run',
      'tests/capability-http.test.ts'
    ]
  },
  {
    id: 'lite-private-projection',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/lite-web',
      'exec',
      'vitest',
      'run',
      'src/features/capability/CapabilityCenter.test.tsx'
    ]
  },
  {
    id: 'zero-interception',
    command: 'node',
    args: ['scripts/validate-m6-capability-center-no-interception.mjs']
  },
  {
    id: 'browser-real-runtime',
    command: 'pnpm',
    args: [
      'exec',
      'playwright',
      'test',
      '--config',
      'playwright.m6-wp-06-capability-center-real-runtime.config.ts'
    ],
    env: { CAPABILITY_CENTER_TEST_DATABASE_URL: databaseUrls.browser }
  },
  {
    id: 'repeatability-disposition-profile-twin',
    command: 'pnpm',
    args: [
      '--filter',
      '@markorbit/capability-engine',
      'test:reflection-disposition-profile:postgres'
    ],
    env: {
      CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED: '1',
      CAPABILITY_ENGINE_TEST_DATABASE_URL: databaseUrls.disposition
    }
  },
  {
    id: 'evidence-inventory',
    command: 'node',
    args: ['scripts/validate-milestone6-reliability-matrix.mjs']
  }
];

const results = [];
await mkdir('.artifacts', { recursive: true });

async function persist() {
  await writeFile(
    '.artifacts/milestone-6-reliability-evidence.json',
    `${JSON.stringify(
      {
        schemaVersion: 1,
        milestone: 6,
        workPackage: 'M6-WP-07',
        headSha: head,
        expectedHeadSha: expectedHead ?? null,
        exactHead: !expectedHead || head === expectedHead,
        authority: {
          runtimeWorkEvidenceCreatesCanonVersion: false,
          observationCreatesVerifiedCapability: false,
          rawProviderReturnAdmitted: false,
          providerSupplyCapabilityAdmitted: false,
          reflectionCandidateCreatesCanonicalTruth: false,
          acceptedReflectionCreatesVerifiedCapability: false,
          profilePublishesPublicScore: false,
          profilePublishesVerifiedBadge: false,
          twinHasAutonomousIdentity: false,
          twinHasAutonomousExecutionAuthority: false,
          permissionOrRoleChanged: false,
          crossServiceSqlAllowed: false,
          paymentOrInvoiceCreated: false,
          legalAppointmentCreated: false,
          filingSubmitted: false,
          officialTruthCreated: false,
          externalActionExecuted: false
        },
        results
      },
      null,
      2
    )}\n`
  );
}

for (const group of groups) {
  process.stdout.write(`\n=== M6-WP-07 ${group.id} ===\n`);
  const startedAt = new Date().toISOString();
  const run = spawnSync(group.command, group.args, {
    cwd: process.cwd(),
    env: { ...process.env, ...group.env },
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024
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

process.stdout.write(`\nM6-WP-07 exact-head reliability PASS ${head}\n`);
