import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('Provider Workspace exposes task-first governed action boundaries', async () => {
  const html = await source('index.html');
  assert.match(html, /Provider Workspace/);
  assert.match(html, /governed MarkOrbit Gateway/);
  assert.match(html, /Queue visibility is read-only context/);
  assert.match(html, /Work Queue/);
  assert.match(html, /Work item action console/);
  assert.match(html, /Official Truth authority/);
  assert.match(html, /aria-live="polite"/);
});
test('Provider actions remain governed and protected actions stay absent', async () => {
  const combined = [
    await source('index.html'),
    await source('src/main.js'),
    await source('src/provider-work-view.js')
  ].join('\n');
  for (const required of [
    'Accept allocation',
    'Decline allocation',
    'Submit Provider Return',
    'Submit Return correction',
    'markorbit-csrf-token'
  ]) {
    assert.match(combined, new RegExp(required));
  }
  for (const forbidden of [
    'ProviderLogin',
    'ProviderAccount',
    'ProviderOrganization',
    'marketplace',
    'bidding',
    'Contact client',
    'Submit filing',
    'Pay now'
  ]) {
    assert.equal(combined.includes(forbidden), false, `unexpected Provider concept: ${forbidden}`);
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
  for (const module of [
    'provider-work-api.js',
    'provider-work-model.js',
    'provider-work-view.js'
  ]) {
    const matcher = new RegExp(module.replaceAll('.', '\\.'));
    assert.match(build, matcher);
    assert.match(check, matcher);
  }
});
