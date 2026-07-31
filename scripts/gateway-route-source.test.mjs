import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { extractGatewayRoutes } from './gateway-route-source.mjs';

const gateway = fs.readFileSync(new URL('../apps/gateway/src/index.ts', import.meta.url), 'utf8');
const keys = (source) => new Set(extractGatewayRoutes(source).map((x) => `${x.method} ${x.path}`));

test('derives production auth registrations and excludes test-only bootstrap', () => {
  const routes = keys(gateway);
  assert.ok(routes.has('GET /api/auth/session'));
  assert.ok(routes.has('POST /api/auth/logout'));
  assert.ok(routes.has('GET /api/workspaces/:workspaceId/context'));
  assert.ok(!routes.has('POST /__test/auth/session'));
});

test('removing a source registration produces source-only inventory drift', () => {
  const withoutLogout = gateway.replace("path: '/api/auth/logout'", "path: 'api/auth/logout'");
  assert.ok(!keys(withoutLogout).has('POST /api/auth/logout'));
  assert.notDeepEqual(keys(withoutLogout), keys(gateway));
});

test('an inventory-only route cannot appear in the source-derived set', () => {
  const routes = keys(gateway);
  assert.ok(!routes.has('GET /api/auth/inventory-only'));
});
