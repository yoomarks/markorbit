import type { EvidenceSummary } from '../shared/view-models.js';
export type OpportunityStatus = 'NEW' | 'REVIEWING' | 'QUALIFIED' | 'DEFERRED' | 'DISMISSED';
export interface OpportunitySummary {
  readonly id: string;
  readonly title: string;
  readonly customerId: string;
  readonly customer: string;
  readonly countryRegion: string;
  readonly status: OpportunityStatus;
}
export interface OpportunityDetail extends OpportunitySummary {
  readonly source: string;
  readonly trademark: string;
  readonly suggestedNextAction: string;
  readonly confidence: string;
  readonly evidence: readonly EvidenceSummary[];
  readonly relatedPreview: string;
}
