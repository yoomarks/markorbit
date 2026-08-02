import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const matrix = [
  'test:milestone2:migrations',
  'test:milestone2:restart',
  'test:milestone2:outage',
  'test:milestone2:concurrency',
  'test:milestone2:tenant-isolation',
  'test:milestone2:markreg-repeatability'
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

test('aggregate preserves named reporting and first-failure shell semantics', () => {
  const aggregate = manifest.scripts['test:milestone2:reliability'];
  assert.ok(matrix.every((name) => aggregate.includes(`pnpm ${name}`)));
  assert.doesNotMatch(aggregate, /\|\||;|continue-on-error/u);
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
