import type { Meta, StoryObj } from '@storybook/react';
import {
  Alert,
  AppShell,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  FixtureBanner,
  LoadingState,
  RadioGroup,
  RecommendationCard,
  Select,
  SideNavigation,
  StatusBadge,
  Stepper,
  TextArea,
  TextInput
} from './index.js';
const meta = { title: 'Foundation/Overview', component: Button, tags: ['autodocs'] } satisfies Meta<
  typeof Button
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Buttons: Story = { args: { children: 'Continue' } };
export const Disabled: Story = { args: { children: 'Unavailable', disabled: true } };
export const HoverFocus: Story = {
  args: { children: 'Tab to focus' },
  parameters: { pseudo: { hover: true, focusVisible: true } }
};
export const Forms = () => (
  <div style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
    <TextInput label="Brand name" />
    <TextInput label="Email" error="Enter a valid email" />
    <TextArea label="Goods and services" />
    <Select label="Country">
      <option>United Kingdom</option>
    </Select>
    <Checkbox label="I have reviewed this" />
    <RadioGroup
      legend="Applicant type"
      name="type"
      options={[
        { value: 'person', label: 'Person' },
        { value: 'company', label: 'Company' }
      ]}
    />
  </div>
);
export const Statuses = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <StatusBadge status="success" />
    <StatusBadge status="warning" />
    <StatusBadge status="danger" />
    <StatusBadge status="pending" />
  </div>
);
export const Alerts = () => (
  <div style={{ display: 'grid', gap: 8 }}>
    <Alert title="Information">Details are available.</Alert>
    <Alert tone="warning" title="Review needed">
      Confirm assumptions.
    </Alert>
    <Alert tone="danger" title="Unable to continue">
      Try again.
    </Alert>
  </div>
);
export const PageStates = () => (
  <>
    <EmptyState title="Nothing here yet" description="New items will appear here." />
    <ErrorState description="The request could not be completed." />
    <LoadingState />
  </>
);
export const Progress = () => (
  <Stepper current={1} steps={['Intake', 'Recommendation', 'Plan', 'Documents']} />
);
const base = {
  summary: 'A focused starting point for the stated filing goal.',
  rationale: 'Balances the current target markets and stated business plans.',
  assumptions: ['The mark is available for use.'],
  limitations: ['No clearance search has been performed.'],
  fixtureOnly: true
};
export const RecommendationABC = () => (
  <div className="mo-grid">
    <RecommendationCard optionCode="A" title="Essential Protection" {...base} />
    <RecommendationCard
      optionCode="B"
      title="Recommended Protection"
      recommended
      selected
      {...base}
    />
    <RecommendationCard optionCode="C" title="Extended Protection" {...base} />
  </div>
);
export const LongText = () => (
  <RecommendationCard
    optionCode="B"
    title="Recommended Protection for a growing international brand"
    {...base}
    summary={'Long content demonstrates resilient wrapping. '.repeat(8)}
  />
);
export const Fixture = () => <FixtureBanner />;
export const Shell = () => (
  <AppShell
    brand="MarkOrbit"
    navigation={
      <SideNavigation
        items={[
          { label: 'Today', href: '#', active: true },
          { label: 'Work', href: '#' }
        ]}
      />
    }
  >
    <EmptyState title="Workspace ready" description="Choose an item from navigation." />
  </AppShell>
);
