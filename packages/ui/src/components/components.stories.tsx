import type { Meta, StoryObj } from '@storybook/react';
import {
  Alert,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  FixtureBanner,
  LoadingState,
  RecommendationCard,
  Select,
  StatusBadge,
  Stepper,
  TextArea,
  TextInput
} from './index.js';
const meta = {
  title: 'Foundation/Component states',
  component: Button,
  tags: ['autodocs']
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Buttons: Story = {
  render: () => (
    <div className="mo-cluster">
      <Button>Default</Button>
      <Button variant="secondary">Hover me</Button>
      <Button autoFocus>Focused</Button>
      <Button disabled>Disabled</Button>
      <Button variant="danger">Danger</Button>
    </div>
  )
};
export const FormControls: Story = {
  render: () => (
    <div className="mo-stack" style={{ maxWidth: 480 }}>
      <TextInput label="Brand name" hint="Use the name customers see." />
      <TextInput label="Contact email" error="Enter a valid email address." />
      <TextArea label="What do you offer?" />
      <Select label="Primary market">
        <option>United Kingdom</option>
      </Select>
      <Checkbox label="I confirm this demonstration information is accurate." />
    </div>
  )
};
export const Statuses: Story = {
  render: () => (
    <div className="mo-cluster">
      <StatusBadge tone="success">Ready</StatusBadge>
      <StatusBadge tone="warning">Pending review</StatusBadge>
      <StatusBadge tone="danger">Failed</StatusBadge>
      <StatusBadge tone="info">Information</StatusBadge>
    </div>
  )
};
export const Alerts: Story = {
  render: () => (
    <div className="mo-stack">
      <Alert title="Information">A next step is available.</Alert>
      <Alert tone="warning" title="Review needed">
        Check assumptions before continuing.
      </Alert>
      <Alert tone="danger" title="Unable to continue">
        Try again or contact support.
      </Alert>
    </div>
  )
};
export const PageStates: Story = {
  render: () => (
    <div className="mo-grid">
      <div className="mo-span-4">
        <EmptyState title="Nothing here yet" description="New items will appear here." />
      </div>
      <div className="mo-span-4">
        <ErrorState
          title="Could not load"
          description="Check your connection and retry."
          action={<Button>Retry</Button>}
        />
      </div>
      <div className="mo-span-4">
        <LoadingState />
      </div>
    </div>
  )
};
export const Progress: Story = {
  render: () => <Stepper steps={['Intake', 'Recommendation', 'Plan', 'Quote']} current={1} />
};
export const RecommendationOptions: Story = {
  render: () => (
    <div className="mo-grid">
      {['Essential Protection', 'Recommended Protection', 'Extended Protection'].map(
        (title, index) => (
          <RecommendationCard
            className="mo-span-4"
            key={title}
            optionCode={String.fromCharCode(65 + index)}
            title={title}
            summary="A deliberately long summary demonstrates how the card responds when customer-facing explanation needs more space without hiding its meaning."
            rationale="Based on the stated goal and markets."
            assumptions={['The provided use description is accurate.']}
            limitations={['No clearance search has been completed.']}
            recommended={index === 1}
            fixtureOnly
          />
        )
      )}
    </div>
  )
};
export const FixtureWarning: Story = { render: () => <FixtureBanner /> };
export const SmallScreen: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <TextInput label="Brand name" error="This field is required." />
      <FixtureBanner />
    </div>
  )
};
