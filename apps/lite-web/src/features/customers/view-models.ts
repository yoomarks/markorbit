export interface CustomerSummary {
  readonly id: string;
  readonly name: string;
  readonly countryRegion: string;
  readonly activityAt: string;
}
export interface CustomerActivityItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly title: string;
  readonly detail: string;
}
export interface CustomerDetail extends CustomerSummary {
  readonly contact: string;
  readonly activity: readonly CustomerActivityItem[];
  readonly relatedIntakes: readonly string[];
  readonly relatedRecommendations: readonly string[];
  readonly relatedOpportunities: readonly string[];
}
