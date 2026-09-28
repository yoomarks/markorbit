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
  type DemoIdentity,
  type FixtureMode,
  type PortalSection,
  type PortalState,
  type RelationshipBinding
} from './domain.js';
import { getCopy } from './i18n.js';
import { CustomerApplicationJourney } from './CustomerApplicationJourney.js';
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
  defaultSection?: PortalSection;
  defaultJourneyOpen?: boolean;
  defaultApplicationStep?: number;
  defaultPaymentStatus?: PortalState['paymentStatus'];
  persist?: boolean;
}

export function CustomerPortalPreview({
  storageKey = 'markorbit.customer-portal-v12.demo',
  fixtureMode = 'success',
  defaultChannel = 'web',
  defaultLocale = 'zh-CN',
  defaultSection,
  defaultJourneyOpen = false,
  defaultApplicationStep,
  defaultPaymentStatus,
  persist = true
}: CustomerPortalPreviewProps) {
  const [state, setState] = useState<PortalState>(() => {
    const initial = persist ? readStoredState(storageKey) : defaultState;
    return {
      ...initial,
      channel: defaultChannel,
      locale: defaultLocale,
      section: defaultSection ?? initial.section,
      applicationStep: defaultApplicationStep ?? initial.applicationStep,
      applicationStatus:
        defaultPaymentStatus === 'PAID_DEMO'
          ? 'PAID_DEMO'
          : defaultApplicationStep === 7
            ? 'PAYMENT_PENDING'
            : initial.applicationStatus,
      paymentStatus: defaultPaymentStatus ?? initial.paymentStatus,
      ...(fixtureMode === 'signed-out'
        ? { identityId: null, relationshipId: null }
        : !initial.identityId && !persist
          ? { identityId: 'acct-demo-mei', relationshipId: 'cr-atlas-mei-001' }
          : {})
    };
  });
  const [dialog, setDialog] = useState<
    'relationships' | 'consult' | 'claim' | 'registration' | 'upload' | 'quote' | 'business' | null
  >(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [journeyOpen, setJourneyOpen] = useState(defaultJourneyOpen);
  const [liveMessage, setLiveMessage] = useState('');
  const copy = getCopy(state.locale);
  const identity = identityFor(state);
  const relationship = relationshipFor(state);
  const items = useMemo(() => authorizedItems(state), [state]);
  const selectedBusiness = items.find((item) => item.id === selectedBusinessId);

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

  const openBusiness = (businessId: string) => {
    if (!items.some((item) => item.id === businessId)) return;
    setSelectedBusinessId(businessId);
    setDialog('business');
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
        onRegistration={() => setDialog('registration')}
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
        {dialog === 'registration' && (
          <RegistrationDialog
            state={state}
            onClose={() => setDialog(null)}
            onComplete={() => {
              setDialog(null);
              login();
            }}
          />
        )}
      </LoginScreen>
    );
  }

  if (relationship.status !== 'ACTIVE') {
    return (
      <div className={`cp-login cp-${state.channel}`}>
        <DemoBanner copy={copy} />
        <StatusScreen kind="permission" copy={copy} />
        <div className="cp-revoked-actions">
          <p>
            {state.locale === 'zh-CN'
              ? '该企业成员授权已撤销或过期。受保护的业务已隐藏，请重新登录或联系服务机构。'
              : 'This company-member authorization was revoked or expired. Protected business is hidden; sign in again or contact the service firm.'}
          </p>
          <Button className="cp-primary" onClick={logout}>
            {state.locale === 'zh-CN' ? '返回登录' : 'Back to sign in'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`cp-app cp-${state.channel} ${state.channel === 'h5' ? 'cp-mini' : ''}`}
      data-channel={state.channel}
    >
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
                : state.channel === 'h5'
                  ? 'H5'
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
              onBusiness={openBusiness}
              onStartApplication={() => {
                if (state.applicationStatus === 'IDLE') {
                  update({ applicationStatus: 'DRAFT', applicationStep: 0 });
                }
                setJourneyOpen(true);
              }}
              onChannel={switchChannel}
              onRelationship={() => setDialog('relationships')}
              onLogout={logout}
            />
          )}
        </main>

        <nav
          className="cp-bottom-nav"
          aria-label={
            state.channel === 'h5'
              ? state.locale === 'zh-CN'
                ? '移动端主导航'
                : 'Mobile primary navigation'
              : state.locale === 'zh-CN'
                ? '小程序主导航'
                : 'Mini primary navigation'
          }
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
      {dialog === 'business' && selectedBusiness && (
        <BusinessDetailDialog
          state={state}
          item={selectedBusiness}
          onClose={() => setDialog(null)}
          onPrimary={
            selectedBusiness.id === 'matter-cn-nova-2026' && !state.documentSubmitted
              ? () => setDialog('upload')
              : selectedBusiness.id === quoteFixture.businessId && state.quoteStatus === 'PENDING'
                ? () => setDialog('quote')
                : undefined
          }
        />
      )}
      {journeyOpen && (
        <CustomerApplicationJourney
          state={state}
          quoteExpired={fixtureMode === 'quote-expired'}
          onClose={() => setJourneyOpen(false)}
          onUpdate={update}
          onProgress={() => {
            update({ section: 'progress' });
            setJourneyOpen(false);
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
  onRegistration,
  children
}: {
  state: PortalState;
  onLocale: () => void;
  onLogin: () => void;
  onConsult: () => void;
  onClaim: () => void;
  onRegistration: () => void;
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
          <button className="cp-registration-entry" onClick={onRegistration}>
            <span>MO</span>
            <b>{state.locale === 'zh-CN' ? '对话式注册引导' : 'Guided account setup'}</b>
            <small>
              {state.locale === 'zh-CN'
                ? '了解资料并选择个人或企业办理身份'
                : 'Understand requirements and choose an acting identity'}
            </small>
            <i>→</i>
          </button>
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
  onBusiness,
  onStartApplication,
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
  onBusiness: (businessId: string) => void;
  onStartApplication: () => void;
  onChannel: () => void;
  onRelationship: () => void;
  onLogout: () => void;
}) {
  const copy = getCopy(state.locale);
  const identity = identityFor(state)!;
  const relationship = relationshipFor(state)!;
  const documentMatter = items.find((item) => item.id === 'matter-cn-nova-2026');
  const localized = (zh: string, en: string) => (state.locale === 'zh-CN' ? zh : en);

  const hasDocumentTask = Boolean(documentMatter) && !state.documentSubmitted;
  const canAccessQuote = items.some((item) => item.id === quoteFixture.businessId);
  const hasQuoteTask = canAccessQuote && state.quoteStatus === 'PENDING';
  const hasPaymentTask =
    canAccessQuote &&
    state.applicationStatus === 'PAYMENT_PENDING' &&
    state.paymentStatus !== 'PAID_DEMO';
  const pendingCount = Number(hasDocumentTask) + Number(hasQuoteTask) + Number(hasPaymentTask);

  if (state.channel !== 'web') {
    return (
      <MiniPortalPage
        state={state}
        items={items}
        matter={documentMatter}
        identity={identity}
        relationship={relationship}
        pendingCount={pendingCount}
        hasDocumentTask={hasDocumentTask}
        hasQuoteTask={hasQuoteTask}
        hasPaymentTask={hasPaymentTask}
        canAccessQuote={canAccessQuote}
        onSection={onSection}
        onUpload={onUpload}
        onQuote={onQuote}
        onBusiness={onBusiness}
        onStartApplication={onStartApplication}
        onChannel={onChannel}
        onRelationship={onRelationship}
        onLogout={onLogout}
      />
    );
  }

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
                <Button variant="secondary" className="cp-secondary" onClick={onStartApplication}>
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
                  detail={
                    documentMatter
                      ? localized(documentMatter.detail, documentMatter.detailEn)
                      : 'MO-CN-2026-0184'
                  }
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
              {hasPaymentTask && (
                <TaskCard
                  badge={localized('待付款', 'Payment due')}
                  title={localized('完成 NOVA 美国申请付款', 'Pay for NOVA US filing')}
                  detail={localized(
                    '订单 order-us-nova-042 · CNY 12,200（已使用 Demo 优惠）',
                    'Order order-us-nova-042 · CNY 12,200 (Demo offer applied)'
                  )}
                  id="payment-demo-us-nova-042"
                  copy={copy}
                  onAction={onStartApplication}
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
                <BusinessRow key={item.id} state={state} item={item} onOpen={onBusiness} />
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
            onClick={onStartApplication}
          />
          <ServiceCard
            icon="⌕"
            title={copy.serviceSearch}
            hint={copy.serviceSearchHint}
            action={copy.startApplication}
            onClick={onStartApplication}
          />
          <ServiceCard
            icon="↗"
            title={copy.serviceResponse}
            hint={copy.serviceResponseHint}
            action={copy.startApplication}
            onClick={onStartApplication}
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
              <BusinessRow key={item.id} state={state} item={item} onOpen={onBusiness} />
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
              <BusinessRow key={item.id} state={state} item={item} onOpen={onBusiness} />
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
        onOpen={onBusiness}
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
        {documentMatter && (
          <Message
            text={copy.messageOne}
            id={documentMatter.id}
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
        {state.applicationStatus !== 'IDLE' && (
          <Message
            text={
              state.paymentStatus === 'PAID_DEMO'
                ? localized('Demo 支付回执已生成', 'Demo payment receipt generated')
                : localized('订单待付款', 'Order awaiting payment')
            }
            id="payment-demo-us-nova-042"
            unread={state.paymentStatus !== 'PAID_DEMO'}
            copy={copy}
            action={localized('查看订单与付款', 'View order and payment')}
            onAction={onStartApplication}
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
  action,
  onClick
}: {
  icon: string;
  title: string;
  hint: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="cp-service-card">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{hint}</p>
      <Button variant="secondary" className="cp-secondary" onClick={onClick}>
        {action} →
      </Button>
    </article>
  );
}

function MiniPortalPage({
  state,
  items,
  matter,
  identity,
  relationship,
  pendingCount,
  hasDocumentTask,
  hasQuoteTask,
  hasPaymentTask,
  canAccessQuote,
  onSection,
  onUpload,
  onQuote,
  onBusiness,
  onStartApplication,
  onChannel,
  onRelationship,
  onLogout
}: {
  state: PortalState;
  items: ReturnType<typeof authorizedItems>;
  matter: BusinessItem | undefined;
  identity: DemoIdentity;
  relationship: RelationshipBinding;
  pendingCount: number;
  hasDocumentTask: boolean;
  hasQuoteTask: boolean;
  hasPaymentTask: boolean;
  canAccessQuote: boolean;
  onSection: (section: PortalSection) => void;
  onUpload: () => void;
  onQuote: () => void;
  onBusiness: (businessId: string) => void;
  onStartApplication: () => void;
  onChannel: () => void;
  onRelationship: () => void;
  onLogout: () => void;
}) {
  const copy = getCopy(state.locale);
  const t = (zh: string, en: string) => (state.locale === 'zh-CN' ? zh : en);
  const activeItems = items.filter((item) => item.kind !== 'ASSET');
  const assets = items.filter((item) => item.kind === 'ASSET');

  if (state.section === 'home') {
    const heroAction = hasDocumentTask ? onUpload : hasQuoteTask ? onQuote : onStartApplication;
    return (
      <div className="mini-page mini-home">
        <section className="mini-welcome-hero">
          <div className="mini-hero-glow" aria-hidden="true" />
          <div className="mini-welcome-row">
            <div>
              <span>{t('上午好', 'Good morning')}</span>
              <h1>{identity.displayName.split(' ')[0]}</h1>
              <p>
                {t(
                  '让每一件商标业务，都清楚地向前一步。',
                  'Keep every trademark matter moving with clarity.'
                )}
              </p>
            </div>
            <button
              className="mini-assistant-orb"
              onClick={() => onSection('messages')}
              aria-label={t('打开 MO 办事助手', 'Open MO service assistant')}
            >
              MO<small>AI</small>
            </button>
          </div>
          <button className="mini-identity-chip" onClick={onRelationship}>
            <span className="mini-firm-mark">澄</span>
            <span>
              <small>{t('当前服务机构 · 办理身份', 'Service firm · acting identity')}</small>
              <strong>{relationship.workspaceName}</strong>
            </span>
            <b>切换 ›</b>
          </button>
          <article className={`mini-task-hero ${pendingCount === 0 ? 'is-complete' : ''}`}>
            <div className="mini-task-meta">
              <span>
                {pendingCount
                  ? t(`${pendingCount} 项待处理`, `${pendingCount} to do`)
                  : t('当前无需操作', 'Nothing to do')}
              </span>
              <small>{t('今日服务提醒', 'Today’s service update')}</small>
            </div>
            <h2>
              {hasDocumentTask
                ? copy.upload
                : hasQuoteTask
                  ? copy.messageTwo.replace('报价待确认：', '').replace('Quote to review: ', '')
                  : hasPaymentTask
                    ? t('完成 NOVA 美国申请付款', 'Pay for NOVA US filing')
                    : copy.noTasks}
            </h2>
            <p>
              {hasDocumentTask
                ? t(
                    '补充后，顾问将继续核对申请材料。',
                    'Your advisor will continue reviewing the filing after submission.'
                  )
                : hasQuoteTask
                  ? t(
                      '查看费用和服务范围，确认后我们再继续。',
                      'Review fees and scope before the service continues.'
                    )
                  : hasPaymentTask
                    ? t(
                        '订单仍为待付款；聊天不会执行扣款。',
                        'The order is still unpaid. Chat never charges funds.'
                      )
                    : copy.noTasksHint}
            </p>
            <button onClick={heroAction}>
              {pendingCount ? copy.continue : copy.startService}
              <span>→</span>
            </button>
          </article>
        </section>

        <section className="mini-section mini-quick-section">
          <MiniSectionHeading
            title={t('常用服务', 'Quick services')}
            action={t('全部服务', 'All services')}
            onAction={() => onSection('services')}
          />
          <div className="mini-service-grid">
            <MiniQuick
              icon="申"
              label={copy.startService}
              tone="mint"
              onClick={() => onSection('services')}
            />
            <MiniQuick
              icon="进"
              label={copy.viewProgress}
              tone="blue"
              onClick={() => onSection('progress')}
            />
            <MiniQuick
              icon="传"
              label={matter ? t('上传资料', 'Upload files') : copy.myFiles}
              tone="gold"
              onClick={matter ? onUpload : () => onSection('profile')}
            />
            <MiniQuick
              icon="顾"
              label={copy.contactAdvisor}
              tone="rose"
              onClick={() => onSection('messages')}
            />
            <MiniQuick
              icon="标"
              label={copy.assetsTitle}
              tone="violet"
              onClick={() => onSection('trademarks')}
            />
          </div>
        </section>

        <section className="mini-section">
          <MiniSectionHeading
            title={copy.activity}
            action={copy.viewAll}
            onAction={() => onSection('progress')}
          />
          <div className="mini-business-stack">
            {activeItems.map((item) => (
              <MiniBusinessCard
                key={item.id}
                state={state}
                item={item}
                onClick={() => onBusiness(item.id)}
              />
            ))}
          </div>
        </section>

        <section className="mini-advisor-card">
          <div className="mini-advisor-avatar">
            <span>林</span>
            <i />
          </div>
          <div>
            <small>{t('专属服务顾问 · Demo', 'Dedicated advisor · Demo')}</small>
            <h2>{t('林顾问正在为你服务', 'Advisor Lin is here to help')}</h2>
            <p>
              {t(
                '工作日 09:00–18:00 · 通常 10 分钟内回复',
                'Weekdays 09:00–18:00 · usually replies within 10 min'
              )}
            </p>
          </div>
          <button onClick={() => onSection('messages')}>{t('咨询', 'Chat')}</button>
        </section>

        <section className="mini-section mini-content-section">
          <MiniSectionHeading
            title={t('商标服务指南', 'Trademark guides')}
            action={t('帮助中心', 'Help center')}
          />
          <div className="mini-guide-grid">
            <article className="mini-guide-feature">
              <span>{t('申请前必读', 'Before filing')}</span>
              <h2>{t('商标申请要准备哪些资料？', 'What should I prepare for filing?')}</h2>
              <p>
                {t(
                  '用 3 分钟了解材料、流程和常见问题',
                  'A 3-minute guide to files, process and FAQs'
                )}
              </p>
              <b>了解详情 →</b>
            </article>
            <div className="mini-guide-list">
              <button>
                <span>01</span>
                <b>{t('如何选择商品与服务类别', 'How to choose classes')}</b>
                <i>›</i>
              </button>
              <button>
                <span>02</span>
                <b>{t('审查意见是什么，应该怎么办', 'What is an office action?')}</b>
                <i>›</i>
              </button>
            </div>
          </div>
        </section>
        <div className="mini-preview-switch">
          <span>{copy.demo}</span>
          <button onClick={onChannel}>{copy.openWeb} →</button>
        </div>
      </div>
    );
  }

  if (state.section === 'services') {
    return (
      <div className="mini-page">
        <MiniPageHeader
          eyebrow={t('专业服务 · 清楚办理', 'Professional services')}
          title={copy.servicesTitle}
          subtitle={t(
            '从需求出发，找到适合你的商标服务。',
            'Start from your need and find the right trademark service.'
          )}
        />
        <div className="mini-search-box">
          <span>⌕</span>
          <span>{t('搜索服务，如“商标申请”', 'Search services, e.g. “filing”')}</span>
        </div>
        <div
          className="mini-category-scroll"
          role="group"
          aria-label={t('服务分类', 'Service categories')}
        >
          <button className="is-active">{t('热门服务', 'Popular')}</button>
          <button>{t('申请注册', 'Filing')}</button>
          <button>{t('商标维护', 'Maintenance')}</button>
          <button>{t('争议应对', 'Disputes')}</button>
        </div>
        <section className="mini-section mini-flush">
          <MiniSectionHeading title={t('热门服务', 'Popular services')} />
          <div className="mini-catalog-stack">
            <MiniServiceProduct
              badge={t('热门', 'Popular')}
              icon="TM"
              title={copy.serviceRegistration}
              description={copy.serviceRegistrationHint}
              scene={t('适合：准备推出新品牌或新产品', 'For new brands or products')}
              action={copy.startApplication}
              onClick={onStartApplication}
            />
            <MiniServiceProduct
              badge={t('申请前推荐', 'Recommended first')}
              icon="⌕"
              title={copy.serviceSearch}
              description={copy.serviceSearchHint}
              scene={t('适合：想先了解近似风险', 'For understanding similarity risk')}
              action={copy.startApplication}
              onClick={onStartApplication}
            />
            <MiniServiceProduct
              badge={t('顾问协助', 'Advisor supported')}
              icon="OA"
              title={copy.serviceResponse}
              description={copy.serviceResponseHint}
              scene={t('适合：已经收到官方通知', 'For an official notice already received')}
              action={copy.startApplication}
              onClick={onStartApplication}
            />
          </div>
        </section>
        <section className="mini-service-promo">
          <span>顾问</span>
          <div>
            <small>{t('不知道选哪项？', 'Not sure which service?')}</small>
            <h2>{t('先说说你的需求，我们帮你判断', 'Tell us your need and we’ll guide you')}</h2>
          </div>
          <button onClick={() => onSection('messages')}>{t('免费咨询', 'Ask us')} →</button>
        </section>
        <section className="mini-section mini-flush">
          <MiniSectionHeading
            title={copy.continueExisting}
            action={copy.viewAll}
            onAction={() => onSection('progress')}
          />
          <div className="mini-business-stack">
            {activeItems.map((item) => (
              <MiniBusinessCard
                compact
                key={item.id}
                state={state}
                item={item}
                onClick={() => onBusiness(item.id)}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (state.section === 'progress') {
    return (
      <div className="mini-page">
        <MiniPageHeader
          eyebrow={t('每一步都有记录', 'Every step recorded')}
          title={copy.progressTitle}
          subtitle={t(
            '看懂当前状态，也知道下一步该做什么。',
            'Understand the current status and what happens next.'
          )}
        />
        <div className="mini-progress-summary">
          <div>
            <strong>{activeItems.length}</strong>
            <span>{t('办理中', 'Active')}</span>
          </div>
          <i />
          <div>
            <strong>{pendingCount}</strong>
            <span>{copy.filterAwaiting}</span>
          </div>
          <i />
          <div>
            <strong>0</strong>
            <span>{copy.filterDone}</span>
          </div>
        </div>
        <div className="mini-filter-tabs" role="group" aria-label={copy.progressTitle}>
          <button className="is-active">{copy.filterActive}</button>
          <button>
            {copy.filterAwaiting}
            {pendingCount > 0 && <b>{pendingCount}</b>}
          </button>
          <button>{copy.filterDone}</button>
        </div>
        <section className="mini-section mini-flush">
          <div className="mini-progress-list">
            {activeItems.map((item) => (
              <MiniProgressCard
                key={item.id}
                state={state}
                item={item}
                needsAction={
                  item.id === matter?.id
                    ? hasDocumentTask
                    : item.id === quoteFixture.businessId &&
                      (hasQuoteTask ||
                        (state.applicationStatus === 'PAYMENT_PENDING' &&
                          state.paymentStatus !== 'PAID_DEMO'))
                }
                onAction={
                  item.id === matter?.id
                    ? onUpload
                    : item.id === quoteFixture.businessId
                      ? state.applicationStatus === 'PAYMENT_PENDING'
                        ? onStartApplication
                        : onQuote
                      : () => undefined
                }
                onDetail={() => onBusiness(item.id)}
              />
            ))}
          </div>
        </section>
        <div className="mini-truth-note">
          <span>i</span>
          <p>
            {t(
              '页面显示的是服务进展；正式法律程序和官方期限以详情中的来源文件为准。',
              'This page shows service progress. Formal procedure and official deadlines follow sourced documents in the detail view.'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (state.section === 'messages') {
    return (
      <div className="mini-page">
        <MiniPageHeader
          eyebrow={t('不错过重要进展', 'Stay on top of updates')}
          title={copy.messagesTitle}
          subtitle={t(
            '资料、进度和顾问消息，都能回到对应业务。',
            'Documents, progress and advisor messages link to the same business.'
          )}
        />
        <div className="mini-message-categories">
          <button className="is-active">
            <span>全</span>
            <b>{t('全部', 'All')}</b>
            <small>{state.unreadMessages}</small>
          </button>
          <button>
            <span>业</span>
            <b>{t('业务进展', 'Progress')}</b>
          </button>
          <button>
            <span>资</span>
            <b>{t('资料补充', 'Files')}</b>
          </button>
          <button>
            <span>顾</span>
            <b>{t('顾问消息', 'Advisor')}</b>
          </button>
        </div>
        <section className="mini-message-group">
          <h2>{t('今天', 'Today')}</h2>
          {matter && (
            <MiniMessageCard
              tone="gold"
              icon="资"
              title={
                state.documentSubmitted
                  ? t('资料已提交，等待顾问核对', 'File submitted; awaiting advisor review')
                  : copy.messageOne
              }
              detail={t('NOVA 图形商标 · 中国申请', 'NOVA device mark · China filing')}
              time="10:20"
              unread={!state.documentSubmitted}
              action={state.documentSubmitted ? undefined : copy.continue}
              onClick={onUpload}
            />
          )}
          {canAccessQuote && (
            <MiniMessageCard
              tone="mint"
              icon="价"
              title={
                state.quoteStatus === 'PENDING'
                  ? copy.messageTwo
                  : state.quoteStatus === 'CONFIRMED_DEMO'
                    ? copy.quoteConfirmed
                    : copy.questionSent
              }
              detail={`${quoteFixture.number} · ${quoteFixture.id}`}
              time="09:45"
              unread={state.quoteStatus === 'PENDING'}
              action={state.quoteStatus === 'PENDING' ? copy.quoteReview : undefined}
              onClick={onQuote}
            />
          )}
          {state.applicationStatus !== 'IDLE' && (
            <MiniMessageCard
              tone="blue"
              icon="付"
              title={
                state.paymentStatus === 'PAID_DEMO'
                  ? t('Demo 支付回执已生成', 'Demo payment receipt generated')
                  : t('订单待付款', 'Order awaiting payment')
              }
              detail={t(
                'NOVA 美国商标检索与申请 · order-us-nova-042',
                'NOVA US search and filing · order-us-nova-042'
              )}
              time="11:30"
              unread={state.paymentStatus !== 'PAID_DEMO'}
              action={t('查看订单与付款', 'View order & payment')}
              onClick={onStartApplication}
            />
          )}
        </section>
        <section className="mini-message-group">
          <h2>{t('更早', 'Earlier')}</h2>
          <MiniMessageCard
            tone="blue"
            icon="顾"
            title={t(
              '林顾问：申请材料清单已经为你整理好',
              'Advisor Lin: your filing checklist is ready'
            )}
            detail={t('服务顾问消息 · Demo', 'Advisor message · Demo')}
            time={t('昨天', 'Yesterday')}
          />
          <MiniMessageCard
            tone="violet"
            icon="系"
            title={t(
              '账号安全提醒：新设备登录验证成功',
              'Security notice: new-device verification succeeded'
            )}
            detail={t('系统通知 · Demo', 'System notice · Demo')}
            time={t('周六', 'Saturday')}
          />
        </section>
      </div>
    );
  }

  if (state.section === 'trademarks') {
    return (
      <div className="mini-page">
        <button className="mini-back" onClick={() => onSection('home')}>
          ‹ {t('返回首页', 'Back home')}
        </button>
        <MiniPageHeader
          eyebrow={t('你的品牌资产', 'Your brand assets')}
          title={copy.assetsTitle}
          subtitle={copy.partialHint}
        />
        <div className="mini-business-stack">
          {assets.map((item) => (
            <MiniBusinessCard
              key={item.id}
              state={state}
              item={item}
              onClick={() => onBusiness(item.id)}
            />
          ))}
        </div>
        <PartialNotice copy={copy} />
      </div>
    );
  }

  return (
    <div className="mini-page mini-profile-page">
      <section className="mini-profile-hero">
        <div className="mini-profile-orbit" aria-hidden="true" />
        <div className="mini-profile-main">
          <span className="mini-profile-avatar">{identity.displayName.slice(0, 1)}</span>
          <div>
            <h1>{identity.displayName}</h1>
            <p>{identity.maskedMobile}</p>
            <span>
              {relationship.kind === 'ENTERPRISE'
                ? t('企业授权成员', 'Authorized company member')
                : t('个人客户', 'Individual customer')}
            </span>
          </div>
        </div>
        <button onClick={onRelationship}>
          <small>{t('当前服务机构与办理身份', 'Current firm & acting identity')}</small>
          <strong>{relationship.customerName}</strong>
          <span>{relationship.workspaceName} ›</span>
        </button>
      </section>
      <section className="mini-profile-service">
        <div className="mini-advisor-avatar">
          <span>林</span>
          <i />
        </div>
        <div>
          <small>{t('你的专属顾问 · Demo', 'Your advisor · Demo')}</small>
          <h2>{t('有问题，随时找林顾问', 'Advisor Lin is ready to help')}</h2>
        </div>
        <button onClick={() => onSection('messages')}>{t('联系顾问', 'Contact')}</button>
      </section>
      <section className="mini-profile-group">
        <h2>{t('我的业务与资料', 'Business & files')}</h2>
        <MiniMenu
          icon="标"
          label={copy.assetsTitle}
          meta={`${assets.length}`}
          onClick={() => onSection('trademarks')}
        />
        <MiniMenu
          icon="文"
          label={copy.myFiles}
          meta={state.documentSubmitted ? t('含新提交资料', 'New file added') : ''}
        />
        <MiniMenu
          icon="付"
          label={t('订单与付款', 'Orders & payments')}
          meta={
            state.paymentStatus === 'PAID_DEMO'
              ? t('Demo 回执 1', '1 Demo receipt')
              : state.applicationStatus !== 'IDLE'
                ? t('待付款', 'Payment due')
                : ''
          }
          onClick={onStartApplication}
        />
        <MiniMenu icon="票" label={copy.invoices} />
        <MiniMenu
          icon="企"
          label={copy.companies}
          meta={relationship.kind === 'ENTERPRISE' ? '1' : ''}
        />
        <MiniMenu icon="员" label={copy.members} />
      </section>
      <section className="mini-profile-group">
        <h2>{t('账户与服务', 'Account & support')}</h2>
        <MiniMenu icon="资" label={copy.personalInfo} />
        <MiniMenu icon="安" label={copy.accountSecurity} />
        <MiniMenu icon="偏" label={copy.preferences} />
        <MiniMenu icon="客" label={t('在线客服', 'Online support')} />
        <MiniMenu icon="帮" label={copy.help} />
      </section>
      <Button variant="danger" className="cp-danger-button mini-logout" onClick={onLogout}>
        {copy.logout}
      </Button>
      <p className="mini-version">MarkOrbit Customer Portal · Demo V2</p>
    </div>
  );
}

function MiniPageHeader({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mini-page-header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function MiniSectionHeading({
  title,
  action,
  onAction
}: {
  title: string;
  action?: string | undefined;
  onAction?: (() => void) | undefined;
}) {
  return (
    <div className="mini-section-heading">
      <h2>{title}</h2>
      {action && <button onClick={onAction}>{action} ›</button>}
    </div>
  );
}

function MiniQuick({
  icon,
  label,
  tone,
  onClick
}: {
  icon: string;
  label: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button className={`mini-quick mini-tone-${tone}`} onClick={onClick}>
      <span>{icon}</span>
      <b>{label}</b>
    </button>
  );
}

function MiniBusinessCard({
  state,
  item,
  compact,
  onClick
}: {
  state: PortalState;
  item: BusinessItem;
  compact?: boolean;
  onClick?: (() => void) | undefined;
}) {
  const title = state.locale === 'zh-CN' ? item.title : item.titleEn;
  const status = businessStatus(state, item);
  return (
    <article className={`mini-business-card ${compact ? 'is-compact' : ''}`}>
      <div className="mini-mark-tile">{item.title.slice(0, 1)}</div>
      <div className="mini-business-body">
        <div>
          <span>
            {item.kind === 'MATTER'
              ? state.locale === 'zh-CN'
                ? '商标申请'
                : 'Trademark filing'
              : item.kind === 'ORDER'
                ? state.locale === 'zh-CN'
                  ? '服务订单'
                  : 'Service order'
                : state.locale === 'zh-CN'
                  ? '商标档案'
                  : 'Trademark record'}
          </span>
          <small>{state.locale === 'zh-CN' ? '更新于 09-28 10:20' : 'Updated 09-28 10:20'}</small>
        </div>
        <h3>{title}</h3>
        <p>{state.locale === 'zh-CN' ? item.detail : item.detailEn}</p>
        <small className="mini-business-id">
          {state.locale === 'zh-CN' ? '业务编号' : 'Business ID'} · {item.id}
        </small>
        <div className="mini-business-status">
          <i />
          {status}
        </div>
      </div>
      {onClick && (
        <button
          className="mini-card-arrow"
          onClick={onClick}
          aria-label={`${title} ${state.locale === 'zh-CN' ? '查看详情' : 'View details'}`}
        >
          ›
        </button>
      )}
    </article>
  );
}

function MiniServiceProduct({
  badge,
  icon,
  title,
  description,
  scene,
  action,
  onClick
}: {
  badge: string;
  icon: string;
  title: string;
  description: string;
  scene: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="mini-service-product">
      <div className="mini-product-icon">{icon}</div>
      <div>
        <span>{badge}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <small>{scene}</small>
      </div>
      <button onClick={onClick}>{action} ›</button>
    </article>
  );
}

function MiniProgressCard({
  state,
  item,
  needsAction,
  onAction,
  onDetail
}: {
  state: PortalState;
  item: BusinessItem;
  needsAction: boolean;
  onAction: () => void;
  onDetail: () => void;
}) {
  const t = (zh: string, en: string) => (state.locale === 'zh-CN' ? zh : en);
  return (
    <article className="mini-progress-card">
      <header>
        <div className="mini-mark-tile">{item.title.slice(0, 1)}</div>
        <div>
          <span>
            {item.kind === 'ORDER'
              ? t('美国 · 商标服务', 'United States · Trademark service')
              : t('中国 · 商标申请', 'China · Trademark filing')}
          </span>
          <h2>{state.locale === 'zh-CN' ? item.title : item.titleEn}</h2>
        </div>
        <button
          onClick={onDetail}
          aria-label={`${state.locale === 'zh-CN' ? item.title : item.titleEn} ${t(
            '查看详情',
            'View details'
          )}`}
        >
          ›
        </button>
      </header>
      <div className="mini-progress-line">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="mini-progress-copy">
        <strong>{businessStatus(state, item)}</strong>
        <small>
          {t('最近更新：2026-09-28 10:20 · Demo', 'Last updated: 2026-09-28 10:20 · Demo')}
        </small>
        <p>
          <b>{t('下一步', 'Next')}</b>
          {needsAction
            ? item.kind === 'MATTER'
              ? t('请补充首次使用说明', 'Add the first-use statement')
              : state.applicationStatus === 'PAYMENT_PENDING'
                ? t('请完成受控付款步骤', 'Complete the controlled payment step')
                : t('请查看并确认报价', 'Review and confirm the quote')
            : t(
                '服务顾问正在处理，暂时无需操作',
                'Your advisor is handling this; no action needed'
              )}
        </p>
      </div>
      {needsAction && (
        <Button className="cp-primary" onClick={onAction}>
          {t('立即处理', 'Take action')}
        </Button>
      )}
      <button className="mini-detail-link" onClick={onDetail}>
        {t('查看业务详情', 'View details')} →
      </button>
    </article>
  );
}

function MiniMessageCard({
  tone,
  icon,
  title,
  detail,
  time,
  unread,
  action,
  onClick
}: {
  tone: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  unread?: boolean;
  action?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <article className={`mini-message-card mini-tone-${tone}`}>
      <span className="mini-message-icon">{icon}</span>
      <div>
        <header>
          <h3>{title}</h3>
          <time>{time}</time>
        </header>
        <p>{detail}</p>
        {action && <button onClick={onClick}>{action} →</button>}
      </div>
      {unread && <i className="mini-unread" />}
    </article>
  );
}

function MiniMenu({
  icon,
  label,
  meta,
  onClick
}: {
  icon: string;
  label: string;
  meta?: string;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button className="mini-menu-row" onClick={onClick}>
      <span>{icon}</span>
      <strong>{label}</strong>
      {meta && <small>{meta}</small>}
      <b>›</b>
    </button>
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

function businessStatus(state: PortalState, item: BusinessItem) {
  if (item.id === quoteFixture.businessId) {
    if (state.paymentStatus === 'PAID_DEMO') {
      return state.locale === 'zh-CN'
        ? 'Demo 回执已生成 · 等待机构专业审核'
        : 'Demo receipt generated · awaiting professional review';
    }
    if (state.paymentStatus === 'FAILED_DEMO') {
      return state.locale === 'zh-CN'
        ? 'Demo 支付失败 · 仍待付款'
        : 'Demo payment failed · still unpaid';
    }
    if (state.applicationStatus === 'PAYMENT_PENDING') {
      return state.locale === 'zh-CN' ? '报价已确认 · 待付款' : 'Quote confirmed · payment due';
    }
    if (state.quoteStatus !== 'PENDING') {
      return state.quoteStatus === 'CONFIRMED_DEMO'
        ? state.locale === 'zh-CN'
          ? 'Demo 报价已确认 · 等待机构继续办理'
          : 'Demo quote confirmed · waiting for service team'
        : state.locale === 'zh-CN'
          ? '已提出报价问题 · 等待回复'
          : 'Quote question sent · awaiting reply';
    }
  }
  return state.locale === 'zh-CN' ? item.status : item.statusEn;
}

function BusinessRow({
  state,
  item,
  onOpen
}: {
  state: PortalState;
  item: BusinessItem;
  onOpen: (businessId: string) => void;
}) {
  const copy = getCopy(state.locale);
  const status = businessStatus(state, item);
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
      <button
        className="cp-row-action"
        aria-label={`${copy.continue}: ${item.id}`}
        onClick={() => onOpen(item.id)}
      >
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
  partial,
  onOpen
}: {
  title: string;
  subtitle: string;
  state: PortalState;
  items: readonly BusinessItem[];
  partial?: boolean;
  onOpen: (businessId: string) => void;
}) {
  const copy = getCopy(state.locale);
  return (
    <SimplePage title={title} subtitle={subtitle}>
      {partial && <PartialNotice copy={copy} />}
      {items.length ? (
        <section className="cp-panel cp-collection">
          {items.map((item) => (
            <BusinessRow key={item.id} state={state} item={item} onOpen={onOpen} />
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
            onClick={() => onScenario('acct-demo-revoked')}
          >
            {state.locale === 'zh-CN'
              ? '周岚 · 已撤销企业成员'
              : 'Lan Zhou · revoked company member'}
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

function BusinessDetailDialog({
  state,
  item,
  onClose,
  onPrimary
}: {
  state: PortalState;
  item: BusinessItem;
  onClose: () => void;
  onPrimary?: (() => void) | undefined;
}) {
  const t = (zh: string, en: string) => (state.locale === 'zh-CN' ? zh : en);
  const isMatter = item.kind === 'MATTER';
  const title = state.locale === 'zh-CN' ? item.title : item.titleEn;
  const status = state.locale === 'zh-CN' ? item.status : item.statusEn;
  return (
    <Modal title={t('业务详情', 'Business details')} onClose={onClose}>
      <article className="cp-detail-hero">
        <div className="cp-detail-mark">{item.title.slice(0, 1)}</div>
        <div>
          <span>
            {isMatter ? t('商标申请', 'Trademark filing') : t('服务订单', 'Service order')}
          </span>
          <h2>{title}</h2>
          <p>{state.locale === 'zh-CN' ? item.detail : item.detailEn}</p>
          <code>{item.id}</code>
        </div>
      </article>
      <section className="cp-detail-status">
        <span>{t('当前进度', 'Current status')}</span>
        <h3>{status}</h3>
        <p>
          {isMatter
            ? t(
                '资料齐全后，服务顾问会继续核对申请内容；当前显示为服务进展。',
                'Once files are complete, your advisor will continue checking the filing. This is service progress.'
              )
            : t(
                '请先核对费用和服务范围；确认 Demo 报价不会发起真实付款。',
                'Review fees and scope first. Confirming the Demo quote does not start a real payment.'
              )}
        </p>
      </section>
      <ol className="cp-detail-timeline">
        <li className="is-done">
          <i />
          <div>
            <strong>{t('需求已登记', 'Request recorded')}</strong>
            <small>{t('2026-09-26 · Demo 服务记录', '2026-09-26 · Demo service record')}</small>
          </div>
        </li>
        <li className="is-current">
          <i />
          <div>
            <strong>{status}</strong>
            <small>{t('2026-09-28 10:20 · 最近更新', '2026-09-28 10:20 · latest update')}</small>
          </div>
        </li>
        <li>
          <i />
          <div>
            <strong>{t('机构继续办理', 'Service team continues')}</strong>
            <small>
              {t(
                '完成当前步骤后进入；未承诺完成日期',
                'Begins after this step; no completion date promised'
              )}
            </small>
          </div>
        </li>
      </ol>
      <section className="cp-detail-evidence">
        <div>
          <span>{t('正式程序', 'Formal procedure')}</span>
          <strong>
            {item.formalStage
              ? state.locale === 'zh-CN'
                ? item.formalStage
                : item.formalStageEn
              : t('尚未进入官方程序', 'Not yet in an official procedure')}
          </strong>
        </div>
        <div>
          <span>{t('期限与依据', 'Deadline & source')}</span>
          <strong>{t('暂无经核实的官方期限', 'No verified official deadline')}</strong>
        </div>
        <p>
          {t(
            '正式程序、期限和官方事实以服务机构提供的来源文件为准。原始文件及编号不会因语言切换而改变。',
            'Formal procedure, deadlines and official facts follow sourced documents from the service firm. Original files and identifiers do not change with language.'
          )}
        </p>
      </section>
      <div className="cp-modal-actions">
        <Button variant="secondary" className="cp-secondary" onClick={onClose}>
          {t('返回', 'Back')}
        </Button>
        {onPrimary && (
          <Button className="cp-primary" onClick={onPrimary}>
            {isMatter ? t('提交资料', 'Submit files') : t('确认报价', 'Review quote')}
          </Button>
        )}
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

function RegistrationDialog({
  state,
  onClose,
  onComplete
}: {
  state: PortalState;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const t = (zh: string, en: string) => (state.locale === 'zh-CN' ? zh : en);
  return (
    <Modal title={t('对话式注册引导', 'Guided account setup')} onClose={onClose}>
      <div className="cp-registration-steps">
        {[t('了解需求', 'Needs'), t('办理身份', 'Identity'), t('账号验证', 'Verification')].map(
          (label, index) => (
            <span key={label} className={index <= step ? 'is-active' : ''}>
              <i>{index + 1}</i>
              {label}
            </span>
          )
        )}
      </div>
      {step === 0 && (
        <div className="cp-registration-body">
          <div className="cp-registration-bubble">
            <span>MO</span>
            <p>
              {t(
                '我会先说明开户和申请所需资料，再把你带到受控验证流程。聊天不会核发账号或自动认领已有业务。',
                'I’ll explain account and filing requirements, then hand off to a controlled verification flow. Chat cannot issue an account or automatically claim existing business.'
              )}
            </p>
          </div>
          <div className="cp-registration-grid">
            <button>{t('我准备申请新商标', 'I want to file a new mark')}</button>
            <button>{t('我想查看已有业务', 'I need existing business access')}</button>
          </div>
          <Button className="cp-primary cp-full" onClick={() => setStep(1)}>
            {t('继续', 'Continue')}
          </Button>
        </div>
      )}
      {step === 1 && (
        <div className="cp-registration-body">
          <p className="cp-modal-lead">
            {t(
              '办理身份决定需要核对的证明，但不会自动授予企业业务权限。',
              'The acting identity determines required evidence, but does not automatically grant company business access.'
            )}
          </p>
          <div className="cp-registration-grid">
            <button className="is-selected">
              <b>{t('企业办理', 'Company')}</b>
              <small>{t('企业主体证明 + 有效授权', 'Entity evidence + valid authorization')}</small>
            </button>
            <button>
              <b>{t('个人办理', 'Individual')}</b>
              <small>{t('可信身份验证', 'Trusted identity verification')}</small>
            </button>
          </div>
          <div className="cp-modal-actions">
            <Button variant="secondary" className="cp-secondary" onClick={() => setStep(0)}>
              ←
            </Button>
            <Button className="cp-primary" onClick={() => setStep(2)}>
              {t('进入账号设置', 'Continue to account setup')}
            </Button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="cp-registration-body">
          <label className="cp-field">
            <span>{t('手机号', 'Mobile number')}</span>
            <input value="+86 138 **** 6208" readOnly />
          </label>
          <label className="cp-field">
            <span>{t('验证码', 'Verification code')}</span>
            <input value="123456" readOnly />
          </label>
          <div className="cp-inline-warning">
            {t(
              'Preview 使用结构化 Demo 验证；不会发送短信、保存密码或绑定微信身份。企业授权仍需机构核验。',
              'Preview uses structured Demo verification. It sends no SMS, stores no password and binds no WeChat identity. Company authorization still requires firm verification.'
            )}
          </div>
          <label className="cp-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>
              {t(
                '我理解这是 Demo 身份验证，并同意查看演示客户数据。',
                'I understand this is Demo identity verification and consent to viewing Demo customer data.'
              )}
            </span>
          </label>
          <div className="cp-modal-actions">
            <Button variant="secondary" className="cp-secondary" onClick={() => setStep(1)}>
              ←
            </Button>
            <Button className="cp-primary" disabled={!accepted} onClick={onComplete}>
              {t('完成 Demo 验证', 'Complete Demo verification')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
