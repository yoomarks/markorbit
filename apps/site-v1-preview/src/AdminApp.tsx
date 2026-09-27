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
  WorkspaceId
} from './domain.js';
import { hasUnpublishedChanges, usePreviewStore } from './store.js';
import { Link, useRouter } from './router.js';

const nav: { section: AdminSection; label: string; icon: string }[] = [
  { section: 'overview', label: 'Overview', icon: '⌂' },
  { section: 'pages', label: 'Pages & navigation', icon: '▤' },
  { section: 'editor', label: 'Visual editor', icon: '✦' },
  { section: 'content', label: 'Content', icon: '✎' },
  { section: 'services', label: 'Services', icon: '◇' },
  { section: 'leads', label: 'Leads & inquiries', icon: '◎' },
  { section: 'client-service', label: 'Client service', icon: '↗' },
  { section: 'analytics', label: 'Analytics', icon: '⌁' },
  { section: 'seo', label: 'Domain & SEO/GEO', icon: '◉' },
  { section: 'settings', label: 'Settings', icon: '⚙' }
];

const titles: Record<AdminSection, [string, string]> = {
  overview: ['Site overview', 'Readiness, reach, and the work that needs attention.'],
  pages: [
    'Pages & navigation',
    'Manage the routes, visibility, and hierarchy of this Site projection.'
  ],
  editor: [
    'Visual editor',
    'Shape a bounded page from blocks and compare the draft with the published demo.'
  ],
  content: ['Content', 'Prepare reviewed knowledge for an explicit Site demo publication.'],
  services: [
    'Services & offers',
    'Choose which owner-backed service references are visible on the Site.'
  ],
  leads: [
    'Leads & inquiries',
    'Trace every demo inquiry back to its page, content, and service source.'
  ],
  'client-service': [
    'Client service',
    'Preview request and progress information without creating a second order or matter truth.'
  ],
  analytics: [
    'Operations & analytics',
    'Connect Site attention to demo inquiries and the content that influenced them.'
  ],
  seo: [
    'Domain & SEO/GEO',
    'Review projection metadata and readiness without executing DNS or search submissions.'
  ],
  settings: [
    'Site settings',
    'Control demo modules, locale, and access without duplicating Workspace billing or identity.'
  ]
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
  const unpublished = hasUnpublishedChanges(workspace);
  const [title, description] = titles[section];
  const readOnly = workspace.role === 'VIEWER';

  return (
    <div className="admin-shell">
      <aside className={mobileNav ? 'admin-sidebar is-open' : 'admin-sidebar'}>
        <div className="admin-brand">
          <span className="admin-brand__mark">MO</span>
          <div>
            <strong>MarkOrbit</strong>
            <small>Workspace Console</small>
          </div>
        </div>
        <div className="workspace-chip">
          <span>{workspace.workspaceName.slice(0, 1)}</span>
          <div>
            <strong>{workspace.workspaceName}</strong>
            <small>Site · {workspace.lifecycle}</small>
          </div>
        </div>
        <nav aria-label="Site Admin">
          {nav.map((item) => (
            <Link
              key={item.section}
              href={`/admin/${workspaceId}/${item.section}`}
              className={section === item.section ? 'admin-nav-link is-active' : 'admin-nav-link'}
              aria-current={section === item.section ? 'page' : undefined}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
              {item.section === 'leads' && workspace.leads.length ? (
                <b>{workspace.leads.length}</b>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <span className="demo-dot" /> Demo fixtures only
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(!mobileNav)}
          >
            ☰
          </button>
          <div>
            <span className="topbar-context">Workspace / Site</span>
            <strong>{workspace.draft.brandName}</strong>
          </div>
          <div className="topbar-actions">
            <Select
              label="Workspace"
              aria-label="Workspace"
              value={workspaceId}
              onChange={(event) => router.navigate(`/admin/${event.target.value}/${section}`)}
            >
              <option value="atlas">Atlas Counsel</option>
              <option value="foundry">Foundry Exchange</option>
            </Select>
            <Link className="button-link secondary" href={`/site/${workspaceId}/`}>
              View Site
            </Link>
            <span className="avatar" aria-label="Demo user">
              MA
            </span>
          </div>
        </header>
        <main id="main" className="admin-content">
          <div className="fixture-ribbon">
            <strong>INTERACTIVE PRODUCT PREVIEW</strong>
            <span>No production data, publication, payment, email, or domain action</span>
          </div>
          <PageHeader
            title={title}
            description={description}
            actions={
              <div className="header-actions">
                <Badge>
                  {unpublished
                    ? 'Unpublished draft'
                    : `Demo published · v${workspace.versions.length}`}
                </Badge>
                {section !== 'editor' && (
                  <Link className="button-link" href={`/admin/${workspaceId}/editor`}>
                    Edit Site
                  </Link>
                )}
              </div>
            }
          />
          {readOnly && (
            <Alert tone="warning" title="View-only access">
              This fixture role may inspect Site state and preview the customer experience, but
              cannot change or publish it.
            </Alert>
          )}
          {unpublished && section !== 'editor' && (
            <Alert tone="warning" title="Draft differs from the customer-facing demo">
              Changes remain private to this Workspace until an explicit demo publication.
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

function Overview({ workspaceId }: { workspaceId: WorkspaceId }) {
  const workspace = usePreviewStore().workspaces[workspaceId];
  const draft = workspace.draft;
  const checklist = [
    ['Brand configured', Boolean(draft.brandName && draft.primary)],
    ['Public service available', draft.services.some((service) => service.visible)],
    ['Contact route visible', draft.pages.some((page) => page.path === '/contact' && page.visible)],
    ['Domain verified', false]
  ] as const;
  return (
    <div className="screen-stack">
      <section className="metric-grid" aria-label="Site performance summary">
        <Metric label="Demo visits" value="2,846" delta="+18%" />
        <Metric
          label="Inquiries"
          value={String(workspace.leads.length)}
          delta={workspace.leads.length ? 'from this browser' : 'no demo submissions'}
        />
        <Metric label="Content assist" value="34%" delta="Demo attribution" />
        <Metric
          label="Published version"
          value={`v${workspace.versions.length}`}
          delta={new Date(workspace.publishedAt).toLocaleDateString()}
        />
      </section>
      <div className="dashboard-grid">
        <Card className="site-health-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Site health</span>
              <h2>One action before launch</h2>
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
              <span className="eyebrow">Published demo</span>
              <h2>{draft.domain}</h2>
            </div>
            <Badge>Safe preview</Badge>
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
          <span className="eyebrow">Latest content</span>
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
          <span className="eyebrow">Latest inquiry</span>
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
              <h2>No demo inquiries yet</h2>
              <p>Complete the customer inquiry path to create an attributable fixture.</p>
              <Link className="text-link" href={`/site/${workspaceId}/contact`}>
                Try the inquiry path →
              </Link>
            </>
          )}
        </Card>
        <Card>
          <span className="eyebrow">Authority boundary</span>
          <h2>Projection, not business truth</h2>
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
  const workspace = store.workspaces[workspaceId];
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
          <h2>Site map</h2>
          <p>
            Navigation follows this order. Hidden pages remain available in the draft for review.
          </p>
        </div>
        <Button disabled title="Custom page types are outside this bounded preview.">
          Add page unavailable in preview
        </Button>
      </div>
      <div className="data-table" role="table" aria-label="Site pages">
        <div role="row" className="data-row data-head">
          <span>Page</span>
          <span>Path</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {workspace.draft.pages.map((page, index) => (
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
              <Link
                href={`/site/${workspaceId}/preview/draft${page.path}`}
                className="text-link"
              >
                Preview draft
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
  const workspace = store.workspaces[workspaceId];
  const draft = workspace.draft;
  const [selected, setSelected] = useState(draft.blocks[0]?.id ?? '');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [showPublished, setShowPublished] = useState(false);
  const [status, setStatus] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const activeConfig = showPublished ? workspace.published : draft;
  const block = draft.blocks.find((item) => item.id === selected);
  const updateBlock = (update: Partial<Block>) =>
    store.updateDraft(workspaceId, (config) => ({
      ...config,
      blocks: config.blocks.map((item) => (item.id === selected ? { ...item, ...update } : item))
    }));
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
            Draft
          </button>
          <button
            className={showPublished ? 'is-active' : ''}
            onClick={() => setShowPublished(true)}
          >
            Published v{workspace.versions.length}
          </button>
        </div>
        <div className="segmented" aria-label="Preview device">
          <button
            className={device === 'desktop' ? 'is-active' : ''}
            onClick={() => setDevice('desktop')}
          >
            Desktop
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
              ? 'Draft has unpublished changes'
              : 'Draft matches published demo')}
        </span>
        <Button
          variant="secondary"
          disabled={readOnly}
          onClick={() => {
            store.saveDraft(workspaceId);
            setStatus('Draft saved locally');
          }}
        >
          Save draft
        </Button>
        <Button disabled={readOnly} onClick={() => setPublishOpen(true)}>
          Review & publish
        </Button>
      </div>
      <div className="editor-grid">
        <aside className="editor-tree">
          <div>
            <span className="eyebrow">Page</span>
            <h2>Home</h2>
          </div>
          <ol>
            {draft.blocks.map((item, index) => (
              <li key={item.id}>
                <button
                  className={selected === item.id ? 'is-selected' : ''}
                  onClick={() => setSelected(item.id)}
                >
                  <span className="drag">⠿</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.visible ? 'Visible' : 'Hidden'}</small>
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
            + Add block
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
          <span className="eyebrow">Properties</span>
          <h2>{block?.label ?? 'Select a block'}</h2>
          {block && (
            <fieldset disabled={readOnly || showPublished}>
              <TextInput
                label="Block label"
                value={block.label}
                onChange={(event) => updateBlock({ label: event.target.value })}
              />
              <TextInput
                label="Heading"
                value={block.title}
                onChange={(event) => updateBlock({ title: event.target.value })}
              />
              <TextArea
                label="Supporting copy"
                rows={5}
                value={block.body}
                onChange={(event) => updateBlock({ body: event.target.value })}
              />
              <Checkbox
                label="Show this block"
                checked={block.visible}
                onChange={(event) => updateBlock({ visible: event.target.checked })}
              />
              <div className="property-actions">
                <Button type="button" variant="secondary" onClick={() => moveBlock(-1)}>
                  Move up
                </Button>
                <Button type="button" variant="secondary" onClick={() => moveBlock(1)}>
                  Move down
                </Button>
              </div>
              <hr />
              <TextInput
                label="Brand name"
                value={draft.brandName}
                onChange={(event) =>
                  store.updateDraft(workspaceId, (config) => ({
                    ...config,
                    brandName: event.target.value
                  }))
                }
              />
              <div className="color-fields">
                <label>
                  Primary
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
                  Accent
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
            <h2 id="publish-title">Publish this snapshot?</h2>
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
                  const version = store.publish(workspaceId);
                  setPublishOpen(false);
                  setStatus(`Demo published as version ${version}`);
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
            <h2>Version history</h2>
            <p>Restore creates a new draft. Historical demo snapshots remain unchanged.</p>
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
                Restore to draft
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MiniSite({ config, selectedBlock }: { config: SiteConfig; selectedBlock?: string }) {
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
        <span>Services &nbsp; Insights &nbsp; Contact</span>
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
            {block.kind === 'cta' && <button>Start an inquiry</button>}
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
  const workspace = store.workspaces[workspaceId];
  const [selectedId, setSelectedId] = useState(itemId ?? workspace.draft.content[0]?.id);
  const selected = workspace.draft.content.find((item) => item.id === selectedId);
  const [status, setStatus] = useState('');
  const update = (changes: Partial<ContentRecord>) =>
    selected &&
    store.updateDraft(workspaceId, (config) => ({
      ...config,
      content: config.content.map((item) =>
        item.id === selected.id ? { ...item, ...changes } : item
      )
    }));
  return (
    <div className="content-workbench">
      <Card className="content-list">
        <div className="section-heading">
          <div>
            <h2>Content library</h2>
            <p>Fixture packages mirror reviewed Lite content lineage.</p>
          </div>
          <Button disabled={readOnly}>New content</Button>
        </div>
        {workspace.draft.content.map((item) => (
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
              <h2>Edit content</h2>
            </div>
            <Badge>{selected.status}</Badge>
          </div>
          <fieldset disabled={readOnly}>
            <TextInput
              label="Title"
              value={selected.title}
              onChange={(event) => update({ title: event.target.value, status: 'DRAFT' })}
            />
            <TextArea
              label="Excerpt"
              rows={3}
              value={selected.excerpt}
              onChange={(event) => update({ excerpt: event.target.value, status: 'DRAFT' })}
            />
            <TextArea
              label="Body"
              rows={10}
              value={selected.body}
              onChange={(event) => update({ body: event.target.value, status: 'DRAFT' })}
            />
            <Select
              label="Related service"
              value={selected.relatedServiceId}
              onChange={(event) =>
                update({ relatedServiceId: event.target.value, status: 'DRAFT' })
              }
            >
              {workspace.draft.services.map((service) => (
                <option value={service.id} key={service.id}>
                  {service.title}
                </option>
              ))}
            </Select>
          </fieldset>
          <Alert title="Publication boundary">
            This demo action changes the Site preview snapshot only. It does not bypass Lite human
            review or publish externally.
          </Alert>
          <div className="card-actions">
            <Link
              className="button-link secondary"
              href={`/site/${workspaceId}/preview/draft/insights/${selected.slug}`}
            >
              Preview draft route
            </Link>
            <Button
              disabled={readOnly}
              onClick={() => {
                update({ status: 'PUBLISHED', version: selected.version + 1 });
                store.saveDraft(workspaceId);
                setStatus('Content prepared in the Site draft');
              }}
            >
              Prepare demo publication
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
                        ? { ...item, status: 'PUBLISHED', version: nextVersion }
                        : item
                    )
                  })
                );
                setStatus(`Content and Site demo published as v${version}`);
              }}
            >
              Publish content demo
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
  const workspace = store.workspaces[workspaceId];
  return (
    <div className="service-admin-grid">
      {workspace.draft.services.map((service) => (
        <Card key={service.id} className="service-admin-card">
          <div className="section-heading">
            <Badge>
              {service.productRef} · v{service.version}
            </Badge>
            <Checkbox
              label="Visible"
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
              <dt>Markets</dt>
              <dd>{service.markets.join(', ')}</dd>
            </div>
            <div>
              <dt>Fee display</dt>
              <dd>{service.feeNote}</dd>
            </div>
            <div>
              <dt>Authority</dt>
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
  const workspace = store.workspaces[workspaceId];
  const selected = workspace.leads.find((lead) => lead.id === itemId) ?? workspace.leads[0];
  if (!workspace.leads.length)
    return (
      <EmptyState
        title="No demo leads yet"
        description="Complete an inquiry on this Workspace's Site Front. The submitted demo object will appear here with the same ID and source lineage."
        action={
          <Link className="button-link" href={`/site/${workspaceId}/contact`}>
            Open inquiry path
          </Link>
        }
      />
    );
  return (
    <div className="leads-layout">
      <Card className="lead-list">
        <h2>Inbox</h2>
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
        <span className="eyebrow">Visitor message</span>
        <p>{lead.message}</p>
      </section>
      <section>
        <h3>Attribution lineage</h3>
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
      <Alert title="Handoff boundary">
        Qualifying this demo lead does not create a Customer Relationship, Quote, Order, Payment,
        Matter, provider selection, or protected action.
      </Alert>
      <div className="card-actions">
        <Button
          variant="secondary"
          disabled={readOnly}
          onClick={() => store.updateLead(workspaceId, lead.id, 'QUALIFIED')}
        >
          Mark qualified
        </Button>
        <Button
          disabled={readOnly}
          onClick={() => store.updateLead(workspaceId, lead.id, 'FOLLOW_UP')}
        >
          Prepare follow-up
        </Button>
      </div>
    </Card>
  );
}

function ClientService({ workspaceId }: { workspaceId: WorkspaceId }) {
  return (
    <div className="screen-stack">
      <Alert title="Projection only">
        These demo requests illustrate a future Site view. Order, Matter, official status, payment,
        and provider truth remain with their current owners.
      </Alert>
      <Card className="table-card">
        <div className="section-heading">
          <div>
            <h2>Customer requests</h2>
            <p>Example read projections, clearly labelled as demo.</p>
          </div>
          <Badge>Demo data</Badge>
        </div>
        <div className="data-table">
          <div className="data-row data-head">
            <span>Reference</span>
            <span>Request</span>
            <span>Stage</span>
            <span>Last update</span>
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
  const workspace = usePreviewStore().workspaces[workspaceId];
  const contentLeads = workspace.leads.filter((lead) => lead.sourceContentId).length;
  return (
    <div className="screen-stack">
      {workspace.analyticsPartial && (
        <Alert tone="warning" title="Partial demo analytics">
          Traffic source detail is unavailable for this Workspace fixture. No missing values were
          inferred.
        </Alert>
      )}
      <section className="metric-grid">
        <Metric label="Illustrative visitors" value="2,193" delta="Fixture only · no live denominator" />
        <Metric
          label="Inquiry rate"
          value="Unavailable"
          delta="No measured visitor denominator"
        />
        <Metric
          label="Content-assisted leads"
          value={String(contentLeads)}
          delta="Exact local lineage"
        />
        <Metric label="Top market" value={workspace.draft.market} delta="Fixture signal" />
      </section>
      <div className="dashboard-grid">
        <Card>
          <div className="section-heading">
            <div>
              <h2>Conversion path</h2>
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
          <h2>Content to demand</h2>
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
  const workspace = store.workspaces[workspaceId];
  const [status, setStatus] = useState('');
  return (
    <div className="dashboard-grid">
      <Card>
        <span className="eyebrow">Demo domain</span>
        <h2>{workspace.draft.domain}</h2>
        <div className="domain-state">
          <span className="status-dot warning" />
          <div>
            <strong>Verification not executed</strong>
            <p>DNS changes and host activation are outside this preview.</p>
          </div>
        </div>
        <TextInput
          disabled={readOnly}
          label="Proposed hostname"
          value={workspace.draft.domain}
          onChange={(event) =>
            store.updateDraft(workspaceId, (config) => ({ ...config, domain: event.target.value }))
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
        <span className="eyebrow">Search preview</span>
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
  const workspace = store.workspaces[workspaceId];
  const config = workspace.draft;
  return (
    <div className="dashboard-grid">
      <Card>
        <h2>Modules</h2>
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
        <h2>Workspace & access</h2>
        <Select
          disabled={readOnly}
          label="Demo permission"
          value={workspace.role}
          onChange={(event) => store.setRole(workspaceId, event.target.value as 'OWNER' | 'VIEWER')}
        >
          <option value="OWNER">Site manager (editable)</option>
          <option value="VIEWER">Viewer (read-only)</option>
        </Select>
        <Select
          disabled={readOnly}
          label="Locale"
          value={config.locale}
          onChange={(event) =>
            store.updateDraft(workspaceId, (draft) => ({ ...draft, locale: event.target.value }))
          }
        >
          <option value="en-US">English (US)</option>
          <option value="zh-CN">简体中文</option>
        </Select>
        <Alert title="Workspace-owned settings">
          Subscription, billing method, team identity, and primary permissions remain in Workspace
          Console and are not recreated here.
        </Alert>
        <Button variant="danger" disabled={readOnly} onClick={() => store.reset(workspaceId)}>
          Reset this demo Workspace
        </Button>
        {readOnly && (
          <div className="demo-access-reset">
            <Alert tone="warning" title="Demo access recovery">
              This resets browser-local fixtures to the seeded OWNER state. It is not an
              authorization path for a production Workspace.
            </Alert>
            <Button variant="secondary" onClick={() => store.resetDemoAccess(workspaceId)}>
              Reset demo access and fixtures
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
