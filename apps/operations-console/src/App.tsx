import {
  AppShell,
  Card,
  DataList,
  PageHeader,
  SideNavigation,
  StatusBadge,
  TopBar
} from '@markorbit/ui';
export function OperationsApp() {
  return (
    <AppShell
      brand="Operations Console"
      internalOnly
      navigation={
        <SideNavigation
          items={[
            { label: 'Overview', href: '#overview', active: true },
            { label: 'Reviews', href: '#reviews' },
            { label: 'Events', href: '#events' }
          ]}
        />
      }
      topBar={<TopBar context="Production operations · Read-only fixture" />}
    >
      <PageHeader
        title="Operations overview"
        description="Internal triage for service exceptions and governed review queues."
      />
      <div className="mo-grid">
        <Card>
          <h2>Service health</h2>
          <DataList
            items={[
              { label: 'Gateway', value: <StatusBadge status="success" /> },
              { label: 'Execution', value: <StatusBadge status="warning" /> }
            ]}
          />
        </Card>
        <Card>
          <h2>Failed operations</h2>
          <DataList
            items={[
              { label: 'Retryable', value: '3' },
              { label: 'Blocking', value: '1' }
            ]}
          />
        </Card>
        <Card>
          <h2>Manual review</h2>
          <DataList
            items={[
              { label: 'Awaiting reviewer', value: '7' },
              { label: 'Overdue', value: '2' }
            ]}
          />
        </Card>
        <Card>
          <h2>Event summary</h2>
          <DataList
            items={[
              { label: 'Processed today', value: '1,248' },
              { label: 'Pending', value: '12' }
            ]}
          />
        </Card>
      </div>
    </AppShell>
  );
}
