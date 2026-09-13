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
    'infrastructure/persistence/migrations'
  ])
    await mkdir(path.join(root, area), { recursive: true });
  await writeFile(
    path.join(root, 'infrastructure/persistence/migration-owners.json'),
    '{"namespaces":{"alpha":"@markorbit/alpha-service","beta":"@markorbit/beta-service"},"protectedTableFamilies":{"capability_communication_":"@markorbit/capability-engine","lite_communication_link_":"@markorbit/lite-service","lite_trademark_asset":"@markorbit/lite-service","lite_work_item":"@markorbit/lite-service","lite_workspace_directory_":"@markorbit/lite-service"},"migrations":{}}'
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
    '{"namespaces":{"alpha":"one","alpha":"two"},"migrations":{}}'
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

test('rejects protected Agency truth table families under the wrong migration owner', async () => {
  for (const [prefix, expectedOwner, table] of [
    [
      'capability_communication_',
      '@markorbit/capability-engine',
      'capability_communication_shadow'
    ],
    ['lite_trademark_asset', '@markorbit/lite-service', 'lite_trademark_asset_shadow'],
    ['lite_workspace_directory_', '@markorbit/lite-service', 'lite_workspace_directory_shadow']
  ]) {
    const root = await fixture();
    await writeFile(
      path.join(root, 'infrastructure/persistence/migration-owners.json'),
      JSON.stringify({
        namespaces: { beta: '@markorbit/beta-service' },
        protectedTableFamilies: { [prefix]: expectedOwner },
        migrations: { '9999_beta_shadow': '@markorbit/beta-service' }
      })
    );
    await writeFile(
      path.join(root, 'infrastructure/persistence/migrations/9999_beta_shadow.sql'),
      `CREATE TABLE ${table} (id text PRIMARY KEY);`
    );
    const failures = await persistenceBoundaryFailures(root);
    assert.ok(
      failures.some((value) => value.includes(`may not create protected ${prefix}* table ${table}`))
    );
  }
});
