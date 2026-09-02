import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'src'), { recursive: true });
await cp(resolve(root, 'index.html'), resolve(dist, 'index.html'));
for (const file of ['main.js', 'provider-work-api.js', 'provider-work-model.js', 'styles.css']) {
  await cp(resolve(root, 'src', file), resolve(dist, 'src', file));
}
