import {
  Button,
  Card,
  FixtureBanner,
  KeyValueList,
  PageHeader,
  RecommendationCard,
  Stepper
} from '@markorbit/ui';
export const productManifest = {
  product: 'markreg.com',
  status: 'STATIC_UI_FOUNDATION',
  uiSkillRequired: true,
  dataSource: 'FIXTURE_ONLY'
} as const;
const shared = {
  assumptions: [
    'The mark will be used for a software service.',
    'The first launch markets are the United Kingdom and EU.'
  ],
  limitations: [
    'No clearance search has been completed.',
    'A professional must review the scope before any protected external action.'
  ],
  fixtureOnly: true
};
export function MarkregRecommendationExample() {
  return (
    <div className="mo-public">
      <nav className="mo-public-nav" aria-label="Public">
        <strong>markreg.com</strong>
        <Button variant="secondary">Save and exit</Button>
      </nav>
      <FixtureBanner />
      <div style={{ height: '1.5rem' }} />
      <Stepper steps={['Your brand', 'Recommendation', 'Plan', 'Quote']} current={1} />
      <PageHeader
        title="Compare ways to protect your brand"
        description="These demonstration options organize the information you provided. They are not legal conclusions."
      />
      <Card>
        <h2>Your goal</h2>
        <KeyValueList
          items={[
            { term: 'Brand', description: 'Orbit & Oak' },
            { term: 'What you offer', description: 'Project management software' },
            { term: 'Launch markets', description: 'United Kingdom and European Union' }
          ]}
        />
      </Card>
      <div style={{ height: '1rem' }} />
      <div className="mo-grid">
        <RecommendationCard
          className="mo-span-4"
          optionCode="A"
          title="Essential Protection"
          summary="A focused starting scope for the primary market."
          rationale="Keeps the initial scope narrow while preserving a clear next review step."
          {...shared}
        />
        <RecommendationCard
          className="mo-span-4"
          optionCode="B"
          title="Recommended Protection"
          summary="Balanced coverage for the stated launch markets."
          rationale="Reflects your two-market launch plan and stated service category."
          recommended
          selected
          {...shared}
        />
        <RecommendationCard
          className="mo-span-4"
          optionCode="C"
          title="Extended Protection"
          summary="A broader option for teams planning near-term expansion."
          rationale="Adds scope for a stated expansion scenario, subject to professional review."
          {...shared}
        />
      </div>
      <div className="mo-page-header" style={{ marginTop: '1.5rem' }}>
        <Button variant="secondary">Back</Button>
        <Button>Continue with option B</Button>
      </div>
    </div>
  );
}
