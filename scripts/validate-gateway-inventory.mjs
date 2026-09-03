import fs from 'node:fs';
import assert from 'node:assert/strict';
import { extractGatewayRoutes } from './gateway-route-source.mjs';

const key = (x) => `${x.method} ${x.path}`;
const source = extractGatewayRoutes();
const baseline = JSON.parse(
  fs.readFileSync('docs/architecture/GATEWAY_ROUTE_INVENTORY.json', 'utf8')
).routes;
const m8Wp03 = JSON.parse(
  fs.readFileSync('docs/architecture/GATEWAY_ROUTE_INVENTORY_M8_WP03.json', 'utf8')
).routes;
const m8Wp04 = JSON.parse(
  fs.readFileSync('docs/architecture/GATEWAY_ROUTE_INVENTORY_M8_WP04.json', 'utf8')
).routes;
const markRegEarlyFunnel = JSON.parse(
  fs.readFileSync('docs/architecture/GATEWAY_ROUTE_INVENTORY_MARKREG_EARLY_FUNNEL.json', 'utf8')
).routes;
const promotedEarlyFunnelKeys = new Set(markRegEarlyFunnel.map(key));
const inventory = [
  ...baseline.filter((row) => !promotedEarlyFunnelKeys.has(key(row))),
  ...m8Wp03,
  ...m8Wp04,
  ...markRegEarlyFunnel
].sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));

assert.equal(
  new Set(inventory.map(key)).size,
  inventory.length,
  'Gateway inventory contains duplicates'
);
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
    row.path.startsWith('/api/payments') ||
    row.path.startsWith('/api/markreg/checkouts') ||
    row.path.startsWith('/api/markreg/commercial/') ||
    row.path.startsWith('/api/markreg/formal-matters') ||
    row.path.startsWith('/api/markreg/audit-records') ||
    row.path.startsWith('/api/markreg/document-packages') ||
    row.path.startsWith('/api/markreg/orders') ||
    row.path.startsWith('/api/markreg/production-intakes') ||
    row.path.startsWith('/api/markreg/recommended-actions') ||
    row.path.startsWith('/api/operations/') ||
    row.path.startsWith('/v1/markreg/');
  const expected = authOwner
    ? 'auth'
    : row.path.startsWith('/api/payments')
      ? 'payment'
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
assert.equal(source.length, 95);
assert.equal(inventory.length, 95);
assert.equal(
  source.filter(
    (x) =>
      !x.path.startsWith('/health/') &&
      !x.path.startsWith('/__milestone/') &&
      !x.path.startsWith('/api/auth/') &&
      !x.path.endsWith('/context')
  ).length,
  89
);
console.log(
  'Gateway inventory PASS: 95 runtime routes; authenticated Early Funnel, Production Intake, Matter Intelligence, Formal Matter Evidence, Checkout, Commercial Catalog, Payment, Order, Document Package, Evidence Review and Lifecycle boundaries included; test bootstrap excluded'
);
