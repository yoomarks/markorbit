import fs from 'node:fs';
import assert from 'node:assert/strict';
import { extractGatewayRoutes } from './gateway-route-source.mjs';
const source = extractGatewayRoutes();
const inventory = JSON.parse(
  fs.readFileSync('docs/architecture/GATEWAY_ROUTE_INVENTORY.json', 'utf8')
).routes;
const key = (x) => `${x.method} ${x.path}`;
assert.deepEqual(
  inventory.map(key),
  source.map(key),
  'Gateway source and inventory method/path sets differ'
);
for (const row of inventory) {
  for (const field of [
    'owner',
    'namespaceClass',
    'authenticationMode',
    'environmentScope',
    'idempotencyRequirement',
    'authorityConsequenceResponse',
    'httpIntegrationTestFile'
  ])
    assert.ok(row[field], `${key(row)} lacks ${field}`);
  const expected = row.path.startsWith('/health')
    ? 'runtime'
    : row.path.includes('/execution/')
      ? 'execution'
      : row.path.includes('/lite/')
        ? 'lite'
        : 'markreg';
  assert.equal(row.owner, expected, `${key(row)} owner mismatch`);
  assert.equal(row.authenticationMode, 'FIXTURE_ONLY_UNAUTHENTICATED');
  assert.equal(row.environmentScope, 'NON_PRODUCTION_MILESTONE_RUNTIME');
}
assert.equal(source.length, 53);
assert.equal(source.filter((x) => !x.path.startsWith('/health/')).length, 51);
console.log('Gateway inventory PASS: 53 runtime routes (51 governed/compatibility + 2 health)');
