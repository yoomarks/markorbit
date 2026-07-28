import type { OpportunityDetail } from './view-models.js';

export interface OpportunityRepository {
  list(): Promise<OpportunityDetail[]>;
  get(id: string): Promise<OpportunityDetail | undefined>;
}

export const opportunityFixtures: OpportunityDetail[] = [
  {
    id: 'opp-repair',
    title: 'Repair service class coverage',
    customerId: 'cus-northwind',
    customerName: 'Northwind Outdoor',
    region: 'United States · US',
    trademark: 'NORTHWIND',
    status: 'REVIEWING',
    confidence: 'Medium',
    source: 'Fixture portfolio review',
    sourceDetail:
      'A practitioner-authored fixture note identified services not represented in the supplied portfolio snapshot.',
    suggestedNextAction:
      'Review the source with the customer and ask whether repair services are planned. Do not contact or file automatically.',
    evidence: {
      confidence: 'Medium',
      basis:
        'Customer-supplied draft service description compared with a fixture portfolio snapshot.',
      observedAt: '24 July 2026 · 14:20 UTC',
      limitations: [
        'Snapshot may be incomplete or outdated.',
        'No customer demand or instruction has been confirmed.'
      ]
    },
    relatedPreview: {
      id: 'INT-1042',
      title: 'Repair services expansion intake',
      status: 'Reviewing'
    }
  },
  {
    id: 'opp-ca',
    title: 'Canada portfolio gap',
    customerId: 'cus-northwind',
    customerName: 'Northwind Outdoor',
    region: 'Canada · CA',
    trademark: 'NORTHWIND',
    status: 'NEW',
    confidence: 'Low',
    source: 'Fixture content engagement',
    sourceDetail:
      'A sample newsletter interaction was associated with a portfolio topic; engagement is not confirmed demand.',
    suggestedNextAction:
      'Ask the relationship owner to assess relevance during the next planned conversation.',
    evidence: {
      confidence: 'Low',
      basis: 'One fixture engagement signal.',
      observedAt: '22 July 2026 · 08:00 UTC',
      limitations: [
        'Engagement does not indicate intent.',
        'Customer identity association requires review.'
      ]
    }
  },
  {
    id: 'opp-renewal',
    title:
      'Potential renewal discussion based on a lengthy and incomplete portfolio observation that must wrap without hiding its qualification',
    customerId: 'cus-studio',
    customerName:
      'Studio Very Long Customer Name for International Design and Sustainable Materials Cooperative',
    region: 'European Union · EU',
    trademark: 'MATERIAL CIRCLE',
    status: 'DEFERRED',
    confidence: 'Low',
    source: 'Fixture date observation',
    sourceDetail: 'A non-authoritative fixture record contains a possible renewal date.',
    suggestedNextAction:
      'Verify the register source and responsible legal entity before deciding whether a conversation is appropriate.',
    evidence: {
      confidence: 'Low',
      basis:
        'Unverified fixture import with a long descriptive field intended for responsive-layout validation.',
      observedAt: '18 July 2026 · 10:40 UTC',
      limitations: [
        'Not an official register result.',
        'Date and owner may be stale.',
        'No appointment or instruction exists.'
      ]
    },
    relatedPreview: {
      id: 'MAT-19',
      title: 'Historic portfolio review matter',
      status: 'Preview only'
    }
  }
];

export const fixtureOpportunityRepository: OpportunityRepository = {
  list() {
    return Promise.resolve(opportunityFixtures);
  },
  get(id) {
    return Promise.resolve(opportunityFixtures.find((opportunity) => opportunity.id === id));
  }
};
