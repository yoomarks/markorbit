import { Alert, PageHeader } from '@markorbit/ui';
import { BrainAdminWorkspace } from './brain-admin.js';

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
    id: 'super-admin-capability',
    title: 'Capability',
    status: 'Dedicated Capability administration is not separated in this foundation step.',
    boundary: 'Capability reachability is not represented as correctness or production authority.'
  }
];
landings.push(
  {
    id: 'super-admin-markreg',
    title: 'MarkReg',
    status: 'Dedicated MarkReg Super Admin surface is not connected in this foundation step.',
    boundary: 'Fee facts, filing state and Official Truth remain with their authoritative owners.'
  },
  {
    id: 'super-admin-lite',
    title: 'Lite',
    status: 'Dedicated Lite administration is not connected yet.',
    boundary: 'Creative or AI-derived output is not promoted to legal or Official Truth.'
  },
  {
    id: 'super-admin-mgsn',
    title: 'MGSN',
    status: 'Dedicated MGSN administration is not connected yet.',
    boundary: 'No recommendation, appointment or filing authority is inferred by this shell.'
  },
  {
    id: 'super-admin-execution',
    title: 'Execution',
    status: 'Execution-wide administration is not connected as a single owner read.',
    boundary:
      'Existing evidence review and lifecycle provenance remain explicit governed workflows.'
  }
);
landings.push(
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
);

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
    </section>
  );
}

export const superAdminDomainLandings = landings;
