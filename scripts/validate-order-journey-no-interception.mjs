import fs from 'node:fs';
import assert from 'node:assert/strict';

const file = 'tests/e2e/order-journey-real-runtime.spec.ts';
const source = fs.readFileSync(file, 'utf8');
for (const forbidden of ['page' + '.route(', 'context' + '.route(', 'route' + '.fulfill('])
  assert.ok(!source.includes(forbidden), `${file} must not intercept requests with ${forbidden}`);
console.log('M3-WP-06 browser source PASS: no request interception or fulfillment');
