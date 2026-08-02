import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const selectedFiles = [
  'tests/audit-postgres.test.ts',
  'tests/formal-matter-postgres.test.ts',
  'tests/document-package-postgres.test.ts'
];

test('shared MarkReg database acceptance serializes exactly the destructive PostgreSQL suites', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const command = manifest.scripts?.['test:audit-idempotency:postgres'];

  assert.equal(typeof command, 'string', 'audit PostgreSQL acceptance command is missing');
  assert.match(
    command,
    /\bvitest run\s+--no-file-parallelism\b/u,
    'shared-database files must disable Vitest file parallelism'
  );
  for (const file of selectedFiles)
    assert.equal(
      command.split(file).length - 1,
      1,
      `${file} must be selected exactly once by the combined command`
    );
  assert.equal(
    [...command.matchAll(/tests\/[a-z-]+-postgres\.test\.ts/gu)].length,
    selectedFiles.length,
    'combined command must not silently broaden its destructive shared-database selection'
  );
});
