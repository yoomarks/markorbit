import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('Provider Workspace exposes read-only queue/detail product boundaries', async () => {
  const html = await source('index.html');
  assert.match(html, /Provider Workspace/);
  assert.match(html, /governed MarkOrbit Gateway/);
  assert.match(html, /Queue visibility is read-only context/);
  assert.match(html, /Official Truth authority/);
  assert.match(html, /aria-live="polite"/);
});

test('Provider Workspace does not introduce duplicate identity or protected actions', async () => {
  const combined = `${await source('index.html')}\n${await source('src/main.js')}`;
  for (const forbidden of [
    'ProviderLogin',
    'ProviderAccount',
    'ProviderOrganization',
    'marketplace',
    'bidding',
    'Accept work',
    'Decline work',
    'Contact client',
    'Submit filing',
    'Pay now'
  ]) {
    assert.equal(combined.includes(forbidden), false, `unexpected Provider Workspace concept: ${forbidden}`);
  }
});

test('package remains dependency-free and validates every product module', async () => {
  const pkg = JSON.parse(await source('package.json'));
  assert.equal(pkg.name, '@markorbit/provider-web');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
  const build = await source('scripts/build.mjs');
  const check = await source('scripts/check.mjs');
  for (const module of ['provider-work-api.js', 'provider-work-model.js']) {
    assert.match(build, new RegExp(module.replaceAll('.', '\\.')));
    assert.match(check, new RegExp(module.replaceAll('.', '\\.')));
  }
});
