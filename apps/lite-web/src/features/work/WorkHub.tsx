import { Alert, Badge, Button, Card, PageHeader } from '@markorbit/ui';

export interface WorkHubProps {
  workspaceId: string;
}

function open(hash: 'work-professional-review' | 'work-execution-release' | 'work-customers') {
  window.location.hash = hash;
}

export function WorkHub({ workspaceId }: WorkHubProps) {
  return (
    <section aria-label="Work hub">
      <PageHeader
        title="Work"
        description="Professional work surfaces, with their current product maturity shown explicitly"
        actions={<Badge>Work overview</Badge>}
      />
      <Alert tone="info" title="Different work surfaces have different maturity">
        Professional Review and Execution Release are authenticated Workspace work. Execution
        Release consumes durable governed preparation truth but does not itself perform an external
        filing or execution. Customers remains a fixture-only preview until a canonical Customer
        owner is available.
      </Alert>
      <div className="lite-grid" aria-label="Work surfaces">
        <Card>
          <div className="lite-row">
            <div>
              <p>Governed review queue</p>
              <h2>Professional Review</h2>
            </div>
            <Badge>Live governed</Badge>
          </div>
          <p>
            Review exact Matter Draft evidence, resolve blocking checks, and record a bounded human
            review decision without performing an external filing.
          </p>
          <Button disabled={!workspaceId} onClick={() => open('work-professional-review')}>
            {workspaceId ? 'Open Professional Review' : 'Select a Workspace first'}
          </Button>
        </Card>
        <Card>
          <div className="lite-row">
            <div>
              <p>Governed execution preparation</p>
              <h2>Execution Release</h2>
            </div>
            <Badge>Authenticated governed</Badge>
          </div>
          <p>
            Inspect exact durable release evidence and prepared execution task receipt truth for the
            selected Workspace. Release does not mean a filing was submitted, a provider was
            appointed, payment occurred, or Official Truth changed.
          </p>
          <Button variant="secondary" onClick={() => open('work-execution-release')}>
            Open Execution Release
          </Button>
        </Card>
        <Card>
          <div className="lite-row">
            <div>
              <p>Relationship preview</p>
              <h2>Customers</h2>
            </div>
            <Badge>Fixture preview</Badge>
          </div>
          <p>
            Explore the current customer interaction concept. These records are demonstration data
            and do not establish live customer, identity, or relationship truth.
          </p>
          <Button variant="secondary" onClick={() => open('work-customers')}>
            Open Customer preview
          </Button>
        </Card>
      </div>
    </section>
  );
}
