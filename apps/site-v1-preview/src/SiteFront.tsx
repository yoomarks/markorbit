import { createContext, useContext, useEffect, useState, type FormEvent } from 'react';
import { Button, Select, TextArea, TextInput } from '@markorbit/ui';
import {
  projectLocale,
  type DemoLead,
  type Locale,
  type SiteConfig,
  type WorkspaceId
} from './domain.js';
import { usePreviewStore } from './store.js';
import { Link } from './router.js';
import { frontT } from './front-i18n.js';

const FrontLocaleContext = createContext<Locale>('zh-CN');
const useFrontLocale = () => useContext(FrontLocaleContext);
const useFrontT = () => {
  const locale = useFrontLocale();
  return (message: string) => frontT(locale, message);
};

function frontNavigationLabel(pageId: string, fallback: string, t: (message: string) => string) {
  const labels: Record<string, string> = {
    services: 'Services',
    insights: 'Articles',
    assets: 'Trademark showcase'
  };
  return t(labels[pageId] ?? fallback);
}

export function SiteFront({
  workspaceId,
  path,
  mode = 'published',
  locale: requestedLocale
}: {
  workspaceId: WorkspaceId;
  path: string;
  mode?: 'published' | 'draft';
  locale?: Locale;
}) {
  const workspace = usePreviewStore().workspaces[workspaceId];
  const snapshot = mode === 'draft' ? workspace.draft : workspace.published;
  const locale = requestedLocale ?? snapshot.defaultLocale;
  const localeAvailable =
    snapshot.enabledLocales.includes(locale) &&
    (mode === 'draft' || snapshot.localePublication[locale] === 'PUBLISHED');
  const config = projectLocale(snapshot, locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = config.localized[locale].seo.title;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.append(description);
    }
    description.content = config.localized[locale].seo.description;
    document.querySelectorAll('[data-mo-site-locale-link]').forEach((node) => node.remove());
    for (const alternate of snapshot.enabledLocales) {
      const link = document.createElement('link');
      link.rel = alternate === locale ? 'canonical' : 'alternate';
      if (alternate !== locale) link.hreflang = alternate;
      link.href = `${window.location.origin}/site/${workspaceId}/${alternate}${path === '/' ? '/' : path}`;
      link.dataset.moSiteLocaleLink = 'true';
      document.head.append(link);
    }
  }, [config.localized, locale, path, snapshot.enabledLocales, workspaceId]);
  const t = (message: string) => frontT(locale, message);
  return (
    <FrontLocaleContext.Provider value={locale}>
      <div
        className={`site-front site-template-${config.template}`}
        style={
          {
            '--site-primary': config.primary,
            '--site-accent': config.accent
          } as React.CSSProperties
        }
      >
        <div className="front-demo-bar">
          <strong>{t(mode === 'draft' ? 'DRAFT PREVIEW' : 'DEMO SITE')}</strong>
          <span>
            {t('Fictional content · no real quote, order, payment, filing, or submission')}
          </span>
          <Link href={`/admin/${workspaceId}/overview`}>{t('Open Site Admin')}</Link>
        </div>
        <SiteHeader workspaceId={workspaceId} config={config} path={path} mode={mode} />
        <main id="site-main">
          {localeAvailable ? (
            <SiteRoute workspaceId={workspaceId} path={path} config={config} mode={mode} />
          ) : (
            <LocaleUnavailable workspaceId={workspaceId} defaultLocale={snapshot.defaultLocale} />
          )}
        </main>
        <SiteFooter workspaceId={workspaceId} config={config} mode={mode} />
      </div>
    </FrontLocaleContext.Provider>
  );
}

function LocaleUnavailable({
  workspaceId,
  defaultLocale
}: {
  workspaceId: WorkspaceId;
  defaultLocale: Locale;
}) {
  const t = useFrontT();
  const locale = useFrontLocale();
  return (
    <section className="not-found">
      <span>LANG</span>
      <h1>{t('This page is outside the orbit.')}</h1>
      <p>
        {locale === 'zh-CN'
          ? '该语言版本尚未经过审核并发布。'
          : 'This locale has not been reviewed and published.'}
      </p>
      <Link className="front-button" href={`/site/${workspaceId}/${defaultLocale}/`}>
        {t('Return home')}
      </Link>
    </section>
  );
}

function SiteHeader({
  workspaceId,
  config,
  path,
  mode
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  path: string;
  mode: 'published' | 'draft';
}) {
  const [open, setOpen] = useState(false);
  const locale = useFrontLocale();
  const t = useFrontT();
  const base = `/site/${workspaceId}`;
  const localeHref = (target: Locale) =>
    mode === 'draft'
      ? `${base}/preview/draft/${target}${path === '/' ? '/' : path}`
      : `${base}/${target}${path === '/' ? '/' : path}`;
  const navigationPages = config.pages.filter(
    (page) =>
      page.id !== 'home' &&
      page.id !== 'contact' &&
      page.visible &&
      (mode === 'draft' || page.status === 'PUBLISHED') &&
      (page.id !== 'insights' || config.modules.insights) &&
      (page.id !== 'assets' || config.modules.assets)
  );
  return (
    <header className="site-header">
      <Link href={`${base}/`} className="site-logo">
        <span>
          {config.brandName
            .split(' ')
            .slice(0, 2)
            .map((word) => word[0])
            .join('')}
        </span>
        <strong>{config.brandName}</strong>
      </Link>
      <button
        className="site-menu"
        aria-label={t('Menu')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t('Menu')}
      </button>
      <nav
        className={open ? 'is-open' : ''}
        aria-label={t('Website navigation')}
        onClickCapture={() => setOpen(false)}
      >
        {navigationPages.map((page) => (
          <Link key={page.id} href={`${base}${page.path}`}>
            {frontNavigationLabel(page.id, page.title, t)}
          </Link>
        ))}
        <Link className="site-nav-cta" href={`${base}/contact`}>
          {t('Contact us')}
        </Link>
        {config.modules.portal && <Link href={`${base}/portal`}>{t('My account')}</Link>}
        <span className="site-locale-switch" aria-label={t('Language')}>
          <Link aria-current={locale === 'zh-CN' ? 'page' : undefined} href={localeHref('zh-CN')}>
            中文
          </Link>
          <Link aria-current={locale === 'en-US' ? 'page' : undefined} href={localeHref('en-US')}>
            English
          </Link>
        </span>
      </nav>
    </header>
  );
}

function SiteRoute({
  workspaceId,
  path,
  config,
  mode
}: {
  workspaceId: WorkspaceId;
  path: string;
  config: SiteConfig;
  mode: 'published' | 'draft';
}) {
  const parts = path.split('/').filter(Boolean);
  const pageFor = (pagePath: string) => config.pages.find((page) => page.path === pagePath);
  const mayVisit = (pagePath: string) => {
    const page = pageFor(pagePath);
    return Boolean(page && (mode === 'draft' || (page.visible && page.status === 'PUBLISHED')));
  };
  const notFound = <NotFound workspaceId={workspaceId} />;
  if (path === '/' && !mayVisit('/')) return notFound;
  if (path === '/') return <Home workspaceId={workspaceId} config={config} />;
  if (path === '/services' && !mayVisit('/services')) return notFound;
  if (path === '/services') return <ServiceDirectory workspaceId={workspaceId} config={config} />;
  if (parts[0] === 'services' && parts[1] && !mayVisit('/services')) return notFound;
  if (parts[0] === 'services' && parts[1])
    return (
      <ServiceDetail
        workspaceId={workspaceId}
        config={config}
        serviceId={parts[1]}
        {...(parts[3] ? { sourceContentId: parts[3] } : {})}
      />
    );
  if (
    (path === '/insights' || parts[0] === 'insights') &&
    (!mayVisit('/insights') || !config.modules.insights)
  )
    return notFound;
  if (path === '/insights')
    return <Insights workspaceId={workspaceId} config={config} mode={mode} />;
  if (parts[0] === 'insights' && parts[1])
    return <Article workspaceId={workspaceId} config={config} slug={parts[1]} mode={mode} />;
  if (path === '/assets' && mayVisit('/assets') && config.modules.assets)
    return <Assets workspaceId={workspaceId} />;
  if (parts[0] === 'contact' && !mayVisit('/contact')) return notFound;
  if (parts[0] === 'contact')
    return (
      <Inquiry
        workspaceId={workspaceId}
        config={config}
        {...(parts[2] && !parts[2].startsWith('asset-') ? { sourceContentId: parts[2] } : {})}
        {...(parts[2]?.startsWith('asset-') ? { sourceAssetId: parts[2] } : {})}
        {...(parts[4] ? { sourceServiceId: parts[4] } : {})}
      />
    );
  if (path === '/portal' && config.modules.portal) return <Portal />;
  if (path === '/privacy') return <Policy kind="privacy" config={config} />;
  if (path === '/terms') return <Policy kind="terms" config={config} />;
  return <NotFound workspaceId={workspaceId} />;
}

function Home({ workspaceId, config }: { workspaceId: WorkspaceId; config: SiteConfig }) {
  const base = `/site/${workspaceId}`;
  const t = useFrontT();
  const blocks = config.blocks.filter(
    (block) => block.visible && (block.kind !== 'insights' || config.modules.insights)
  );
  return (
    <>
      {blocks.map((block) => {
        if (block.kind === 'hero' && config.template === 'exchange')
          return (
            <section className="exchange-hero" key={block.id} data-block-id={block.id}>
              <div className="exchange-index">
                FBE
                <br />
                /01
              </div>
              <div>
                <p className="front-eyebrow">{t('Brand assets / professional support / global')}</p>
                <h1>{block.title}</h1>
                <p className="front-lead">{block.body}</p>
                <div className="front-actions">
                  {config.modules.assets && (
                    <Link className="front-button" href={`${base}/assets`}>
                      {t('Explore demo assets')}
                    </Link>
                  )}
                  <Link className="front-button ghost" href={`${base}/services`}>
                    {t('View advisory services')}
                  </Link>
                </div>
              </div>
              <div className="asset-orbit">
                <span>VERA</span>
                <small>{t('Demo word mark')}</small>
              </div>
            </section>
          );
        if (block.kind === 'hero')
          return (
            <section className="counsel-hero" key={block.id} data-block-id={block.id}>
              <div>
                <p className="front-eyebrow">
                  {t('Independent trademark guidance')} · {t(config.market)}
                </p>
                <h1>{block.title}</h1>
                <p className="front-lead">{block.body}</p>
                <div className="front-actions">
                  <Link className="front-button" href={`${base}/contact`}>
                    {t('Discuss your next move')}
                  </Link>
                  <Link className="front-text-link" href={`${base}/services`}>
                    {t('Explore services')} <span>↗</span>
                  </Link>
                </div>
                <div className="hero-note">
                  <span>01</span>
                  <p>{t('No order or filing begins without an explicit, reviewable next step.')}</p>
                </div>
              </div>
              <div className="hero-art" aria-label="Abstract portfolio planning illustration">
                <div className="art-grid" />
                <div className="art-card card-one">
                  <small>MARKETS</small>
                  <strong>US · EU · UK</strong>
                </div>
                <div className="art-card card-two">
                  <small>DECISION MAP</small>
                  <strong>Evidence → Review</strong>
                </div>
                <div className="art-seal">A</div>
              </div>
            </section>
          );
        if (block.kind === 'proof' && config.template === 'exchange')
          return (
            <div key={block.id} data-block-id={block.id}>
              <section className="marquee" aria-label="Demo disclaimer">
                {t(
                  'DEMO LISTINGS · RIGHTS NOT VERIFIED · REVIEW BEFORE TRANSACTION · DEMO LISTINGS'
                )}
              </section>
              <section className="exchange-statement">
                <p>01 / OUR APPROACH</p>
                <h2>{block.title}</h2>
                <p>{block.body}</p>
              </section>
            </div>
          );
        if (block.kind === 'proof')
          return (
            <section className="counsel-proof" key={block.id} data-block-id={block.id}>
              <p className="front-eyebrow">{t('A counsel-led approach')}</p>
              <h2>{block.title}</h2>
              <p>{block.body}</p>
              <dl>
                <div>
                  <dt>01</dt>
                  <dd>{t('Business intent first')}</dd>
                </div>
                <div>
                  <dt>02</dt>
                  <dd>{t('Evidence in context')}</dd>
                </div>
                <div>
                  <dt>03</dt>
                  <dd>{t('Explicit authority')}</dd>
                </div>
              </dl>
            </section>
          );
        if (block.kind === 'services')
          return (
            <ServiceStrip
              key={block.id}
              workspaceId={workspaceId}
              config={config}
              title={block.title}
            />
          );
        if (block.kind === 'insights')
          return (
            <InsightStrip
              key={block.id}
              workspaceId={workspaceId}
              config={config}
              title={block.title}
            />
          );
        return <FrontCta key={block.id} workspaceId={workspaceId} block={block} />;
      })}
    </>
  );
}

function ServiceStrip({
  workspaceId,
  config,
  title
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  title?: string;
}) {
  const t = useFrontT();
  const visible = config.services.filter((service) => service.visible);
  return (
    <section className="front-section">
      <div className="front-section-head">
        <div>
          <p className="front-eyebrow">{t('Services')}</p>
          <h2>{title ?? t('Ways we can help')}</h2>
        </div>
        <Link className="front-text-link" href={`/site/${workspaceId}/services`}>
          {t('See all services →')}
        </Link>
      </div>
      <div className="front-service-grid">
        {visible.map((service, index) => (
          <Link
            href={`/site/${workspaceId}/services/${service.id}`}
            className="front-service-card"
            key={service.id}
          >
            <span className="service-number">0{index + 1}</span>
            <h3>{service.title}</h3>
            <p>{service.summary}</p>
            <small>{service.markets.map(t).join(' · ')}</small>
            <b>{t('Explore service ↗')}</b>
          </Link>
        ))}
      </div>
    </section>
  );
}

function InsightStrip({
  workspaceId,
  config,
  title
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  title?: string;
}) {
  const t = useFrontT();
  if (!config.modules.insights) return null;
  return (
    <section className="front-section insight-section">
      <div className="front-section-head">
        <div>
          <p className="front-eyebrow">{t('Reviewed insights')}</p>
          <h2>{title ?? 'Ideas for the decisions ahead'}</h2>
        </div>
        <Link className="front-text-link" href={`/site/${workspaceId}/insights`}>
          {t('Browse insights →')}
        </Link>
      </div>
      <div className="insight-grid">
        {config.content
          .filter((item) => item.status === 'PUBLISHED')
          .map((item, index) => (
            <Link
              key={item.id}
              className="insight-card"
              href={`/site/${workspaceId}/insights/${item.slug}`}
            >
              <div className={`insight-art art-${index + 1}`}>
                <span>{index === 0 ? 'MAP' : 'VIEW'}</span>
              </div>
              <p className="front-eyebrow">{t('Strategy · 6 min')}</p>
              <h3>{item.title}</h3>
              <p>{item.excerpt}</p>
            </Link>
          ))}
      </div>
    </section>
  );
}

function FrontCta({
  workspaceId,
  block
}: {
  workspaceId: WorkspaceId;
  block: SiteConfig['blocks'][number];
}) {
  const t = useFrontT();
  return (
    <section className="front-cta">
      <p className="front-eyebrow">{t('Start with context')}</p>
      <h2>{block.title}</h2>
      <p>{block.body}</p>
      <Link className="front-button light" href={`/site/${workspaceId}/contact`}>
        {t('Start an inquiry')}
      </Link>
    </section>
  );
}

function ServiceDirectory({
  workspaceId,
  config
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
}) {
  const t = useFrontT();
  const [market, setMarket] = useState('All');
  const markets = ['All', ...new Set(config.services.flatMap((item) => item.markets))];
  const visible = config.services.filter(
    (item) => item.visible && (market === 'All' || item.markets.includes(market))
  );
  return (
    <>
      <FrontTitle
        eyebrow={t('Services')}
        title={t('Move from a business question to a reviewable plan.')}
        copy={t(
          'Explore owner-backed service references. Availability, professional scope, fees, and any final Quote require a separate governed review.'
        )}
      />
      <section className="front-section">
        <div className="filter-bar" role="group" aria-label={t('Filter services by market')}>
          {markets.map((item) => (
            <button
              key={item}
              className={market === item ? 'is-active' : ''}
              onClick={() => setMarket(item)}
            >
              {item === 'All' ? t('All') : item}
            </button>
          ))}
        </div>
        <div className="service-directory">
          {visible.map((service, index) => (
            <Link
              key={service.id}
              className="service-directory-row"
              href={`/site/${workspaceId}/services/${service.id}`}
            >
              <span>0{index + 1}</span>
              <div>
                <h2>{service.title}</h2>
                <p>{service.summary}</p>
              </div>
              <small>{service.markets.map(t).join(' · ')}</small>
              <b>↗</b>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function ServiceDetail({
  workspaceId,
  config,
  serviceId,
  sourceContentId
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  serviceId: string;
  sourceContentId?: string;
}) {
  const t = useFrontT();
  const service = config.services.find((item) => item.id === serviceId && item.visible);
  if (!service) return <NotFound workspaceId={workspaceId} />;
  const contact = sourceContentId
    ? `/site/${workspaceId}/contact/source/${sourceContentId}/service/${service.id}`
    : `/site/${workspaceId}/contact/source/service/service/${service.id}`;
  return (
    <>
      <section className="service-detail-hero">
        <p className="front-eyebrow">
          Service · {service.productRef} · v{service.version}
        </p>
        <h1>{service.title}</h1>
        <p className="front-lead">{service.summary}</p>
        <div className="front-actions">
          <Link className="front-button" href={contact}>
            {t('Ask about this service')}
          </Link>
          <Link className="front-text-link" href={`/site/${workspaceId}/services`}>
            {t('Back to services')}
          </Link>
        </div>
      </section>
      <section className="detail-grid">
        <article>
          <h2>{t('What this can include')}</h2>
          <ul>
            <li>{t('Business goals, market timing, ownership and use context')}</li>
            <li>{t('Relevant goods and services and a reviewable class approach')}</li>
            <li>{t('Evidence gaps, dependencies, risks, and decision points')}</li>
            <li>{t('An explicit next step before any formal instruction')}</li>
          </ul>
          <h2>{t('A clear working sequence')}</h2>
          <ol className="process-list">
            <li>
              <span>01</span>
              <div>
                <strong>{t('Scope the question')}</strong>
                <p>{t('Share the business context and the decision you need to make.')}</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>{t('Review evidence')}</strong>
                <p>{t('A qualified professional examines assumptions, sources, and gaps.')}</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>{t('Confirm the path')}</strong>
                <p>{t('Review scope and any governed Quote before an order or formal action.')}</p>
              </div>
            </li>
          </ol>
        </article>
        <aside>
          <div className="detail-aside">
            <p className="front-eyebrow">{t('Markets')}</p>
            <strong>{service.markets.map(t).join(', ')}</strong>
            <hr />
            <p className="front-eyebrow">{t('Fee explanation')}</p>
            <strong>{service.feeNote}</strong>
            <hr />
            <p className="front-eyebrow">{t('Demo boundary')}</p>
            <span>
              {t(
                'This page does not guarantee availability, verify a provider, publish a final Quote, or authorize filing.'
              )}
            </span>
          </div>
        </aside>
      </section>
    </>
  );
}

function Insights({
  workspaceId,
  config,
  mode = 'published'
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  mode?: 'published' | 'draft';
}) {
  const t = useFrontT();
  const published = config.content.filter(
    (item) => mode === 'draft' || item.status === 'PUBLISHED'
  );
  return (
    <>
      <FrontTitle
        eyebrow={t('Insights')}
        title={t('Useful context for consequential brand decisions.')}
        copy={t(
          'Reviewed demo content connects practical questions to an explicit professional-service next step.'
        )}
      />
      <section className="front-section">
        <div className="article-list">
          {published.map((item, index) => (
            <Link
              key={item.id}
              href={`/site/${workspaceId}/insights/${item.slug}`}
              className="article-row"
            >
              <div className={`article-thumbnail art-${index + 1}`}>{index + 1}</div>
              <div>
                <p className="front-eyebrow">Strategy · Demo package v{item.version}</p>
                <h2>{item.title}</h2>
                <p>{item.excerpt}</p>
                <strong>{t('Read article →')}</strong>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function Article({
  workspaceId,
  config,
  slug,
  mode = 'published'
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  slug: string;
  mode?: 'published' | 'draft';
}) {
  const t = useFrontT();
  const locale = useFrontLocale();
  const article = config.content.find(
    (item) => item.slug === slug && (mode === 'draft' || item.status === 'PUBLISHED')
  );
  if (!article) return <NotFound workspaceId={workspaceId} />;
  const service = config.services.find((item) => item.id === article.relatedServiceId);
  return (
    <article className="article-detail">
      <header>
        <p className="front-eyebrow">
          Strategy · Reviewed demo content · {article.packageRef} v{article.version}
        </p>
        <h1>{article.title}</h1>
        <p className="front-lead">{article.excerpt}</p>
        <div className="byline">
          <span className="lead-avatar">{workspaceId === 'foundry' ? 'FE' : 'AC'}</span>
          <span>
            <strong>{config.localized[locale].authorName}</strong>
            <small>{t('Demo authorship')} · 2026-09-25</small>
          </span>
        </div>
      </header>
      <div className="article-body">
        <aside>
          {t('In this note')}
          <br />
          <a href="#context">{t('Context')}</a>
          <a href="#questions">{t('Questions')}</a>
          <a href="#next">{t('Next step')}</a>
        </aside>
        <div>
          <div className="article-hero-art">DECISION / MAP / 01</div>
          <p id="context">{article.body}</p>
          <h2 id="questions">{t('Questions worth carrying into review')}</h2>
          <p>
            {t(
              'Which markets support the current commercial plan? Who owns the mark and the relevant evidence? Which products or services matter now, and which may matter later? What remains an assumption rather than a verified fact?'
            )}
          </p>
          <blockquote>
            {t(
              'Good decisions preserve the difference between an early signal, reviewed evidence, a professional recommendation, and an authorized formal action.'
            )}
          </blockquote>
          <h2 id="next">{t('Connect the insight to a next step')}</h2>
          <p>
            {t(
              'The related service below can help structure the question. It does not imply that a provider is available or appointed.'
            )}
          </p>
          {service && (
            <Link
              className="related-service"
              href={`/site/${workspaceId}/services/${service.id}/from/${article.id}`}
            >
              <span className="front-eyebrow">{t('Related service')}</span>
              <strong>{service.title}</strong>
              <span>{service.summary}</span>
              <b>{t('Explore and inquire →')}</b>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function Assets({ workspaceId }: { workspaceId: WorkspaceId }) {
  const t = useFrontT();
  const assets = [
    {
      id: 'asset-vera-north',
      name: 'VERA NORTH',
      class: '03 / 025',
      note: 'Demo presentation record'
    },
    {
      id: 'asset-common-field',
      name: 'COMMON FIELD',
      class: '09 / 042',
      note: 'Rights and availability unverified'
    },
    { id: 'asset-aurelia', name: 'AURELIA', class: '035', note: 'Fictional transaction fixture' }
  ];
  return (
    <>
      <FrontTitle
        eyebrow={t('Brand assets')}
        title={t('Explore the story. Review the evidence.')}
        copy={t(
          'Every item is a fictional demo. Presentation material is separated from trademark rights, ownership, valuation, and transaction facts.'
        )}
      />
      <section className="front-section">
        <div className="asset-grid">
          {assets.map((asset, index) => (
            <article key={asset.name} className={`asset-card asset-${index + 1}`}>
              <div className="asset-visual">
                <span>{asset.name}</span>
              </div>
              <p className="front-eyebrow">{asset.class}</p>
              <h2>{asset.name}</h2>
              <p>{asset.note}</p>
              <Link
                className="front-text-link"
                href={`/site/${workspaceId}/contact/source/${asset.id}/service/svc-asset-review`}
              >
                {t('Request a governed review →')}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

interface InquiryData {
  serviceId: string;
  market: string;
  name: string;
  email: string;
  company: string;
  message: string;
}
function Inquiry({
  workspaceId,
  config,
  sourceContentId,
  sourceServiceId,
  sourceAssetId
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  sourceContentId?: string;
  sourceServiceId?: string;
  sourceAssetId?: string;
}) {
  const store = usePreviewStore();
  const t = useFrontT();
  const locale = useFrontLocale();
  const services = config.services.filter((item) => item.visible);
  const initialService =
    services.find((item) => item.id === sourceServiceId)?.id ?? services[0]?.id ?? '';
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState<DemoLead>();
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<InquiryData>({
    serviceId: initialService,
    market: config.market,
    name: '',
    email: '',
    company: '',
    message: ''
  });
  const labels = [t('Your need'), t('Contact details'), t('Review')];
  const validate = () => {
    const next: Record<string, string> = {};
    if (step === 0 && !data.serviceId) next.serviceId = t('Choose a service.');
    if (step === 0 && !data.market.trim()) next.market = t('Enter a market.');
    if (step === 1 && !data.name.trim()) next.name = t('Enter your name.');
    if (step === 1 && !/^\S+@\S+\.\S+$/u.test(data.email))
      next.email = t('Enter a valid email address.');
    if (step === 1 && data.message.trim().length < 12)
      next.message = t('Add at least 12 characters of context.');
    setErrors(next);
    return !Object.keys(next).length;
  };
  const next = (event: FormEvent) => {
    event.preventDefault();
    if (validate()) setStep((value) => Math.min(2, value + 1));
  };
  if (submitted)
    return (
      <section className="confirmation">
        <span className="confirmation-mark">✓</span>
        <p className="front-eyebrow">{t('Demo inquiry recorded')}</p>
        <h1>
          {locale === 'zh-CN' ? `谢谢你，${submitted.name}。` : `Thank you, ${submitted.name}.`}
        </h1>
        <p>
          Your demo reference is <strong>{submitted.id}</strong>. No email, Customer, Quote, Order,
          Payment, Matter, provider action, or filing was created.
        </p>
        <div className="confirmation-card">
          <span>{t('Workspace')}</span>
          <strong>{submitted.workspaceId}</strong>
          <span>{t('Site')}</span>
          <strong>{submitted.siteId}</strong>
          <span>{t('Source')}</span>
          <strong>
            {submitted.sourceContentId ?? submitted.sourceAssetId ?? submitted.sourcePath}
          </strong>
        </div>
        <div className="front-actions">
          <Link className="front-button" href={`/admin/${workspaceId}/leads/${submitted.id}`}>
            {t('Find this lead in Site Admin')}
          </Link>
          <Link className="front-button ghost" href={`/site/${workspaceId}/`}>
            {t('Return home')}
          </Link>
        </div>
      </section>
    );
  return (
    <section className="inquiry-layout">
      <div className="inquiry-intro">
        <p className="front-eyebrow">{t('Demo inquiry')}</p>
        <h1>{t('Tell us what decision is ahead.')}</h1>
        <p className="front-lead">
          {t(
            'Share enough context for a useful next step. This preview stores the fixture only in your browser.'
          )}
        </p>
        {sourceContentId && (
          <div className="source-chip">
            Source preserved: <strong>{sourceContentId}</strong>
          </div>
        )}
        {sourceAssetId && (
          <div className="source-chip">
            Asset context preserved: <strong>{sourceAssetId}</strong>
          </div>
        )}
        <ol className="inquiry-steps">
          {labels.map((label, index) => (
            <li
              className={index === step ? 'is-current' : index < step ? 'is-done' : ''}
              key={label}
            >
              <span>{index < step ? '✓' : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </div>
      <form className="inquiry-form" onSubmit={next} noValidate>
        {step === 0 && (
          <>
            <h2>{t('What can we help with?')}</h2>
            <Select
              label={t('Service')}
              value={data.serviceId}
              error={errors.serviceId}
              onChange={(event) => setData({ ...data, serviceId: event.target.value })}
            >
              <option value="">{t('Choose a service')}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.title}
                </option>
              ))}
            </Select>
            <TextInput
              label={t('Priority market or region')}
              value={data.market}
              error={errors.market}
              onChange={(event) => setData({ ...data, market: event.target.value })}
            />
            <div className="scope-note">
              <strong>{t('What this does')}</strong>
              <p>{t('Records a demo request with exact Site and source attribution.')}</p>
              <strong>{t('What this does not do')}</strong>
              <p>
                {t('It does not create a Quote, Order, Payment, Matter, appointment, or filing.')}
              </p>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2>{t('How should the team respond?')}</h2>
            <div className="two-fields">
              <TextInput
                label={t('Your name')}
                value={data.name}
                error={errors.name}
                onChange={(event) => setData({ ...data, name: event.target.value })}
              />
              <TextInput
                label={t('Organization')}
                value={data.company}
                onChange={(event) => setData({ ...data, company: event.target.value })}
              />
            </div>
            <TextInput
              label={t('Work email')}
              type="email"
              value={data.email}
              error={errors.email}
              onChange={(event) => setData({ ...data, email: event.target.value })}
            />
            <TextArea
              label={t('What are you trying to decide?')}
              rows={6}
              value={data.message}
              error={errors.message}
              onChange={(event) => setData({ ...data, message: event.target.value })}
            />
          </>
        )}
        {step === 2 && (
          <>
            <h2>{t('Review your demo inquiry')}</h2>
            <dl className="review-list">
              <div>
                <dt>{t('Service')}</dt>
                <dd>{services.find((item) => item.id === data.serviceId)?.title}</dd>
              </div>
              <div>
                <dt>{t('Market')}</dt>
                <dd>{data.market}</dd>
              </div>
              <div>
                <dt>{t('Contact')}</dt>
                <dd>
                  {data.name} · {data.email}
                </dd>
              </div>
              <div>
                <dt>{t('Organization')}</dt>
                <dd>{data.company || t('Not provided')}</dd>
              </div>
              <div>
                <dt>{t('Context')}</dt>
                <dd>{data.message}</dd>
              </div>
              <div>
                <dt>{t('Source')}</dt>
                <dd>{sourceContentId ?? sourceAssetId ?? '/contact'}</dd>
              </div>
            </dl>
            <label className="consent">
              <input
                required
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  setErrors((current) => ({ ...current, consent: '' }));
                }}
              />{' '}
              <span>
                {t(
                  'I understand this creates only a browser-local demo lead and does not request a real professional service.'
                )}
              </span>
            </label>
            {errors.consent && <p className="field-error">Error: {errors.consent}</p>}
          </>
        )}
        <div className="form-actions">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => setStep((value) => value - 1)}>
              {t('Back')}
            </Button>
          )}
          {step < 2 ? (
            <Button type="submit">{t('Continue')}</Button>
          ) : (
            <Button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (!consent) {
                  setErrors((current) => ({
                    ...current,
                    consent: t('Confirm the demo-only consent before submitting.')
                  }));
                  return;
                }
                if (submitting || submitted) return;
                setSubmitting(true);
                const lead = store.submitLead(workspaceId, {
                  name: data.name,
                  email: data.email,
                  company: data.company,
                  market: data.market,
                  serviceId: data.serviceId,
                  message: data.message,
                  sourcePath: window.location.pathname,
                  ...(sourceContentId && sourceContentId !== 'service' ? { sourceContentId } : {}),
                  ...(sourceAssetId ? { sourceAssetId } : {})
                });
                setSubmitted(lead);
              }}
            >
              {t('Submit demo inquiry')}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

function Portal() {
  const t = useFrontT();
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [found, setFound] = useState(false);
  return (
    <section className="portal-page">
      <p className="front-eyebrow">{t('Customer center demo')}</p>
      <h1>{t('Check progress with your reference.')}</h1>
      <p>{t('This is a non-production demonstration. Try DEMO-REQ-1027.')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (reference !== 'DEMO-REQ-1027') {
            setError(t('That demo reference was not found.'));
            setFound(false);
          } else {
            setError('');
            setFound(true);
          }
        }}
      >
        <TextInput
          label={t('Demo request reference')}
          value={reference}
          error={error}
          onChange={(event) => setReference(event.target.value)}
        />
        <Button>{t('Check status')}</Button>
      </form>
      {found && (
        <div className="portal-result" role="status">
          <span>DEMO-REQ-1027</span>
          <h2>{t('Information review')}</h2>
          <p>
            {t(
              'The demo team is reviewing customer-supplied information. No official status or external filing fact is represented.'
            )}
          </p>
          <ol>
            <li className="done">{t('Request received')}</li>
            <li className="current">{t('Information review')}</li>
            <li>{t('Next step confirmation')}</li>
          </ol>
        </div>
      )}
    </section>
  );
}

function Policy({ kind, config }: { kind: 'privacy' | 'terms'; config: SiteConfig }) {
  const locale = useFrontLocale();
  const t = useFrontT();
  const legal = config.localized[locale].legal;
  const title = kind === 'privacy' ? legal.privacyTitle : legal.termsTitle;
  const body = kind === 'privacy' ? legal.privacyBody : legal.termsBody;
  return (
    <article className="policy-page">
      <p className="front-eyebrow">{t('Demo legal information')}</p>
      <h1>{title}</h1>
      <p>{body}</p>
      <h2>{t('Local demo data')}</h2>
      <p>
        {locale === 'zh-CN'
          ? '草稿、发布快照与咨询 fixture 均保存在当前浏览器，可在站点后台明确重置。'
          : 'Drafts, published snapshots, and inquiry fixtures remain in this browser and can be explicitly reset from Site Admin.'}
      </p>
      <h2>{t('No protected action')}</h2>
      <p>
        {locale === 'zh-CN'
          ? '不会执行付款、邮件、域名更新、订单、申请、委托或任何生产流程。'
          : 'No payment, email, domain update, order, filing, appointment, or production workflow is executed.'}
      </p>
    </article>
  );
}

function NotFound({ workspaceId }: { workspaceId: WorkspaceId }) {
  const t = useFrontT();
  return (
    <section className="not-found">
      <span>404</span>
      <h1>{t('This page is outside the orbit.')}</h1>
      <p>{t("The route is not part of this Site's published demo.")}</p>
      <Link className="front-button" href={`/site/${workspaceId}/`}>
        {t('Return home')}
      </Link>
    </section>
  );
}

function FrontTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <section className="front-title">
      <p className="front-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="front-lead">{copy}</p>
    </section>
  );
}

function SiteFooter({
  workspaceId,
  config,
  mode
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  mode: 'published' | 'draft';
}) {
  const base = `/site/${workspaceId}`;
  const t = useFrontT();
  const mayLink = (pageId: string) => {
    const page = config.pages.find((item) => item.id === pageId);
    return Boolean(page?.visible && (mode === 'draft' || page.status === 'PUBLISHED'));
  };
  return (
    <footer className="site-footer">
      <div>
        <Link href={`${base}/`} className="site-logo">
          <span>{config.brandName.slice(0, 1)}</span>
          <strong>{config.brandName}</strong>
        </Link>
        <p>{config.tagline}</p>
      </div>
      <div>
        <strong>{t('Explore')}</strong>
        {mayLink('services') && <Link href={`${base}/services`}>{t('Services')}</Link>}
        {mayLink('insights') && config.modules.insights && (
          <Link href={`${base}/insights`}>{t('Articles')}</Link>
        )}
        {mayLink('assets') && config.modules.assets && (
          <Link href={`${base}/assets`}>{t('Trademark showcase')}</Link>
        )}
        {mayLink('contact') && <Link href={`${base}/contact`}>{t('Contact us')}</Link>}
        {config.modules.portal && <Link href={`${base}/portal`}>{t('My account')}</Link>}
      </div>
      <div>
        <strong>{t('Information')}</strong>
        <Link href={`${base}/privacy`}>{t('Privacy')}</Link>
        <Link href={`${base}/terms`}>{t('Terms')}</Link>
        <Link href={`/admin/${workspaceId}/overview`}>{t('Site Admin')}</Link>
      </div>
      <div className="footer-demo">
        <strong>DEMO / {config.locale}</strong>
        <p>
          {t(
            'All names, testimonials, prices, assets, qualifications, outcomes, and transactions are fictional.'
          )}
        </p>
      </div>
    </footer>
  );
}
