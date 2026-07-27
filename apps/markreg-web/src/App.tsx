import {
  Button,
  Card,
  FixtureBanner,
  KeyValueList,
  PageHeader,
  RecommendationCard,
  Stepper
} from '@markorbit/ui';
import { useState } from 'react';
const options = [
  {
    optionCode: 'A',
    title: 'Essential Protection',
    summary: 'A focused starting point for the immediate filing goal.',
    rationale: 'Prioritizes the stated launch market while controlling initial scope.'
  },
  {
    optionCode: 'B',
    title: 'Recommended Protection',
    summary: 'Balanced coverage for the planned business footprint.',
    rationale: 'Reflects the stated launch and near-term expansion markets.'
  },
  {
    optionCode: 'C',
    title: 'Extended Protection',
    summary: 'Broader coverage for a more ambitious expansion plan.',
    rationale: 'Adds markets mentioned as longer-term priorities.'
  }
] as const;
export function MarkregApp() {
  const [selected, setSelected] = useState('B');
  return (
    <main style={{ maxWidth: 1200, margin: 'auto', padding: '2rem 1rem' }}>
      <FixtureBanner />
      <Stepper current={1} steps={['Your goal', 'Recommendation', 'Plan', 'Documents']} />
      <PageHeader
        title="Compare your protection options"
        description="Review the assumptions and limitations before choosing a next step."
      />
      <Card>
        <h2>Your application goal</h2>
        <KeyValueList
          items={[
            { key: 'Brand', value: 'Northstar' },
            { key: 'Applicant country', value: 'United Kingdom' },
            { key: 'Target markets', value: 'European Union · United States' }
          ]}
        />
      </Card>
      <div className="mo-grid" style={{ marginTop: 16 }}>
        {options.map((o) => (
          <RecommendationCard
            key={o.optionCode}
            {...o}
            assumptions={[
              'The applicant details supplied are accurate.',
              'The goods and services description is provisional.'
            ]}
            limitations={[
              'No clearance search has been performed.',
              'Professional review is required before filing.'
            ]}
            fixtureOnly
            recommended={o.optionCode === 'B'}
            selected={selected === o.optionCode}
            onSelect={() => setSelected(o.optionCode)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <Button>Continue with option {selected}</Button>
      </div>
    </main>
  );
}
