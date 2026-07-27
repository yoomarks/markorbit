import type { CustomerDetail } from '../customers/view-models.js';
import type { OpportunityDetail } from '../opportunities/view-models.js';

export interface LiteWorkspaceRepository {
  listCustomers(): Promise<readonly CustomerDetail[]>;
  listOpportunities(): Promise<readonly OpportunityDetail[]>;
}
export const customers: CustomerDetail[] = [
  {
    id: 'c-aurora',
    name: 'Aurora Foods Ltd',
    countryRegion: 'United Kingdom',
    activityAt: '24 July 2026',
    contact: 'Mina Rahman · Brand counsel',
    activity: [
      {
        id: 'a1',
        occurredAt: '24 July 2026, 14:30 UTC',
        title: 'Intake reviewed',
        detail: 'Scope questions retained for professional review.'
      }
    ],
    relatedIntakes: ['INT-104 · Aurora word mark'],
    relatedRecommendations: ['REC-44 · UK and EU comparison (draft)'],
    relatedOpportunities: ['EU portfolio coverage review']
  },
  {
    id: 'c-kumo',
    name: 'Kumo Bicycle Works',
    countryRegion: 'Japan',
    activityAt: '22 July 2026',
    contact: 'Emi Sato · Operations',
    activity: [
      {
        id: 'a2',
        occurredAt: '22 July 2026, 09:10 UTC',
        title: 'Customer note added',
        detail: 'Possible Canadian expansion mentioned; not confirmed demand.'
      }
    ],
    relatedIntakes: [],
    relatedRecommendations: [],
    relatedOpportunities: ['Canada expansion signal']
  },
  {
    id: 'c-long',
    name: 'The Very Long International Cooperative for Responsible Botanical Product Names and Regional Heritage',
    countryRegion: 'European Union',
    activityAt: '18 July 2026',
    contact: 'Shared legal team',
    activity: [],
    relatedIntakes: [
      'INT-118 · Extended multi-class description requiring careful wrapping and review'
    ],
    relatedRecommendations: [],
    relatedOpportunities: []
  }
];
export const opportunities: OpportunityDetail[] = [
  {
    id: 'o-eu',
    title: 'EU portfolio coverage review',
    customerId: 'c-aurora',
    customer: 'Aurora Foods Ltd',
    countryRegion: 'European Union',
    status: 'REVIEWING',
    source: 'Existing intake scope note',
    trademark: 'AURORA HARVEST',
    suggestedNextAction:
      'Review the existing EU classes with the customer before proposing any engagement.',
    confidence: 'Medium — one current intake and one customer note',
    evidence: [
      {
        source: 'INT-104 scope note',
        observedAt: '24 July 2026, 14:30 UTC',
        summary: 'The customer asked whether planned EU sales change the proposed scope.'
      }
    ],
    relatedPreview: 'INT-104 · Aurora word mark · Draft intake'
  },
  {
    id: 'o-ca',
    title: 'Canada expansion signal',
    customerId: 'c-kumo',
    customer: 'Kumo Bicycle Works',
    countryRegion: 'Canada',
    status: 'NEW',
    source: 'Customer activity note',
    trademark: 'KUMO',
    suggestedNextAction:
      'Ask whether Canada is an active business plan; do not assume an instruction.',
    confidence: 'Low — an unconfirmed planning mention',
    evidence: [
      {
        source: 'Customer note',
        observedAt: '22 July 2026, 09:10 UTC',
        summary: 'Possible Canadian expansion was mentioned in a routine portfolio conversation.'
      }
    ],
    relatedPreview: 'No related intake or matter yet.'
  },
  {
    id: 'o-old',
    title: 'Earlier renewal discussion',
    customerId: 'c-aurora',
    customer: 'Aurora Foods Ltd',
    countryRegion: 'United Kingdom',
    status: 'DEFERRED',
    source: 'Professional review note',
    trademark: 'AURORA',
    suggestedNextAction: 'Revisit only at the recorded review date.',
    confidence: 'High — dated review note',
    evidence: [
      {
        source: 'Review note',
        observedAt: '2 June 2026, 11:00 UTC',
        summary: 'The team deliberately deferred discussion.'
      }
    ],
    relatedPreview: 'Matter M-32 · Preview only'
  }
];
export const fixtureRepository: LiteWorkspaceRepository = {
  listCustomers() {
    return Promise.resolve(structuredClone(customers));
  },
  listOpportunities() {
    return Promise.resolve(structuredClone(opportunities));
  }
};

if (opportunities.some(({ customerId }) => !customers.some(({ id }) => id === customerId))) {
  throw new Error('Fixture opportunity references an unknown customer');
}
