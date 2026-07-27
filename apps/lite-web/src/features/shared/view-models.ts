export type FixtureState = 'ready' | 'loading' | 'empty' | 'stale' | 'error';
export interface EvidenceSummary {
  source: string;
  observedAt: string;
  summary: string;
}
