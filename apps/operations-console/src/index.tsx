import {
  AppShell,
  Badge,
  Card,
  DataList,
  FixtureBanner,
  PageHeader,
  SectionHeader,
  StatusBadge,
  TopBar
} from '@markorbit/ui';
export const productManifest = {
  product: 'Operations Console',
  status: 'STATIC_UI_FOUNDATION',
  uiSkillRequired: true,
  audience: 'INTERNAL_ONLY',
  dataSource: 'FIXTURE_ONLY'
} as const;
const navigation = [
  'System Overview',
  'Service Health',
  'Event Monitor',
  'Failed Operations',
  'Manual Review Queue',
  'Data Source Status',
  'Audit Trail'
].map((label, index) => ({
  label,
  href: `#${label.toLowerCase().replaceAll(' ', '-')}`,
  current: index === 0
}));
export function OperationsConsoleShell() {
  return (
    <AppShell
      internal
      productName="Operations Console"
      navigation={navigation}
      topBar={
        <TopBar
          context={<strong>Production overview · fixture</strong>}
          actions={<StatusBadge tone="success">Operator session</StatusBadge>}
        />
      }
    >
      <FixtureBanner />
      <div style={{ height: '1rem' }} />
      <PageHeader
        title="System overview"
        description="Internal operational signals, exceptions and human intervention queues."
        actions={<Badge>Last refreshed 09:42 UTC</Badge>}
      />
      <div className="mo-grid">
        <Card className="mo-span-12">
          <SectionHeader title="Service health" />
          <div className="mo-grid">
            <div className="mo-span-4">
              <p className="mo-metric">6 / 6</p>
              <StatusBadge tone="success">Services responding</StatusBadge>
            </div>
            <div className="mo-span-4">
              <p className="mo-metric">1.2 s</p>
              <span>p95 fixture latency</span>
            </div>
            <div className="mo-span-4">
              <p className="mo-metric">0</p>
              <span>active incidents</span>
            </div>
          </div>
        </Card>
        <Card className="mo-span-4">
          <SectionHeader
            title="Failed operations"
            actions={<StatusBadge tone="danger">3</StatusBadge>}
          />
          <DataList
            items={[
              { label: 'Event publish retry', value: '2' },
              { label: 'Downstream timeout', value: '1' }
            ]}
          />
        </Card>
        <Card className="mo-span-4">
          <SectionHeader
            title="Manual review"
            actions={<StatusBadge tone="warning">8</StatusBadge>}
          />
          <DataList
            items={[
              { label: 'Recommendation review', value: '5' },
              { label: 'Evidence validation', value: '3' }
            ]}
          />
        </Card>
        <Card className="mo-span-4">
          <SectionHeader title="Event summary" />
          <DataList
            items={[
              { label: 'Processed (1h)', value: '1,284' },
              { label: 'Retrying', value: '2' },
              { label: 'Dead-lettered', value: '0' }
            ]}
          />
        </Card>
      </div>
    </AppShell>
  );
}
