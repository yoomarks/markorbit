import { Alert, Badge, Button, Card, PageHeader } from '@markorbit/ui';
import { updateLiteLocation } from '../../routing/workspace-navigation.js';
import type { LiteSurface } from '../../routing/workspace-shell.js';

export interface WorkHubProps {
  workspaceId: string;
}

function open(surface: LiteSurface, workspaceId: string) {
  updateLiteLocation({ surface, workspaceId: workspaceId || undefined });
}

export function WorkHub({ workspaceId }: WorkHubProps) {
  return (
    <section aria-label="Work hub">
      <PageHeader
        title="Work"
        description="Review, prepare and understand professional work from one place"
        actions={<Badge>Workspace tools</Badge>}
      />
      <p className="lite-page-intro">
        Use Today for the daily command center. Use Work when you already know the professional task
        or context you need to open.
      </p>
      <Alert tone="info" title="Different work surfaces have different authority and maturity">
        Professional Review, Execution Release, Opportunity Center, Capability Center and Guide use
        authenticated Workspace context. Execution Release remains preparation only. Guide remains
        advisory and asset-scoped. Customers remains a fixture-only preview until a canonical
        Customer owner is available.
      </Alert>
      <div className="lite-grid" aria-label="Professional work tools">
        <Card>
          <div className="lite-row">
            <div>
              <p>Governed review queue</p>
              <h2>Professional Review</h2>
            </div>
            <Badge>Live governed</Badge>
          </div>
          <p>
            Review exact Matter evidence, resolve blocking checks and record a bounded human review
            decision without performing an external filing.
          </p>
          <Button disabled={!workspaceId} onClick={() => open('professional-review', workspaceId)}>
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
            Inspect exact durable release evidence and prepared execution task receipt truth. Release
            does not mean a filing was submitted, a provider was appointed or payment occurred.
          </p>
          <Button
            variant="secondary"
            disabled={!workspaceId}
            onClick={() => open('execution-release', workspaceId)}
          >
            {workspaceId ? 'Open Execution Release' : 'Select a Workspace first'}
          </Button>
        </Card>
        <Card>
          <div className="lite-row">
            <div>
              <p>Human qualification</p>
              <h2>Opportunity Center</h2>
            </div>
            <Badge>Live · human review</Badge>
          </div>
          <p>
            Inspect exact Candidate evidence and record a bounded Qualification Decision. Candidate
            does not establish customer demand, instruction or relationship truth.
          </p>
          <Button
            variant="secondary"
            disabled={!workspaceId}
            onClick={() => open('opportunities', workspaceId)}
          >
            {workspaceId ? 'Open Opportunity Center' : 'Select a Workspace first'}
          </Button>
        </Card>
        <Card>
          <div className="lite-row">
            <div>
              <p>Private professional reflection</p>
              <h2>Capability Center</h2>
            </div>
            <Badge>Private</Badge>
          </div>
          <p>
            Review governed evidence and private reflection candidates without turning activity into
            certification, ranking, permission or professional score.
          </p>
          <Button
            variant="secondary"
            disabled={!workspaceId}
            onClick={() => open('capability', workspaceId)}
          >
            {workspaceId ? 'Open Capability Center' : 'Select a Workspace first'}
          </Button>
        </Card>
        <Card>
          <div className="lite-row">
            <div>
              <p>Contextual intelligence</p>
              <h2>AI Guide</h2>
            </div>
            <Badge>Asset-scoped advisory</Badge>
          </div>
          <p>
            Prepare bounded explanations, missing-information reviews and checklists against a
            current Trademark Asset. Guide creates no filing, execution, contact, payment or Official
            Truth.
          </p>
          <Button
            variant="secondary"
            disabled={!workspaceId}
            onClick={() => open('guide', workspaceId)}
          >
            {workspaceId ? 'Open AI Guide' : 'Select a Workspace first'}
          </Button>
        </Card>
        <Card>
          <div className="lite-row">
            <div>
              <p>Relationship concept</p>
              <h2>Customers</h2>
            </div>
            <Badge>Fixture preview</Badge>
          </div>
          <p>
            Explore the current relationship-context concept. These records are demonstration data
            and do not establish live customer identity, relationship or instruction truth.
          </p>
          <Button variant="secondary" onClick={() => open('customers', workspaceId)}>
            Open Customer preview
          </Button>
        </Card>
      </div>
    </section>
  );
}
