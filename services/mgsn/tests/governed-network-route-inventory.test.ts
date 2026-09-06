import { describe, expect, it } from 'vitest';
import { createMgsnGovernedNetworkHttpRoutes } from '../src/index.js';

const EXPECTED_GOVERNED_NETWORK_ROUTE_INVENTORY = [
  'POST /v1/governed-network/discovery/evaluate',
  'POST /v1/governed-network/selections',
  'POST /v1/governed-network/selections/:providerSelectionId/revoke',
  'POST /v1/governed-network/selections/:providerSelectionId/validate-current',
  'POST /v1/governed-network/handoffs',
  'POST /v1/governed-network/handoffs/:controlledHandoffId/revoke',
  'POST /v1/governed-network/handoffs/:controlledHandoffId/validate-current',
  'POST /v1/governed-network/allocations'
] as const;

describe('MGSN governed-network route inventory', () => {
  it('freezes the exact pre-modularization route surface and ordering', () => {
    const routes = createMgsnGovernedNetworkHttpRoutes({
      internalServiceSecret: 'route-inventory-test-secret'
    });
    const inventory = routes.map((route) => `${route.method} ${route.path}`);

    expect(inventory).toEqual(EXPECTED_GOVERNED_NETWORK_ROUTE_INVENTORY);
    expect(new Set(inventory).size).toBe(inventory.length);
  });
});
