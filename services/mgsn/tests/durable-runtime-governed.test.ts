import { describe, expect, it } from 'vitest';
import { createDurableMgsnServices } from '../src/durable-runtime.js';
import { GovernedAllocationService } from '../src/governed-allocation.js';
import { GovernedProviderWorkReadModelService } from '../src/provider-work-incoming-authority.js';

function inertQueryClient() {
  return {
    query: () => Promise.reject(new Error('unexpected database query in composition test'))
  };
}

describe('MGSN Epic #358 governed durable runtime composition', () => {
  it('wires governed Allocation and exact incoming Handoff authority into the durable runtime', () => {
    const query = inertQueryClient();
    const database = {
      getPool: () => query,
      transact: () => Promise.reject(new Error('unexpected transaction in composition test'))
    };

    const services = createDurableMgsnServices({
      database: database as never,
      coreUrl: 'http://core.invalid',
      executionUrl: 'http://execution.invalid',
      internalServiceSecret: 'test-secret'
    });

    expect(services.governedAllocation).toBeInstanceOf(GovernedAllocationService);
    expect(services.providerWorkRead).toBeInstanceOf(GovernedProviderWorkReadModelService);
  });
});