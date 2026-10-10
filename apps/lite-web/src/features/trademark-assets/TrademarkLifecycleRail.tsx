import {
  Alert,
  AppShell,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  SideNavigation,
  TopBar
} from '@markorbit/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  LifecycleActionState,
  LifecycleMilestoneFixture,
  LifecycleProcessState,
  LifecycleSourceState,
  LifecycleStageFixture,
  LifecycleSurfaceState,
  LifecycleTimeAssertion,
  LifecycleTimeKind,
  TrademarkLifecycleFixture
} from './trademark-lifecycle-rail-fixtures.js';
import './trademark-lifecycle-rail.css';

const processPresentation: Readonly<
  Record<LifecycleProcessState, { icon: string; label: string }>
> = {
  OCCURRED: { icon: '✓', label: '已发生' },
  CURRENT: { icon: '●', label: '当前阶段' },
  UPCOMING: { icon: '◇', label: '即将到达' },
  FUTURE: { icon: '○', label: '尚未进入' },
  UNKNOWN: { icon: '?', label: '无法确定' },
  NOT_APPLICABLE: { icon: '—', label: '不适用' }
};

const timePresentation: Readonly<
  Record<LifecycleTimeKind, { icon: string; label: string; className: string }>
> = {
  SOURCE_RECORDED: { icon: '●', label: '来源记录日期', className: 'recorded' },
  REVIEWED_TIMING: {
    icon: '◆',
    label: '经办复核时间依据（非官方期限）',
    className: 'reviewed'
  },
  RULE_WINDOW: { icon: '▱', label: '规则计算窗口', className: 'rule-window' },
  MO_PREDICTION: { icon: '◌', label: 'MO 预测', className: 'prediction' },
  TYPICAL_RANGE: { icon: '↔', label: '通常范围', className: 'range' },
  UNKNOWN: { icon: '?', label: '时间未知', className: 'unknown' },
  CONFLICTING: { icon: '!', label: '时间冲突', className: 'conflicting' }
};

const sourceStateLabel: Readonly<Record<LifecycleSourceState, string>> = {
  CURRENT: '当前来源',
  STALE: '来源已过期',
  CONFLICTING: '来源冲突',
  PARTIAL: '来源不完整',
  UNAVAILABLE: '来源不可用',
  NOT_COVERED: '暂未覆盖'
};

const actionStateLabel: Readonly<Record<LifecycleActionState, string>> = {
  NONE: '无动作',
  NOTICE: '建议关注',
  REQUIRED: '需准备',
  ACKNOWLEDGED: '已知悉',
  DISMISSED: '已忽略',
  INELIGIBLE: '暂不可进入',
  OVERDUE: '已逾期'
};

function PageFrame({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!window.matchMedia?.('(max-width: 760px)').matches) return;
    const activeNavigation = document.querySelector<HTMLAnchorElement>(
      '.mo-shell:has(.tlr-page) .mo-side-nav a[aria-current="page"]'
    );
    activeNavigation?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, []);

  return (
    <AppShell
      brand="MarkOrbit Lite"
      navigation={
        <SideNavigation
          label="Lite 主导航"
          items={[
            { label: '今日 Today', href: '#today' },
            { label: '内容 Content', href: '#content' },
            { label: '商机 Opportunities', href: '#opportunities' },
            { label: '商标 Trademarks', href: '#trademarks', active: true },
            { label: '工作 Work', href: '#work' },
            { label: '能力 Capability', href: '#capability' },
            { label: '指南 Guide', href: '#guide' }
          ]}
        />
      }
      topBar={
        <TopBar
          context="Northstar IP · 演示 Workspace"
          actions={<Badge className="tlr-fixture-badge">演示数据 · Fixture only</Badge>}
        />
      }
    >
      <div className="mo-fixture tlr-fixture-banner" role="alert">
        <strong>演示数据——不构成法律意见或官方报件建议。</strong>
        <span>Fixture only</span>
      </div>
      {children}
    </AppShell>
  );
}

function AuthorityBoundary() {
  return (
    <section className="tlr-boundary" aria-label="生命周期信息权限边界">
      <span aria-hidden="true">i</span>
      <div>
        <strong>来源记录、规则计算和预测必须分开理解。</strong>
        <p>
          本原型不核验 Official Truth，不认证法律期限，也不会因节点或建议自动创建
          Matter、Work、Order、Payment 或 Filing。
        </p>
      </div>
    </section>
  );
}

function AssetHeader({ fixture }: { fixture: TrademarkLifecycleFixture }) {
  const { asset } = fixture;
  return (
    <>
      <nav className="tlr-breadcrumbs" aria-label="面包屑">
        <a href="#trademarks">商标资产</a>
        <span aria-hidden="true">/</span>
        <span>{asset.mark}</span>
      </nav>
      <header className="tlr-asset-header">
        <div className="tlr-mark" aria-hidden="true">
          {asset.monogram}
        </div>
        <div className="tlr-asset-header__identity">
          <p>
            商标资产 · <span lang="en">Trademark asset</span> · {asset.jurisdictionCode}
          </p>
          <h1>{asset.mark}</h1>
          <div className="tlr-asset-header__meta">
            <span>
              {asset.jurisdictionLabel} · {asset.numberLabel} {asset.number}
            </span>
            <span>{asset.relationship}</span>
          </div>
        </div>
        <div className="tlr-asset-header__freshness">
          <span className={`tlr-source-state is-${asset.freshness.toLowerCase()}`}>
            {sourceStateLabel[asset.freshness]}
          </span>
          <small>最近同步</small>
          <strong>
            <time dateTime={asset.syncedAtDateTime}>{asset.syncedAt}</time>
          </strong>
        </div>
      </header>
    </>
  );
}

function StateNotice({ state }: { state: LifecycleSurfaceState }) {
  if (state === 'PARTIAL')
    return (
      <Alert tone="warning" title="部分生命周期信息暂不可用">
        已有节点继续显示；缺少的未来节点、异议数量或日期不会被推断成“没有”。
      </Alert>
    );
  if (state === 'STALE')
    return (
      <Alert tone="warning" title="来源已过期，保留上次生命周期供核对">
        请刷新当前来源后再进入办理。旧轨道不会自动变成当前事实。
      </Alert>
    );
  if (state === 'CONFLICTING')
    return (
      <Alert tone="warning" title="当前阶段存在来源冲突">
        MO 已停在最后无争议节点，不会自动选边，也不会开放受影响事项的办理入口。
      </Alert>
    );
  if (state === 'LIMITED_MANUAL')
    return (
      <Alert tone="warning" title="当前法域仅支持有限人工管理">
        资产仍可管理，但未来节点、DAU 或续展日期不会在 Rule Pack 准入前自动生成。
      </Alert>
    );
  if (state === 'DEPENDENCY_UNAVAILABLE')
    return (
      <Alert tone="warning" title="预测依赖暂不可用">
        已有来源记录仍然可见；预测与相关入口已停止，系统不会用本地猜测补齐。
      </Alert>
    );
  if (state === 'NOT_COVERED')
    return (
      <Alert tone="warning" title="该法域或程序暂未覆盖">
        可继续查看资产本身，但生命周期规则和自动事项入口不可用。
      </Alert>
    );
  if (state === 'OVERDUE')
    return (
      <Alert tone="danger" title="演示建议处理日期已过去">
        逾期提示不是法律结论。请先由经办人核对来源、适用规则和实际期限，再决定后续工作。
      </Alert>
    );
  return null;
}

function TimeBadge({ time }: { time: LifecycleTimeAssertion }) {
  const presentation = timePresentation[time.kind];
  return (
    <span className={`tlr-time-badge is-${presentation.className}`}>
      <span aria-hidden="true">{presentation.icon}</span>
      <span>{presentation.label}</span>
    </span>
  );
}

function TimeValue({ time }: { time: LifecycleTimeAssertion }) {
  return (
    <span className="tlr-time-value">
      {time.dateTime ? <time dateTime={time.dateTime}>{time.value}</time> : time.value}
      {time.endValue ? (
        <>
          {' 至 '}
          {time.endDateTime ? (
            <time dateTime={time.endDateTime}>{time.endValue}</time>
          ) : (
            time.endValue
          )}
        </>
      ) : null}
    </span>
  );
}

function timeAccessibleValue(time: LifecycleTimeAssertion) {
  return time.endValue ? `${time.value} 至 ${time.endValue}` : time.value;
}

function isCurrentProcessState(state: LifecycleProcessState) {
  return processPresentation[state].label === '当前阶段';
}

function MacroStageRail({
  stages,
  currentStageId,
  expandedStageId,
  onChoose
}: {
  stages: readonly LifecycleStageFixture[];
  currentStageId: string;
  expandedStageId: string;
  onChoose: (stage: LifecycleStageFixture) => void;
}) {
  return (
    <ol className="tlr-stage-rail" aria-label="商标生命周期阶段">
      {stages.map((stage, index) => {
        const presentation = processPresentation[stage.processState];
        const current = stage.id === currentStageId;
        const selected = stage.id === expandedStageId;
        return (
          <li
            className={`tlr-stage is-${stage.processState.toLowerCase()} ${selected ? 'is-selected' : ''}`}
            key={stage.id}
          >
            <button
              type="button"
              aria-current={current ? 'step' : undefined}
              aria-pressed={selected}
              aria-label={`第 ${index + 1} 阶段，${stage.label}，${presentation.label}${selected ? '，已选择' : ''}。${stage.summary}`}
              onClick={() => onChoose(stage)}
            >
              <span className="tlr-stage__node" aria-hidden="true">
                {presentation.icon}
              </span>
              <span className="tlr-stage__copy">
                <strong>{stage.label}</strong>
                <small>{stage.labelEn}</small>
                <em>{presentation.label}</em>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function MilestoneRail({
  stage,
  selectedMilestoneId,
  onChoose,
  registerButton
}: {
  stage: LifecycleStageFixture;
  selectedMilestoneId: string | null;
  onChoose: (milestone: LifecycleMilestoneFixture) => void;
  registerButton: (id: string, node: HTMLButtonElement | null) => void;
}) {
  if (stage.milestones.length === 0) {
    return (
      <div className="tlr-no-milestones">
        <strong>当前没有已准入的详细节点</strong>
        <span>未覆盖不等于没有义务；请进入人工来源核对。</span>
      </div>
    );
  }
  return (
    <ol className="tlr-milestone-rail" aria-label={`${stage.label}阶段详细节点`}>
      {stage.milestones.map((milestone, index) => {
        const process = processPresentation[milestone.processState];
        const time = timePresentation[milestone.time.kind];
        const selected = milestone.id === selectedMilestoneId;
        return (
          <li
            className={`tlr-milestone is-${milestone.processState.toLowerCase()} is-${time.className} ${selected ? 'is-selected' : ''}`}
            key={milestone.id}
          >
            <button
              type="button"
              ref={(node) => registerButton(milestone.id, node)}
              aria-current={isCurrentProcessState(milestone.processState) ? 'step' : undefined}
              aria-pressed={selected}
              aria-label={`${stage.label}阶段，第 ${index + 1} 个节点，${milestone.label}，${process.label}，${time.label}，${timeAccessibleValue(milestone.time)}，${sourceStateLabel[milestone.sourceState]}${selected ? '，已选择' : ''}`}
              onClick={() => onChoose(milestone)}
            >
              <span className="tlr-milestone__node" aria-hidden="true">
                {process.icon}
              </span>
              <span className="tlr-milestone__copy">
                <strong>{milestone.label}</strong>
                <small>{milestone.labelEn}</small>
                <TimeValue time={milestone.time} />
                {milestone.action ? (
                  <em className={`is-${milestone.action.state.toLowerCase()}`}>
                    {actionStateLabel[milestone.action.state]}
                  </em>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function SourceCard({ source }: { source: LifecycleMilestoneFixture['sources'][number] }) {
  return (
    <article className="tlr-source-card">
      <header>
        <span>{source.label}</span>
        <b className={`tlr-source-state is-${source.state.toLowerCase()}`}>
          {sourceStateLabel[source.state]}
        </b>
      </header>
      <dl>
        <div>
          <dt>Owner</dt>
          <dd>{source.owner}</dd>
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
          <dt>观察/计算</dt>
          <dd>
            <time dateTime={source.observedAtDateTime}>{source.observedAt}</time>
          </dd>
        </div>
      </dl>
      <p>{source.note}</p>
    </article>
  );
}

function MilestoneDetail({
  milestone,
  fixture,
  headingRef,
  onClose,
  onPreviewHandoff,
  actionEnabled
}: {
  milestone: LifecycleMilestoneFixture;
  fixture: TrademarkLifecycleFixture;
  headingRef: React.RefObject<HTMLHeadingElement>;
  onClose: () => void;
  onPreviewHandoff: (trigger: HTMLButtonElement) => void;
  actionEnabled: boolean;
}) {
  const process = processPresentation[milestone.processState];
  return (
    <section className="tlr-detail" aria-labelledby="tlr-detail-heading">
      <header className="tlr-detail__heading">
        <div>
          <p>
            里程碑详情 · <span lang="en">Milestone detail · Fixture</span>
          </p>
          <h3 id="tlr-detail-heading" ref={headingRef} tabIndex={-1}>
            {milestone.label}
          </h3>
          <span>{milestone.labelEn}</span>
        </div>
        <Button variant="secondary" type="button" onClick={onClose}>
          关闭详情
        </Button>
      </header>
      <div className="tlr-detail__grid">
        <div className="tlr-detail__meaning">
          <div className="tlr-detail__labels">
            <span className={`tlr-process-badge is-${milestone.processState.toLowerCase()}`}>
              <span aria-hidden="true">{process.icon}</span> {process.label}
            </span>
            <TimeBadge time={milestone.time} />
            <span className={`tlr-source-state is-${milestone.sourceState.toLowerCase()}`}>
              {sourceStateLabel[milestone.sourceState]}
            </span>
          </div>
          <p className="tlr-detail__description">{milestone.description}</p>
          <div className="tlr-detail__time">
            <span>{milestone.time.label}</span>
            <strong>
              <TimeValue time={milestone.time} />
            </strong>
          </div>
          {milestone.limitation ? (
            <p className="tlr-detail__limitation">限制：{milestone.limitation}</p>
          ) : null}
          {milestone.action ? (
            <Card className="tlr-detail__action">
              <span>{actionStateLabel[milestone.action.state]}</span>
              <h4>{milestone.action.title}</h4>
              <p>{milestone.action.summary}</p>
              <strong>{milestone.action.timing}</strong>
              <Button
                type="button"
                disabled={!actionEnabled}
                onClick={(event) => onPreviewHandoff(event.currentTarget)}
              >
                开始准备（演示）
              </Button>
              {!actionEnabled ? <small>当前状态不允许进入受控工作台。</small> : null}
            </Card>
          ) : null}
        </div>
        <div className="tlr-detail__sources">
          <h4>来源与依据</h4>
          {milestone.sources.length ? (
            milestone.sources.map((source) => <SourceCard key={source.id} source={source} />)
          ) : (
            <p>没有可展示的来源；系统不会补写节点事实。</p>
          )}
          <details>
            <summary>高级：投影与规则信息</summary>
            <dl>
              <div>
                <dt>Lifecycle fixture</dt>
                <dd>
                  {fixture.projection.id} @ {fixture.projection.version}
                </dd>
              </div>
              <div>
                <dt>Asset</dt>
                <dd>
                  {fixture.asset.id} @ {fixture.asset.version}
                </dd>
              </div>
              <div>
                <dt>As of</dt>
                <dd>
                  <time dateTime={fixture.projection.asOfDateTime}>{fixture.projection.asOf}</time>
                </dd>
              </div>
              {fixture.projection.rulePack ? (
                <div>
                  <dt>Rule Pack</dt>
                  <dd>
                    {fixture.projection.rulePack.label} @ {fixture.projection.rulePack.version} ·
                    未准入运行
                  </dd>
                </div>
              ) : null}
              {fixture.projection.predictionMethod ? (
                <div>
                  <dt>Prediction method</dt>
                  <dd>
                    {fixture.projection.predictionMethod.label} @{' '}
                    {fixture.projection.predictionMethod.version}
                  </dd>
                </div>
              ) : null}
            </dl>
          </details>
        </div>
      </div>
    </section>
  );
}

function NextMatter({
  fixture,
  surfaceState,
  recommendationState,
  onInspect,
  onPreviewHandoff,
  onRecommendationState
}: {
  fixture: TrademarkLifecycleFixture;
  surfaceState: LifecycleSurfaceState;
  recommendationState: LifecycleActionState;
  onInspect: () => void;
  onPreviewHandoff: (trigger: HTMLButtonElement) => void;
  onRecommendationState: (state: LifecycleActionState) => void;
}) {
  const recommendation = fixture.recommendedAction;
  const actionMilestone = fixture.projection.stages
    .flatMap((stage) => stage.milestones)
    .find((milestone) => milestone.id === recommendation?.milestoneId);
  const unsafeState = !['READY'].includes(surfaceState);
  const eligible =
    Boolean(actionMilestone?.action?.eligibility === 'ELIGIBLE') &&
    !unsafeState &&
    recommendationState === 'REQUIRED';

  return (
    <Card className="tlr-next-matter">
      <div className="tlr-next-matter__current">
        <span>当前阶段</span>
        <strong>{fixture.projection.currentLabel}</strong>
        <p>{fixture.projection.nextSummary}</p>
      </div>
      <div className="tlr-next-matter__action">
        <span>下一事项</span>
        {recommendation ? (
          <>
            <div className="tlr-next-matter__title">
              <h2>{recommendation.title}</h2>
              <b className={`is-${recommendationState.toLowerCase()}`}>
                {actionStateLabel[recommendationState]}
              </b>
            </div>
            <p>{recommendation.explanation}</p>
            {actionMilestone ? (
              <div className="tlr-next-matter__timing">
                <TimeBadge time={actionMilestone.time} />
                <strong>
                  <TimeValue time={actionMilestone.time} />
                </strong>
              </div>
            ) : null}
            <div className="tlr-next-matter__buttons">
              <Button type="button" variant="secondary" onClick={onInspect}>
                查看要求
              </Button>
              <Button
                type="button"
                disabled={!eligible}
                onClick={(event) => onPreviewHandoff(event.currentTarget)}
              >
                开始准备（演示）
              </Button>
            </div>
            {recommendationState === 'REQUIRED' ? (
              <details className="tlr-recommendation-disposition">
                <summary>处理这条建议</summary>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onRecommendationState('ACKNOWLEDGED')}
                  >
                    标记已知悉
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onRecommendationState('DISMISSED')}
                  >
                    忽略建议
                  </Button>
                </div>
                <p>这些操作只记录对建议的处理，不会改变生命周期事实或正式状态。</p>
              </details>
            ) : null}
          </>
        ) : (
          <>
            <h2>目前无已准入待办</h2>
            <p>没有 Recommended Action 不代表没有法律义务；请继续关注来源更新。</p>
          </>
        )}
      </div>
    </Card>
  );
}

function HandoffPreview({
  fixture,
  milestone,
  receipt,
  onCreateReceipt,
  onClose,
  headingRef
}: {
  fixture: TrademarkLifecycleFixture;
  milestone: LifecycleMilestoneFixture;
  receipt: boolean;
  onCreateReceipt: () => void;
  onClose: () => void;
  headingRef: React.RefObject<HTMLHeadingElement>;
}) {
  return (
    <section className="tlr-handoff" aria-labelledby="tlr-handoff-heading">
      <p>
        受控工作交接预览 · <span lang="en">Governed work handoff · Fixture</span>
      </p>
      <h2 id="tlr-handoff-heading" ref={headingRef} tabIndex={-1}>
        准备进入受控工作台
      </h2>
      <p>
        本预览将携带 Asset、Lifecycle fixture、Milestone 和 Recommended Action 的精确演示版本。
        它不会自动创建工作、案件、订单、付款或报件。
      </p>
      <dl>
        <div>
          <dt>Asset</dt>
          <dd>
            {fixture.asset.id} @ {fixture.asset.version}
          </dd>
        </div>
        <div>
          <dt>Milestone</dt>
          <dd>{milestone.id}</dd>
        </div>
        <div>
          <dt>Lifecycle fixture</dt>
          <dd>
            {fixture.projection.id} @ {fixture.projection.version}
          </dd>
        </div>
        <div>
          <dt>目标</dt>
          <dd>{milestone.action?.target ?? 'No eligible target'}</dd>
        </div>
      </dl>
      {receipt ? (
        <Alert tone="success" title="已生成演示交接回执">
          仅记录浏览器内的高保真结果；未创建 Work、Matter、Order，未发送消息，未授权或提交 Filing。
        </Alert>
      ) : null}
      <div>
        <Button type="button" disabled={receipt} onClick={onCreateReceipt}>
          生成演示交接回执
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          返回资产
        </Button>
      </div>
    </section>
  );
}

function LifecycleWorkbench({
  fixture,
  surfaceState
}: {
  fixture: TrademarkLifecycleFixture;
  surfaceState: LifecycleSurfaceState;
}) {
  const recommendedMilestoneId = fixture.recommendedAction?.milestoneId;
  const currentStage =
    fixture.projection.stages.find((stage) => stage.id === fixture.projection.currentStageId) ??
    fixture.projection.stages[0];
  const [expandedStageId, setExpandedStageId] = useState(currentStage?.id ?? '');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    recommendedMilestoneId ?? currentStage?.milestones[0]?.id ?? null
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusDetail, setFocusDetail] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffReceipt, setHandoffReceipt] = useState(false);
  const [recommendationState, setRecommendationState] = useState<LifecycleActionState>(
    fixture.recommendedAction?.status ?? 'NONE'
  );
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const handoffHeadingRef = useRef<HTMLHeadingElement>(null);
  const handoffTriggerRef = useRef<HTMLButtonElement | null>(null);
  const milestoneButtons = useRef<Record<string, HTMLButtonElement | null>>({});

  const expandedStage =
    fixture.projection.stages.find((stage) => stage.id === expandedStageId) ?? currentStage;
  const selectedMilestone = useMemo(
    () =>
      fixture.projection.stages
        .flatMap((stage) => stage.milestones)
        .find((milestone) => milestone.id === selectedMilestoneId),
    [fixture.projection.stages, selectedMilestoneId]
  );

  useEffect(() => {
    if (focusDetail) {
      detailHeadingRef.current?.focus();
      setFocusDetail(false);
    }
  }, [focusDetail, selectedMilestoneId]);

  useEffect(() => {
    if (!handoffOpen) return;
    handoffHeadingRef.current?.focus();
    handoffHeadingRef.current?.scrollIntoView?.({ block: 'start' });
  }, [handoffOpen]);

  const chooseMilestone = (milestone: LifecycleMilestoneFixture) => {
    setSelectedMilestoneId(milestone.id);
    setDetailOpen(true);
    setFocusDetail(true);
  };
  const inspectRecommended = () => {
    if (!recommendedMilestoneId) return;
    const stage = fixture.projection.stages.find((candidate) =>
      candidate.milestones.some((milestone) => milestone.id === recommendedMilestoneId)
    );
    if (stage) setExpandedStageId(stage.id);
    setSelectedMilestoneId(recommendedMilestoneId);
    setDetailOpen(true);
    setFocusDetail(true);
  };
  const closeDetail = () => {
    const previousId = selectedMilestoneId;
    setDetailOpen(false);
    window.setTimeout(() => {
      if (previousId) milestoneButtons.current[previousId]?.focus();
    }, 0);
  };
  const openHandoff = (trigger: HTMLButtonElement) => {
    handoffTriggerRef.current = trigger;
    setHandoffOpen(true);
    setHandoffReceipt(false);
  };
  const unsafeAction =
    surfaceState !== 'READY' ||
    sourceStateLabel[fixture.projection.sourceState] !== '当前来源' ||
    selectedMilestone?.action?.eligibility !== 'ELIGIBLE' ||
    recommendationState !== 'REQUIRED';

  if (!currentStage || !expandedStage) {
    return (
      <EmptyState
        title="尚无可展示的生命周期"
        description="资产存在，但当前 fixture 没有阶段数据；这不是生命周期已完成。"
      />
    );
  }

  return (
    <>
      <NextMatter
        fixture={fixture}
        surfaceState={surfaceState}
        recommendationState={recommendationState}
        onInspect={inspectRecommended}
        onPreviewHandoff={(trigger) => {
          inspectRecommended();
          openHandoff(trigger);
        }}
        onRecommendationState={setRecommendationState}
      />

      {recommendationState === 'ACKNOWLEDGED' || recommendationState === 'DISMISSED' ? (
        <p className="tlr-advisory-feedback" role="status">
          Recommended Action 已{recommendationState === 'ACKNOWLEDGED' ? '知悉' : '忽略'}
          （浏览器演示）。 生命周期事实和里程碑没有改变。
        </p>
      ) : null}

      <section className="tlr-lifecycle" aria-labelledby="tlr-lifecycle-heading">
        <header className="tlr-section-heading">
          <div>
            <p>
              商标生命周期 · <span lang="en">Lifecycle fixture projection</span>
            </p>
            <h2 id="tlr-lifecycle-heading">商标生命周期</h2>
          </div>
          <div>
            <span>{sourceStateLabel[fixture.projection.sourceState]}</span>
            <small>
              截至 <time dateTime={fixture.projection.asOfDateTime}>{fixture.projection.asOf}</time>
            </small>
          </div>
        </header>

        <MacroStageRail
          stages={fixture.projection.stages}
          currentStageId={fixture.projection.currentStageId}
          expandedStageId={expandedStageId}
          onChoose={(stage) => {
            setExpandedStageId(stage.id);
            const first = stage.milestones[0];
            setSelectedMilestoneId(first?.id ?? null);
            setDetailOpen(false);
          }}
        />

        <div className="tlr-stage-summary">
          <div>
            <span>已展开阶段</span>
            <strong>
              {expandedStage.label} · {expandedStage.labelEn}
            </strong>
          </div>
          <p>{expandedStage.summary}</p>
        </div>

        <MilestoneRail
          stage={expandedStage}
          selectedMilestoneId={selectedMilestoneId}
          onChoose={chooseMilestone}
          registerButton={(id, node) => {
            milestoneButtons.current[id] = node;
          }}
        />

        {detailOpen && selectedMilestone ? (
          <MilestoneDetail
            milestone={selectedMilestone}
            fixture={fixture}
            headingRef={detailHeadingRef}
            onClose={closeDetail}
            onPreviewHandoff={openHandoff}
            actionEnabled={!unsafeAction}
          />
        ) : null}

        <details className="tlr-rules">
          <summary>来源、规则与预测说明</summary>
          <div>
            {fixture.projection.rulePack ? (
              <p>
                <strong>Rule Pack：</strong> {fixture.projection.rulePack.label} @{' '}
                {fixture.projection.rulePack.version}；状态：未准入运行。
              </p>
            ) : null}
            {fixture.projection.predictionMethod ? (
              <p>
                <strong>预测方法：</strong> {fixture.projection.predictionMethod.label} @{' '}
                {fixture.projection.predictionMethod.version}；生成于{' '}
                {fixture.projection.predictionMethod.generatedAt}。
              </p>
            ) : null}
            <ul>
              {fixture.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        </details>
      </section>

      {handoffOpen && selectedMilestone ? (
        <HandoffPreview
          fixture={fixture}
          milestone={selectedMilestone}
          receipt={handoffReceipt}
          headingRef={handoffHeadingRef}
          onCreateReceipt={() => setHandoffReceipt(true)}
          onClose={() => {
            setHandoffOpen(false);
            setHandoffReceipt(false);
            window.setTimeout(() => handoffTriggerRef.current?.focus(), 0);
          }}
        />
      ) : null}
    </>
  );
}

function CompactLifecycle({ fixture }: { fixture: TrademarkLifecycleFixture }) {
  const current =
    fixture.projection.stages.find((stage) => stage.id === fixture.projection.currentStageId) ??
    fixture.projection.stages[0];
  return (
    <article className="tlr-compact-card">
      <header>
        <div className="tlr-compact-card__identity">
          <span aria-hidden="true">{fixture.asset.monogram}</span>
          <div>
            <h2>{fixture.asset.mark}</h2>
            <p>
              {fixture.asset.jurisdictionLabel} · {fixture.asset.numberLabel} {fixture.asset.number}
            </p>
          </div>
        </div>
        <b className={`tlr-source-state is-${fixture.projection.sourceState.toLowerCase()}`}>
          {sourceStateLabel[fixture.projection.sourceState]}
        </b>
      </header>
      <div className="tlr-compact-card__current">
        <span>当前</span>
        <strong>{current?.label ?? '无法确定'}</strong>
      </div>
      <ol className="tlr-compact-rail" aria-label={`${fixture.asset.mark} 生命周期摘要`}>
        {fixture.projection.stages.map((stage) => (
          <li className={`is-${stage.processState.toLowerCase()}`} key={stage.id}>
            <span aria-hidden="true">{processPresentation[stage.processState].icon}</span>
            <small>{stage.label}</small>
          </li>
        ))}
      </ol>
      <div className="tlr-compact-card__next">
        <span>下一事项</span>
        <strong>{fixture.projection.nextSummary}</strong>
      </div>
      <small>
        截至 <time dateTime={fixture.projection.asOfDateTime}>{fixture.projection.asOf}</time> ·
        演示数据
      </small>
    </article>
  );
}

function CompactPortfolio({ fixtures }: { fixtures: readonly TrademarkLifecycleFixture[] }) {
  const [opened, setOpened] = useState<string>();
  return (
    <div className="tlr-page tlr-page--portfolio">
      <header className="tlr-portfolio-heading">
        <div>
          <p>
            商标资产 · <span lang="en">Compact lifecycle cues</span>
          </p>
          <h1>商标资产</h1>
          <span>不用进入详情，也能看见当前阶段、下一事项与来源状态。</span>
        </div>
        <Badge>同一 Lifecycle fixture · 不重复计算</Badge>
      </header>
      <AuthorityBoundary />
      {opened ? (
        <Alert tone="success" title="演示资产入口已选择">
          已选择 {opened}；本 Storybook 状态不会改变 URL、加载生产数据或创建工作。
        </Alert>
      ) : null}
      <div className="tlr-compact-grid">
        {fixtures.map((fixture) => (
          <div key={fixture.fixtureId}>
            <CompactLifecycle fixture={fixture} />
            <Button type="button" variant="secondary" onClick={() => setOpened(fixture.asset.mark)}>
              查看资产（演示）
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TerminalSurface({
  state,
  fixture
}: {
  state: Extract<
    LifecycleSurfaceState,
    'LOADING' | 'NO_PROJECTION' | 'FORBIDDEN' | 'NOT_FOUND' | 'RECOVERABLE_ERROR'
  >;
  fixture: TrademarkLifecycleFixture;
}) {
  if (state === 'LOADING')
    return (
      <div className="tlr-page">
        <AuthorityBoundary />
        <Card className="tlr-terminal">
          <LoadingState label="正在加载商标资产与生命周期来源" />
        </Card>
      </div>
    );
  if (state === 'FORBIDDEN')
    return (
      <div className="tlr-page">
        <AuthorityBoundary />
        <ErrorState
          title="需要商标资产查看权限"
          description="当前账号不能查看这件 Workspace 资产。为保护私密数据，本页面不会显示商标、阶段、事项或来源摘要。"
        />
      </div>
    );
  if (state === 'NOT_FOUND')
    return (
      <div className="tlr-page">
        <AuthorityBoundary />
        <ErrorState
          title="未找到该商标资产"
          description="该资源不存在或当前 Workspace 无法访问。系统不会加载其他资产作为替代。"
        />
      </div>
    );
  if (state === 'RECOVERABLE_ERROR')
    return (
      <div className="tlr-page">
        <AssetHeader fixture={fixture} />
        <AuthorityBoundary />
        <ErrorState
          title="生命周期暂时无法加载"
          description="商标资产仍然存在；生命周期失败没有被显示成空轨道。请稍后重试。"
        />
      </div>
    );
  return (
    <div className="tlr-page">
      <AssetHeader fixture={fixture} />
      <AuthorityBoundary />
      <Card className="tlr-terminal">
        <EmptyState
          title="尚无生命周期投影"
          description="资产已经存在，但当前没有可用的 Lifecycle Rail。此状态不代表申请未发生、没有义务或生命周期已完成。"
          action={<Button variant="secondary">请求刷新（演示）</Button>}
        />
      </Card>
    </div>
  );
}

export function TrademarkLifecycleRail({
  fixture,
  surfaceState = 'READY',
  mode = 'DETAIL',
  portfolioFixtures = []
}: {
  fixture: TrademarkLifecycleFixture;
  surfaceState?: LifecycleSurfaceState;
  mode?: 'DETAIL' | 'PORTFOLIO';
  portfolioFixtures?: readonly TrademarkLifecycleFixture[];
}) {
  if (mode === 'PORTFOLIO') {
    return (
      <PageFrame>
        <CompactPortfolio fixtures={portfolioFixtures.length ? portfolioFixtures : [fixture]} />
      </PageFrame>
    );
  }

  const terminal = [
    'LOADING',
    'NO_PROJECTION',
    'FORBIDDEN',
    'NOT_FOUND',
    'RECOVERABLE_ERROR'
  ].includes(surfaceState);
  if (terminal) {
    return (
      <PageFrame>
        <TerminalSurface
          state={
            surfaceState as Extract<
              LifecycleSurfaceState,
              'LOADING' | 'NO_PROJECTION' | 'FORBIDDEN' | 'NOT_FOUND' | 'RECOVERABLE_ERROR'
            >
          }
          fixture={fixture}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="tlr-page">
        <AssetHeader fixture={fixture} />
        <AuthorityBoundary />
        <StateNotice state={surfaceState} />
        <LifecycleWorkbench fixture={fixture} surfaceState={surfaceState} />
      </div>
    </PageFrame>
  );
}
