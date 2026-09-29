import { useEffect, useMemo, useState } from 'react';
import type { TradingStudioState } from '../../api/trading-studio.js';
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from '@markorbit/ui';
import { CreativeDemoVisual, type DemoPalette } from './CreativeDemoVisual.js';
import './trading-seller-validation.css';

export type SellerValidationStage = 'DEEP_BUILD' | 'LISTING_PREVIEW' | 'DESTINATIONS';
export type CreativePilotScenario =
  'CAPABILITY_UNAVAILABLE' | 'NO_MATERIALS' | 'PARTIAL' | 'RUNNING' | 'QA_FAILED' | 'SAVED';
export type CreativeLocale = 'zh-CN' | 'en';
export interface DemoDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TradingSellerDestinationProjection {
  id: string;
  label: string;
  state: 'READY' | 'CONNECTED' | 'NEEDS_ATTENTION';
  note: string;
}

export interface TradingSellerValidationModel {
  listingHeadline: string;
  workspaceFacts: readonly string[];
  aiInterpretations: readonly string[];
  assumptions: readonly string[];
  destinations: readonly TradingSellerDestinationProjection[];
}

export interface TradingSellerValidationFlowProps {
  state: Readonly<TradingStudioState>;
  model: Readonly<TradingSellerValidationModel>;
  sourceIsCurrent: boolean;
  initialStage?: SellerValidationStage;
  scenario?: CreativePilotScenario;
  locale: CreativeLocale;
  trustedPrincipalId?: string | undefined;
  demoStorage?: DemoDraftStorage | undefined;
}

type DemoDraft = {
  sourceId: string;
  sourceVersion: number | string;
  directionId: string;
  directionVersion: number | string;
  visualVersion: number;
  palette: DemoPalette;
  scene: string;
  pinned: boolean;
  referenceName: string;
  pendingFeedback: string;
};

type LocalizedStatus = { 'zh-CN': string; en: string };

const copy = {
  'zh-CN': {
    title: '商标视觉美化工作台',
    description: '在准确的商标与已选方向上比较、调整并保存一个隔离的 Demo 创作草稿。',
    validation: 'Preview 验证',
    boundaryTitle: '原始商标不会被修改',
    boundary:
      '以下图像是手工定义的确定性 SVG 视觉布局示意。它没有读取或渲染原始商标图样，也不是 AI 生成结果、拟申请新商标、生产 VisualOutput 或已发布素材。',
    deep: '深度美化',
    listing: '商业说明',
    destinations: '发布边界',
    context: '当前任务上下文',
    source: '原始商标',
    run: 'Studio Run',
    direction: '当前方向',
    version: '当前成果',
    conversation: '目标与修改意见',
    prompt: '待处理修改意见',
    placeholder: '例如：希望更有动感。此文本会随草稿保留，但不会由当前 Demo 自动执行。',
    adjust: '应用结构化 Demo 调整',
    restore: '恢复原版',
    compare: '版本对比',
    closeCompare: '退出对比',
    save: '保存 Demo 草稿',
    pin: '固定此成果',
    unpin: '取消固定',
    preview: '视觉成果预览',
    controls: '结构化调整',
    scene: '使用场景',
    palette: '颜色气质',
    reference: '参考素材名称',
    addReference: '记录参考素材',
    demoOnly: 'SVG 布局示意 Demo',
    notCharged: '未调用模型 · 未产生费用',
    capability: '真实视觉生成能力尚未接入',
    capabilityBody:
      '你仍可体验确定性的 Demo 版本调整与比较；这里不会伪造模型调用、用量审批、付款或生成回执。',
    saved: '个人 Demo 草稿已按当前可信用户保存在此浏览器。没有创建生产成果或发布记录。',
    memorySaved: '当前 Demo 草稿仅保留在此打开页面的内存中；缺少可信用户身份，刷新后不会恢复。',
    restored: '已恢复此 Workspace、原商标、Studio Run 与方向对应的浏览器 Demo 草稿。',
    failed: '浏览器存储不可用。当前画面和内存草稿仍可使用，但刷新后不能恢复。',
    restoreFailed: '无法读取浏览器草稿。已保留当前内存状态，没有恢复其他用户的数据。',
    pendingFeedback: '修改意见已作为待处理文本保存；当前 Demo 只执行下方所选的使用场景和颜色参数。',
    noPrincipal: '当前页面没有取得可信个人身份，因此不会跨刷新保存或恢复私人修改意见。',
    qaFailed: '当前调整版未通过 Demo 视觉质检，只能比较，不能保存为确认版本。',
    sourceChanged: '来源版本已变化',
    sourceChangedBody: '当前 Demo 草稿已失效。请返回 Studio 刷新来源后重新开始。',
    chooseFirst: '请先选择方向',
    chooseFirstBody: '深度美化需要一个当前且版本准确的方向选择。',
    stagesLabel: '创作工作台阶段',
    suggestionsLabel: '建议的待处理修改意见',
    compareLabel: 'Demo 版本对比',
    pendingBadge: '待处理意见',
    currentParams: '当前已执行参数',
    listingEyebrow: '验证预览 · 未保存商品说明',
    notPublished: '未发布',
    facts: 'Workspace 事实',
    interpretation: 'AI 解读',
    assumptions: '假设与限制',
    noAssumptions: '未提供其他假设。',
    previewBoundary: '预览边界',
    previewBoundaryBody: '此页不会保存商品说明、批准发布、向外部发送内容或发布到市场。',
    publicationPrep: '发布准备',
    readiness: '发布目的地就绪状态',
    needsAttention: '需要处理',
    noDestination: '需要处理——未连接发布目的地',
    noDestinationBody: '当前没有连接任何市场目的地，此处无法确认或发布。',
    finalEyebrow: '最终核对预览',
    finalTitle: '尚未发布',
    finalBody: '此处仅能保存浏览器 Demo 草稿。不会创建生产成果、付款、商品说明、发布或商标记录。',
    sourcesCurrent: '准备来源为最新',
    preparationBlocked: '准备已阻断',
    publicationDisabled: '未开启发布',
    footerBoundary:
      '深度美化 Preview 不会创建正式 Owner 资产、保存商品说明、批准发布或产生市场结果。'
  },
  en: {
    title: 'Trademark creative workbench',
    description:
      'Compare, refine, and save an isolated Demo draft against the exact selected direction.',
    validation: 'Preview validation',
    boundaryTitle: 'The original trademark is never modified',
    boundary:
      'These are manually defined, deterministic SVG layout illustrations. They do not read or render the source trademark and are not AI-generated results, a proposed mark, a production VisualOutput, or published material.',
    deep: 'Deep build',
    listing: 'Commercial story',
    destinations: 'Release boundary',
    context: 'Current task context',
    source: 'Source trademark',
    run: 'Studio Run',
    direction: 'Current direction',
    version: 'Current output',
    conversation: 'Goal and feedback',
    prompt: 'Pending revision note',
    placeholder:
      'For example: make it feel more dynamic. This text is retained but is not automatically executed by this Demo.',
    adjust: 'Apply structured Demo revision',
    restore: 'Restore original',
    compare: 'Compare versions',
    closeCompare: 'Close comparison',
    save: 'Save Demo draft',
    pin: 'Pin this output',
    unpin: 'Unpin output',
    preview: 'Visual output preview',
    controls: 'Structured controls',
    scene: 'Use case',
    palette: 'Color direction',
    reference: 'Reference material name',
    addReference: 'Record reference',
    demoOnly: 'SVG layout Demo',
    notCharged: 'No model call · No charge',
    capability: 'Production visual generation is not connected',
    capabilityBody:
      'You can still try deterministic Demo revisions and comparison. No model call, usage approval, payment, or generation receipt is fabricated.',
    saved:
      'Personal Demo draft saved in this browser for the current trusted user. No production output or publication record was created.',
    memorySaved:
      'This Demo draft remains only in memory for the open page. No trusted user identity is available, so it will not be restored after refresh.',
    restored:
      'Restored the browser Demo draft for this exact Workspace, source mark, Studio Run, and direction.',
    failed:
      'Browser storage is unavailable. The current view and in-memory draft remain usable, but cannot be restored after refresh.',
    restoreFailed:
      'The browser draft could not be read. Current in-memory state is preserved and no other user data was restored.',
    pendingFeedback:
      'The revision note is retained as pending text. This Demo only applies the selected use-case and color controls below.',
    noPrincipal:
      'This page has no trusted personal identity, so private revision notes will not be saved or restored across refresh.',
    qaFailed: 'This Demo revision failed visual QA. It can be compared but not saved as confirmed.',
    sourceChanged: 'Source version changed',
    sourceChangedBody:
      'This Demo draft is stale. Return to Studio, refresh the source, and start again.',
    chooseFirst: 'Choose a direction first',
    chooseFirstBody: 'Deep Build requires an exact current Direction Selection.',
    stagesLabel: 'Creative workbench stages',
    suggestionsLabel: 'Suggested pending revision notes',
    compareLabel: 'Demo version comparison',
    pendingBadge: 'Pending revision note',
    currentParams: 'Currently applied parameters',
    listingEyebrow: 'Validation preview · not a saved listing',
    notPublished: 'Not published',
    facts: 'Workspace facts',
    interpretation: 'AI interpretation',
    assumptions: 'Assumptions and limits',
    noAssumptions: 'No additional assumptions were supplied.',
    previewBoundary: 'Preview boundary',
    previewBoundaryBody:
      'This screen does not save a listing, approve publication, send anything externally, or publish to a marketplace.',
    publicationPrep: 'Publication preparation',
    readiness: 'Destination readiness',
    needsAttention: 'Needs attention',
    noDestination: 'Needs attention — no destination is connected',
    noDestinationBody:
      'No marketplace destination is connected. Nothing can be confirmed or published from here.',
    finalEyebrow: 'Final confirmation preview',
    finalTitle: 'Not published yet',
    finalBody:
      'Only a browser Demo draft can be saved here. No production artifact, payment, listing, publication, or trademark record is created.',
    sourcesCurrent: 'Preparation sources up to date',
    preparationBlocked: 'Preparation blocked',
    publicationDisabled: 'Publication not enabled',
    footerBoundary:
      'Deep Build Preview does not create finished owner assets, a saved listing, publication approval, or a marketplace result.'
  }
} as const;

const destinationLabel = {
  READY: 'Ready',
  CONNECTED: 'Connected',
  NEEDS_ATTENTION: 'Needs attention'
} as const;

function selectedDirection(state: Readonly<TradingStudioState>) {
  const selected = state.selection?.selectedDirection;
  if (!selected || !state.directionSet) return undefined;
  return state.directionSet.directions.find(
    (direction) =>
      direction.commercialDirectionId === selected.id && direction.version === selected.version
  );
}

function StageNav({
  stage,
  locale,
  onChange
}: {
  stage: SellerValidationStage;
  locale: CreativeLocale;
  onChange: (stage: SellerValidationStage) => void;
}) {
  const text = copy[locale];
  const stages: ReadonlyArray<{ stage: SellerValidationStage; label: string }> = [
    { stage: 'DEEP_BUILD', label: text.deep },
    { stage: 'LISTING_PREVIEW', label: text.listing },
    { stage: 'DESTINATIONS', label: text.destinations }
  ];
  return (
    <nav className="trading-seller-validation__stages" aria-label={text.stagesLabel}>
      {stages.map((item) => (
        <Button
          key={item.stage}
          variant={stage === item.stage ? 'primary' : 'secondary'}
          onClick={() => onChange(item.stage)}
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}

function ContextBar({
  state,
  visualVersion,
  locale
}: {
  state: Readonly<TradingStudioState>;
  visualVersion: number;
  locale: CreativeLocale;
}) {
  const direction = selectedDirection(state);
  const text = copy[locale];
  return (
    <section className="creative-workbench__context" aria-label={text.context}>
      <div>
        <span>Workspace</span>
        <strong>{state.run.workspaceId}</strong>
      </div>
      <div>
        <span>{text.source}</span>
        <strong>
          {state.run.trademarkAsset.id}@{state.run.trademarkAsset.version}
        </strong>
      </div>
      <div>
        <span>{text.run}</span>
        <strong>
          {state.run.studioRunId}@{state.run.version}
        </strong>
      </div>
      <div>
        <span>{text.direction}</span>
        <strong>
          {direction?.commercialDirectionId}@{direction?.version}
        </strong>
      </div>
      <div>
        <span>{text.version}</span>
        <strong>demo-visual@{visualVersion}</strong>
      </div>
    </section>
  );
}

function DeepBuildStage({
  state,
  sourceIsCurrent,
  locale,
  scenario,
  visualVersion,
  setVisualVersion,
  trustedPrincipalId,
  demoStorage
}: {
  state: Readonly<TradingStudioState>;
  sourceIsCurrent: boolean;
  locale: CreativeLocale;
  scenario: CreativePilotScenario;
  visualVersion: number;
  setVisualVersion: (version: number) => void;
  trustedPrincipalId?: string | undefined;
  demoStorage?: DemoDraftStorage | undefined;
}) {
  const direction = useMemo(() => selectedDirection(state), [state]);
  const text = copy[locale];
  const [palette, setPalette] = useState<DemoPalette>('ORIGINAL');
  const [scene, setScene] = useState('PACKAGING');
  const [compare, setCompare] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [referenceName, setReferenceName] = useState('');
  const [referenceInput, setReferenceInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<LocalizedStatus>();
  const storageKey =
    direction && trustedPrincipalId
      ? `markorbit:creative-demo:${trustedPrincipalId}:${state.run.workspaceId}:${state.run.trademarkAsset.id}:${state.run.trademarkAsset.version}:${state.run.studioRunId}:${direction.commercialDirectionId}:${direction.version}`
      : '';

  useEffect(() => {
    setPalette('ORIGINAL');
    setScene('PACKAGING');
    setVisualVersion(1);
    setCompare(false);
    setPinned(false);
    setReferenceName('');
    setFeedback('');
    setStatus(undefined);
    if (!direction || !sourceIsCurrent || !state.brandDna) return;
    if (scenario === 'SAVED') {
      setVisualVersion(2);
      setPalette('RESTRAINED');
      setPinned(true);
      setStatus({ 'zh-CN': copy['zh-CN'].saved, en: copy.en.saved });
    }
    if (!trustedPrincipalId || !storageKey) {
      setStatus({ 'zh-CN': copy['zh-CN'].noPrincipal, en: copy.en.noPrincipal });
      return;
    }
    try {
      const storage = demoStorage ?? window.localStorage;
      const stored = storage.getItem(storageKey);
      if (!stored) return;
      const draft = JSON.parse(stored) as DemoDraft;
      if (
        draft.sourceId === state.run.trademarkAsset.id &&
        draft.sourceVersion === state.run.trademarkAsset.version &&
        draft.directionId === direction.commercialDirectionId &&
        draft.directionVersion === direction.version
      ) {
        setVisualVersion(draft.visualVersion);
        setPalette(draft.palette);
        setScene(draft.scene);
        setPinned(draft.pinned);
        setReferenceName(draft.referenceName);
        setFeedback(draft.pendingFeedback ?? '');
        setStatus({ 'zh-CN': copy['zh-CN'].restored, en: copy.en.restored });
      }
    } catch {
      try {
        (demoStorage ?? window.localStorage).removeItem(storageKey);
      } catch {
        // The current in-memory draft remains usable even when cleanup is unavailable.
      }
      setStatus({ 'zh-CN': copy['zh-CN'].restoreFailed, en: copy.en.restoreFailed });
    }
  }, [
    direction?.commercialDirectionId,
    direction?.version,
    sourceIsCurrent,
    storageKey,
    scenario,
    state.brandDna,
    trustedPrincipalId,
    demoStorage
  ]);

  if (!direction) return <EmptyState title={text.chooseFirst} description={text.chooseFirstBody} />;
  const revise = () => {
    setVisualVersion(2);
    setCompare(false);
    setStatus({
      'zh-CN': `已预览结构化调整：${scene === 'WEB' ? '网站首页' : '产品包装'} · ${palette === 'ORIGINAL' ? '原方向色彩' : palette === 'RESTRAINED' ? '克制中性色' : '温暖质感'}。${feedback.trim() ? copy['zh-CN'].pendingFeedback : ''}`,
      en: `Structured revision previewed: ${scene === 'WEB' ? 'Website home' : 'Product packaging'} · ${palette === 'ORIGINAL' ? 'Original direction' : palette === 'RESTRAINED' ? 'Restrained neutral' : 'Warm tactile'}. ${feedback.trim() ? copy.en.pendingFeedback : ''}`
    });
  };
  const restore = () => {
    setVisualVersion(1);
    setPalette('ORIGINAL');
    setCompare(false);
    setStatus({ 'zh-CN': '已恢复 Demo v1。', en: 'Demo v1 restored.' });
  };
  const save = () => {
    if (!sourceIsCurrent || !state.brandDna || scenario === 'QA_FAILED') return;
    const draft: DemoDraft = {
      sourceId: state.run.trademarkAsset.id,
      sourceVersion: state.run.trademarkAsset.version,
      directionId: direction.commercialDirectionId,
      directionVersion: direction.version,
      visualVersion,
      palette,
      scene,
      pinned,
      referenceName,
      pendingFeedback: feedback
    };
    if (!trustedPrincipalId || !storageKey) {
      setStatus({ 'zh-CN': copy['zh-CN'].memorySaved, en: copy.en.memorySaved });
      return;
    }
    try {
      (demoStorage ?? window.localStorage).setItem(storageKey, JSON.stringify(draft));
      setStatus({ 'zh-CN': copy['zh-CN'].saved, en: copy.en.saved });
    } catch {
      setStatus({ 'zh-CN': copy['zh-CN'].failed, en: copy.en.failed });
    }
  };
  const recordReference = () => {
    const trimmed = referenceInput.trim();
    if (!trimmed) return;
    setReferenceName(trimmed);
    setReferenceInput('');
    setStatus({
      'zh-CN': `已记录 Demo 参考：${trimmed}。未上传任何文件。`,
      en: `Demo reference recorded: ${trimmed}. No file was uploaded.`
    });
  };
  const kind = scene === 'WEB' ? 'WEB' : 'PACKAGING';
  const creativeSourceReady = sourceIsCurrent && Boolean(state.brandDna);

  return (
    <div className="creative-workbench">
      {!sourceIsCurrent ? (
        <Alert tone="warning" title={text.sourceChanged}>
          {text.sourceChangedBody}
        </Alert>
      ) : null}
      {!state.brandDna ? (
        <Alert
          tone="warning"
          title={locale === 'zh-CN' ? 'Brand DNA 尚未准备' : 'Brand DNA is not ready'}
        >
          {locale === 'zh-CN'
            ? '可查看方向 Demo，但不能将调整版保存为当前确认成果。'
            : 'Direction Demos remain visible, but a revision cannot be saved as the current confirmed output.'}
        </Alert>
      ) : null}
      {scenario === 'NO_MATERIALS' ? (
        <Alert
          tone="warning"
          title={locale === 'zh-CN' ? '尚未添加参考素材' : 'No reference material yet'}
        >
          {locale === 'zh-CN'
            ? '可先查看内置 Demo 基线；它不是上传素材或正式成果。'
            : 'You can inspect the built-in Demo baseline; it is not uploaded material or a production output.'}
        </Alert>
      ) : null}
      {scenario === 'RUNNING' ? (
        <Alert
          tone="info"
          title={locale === 'zh-CN' ? 'Demo 处理状态：进行中' : 'Demo status: in progress'}
        >
          {locale === 'zh-CN'
            ? '这是 Storybook 状态演示，不代表模型已被调用或产生费用。'
            : 'This is a Storybook state demonstration; it does not mean a model was invoked or charged.'}
        </Alert>
      ) : null}
      {scenario === 'QA_FAILED' ? (
        <Alert
          tone="danger"
          title={locale === 'zh-CN' ? 'Demo 视觉质检 · 未通过' : 'Demo Visual QA · failed'}
        >
          {text.qaFailed}
        </Alert>
      ) : null}
      {!trustedPrincipalId ? (
        <Alert tone="warning" title={locale === 'zh-CN' ? '仅限当前页面' : 'Current page only'}>
          {text.noPrincipal}
        </Alert>
      ) : null}
      <div className="creative-workbench__layout">
        <aside
          className="creative-workbench__conversation"
          aria-labelledby="creative-conversation-title"
        >
          <div>
            <p className="trading-seller-validation__eyebrow">{text.conversation}</p>
            <h3 id="creative-conversation-title">{direction.title}</h3>
          </div>
          <div className="creative-workbench__message creative-workbench__message--assistant">
            {locale === 'zh-CN'
              ? `当前未渲染 ${state.run.trademarkAsset.id} 的原始图样。下方仅调整 ${direction.title} 的确定性 SVG 布局示意。`
              : `The source artwork for ${state.run.trademarkAsset.id} is not rendered here. Only the deterministic SVG layout illustration for ${direction.title} is adjusted below.`}
          </div>
          {feedback ? (
            <div className="creative-workbench__message creative-workbench__message--user">
              <Badge>{text.pendingBadge}</Badge>
              <span>{feedback}</span>
            </div>
          ) : null}
          <label htmlFor="creative-feedback">{text.prompt}</label>
          <textarea
            id="creative-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={text.placeholder}
            rows={4}
          />
          <div className="creative-workbench__quick-prompts" aria-label={text.suggestionsLabel}>
            <button
              type="button"
              onClick={() =>
                setFeedback(
                  locale === 'zh-CN'
                    ? '第二个方向不错，但颜色再克制一些。'
                    : 'The second direction works; make the color more restrained.'
                )
              }
            >
              {locale === 'zh-CN' ? '颜色更克制' : 'Restrain color'}
            </button>
            <button
              type="button"
              onClick={() =>
                setFeedback(
                  locale === 'zh-CN'
                    ? '保留原来的商标图样，只修改展示背景。'
                    : 'Keep the original mark form; only change the presentation background.'
                )
              }
            >
              {locale === 'zh-CN' ? '保留原图样' : 'Keep mark form'}
            </button>
          </div>
          <fieldset>
            <legend>{text.controls}</legend>
            <label htmlFor="creative-scene">{text.scene}</label>
            <select
              id="creative-scene"
              value={scene}
              onChange={(event) => {
                setScene(event.target.value);
                setVisualVersion(2);
              }}
            >
              <option value="PACKAGING">
                {locale === 'zh-CN' ? '产品包装' : 'Product packaging'}
              </option>
              <option value="WEB">{locale === 'zh-CN' ? '网站首页' : 'Website home'}</option>
            </select>
            <label htmlFor="creative-palette">{text.palette}</label>
            <select
              id="creative-palette"
              value={palette}
              onChange={(event) => {
                setPalette(event.target.value as DemoPalette);
                setVisualVersion(2);
              }}
            >
              <option value="ORIGINAL">
                {locale === 'zh-CN' ? '原方向色彩' : 'Original direction'}
              </option>
              <option value="RESTRAINED">
                {locale === 'zh-CN' ? '克制中性色' : 'Restrained neutral'}
              </option>
              <option value="WARM">{locale === 'zh-CN' ? '温暖质感' : 'Warm tactile'}</option>
            </select>
            <label htmlFor="creative-reference">{text.reference}</label>
            <div className="creative-workbench__reference-row">
              <input
                id="creative-reference"
                value={referenceInput}
                onChange={(event) => setReferenceInput(event.target.value)}
                placeholder="moodboard-homepage.jpg"
              />
              <Button variant="secondary" onClick={recordReference}>
                {text.addReference}
              </Button>
            </div>
            {referenceName ? <small>{referenceName}</small> : null}
          </fieldset>
          <Button onClick={revise} disabled={!creativeSourceReady || scenario === 'RUNNING'}>
            {text.adjust}
          </Button>
        </aside>
        <section className="creative-workbench__output" aria-labelledby="creative-output-title">
          <div className="trading-seller-validation__preview-heading">
            <div>
              <p className="trading-seller-validation__eyebrow">{text.preview}</p>
              <h3 id="creative-output-title">
                {scene === 'WEB'
                  ? locale === 'zh-CN'
                    ? '网站首页展示'
                    : 'Website presentation'
                  : locale === 'zh-CN'
                    ? '产品包装展示'
                    : 'Packaging presentation'}
              </h3>
            </div>
            <div className="creative-workbench__badges">
              <Badge>{text.demoOnly}</Badge>
              <Badge>v{visualVersion}</Badge>
            </div>
          </div>
          {compare ? (
            <div className="creative-workbench__comparison" aria-label={text.compareLabel}>
              <figure>
                <CreativeDemoVisual
                  role={direction.role}
                  kind="PACKAGING"
                  paletteName="ORIGINAL"
                  version={1}
                  label={
                    locale === 'zh-CN'
                      ? 'SVG 布局示意 Demo 版本 1'
                      : 'SVG layout illustration Demo version 1'
                  }
                />
                <figcaption>
                  {locale === 'zh-CN'
                    ? 'Demo v1 · 产品包装 · 原方向色彩'
                    : 'Demo v1 · Packaging · Original direction'}
                </figcaption>
              </figure>
              <figure>
                <CreativeDemoVisual
                  role={direction.role}
                  kind={kind}
                  paletteName={palette === 'ORIGINAL' ? 'RESTRAINED' : palette}
                  version={2}
                  label={
                    locale === 'zh-CN'
                      ? 'SVG 布局示意 Demo 版本 2'
                      : 'SVG layout illustration Demo version 2'
                  }
                />
                <figcaption>
                  Demo v2 ·{' '}
                  {scene === 'WEB'
                    ? locale === 'zh-CN'
                      ? '网站首页'
                      : 'Website home'
                    : locale === 'zh-CN'
                      ? '产品包装'
                      : 'Packaging'}{' '}
                  ·{' '}
                  {palette === 'ORIGINAL'
                    ? locale === 'zh-CN'
                      ? '原方向色彩'
                      : 'Original direction'
                    : palette}
                </figcaption>
              </figure>
            </div>
          ) : (
            <figure className="creative-workbench__current-visual">
              <CreativeDemoVisual
                role={direction.role}
                kind={kind}
                paletteName={palette}
                version={visualVersion}
                label={`${direction.title} · ${locale === 'zh-CN' ? 'SVG 布局示意' : 'SVG layout illustration'} · ${scene} · Demo v${visualVersion}`}
              />
              <figcaption>
                {state.run.trademarkAsset.id}@{state.run.trademarkAsset.version} →{' '}
                {direction.commercialDirectionId}@{direction.version} → demo-visual@{visualVersion}
              </figcaption>
            </figure>
          )}
          <p className="creative-workbench__cost">
            <strong>{text.currentParams}</strong> ·{' '}
            {scene === 'WEB'
              ? locale === 'zh-CN'
                ? '网站首页'
                : 'Website home'
              : locale === 'zh-CN'
                ? '产品包装'
                : 'Product packaging'}{' '}
            ·{' '}
            {palette === 'ORIGINAL'
              ? locale === 'zh-CN'
                ? '原方向色彩'
                : 'Original direction'
              : palette === 'RESTRAINED'
                ? locale === 'zh-CN'
                  ? '克制中性色'
                  : 'Restrained neutral'
                : locale === 'zh-CN'
                  ? '温暖质感'
                  : 'Warm tactile'}
          </p>
          {scenario === 'PARTIAL' ? (
            <Alert tone="warning" title={locale === 'zh-CN' ? '部分成果完成' : 'Partial output'}>
              {locale === 'zh-CN'
                ? '包装 Demo 可查看；网站 Demo 尚未准备。'
                : 'The packaging Demo is available; the website Demo is not ready.'}
            </Alert>
          ) : null}
          <div className="creative-workbench__output-actions">
            <Button variant="secondary" onClick={() => setCompare((value) => !value)}>
              {compare ? text.closeCompare : text.compare}
            </Button>
            <Button variant="secondary" onClick={restore}>
              {text.restore}
            </Button>
            <Button variant="secondary" onClick={() => setPinned((value) => !value)}>
              {pinned ? text.unpin : text.pin}
            </Button>
            <Button
              onClick={save}
              disabled={!creativeSourceReady || scenario === 'QA_FAILED' || scenario === 'RUNNING'}
            >
              {text.save}
            </Button>
          </div>
          <Alert tone="info" title={text.capability}>
            {text.capabilityBody}
          </Alert>
          <p className="creative-workbench__cost">
            <strong>{text.notCharged}</strong> · {text.demoOnly}
          </p>
          <p role="status" className="creative-workbench__status">
            {status?.[locale]}
          </p>
        </section>
      </div>
    </div>
  );
}

function ListingPreviewStage({
  model,
  locale
}: {
  model: Readonly<TradingSellerValidationModel>;
  locale: CreativeLocale;
}) {
  const text = copy[locale];
  return (
    <section
      className="trading-seller-validation__preview"
      aria-labelledby="seller-listing-preview-title"
    >
      <div className="trading-seller-validation__preview-heading">
        <div>
          <p className="trading-seller-validation__eyebrow">{text.listingEyebrow}</p>
          <h3 id="seller-listing-preview-title">{model.listingHeadline}</h3>
        </div>
        <Badge>{text.notPublished}</Badge>
      </div>
      <div className="trading-seller-validation__grid trading-seller-validation__grid--three">
        <Card className="trading-seller-validation__card">
          <h4>{text.facts}</h4>
          <ul>
            {model.workspaceFacts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="trading-seller-validation__card">
          <h4>{text.interpretation}</h4>
          <ul>
            {model.aiInterpretations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="trading-seller-validation__card">
          <h4>{text.assumptions}</h4>
          {model.assumptions.length ? (
            <ul>
              {model.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>{text.noAssumptions}</p>
          )}
        </Card>
      </div>
      <Alert tone="info" title={text.previewBoundary}>
        {text.previewBoundaryBody}
      </Alert>
    </section>
  );
}

function DestinationsStage({
  model,
  locale
}: {
  model: Readonly<TradingSellerValidationModel>;
  locale: CreativeLocale;
}) {
  const text = copy[locale];
  return (
    <section
      className="trading-seller-validation__destinations"
      aria-labelledby="seller-destinations-title"
    >
      <div className="trading-seller-validation__preview-heading">
        <div>
          <p className="trading-seller-validation__eyebrow">{text.publicationPrep}</p>
          <h3 id="seller-destinations-title">{text.readiness}</h3>
        </div>
        <Badge>{text.needsAttention}</Badge>
      </div>
      {model.destinations.length ? (
        <div className="trading-seller-validation__grid">
          {model.destinations.map((destination) => (
            <Card key={destination.id} className="trading-seller-validation__card">
              <Badge>
                {locale === 'zh-CN'
                  ? (
                      { READY: '已就绪', CONNECTED: '已连接', NEEDS_ATTENTION: '需要处理' } as const
                    )[destination.state]
                  : destinationLabel[destination.state]}
              </Badge>
              <h4>{destination.label}</h4>
              <p>{destination.note}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={text.noDestination} description={text.noDestinationBody} />
      )}
    </section>
  );
}

export function TradingSellerValidationFlow({
  state,
  model,
  sourceIsCurrent,
  initialStage = 'DEEP_BUILD',
  scenario = 'CAPABILITY_UNAVAILABLE',
  locale,
  trustedPrincipalId,
  demoStorage
}: TradingSellerValidationFlowProps) {
  const [stage, setStage] = useState<SellerValidationStage>(initialStage);
  const [visualVersion, setVisualVersion] = useState(1);
  const direction = selectedDirection(state);
  const sourceReady = sourceIsCurrent && Boolean(direction) && Boolean(state.brandDna);
  const text = copy[locale];
  return (
    <section className="trading-seller-validation" aria-labelledby="seller-validation-title">
      <div className="creative-workbench__header">
        <PageHeader
          title={text.title}
          description={text.description}
          actions={<Badge>{text.validation}</Badge>}
        />
      </div>
      <Alert tone="info" title={text.boundaryTitle}>
        {text.boundary}
      </Alert>
      <ContextBar state={state} visualVersion={visualVersion} locale={locale} />
      <StageNav stage={stage} locale={locale} onChange={setStage} />
      {stage === 'DEEP_BUILD' ? (
        <DeepBuildStage
          state={state}
          sourceIsCurrent={sourceIsCurrent}
          locale={locale}
          scenario={scenario}
          visualVersion={visualVersion}
          setVisualVersion={setVisualVersion}
          trustedPrincipalId={trustedPrincipalId}
          demoStorage={demoStorage}
        />
      ) : null}
      {stage === 'LISTING_PREVIEW' ? <ListingPreviewStage model={model} locale={locale} /> : null}
      {stage === 'DESTINATIONS' ? <DestinationsStage model={model} locale={locale} /> : null}
      <Card className="trading-seller-validation__confirmation">
        <div>
          <p className="trading-seller-validation__eyebrow">{text.finalEyebrow}</p>
          <h3>{text.finalTitle}</h3>
          <p>{text.finalBody}</p>
          <Badge>{sourceReady ? text.sourcesCurrent : text.preparationBlocked}</Badge>
        </div>
        <Button disabled>{text.publicationDisabled}</Button>
      </Card>
      <p className="trading-seller-validation__boundary">{text.footerBoundary}</p>
    </section>
  );
}
