import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runner = await readFile(new URL('./run-milestone3-reliability.mjs', import.meta.url), 'utf8');
const repeatability = await readFile(
  new URL('./run-order-repeatability.mjs', import.meta.url),
  'utf8'
);
const workflow = await readFile(
  new URL('../.github/workflows/milestone-3-reliability.yml', import.meta.url),
  'utf8'
);

const ordered = [
  'preflight',
  'topology',
  'migration',
  'restart',
  'outage',
  'concurrency',
  'tenant',
  'repeatability',
  'browser',
  'evidence'
];

test('M3 reliability runner is fail-fast and preserves the required scenario order', () => {
  assert.deepEqual(
    [...runner.matchAll(/id: '([a-z-]+)'/gu)].map((match) => match[1]),
    ordered
  );
  assert.doesNotMatch(runner, /Promise\.all|continue-on-error|\|\||setTimeout|sleep/gu);
  assert.match(runner, /M3_EXPECTED_HEAD_SHA/gu);
  assert.match(runner, /git', \['rev-parse', 'HEAD'\]/gu);
});

test('all combined destructive Vitest invocations are serialized', () => {
  const invocations = [...runner.matchAll(/'vitest', 'run', '([^']+)'/gu)].map((match) => match[1]);
  assert.ok(invocations.length >= 5);
  assert.ok(invocations.every((firstArg) => firstArg === '--no-file-parallelism'));
  assert.doesNotMatch(runner, /--no-isolate|singleThread/gu);
  assert.doesNotMatch(repeatability, /--no-isolate|singleThread/gu);
  assert.equal(
    [...repeatability.matchAll(/'vitest',\s*'run',\s*'--no-file-parallelism'/gu)].length,
    4
  );
});

test('required M3 Order reliability evidence is selected explicitly', () => {
  for (const selection of [
    'tests/order-postgres.test.ts',
    'tests/order-service-postgres.test.ts',
    'tests/order-matter-conversion-postgres.test.ts',
    'scripts/order-http.integration.test.ts',
    'scripts/milestone2-startup-outage.integration.test.ts',
    'scripts/run-order-repeatability.mjs',
    'test:order:journey:browser',
    'scripts/validate-milestone3-reliability-matrix.mjs'
  ])
    assert.ok(runner.includes(selection), `runner must select ${selection}`);

  for (const requiredMode of [
    'MARKREG_ORDER_POSTGRES_REQUIRED',
    'MARKREG_ORDER_SERVICE_POSTGRES_REQUIRED',
    'MARKREG_ORDER_MATTER_POSTGRES_REQUIRED',
    'MARKREG_ORDER_HTTP_REQUIRED',
    'MILESTONE2_OUTAGE_REQUIRED'
  ])
    assert.ok(runner.includes(requiredMode), `runner must fail closed with ${requiredMode}`);
});

test('hosted workflow checks out the exact PR head and keeps owner databases explicit', () => {
  assert.match(
    workflow,
    /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/u
  );
  assert.match(
    workflow,
    /M3_EXPECTED_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/u
  );
  assert.match(workflow, /MARKREG_TEST_DATABASE_URL:/u);
  assert.match(workflow, /MILESTONE2_MARKREG_DATABASE_URL:/u);
  assert.match(workflow, /MILESTONE3_STARTUP_DATABASE_URL:/u);
  assert.doesNotMatch(workflow, /^\s+DATABASE_URL:/mu);
  assert.match(workflow, /milestone-3-reliability-evidence\.json/u);
});
