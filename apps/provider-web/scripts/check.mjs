import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(root, 'src', 'main.js');
const result = spawnSync(process.execPath, ['--check', entry], { stdio: 'inherit' });

if (result.status !== 0) process.exit(result.status ?? 1);

const html = await readFile(resolve(root, 'index.html'), 'utf8');
const required = ['Provider Workspace', 'governed MarkOrbit Gateway', 'Official Truth'];
for (const marker of required) {
  if (!html.includes(marker)) {
    throw new Error(`Provider Workspace shell is missing required marker: ${marker}`);
  }
}

const forbidden = [
  'ProviderLogin',
  'ProviderAccount',
  'ProviderOrganization',
  'marketplace',
  'bidding'
];
for (const marker of forbidden) {
  if (html.includes(marker)) {
    throw new Error(`Provider Workspace shell must not introduce ${marker}`);
  }
}
