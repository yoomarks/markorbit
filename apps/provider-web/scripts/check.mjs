import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productModules = [
  'main.js',
  'provider-work-api.js',
  'provider-work-model.js',
  'provider-work-view.js'
];
for (const file of productModules) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, 'src', file)], {
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const combined = [
  await readFile(resolve(root, 'index.html'), 'utf8'),
  await readFile(resolve(root, 'src', 'main.js'), 'utf8'),
  await readFile(resolve(root, 'src', 'provider-work-view.js'), 'utf8')
].join('\n');
for (const marker of [
  'Provider Workspace',
  'governed MarkOrbit Gateway',
  'Queue visibility is read-only context',
  'Accept allocation',
  'Decline allocation',
  'Submit Provider Return',
  'Submit Return correction',
  'Official Truth'
]) {
  if (!combined.includes(marker)) {
    throw new Error(`Provider Workspace product is missing required marker: ${marker}`);
  }
}

for (const marker of [
  'ProviderLogin',
  'ProviderAccount',
  'ProviderOrganization',
  'marketplace',
  'bidding',
  'Contact client',
  'Submit filing',
  'Pay now'
]) {
  if (combined.includes(marker)) {
    throw new Error(`Provider Workspace must not introduce ${marker}`);
  }
}
