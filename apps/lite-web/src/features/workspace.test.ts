import { describe, expect, it } from 'vitest';
import { customerFixtures, fixtureCustomerRepository } from './customers/fixture-repository.js';
import {
  fixtureOpportunityRepository,
  opportunityFixtures
} from './opportunities/fixture-repository.js';

describe('Lite fixture repositories', () => {
  it('supports customer search and status/region filtering without embedding fixture data in JSX', () => {
    const result = customerFixtures.filter(
      (customer) =>
        customer.displayName.toLowerCase().includes('northwind') &&
        customer.status === 'Active' &&
        customer.region.includes('US')
    );
    expect(result.map((customer) => customer.id)).toEqual(['cus-northwind']);
  });

  it('supports opportunity status and country filtering', () => {
    const result = opportunityFixtures.filter(
      (opportunity) => opportunity.status === 'NEW' && opportunity.region.includes('CA')
    );
    expect(result.map((opportunity) => opportunity.id)).toEqual(['opp-ca']);
  });

  it('provides customer and opportunity detail through future client seams', async () => {
    await expect(fixtureCustomerRepository.get('cus-northwind')).resolves.toMatchObject({
      displayName: 'Northwind Outdoor'
    });
    await expect(fixtureOpportunityRepository.get('opp-repair')).resolves.toMatchObject({
      status: 'REVIEWING'
    });
  });

  it('uses only evidence-review statuses and never represents commercial or filing facts', () => {
    expect(opportunityFixtures.map((item) => item.status)).not.toContain('WON');
    expect(JSON.stringify(opportunityFixtures)).not.toMatch(/\b(PAID|FILED)\b/);
  });

  it('keeps suggested actions advisory and records limitations', () => {
    for (const opportunity of opportunityFixtures) {
      expect(opportunity.suggestedNextAction.length).toBeGreaterThan(20);
      expect(opportunity.evidence.limitations.length).toBeGreaterThan(0);
    }
  });
});
