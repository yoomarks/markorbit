import type { CustomerDetail } from './view-models.js';

export interface CustomerRepository {
  list(): Promise<CustomerDetail[]>;
  get(id: string): Promise<CustomerDetail | undefined>;
}

export const customerFixtures: CustomerDetail[] = [
  {
    id: 'cus-northwind',
    displayName: 'Northwind Outdoor',
    region: 'United States · US',
    status: 'Active',
    lastActivity: '24 July 2026',
    opportunityCount: 2,
    contact: 'Maya Chen · Brand counsel',
    notes:
      'Portfolio planning spans apparel and a new repair service. Confirm the responsible legal entity before any protected action.',
    activity: [
      {
        id: 'act-1',
        occurredAt: '24 July 2026 · 14:20 UTC',
        title: 'Intake reviewed',
        detail:
          'Practitioner annotated the expansion countries; no customer instruction was recorded.',
        source: 'Fixture intake INT-1042'
      },
      {
        id: 'act-2',
        occurredAt: '21 July 2026 · 09:15 UTC',
        title: 'Recommendation prepared',
        detail: 'A fixture comparison was prepared for professional review.',
        source: 'Fixture recommendation REC-88'
      }
    ],
    relatedIntakes: [{ id: 'INT-1042', title: 'Repair services expansion', status: 'Reviewing' }],
    relatedRecommendations: [
      { id: 'REC-88', title: 'US and Canada filing paths', status: 'Draft fixture' }
    ],
    relatedOpportunities: [
      { id: 'opp-repair', title: 'Repair service class coverage', status: 'REVIEWING' },
      { id: 'opp-ca', title: 'Canada portfolio gap', status: 'NEW' }
    ]
  },
  {
    id: 'cus-studio',
    displayName:
      'Studio Very Long Customer Name for International Design and Sustainable Materials Cooperative',
    region: 'European Union · EU',
    status: 'Needs review',
    lastActivity: '18 July 2026',
    opportunityCount: 1,
    contact: 'Fixture contact unavailable',
    notes:
      'Long-form fixture record used to validate wrapping. The record does not establish verified legal identity, ownership, authority, or an instruction to act.',
    activity: [],
    relatedIntakes: [],
    relatedRecommendations: [],
    relatedOpportunities: [
      {
        id: 'opp-renewal',
        title:
          'Potential renewal discussion based on a lengthy and incomplete portfolio observation',
        status: 'DEFERRED'
      }
    ]
  }
];

export const fixtureCustomerRepository: CustomerRepository = {
  list() {
    return Promise.resolve(customerFixtures);
  },
  get(id) {
    return Promise.resolve(customerFixtures.find((customer) => customer.id === id));
  }
};
