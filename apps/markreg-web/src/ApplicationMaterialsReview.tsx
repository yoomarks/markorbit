import {
  Alert,
  AppShell,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FixtureBanner,
  KeyValueList,
  LoadingState,
  SideNavigation,
  TextArea
} from '@markorbit/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import './application-materials-review.css';

export type ReviewFieldStatus =
  | 'PRESENT'
  | 'MISSING'
  | 'UNKNOWN'
  | 'CONFLICTING'
  | 'UNVERIFIED'
  | 'STALE'
  | 'NOT_APPLICABLE'
  | 'REVIEW_REQUIRED';

export type ReviewSourceClass =
  | 'OFFICIAL_EXTERNAL'
  | 'WORKSPACE_CURRENT'
  | 'CUSTOMER_STATEMENT'
  | 'DOCUMENT_EXTRACTION'
  | 'AI_SUGGESTION'
  | 'HANDLER_CONFIRMED';

export type ReviewSurfaceState =
  | 'WORKING'
  | 'LOADING'
  | 'EMPTY'
  | 'FORBIDDEN'
  | 'UNSUPPORTED'
  | 'STALE'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'SAVE_ERROR'
  | 'SAVED'
  | 'HANDED_OFF';

export interface ReviewSource {
  id: string;
  kind: ReviewSourceClass;
  value: string;
  recordLabel: string;
  locator: string;
  version: string;
  observedAt: string;
  currentness: 'CURRENT' | 'STALE' | 'UNKNOWN';
  note?: string;
}

export interface ReviewItem {
  id: string;
  sectionId: string;
  label: string;
  labelEn: string;
  status: ReviewFieldStatus;
  blocking: boolean;
  summary: string;
  workingValue?: string;
  workingValueSourceId?: string;
  sources: readonly ReviewSource[];
  questionDraft?: string;
}

export interface ReviewSection {
  id: string;
  label: string;
  labelEn: string;
  description: string;
}

export interface ReviewQuestion {
  id: string;
  itemId: string;
  audience: string;
  text: string;
}

export interface ApplicationMaterialsReviewFixture {
  fixtureOnly: true;
  fixtureId: string;
  matter: {
    trademark: string;
    jurisdiction: 'US';
    filingBasis: '§1(a)' | '§1(b)';
    filingBasisLabel: string;
    classes: readonly number[];
    matterId: string;
    matterVersion: number;
    matterDraftId: string;
    matterDraftVersion: number;
    customerConfirmationId: string;
    customerConfirmationVersion: number;
    sourceAsOf: string;
  };
  snapshot: {
    id: string;
    version: number;
    updatedAt: string;
    actor: string;
  };
  sections: readonly ReviewSection[];
  items: readonly ReviewItem[];
  questions: readonly ReviewQuestion[];
  handoffAllowed: boolean;
  unsupportedReason?: string;
}

const statusPresentation: Readonly<
  Record<ReviewFieldStatus, { icon: string; label: string; labelEn: string }>
> = {
  PRESENT: { icon: '✓', label: '已有且一致', labelEn: 'Present' },
  MISSING: { icon: '!', label: '缺少资料', labelEn: 'Missing' },
  UNKNOWN: { icon: '?', label: '尚不确定', labelEn: 'Unknown' },
  CONFLICTING: { icon: '⇄', label: '来源冲突', labelEn: 'Conflicting' },
  UNVERIFIED: { icon: '◌', label: '尚未核验', labelEn: 'Unverified' },
  STALE: { icon: '↻', label: '来源已变化', labelEn: 'Stale' },
  NOT_APPLICABLE: { icon: '—', label: '不适用', labelEn: 'Not applicable' },
  REVIEW_REQUIRED: { icon: '◆', label: '需经办复核', labelEn: 'Review required' }
};

const sourcePresentation: Readonly<Record<ReviewSourceClass, { label: string; note: string }>> = {
  OFFICIAL_EXTERNAL: {
    label: '官方/外部记录快照',
    note: '仅表示来源类别；本演示未独立认定其为当前 Official Truth。'
  },
  WORKSPACE_CURRENT: {
    label: 'Workspace 当前数据',
    note: '当前 Workspace owner 值；不会由本页面直接覆盖。'
  },
  CUSTOMER_STATEMENT: {
    label: '客户陈述',
    note: '已记录的客户陈述；在确认前不等同于已核验事实。'
  },
  DOCUMENT_EXTRACTION: {
    label: '文件抽取候选',
    note: '机器抽取候选；必须人工核对原文。'
  },
  AI_SUGGESTION: {
    label: 'AI / Brain 建议',
    note: '非结论、非法律意见，也不会自动成为工作值。'
  },
  HANDLER_CONFIRMED: {
    label: '经办确认结果',
    note: '经办确认的准备事实；不代表主管机关接受或申请已经提交。'
  }
};

function ReviewStatusBadge({ status }: { status: ReviewFieldStatus }) {
  const presentation = statusPresentation[status];
  return (
    <span className={`amr-status amr-status--${status.toLowerCase().replaceAll('_', '-')}`}>
      <span aria-hidden="true">{presentation.icon}</span>
      <span>{presentation.label}</span>
      <span className="amr-status__english">{presentation.labelEn}</span>
    </span>
  );
}

function AuthorityBoundary() {
  return (
    <section className="amr-boundary" aria-label="资料准备权限边界">
      <span className="amr-boundary__icon" aria-hidden="true">
        i
      </span>
      <div>
        <strong>仅用于资料准备；未形成法律意见，未提交申请。</strong>
        <span>
          For application-material preparation only; no legal opinion has been formed and no
          application has been filed.
        </span>
      </div>
    </section>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      brand="MarkOrbit"
      internalOnly
      navigation={
        <SideNavigation
          label="MarkReg Ultimate 主导航"
          items={[
            { label: 'Today', href: '#today' },
            { label: 'Work', href: '#main', active: true },
            { label: 'Matters', href: '#matters' },
            { label: 'Customers', href: '#customers' },
            { label: 'Trademarks', href: '#trademarks' },
            { label: 'Messages', href: '#messages' }
          ]}
        />
      }
      topBar={
        <header className="mo-topbar amr-topbar">
          <strong>MarkReg Ultimate · 申请资料准备</strong>
          <Badge className="amr-fixture-badge">演示数据 · Fixture only</Badge>
        </header>
      }
    >
      <FixtureBanner />
      {children}
    </AppShell>
  );
}

function SourceCard({
  source,
  proposed,
  canPropose,
  onPropose,
  sourceIndex
}: {
  source: ReviewSource;
  proposed: boolean;
  canPropose: boolean;
  onPropose: () => void;
  sourceIndex: number;
}) {
  const copy = sourcePresentation[source.kind];
  return (
    <article className={`amr-source ${proposed ? 'is-proposed' : ''}`}>
      <header>
        <span className="amr-source__index">来源 {String.fromCharCode(65 + sourceIndex)}</span>
        <span className={`amr-currentness amr-currentness--${source.currentness.toLowerCase()}`}>
          {source.currentness === 'CURRENT'
            ? '当前版本'
            : source.currentness === 'STALE'
              ? '已过期'
              : '时效未知'}
        </span>
      </header>
      <strong className="amr-source__value">{source.value}</strong>
      <span className={`amr-source-kind amr-source-kind--${source.kind.toLowerCase()}`}>
        {copy.label}
      </span>
      <dl>
        <div>
          <dt>来源记录</dt>
          <dd>{source.recordLabel}</dd>
        </div>
        <div>
          <dt>定位</dt>
          <dd>{source.locator}</dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>{source.version}</dd>
        </div>
        <div>
          <dt>确认/同步</dt>
          <dd>{source.observedAt}</dd>
        </div>
      </dl>
      <p className="amr-source__note">{source.note ?? copy.note}</p>
      {canPropose && (
        <Button type="button" variant="secondary" aria-pressed={proposed} onClick={onPropose}>
          {proposed ? '已记录为本次拟采用值' : '记录为本次拟采用值'}
        </Button>
      )}
    </article>
  );
}

function counts(items: readonly ReviewItem[]) {
  return {
    present: items.filter((item) => item.status === 'PRESENT').length,
    blocking: items.filter((item) => item.blocking).length,
    missing: items.filter((item) => item.status === 'MISSING').length,
    conflicting: items.filter((item) => item.status === 'CONFLICTING').length,
    unverified: items.filter((item) => item.status === 'UNVERIFIED').length,
    review: items.filter((item) => item.status === 'REVIEW_REQUIRED').length
  };
}

function MatterContext({ fixture }: { fixture: ApplicationMaterialsReviewFixture }) {
  const { matter } = fixture;
  return (
    <>
      <nav className="amr-breadcrumbs" aria-label="面包屑">
        <a href="#matters">商标事务</a>
        <span aria-hidden="true">/</span>
        <a href="#matter">{matter.trademark}</a>
        <span aria-hidden="true">/</span>
        <span>申请资料核对</span>
      </nav>
      <header className="amr-title-row">
        <div>
          <p className="amr-eyebrow">US FILING PREPARATION · FIXTURE PROTOTYPE</p>
          <h1>申请资料核对</h1>
          <p className="amr-title-row__subtitle">Application Materials Review</p>
        </div>
        <div className="amr-matter-identity">
          <strong>{matter.trademark}</strong>
          <span>
            {matter.jurisdiction} · {matter.filingBasis} {matter.filingBasisLabel}
          </span>
          <span>已确认类别：{matter.classes.join('、')}</span>
        </div>
      </header>
      <Card className="amr-snapshot-card">
        <div className="amr-snapshot-card__heading">
          <div>
            <p>来源版本锁定</p>
            <h2>本次核对只读取以下快照</h2>
          </div>
          <Badge>as of {matter.sourceAsOf}</Badge>
        </div>
        <KeyValueList
          items={[
            {
              key: 'Formal Matter',
              value: `${matter.matterId} @ ${matter.matterVersion}`
            },
            {
              key: 'Matter Draft',
              value: `${matter.matterDraftId} @ ${matter.matterDraftVersion}`
            },
            {
              key: 'Customer Confirmation',
              value: `${matter.customerConfirmationId} @ ${matter.customerConfirmationVersion}`
            },
            {
              key: 'Method / Package',
              value: '待 BRN-A0 准入 · 本演示不声明正式美国方法包'
            }
          ]}
        />
      </Card>
    </>
  );
}

function Summary({ items }: { items: readonly ReviewItem[] }) {
  const summary = counts(items);
  const metrics = [
    { label: '已有且一致', value: summary.present, tone: 'present' },
    { label: '阻断项', value: summary.blocking, tone: 'blocking' },
    { label: '缺少资料', value: summary.missing, tone: 'missing' },
    { label: '来源冲突', value: summary.conflicting, tone: 'conflict' },
    { label: '尚未核验', value: summary.unverified, tone: 'unverified' },
    { label: '需经办复核', value: summary.review, tone: 'review' }
  ];
  return (
    <section aria-labelledby="amr-summary-title">
      <div className="amr-section-heading">
        <div>
          <p>REVIEW SUMMARY</p>
          <h2 id="amr-summary-title">先看问题数量，不做准备度评分</h2>
        </div>
        <span>计数来自演示快照，不代表法律结论</span>
      </div>
      <div className="amr-summary-grid">
        {metrics.map((metric) => (
          <div
            className={`amr-summary-metric amr-summary-metric--${metric.tone}`}
            key={metric.label}
          >
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TerminalState({
  state,
  reason
}: {
  state: Extract<ReviewSurfaceState, 'LOADING' | 'EMPTY' | 'FORBIDDEN' | 'UNSUPPORTED'>;
  reason?: string;
}) {
  if (state === 'LOADING')
    return (
      <Card className="amr-terminal-state">
        <LoadingState label="正在加载授权案件与来源版本" />
      </Card>
    );
  if (state === 'EMPTY')
    return (
      <Card className="amr-terminal-state">
        <EmptyState
          title="没有可核对的授权案件"
          description="未找到当前用户可访问的 Matter 或 Matter Draft。系统不会把空结果解释为资料完整。"
          action={<Button variant="secondary">返回 Work</Button>}
        />
      </Card>
    );
  if (state === 'FORBIDDEN')
    return (
      <Card className="amr-terminal-state">
        <ErrorState
          title="需要申请资料准备权限"
          description="当前账号不能查看这件案件。为保护 Workspace 数据，本页面不会显示商标、客户、字段值或来源摘要。"
        />
      </Card>
    );
  return (
    <Alert tone="danger" title="当前申请范围暂不支持">
      {reason ??
        '此案件超出已批准的单一申请人、美国直接申请、标准文字或静态图形商标范围，核对已停止。'}
    </Alert>
  );
}

export function ApplicationMaterialsReview({
  fixture,
  surfaceState = 'WORKING'
}: {
  fixture: ApplicationMaterialsReviewFixture;
  surfaceState?: ReviewSurfaceState;
}) {
  const firstItem = fixture.items[0]?.id ?? '';
  const [selectedItemId, setSelectedItemId] = useState(firstItem);
  const [proposedSources, setProposedSources] = useState<Record<string, string>>({});
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(fixture.questions.map((question) => [question.id, question.text]))
  );
  const [feedback, setFeedback] = useState<'NONE' | 'SAVED' | 'HANDED_OFF'>(
    surfaceState === 'SAVED' ? 'SAVED' : surfaceState === 'HANDED_OFF' ? 'HANDED_OFF' : 'NONE'
  );
  const [handoffConfirmation, setHandoffConfirmation] = useState(false);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const questionsHeadingRef = useRef<HTMLHeadingElement>(null);
  const handoffHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<'DETAIL' | 'QUESTIONS' | 'HANDOFF' | null>(null);

  const selectedItem = useMemo(
    () => fixture.items.find((item) => item.id === selectedItemId) ?? fixture.items[0],
    [fixture.items, selectedItemId]
  );
  const isStale = surfaceState === 'STALE';
  const isReadOnly = surfaceState === 'HANDED_OFF' || feedback === 'HANDED_OFF';

  useEffect(() => {
    if (focusTarget.current === 'DETAIL') detailHeadingRef.current?.focus();
    if (focusTarget.current === 'QUESTIONS') questionsHeadingRef.current?.focus();
    if (focusTarget.current === 'HANDOFF') handoffHeadingRef.current?.focus();
    focusTarget.current = null;
  }, [selectedItemId, questionsOpen, handoffConfirmation]);

  const selectItem = (itemId: string) => {
    focusTarget.current = 'DETAIL';
    setSelectedItemId(itemId);
  };
  const openQuestions = () => {
    focusTarget.current = 'QUESTIONS';
    setQuestionsOpen(true);
  };
  const openHandoff = () => {
    focusTarget.current = 'HANDOFF';
    setHandoffConfirmation(true);
  };

  const terminal = ['LOADING', 'EMPTY', 'FORBIDDEN', 'UNSUPPORTED'].includes(surfaceState);
  if (terminal) {
    return (
      <PageFrame>
        <div className="amr-page">
          <AuthorityBoundary />
          <TerminalState
            state={
              surfaceState as Extract<
                ReviewSurfaceState,
                'LOADING' | 'EMPTY' | 'FORBIDDEN' | 'UNSUPPORTED'
              >
            }
            {...(fixture.unsupportedReason ? { reason: fixture.unsupportedReason } : {})}
          />
        </div>
      </PageFrame>
    );
  }

  if (!selectedItem) {
    return (
      <PageFrame>
        <div className="amr-page">
          <AuthorityBoundary />
          <Card>
            <EmptyState
              title="核对清单尚未建立"
              description="案件存在，但当前版本没有任何可核对字段。此状态不会被当作资料完整。"
            />
          </Card>
        </div>
      </PageFrame>
    );
  }

  const handoffBlocked = !fixture.handoffAllowed || isStale || isReadOnly;
  const saveBlocked = isStale || isReadOnly;
  const selectedProposedSource = proposedSources[selectedItem.id];

  return (
    <PageFrame>
      <div className="amr-page">
        <MatterContext fixture={fixture} />
        <AuthorityBoundary />

        {surfaceState === 'DEPENDENCY_UNAVAILABLE' && (
          <Alert tone="warning" title="AI / 文件抽取暂不可用">
            已有 owner
            数据和人工核对路径仍可使用。系统不会把依赖失败显示成“没有问题”，也不会自动补写事实。
          </Alert>
        )}
        {surfaceState === 'SAVE_ERROR' && (
          <Alert tone="danger" title="核对结果暂未保存">
            你的问题草稿和拟采用值仍保留在当前页面。请重试保存；本次失败没有形成服务器快照。
          </Alert>
        )}
        {isStale && (
          <Alert tone="warning" title="来源版本已变化，旧快照仅供比较">
            Matter Draft
            已有更新版本。本页面保留旧值用于差异核对，但保存与经办交接已停止；请先重新加载当前来源。
          </Alert>
        )}
        {feedback === 'SAVED' && (
          <div className="amr-feedback" aria-live="polite">
            <Alert tone="success" title="演示快照已保存">
              本次资料核对结果已保存，可交由下一步复核。尚未形成法律意见，也未提交任何商标申请。
            </Alert>
            <p>
              Fixture receipt：{fixture.snapshot.id} @ {fixture.snapshot.version} ·{' '}
              {fixture.snapshot.actor} · {fixture.snapshot.updatedAt}
            </p>
          </div>
        )}
        {feedback === 'HANDED_OFF' && (
          <div className="amr-feedback" aria-live="polite">
            <Alert tone="success" title="已记录经办复核请求（界面演示）">
              此非权威回执仅展示预期交接结果；未创建或推进 Professional Review owner
              状态，也未提交任何商标申请。
            </Alert>
          </div>
        )}

        <Summary items={fixture.items} />

        <section aria-labelledby="amr-workbench-title">
          <div className="amr-section-heading">
            <div>
              <p>STRUCTURED REVIEW</p>
              <h2 id="amr-workbench-title">逐项核对事实、材料与来源</h2>
            </div>
            <span>选择字段后，在右侧查看 exact source 与版本</span>
          </div>

          <div className="amr-workbench">
            <nav className="amr-section-nav" aria-label="核对分组">
              <p>核对分组</p>
              <ul>
                {fixture.sections.map((section) => {
                  const sectionItems = fixture.items.filter(
                    (item) => item.sectionId === section.id
                  );
                  const attention = sectionItems.filter(
                    (item) => !['PRESENT', 'NOT_APPLICABLE'].includes(item.status)
                  ).length;
                  const active = selectedItem.sectionId === section.id;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => sectionItems[0] && selectItem(sectionItems[0].id)}
                      >
                        <span>
                          <strong>{section.label}</strong>
                          <small>{section.labelEn}</small>
                        </span>
                        <b aria-label={`${attention} 项需关注`}>{attention}</b>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="amr-checklist">
              {fixture.sections.map((section) => {
                const sectionItems = fixture.items.filter((item) => item.sectionId === section.id);
                return (
                  <section aria-labelledby={`amr-section-${section.id}`} key={section.id}>
                    <header>
                      <div>
                        <h3 id={`amr-section-${section.id}`}>{section.label}</h3>
                        <span>{section.labelEn}</span>
                      </div>
                      <p>{section.description}</p>
                    </header>
                    <ul>
                      {sectionItems.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={selectedItem.id === item.id ? 'is-selected' : undefined}
                            aria-pressed={selectedItem.id === item.id}
                            onClick={() => selectItem(item.id)}
                          >
                            <span className="amr-checklist-item__copy">
                              <span className="amr-checklist-item__label">
                                <strong>{item.label}</strong>
                                <small>{item.labelEn}</small>
                              </span>
                              <span className="amr-checklist-item__value">
                                {item.workingValue ?? item.summary}
                              </span>
                            </span>
                            <span className="amr-checklist-item__status">
                              {item.blocking && <em>阻断</em>}
                              <ReviewStatusBadge status={item.status} />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            <section className="amr-inspector" aria-labelledby="amr-inspector-title">
              <div className="amr-inspector__heading">
                <p>FIELD INSPECTOR</p>
                <h3 id="amr-inspector-title" ref={detailHeadingRef} tabIndex={-1}>
                  {selectedItem.label}
                </h3>
                <span>{selectedItem.labelEn}</span>
              </div>
              <ReviewStatusBadge status={selectedItem.status} />
              <p className="amr-inspector__summary">{selectedItem.summary}</p>

              {selectedItem.workingValue && (
                <div className="amr-working-value">
                  <span>当前工作值</span>
                  <strong>{selectedItem.workingValue}</strong>
                  <small>只属于本次准备快照，不会覆盖 owner 原值。</small>
                </div>
              )}

              {selectedItem.status === 'CONFLICTING' && (
                <Alert tone="warning" title="来源冲突，MO 不会自动选择">
                  请并列核对每个来源。记录“拟采用值”只影响本次演示草稿，原 Owner 数据保持不变。
                </Alert>
              )}
              {selectedItem.status === 'UNKNOWN' && (
                <Alert tone="info" title="未知不等于否">
                  当前来源不足以确定事实。“未找到”不会被写成法律上的“不存在”。
                </Alert>
              )}

              <div className="amr-sources" aria-label={`${selectedItem.label}的来源`}>
                {selectedItem.sources.length > 0 ? (
                  selectedItem.sources.map((source, index) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      sourceIndex={index}
                      proposed={selectedProposedSource === source.id}
                      canPropose={
                        !isReadOnly &&
                        !isStale &&
                        ['CONFLICTING', 'UNVERIFIED', 'UNKNOWN'].includes(selectedItem.status)
                      }
                      onPropose={() =>
                        setProposedSources((current) => ({
                          ...current,
                          [selectedItem.id]: source.id
                        }))
                      }
                    />
                  ))
                ) : (
                  <p className="amr-no-source">
                    当前没有可用来源。此状态保持为缺失/未知，不会推断出否定事实。
                  </p>
                )}
              </div>

              {selectedProposedSource && (
                <p className="amr-proposed-note" role="status">
                  已记录本次拟采用值；仍需保存核对结果，且不会修改来源 Owner。
                </p>
              )}
              {selectedItem.questionDraft && (
                <button type="button" className="amr-text-action" onClick={openQuestions}>
                  查看这项的待问草稿 →
                </button>
              )}
            </section>
          </div>
        </section>

        {questionsOpen && (
          <section className="amr-questions" aria-labelledby="amr-questions-title">
            <div className="amr-questions__heading">
              <div>
                <p>QUESTION DRAFTS · UNSENT</p>
                <h2 id="amr-questions-title" ref={questionsHeadingRef} tabIndex={-1}>
                  待问清单（草稿，未发送）
                </h2>
              </div>
              <Badge className="amr-unsent-badge">不会自动发送</Badge>
            </div>
            <Alert tone="info" title="准备问题，不发消息">
              编辑或保存这些草稿不会创建站内信、邮件、客户通知或 Professional Review Case。
            </Alert>
            <div className="amr-question-grid">
              {fixture.questions.map((question, index) => {
                const item = fixture.items.find((candidate) => candidate.id === question.itemId);
                return (
                  <Card key={question.id}>
                    <div className="amr-question-card__meta">
                      <span>问题 {index + 1}</span>
                      <span>{question.audience}</span>
                    </div>
                    <strong>{item?.label ?? '待核对事项'}</strong>
                    <TextArea
                      label={`问题 ${index + 1} 草稿`}
                      value={questionDrafts[question.id] ?? ''}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        setQuestionDrafts((current) => ({
                          ...current,
                          [question.id]: event.target.value
                        }))
                      }
                    />
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {handoffConfirmation && !handoffBlocked && (
          <section className="amr-handoff-confirmation" aria-labelledby="amr-handoff-title">
            <p>HANDLER HANDOFF · FIXTURE CONFIRMATION</p>
            <h2 id="amr-handoff-title" ref={handoffHeadingRef} tabIndex={-1}>
              确认提交经办复核？
            </h2>
            <p>
              将演示快照 {fixture.snapshot.id} @ {fixture.snapshot.version} 交给指定经办人查看。
              这不是专业复核结论，不改变 Matter Draft，也不会报件。
            </p>
            <ul>
              <li>问题草稿仍为未发送</li>
              <li>冲突来源与拟采用值将同时保留</li>
              <li>只有正式 owner receipt 才能证明进入真实队列</li>
            </ul>
            <div>
              <Button
                type="button"
                onClick={() => {
                  setHandoffConfirmation(false);
                  setFeedback('HANDED_OFF');
                }}
              >
                确认提交经办复核（演示）
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setHandoffConfirmation(false)}
              >
                返回继续核对
              </Button>
            </div>
          </section>
        )}

        <footer className="amr-action-bar" aria-label="核对操作">
          <div>
            <strong>{isReadOnly ? '已交接，只读演示' : '本次核对尚未产生外部动作'}</strong>
            <span>
              Review snapshot {fixture.snapshot.id} @ {fixture.snapshot.version}
            </span>
          </div>
          <div className="amr-action-bar__actions">
            <Button
              type="button"
              variant={fixture.handoffAllowed ? 'secondary' : 'primary'}
              disabled={saveBlocked}
              onClick={() => setFeedback('SAVED')}
            >
              保存核对结果
              <span>Save Review</span>
            </Button>
            <Button type="button" variant="secondary" onClick={openQuestions}>
              生成待问清单
              <span>Prepare Questions</span>
            </Button>
            <Button
              type="button"
              variant={fixture.handoffAllowed ? 'primary' : 'secondary'}
              disabled={handoffBlocked}
              aria-describedby="amr-handoff-rule"
              onClick={openHandoff}
            >
              提交经办复核
              <span>Submit for Handler Review</span>
            </Button>
          </div>
          <p id="amr-handoff-rule">
            {fixture.handoffAllowed
              ? '当前演示 fixture 的 owner 信号允许请求交接；前端未自行推导。'
              : '当前 owner/fixture 信号不允许交接；请先处理阻断项。'}
          </p>
        </footer>
      </div>
    </PageFrame>
  );
}
