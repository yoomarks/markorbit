import { Alert, PageHeader } from '@markorbit/ui';
import { CoreAdminWorkspace } from './core-admin.js';
import { BrainAdminWorkspace } from './brain-admin.js';
import { CapabilityAdminWorkspace } from './capability-admin.js';
import { ExecutionAdminWorkspace } from './execution-admin.js';
import { KnowledgeAdminWorkspace } from './knowledge-admin.js';
import { LiteAdminWorkspace } from './lite-admin.js';
import { MarkRegAdminWorkspace } from './markreg-admin.js';
import { MgsnAdminWorkspace } from './mgsn-admin.js';
import { SystemAdminWorkspace } from './system-admin.js';
import { GovernanceAdminWorkspace } from './governance-admin.js';

export type SuperAdminDomainLanding = Readonly<{
  id: string;
  title: string;
  status: string;
  boundary: string;
}>;

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
      <CoreAdminWorkspace />
      <BrainAdminWorkspace />
      <CapabilityAdminWorkspace />
      <MarkRegAdminWorkspace />
      <LiteAdminWorkspace />
      <MgsnAdminWorkspace />
      <KnowledgeAdminWorkspace />
      <ExecutionAdminWorkspace />
      <SystemAdminWorkspace />
      <GovernanceAdminWorkspace />
    </section>
  );
}

export const superAdminDomainLandings: readonly SuperAdminDomainLanding[] = [];
