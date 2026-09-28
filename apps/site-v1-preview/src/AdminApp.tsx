import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  PageHeader,
  Select,
  TextArea,
  TextInput
} from '@markorbit/ui';
import type {
  AdminSection,
  Block,
  ContentRecord,
  DemoLead,
  SiteConfig,
  Locale,
  WorkspaceId
} from './domain.js';
import { projectLocale } from './domain.js';
import { hasUnpublishedChanges, usePreviewStore } from './store.js';
import { Link, useRouter } from './router.js';
import { useAdminI18n } from './i18n.js';

const nav: { section: AdminSection; label: string; icon: string }[] = [
  { section: 'overview', label: 'Overview', icon: '⌂' },
  { section: 'pages', label: 'Pages', icon: '▤' },
  { section: 'editor', label: 'Design', icon: '✦' },
  { section: 'content', label: 'Articles', icon: '✎' },
  { section: 'services', label: 'Services', icon: '◇' },
  { section: 'leads', label: 'Inquiries', icon: '◎' },
  { section: 'analytics', label: 'Data', icon: '⌁' },
  { section: 'settings', label: 'Settings', icon: '⚙' }
];

const titles: Record<AdminSection, [string, string]> = {
  overview: ['Overview', 'See what needs attention before you publish.'],
  pages: ['Pages', 'Choose which pages visitors can find and the order they appear in.'],
  editor: ['Design', 'Update the homepage, preview the draft, and publish when it is ready.'],
  content: ['Articles', 'Write, review, preview, and publish customer-facing articles.'],
  services: ['Services', 'Update the services visitors can see and understand.'],
  leads: ['Inquiries', 'Read visitor questions and see exactly where each one came from.'],
  'client-service': [
    'Customer progress',
    'Preview the customer progress entry without creating another order or matter record.'
  ],
  analytics: ['Data', 'See which pages and articles led to real browser-local inquiries.'],
  seo: [
    'Domain & search',
    'Check the domain and search preview without changing DNS or submitting to search engines.'
  ],
  settings: ['Settings', 'Manage Site features, languages, and access for this Workspace.']
};

export function AdminApp({
  workspaceId,
  section,
  itemId
}: {
  workspaceId: WorkspaceId;
  section: AdminSection;
  itemId?: string;
}) {
  const store = usePreviewStore();
  const workspace = store.workspaces[workspaceId];
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const { locale, setLocale, t } = useAdminI18n();
  const unpublished = hasUnpublishedChanges(workspace);
  const [title, description] = titles[section];
  const readOnly = workspace.role === 'VIEWER';
  const primarySection =
    section === 'client-service' ? 'leads' : section === 'seo' ? 'settings' : section;

  return (
    <div className="admin-shell">
      <aside className={mobileNav ? 'admin-sidebar is-open' : 'admin-sidebar'}>
        <div className="admin-brand">
          <span className="admin-brand__mark">MO</span>
          <div>
            <strong>MarkOrbit</strong>
            <small>{t('Site management')}</small>
          </div>
        </div>
        <div className="workspace-chip">
          <span>{workspace.workspaceName.slice(0, 1)}</span>
          <div>
            <strong>{workspace.workspaceName}</strong>
            <small>
              {t('Site')} · {t(workspace.lifecycle === 'ACTIVE' ? 'Active' : 'Draft')}
            </small>
          </div>
        </div>
        <nav aria-label={t('Site Admin navigation')} onClickCapture={() => setMobileNav(false)}>
          {nav.map((item) => (
            <Link
              key={item.section}
              href={`/admin/${workspaceId}/${item.section}`}
              className={
                primarySection === item.section ? 'admin-nav-link is-active' : 'admin-nav-link'
              }
              aria-current={primarySection === item.section ? 'page' : undefined}
            >
              <span aria-hidden>{item.icon}</span>
              {t(item.label)}
              {item.section === 'leads' && workspace.leads.length ? (
                <b>{workspace.leads.length}</b>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <span className="demo-dot" /> {t('Demo fixtures only')}
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="mobile-menu"
            aria-label={t('Open navigation')}
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(!mobileNav)}
          >
            ☰
          </button>
          <div>
            <span className="topbar-context">{t('Workspace / Site')}</span>
            <strong>{workspace.draft.brandName}</strong>
          </div>
          <div className="topbar-actions">
            <div
              className="admin-locale-switch"
              role="group"
              aria-label="界面语言 / Interface language"
            >
              <button
                type="button"
                className={locale === 'zh-CN' ? 'is-active' : ''}
                aria-pressed={locale === 'zh-CN'}
                onClick={() => setLocale('zh-CN')}
              >
                简体中文
              </button>
              <button
                type="button"
                className={locale === 'en-US' ? 'is-active' : ''}
                aria-pressed={locale === 'en-US'}
                onClick={() => setLocale('en-US')}
              >
                English
              </button>
            </div>
            <Select
              label={t('Workspace')}
              aria-label={t('Workspace')}
              value={workspaceId}
              onChange={(event) => router.navigate(`/admin/${event.target.value}/${section}`)}
            >
              <option value="atlas">Atlas Counsel</option>
              <option value="foundry">Foundry Exchange</option>
            </Select>
            <Link className="button-link secondary" href={`/site/${workspaceId}/`}>
              {t('View Site')}
            </Link>
            <span className="avatar" aria-label="Demo user">
              MA
            </span>
          </div>
        </header>
        <main id="main" className="admin-content">
          <div className="fixture-ribbon">
            <strong>{t('INTERACTIVE PRODUCT PREVIEW')}</strong>
            <span>{t('No production data, publication, payment, email, or domain action')}</span>
          </div>
          <PageHeader
            title={t(title)}
            description={t(description)}
            actions={
              <div className="header-actions">
                <Badge>
                  {unpublished
                    ? t('Unpublished draft')
                    : `${t('Demo published')} · v${workspace.versions.length}`}
                </Badge>
                {section !== 'editor' && (
                  <Link className="button-link" href={`/admin/${workspaceId}/editor`}>
                    {t('Design homepage')}
                  </Link>
                )}
              </div>
            }
          />
          {readOnly && (
            <Alert tone="warning" title={t('View-only access')}>
              {t(
                'This role can view the Site and customer experience, but cannot change or publish it.'
              )}
            </Alert>
          )}
          {unpublished && section !== 'editor' && (
            <Alert tone="warning" title={t('Draft differs from the customer-facing demo')}>
              {t('Changes stay private until you review and publish them.')}
            </Alert>
          )}
          <AdminScreen
            workspaceId={workspaceId}
            section={section}
            {...(itemId ? { itemId } : {})}
            readOnly={readOnly}
          />
        </main>
      </div>
    </div>
  );
}

function AdminScreen(props: {
  workspaceId: WorkspaceId;
  section: AdminSection;
  itemId?: string;
  readOnly: boolean;
}) {
  switch (props.section) {
    case 'overview':
      return <Overview {...props} />;
    case 'pages':
      return <Pages {...props} />;
    case 'editor':
      return <Editor {...props} />;
    case 'content':
      return <Content {...props} />;
    case 'services':
      return <Services {...props} />;
    case 'leads':
      return <Leads {...props} />;
    case 'client-service':
      return <ClientService {...props} />;
    case 'analytics':
      return <Analytics {...props} />;
    case 'seo':
      return <Seo {...props} />;
    case 'settings':
      return <Settings {...props} />;
  }
}

function AdminRelatedPages({
  label,
  items
}: {
  label: string;
  items: { href: string; label: string; current?: boolean }[];
}) {
  return (
    <nav className="admin-related-pages" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          {...(item.current ? { className: 'is-active', 'aria-current': 'page' } : {})}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function Overview({ workspaceId }: { workspaceId: WorkspaceId }) {
  const { t } = useAdminI18n();
  const workspace = usePreviewStore().workspaces[workspaceId];
  const draft = projectLocale(workspace.draft, workspace.draft.defaultLocale);
  const checklist = [
    ['Brand configured', Boolean(draft.brandName && draft.primary)],
    ['Public service available', draft.services.some((service) => service.visible)],
    ['Contact route visible', draft.pages.some((page) => page.path === '/contact' && page.visible)],
    ['Domain verified', false]
  ] as const;
  return (
    <div className="screen-stack">
      <section className="metric-grid" aria-label="Site performance summary">
        <Metric
          label={t('Publication readiness')}
          value={`${checklist.filter(([, done]) => done).length}/${checklist.length}`}
          delta="Workspace draft checklist"
        />
        <Metric
          label={t('Unpublished draft')}
          value={hasUnpublishedChanges(workspace) ? '1' : '0'}
          delta={hasUnpublishedChanges(workspace) ? 'Needs review' : 'Up to date'}
        />
        <Metric
          label={t('Pending leads')}
          value={String(workspace.leads.filter((lead) => lead.status !== 'QUALIFIED').length)}
          delta="Exact browser-local submissions"
        />
        <Metric
          label={t('Published version')}
          value={`v${workspace.versions.length}`}
          delta={new Date(workspace.publishedAt).toLocaleDateString()}
        />
      </section>
      <div className="dashboard-grid">
        <Card className="site-health-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('Site health')}</span>
              <h2>{t('One action before launch')}</h2>
            </div>
            <span className="health-score">75%</span>
          </div>
          <div className="progress">
            <span style={{ width: '75%' }} />
          </div>
          <ul className="check-list">
            {checklist.map(([label, done]) => (
              <li key={label}>
                <span className={done ? 'check is-done' : 'check'}>{done ? '✓' : '!'}</span>
                <span>{label}</span>
                {!done && <small>Demo only</small>}
              </li>
            ))}
          </ul>
          <Link className="text-link" href={`/admin/${workspaceId}/seo`}>
            Review domain readiness →
          </Link>
        </Card>
        <Card className="preview-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('Published demo')}</span>
              <h2>{draft.domain}</h2>
            </div>
            <Badge>{t('Safe preview')}</Badge>
          </div>
          <MiniSite config={workspace.published} />
          <div className="card-actions">
            <Link className="button-link" href={`/site/${workspaceId}/`}>
              Open customer Site
            </Link>
            <Link className="button-link secondary" href={`/admin/${workspaceId}/editor`}>
              Edit draft
            </Link>
          </div>
        </Card>
      </div>
      <div className="dashboard-grid thirds">
        <Card>
          <span className="eyebrow">{t('Latest content')}</span>
          <h2>{draft.content[0]?.title}</h2>
          <p>{draft.content[0]?.excerpt}</p>
          <Link
            className="text-link"
            href={`/admin/${workspaceId}/content/${draft.content[0]?.id}`}
          >
            Open content →
          </Link>
        </Card>
        <Card>
          <span className="eyebrow">{t('Latest inquiry')}</span>
          {workspace.leads[0] ? (
            <>
              <h2>{workspace.leads[0].name}</h2>
              <p>{workspace.leads[0].message}</p>
              <Link
                className="text-link"
                href={`/admin/${workspaceId}/leads/${workspace.leads[0].id}`}
              >
                Open {workspace.leads[0].id} →
              </Link>
            </>
          ) : (
            <>
              <h2>{t('No demo inquiries yet')}</h2>
              <p>Complete the customer inquiry path to create an attributable fixture.</p>
              <Link className="text-link" href={`/site/${workspaceId}/contact`}>
                Try the inquiry path →
              </Link>
            </>
          )}
        </Card>
        <Card>
          <span className="eyebrow">{t('Authority boundary')}</span>
          <h2>{t('Projection, not business truth')}</h2>
          <p>
            Visible services and fee notes reference owners. They do not create a Quote, Customer,
            Order, Payment, provider appointment, or filing.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <Card className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </Card>
  );
}

function Pages({ workspaceId, readOnly }: { workspaceId: WorkspaceId; readOnly: boolean }) {
  const store = usePreviewStore();
  const { t } = useAdminI18n();
  const workspace = store.workspaces[workspaceId];
  const localizedDraft = projectLocale(workspace.draft, workspace.draft.defaultLocale);
  const move = (id: string, offset: number) =>
    store.updateDraft(workspaceId, (draft) => {
      const index = draft.pages.findIndex((page) => page.id === id);
      const target = index + offset;
      if (target < 0 || target >= draft.pages.length) return draft;
      const pages = [...draft.pages];
      [pages[index], pages[target]] = [pages[target]!, pages[index]!];
      return { ...draft, pages };
    });
  return (
    <Card className="table-card">
      <div className="section-heading">
        <div>
          <h2>{t('Site map')}</h2>
          <p>
            Navigation follows this order. Hidden pages remain available in the draft for review.
          </p>
        </div>
        <Button disabled title="Custom page types are outside this bounded preview.">
          {t('Add page unavailable in preview')}
        </Button>
      </div>
      <div className="data-table" role="table" aria-label="Site pages">
        <div role="row" className="data-row data-head">
          <span>{t('Page')}</span>
          <span>{t('Path')}</span>
          <span>{t('Status')}</span>
          <span>{t('Actions')}</span>
        </div>
        {localizedDraft.pages.map((page, index) => (
          <div role="row" className="data-row" key={page.id}>
            <span>
              <strong>{page.title}</strong>
              <small>{page.visible ? 'In navigation' : 'Hidden'}</small>
            </span>
            <code>{page.path}</code>
            <Badge>{page.status}</Badge>
            <span className="row-actions">
              <button
                aria-label={`Move ${page.title} up`}
                disabled={readOnly || index === 0}
                onClick={() => move(page.id, -1)}
              >
                ↑
              </button>
              <button
                aria-label={`Move ${page.title} down`}
                disabled={readOnly || index === workspace.draft.pages.length - 1}
                onClick={() => move(page.id, 1)}
              >
                ↓
              </button>
              <button
                disabled={readOnly}
                onClick={() =>
                  store.updateDraft(workspaceId, (draft) => ({
                    ...draft,
                    pages: draft.pages.map((item) =>
                      item.id === page.id ? { ...item, visible: !item.visible } : item
                    )
                  }))
                }
              >
                {page.visible ? 'Hide' : 'Show'}
              </button>
              <Link href={`/site/${workspaceId}/preview/draft${page.path}`} className="text-link">
                {t('Preview draft')}
              </Link>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Editor({ workspaceId, readOnly }: { workspaceId: WorkspaceId; readOnly: boolean }) {
  const store = usePreviewStore();
  const { t } = useAdminI18n();
  const workspace = store.workspaces[workspaceId];
  const draft = workspace.draft;
  const [contentLocale, setContentLocale] = useState<Locale>(draft.defaultLocale);
  const draftView = projectLocale(draft, contentLocale);
  const publishedView = projectLocale(workspace.published, contentLocale);
  const [selected, setSelected] = useState(draft.blocks[0]?.id ?? '');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [showPublished, setShowPublished] = useState(false);
  const [status, setStatus] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const activeConfig = showPublished ? publishedView : draftView;
  const block = draftView.blocks.find((item) => item.id === selected);
  const updateBlock = (update: Partial<Block>) =>
    store.updateDraft(workspaceId, (config) => {
      const current = config.localized[contentLocale].blocks[selected];
      return {
        ...config,
        blocks: config.blocks.map((item) =>
          item.id === selected && update.visible !== undefined
            ? { ...item, visible: update.visible }
            : item
        ),
        localized: {
          ...config.localized,
          [contentLocale]: {
            ...config.localized[contentLocale],
            blocks: {
              ...config.localized[contentLocale].blocks,
              [selected]: {
                label: update.label ?? current?.label ?? '',
                title: update.title ?? current?.title ?? '',
                body: update.body ?? current?.body ?? ''
              }
            }
          }
        },
        localePublication: { ...config.localePublication, [contentLocale]: 'DRAFT' }
      };
    });
  const moveBlock = (offset: number) =>
    store.updateDraft(workspaceId, (config) => {
      const index = config.blocks.findIndex((item) => item.id === selected);
      const target = index + offset;
      if (target < 0 || target >= config.blocks.length) return config;
      const blocks = [...config.blocks];
      [blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
      return { ...config, blocks };
    });
  const checklist = [
    draft.brandName.length > 2,
    draft.blocks.some((item) => item.kind === 'hero' && item.visible),
    draft.services.some((item) => item.visible),
    draft.pages.some((item) => item.path === '/contact' && item.visible)
  ];
  return (
    <div className="editor-wrap">
      <div className="editor-toolbar">
        <div className="segmented">
          <button
            className={!showPublished ? 'is-active' : ''}
            onClick={() => setShowPublished(false)}
          >
            {t('Draft')}
          </button>
          <button
            className={showPublished ? 'is-active' : ''}
            onClick={() => setShowPublished(true)}
          >
            {t('Published')} v{workspace.versions.length}
          </button>
        </div>
        <Select
          label="内容语言 / Content language"
          aria-label="内容语言 / Content language"
          value={contentLocale}
          onChange={(event) => setContentLocale(event.target.value as Locale)}
        >
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </Select>
        <div className="segmented" aria-label="Preview device">
          <button
            className={device === 'desktop' ? 'is-active' : ''}
            onClick={() => setDevice('desktop')}
          >
            {t('Desktop')}
          </button>
          <button
            className={device === 'mobile' ? 'is-active' : ''}
            onClick={() => setDevice('mobile')}
          >
            390px
          </button>
        </div>
        <span className="save-state" role="status">
          {status ||
            (hasUnpublishedChanges(workspace)
              ? t('Draft has unpublished changes')
              : t('Draft matches published demo'))}
        </span>
        <Button
          variant="secondary"
          disabled={readOnly}
          onClick={() => {
            store.saveDraft(workspaceId);
            setStatus(t('Draft saved locally'));
          }}
        >
          {t('Save draft')}
        </Button>
        <Button disabled={readOnly} onClick={() => setPublishOpen(true)}>
          {t('Review & publish')}
        </Button>
      </div>
      <div className="editor-grid">
        <aside className="editor-tree">
          <div>
            <span className="eyebrow">{t('Page')}</span>
            <h2>{t('Home')}</h2>
          </div>
          <ol>
            {draftView.blocks.map((item, index) => (
              <li key={item.id}>
                <button
                  className={selected === item.id ? 'is-selected' : ''}
                  onClick={() => setSelected(item.id)}
                >
                  <span className="drag">⠿</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{t(item.visible ? 'Visible' : 'Hidden')}</small>
                  </span>
                  <Badge>{index + 1}</Badge>
                </button>
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            disabled={readOnly}
            onClick={() =>
              store.updateDraft(workspaceId, (config) => ({
                ...config,
                blocks: [
                  ...config.blocks,
                  {
                    id: `cta-${Date.now()}`,
                    kind: 'cta',
                    label: 'New call-to-action',
                    title: 'Start a conversation',
                    body: 'Describe the decision you need to make.',
                    visible: true
                  }
                ]
              }))
            }
          >
            + {t('Add block')}
          </Button>
        </aside>
        <section className="editor-canvas" aria-label={`${device} Site preview`}>
          <div className={`device-frame ${device}`}>
            <MiniSite
              config={activeConfig}
              {...(!showPublished ? { selectedBlock: selected } : {})}
            />
          </div>
        </section>
        <aside className="editor-properties">
          <span className="eyebrow">{t('Properties')}</span>
          <h2>{block?.label ?? 'Select a block'}</h2>
          {block && (
            <fieldset disabled={readOnly || showPublished}>
              <TextInput
                label={t('Block label')}
                value={block.label}
                onChange={(event) => updateBlock({ label: event.target.value })}
              />
              <TextInput
                label={t('Heading')}
                value={block.title}
                onChange={(event) => updateBlock({ title: event.target.value })}
              />
              <TextArea
                label={t('Supporting copy')}
                rows={5}
                value={block.body}
                onChange={(event) => updateBlock({ body: event.target.value })}
              />
              <Checkbox
                label={t('Show this block')}
                checked={block.visible}
                onChange={(event) => updateBlock({ visible: event.target.checked })}
              />
              <div className="property-actions">
                <Button type="button" variant="secondary" onClick={() => moveBlock(-1)}>
                  {t('Move up')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => moveBlock(1)}>
                  {t('Move down')}
                </Button>
              </div>
              <hr />
              <TextInput
                label={t('Brand name')}
                value={draftView.brandName}
                onChange={(event) =>
                  store.updateDraft(workspaceId, (config) => ({
                    ...config,
                    localized: {
                      ...config.localized,
                      [contentLocale]: {
                        ...config.localized[contentLocale],
                        brandName: event.target.value
                      }
                    },
                    localePublication: { ...config.localePublication, [contentLocale]: 'DRAFT' }
                  }))
                }
              />
              <div className="color-fields">
                <label>
                  {t('Primary')}
                  <input
                    aria-label="Primary color"
                    type="color"
                    value={draft.primary}
                    onChange={(event) =>
                      store.updateDraft(workspaceId, (config) => ({
                        ...config,
                        primary: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  {t('Accent')}
                  <input
                    aria-label="Accent color"
                    type="color"
                    value={draft.accent}
                    onChange={(event) =>
                      store.updateDraft(workspaceId, (config) => ({
                        ...config,
                        accent: event.target.value
                      }))
                    }
                  />
                </label>
              </div>
            </fieldset>
          )}
        </aside>
      </div>
      {publishOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-title"
          >
            <span className="eyebrow">Demo publication checklist</span>
            <h2 id="publish-title">{t('Publish this snapshot?')}</h2>
            <p>
              The customer Site will switch from v{workspace.versions.length} to v
              {workspace.versions.length + 1}. No domain, email, search, payment, or production data
              action will run.
            </p>
            <ul className="check-list">
              {[
                'Brand is configured',
                'Hero is visible',
                'At least one service is visible',
                'Contact route is visible'
              ].map((label, index) => (
                <li key={label}>
                  <span className="check is-done">{checklist[index] ? '✓' : '!'}</span>
                  {label}
                </li>
              ))}
            </ul>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setPublishOpen(false)}>
                Keep editing
              </Button>
              <Button
                disabled={!checklist.every(Boolean)}
                onClick={() => {
                  const version = store.publish(
                    workspaceId,
                    `Locale release: ${contentLocale}`,
                    (config) => ({
                      ...config,
                      localePublication: {
                        ...config.localePublication,
                        [contentLocale]: 'PUBLISHED'
                      }
                    })
                  );
                  setPublishOpen(false);
                  setStatus(`${t('Demo published as version')} ${version}`);
                }}
              >
                Publish demo v{workspace.versions.length + 1}
              </Button>
            </div>
          </section>
        </div>
      )}
      <Card className="version-card">
        <div className="section-heading">
          <div>
            <h2>{t('Version history')}</h2>
            <p>{t('Restore creates a new draft. Historical demo snapshots remain unchanged.')}</p>
          </div>
        </div>
        <div className="version-list">
          {[...workspace.versions].reverse().map((version) => (
            <div key={version.version}>
              <span className="version-number">v{version.version}</span>
              <span>
                <strong>{version.label}</strong>
                <small>{new Date(version.publishedAt).toLocaleString()}</small>
              </span>
              <Button
                variant="secondary"
                disabled={readOnly}
                onClick={() => {
                  store.restore(workspaceId, version.version);
                  setStatus(`Version ${version.version} restored into a new draft`);
                }}
              >
                {t('Restore to draft')}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MiniSite({ config, selectedBlock }: { config: SiteConfig; selectedBlock?: string }) {
  const { t } = useAdminI18n();
  const visible = config.blocks.filter((item) => item.visible);
  const hero = visible.find((item) => item.kind === 'hero');
  return (
    <div
      className={`mini-site template-${config.template}`}
      style={
        {
          '--preview-primary': config.primary,
          '--preview-accent': config.accent
        } as React.CSSProperties
      }
    >
      <header>
        <strong>{config.brandName}</strong>
        <span>
          {t('Services')} &nbsp; {t('Insights')} &nbsp; {t('Contact')}
        </span>
      </header>
      <main>
        {visible.map((block) => (
          <section
            key={block.id}
            className={`${block.kind} ${selectedBlock === block.id ? 'is-selected' : ''}`}
          >
            <span className="mini-label">{block.label}</span>
            {block === hero ? <h3>{block.title}</h3> : <h4>{block.title}</h4>}
            <p>{block.body}</p>
            {block.kind === 'services' && (
              <div className="mini-cards">
                {config.services
                  .filter((item) => item.visible)
                  .slice(0, 2)
                  .map((service) => (
                    <span key={service.id}>{service.title}</span>
                  ))}
              </div>
            )}
            {block.kind === 'cta' && <button>{t('Start an inquiry')}</button>}
          </section>
        ))}
      </main>
    </div>
  );
}

function Content({
  workspaceId,
  itemId,
  readOnly
}: {
  workspaceId: WorkspaceId;
  itemId?: string;
  readOnly: boolean;
}) {
  const store = usePreviewStore();
  const { t } = useAdminI18n();
  const workspace = store.workspaces[workspaceId];
  const [contentLocale, setContentLocale] = useState<Locale>(workspace.draft.defaultLocale);
  const localizedDraft = projectLocale(workspace.draft, contentLocale);
  const [selectedId, setSelectedId] = useState(itemId ?? localizedDraft.content[0]?.id);
  const selected = localizedDraft.content.find((item) => item.id === selectedId);
  const [status, setStatus] = useState('');
  const update = (changes: Partial<ContentRecord>) =>
    selected &&
    store.updateDraft(workspaceId, (config) => {
      const current = config.localized[contentLocale].content[selected.id];
      return {
        ...config,
        content: config.content.map((item) =>
          item.id === selected.id ? { ...item, ...changes } : item
        ),
        localized: {
          ...config.localized,
          [contentLocale]: {
            ...config.localized[contentLocale],
            content: {
              ...config.localized[contentLocale].content,
              [selected.id]: {
                title: changes.title ?? current?.title ?? '',
                excerpt: changes.excerpt ?? current?.excerpt ?? '',
                body: changes.body ?? current?.body ?? '',
                status: changes.status ?? current?.status ?? 'DRAFT',
                version: changes.version ?? current?.version ?? 1
              }
            }
          }
        },
        localePublication: { ...config.localePublication, [contentLocale]: 'DRAFT' }
      };
    });
  return (
    <div className="content-workbench">
      <Card className="content-list">
        <div className="section-heading">
          <div>
            <h2>{t('Content library')}</h2>
            <p>Fixture packages mirror reviewed Lite content lineage.</p>
          </div>
          <Select
            label="内容语言 / Content language"
            value={contentLocale}
            onChange={(event) => setContentLocale(event.target.value as Locale)}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </Select>
          <Button disabled={readOnly}>{t('New content')}</Button>
        </div>
        {localizedDraft.content.map((item) => (
          <button
            key={item.id}
            className={selected?.id === item.id ? 'content-row is-active' : 'content-row'}
            onClick={() => setSelectedId(item.id)}
          >
            <span>
              <strong>{item.title}</strong>
              <small>
                {item.packageRef} · v{item.version}
              </small>
            </span>
            <Badge>{item.status}</Badge>
          </button>
        ))}
      </Card>
      {selected && (
        <Card className="content-editor">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Exact demo content · {selected.packageRef}</span>
              <h2>{t('Edit content')}</h2>
            </div>
            <Badge>{selected.status}</Badge>
          </div>
          <fieldset disabled={readOnly}>
            <TextInput
              label={t('Title')}
              value={selected.title}
              onChange={(event) => update({ title: event.target.value, status: 'DRAFT' })}
            />
            <TextArea
              label={t('Excerpt')}
              rows={3}
              value={selected.excerpt}
              onChange={(event) => update({ excerpt: event.target.value, status: 'DRAFT' })}
            />
            <TextArea
              label={t('Body')}
              rows={10}
              value={selected.body}
              onChange={(event) => update({ body: event.target.value, status: 'DRAFT' })}
            />
            <Select
              label={t('Related service')}
              value={selected.relatedServiceId}
              onChange={(event) =>
                update({ relatedServiceId: event.target.value, status: 'DRAFT' })
              }
            >
              {localizedDraft.services.map((service) => (
                <option value={service.id} key={service.id}>
                  {service.title}
                </option>
              ))}
            </Select>
          </fieldset>
          <Alert title={t('Publication boundary')}>
            This demo action changes the Site preview snapshot only. It does not bypass Lite human
            review or publish externally.
          </Alert>
          <div className="card-actions">
            <Link
              className="button-link secondary"
              href={`/site/${workspaceId}/preview/draft/${contentLocale}/insights/${selected.slug}`}
            >
              {t('Preview draft')}
            </Link>
            <Button
              disabled={readOnly}
              onClick={() => {
                update({ status: 'PUBLISHED', version: selected.version + 1 });
                store.saveDraft(workspaceId);
                setStatus('Content prepared in the Site draft');
              }}
            >
              {t('Prepare demo publication')}
            </Button>
            <Button
              disabled={readOnly}
              onClick={() => {
                const nextVersion = selected.version + 1;
                const version = store.publish(
                  workspaceId,
                  `Content release: ${selected.title}`,
                  (draft) => ({
                    ...draft,
                    content: draft.content.map((item) =>
                      item.id === selected.id
                        ? {
                            ...item,
                            title: selected.title,
                            excerpt: selected.excerpt,
                            body: selected.body,
                            status: 'PUBLISHED',
                            version: nextVersion
                          }
                        : item
                    ),
                    localized: {
                      ...draft.localized,
                      [contentLocale]: {
                        ...draft.localized[contentLocale],
                        content: {
                          ...draft.localized[contentLocale].content,
                          [selected.id]: {
                            ...draft.localized[contentLocale].content[selected.id]!,
                            status: 'PUBLISHED',
                            version: nextVersion
                          }
                        }
                      }
                    },
                    localePublication: { ...draft.localePublication, [contentLocale]: 'PUBLISHED' }
                  })
                );
                setStatus(`Content and Site demo published as v${version}`);
              }}
            >
              {t('Publish content demo')}
            </Button>
          </div>
          {status && (
            <p role="status" className="success-note">
              ✓ {status}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Services({ workspaceId, readOnly }: { workspaceId: WorkspaceId; readOnly: boolean }) {
  const store = usePreviewStore();
  const { t } = useAdminI18n();
  const workspace = store.workspaces[workspaceId];
  const localizedDraft = projectLocale(workspace.draft, workspace.draft.defaultLocale);
  return (
    <div className="service-admin-grid">
      {localizedDraft.services.map((service) => (
        <Card key={service.id} className="service-admin-card">
          <div className="section-heading">
            <Badge>
              {service.productRef} · v{service.version}
            </Badge>
            <Checkbox
              label={t('Visible')}
              disabled={readOnly}
              checked={service.visible}
              onChange={(event) =>
                store.updateDraft(workspaceId, (config) => ({
                  ...config,
                  services: config.services.map((item) =>
                    item.id === service.id ? { ...item, visible: event.target.checked } : item
                  )
                }))
              }
            />
          </div>
          <h2>{service.title}</h2>
          <p>{service.summary}</p>
          <dl>
            <div>
              <dt>{t('Markets')}</dt>
              <dd>{service.markets.join(', ')}</dd>
            </div>
            <div>
              <dt>{t('Fee display')}</dt>
              <dd>{service.feeNote}</dd>
            </div>
            <div>
              <dt>{t('Authority')}</dt>
              <dd>Display reference only; final scope and Quote remain owner truth.</dd>
            </div>
          </dl>
          <Link className="text-link" href={`/site/${workspaceId}/services/${service.id}`}>
            Preview service →
          </Link>
        </Card>
      ))}
    </div>
  );
}

function Leads({
  workspaceId,
  itemId,
  readOnly
}: {
  workspaceId: WorkspaceId;
  itemId?: string;
  readOnly: boolean;
}) {
  const store = usePreviewStore();
  const { t } = useAdminI18n();
  const workspace = store.workspaces[workspaceId];
  const selected = workspace.leads.find((lead) => lead.id === itemId) ?? workspace.leads[0];
  const relatedPages = (
    <AdminRelatedPages
      label={t('Inquiry views')}
      items={[
        { href: `/admin/${workspaceId}/leads`, label: t('Inquiries'), current: true },
        { href: `/admin/${workspaceId}/client-service`, label: t('Customer progress') }
      ]}
    />
  );
  if (!workspace.leads.length)
    return (
      <div className="screen-stack">
        {relatedPages}
        <EmptyState
          title={t('No inquiries yet')}
          description={t(
            'When a visitor submits the Site form, the inquiry will appear here with its reference and exact source.'
          )}
          action={
            <Link className="button-link" href={`/site/${workspaceId}/contact`}>
              {t('Open inquiry form')}
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="screen-stack">
      {relatedPages}
      <div className="leads-layout">
        <Card className="lead-list">
          <h2>{t('Inbox')}</h2>
          {workspace.leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/admin/${workspaceId}/leads/${lead.id}`}
              className={selected?.id === lead.id ? 'lead-row is-active' : 'lead-row'}
            >
              <span className="lead-avatar">{lead.name.slice(0, 1)}</span>
              <span>
                <strong>{lead.name}</strong>
                <small>
                  {lead.id} · {lead.status}
                </small>
              </span>
              <time>{new Date(lead.createdAt).toLocaleDateString()}</time>
            </Link>
          ))}
        </Card>
        {selected && <LeadDetail workspaceId={workspaceId} lead={selected} readOnly={readOnly} />}
      </div>
    </div>
  );
}

function LeadDetail({
  workspaceId,
  lead,
  readOnly
}: {
  workspaceId: WorkspaceId;
  lead: DemoLead;
  readOnly: boolean;
}) {
  const store = usePreviewStore();
  const { t } = useAdminI18n();
  const workspace = store.workspaces[workspaceId];
  const service = workspace.published.services.find((item) => item.id === lead.serviceId);
  return (
    <Card className="lead-detail">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{lead.id}</span>
          <h2>
            {lead.name} · {lead.company}
          </h2>
        </div>
        <Badge>{lead.status}</Badge>
      </div>
      <div className="lead-facts">
        <div>
          <span>Email</span>
          <strong>{lead.email}</strong>
        </div>
        <div>
          <span>Market</span>
          <strong>{lead.market}</strong>
        </div>
        <div>
          <span>Service</span>
          <strong>{service?.title ?? lead.serviceId}</strong>
        </div>
        <div>
          <span>Site / Workspace</span>
          <strong>
            {lead.siteId} / {lead.workspaceId}
          </strong>
        </div>
      </div>
      <section className="message-card">
        <span className="eyebrow">{t('Visitor message')}</span>
        <p>{lead.message}</p>
      </section>
      <section>
        <h3>{t('Attribution lineage')}</h3>
        <div className="lineage">
          <span>
            Source <strong>{lead.sourceContentId ?? lead.sourceAssetId ?? lead.sourcePath}</strong>
          </span>
          <i>→</i>
          <span>
            Service <strong>{lead.serviceId}</strong>
          </span>
          <i>→</i>
          <span>
            Lead <strong>{lead.id}</strong>
          </span>
        </div>
      </section>
      <Alert title={t('Handoff boundary')}>
        Qualifying this demo lead does not create a Customer Relationship, Quote, Order, Payment,
        Matter, provider selection, or protected action.
      </Alert>
      <div className="card-actions">
        <Button
          variant="secondary"
          disabled={readOnly}
          onClick={() => store.updateLead(workspaceId, lead.id, 'QUALIFIED')}
        >
          {t('Mark qualified')}
        </Button>
        <Button
          disabled={readOnly}
          onClick={() => store.updateLead(workspaceId, lead.id, 'FOLLOW_UP')}
        >
          {t('Prepare follow-up')}
        </Button>
      </div>
    </Card>
  );
}

function ClientService({ workspaceId }: { workspaceId: WorkspaceId }) {
  const { t } = useAdminI18n();
  return (
    <div className="screen-stack">
      <AdminRelatedPages
        label={t('Inquiry views')}
        items={[
          { href: `/admin/${workspaceId}/leads`, label: t('Inquiries') },
          {
            href: `/admin/${workspaceId}/client-service`,
            label: t('Customer progress'),
            current: true
          }
        ]}
      />
      <Alert title={t('Projection only')}>
        These demo requests illustrate a future Site view. Order, Matter, official status, payment,
        and provider truth remain with their current owners.
      </Alert>
      <Card className="table-card">
        <div className="section-heading">
          <div>
            <h2>{t('Customer requests')}</h2>
            <p>Example read projections, clearly labelled as demo.</p>
          </div>
          <Badge>Demo data</Badge>
        </div>
        <div className="data-table">
          <div className="data-row data-head">
            <span>{t('Reference')}</span>
            <span>{t('Request')}</span>
            <span>{t('Stage')}</span>
            <span>{t('Last update')}</span>
          </div>
          <div className="data-row">
            <strong>DEMO-REQ-1027</strong>
            <span>US trademark filing</span>
            <Badge>Information review</Badge>
            <span>25 Sep 2026</span>
          </div>
          <div className="data-row">
            <strong>DEMO-REQ-1019</strong>
            <span>Portfolio strategy</span>
            <Badge>Consultation scheduled</Badge>
            <span>22 Sep 2026</span>
          </div>
        </div>
      </Card>
      <Link className="button-link secondary" href={`/site/${workspaceId}/portal`}>
        Preview customer entry
      </Link>
    </div>
  );
}

function Analytics({ workspaceId }: { workspaceId: WorkspaceId }) {
  const { t } = useAdminI18n();
  const workspace = usePreviewStore().workspaces[workspaceId];
  const contentLeads = workspace.leads.filter((lead) => lead.sourceContentId).length;
  return (
    <div className="screen-stack">
      {workspace.analyticsPartial && (
        <Alert tone="warning" title={t('Partial demo analytics')}>
          Traffic source detail is unavailable for this Workspace fixture. No missing values were
          inferred.
        </Alert>
      )}
      <section className="metric-grid">
        <Metric
          label={t('Illustrative visitors')}
          value="2,193"
          delta="Fixture only · no live denominator"
        />
        <Metric
          label={t('Inquiry rate')}
          value={t('Unavailable')}
          delta="No measured visitor denominator"
        />
        <Metric
          label={t('Content-assisted leads')}
          value={String(contentLeads)}
          delta="Exact local lineage"
        />
        <Metric label={t('Top market')} value={workspace.draft.market} delta="Fixture signal" />
      </section>
      <div className="dashboard-grid">
        <Card>
          <div className="section-heading">
            <div>
              <h2>{t('Conversion path')}</h2>
              <p>Illustrative funnel; browser-created leads are exact.</p>
            </div>
            <Badge>Demo</Badge>
          </div>
          <div className="funnel">
            <span style={{ width: '100%' }}>2,846 visits</span>
            <span style={{ width: '76%' }}>1,174 service views</span>
            <span style={{ width: '48%' }}>382 inquiry starts</span>
            <span style={{ width: '25%' }}>{workspace.leads.length} local submissions</span>
          </div>
        </Card>
        <Card>
          <h2>{t('Content to demand')}</h2>
          {workspace.draft.content.map((item) => (
            <div className="content-performance" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <small>{item.views} demo views</small>
              </span>
              <span>
                {workspace.leads.filter((lead) => lead.sourceContentId === item.id).length} leads
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Seo({ workspaceId, readOnly }: { workspaceId: WorkspaceId; readOnly: boolean }) {
  const store = usePreviewStore();
  const { t } = useAdminI18n();
  const workspace = store.workspaces[workspaceId];
  const [status, setStatus] = useState('');
  return (
    <div className="dashboard-grid">
      <AdminRelatedPages
        label={t('Settings pages')}
        items={[
          { href: `/admin/${workspaceId}/settings`, label: t('Settings') },
          { href: `/admin/${workspaceId}/seo`, label: t('Domain & search'), current: true }
        ]}
      />
      <Card>
        <span className="eyebrow">{t('Demo domain')}</span>
        <h2>{workspace.draft.domain}</h2>
        <div className="domain-state">
          <span className="status-dot warning" />
          <div>
            <strong>{t('Verification not executed')}</strong>
            <p>DNS changes and host activation are outside this preview.</p>
          </div>
        </div>
        <TextInput
          disabled={readOnly}
          label={t('Proposed hostname')}
          value={workspace.draft.domain}
          onChange={(event) =>
            store.updateDraft(workspaceId, (config) => ({
              ...config,
              domain: event.target.value
            }))
          }
        />
        <Button
          disabled={readOnly}
          onClick={() => setStatus('Demo check complete: no DNS request was sent')}
        >
          Run demo readiness check
        </Button>
        {status && (
          <p role="status" className="success-note">
            ✓ {status}
          </p>
        )}
      </Card>
      <Card>
        <span className="eyebrow">{t('Search preview')}</span>
        <div className="search-preview">
          <small>{workspace.draft.domain}</small>
          <h2>{workspace.draft.brandName} · Trademark services</h2>
          <p>{workspace.draft.tagline}</p>
        </div>
        <ul className="check-list">
          <li>
            <span className="check is-done">✓</span>One page title and description
          </li>
          <li>
            <span className="check is-done">✓</span>Structured service references
          </li>
          <li>
            <span className="check">!</span>Search submission not executed
          </li>
          <li>
            <span className="check">!</span>Share card image unavailable
          </li>
        </ul>
      </Card>
    </div>
  );
}

function Settings({ workspaceId, readOnly }: { workspaceId: WorkspaceId; readOnly: boolean }) {
  const store = usePreviewStore();
  const { t } = useAdminI18n();
  const workspace = store.workspaces[workspaceId];
  const config = workspace.draft;
  return (
    <div className="dashboard-grid">
      <AdminRelatedPages
        label={t('Settings pages')}
        items={[
          { href: `/admin/${workspaceId}/settings`, label: t('Settings'), current: true },
          { href: `/admin/${workspaceId}/seo`, label: t('Domain & search') }
        ]}
      />
      <Card>
        <h2>{t('Modules')}</h2>
        <p>Enable only the projections this Workspace needs.</p>
        {Object.entries(config.modules).map(([key, value]) => (
          <Checkbox
            key={key}
            disabled={readOnly}
            label={
              {
                assets: 'Trademark asset showcase',
                portal: 'Client service entry',
                insights: 'Insights and content'
              }[key]!
            }
            checked={value}
            onChange={(event) =>
              store.updateDraft(workspaceId, (draft) => ({
                ...draft,
                modules: { ...draft.modules, [key]: event.target.checked }
              }))
            }
          />
        ))}
      </Card>
      <Card>
        <h2>{t('Workspace & access')}</h2>
        <Select
          disabled={readOnly}
          label={t('Demo permission')}
          value={workspace.role}
          onChange={(event) => store.setRole(workspaceId, event.target.value as 'OWNER' | 'VIEWER')}
        >
          <option value="OWNER">Site manager (editable)</option>
          <option value="VIEWER">Viewer (read-only)</option>
        </Select>
        <Select
          disabled={readOnly}
          label="站点默认语言 / Site default language"
          value={config.defaultLocale}
          onChange={(event) =>
            store.updateDraft(workspaceId, (draft) => ({
              ...draft,
              defaultLocale: event.target.value as Locale,
              locale: event.target.value
            }))
          }
        >
          <option value="en-US">English (US)</option>
          <option value="zh-CN">简体中文</option>
        </Select>
        <fieldset className="locale-publication" disabled={readOnly}>
          <legend>启用与发布语言 / Enabled & published locales</legend>
          {(['zh-CN', 'en-US'] as const).map((locale) => (
            <div key={locale} className="locale-publication-row">
              <Checkbox
                label={locale === 'zh-CN' ? '简体中文' : 'English'}
                disabled={locale === config.defaultLocale}
                checked={config.enabledLocales.includes(locale)}
                onChange={(event) =>
                  store.updateDraft(workspaceId, (draft) => ({
                    ...draft,
                    enabledLocales: event.target.checked
                      ? [...new Set([...draft.enabledLocales, locale])]
                      : draft.enabledLocales.filter((item) => item !== locale)
                  }))
                }
              />
              <Badge>{config.localePublication[locale]}</Badge>
              <span>
                {
                  Object.values(config.localized[locale].content).filter(
                    (item) => item.status === 'PUBLISHED'
                  ).length
                }
                /{Object.keys(config.localized[locale].content).length} 内容已审核
              </span>
            </div>
          ))}
        </fieldset>
        <Alert title={t('Workspace-owned settings')}>
          Subscription, billing method, team identity, and primary permissions remain in Workspace
          Console and are not recreated here.
        </Alert>
        <Button variant="danger" disabled={readOnly} onClick={() => store.reset(workspaceId)}>
          {t('Reset this demo Workspace')}
        </Button>
        {readOnly && (
          <div className="demo-access-reset">
            <Alert tone="warning" title={t('Demo access recovery')}>
              This resets browser-local fixtures to the seeded OWNER state. It is not an
              authorization path for a production Workspace.
            </Alert>
            <Button variant="secondary" onClick={() => store.resetDemoAccess(workspaceId)}>
              {t('Reset demo access and fixtures')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
