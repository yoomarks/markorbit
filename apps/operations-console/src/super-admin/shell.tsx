import type { ReactNode } from 'react';
import './styles.css';
import { AppShell, SideNavigation, TopBar } from '@markorbit/ui';

const navigationItems = [
  { label: 'Overview', href: '#overview', active: true },
  { label: 'Core', href: '#super-admin-core' },
  { label: 'Workspace', href: '#super-admin-workspace' },
  { label: 'Brain', href: '#super-admin-brain' },
  { label: 'Capability', href: '#super-admin-capability' },
  { label: 'MarkReg', href: '#super-admin-markreg' },
  { label: 'Lite', href: '#super-admin-lite' },
  { label: 'MGSN', href: '#super-admin-mgsn' },
  { label: 'Knowledge', href: '#super-admin-knowledge' },
  { label: 'Data Engine', href: '#data-platform' },
  { label: 'Execution', href: '#super-admin-execution' },
  { label: 'Commercial / Payment', href: '#commercial-admin' },
  { label: 'System', href: '#super-admin-system' },
  { label: 'Governance & Audit', href: '#super-admin-governance' }
] as const;

export function SuperAdminShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      brand="MarkOrbit Super Admin"
      internalOnly
      navigation={<SideNavigation items={navigationItems} />}
      topBar={<TopBar context="Platform administration · Owner-routed truth" />}
    >
      {children}
    </AppShell>
  );
}

export const superAdminNavigationItems = navigationItems;
