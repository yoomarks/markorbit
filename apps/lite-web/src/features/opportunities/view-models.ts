import type { EvidenceSummary } from '../shared/view-models.js';
export type OpportunityStatus = 'NEW' | 'REVIEWING' | 'QUALIFIED' | 'DEFERRED' | 'DISMISSED';
export interface OpportunitySummary {
  id: string;
  title: string;
  customerId: string;
  customer: string;
  countryRegion: string;
  status: OpportunityStatus;
}
export interface OpportunityDetail extends OpportunitySummary {
  source: string;
  trademark: string;
  suggestedNextAction: string;
  confidence: string;
  evidence: EvidenceSummary[];
  relatedPreview: string;
}
