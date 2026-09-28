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

export function SuperAdminDomainLandings({ activeId }: { activeId: string }) {
  switch (activeId) {
    case 'super-admin-core':
      return <CoreAdminWorkspace />;
    case 'super-admin-brain':
      return <BrainAdminWorkspace />;
    case 'super-admin-capability':
      return <CapabilityAdminWorkspace />;
    case 'super-admin-markreg':
      return <MarkRegAdminWorkspace />;
    case 'super-admin-lite':
      return <LiteAdminWorkspace />;
    case 'super-admin-mgsn':
      return <MgsnAdminWorkspace />;
    case 'super-admin-knowledge':
      return <KnowledgeAdminWorkspace />;
    case 'super-admin-execution':
      return <ExecutionAdminWorkspace />;
    case 'super-admin-system':
      return <SystemAdminWorkspace />;
    case 'super-admin-governance':
      return <GovernanceAdminWorkspace />;
    default:
      return null;
  }
}

export const superAdminDomainLandings: readonly SuperAdminDomainLanding[] = [];
