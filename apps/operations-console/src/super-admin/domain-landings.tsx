import { Alert, PageHeader } from '@markorbit/ui';
import { BrainAdminWorkspace } from './brain-admin.js';
import { CapabilityAdminWorkspace } from './capability-admin.js';
import { KnowledgeAdminWorkspace } from './knowledge-admin.js';
import { LiteAdminWorkspace } from './lite-admin.js';
import { MarkRegAdminWorkspace } from './markreg-admin.js';
import { MgsnAdminWorkspace } from './mgsn-admin.js';

type DomainLanding = {
  id: string;
  title: string;
  status: string;
  boundary: string;
};

const landings: DomainLanding[] = [
  {
    id: 'super-admin-core',
    title: 'Core',
    status: 'Global Core administration is not connected in this shell yet.',
    boundary: 'No account, identity or Workspace state is inferred from other domains.'
  },
  {
    id: 'super-admin-execution',
    title: 'Execution',
    status: 'Execution-wide administration is not connected as a single owner read.',
    boundary:
      'Existing evidence review and lifecycle provenance remain explicit governed workflows.'
  },
  {
    id: 'super-admin-system',
    title: 'System',
    status: 'No authoritative aggregate system-health projection is connected.',
    boundary: 'Unavailable owner telemetry is not rendered as healthy, empty or zero.'
  },
  {
    id: 'super-admin-governance',
    title: 'Governance & Audit',
    status: 'No unified audit truth is connected in this foundation step.',
    boundary: 'Per-owner evidence and governance records retain their own authority boundaries.'
  }
];

export function SuperAdminDomainLandings() {
  return (
    <section aria-label="Super Admin domains">
      <PageHeader
        title="Platform domains"
        description="Navigation is global; domain truth remains distributed and owner-routed."
      />
      <Alert tone="info" title="No synthetic platform truth">
        A domain landing is a navigation boundary, not evidence that its owner read is connected.
      </Alert>
      <ul>
        {landings.map((landing) => (
          <li id={landing.id} key={landing.id}>
            <strong>{landing.title}</strong> — {landing.status} {landing.boundary}
          </li>
        ))}
      </ul>
      <BrainAdminWorkspace />
      <CapabilityAdminWorkspace />
      <MarkRegAdminWorkspace />
      <LiteAdminWorkspace />
      <MgsnAdminWorkspace />
      <KnowledgeAdminWorkspace />
    </section>
  );
}

export const superAdminDomainLandings = landings;
