import {
  AppShell,
  Badge,
  Card,
  DataList,
  FixtureBanner,
  PageHeader,
  SectionHeader,
  SideNavigation,
  StatusBadge,
  TopBar
} from '@markorbit/ui';
const nav = ['Today', 'Content', 'Opportunities', 'Trademarks', 'Work', 'Capability', 'Guide'];
export function LiteApp() {
  return (
    <AppShell
      brand="MarkOrbit Lite"
      navigation={
        <SideNavigation
          items={nav.map((label) => ({
            label,
            href: `#${label.toLowerCase()}`,
            active: label === 'Today'
          }))}
        />
      }
      topBar={
        <TopBar
          context="Northstar IP · Monday, 27 July"
          actions={<Badge>Fixture workspace</Badge>}
        />
      }
    >
      <FixtureBanner />
      <PageHeader
        title="Today"
        description="A calm view of the work that needs professional attention."
      />
      <div className="mo-grid">
        <Card>
          <SectionHeader
            title="Pending attention"
            description="Review before any protected action"
          />
          <DataList
            items={[
              { label: 'Client intake review', value: '4', status: 'Due today' },
              { label: 'Draft publish packages', value: '2', status: 'Awaiting approval' }
            ]}
          />
        </Card>
        <Card>
          <SectionHeader title="Opportunities" />
          <DataList
            items={[
              { label: 'Renewal conversations', value: '6' },
              { label: 'Portfolio gaps', value: '3' }
            ]}
          />
        </Card>
        <Card>
          <SectionHeader title="Trademark status" />
          <DataList
            items={[
              { label: 'Active', value: '128' },
              { label: 'Needs review', value: <StatusBadge status="warning" /> }
            ]}
          />
        </Card>
        <Card>
          <SectionHeader title="Work" />
          <DataList
            items={[
              { label: 'In progress', value: '9' },
              { label: 'Blocked', value: '1' }
            ]}
          />
        </Card>
        <Card>
          <SectionHeader title="Capability suggestion" />
          <p>Consider evidence-led portfolio review for upcoming renewals.</p>
          <StatusBadge status="info" />
        </Card>
      </div>
    </AppShell>
  );
}
