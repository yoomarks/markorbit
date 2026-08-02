import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sharedDatabaseCommands = {
  'test:audit-idempotency:postgres': [
    'tests/audit-postgres.test.ts',
    'tests/formal-matter-postgres.test.ts',
    'tests/document-package-postgres.test.ts'
  ],
  'test:audit-idempotency:http': [
    'scripts/audit-idempotency-http.integration.test.ts',
    'scripts/formal-matter-http.integration.test.ts',
    'scripts/document-package-http.integration.test.ts'
  ],
  'test:audit-idempotency:restart': [
    'scripts/formal-matter-http.integration.test.ts',
    'scripts/document-package-http.integration.test.ts'
  ]
};

test('combined destructive MarkReg database commands preserve file isolation and serialize suites', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const [script, selectedFiles] of Object.entries(sharedDatabaseCommands)) {
    const command = manifest.scripts?.[script];
    assert.equal(typeof command, 'string', `${script} is missing`);
    assert.match(
      command,
      /\bvitest run\s+--no-file-parallelism\b/u,
      `${script} must serialize shared-database files without disabling module isolation`
    );
    assert.doesNotMatch(command, /\bsingleThread\b|--no-isolate\b/u);
    for (const file of selectedFiles)
      assert.equal(command.split(file).length - 1, 1, `${script} must select ${file} exactly once`);
    assert.equal(
      [...command.matchAll(/(?:tests|scripts)\/[a-z-]+(?:\.integration)?\.test\.(?:ts|mjs)/gu)]
        .length,
      selectedFiles.length,
      `${script} must not silently broaden its destructive shared-database selection`
    );
  }
});
