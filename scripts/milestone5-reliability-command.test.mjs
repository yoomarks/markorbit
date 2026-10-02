import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Milestone 5 browser journey uses its migrated durable owner databases', async () => {
  const [workflow, runner] = await Promise.all([
    readFile(new URL('../.github/workflows/milestone-5-reliability.yml', import.meta.url), 'utf8'),
    readFile(new URL('./run-milestone5-reliability.mjs', import.meta.url), 'utf8')
  ]);
  const value = (name) => workflow.match(new RegExp(`^\\s+${name}: ([^\\n]+)$`, 'mu'))?.[1];

  assert.equal(value('MO_MILESTONE_DURABLE_OWNERS'), "'1'");
  assert.equal(value('MARKREG_DATABASE_URL'), value('MARKREG_TEST_DATABASE_URL'));
  assert.equal(value('EXECUTION_DATABASE_URL'), value('EXECUTION_TEST_DATABASE_URL'));

  const browser = runner.indexOf("id: 'browser-real-runtime'");
  assert.ok(browser >= 0);
  for (const group of [
    'evidence-review-postgres',
    'lifecycle-postgres',
    'recommended-action-postgres'
  ]) {
    const migration = runner.indexOf(`id: '${group}'`);
    assert.ok(migration >= 0 && migration < browser, `${group} must migrate before browser`);
  }
});
