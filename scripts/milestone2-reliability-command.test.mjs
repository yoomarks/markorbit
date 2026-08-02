import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const matrix = [
  'test:milestone2:migrations',
  'test:milestone2:restart',
  'test:milestone2:outage',
  'test:milestone2:concurrency',
  'test:milestone2:tenant-isolation'
];

test('every combined destructive Milestone 2 command serializes Vitest files', () => {
  for (const name of matrix) {
    const command = manifest.scripts[name];
    assert.equal(typeof command, 'string', `${name} is missing`);
    const invocations = command.split(/\s+&&\s+/u).filter((part) => /\bvitest run\b/u.test(part));
    assert.ok(invocations.length > 0, `${name} must expose scenario-level Vitest reporting`);
    for (const invocation of invocations) {
      assert.match(
        invocation,
        /\bvitest run\s+--no-file-parallelism\b/u,
        `${name} has an unsafe shared database invocation`
      );
      assert.doesNotMatch(invocation, /--no-isolate|singleThread/u);
    }
  }
});

test('MarkReg repeatability runner serializes every selected group and fails on skips or drift', async () => {
  const source = await readFile(
    new URL('./run-markreg-repeatability.mjs', import.meta.url),
    'utf8'
  );
  assert.equal([...source.matchAll(/'vitest',\s*'run',\s*'--no-file-parallelism'/gu)].length, 5);
  assert.match(source, /for\s*\(let cycle\s*=\s*1;\s*cycle\s*<=\s*2/u);
  assert.match(source, /reported skipped tests/u);
  assert.match(source, /Repeatability total drift/u);
  assert.doesNotMatch(source, /Promise\.all|setTimeout|sleep/u);
});

test('aggregate preserves named reporting and first-failure shell semantics', () => {
  const aggregate = manifest.scripts['test:milestone2:reliability'];
  const ordered = [
    'test:milestone2:topology',
    'test:milestone2:migrations',
    'test:milestone2:restart',
    'test:milestone2:outage',
    'test:milestone2:concurrency',
    'test:milestone2:tenant-isolation',
    'test:milestone2:markreg-repeatability',
    'test:milestone2:browser',
    'test:milestone2:evidence'
  ];
  assert.deepEqual(
    [...aggregate.matchAll(/pnpm (test:milestone2:[a-z-]+)/gu)].map((match) => match[1]),
    ordered
  );
  assert.doesNotMatch(aggregate, /\|\||;|continue-on-error/u);
});

test('scenario commands select exact executable evidence and required modes', () => {
  const expected = {
    'test:milestone2:migrations': [
      'MILESTONE2_MIGRATIONS_REQUIRED=1',
      'scripts/milestone2-migrations.integration.test.ts'
    ],
    'test:milestone2:restart': [
      'MILESTONE2_RESTART_REQUIRED=1',
      'scripts/milestone2-core-restart.integration.test.ts',
      'scripts/formal-matter-http.integration.test.ts',
      'scripts/document-package-http.integration.test.ts',
      'scripts/professional-review-http.integration.test.ts'
    ],
    'test:milestone2:outage': [
      'MILESTONE2_OUTAGE_REQUIRED=1',
      'scripts/milestone2-startup-outage.integration.test.ts'
    ],
    'test:milestone2:concurrency': [
      'IDENTITY_POSTGRES_TEST_REQUIRED=1',
      'MARKREG_POSTGRES_TEST_REQUIRED=1',
      'EXECUTION_POSTGRES_TEST_REQUIRED=1'
    ],
    'test:milestone2:tenant-isolation': [
      'AUTH_POSTGRES_TEST_REQUIRED=1',
      'MARKREG_AUDIT_HTTP_REQUIRED=1',
      'EXECUTION_POSTGRES_TEST_REQUIRED=1'
    ]
  };
  for (const [name, selections] of Object.entries(expected))
    for (const selection of selections)
      assert.ok(manifest.scripts[name].includes(selection), `${name} must select ${selection}`);
  assert.equal(
    manifest.scripts['test:milestone2:markreg-repeatability'],
    'pnpm build:audit-idempotency-deps && node scripts/run-markreg-repeatability.mjs'
  );
});

test('owner database variables are distinct throughout the matrix', () => {
  return readFile(
    new URL('../.github/workflows/milestone-2-reliability.yml', import.meta.url),
    'utf8'
  ).then((workflow) => {
    const urls = Object.fromEntries(
      ['IDENTITY', 'AUTH', 'MARKREG', 'EXECUTION'].map((owner) => [
        owner,
        workflow.match(new RegExp(`${owner}_TEST_DATABASE_URL: ([^\\n]+)`, 'u'))?.[1]
      ])
    );
    assert.equal(
      urls.IDENTITY,
      urls.AUTH,
      'identity and Session must share the Core owner database'
    );
    assert.equal(new Set([urls.IDENTITY, urls.MARKREG, urls.EXECUTION]).size, 3);
    assert.doesNotMatch(workflow, /^\s+DATABASE_URL:/mu);
  });
});
