import { Alert, Badge, Button, Card, PageHeader } from '@markorbit/ui';

export interface WorkHubProps {
  workspaceId: string;
}

function open(hash: 'work-professional-review' | 'work-execution-release' | 'work-customers') {
  window.location.hash = hash;
}

export function WorkHub({ workspaceId }: WorkHubProps) {
  return (
    <section aria-labelledby="work-hub-heading">
      <PageHeader
        title="Work"
        description="Professional work surfaces, with their current product maturity shown explicitly"
        actions={<Badge>Work overview</Badge>}
      />
      <Alert tone="info" title="Different work surfaces have different maturity">
        Professional Review is authenticated Workspace work. Execution Release is API-backed but is
        not yet promoted as fully authenticated Workspace work. Customers remains a fixture-only
        preview until a canonical Customer owner is available.
      </Alert>
      <div className="lite-grid" aria-label="Work surfaces">
        <Card>
          <div className="lite-row">
            <div>
              <p>Governed review queue</p>
              <h2 id="work-hub-heading">Professional Review</h2>
            </div>
            <Badge>Live governed</Badge>
          </div>
          <p>
            Review exact Matter Draft evidence, resolve blocking checks, and record a bounded human
            review decision without performing an external filing.
          </p>
          <Button
            disabled={!workspaceId}
            onClick={() => open('work-professional-review')}
          >
            {workspaceId ? 'Open Professional Review' : 'Select a Workspace first'}
          </Button>
        </Card>
        <Card>
          <div className="lite-row">
            <div>
              <p>Governed execution preparation</p>
              <h2>Execution Release</h2>
            </div>
            <Badge>Hardening in progress</Badge>
          </div>
          <p>
            Inspect bounded release evidence and prepared execution state. This surface does not mean
            a filing was submitted, and its browser authority boundary is still being hardened.
          </p>
          <Button variant="secondary" onClick={() => open('work-execution-release')}>
            Open bounded release surface
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
