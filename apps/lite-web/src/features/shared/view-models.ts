export type FixtureState = 'ready' | 'loading' | 'empty' | 'stale' | 'error';

export interface EvidenceSummary {
  confidence: 'High' | 'Medium' | 'Low';
  basis: string;
  observedAt: string;
  limitations: string[];
}

export interface RelatedRecord {
  id: string;
  title: string;
  status: string;
}
