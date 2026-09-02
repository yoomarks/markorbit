import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This owner-authored assertion file also anchors exact-head Provider Web CI after mechanical formatting.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['main.js', 'provider-work-api.js', 'provider-work-model.js']) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, 'src', file)], {
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const combined = `${await readFile(resolve(root, 'index.html'), 'utf8')}\n${await readFile(resolve(root, 'src', 'main.js'), 'utf8')}`;
const required = [
  'Provider Workspace',
  'governed MarkOrbit Gateway',
  'Official Truth',
  'read-only'
];
for (const marker of required) {
  if (!combined.includes(marker)) {
    throw new Error(`Provider Workspace product is missing required marker: ${marker}`);
  }
}

for (const marker of [
  'ProviderLogin',
  'ProviderAccount',
  'ProviderOrganization',
  'marketplace',
  'bidding'
]) {
  if (combined.includes(marker)) {
    throw new Error(`Provider Workspace must not introduce ${marker}`);
  }
}

for (const forbiddenAction of [
  'Accept work',
  'Decline work',
  'Contact client',
  'Submit filing',
  'Pay now'
]) {
  if (combined.includes(forbiddenAction)) {
    throw new Error(
      `Provider Workspace read-only slice must not add action control: ${forbiddenAction}`
    );
  }
}
