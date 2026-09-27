import { useState, type FormEvent } from 'react';
import { Button, Select, TextArea, TextInput } from '@markorbit/ui';
import type { DemoLead, SiteConfig, WorkspaceId } from './domain.js';
import { usePreviewStore } from './store.js';
import { Link } from './router.js';

export function SiteFront({ workspaceId, path }: { workspaceId: WorkspaceId; path: string }) {
  const workspace = usePreviewStore().workspaces[workspaceId];
  const config = workspace.published;
  return (
    <div
      className={`site-front site-template-${config.template}`}
      style={
        { '--site-primary': config.primary, '--site-accent': config.accent } as React.CSSProperties
      }
    >
      <div className="front-demo-bar">
        <strong>DEMO SITE</strong>
        <span>Fictional content · no real quote, order, payment, filing, or submission</span>
        <Link href={`/admin/${workspaceId}/overview`}>Open Site Admin</Link>
      </div>
      <SiteHeader workspaceId={workspaceId} config={config} />
      <main id="site-main">
        <SiteRoute workspaceId={workspaceId} path={path} config={config} />
      </main>
      <SiteFooter workspaceId={workspaceId} config={config} />
    </div>
  );
}

function SiteHeader({ workspaceId, config }: { workspaceId: WorkspaceId; config: SiteConfig }) {
  const [open, setOpen] = useState(false);
  const base = `/site/${workspaceId}`;
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
        aria-label="Toggle site navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Menu
      </button>
      <nav className={open ? 'is-open' : ''} aria-label="Customer Site">
        {config.pages
          .filter((page) => page.visible && page.id !== 'home')
          .map((page) => (
            <Link key={page.id} href={`${base}${page.path}`}>
              {page.title}
            </Link>
          ))}
        {config.modules.portal && <Link href={`${base}/portal`}>Client service</Link>}
        <Link className="site-nav-cta" href={`${base}/contact`}>
          Start an inquiry
        </Link>
      </nav>
    </header>
  );
}

function SiteRoute({
  workspaceId,
  path,
  config
}: {
  workspaceId: WorkspaceId;
  path: string;
  config: SiteConfig;
}) {
  const parts = path.split('/').filter(Boolean);
  if (path === '/') return <Home workspaceId={workspaceId} config={config} />;
  if (path === '/services') return <ServiceDirectory workspaceId={workspaceId} config={config} />;
  if (parts[0] === 'services' && parts[1])
    return (
      <ServiceDetail
        workspaceId={workspaceId}
        config={config}
        serviceId={parts[1]}
        {...(parts[3] ? { sourceContentId: parts[3] } : {})}
      />
    );
  if (path === '/insights') return <Insights workspaceId={workspaceId} config={config} />;
  if (parts[0] === 'insights' && parts[1])
    return <Article workspaceId={workspaceId} config={config} slug={parts[1]} />;
  if (path === '/assets' && config.modules.assets) return <Assets workspaceId={workspaceId} />;
  if (parts[0] === 'contact')
    return (
      <Inquiry
        workspaceId={workspaceId}
        config={config}
        {...(parts[2] ? { sourceContentId: parts[2] } : {})}
        {...(parts[4] ? { sourceServiceId: parts[4] } : {})}
      />
    );
  if (path === '/portal' && config.modules.portal) return <Portal />;
  if (path === '/privacy') return <Policy title="Privacy notice" />;
  if (path === '/terms') return <Policy title="Service terms" />;
  return <NotFound workspaceId={workspaceId} />;
}

function Home({ workspaceId, config }: { workspaceId: WorkspaceId; config: SiteConfig }) {
  const base = `/site/${workspaceId}`;
  const blocks = config.blocks.filter((block) => block.visible);
  const hero = blocks.find((block) => block.kind === 'hero');
  const proof = blocks.find((block) => block.kind === 'proof');
  const services = blocks.find((block) => block.kind === 'services');
  const insights = blocks.find((block) => block.kind === 'insights');
  const cta = blocks.find((block) => block.kind === 'cta');
  if (config.template === 'exchange')
    return (
      <>
        <section className="exchange-hero">
          <div className="exchange-index">
            FBE
            <br />
            /01
          </div>
          <div>
            <p className="front-eyebrow">Brand assets / professional support / global</p>
            <h1>{hero?.title}</h1>
            <p className="front-lead">{hero?.body}</p>
            <div className="front-actions">
              <Link className="front-button" href={`${base}/assets`}>
                Explore demo assets
              </Link>
              <Link className="front-button ghost" href={`${base}/services`}>
                View advisory services
              </Link>
            </div>
          </div>
          <div className="asset-orbit">
            <span>VERA</span>
            <small>Demo word mark</small>
          </div>
        </section>
        <section className="marquee" aria-label="Demo disclaimer">
          DEMO LISTINGS · RIGHTS NOT VERIFIED · REVIEW BEFORE TRANSACTION · DEMO LISTINGS
        </section>
        {proof && (
          <section className="exchange-statement">
            <p>01 / OUR APPROACH</p>
            <h2>{proof.title}</h2>
            <p>{proof.body}</p>
          </section>
        )}
        <ServiceStrip
          workspaceId={workspaceId}
          config={config}
          {...(services?.title ? { title: services.title } : {})}
        />
        <InsightStrip
          workspaceId={workspaceId}
          config={config}
          {...(insights?.title ? { title: insights.title } : {})}
        />
        {cta && <FrontCta workspaceId={workspaceId} block={cta} />}
      </>
    );
  return (
    <>
      <section className="counsel-hero">
        <div>
          <p className="front-eyebrow">Independent trademark guidance · {config.market}</p>
          <h1>{hero?.title}</h1>
          <p className="front-lead">{hero?.body}</p>
          <div className="front-actions">
            <Link className="front-button" href={`${base}/contact`}>
              Discuss your next move
            </Link>
            <Link className="front-text-link" href={`${base}/services`}>
              Explore services <span>↗</span>
            </Link>
          </div>
          <div className="hero-note">
            <span>01</span>
            <p>No order or filing begins without an explicit, reviewable next step.</p>
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
      {proof && (
        <section className="counsel-proof">
          <p className="front-eyebrow">A counsel-led approach</p>
          <h2>{proof.title}</h2>
          <p>{proof.body}</p>
          <dl>
            <div>
              <dt>01</dt>
              <dd>Business intent first</dd>
            </div>
            <div>
              <dt>02</dt>
              <dd>Evidence in context</dd>
            </div>
            <div>
              <dt>03</dt>
              <dd>Explicit authority</dd>
            </div>
          </dl>
        </section>
      )}
      <ServiceStrip
        workspaceId={workspaceId}
        config={config}
        {...(services?.title ? { title: services.title } : {})}
      />
      <InsightStrip
        workspaceId={workspaceId}
        config={config}
        {...(insights?.title ? { title: insights.title } : {})}
      />
      {cta && <FrontCta workspaceId={workspaceId} block={cta} />}
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
  const visible = config.services.filter((service) => service.visible);
  return (
    <section className="front-section">
      <div className="front-section-head">
        <div>
          <p className="front-eyebrow">Services</p>
          <h2>{title ?? 'Ways we can help'}</h2>
        </div>
        <Link className="front-text-link" href={`/site/${workspaceId}/services`}>
          See all services →
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
            <small>{service.markets.join(' · ')}</small>
            <b>Explore service ↗</b>
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
  if (!config.modules.insights) return null;
  return (
    <section className="front-section insight-section">
      <div className="front-section-head">
        <div>
          <p className="front-eyebrow">Reviewed insights</p>
          <h2>{title ?? 'Ideas for the decisions ahead'}</h2>
        </div>
        <Link className="front-text-link" href={`/site/${workspaceId}/insights`}>
          Browse insights →
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
              <p className="front-eyebrow">Strategy · 6 min</p>
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
  return (
    <section className="front-cta">
      <p className="front-eyebrow">Start with context</p>
      <h2>{block.title}</h2>
      <p>{block.body}</p>
      <Link className="front-button light" href={`/site/${workspaceId}/contact`}>
        Start an inquiry
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
  const [market, setMarket] = useState('All');
  const markets = ['All', ...new Set(config.services.flatMap((item) => item.markets))];
  const visible = config.services.filter(
    (item) => item.visible && (market === 'All' || item.markets.includes(market))
  );
  return (
    <>
      <FrontTitle
        eyebrow="Services"
        title="Move from a business question to a reviewable plan."
        copy="Explore owner-backed service references. Availability, professional scope, fees, and any final Quote require a separate governed review."
      />
      <section className="front-section">
        <div className="filter-bar" role="group" aria-label="Filter services by market">
          {markets.map((item) => (
            <button
              key={item}
              className={market === item ? 'is-active' : ''}
              onClick={() => setMarket(item)}
            >
              {item}
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
              <small>{service.markets.join(' · ')}</small>
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
            Ask about this service
          </Link>
          <Link className="front-text-link" href={`/site/${workspaceId}/services`}>
            Back to services
          </Link>
        </div>
      </section>
      <section className="detail-grid">
        <article>
          <h2>What this can include</h2>
          <ul>
            <li>Business goals, market timing, ownership and use context</li>
            <li>Relevant goods and services and a reviewable class approach</li>
            <li>Evidence gaps, dependencies, risks, and decision points</li>
            <li>An explicit next step before any formal instruction</li>
          </ul>
          <h2>A clear working sequence</h2>
          <ol className="process-list">
            <li>
              <span>01</span>
              <div>
                <strong>Scope the question</strong>
                <p>Share the business context and the decision you need to make.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Review evidence</strong>
                <p>A qualified professional examines assumptions, sources, and gaps.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Confirm the path</strong>
                <p>Review scope and any governed Quote before an order or formal action.</p>
              </div>
            </li>
          </ol>
        </article>
        <aside>
          <div className="detail-aside">
            <p className="front-eyebrow">Markets</p>
            <strong>{service.markets.join(', ')}</strong>
            <hr />
            <p className="front-eyebrow">Fee explanation</p>
            <strong>{service.feeNote}</strong>
            <hr />
            <p className="front-eyebrow">Demo boundary</p>
            <span>
              This page does not guarantee availability, verify a provider, publish a final Quote,
              or authorize filing.
            </span>
          </div>
        </aside>
      </section>
    </>
  );
}

function Insights({ workspaceId, config }: { workspaceId: WorkspaceId; config: SiteConfig }) {
  const published = config.content.filter((item) => item.status === 'PUBLISHED');
  return (
    <>
      <FrontTitle
        eyebrow="Insights"
        title="Useful context for consequential brand decisions."
        copy="Reviewed demo content connects practical questions to an explicit professional-service next step."
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
                <strong>Read article →</strong>
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
  slug
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  slug: string;
}) {
  const article = config.content.find((item) => item.slug === slug && item.status === 'PUBLISHED');
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
          <span className="lead-avatar">AC</span>
          <span>
            <strong>Atlas editorial team</strong>
            <small>Demo authorship · updated 25 Sep 2026</small>
          </span>
        </div>
      </header>
      <div className="article-body">
        <aside>
          In this note
          <br />
          <a href="#context">Context</a>
          <a href="#questions">Questions</a>
          <a href="#next">Next step</a>
        </aside>
        <div>
          <div className="article-hero-art">DECISION / MAP / 01</div>
          <p id="context">{article.body}</p>
          <h2 id="questions">Questions worth carrying into review</h2>
          <p>
            Which markets support the current commercial plan? Who owns the mark and the relevant
            evidence? Which products or services matter now, and which may matter later? What
            remains an assumption rather than a verified fact?
          </p>
          <blockquote>
            Good decisions preserve the difference between an early signal, reviewed evidence, a
            professional recommendation, and an authorized formal action.
          </blockquote>
          <h2 id="next">Connect the insight to a next step</h2>
          <p>
            The related service below can help structure the question. It does not imply that a
            provider is available or appointed.
          </p>
          {service && (
            <Link
              className="related-service"
              href={`/site/${workspaceId}/services/${service.id}/from/${article.id}`}
            >
              <span className="front-eyebrow">Related service</span>
              <strong>{service.title}</strong>
              <span>{service.summary}</span>
              <b>Explore and inquire →</b>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function Assets({ workspaceId }: { workspaceId: WorkspaceId }) {
  const assets = [
    { name: 'VERA NORTH', class: '03 / 025', note: 'Demo presentation record' },
    { name: 'COMMON FIELD', class: '09 / 042', note: 'Rights and availability unverified' },
    { name: 'AURELIA', class: '035', note: 'Fictional transaction fixture' }
  ];
  return (
    <>
      <FrontTitle
        eyebrow="Brand assets"
        title="Explore the story. Review the evidence."
        copy="Every item is a fictional demo. Presentation material is separated from trademark rights, ownership, valuation, and transaction facts."
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
              <Link className="front-text-link" href={`/site/${workspaceId}/contact`}>
                Request a governed review →
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
  sourceServiceId
}: {
  workspaceId: WorkspaceId;
  config: SiteConfig;
  sourceContentId?: string;
  sourceServiceId?: string;
}) {
  const store = usePreviewStore();
  const services = config.services.filter((item) => item.visible);
  const initialService =
    services.find((item) => item.id === sourceServiceId)?.id ?? services[0]?.id ?? '';
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState<DemoLead>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<InquiryData>({
    serviceId: initialService,
    market: config.market,
    name: '',
    email: '',
    company: '',
    message: ''
  });
  const labels = ['Your need', 'Contact', 'Review'];
  const validate = () => {
    const next: Record<string, string> = {};
    if (step === 0 && !data.serviceId) next.serviceId = 'Choose a service.';
    if (step === 0 && !data.market.trim()) next.market = 'Enter a market.';
    if (step === 1 && !data.name.trim()) next.name = 'Enter your name.';
    if (step === 1 && !/^\S+@\S+\.\S+$/u.test(data.email))
      next.email = 'Enter a valid email address.';
    if (step === 1 && data.message.trim().length < 12)
      next.message = 'Add at least 12 characters of context.';
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
        <p className="front-eyebrow">Demo inquiry recorded</p>
        <h1>Thank you, {submitted.name}.</h1>
        <p>
          Your demo reference is <strong>{submitted.id}</strong>. No email, Customer, Quote, Order,
          Payment, Matter, provider action, or filing was created.
        </p>
        <div className="confirmation-card">
          <span>Workspace</span>
          <strong>{submitted.workspaceId}</strong>
          <span>Site</span>
          <strong>{submitted.siteId}</strong>
          <span>Source</span>
          <strong>{submitted.sourceContentId ?? submitted.sourcePath}</strong>
        </div>
        <div className="front-actions">
          <Link className="front-button" href={`/admin/${workspaceId}/leads/${submitted.id}`}>
            Find this lead in Site Admin
          </Link>
          <Link className="front-button ghost" href={`/site/${workspaceId}/`}>
            Return home
          </Link>
        </div>
      </section>
    );
  return (
    <section className="inquiry-layout">
      <div className="inquiry-intro">
        <p className="front-eyebrow">Demo inquiry</p>
        <h1>Tell us what decision is ahead.</h1>
        <p className="front-lead">
          Share enough context for a useful next step. This preview stores the fixture only in your
          browser.
        </p>
        {sourceContentId && (
          <div className="source-chip">
            Source preserved: <strong>{sourceContentId}</strong>
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
            <h2>What can we help with?</h2>
            <Select
              label="Service"
              value={data.serviceId}
              error={errors.serviceId}
              onChange={(event) => setData({ ...data, serviceId: event.target.value })}
            >
              <option value="">Choose a service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.title}
                </option>
              ))}
            </Select>
            <TextInput
              label="Priority market or region"
              value={data.market}
              error={errors.market}
              onChange={(event) => setData({ ...data, market: event.target.value })}
            />
            <div className="scope-note">
              <strong>What this does</strong>
              <p>Records a demo request with exact Site and source attribution.</p>
              <strong>What this does not do</strong>
              <p>It does not create a Quote, Order, Payment, Matter, appointment, or filing.</p>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2>How should the team respond?</h2>
            <div className="two-fields">
              <TextInput
                label="Your name"
                value={data.name}
                error={errors.name}
                onChange={(event) => setData({ ...data, name: event.target.value })}
              />
              <TextInput
                label="Organization"
                value={data.company}
                onChange={(event) => setData({ ...data, company: event.target.value })}
              />
            </div>
            <TextInput
              label="Work email"
              type="email"
              value={data.email}
              error={errors.email}
              onChange={(event) => setData({ ...data, email: event.target.value })}
            />
            <TextArea
              label="What are you trying to decide?"
              rows={6}
              value={data.message}
              error={errors.message}
              onChange={(event) => setData({ ...data, message: event.target.value })}
            />
          </>
        )}
        {step === 2 && (
          <>
            <h2>Review your demo inquiry</h2>
            <dl className="review-list">
              <div>
                <dt>Service</dt>
                <dd>{services.find((item) => item.id === data.serviceId)?.title}</dd>
              </div>
              <div>
                <dt>Market</dt>
                <dd>{data.market}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  {data.name} · {data.email}
                </dd>
              </div>
              <div>
                <dt>Organization</dt>
                <dd>{data.company || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Context</dt>
                <dd>{data.message}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{sourceContentId ?? '/contact'}</dd>
              </div>
            </dl>
            <label className="consent">
              <input required type="checkbox" />{' '}
              <span>
                I understand this creates only a browser-local demo lead and does not request a real
                professional service.
              </span>
            </label>
          </>
        )}
        <div className="form-actions">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => setStep((value) => value - 1)}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button type="submit">Continue</Button>
          ) : (
            <Button
              type="button"
              onClick={() =>
                setSubmitted(
                  store.submitLead(workspaceId, {
                    name: data.name,
                    email: data.email,
                    company: data.company,
                    market: data.market,
                    serviceId: data.serviceId,
                    message: data.message,
                    sourcePath: window.location.pathname,
                    ...(sourceContentId && sourceContentId !== 'service' ? { sourceContentId } : {})
                  })
                )
              }
            >
              Submit demo inquiry
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

function Portal() {
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [found, setFound] = useState(false);
  return (
    <section className="portal-page">
      <p className="front-eyebrow">Client service demo</p>
      <h1>Check a request without losing context.</h1>
      <p>
        This is a non-production demonstration. Try <code>DEMO-REQ-1027</code>.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (reference !== 'DEMO-REQ-1027') {
            setError('That demo reference was not found.');
            setFound(false);
          } else {
            setError('');
            setFound(true);
          }
        }}
      >
        <TextInput
          label="Demo request reference"
          value={reference}
          error={error}
          onChange={(event) => setReference(event.target.value)}
        />
        <Button>Check status</Button>
      </form>
      {found && (
        <div className="portal-result" role="status">
          <span>DEMO-REQ-1027</span>
          <h2>Information review</h2>
          <p>
            The demo team is reviewing customer-supplied information. No official status or external
            filing fact is represented.
          </p>
          <ol>
            <li className="done">Request received</li>
            <li className="current">Information review</li>
            <li>Next step confirmation</li>
          </ol>
        </div>
      )}
    </section>
  );
}

function Policy({ title }: { title: string }) {
  return (
    <article className="policy-page">
      <p className="front-eyebrow">Demo legal information</p>
      <h1>{title}</h1>
      <p>Effective for this interactive preview only.</p>
      <h2>Purpose</h2>
      <p>
        This fictional Site demonstrates product behavior. It does not collect or transmit
        production data and is not legal advice.
      </p>
      <h2>Local demo data</h2>
      <p>
        Changes and inquiry fixtures are stored in this browser so the Admin and customer journeys
        can be tested together. Reset them from Site Admin settings.
      </p>
      <h2>No protected action</h2>
      <p>
        No payment, email, domain update, order, filing, appointment, or production workflow is
        executed.
      </p>
    </article>
  );
}

function NotFound({ workspaceId }: { workspaceId: WorkspaceId }) {
  return (
    <section className="not-found">
      <span>404</span>
      <h1>This page is outside the orbit.</h1>
      <p>The route is not part of this Site's published demo.</p>
      <Link className="front-button" href={`/site/${workspaceId}/`}>
        Return home
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

function SiteFooter({ workspaceId, config }: { workspaceId: WorkspaceId; config: SiteConfig }) {
  const base = `/site/${workspaceId}`;
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
        <strong>Explore</strong>
        <Link href={`${base}/services`}>Services</Link>
        <Link href={`${base}/insights`}>Insights</Link>
        <Link href={`${base}/contact`}>Contact</Link>
      </div>
      <div>
        <strong>Information</strong>
        <Link href={`${base}/privacy`}>Privacy</Link>
        <Link href={`${base}/terms`}>Terms</Link>
        <Link href={`/admin/${workspaceId}/overview`}>Site Admin</Link>
      </div>
      <div className="footer-demo">
        <strong>DEMO / {config.locale}</strong>
        <p>
          All names, testimonials, prices, assets, qualifications, outcomes, and transactions are
          fictional.
        </p>
      </div>
    </footer>
  );
}
