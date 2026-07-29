import type { EvidenceSummary, RelatedRecord } from '../shared/view-models.js';

export type OpportunityStatus = 'NEW' | 'REVIEWING' | 'QUALIFIED' | 'DEFERRED' | 'DISMISSED';

export interface OpportunitySummary {
  id: string;
  title: string;
  customerId: string;
  customerName: string;
  region: string;
  trademark: string;
  status: OpportunityStatus;
  confidence: EvidenceSummary['confidence'];
}

export interface OpportunityDetail extends OpportunitySummary {
  source: string;
  sourceDetail: string;
  suggestedNextAction: string;
  evidence: EvidenceSummary;
  relatedPreview?: RelatedRecord;
}
