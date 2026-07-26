import type { ReactNode } from 'react';
export type NavigationItem = { label: string; href: string; current?: boolean };
export function SideNavigation({ label, items }: { label: string; items: NavigationItem[] }) {
  return (
    <nav aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <a href={item.href} aria-current={item.current ? 'page' : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
export function TopBar({ context, actions }: { context: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mo-top">
      <div>{context}</div>
      <div className="mo-cluster">{actions}</div>
    </header>
  );
}
export function AppShell({
  productName,
  navigationLabel = 'Primary',
  navigation,
  topBar,
  children,
  internal = false
}: {
  productName: string;
  navigationLabel?: string;
  navigation: NavigationItem[];
  topBar: ReactNode;
  children: ReactNode;
  internal?: boolean;
}) {
  return (
    <div className={`mo-shell${internal ? ' mo-internal' : ''}`}>
      <aside className="mo-side">
        <div>
          <div className="mo-side__brand">{productName}</div>
          {internal && <div className="mo-internal-label">Internal use only</div>}
        </div>
        <SideNavigation label={navigationLabel} items={navigation} />
      </aside>
      <div className="mo-shell__body">
        {topBar}
        <main className="mo-main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
