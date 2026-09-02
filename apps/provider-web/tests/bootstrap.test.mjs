import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

// prettier-ignore
test('bootstrap exposes only a neutral Provider Workspace shell', async () => {
  const html = await source('index.html');
  assert.match(html, /Provider Workspace/);
  assert.match(html, /governed MarkOrbit Gateway/);
  assert.match(
    html,
    /does not create allocation, acceptance, appointment, contact, filing, payment,\s+or Official Truth authority/
  );
});

// prettier-ignore
test(
  'bootstrap does not introduce duplicate provider identity or marketplace concepts',
  async () => {
    const combined = `${await source('index.html')}\n${await source('src/main.js')}`;
    for (const forbidden of [
      'ProviderLogin',
      'ProviderAccount',
      'ProviderOrganization',
      'marketplace',
      'bidding'
    ]) {
      assert.equal(
        combined.includes(forbidden),
        false,
        `unexpected bootstrap authority concept: ${forbidden}`
      );
    }
  }
);

// prettier-ignore
test(
  'package remains dependency-free so bootstrap requires no lockfile or shared registration change',
  async () => {
    const pkg = JSON.parse(await source('package.json'));
    assert.equal(pkg.name, '@markorbit/provider-web');
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.devDependencies, undefined);
    for (const script of ['build', 'lint', 'typecheck', 'test']) {
      assert.equal(typeof pkg.scripts[script], 'string');
    }
  }
);
