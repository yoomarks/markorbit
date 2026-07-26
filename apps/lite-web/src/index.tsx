import {
  Alert,
  AppShell,
  Badge,
  Button,
  Card,
  DataList,
  FixtureBanner,
  PageHeader,
  SectionHeader,
  StatusBadge,
  TopBar
} from '@markorbit/ui';
export const productManifest = {
  product: 'MarkOrbit Lite',
  status: 'STATIC_UI_FOUNDATION',
  uiSkillRequired: true,
  dataSource: 'FIXTURE_ONLY'
} as const;
const navigation = [
  'Today',
  'Content',
  'Opportunities',
  'Trademarks',
  'Work',
  'Capability',
  'Guide'
].map((label, index) => ({ label, href: `#${label.toLowerCase()}`, current: index === 0 }));
export function LiteTodayShell() {
  return (
    <AppShell
      productName="MarkOrbit Lite"
      navigation={navigation}
      topBar={
        <TopBar
          context={
            <>
              <strong>Northstar IP</strong>
              <span className="mo-help"> · Professional Workplace</span>
            </>
          }
          actions={<Button variant="secondary">Search</Button>}
        />
      }
    >
      <FixtureBanner />
      <div style={{ height: '1rem' }} />
      <PageHeader
        title="Good morning, Maya"
        description="A focused view of customer work that needs attention today."
        actions={<Button>Start work</Button>}
      />
      <div className="mo-grid">
        <Card className="mo-span-8">
          <SectionHeader
            title="Needs attention"
            description="Prioritized by due date and customer impact"
            actions={<Badge>4 open</Badge>}
          />
          <DataList
            items={[
              {
                label: 'Review Atlas intake summary',
                value: <StatusBadge tone="warning">Due today</StatusBadge>
              },
              {
                label: 'Confirm Wren goods description',
                value: <StatusBadge tone="danger">Blocked</StatusBadge>
              },
              {
                label: 'Approve Cedar recommendation',
                value: <StatusBadge tone="info">Review</StatusBadge>
              }
            ]}
          />
        </Card>
        <Card className="mo-span-4">
          <SectionHeader title="Opportunity signal" />
          <p className="mo-metric">6</p>
          <p>customer portfolios may need a lifecycle conversation.</p>
          <Button variant="secondary">Review opportunities</Button>
        </Card>
        <Card className="mo-span-4">
          <SectionHeader title="Trademark status" />
          <DataList
            items={[
              { label: 'On track', value: '23' },
              { label: 'Needs action', value: '4' },
              { label: 'Awaiting evidence', value: '2' }
            ]}
          />
        </Card>
        <Card className="mo-span-4">
          <SectionHeader title="Work queue" />
          <DataList
            items={[
              { label: 'Reviews', value: '7' },
              { label: 'Customer actions', value: '3' },
              { label: 'Drafts', value: '5' }
            ]}
          />
        </Card>
        <Card className="mo-span-4">
          <SectionHeader title="Capability suggestion" />
          <Alert tone="info" title="Evidence review">
            <p>
              Consider the governed Evidence Review Capability for two matters with new documents.
            </p>
          </Alert>
          <p className="mo-help">A suggestion does not verify a Capability or mutate canon.</p>
        </Card>
      </div>
    </AppShell>
  );
}
