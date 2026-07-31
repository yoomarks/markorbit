import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { persistenceBoundaryFailures } from './validate-persistence-boundaries.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'mo-boundaries-'));
  for (const area of [
    'apps/gateway',
    'apps/lite-web',
    'apps/markreg-web',
    'apps/operations-console',
    'services/alpha',
    'services/beta',
    'infrastructure/persistence'
  ])
    await mkdir(path.join(root, area), { recursive: true });
  await writeFile(
    path.join(root, 'infrastructure/persistence/migration-owners.json'),
    '{"alpha":"@markorbit/alpha-service"}'
  );
  return root;
}

test('rejects database imports in Gateway and Web', async () => {
  const root = await fixture();
  await writeFile(path.join(root, 'apps/gateway/index.ts'), "import { Pool } from 'pg';");
  await writeFile(path.join(root, 'apps/lite-web/index.ts'), "import '@markorbit/persistence';");
  assert.equal((await persistenceBoundaryFailures(root)).length, 2);
});

test('rejects duplicate/undeclared ownership and foreign service imports', async () => {
  const root = await fixture();
  await writeFile(
    path.join(root, 'infrastructure/persistence/migration-owners.json'),
    '{"alpha":"one","alpha":"two"}'
  );
  await mkdir(path.join(root, 'services/beta/migrations/undeclared'), { recursive: true });
  await writeFile(
    path.join(root, 'services/beta/index.ts'),
    "import 'services/alpha/migrations/alpha';"
  );
  const failures = await persistenceBoundaryFailures(root);
  assert.ok(failures.some((value) => value.includes('Duplicate')));
  assert.ok(failures.some((value) => value.includes('undeclared')));
  assert.ok(failures.some((value) => value.includes("alpha's migrations")));
});
