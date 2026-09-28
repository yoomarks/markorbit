import { Badge, Button, Card } from '@markorbit/ui';
import { AdminApp } from './AdminApp.js';
import { SiteFront } from './SiteFront.js';
import { hasUnpublishedChanges, PreviewStoreProvider, usePreviewStore } from './store.js';
import { Link, RouterProvider, useRouter } from './router.js';
import { AdminLocaleProvider } from './i18n.js';
import { useAdminI18n } from './i18n.js';
import type { WorkspaceId } from './domain.js';

function RoutedApp() {
  const { route } = useRouter();
  if (route.kind === 'site-portfolio') return <SitePortfolio workspaceId={route.workspaceId} />;
  if (route.kind === 'admin')
    return (
      <AdminApp
        workspaceId={route.siteId}
        section={route.section}
        {...(route.itemId ? { itemId: route.itemId } : {})}
      />
    );
  if (route.kind === 'site')
    return (
      <SiteFront
        workspaceId={route.siteId}
        path={route.path}
        mode={route.mode}
        {...(route.locale ? { locale: route.locale } : {})}
      />
    );
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

function SitePortfolio({ workspaceId }: { workspaceId: WorkspaceId }) {
  const store = usePreviewStore();
  const { locale, setLocale, t } = useAdminI18n();
  const sites = store.workspaceSites(workspaceId);
  return (
    <main className="site-portfolio">
      <header className="portfolio-topbar">
        <Link href="/" className="admin-brand portfolio-brand">
          <span className="admin-brand__mark">MO</span>
          <span>
            <strong>MarkOrbit</strong>
            <small>{sites[0]?.workspaceName}</small>
          </span>
        </Link>
        <div
          className="admin-locale-switch"
          role="group"
          aria-label="界面语言 / Interface language"
        >
          <button
            type="button"
            className={locale === 'zh-CN' ? 'is-active' : ''}
            onClick={() => setLocale('zh-CN')}
          >
            简体中文
          </button>
          <button
            type="button"
            className={locale === 'en-US' ? 'is-active' : ''}
            onClick={() => setLocale('en-US')}
          >
            English
          </button>
        </div>
      </header>
      <section className="portfolio-hero">
        <div>
          <span className="eyebrow">{t('Workspace Site products')}</span>
          <h1>{t('My Sites')}</h1>
          <p>
            {t('Choose one Site to manage. Drafts, publication and inquiries remain independent.')}
          </p>
        </div>
        <Badge>{sites.length} Sites</Badge>
      </section>
      <section className="portfolio-grid" aria-label={t('My Sites')}>
        {sites.map((site) => {
          const unpublished = hasUnpublishedChanges(site);
          const pending = site.leads.filter((lead) => lead.status !== 'QUALIFIED').length;
          return (
            <Card className="portfolio-card" key={site.siteId}>
              <div className="portfolio-card__heading">
                <span
                  className={`terminal-icon ${site.terminal === 'WEB' ? 'web' : 'mini'}`}
                  aria-hidden
                >
                  {site.terminal === 'WEB' ? 'W' : '微'}
                </span>
                <div>
                  <span className="eyebrow">
                    {t(site.terminal === 'WEB' ? 'Website' : 'WeChat mini-program')}
                  </span>
                  <h2>{site.siteName}</h2>
                  <code>{site.siteId}</code>
                </div>
                <Badge>{t(site.lifecycle === 'ACTIVE' ? 'Active' : 'Draft')}</Badge>
              </div>
              <dl className="portfolio-stats">
                <div>
                  <dt>{t('Published version')}</dt>
                  <dd>v{site.versions.length}</dd>
                </div>
                <div>
                  <dt>{t('Unpublished changes')}</dt>
                  <dd>{unpublished ? t('Needs review') : t('Up to date')}</dd>
                </div>
                <div>
                  <dt>{t('Pending inquiries')}</dt>
                  <dd>{pending}</dd>
                </div>
              </dl>
              <div className="portfolio-card__actions">
                <Link
                  className="button-link"
                  href={`/admin/${site.siteId}/overview`}
                  aria-label={`${t('Manage')} ${site.siteName}`}
                >
                  {t('Enter Site Admin')}
                </Link>
                <Link className="button-link secondary" href={`/site/${site.siteId}/`}>
                  {t('View Site')}
                </Link>
              </div>
            </Card>
          );
        })}
      </section>
      <aside className="portfolio-boundary">
        <strong>{t('Workspace-owned work')}</strong>
        <p>
          {t(
            'Members, billing, the complete customer resource library and all-Site governance stay in the Workspace.'
          )}
        </p>
      </aside>
    </main>
  );
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
          <Link href="/admin/atlas/sites" className="launcher-card">
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
      <AdminLocaleProvider>
        <RouterProvider {...(initialPath ? { initialPath } : {})}>
          <RoutedApp />
        </RouterProvider>
      </AdminLocaleProvider>
    </PreviewStoreProvider>
  );
}

export function StoryStateControls() {
  return <Button onClick={() => localStorage.clear()}>Clear preview state</Button>;
}
