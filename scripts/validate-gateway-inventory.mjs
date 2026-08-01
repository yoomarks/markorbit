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
  const authOwner = row.path.startsWith('/api/auth/') || row.path.endsWith('/context');
  const authenticated =
    authOwner ||
    row.path.startsWith('/api/markreg/formal-matters') ||
    row.path.startsWith('/api/markreg/document-packages');
  const expected = authOwner
    ? 'auth'
    : row.path.startsWith('/__milestone/')
      ? 'runtime'
      : row.path.startsWith('/health')
        ? 'runtime'
        : row.path.includes('/execution/')
          ? 'execution'
          : row.path.includes('/lite/')
            ? 'lite'
            : 'markreg';
  assert.equal(row.owner, expected, `${key(row)} owner mismatch`);
  assert.equal(
    row.authenticationMode,
    authenticated ? 'COOKIE_AUTHENTICATED' : 'FIXTURE_ONLY_UNAUTHENTICATED'
  );
  assert.ok(
    authenticated
      ? row.environmentScope === 'ALL_ENVIRONMENTS'
      : ['NON_PRODUCTION_MILESTONE_RUNTIME', 'MILESTONE_TEST_RUNTIME_ONLY'].includes(
          row.environmentScope
        )
  );
}
assert.equal(source.length, 67);
assert.equal(
  source.filter(
    (x) =>
      !x.path.startsWith('/health/') &&
      !x.path.startsWith('/__milestone/') &&
      !x.path.startsWith('/api/auth/') &&
      !x.path.endsWith('/context')
  ).length,
  61
);
console.log(
  'Gateway inventory PASS: 67 runtime routes; authenticated Document Package boundary included; test bootstrap excluded'
);
