import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const specPath = 'tests/e2e/m6-wp-06-capability-center-real-runtime.spec.ts';
const configPath = 'playwright.m6-wp-06-capability-center-real-runtime.config.ts';
const [spec, config] = await Promise.all([
  readFile(specPath, 'utf8'),
  readFile(configPath, 'utf8')
]);

const forbidden = [
  /\bpage\.route\s*\(/u,
  /\bcontext\.route\s*\(/u,
  /\broute\.fulfill\s*\(/u,
  /\broute\.continue\s*\(/u,
  /\broute\.fallback\s*\(/u
];
for (const pattern of forbidden)
  assert.equal(pattern.test(spec), false, `${specPath} contains request interception: ${pattern}`);

assert.match(spec, /#capability/u, 'Capability Center must be reached by its direct URL/hash.');
assert.match(spec, /page\.reload\(\)/u, 'Capability Center must prove reload recovery.');
assert.match(spec, /context\(\)\.newPage\(\)/u, 'Capability Center must prove direct-URL recovery.');
assert.match(config, /width:\s*1440/u, 'Desktop 1440px project is required.');
assert.match(config, /width:\s*390/u, 'Mobile 390px project is required.');
assert.match(
  config,
  /scripts\/m6-wp-06-capability-center-real-runtime\.ts/u,
  'Real-runtime service harness is required.'
);

process.stdout.write('M6 Capability Center zero-interception source gate PASS.\n');
