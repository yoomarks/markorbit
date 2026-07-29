import type { RelatedRecord } from '../shared/view-models.js';

export interface CustomerSummary {
  id: string;
  displayName: string;
  region: string;
  status: 'Active' | 'Needs review';
  lastActivity: string;
  opportunityCount: number;
}

export interface CustomerActivityItem {
  id: string;
  occurredAt: string;
  title: string;
  detail: string;
  source: string;
}

export interface CustomerDetail extends CustomerSummary {
  contact: string;
  notes: string;
  activity: CustomerActivityItem[];
  relatedIntakes: RelatedRecord[];
  relatedRecommendations: RelatedRecord[];
  relatedOpportunities: RelatedRecord[];
}
