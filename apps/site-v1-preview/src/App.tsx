import { Button } from '@markorbit/ui';
import { AdminApp } from './AdminApp.js';
import { SiteFront } from './SiteFront.js';
import { PreviewStoreProvider } from './store.js';
import { Link, RouterProvider, useRouter } from './router.js';

function RoutedApp() {
  const { route } = useRouter();
  if (route.kind === 'admin')
    return (
      <AdminApp
        workspaceId={route.workspaceId}
        section={route.section}
        {...(route.itemId ? { itemId: route.itemId } : {})}
      />
    );
  if (route.kind === 'site') return <SiteFront workspaceId={route.workspaceId} path={route.path} />;
  if (route.kind === 'not-found')
    return (
      <main className="preview-not-found">
        <span>404</span>
        <h1>Preview route not found</h1>
        <p>{route.path}</p>
        <Link className="button-link" href="/">
          Return to preview launcher
        </Link>
      </main>
    );
  return <Landing />;
}

function Landing() {
  return (
    <main className="launcher">
      <div className="launcher-grid" aria-hidden />
      <header>
        <span className="launcher-mark">MO</span>
        <strong>MarkOrbit Site V1</strong>
        <small>Interactive product preview</small>
      </header>
      <section>
        <p className="launcher-eyebrow">Workspace Site / Preview environment</p>
        <h1>
          Build the front door.
          <br />
          Keep the truth where it belongs.
        </h1>
        <p>
          Explore a complete Site Admin and two distinctly branded customer Sites. Every action is
          local, reversible, and explicitly demo-only.
        </p>
        <div className="launcher-actions">
          <Link href="/admin/atlas/overview" className="launcher-card">
            <span>01 / SITE ADMIN</span>
            <h2>Atlas IP Counsel</h2>
            <p>Create, edit, publish, and trace an inquiry back to its exact source.</p>
            <b>Open Workspace Console →</b>
          </Link>
          <Link href="/site/atlas/" className="launcher-card">
            <span>02 / COUNSEL TEMPLATE</span>
            <h2>Advisory Site</h2>
            <p>A calm, editorial experience for a trademark counsel practice.</p>
            <b>Open customer Site →</b>
          </Link>
          <Link href="/site/foundry/" className="launcher-card accent">
            <span>03 / EXCHANGE TEMPLATE</span>
            <h2>Asset Exchange</h2>
            <p>A bold, catalogue-led experience for brand assets and advisory services.</p>
            <b>Open customer Site →</b>
          </Link>
        </div>
      </section>
      <footer>
        <span>Demo fixtures · browser-local state</span>
        <span>No production API or protected action</span>
      </footer>
    </main>
  );
}

export function App({ initialPath }: { initialPath?: string }) {
  return (
    <PreviewStoreProvider>
      <RouterProvider {...(initialPath ? { initialPath } : {})}>
        <RoutedApp />
      </RouterProvider>
    </PreviewStoreProvider>
  );
}

export function StoryStateControls() {
  return <Button onClick={() => localStorage.clear()}>Clear preview state</Button>;
}
