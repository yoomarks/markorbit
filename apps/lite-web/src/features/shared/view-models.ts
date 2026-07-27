export type FixtureState = 'ready' | 'loading' | 'empty' | 'stale' | 'error';
export interface EvidenceSummary {
  readonly source: string;
  readonly observedAt: string;
  readonly summary: string;
}
