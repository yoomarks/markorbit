import { useEffect, useMemo, useState } from 'react';
import { Button } from '@markorbit/ui';
import {
  authorizedItems,
  defaultState,
  identities,
  identityFor,
  readStoredState,
  relationshipFor,
  type Channel,
  type BusinessItem,
  type FixtureMode,
  type PortalSection,
  type PortalState
} from './domain.js';
import { getCopy } from './i18n.js';
import './customer-portal-preview.css';

const icons: Record<PortalSection, string> = {
  overview: '⌂',
  business: '◫',
  assets: '◇',
  orders: '◎',
  files: '▤',
  messages: '◌',
  account: '○'
};

const sections = Object.keys(icons) as PortalSection[];

export interface CustomerPortalPreviewProps {
  storageKey?: string;
  fixtureMode?: FixtureMode;
  defaultChannel?: Channel;
  persist?: boolean;
}

export function CustomerPortalPreview({
  storageKey = 'markorbit.customer-portal-v12.demo',
  fixtureMode = 'success',
  defaultChannel = 'web',
  persist = true
}: CustomerPortalPreviewProps) {
  const [state, setState] = useState<PortalState>(() => {
    const initial = persist ? readStoredState(storageKey) : defaultState;
    return {
      ...initial,
      channel: defaultChannel,
      ...(fixtureMode === 'signed-out'
        ? { identityId: null, relationshipId: null }
        : !initial.identityId && !persist
          ? { identityId: 'acct-demo-mei', relationshipId: 'cr-atlas-mei-001' }
          : {})
    };
  });
  const [dialog, setDialog] = useState<'relationships' | 'consult' | 'claim' | 'upload' | null>(
    null
  );
  const [liveMessage, setLiveMessage] = useState('');
  const copy = getCopy(state.locale);
  const identity = identityFor(state);
  const relationship = relationshipFor(state);
  const items = useMemo(() => authorizedItems(state), [state]);

  useEffect(() => {
    if (persist) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [persist, state, storageKey]);

  const update = (next: Partial<PortalState>, announcement?: string) => {
    setState((current) => ({ ...current, ...next }));
    if (announcement) setLiveMessage(announcement);
  };

  const login = (identityId = 'acct-demo-mei') => {
    const nextIdentity = identities.find((value) => value.accountId === identityId)!;
    update(
      {
        identityId,
        relationshipId: nextIdentity.bindings[0]?.relationshipId ?? null,
        section: 'overview',
        claimStatus: 'IDLE'
      },
      state.locale === 'zh-CN' ? '已验证 Demo 登录' : 'Demo sign-in verified'
    );
  };

  const switchChannel = () => {
    const channel = state.channel === 'web' ? 'mini' : 'web';
    update({ channel }, channel === 'mini' ? '已切换到小程序演示视图' : '已返回网站视图');
    const url = new URL(window.location.href);
    url.searchParams.set('channel', channel);
    window.history.replaceState({}, '', url);
  };

  const logout = () => {
    update({ identityId: null, relationshipId: null, section: 'overview' });
  };

  if (fixtureMode === 'loading') return <StatusScreen kind="loading" copy={copy} />;
  if (fixtureMode === 'error') return <StatusScreen kind="error" copy={copy} />;

  if (!identity || !relationship) {
    return (
      <LoginScreen
        state={state}
        onLocale={() => update({ locale: state.locale === 'zh-CN' ? 'en-US' : 'zh-CN' })}
        onLogin={() => login()}
        onConsult={() => setDialog('consult')}
        onClaim={() => setDialog('claim')}
      >
        {dialog === 'consult' && (
          <ConsultDialog
            state={state}
            onClose={() => setDialog(null)}
            onSubmit={() => {
              update({ consultationReference: 'LEAD-DEMO-260928' });
              setDialog(null);
            }}
          />
        )}
        {dialog === 'claim' && (
          <ClaimDialog
            state={state}
            onClose={() => setDialog(null)}
            onReject={() => update({ claimStatus: 'REJECTED' })}
          />
        )}
      </LoginScreen>
    );
  }

  return (
    <div className={`cp-app cp-${state.channel}`} data-channel={state.channel}>
      <a className="cp-skip" href="#portal-main">
        {state.locale === 'zh-CN' ? '跳到主要内容' : 'Skip to main content'}
      </a>
      <div className="cp-live" aria-live="polite">
        {liveMessage}
      </div>
      <aside
        className="cp-sidebar"
        aria-label={state.locale === 'zh-CN' ? '客户中心导航' : 'Portal navigation'}
      >
        <Brand copy={copy} />
        <nav>
          {sections.map((section) => (
            <button
              className={state.section === section ? 'is-active' : ''}
              key={section}
              onClick={() => update({ section })}
              aria-current={state.section === section ? 'page' : undefined}
            >
              <span aria-hidden="true">{icons[section]}</span>
              {copy.nav[section]}
              {section === 'messages' && state.unreadMessages > 0 && (
                <b className="cp-count">{state.unreadMessages}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="cp-sidebar-foot">
          <span className="cp-avatar">{identity.displayName.slice(0, 1)}</span>
          <span>
            <strong>{identity.displayName}</strong>
            <small>{identity.maskedMobile}</small>
          </span>
        </div>
      </aside>

      <div className="cp-workspace">
        <DemoBanner copy={copy} />
        <header className="cp-topbar">
          <button className="cp-mobile-brand" onClick={() => update({ section: 'overview' })}>
            <span className="cp-mark">M</span>
            <span>{copy.product}</span>
          </button>
          <button className="cp-context" onClick={() => setDialog('relationships')}>
            <span className="cp-context-dot" aria-hidden="true" />
            <span>
              <small>{copy.relationship}</small>
              <strong>{relationship.workspaceName}</strong>
            </span>
            <span aria-hidden="true">⌄</span>
          </button>
          <div className="cp-top-actions">
            <span className="cp-channel-tag">
              {state.channel === 'web'
                ? 'WEB'
                : state.locale === 'zh-CN'
                  ? '小程序适配'
                  : 'MINI ADAPTED'}
            </span>
            <button
              className="cp-quiet-button"
              onClick={() => update({ locale: state.locale === 'zh-CN' ? 'en-US' : 'zh-CN' })}
            >
              {copy.language}
            </button>
            <button
              className="cp-user-button"
              onClick={() => update({ section: 'account' })}
              aria-label={copy.accountTitle}
            >
              {identity.displayName.slice(0, 1)}
            </button>
          </div>
        </header>

        <main id="portal-main" className="cp-main">
          {fixtureMode === 'permission' ? (
            <StatusScreen kind="permission" copy={copy} />
          ) : fixtureMode === 'empty' ? (
            <EmptyState copy={copy} />
          ) : (
            <PortalSectionView
              state={state}
              fixtureMode={fixtureMode}
              items={items}
              onSection={(section) => update({ section })}
              onUpload={() => setDialog('upload')}
              onChannel={switchChannel}
              onRelationship={() => setDialog('relationships')}
              onLogout={logout}
            />
          )}
        </main>

        <nav
          className="cp-bottom-nav"
          aria-label={state.locale === 'zh-CN' ? '小程序主导航' : 'Mini primary navigation'}
        >
          {(['overview', 'business', 'files', 'account'] as PortalSection[]).map((section) => (
            <button
              key={section}
              className={state.section === section ? 'is-active' : ''}
              onClick={() => update({ section })}
              aria-current={state.section === section ? 'page' : undefined}
            >
              <span aria-hidden="true">{icons[section]}</span>
              <small>{copy.nav[section]}</small>
            </button>
          ))}
        </nav>
      </div>

      {dialog === 'relationships' && (
        <RelationshipDialog
          state={state}
          onClose={() => setDialog(null)}
          onSelect={(relationshipId) => {
            update({ relationshipId, section: 'overview' });
            setDialog(null);
          }}
          onScenario={(identityId) => {
            login(identityId);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'upload' && (
        <UploadDialog
          state={state}
          onClose={() => setDialog(null)}
          onSubmit={() => {
            update(
              { documentSubmitted: true, taskConfirmed: true, unreadMessages: 1 },
              copy.submitted
            );
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function Brand({ copy }: { copy: ReturnType<typeof getCopy> }) {
  return (
    <div className="cp-brand">
      <span className="cp-mark">M</span>
      <span>
        <strong>MarkOrbit</strong>
        <small>{copy.product}</small>
      </span>
    </div>
  );
}

function DemoBanner({ copy }: { copy: ReturnType<typeof getCopy> }) {
  return (
    <div className="cp-demo-banner" role="note">
      <strong>{copy.demo}</strong>
      <span>{copy.demoTruth}</span>
    </div>
  );
}

function LoginScreen({
  state,
  onLocale,
  onLogin,
  onConsult,
  onClaim,
  children
}: {
  state: PortalState;
  onLocale: () => void;
  onLogin: () => void;
  onConsult: () => void;
  onClaim: () => void;
  children?: React.ReactNode;
}) {
  const copy = getCopy(state.locale);
  return (
    <div className={`cp-login cp-${state.channel}`}>
      <div className="cp-login-top">
        <Brand copy={copy} />
        <button className="cp-quiet-button" onClick={onLocale}>
          {copy.language}
        </button>
      </div>
      <div className="cp-login-truth">
        <strong>{copy.demo}</strong> · {copy.demoTruth}
      </div>
      <main className="cp-login-layout">
        <section className="cp-login-story">
          <span className="cp-eyebrow">ONE ACCOUNT · MANY WORKSPACE RELATIONSHIPS</span>
          <h1>{copy.loginTitle}</h1>
          <p>{copy.loginSubtitle}</p>
          <div className="cp-trust-diagram" aria-label={copy.relationshipHint}>
            <span>MO ID</span>
            <i aria-hidden="true" />
            <span>Workspace</span>
            <i aria-hidden="true" />
            <span>Customer</span>
            <i aria-hidden="true" />
            <span>Object grant</span>
          </div>
        </section>
        <section className="cp-login-card" aria-label={copy.loginTitle}>
          <span className="cp-secure">
            ● {state.locale === 'zh-CN' ? '安全演示环境' : 'Secure Demo environment'}
          </span>
          <Button className="cp-primary cp-login-button" onClick={onLogin}>
            {state.channel === 'mini' ? copy.miniLogin : copy.moLogin}
          </Button>
          {state.channel === 'mini' && <p className="cp-inline-warning">{copy.miniLoginTruth}</p>}
          <div className="cp-divider">
            <span>{state.locale === 'zh-CN' ? '其他方式' : 'Other paths'}</span>
          </div>
          <Button variant="secondary" className="cp-secondary" onClick={onClaim}>
            {copy.claim}
          </Button>
          <button className="cp-text-button" onClick={onConsult}>
            {copy.visitor} <strong>{copy.consult} →</strong>
          </button>
          {state.consultationReference && (
            <div className="cp-success-note" role="status">
              <strong>{copy.leadCreated}</strong>
              <span>{state.consultationReference}</span>
              <small>{copy.leadOnly}</small>
            </div>
          )}
          {state.claimStatus === 'REJECTED' && (
            <div className="cp-error-note" role="alert">
              {copy.claimRejected}
            </div>
          )}
        </section>
      </main>
      <footer className="cp-login-footer">{copy.footerTruth}</footer>
      {children}
    </div>
  );
}

function PortalSectionView({
  state,
  fixtureMode,
  items,
  onSection,
  onUpload,
  onChannel,
  onRelationship,
  onLogout
}: {
  state: PortalState;
  fixtureMode: FixtureMode;
  items: ReturnType<typeof authorizedItems>;
  onSection: (section: PortalSection) => void;
  onUpload: () => void;
  onChannel: () => void;
  onRelationship: () => void;
  onLogout: () => void;
}) {
  const copy = getCopy(state.locale);
  const identity = identityFor(state)!;
  const relationship = relationshipFor(state)!;
  const matter = items.find((item) => item.kind === 'MATTER');
  const localized = (zh: string, en: string) => (state.locale === 'zh-CN' ? zh : en);

  if (state.section === 'overview') {
    return (
      <>
        <header className="cp-page-heading">
          <div>
            <span className="cp-eyebrow">{relationship.customerName}</span>
            <h1>
              {copy.welcome}，{identity.displayName.split(' ')[0]}
            </h1>
            <p>{copy.today}</p>
          </div>
          <Button
            variant="secondary"
            className="cp-secondary cp-desktop-action"
            onClick={onRelationship}
          >
            {copy.switch} {copy.relationship}
          </Button>
        </header>
        <section className="cp-metrics" aria-label={copy.activity}>
          <Metric value={state.taskConfirmed ? '0' : '1'} label={copy.tasks} accent />
          <Metric
            value={String(items.filter((item) => item.kind === 'MATTER').length)}
            label={copy.businessTitle}
          />
          <Metric
            value={String(items.filter((item) => item.kind === 'ASSET').length)}
            label={copy.assetsTitle}
          />
          <Metric value={String(state.unreadMessages)} label={copy.messagesTitle} />
        </section>
        <div className="cp-dashboard-grid">
          <section className="cp-panel cp-task-panel">
            <PanelHeading
              title={copy.tasks}
              action={copy.viewAll}
              onAction={() => onSection('files')}
            />
            {state.taskConfirmed ? (
              <div className="cp-complete-state">
                <span>✓</span>
                <strong>{localized('当前没有待办', 'You are all caught up')}</strong>
                <p>
                  {localized(
                    '已提交的 Demo 资料在网站与小程序视图保持一致。',
                    'The submitted Demo document is consistent across Web and mini views.'
                  )}
                </p>
              </div>
            ) : (
              <article className="cp-task-card">
                <div className="cp-task-icon">DOC</div>
                <div>
                  <span className="cp-pill cp-pill-warm">{localized('今天到期', 'Due today')}</span>
                  <h2>{copy.upload}</h2>
                  <p>{matter ? localized(matter.detail, matter.detailEn) : 'MO-CN-2026-0184'}</p>
                  <small>{copy.stableId}: matter-cn-nova-2026</small>
                </div>
                <Button className="cp-primary" onClick={onUpload}>
                  {copy.continue}
                </Button>
              </article>
            )}
          </section>
          <section className="cp-panel cp-channel-panel">
            <span className="cp-orbit-art" aria-hidden="true">
              <i />
              <i />
              <b>M</b>
            </span>
            <span className="cp-eyebrow">{copy.crossChannel}</span>
            <h2>{localized('随时换设备，业务不换轨', 'Change channel, keep the same work')}</h2>
            <p>{copy.sameObjects}</p>
            <button className="cp-inverse" onClick={onChannel}>
              {state.channel === 'web' ? copy.openMini : copy.openWeb} →
            </button>
          </section>
        </div>
        <section className="cp-panel cp-activity-panel">
          <PanelHeading
            title={copy.activity}
            action={copy.viewAll}
            onAction={() => onSection('business')}
          />
          <div className="cp-business-list">
            {items
              .filter((item) => item.kind !== 'ASSET')
              .map((item) => (
                <BusinessRow key={item.id} state={state} item={item} />
              ))}
          </div>
        </section>
        {fixtureMode === 'partial' && <PartialNotice copy={copy} />}
      </>
    );
  }

  if (state.section === 'business') {
    return (
      <CollectionPage
        title={copy.businessTitle}
        subtitle={copy.businessSubtitle}
        state={state}
        items={items.filter((item) => item.kind === 'MATTER')}
      />
    );
  }
  if (state.section === 'assets') {
    return (
      <CollectionPage
        title={copy.assetsTitle}
        subtitle={copy.partialHint}
        state={state}
        items={items.filter((item) => item.kind === 'ASSET')}
        partial
      />
    );
  }
  if (state.section === 'orders') {
    return (
      <CollectionPage
        title={copy.ordersTitle}
        subtitle={copy.paymentTruth}
        state={state}
        items={items.filter((item) => item.kind === 'ORDER')}
      />
    );
  }
  if (state.section === 'files') {
    return (
      <SimplePage
        title={copy.filesTitle}
        subtitle={localized(
          '按业务对象归档，并逐项校验访问授权。',
          'Filed by business object with access checked for each item.'
        )}
      >
        <article className="cp-file-card">
          <span className="cp-file-type">PDF</span>
          <div>
            <h2>{localized('商标申请委托确认书', 'Trademark filing instruction confirmation')}</h2>
            <p>matter-cn-nova-2026 · 2026-09-26</p>
            <small>{copy.source}: MarkReg Document Package · Demo</small>
          </div>
          <span className="cp-pill">{localized('已签署', 'Signed')}</span>
        </article>
        <article className="cp-file-card">
          <span className="cp-file-type cp-file-type-upload">↑</span>
          <div>
            <h2>{copy.upload}</h2>
            <p>
              {state.documentSubmitted
                ? localized(
                    '已提交 Demo 文件 · first-use-statement.pdf',
                    'Demo file submitted · first-use-statement.pdf'
                  )
                : copy.uploadHint}
            </p>
            <small>{copy.stableId}: matter-cn-nova-2026</small>
          </div>
          <Button
            variant={state.documentSubmitted ? 'secondary' : 'primary'}
            className={state.documentSubmitted ? 'cp-secondary' : 'cp-primary'}
            onClick={onUpload}
          >
            {state.documentSubmitted ? copy.submitted : copy.continue}
          </Button>
        </article>
      </SimplePage>
    );
  }
  if (state.section === 'messages') {
    return (
      <SimplePage
        title={copy.messagesTitle}
        subtitle={localized(
          '通知与业务对象关联；送达不等于接受或完成。',
          'Notifications are linked to objects; delivery is not acceptance or completion.'
        )}
      >
        <Message
          text={copy.messageOne}
          id="matter-cn-nova-2026"
          unread={!state.documentSubmitted}
          copy={copy}
        />
        <Message text={copy.messageTwo} id="order-us-nova-042" unread={false} copy={copy} />
      </SimplePage>
    );
  }
  return (
    <SimplePage title={copy.accountTitle} subtitle={copy.relationshipHint}>
      <div className="cp-account-grid">
        <section className="cp-panel cp-account-card">
          <span className="cp-avatar cp-avatar-large">{identity.displayName.slice(0, 1)}</span>
          <div>
            <span className="cp-eyebrow">{copy.identity}</span>
            <h2>{identity.displayName}</h2>
            <p>{identity.maskedMobile}</p>
            <small>accountId · {identity.accountId}</small>
          </div>
        </section>
        <section className="cp-panel">
          <span className="cp-eyebrow">{copy.relationship}</span>
          <h2>{relationship.customerName}</h2>
          <p>{relationship.workspaceName}</p>
          <dl>
            <div>
              <dt>ID</dt>
              <dd>{relationship.relationshipId}</dd>
            </div>
            <div>
              <dt>{copy.represented}</dt>
              <dd>
                {relationship.kind === 'ENTERPRISE'
                  ? relationship.customerName
                  : localized('本人', 'Self')}
              </dd>
            </div>
          </dl>
          <Button variant="secondary" className="cp-secondary" onClick={onRelationship}>
            {copy.switch}
          </Button>
        </section>
      </div>
      <section className="cp-panel cp-member-panel">
        <PanelHeading title={copy.members} />
        <div className="cp-member-row">
          <span className="cp-avatar">陈</span>
          <div>
            <strong>{copy.memberMei}</strong>
            <small>ACTIVE · relationship owner verified</small>
          </div>
        </div>
        <div className="cp-member-row">
          <span className="cp-avatar cp-avatar-teal">赵</span>
          <div>
            <strong>{copy.memberZhao}</strong>
            <small>{copy.noGrant}</small>
          </div>
        </div>
      </section>
      <Button variant="danger" className="cp-danger-button" onClick={onLogout}>
        {copy.logout}
      </Button>
    </SimplePage>
  );
}

function Metric({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`cp-metric ${accent ? 'is-accent' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <i aria-hidden="true" />
    </div>
  );
}

function PanelHeading({
  title,
  action,
  onAction
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="cp-panel-heading">
      <h2>{title}</h2>
      {action && (
        <button className="cp-text-button" onClick={onAction}>
          {action} →
        </button>
      )}
    </div>
  );
}

function BusinessRow({ state, item }: { state: PortalState; item: BusinessItem }) {
  const copy = getCopy(state.locale);
  return (
    <article className="cp-business-row">
      <span className={`cp-object-icon cp-object-${item.kind.toLowerCase()}`}>
        {item.kind.slice(0, 1)}
      </span>
      <div>
        <h3>{state.locale === 'zh-CN' ? item.title : item.titleEn}</h3>
        <p>{state.locale === 'zh-CN' ? item.detail : item.detailEn}</p>
        <small>
          {copy.stableId}: {item.id}
        </small>
      </div>
      <span className="cp-status">
        <i aria-hidden="true" />
        {state.locale === 'zh-CN' ? item.status : item.statusEn}
      </span>
      <button className="cp-row-action" aria-label={`${copy.continue}: ${item.id}`}>
        →
      </button>
    </article>
  );
}

function CollectionPage({
  title,
  subtitle,
  state,
  items,
  partial
}: {
  title: string;
  subtitle: string;
  state: PortalState;
  items: readonly BusinessItem[];
  partial?: boolean;
}) {
  const copy = getCopy(state.locale);
  return (
    <SimplePage title={title} subtitle={subtitle}>
      {partial && <PartialNotice copy={copy} />}
      {items.length ? (
        <section className="cp-panel cp-collection">
          {items.map((item) => (
            <BusinessRow key={item.id} state={state} item={item} />
          ))}
        </section>
      ) : (
        <EmptyState copy={copy} />
      )}
    </SimplePage>
  );
}

function SimplePage({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="cp-page-heading">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="cp-page-stack">{children}</div>
    </>
  );
}

function PartialNotice({ copy }: { copy: ReturnType<typeof getCopy> }) {
  return (
    <div className="cp-partial" role="status">
      <span aria-hidden="true">◐</span>
      <div>
        <strong>{copy.partial}</strong>
        <p>{copy.partialHint}</p>
        <small>{copy.source}: CNIPA projection · 2026-09-25 09:40 CST</small>
      </div>
    </div>
  );
}

function Message({
  text,
  id,
  unread,
  copy
}: {
  text: string;
  id: string;
  unread: boolean;
  copy: ReturnType<typeof getCopy>;
}) {
  return (
    <article className={`cp-message ${unread ? 'is-unread' : ''}`}>
      <span className="cp-message-dot" aria-hidden="true" />
      <div>
        <h2>{text}</h2>
        <p>
          {copy.stableId}: {id}
        </p>
        <small>{copy.latest}</small>
      </div>
    </article>
  );
}

function StatusScreen({
  kind,
  copy
}: {
  kind: 'loading' | 'error' | 'permission';
  copy: ReturnType<typeof getCopy>;
}) {
  if (kind === 'loading')
    return (
      <section className="cp-status-screen" aria-busy="true">
        <span className="cp-loader" />
        <h1>{copy.loading}</h1>
        <p>{copy.demoTruth}</p>
      </section>
    );
  return (
    <section className="cp-status-screen">
      <span className="cp-status-symbol">{kind === 'error' ? '!' : '×'}</span>
      <h1>{kind === 'error' ? copy.ownerUnavailable : copy.permissionDenied}</h1>
      <p>{kind === 'error' ? copy.demoTruth : copy.permissionHint}</p>
      <Button className="cp-primary">{copy.retry}</Button>
    </section>
  );
}

function EmptyState({ copy }: { copy: ReturnType<typeof getCopy> }) {
  return (
    <section className="cp-empty">
      <span aria-hidden="true">◇</span>
      <h1>{copy.noObjects}</h1>
      <p>{copy.businessSubtitle}</p>
    </section>
  );
}

function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="cp-modal-backdrop" role="presentation">
      <section
        className="cp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-modal-title"
      >
        <header>
          <h1 id="cp-modal-title">{title}</h1>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function RelationshipDialog({
  state,
  onClose,
  onSelect,
  onScenario
}: {
  state: PortalState;
  onClose: () => void;
  onSelect: (id: string) => void;
  onScenario: (id: string) => void;
}) {
  const copy = getCopy(state.locale);
  const identity = identityFor(state)!;
  return (
    <Modal title={copy.selectRelationship} onClose={onClose}>
      <p className="cp-modal-lead">{copy.relationshipHint}</p>
      <div className="cp-relationship-list">
        {identity.bindings.map((binding) => (
          <button
            key={binding.relationshipId}
            className={state.relationshipId === binding.relationshipId ? 'is-current' : ''}
            onClick={() => onSelect(binding.relationshipId)}
          >
            <span className="cp-avatar">{binding.workspaceName.slice(0, 1)}</span>
            <span>
              <strong>{binding.customerName}</strong>
              <small>{binding.workspaceName}</small>
              <code>{binding.relationshipId}</code>
            </span>
            <b>{state.relationshipId === binding.relationshipId ? copy.current : '→'}</b>
          </button>
        ))}
      </div>
      <div className="cp-scenario-lab">
        <span className="cp-eyebrow">DEMO ISOLATION LAB</span>
        <p>
          {state.locale === 'zh-CN'
            ? '切换主体以验证同 Workspace 客户隔离与企业对象授权。'
            : 'Switch subject to verify same-Workspace customer isolation and enterprise object grants.'}
        </p>
        <div>
          <Button
            variant="secondary"
            className="cp-secondary"
            onClick={() => onScenario('acct-demo-liuya')}
          >
            刘娅 · other customer
          </Button>
          <Button
            variant="secondary"
            className="cp-secondary"
            onClick={() => onScenario('acct-demo-zhaolin')}
          >
            赵霖 · enterprise grant
          </Button>
          <Button
            variant="secondary"
            className="cp-secondary"
            onClick={() => onScenario('acct-demo-mei')}
          >
            陈玫 · primary
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function UploadDialog({
  state,
  onClose,
  onSubmit
}: {
  state: PortalState;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const copy = getCopy(state.locale);
  return (
    <Modal title={copy.upload} onClose={onClose}>
      <div className="cp-upload-zone">
        <span>↑</span>
        <strong>{state.locale === 'zh-CN' ? '选择 Demo 文件' : 'Choose Demo file'}</strong>
        <p>{copy.uploadHint}</p>
        <code>first-use-statement.pdf · 1.8 MB</code>
      </div>
      <label className="cp-check">
        <input type="checkbox" defaultChecked />
        <span>
          {state.locale === 'zh-CN'
            ? '我确认此资料用于 matter-cn-nova-2026，且有权提交。'
            : 'I confirm this document is for matter-cn-nova-2026 and I am authorized to submit it.'}
        </span>
      </label>
      <Button className="cp-primary cp-full" onClick={onSubmit}>
        {copy.confirmTask}
      </Button>
    </Modal>
  );
}

function ConsultDialog({
  state,
  onClose,
  onSubmit
}: {
  state: PortalState;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const copy = getCopy(state.locale);
  return (
    <Modal title={copy.consultTitle} onClose={onClose}>
      <p className="cp-modal-lead">{copy.consultTruth}</p>
      <label className="cp-field">
        <span>{state.locale === 'zh-CN' ? '怎么称呼你' : 'Your name'}</span>
        <input defaultValue="陈玫" />
      </label>
      <label className="cp-field">
        <span>{state.locale === 'zh-CN' ? '咨询内容' : 'What can we help with?'}</span>
        <textarea
          defaultValue={
            state.locale === 'zh-CN'
              ? '想了解美国商标申请。'
              : 'I would like to learn about a US trademark filing.'
          }
        />
      </label>
      <label className="cp-check">
        <input type="checkbox" defaultChecked />
        <span>
          {state.locale === 'zh-CN'
            ? '我同意将以上信息用于本次咨询回复。'
            : 'I consent to using this information to respond to this inquiry.'}
        </span>
      </label>
      <Button className="cp-primary cp-full" onClick={onSubmit}>
        {copy.createLead}
      </Button>
    </Modal>
  );
}

function ClaimDialog({
  state,
  onClose,
  onReject
}: {
  state: PortalState;
  onClose: () => void;
  onReject: () => void;
}) {
  const copy = getCopy(state.locale);
  return (
    <Modal title={copy.claimTitle} onClose={onClose}>
      <p className="cp-modal-lead">{copy.claimHint}</p>
      <label className="cp-field">
        <span>{state.locale === 'zh-CN' ? '机构邀请码' : 'Institution invitation code'}</span>
        <input defaultValue="WRONG-2609" />
      </label>
      <Button
        className="cp-primary cp-full"
        onClick={() => {
          onReject();
          onClose();
        }}
      >
        {copy.claimAction}
      </Button>
    </Modal>
  );
}
