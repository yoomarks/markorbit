import { useEffect, useMemo, useState } from 'react';
import { Button } from '@markorbit/ui';
import {
  authorizedItems,
  defaultState,
  identities,
  identityFor,
  quoteFixture,
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
  home: '⌂',
  services: '＋',
  progress: '◫',
  trademarks: '◇',
  messages: '◌',
  profile: '○'
};
const desktopSections: PortalSection[] = ['home', 'progress', 'trademarks', 'messages', 'profile'];
const mobileSections: PortalSection[] = ['home', 'services', 'progress', 'messages', 'profile'];

export interface CustomerPortalPreviewProps {
  storageKey?: string;
  fixtureMode?: FixtureMode;
  defaultChannel?: Channel;
  defaultLocale?: PortalState['locale'];
  persist?: boolean;
}

export function CustomerPortalPreview({
  storageKey = 'markorbit.customer-portal-v12.demo',
  fixtureMode = 'success',
  defaultChannel = 'web',
  defaultLocale = 'zh-CN',
  persist = true
}: CustomerPortalPreviewProps) {
  const [state, setState] = useState<PortalState>(() => {
    const initial = persist ? readStoredState(storageKey) : defaultState;
    return {
      ...initial,
      channel: defaultChannel,
      locale: defaultLocale,
      ...(fixtureMode === 'signed-out'
        ? { identityId: null, relationshipId: null }
        : !initial.identityId && !persist
          ? { identityId: 'acct-demo-mei', relationshipId: 'cr-atlas-mei-001' }
          : {})
    };
  });
  const [dialog, setDialog] = useState<
    'relationships' | 'consult' | 'claim' | 'upload' | 'quote' | null
  >(null);
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
        section: 'home',
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

  const switchLocale = () => {
    const locale = state.locale === 'zh-CN' ? 'en-US' : 'zh-CN';
    update({ locale });
    const url = new URL(window.location.href);
    url.searchParams.set('locale', locale);
    window.history.replaceState({}, '', url);
  };

  const logout = () => {
    update({ identityId: null, relationshipId: null, section: 'home' });
  };

  if (fixtureMode === 'loading') return <StatusScreen kind="loading" copy={copy} />;
  if (fixtureMode === 'error') return <StatusScreen kind="error" copy={copy} />;

  if (!identity || !relationship) {
    return (
      <LoginScreen
        state={state}
        onLocale={switchLocale}
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
          {desktopSections.map((section) => (
            <button
              className={state.section === section ? 'is-active' : ''}
              key={section}
              onClick={() => update({ section })}
              aria-current={state.section === section ? 'page' : undefined}
            >
              <span aria-hidden="true">{icons[section]}</span>
              {section === 'progress' ? copy.desktopBusiness : copy.nav[section]}
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
          <button className="cp-mobile-brand" onClick={() => update({ section: 'home' })}>
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
            <button className="cp-quiet-button" onClick={switchLocale}>
              {copy.language}
            </button>
            <button
              className="cp-user-button"
              onClick={() => update({ section: 'profile' })}
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
              onQuote={() => setDialog('quote')}
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
          {mobileSections.map((section) => (
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
            update({ relationshipId, section: 'home' });
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
      {dialog === 'quote' && (
        <QuoteDialog
          state={state}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            update(
              { quoteStatus: 'CONFIRMED_DEMO', unreadMessages: state.documentSubmitted ? 0 : 1 },
              copy.quoteConfirmed
            );
            setDialog(null);
          }}
          onQuestion={() => {
            update({ quoteStatus: 'QUESTION_SENT_DEMO' }, copy.questionSent);
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
          <span className="cp-eyebrow">ONE ACCOUNT · VERIFIED CUSTOMER ACCESS</span>
          <h1>{copy.loginTitle}</h1>
          <p>{copy.loginSubtitle}</p>
          <div className="cp-trust-diagram" aria-label={copy.relationshipHint}>
            <span>{state.locale === 'zh-CN' ? '统一账号' : 'MO account'}</span>
            <i aria-hidden="true" />
            <span>{state.locale === 'zh-CN' ? '服务机构' : 'Service firm'}</span>
            <i aria-hidden="true" />
            <span>{state.locale === 'zh-CN' ? '办理身份' : 'Acting identity'}</span>
            <i aria-hidden="true" />
            <span>{state.locale === 'zh-CN' ? '业务授权' : 'Business access'}</span>
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
  onQuote,
  onChannel,
  onRelationship,
  onLogout
}: {
  state: PortalState;
  fixtureMode: FixtureMode;
  items: ReturnType<typeof authorizedItems>;
  onSection: (section: PortalSection) => void;
  onUpload: () => void;
  onQuote: () => void;
  onChannel: () => void;
  onRelationship: () => void;
  onLogout: () => void;
}) {
  const copy = getCopy(state.locale);
  const identity = identityFor(state)!;
  const relationship = relationshipFor(state)!;
  const matter = items.find((item) => item.kind === 'MATTER');
  const localized = (zh: string, en: string) => (state.locale === 'zh-CN' ? zh : en);

  const hasDocumentTask = Boolean(matter) && !state.documentSubmitted;
  const canAccessQuote = items.some((item) => item.id === quoteFixture.businessId);
  const hasQuoteTask = canAccessQuote && state.quoteStatus === 'PENDING';
  const pendingCount = Number(hasDocumentTask) + Number(hasQuoteTask);

  if (state.section === 'home') {
    return (
      <>
        <header className="cp-page-heading">
          <div>
            <span className="cp-eyebrow">{relationship.customerName}</span>
            <h1>
              {copy.welcome}，{identity.displayName.split(' ')[0]}
            </h1>
            <p>{pendingCount ? copy.today.replace('2', String(pendingCount)) : copy.noTasksHint}</p>
          </div>
          <Button
            variant="secondary"
            className="cp-secondary cp-desktop-action"
            onClick={onRelationship}
          >
            {copy.switch} {copy.relationship}
          </Button>
        </header>
        <section className="cp-panel cp-task-panel">
          <PanelHeading title={copy.tasks} />
          {pendingCount === 0 ? (
            <div className="cp-complete-state">
              <span>✓</span>
              <strong>{copy.noTasks}</strong>
              <p>{copy.noTasksHint}</p>
              <div className="cp-inline-actions">
                <Button className="cp-primary" onClick={() => onSection('progress')}>
                  {copy.viewProgress}
                </Button>
                <Button
                  variant="secondary"
                  className="cp-secondary"
                  onClick={() => onSection('services')}
                >
                  {copy.startService}
                </Button>
              </div>
            </div>
          ) : (
            <div className="cp-task-list">
              {hasDocumentTask && (
                <TaskCard
                  badge={localized('资料待补充', 'Document needed')}
                  title={copy.upload}
                  detail={matter ? localized(matter.detail, matter.detailEn) : 'MO-CN-2026-0184'}
                  id="matter-cn-nova-2026"
                  copy={copy}
                  onAction={onUpload}
                />
              )}
              {hasQuoteTask && (
                <TaskCard
                  badge={copy.quotePending}
                  title={copy.messageTwo
                    .replace('报价待确认：', '')
                    .replace('Quote to review: ', '')}
                  detail={`${copy.quoteTotal} ¥12,800 · ${copy.quoteValidUntil} ${quoteFixture.validUntil}`}
                  id={quoteFixture.id}
                  copy={copy}
                  onAction={onQuote}
                />
              )}
            </div>
          )}
        </section>
        <section className="cp-quick-actions" aria-label={localized('常用入口', 'Quick actions')}>
          <button onClick={() => onSection('services')}>
            <b>＋</b>
            <span>{copy.startService}</span>
          </button>
          <button onClick={() => onSection('progress')}>
            <b>↗</b>
            <span>{copy.viewProgress}</span>
          </button>
          <button onClick={() => onSection('messages')}>
            <b>◌</b>
            <span>{copy.contactAdvisor}</span>
          </button>
        </section>
        <section className="cp-panel cp-activity-panel">
          <PanelHeading
            title={copy.activity}
            action={copy.viewAll}
            onAction={() => onSection('progress')}
          />
          <div className="cp-business-list">
            {items
              .filter((item) => item.kind !== 'ASSET')
              .map((item) => (
                <BusinessRow key={item.id} state={state} item={item} />
              ))}
          </div>
        </section>
        <section className="cp-continuity-note">
          <div>
            <strong>{copy.crossChannel}</strong>
            <p>{copy.sameObjects}</p>
          </div>
          <button onClick={onChannel}>
            {state.channel === 'web' ? copy.openMini : copy.openWeb} →
          </button>
        </section>
        {fixtureMode === 'partial' && <PartialNotice copy={copy} />}
      </>
    );
  }

  if (state.section === 'services') {
    return (
      <SimplePage title={copy.servicesTitle} subtitle={copy.servicesSubtitle}>
        <section className="cp-service-grid">
          <ServiceCard
            icon="TM"
            title={copy.serviceRegistration}
            hint={copy.serviceRegistrationHint}
            action={copy.startApplication}
          />
          <ServiceCard
            icon="⌕"
            title={copy.serviceSearch}
            hint={copy.serviceSearchHint}
            action={copy.startApplication}
          />
          <ServiceCard
            icon="↗"
            title={copy.serviceResponse}
            hint={copy.serviceResponseHint}
            action={copy.startApplication}
          />
        </section>
        <section className="cp-panel cp-collection">
          <PanelHeading
            title={copy.continueExisting}
            onAction={() => onSection('progress')}
            action={copy.viewAll}
          />
          {items
            .filter((item) => item.kind !== 'ASSET')
            .map((item) => (
              <BusinessRow key={item.id} state={state} item={item} />
            ))}
        </section>
      </SimplePage>
    );
  }

  if (state.section === 'progress') {
    return (
      <SimplePage title={copy.progressTitle} subtitle={copy.progressSubtitle}>
        <div className="cp-filters" role="group" aria-label={copy.progressTitle}>
          <button className="is-active">{copy.filterActive}</button>
          <button>{copy.filterAwaiting}</button>
          <button>{copy.filterDone}</button>
        </div>
        <section className="cp-panel cp-collection">
          {hasQuoteTask && (
            <article className="cp-quote-summary">
              <div>
                <span className="cp-pill cp-pill-warm">{copy.quotePending}</span>
                <h2>{localized(quoteFixture.title, quoteFixture.titleEn)}</h2>
                <p>{quoteFixture.number} · ¥12,800</p>
                <small>
                  {copy.stableId}: {quoteFixture.id}
                </small>
              </div>
              <Button className="cp-primary" onClick={onQuote}>
                {copy.quoteReview}
              </Button>
            </article>
          )}
          {items
            .filter((item) => item.kind !== 'ASSET')
            .map((item) => (
              <BusinessRow key={item.id} state={state} item={item} />
            ))}
        </section>
      </SimplePage>
    );
  }

  if (state.section === 'trademarks') {
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
  if (state.section === 'messages') {
    return (
      <SimplePage
        title={copy.messagesTitle}
        subtitle={localized(
          '资料要求、报价和业务通知都可回到对应业务。',
          'Document requests, quotes and updates link back to the same business.'
        )}
      >
        {matter && (
          <Message
            text={copy.messageOne}
            id={matter.id}
            unread={!state.documentSubmitted}
            copy={copy}
            action={state.documentSubmitted ? undefined : copy.continue}
            onAction={onUpload}
          />
        )}
        {canAccessQuote && (
          <Message
            text={
              state.quoteStatus === 'PENDING'
                ? copy.messageTwo
                : state.quoteStatus === 'CONFIRMED_DEMO'
                  ? copy.quoteConfirmed
                  : copy.questionSent
            }
            id={quoteFixture.id}
            unread={state.quoteStatus === 'PENDING'}
            copy={copy}
            action={state.quoteStatus === 'PENDING' ? copy.quoteReview : undefined}
            onAction={onQuote}
          />
        )}
      </SimplePage>
    );
  }
  return (
    <SimplePage title={copy.accountTitle} subtitle={copy.relationshipHint}>
      <section className="cp-panel cp-active-identity">
        <div className="cp-account-card">
          <span className="cp-avatar cp-avatar-large">{identity.displayName.slice(0, 1)}</span>
          <div>
            <span className="cp-eyebrow">{copy.activeIdentity}</span>
            <h2>{relationship.customerName}</h2>
            <p>{relationship.workspaceName}</p>
            <small>
              {identity.displayName} · {identity.maskedMobile}
            </small>
          </div>
        </div>
        <Button variant="secondary" className="cp-secondary" onClick={onRelationship}>
          {copy.switch}
        </Button>
      </section>
      <section className="cp-profile-menu">
        {[
          copy.personalInfo,
          copy.accountSecurity,
          copy.companies,
          copy.members,
          copy.preferences,
          copy.myFiles,
          copy.invoices,
          copy.help
        ].map((label, index) => (
          <button key={label}>
            <span aria-hidden="true">{['○', '⌾', '▣', '♙', '◇', '▤', '¥', '?'][index]}</span>
            <strong>{label}</strong>
            <b>›</b>
          </button>
        ))}
      </section>
      <Button variant="danger" className="cp-danger-button" onClick={onLogout}>
        {copy.logout}
      </Button>
    </SimplePage>
  );
}

function TaskCard({
  badge,
  title,
  detail,
  id,
  copy,
  onAction
}: {
  badge: string;
  title: string;
  detail: string;
  id: string;
  copy: ReturnType<typeof getCopy>;
  onAction: () => void;
}) {
  return (
    <article className="cp-task-card">
      <div className="cp-task-icon">!</div>
      <div>
        <span className="cp-pill cp-pill-warm">{badge}</span>
        <h2>{title}</h2>
        <p>{detail}</p>
        <small>
          {copy.stableId}: {id}
        </small>
      </div>
      <Button className="cp-primary" onClick={onAction}>
        {copy.continue}
      </Button>
    </article>
  );
}

function ServiceCard({
  icon,
  title,
  hint,
  action
}: {
  icon: string;
  title: string;
  hint: string;
  action: string;
}) {
  return (
    <article className="cp-service-card">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{hint}</p>
      <Button variant="secondary" className="cp-secondary">
        {action} →
      </Button>
    </article>
  );
}

function PanelHeading({
  title,
  action,
  onAction
}: {
  title: string;
  action?: string | undefined;
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
  const status =
    item.id === quoteFixture.businessId && state.quoteStatus !== 'PENDING'
      ? state.quoteStatus === 'CONFIRMED_DEMO'
        ? state.locale === 'zh-CN'
          ? 'Demo 报价已确认 · 等待机构继续办理'
          : 'Demo quote confirmed · waiting for service team'
        : state.locale === 'zh-CN'
          ? '已提出报价问题 · 等待回复'
          : 'Quote question sent · awaiting reply'
      : state.locale === 'zh-CN'
        ? item.status
        : item.statusEn;
  return (
    <article className="cp-business-row">
      <span className={`cp-object-icon cp-object-${item.kind.toLowerCase()}`}>
        {item.kind.slice(0, 1)}
      </span>
      <div>
        <h3>{state.locale === 'zh-CN' ? item.title : item.titleEn}</h3>
        <p>{state.locale === 'zh-CN' ? item.detail : item.detailEn}</p>
        {item.formalStage && (
          <em>{state.locale === 'zh-CN' ? item.formalStage : item.formalStageEn}</em>
        )}
        <small>
          {copy.stableId}: {item.id}
        </small>
      </div>
      <span className="cp-status">
        <i aria-hidden="true" />
        {status}
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
  copy,
  action,
  onAction
}: {
  text: string;
  id: string;
  unread: boolean;
  copy: ReturnType<typeof getCopy>;
  action?: string | undefined;
  onAction?: () => void;
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
      {action && onAction && (
        <Button variant="secondary" className="cp-secondary" onClick={onAction}>
          {action}
        </Button>
      )}
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
        <span className="cp-eyebrow">
          {state.locale === 'zh-CN' ? '安全演示场景' : 'SAFE DEMO SCENARIOS'}
        </span>
        <p>
          {state.locale === 'zh-CN'
            ? '切换演示用户，验证不同客户隔离和企业成员授权。'
            : 'Switch Demo users to verify customer isolation and company-member access.'}
        </p>
        <div>
          <Button
            variant="secondary"
            className="cp-secondary"
            onClick={() => onScenario('acct-demo-liuya')}
          >
            {state.locale === 'zh-CN' ? '刘娅 · 另一位客户' : 'Liu Ya · other customer'}
          </Button>
          <Button
            variant="secondary"
            className="cp-secondary"
            onClick={() => onScenario('acct-demo-zhaolin')}
          >
            {state.locale === 'zh-CN' ? '赵霖 · 企业成员' : 'Zhao Lin · company member'}
          </Button>
          <Button
            variant="secondary"
            className="cp-secondary"
            onClick={() => onScenario('acct-demo-mei')}
          >
            {state.locale === 'zh-CN' ? '陈玫 · 当前用户' : 'Mei Chen · current user'}
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

function QuoteDialog({
  state,
  onClose,
  onConfirm,
  onQuestion
}: {
  state: PortalState;
  onClose: () => void;
  onConfirm: () => void;
  onQuestion: () => void;
}) {
  const copy = getCopy(state.locale);
  const money = (minor: number) =>
    new Intl.NumberFormat(state.locale, {
      style: 'currency',
      currency: quoteFixture.currency
    }).format(minor / 100);
  return (
    <Modal title={copy.quoteReview} onClose={onClose}>
      <div className="cp-quote-head">
        <div>
          <span className="cp-pill cp-pill-warm">{copy.quotePending}</span>
          <h2>{state.locale === 'zh-CN' ? quoteFixture.title : quoteFixture.titleEn}</h2>
          <p>
            {quoteFixture.number} · {copy.stableId}: {quoteFixture.id}
          </p>
        </div>
        <div>
          <small>{copy.quoteTotal}</small>
          <strong>{money(quoteFixture.totalMinor)}</strong>
          <span>
            {copy.quoteValidUntil} {quoteFixture.validUntil}
          </span>
        </div>
      </div>
      <section className="cp-quote-section">
        <h3>{copy.feeDetails}</h3>
        <dl>
          {quoteFixture.lines.map((line) => (
            <div key={line.label}>
              <dt>{state.locale === 'zh-CN' ? line.label : line.labelEn}</dt>
              <dd>{money(line.amountMinor)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="cp-quote-section">
        <h3>{copy.serviceScope}</h3>
        <p>{state.locale === 'zh-CN' ? quoteFixture.scope : quoteFixture.scopeEn}</p>
      </section>
      <div className="cp-modal-actions">
        <Button variant="secondary" className="cp-secondary" onClick={onQuestion}>
          {copy.askQuestion}
        </Button>
        <Button className="cp-primary" onClick={onConfirm}>
          {copy.confirmQuote}
        </Button>
      </div>
      <p className="cp-inline-warning">
        {state.locale === 'zh-CN'
          ? '确认仅更新 Demo 状态，不会付款，也不代表真实订单已履约。'
          : 'Confirmation updates Demo state only. It does not charge payment or mean real service has been performed.'}
      </p>
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
