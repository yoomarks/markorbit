export interface CustomerSummary {
  id: string;
  name: string;
  countryRegion: string;
  activityAt: string;
}
export interface CustomerActivityItem {
  id: string;
  occurredAt: string;
  title: string;
  detail: string;
}
export interface CustomerDetail extends CustomerSummary {
  contact: string;
  activity: CustomerActivityItem[];
  relatedIntakes: string[];
  relatedRecommendations: string[];
  relatedOpportunities: string[];
}
