import { useEffect, useMemo, useState } from 'react';
import type { TradingStudioState } from '../../api/trading-studio.js';
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from '@markorbit/ui';
import { CreativeDemoVisual, type DemoPalette } from './CreativeDemoVisual.js';
import './trading-seller-validation.css';

export type SellerValidationStage = 'DEEP_BUILD' | 'LISTING_PREVIEW' | 'DESTINATIONS';
export type CreativePilotScenario =
  | 'CAPABILITY_UNAVAILABLE'
  | 'NO_MATERIALS'
  | 'PARTIAL'
  | 'RUNNING'
  | 'QA_FAILED'
  | 'SAVE_FAILURE'
  | 'SAVED';

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
}

type Locale = 'zh-CN' | 'en';
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
};

const copy = {
  'zh-CN': {
    title: '商标视觉美化工作台',
    description: '在准确的商标与已选方向上比较、调整并保存一个隔离的 Demo 创作草稿。',
    validation: 'Preview 验证',
    boundaryTitle: '原始商标不会被修改',
    boundary:
      '以下图像是用于体验交互的 AI 概念 Demo，不是正式注册商标、拟申请新商标、生产 VisualOutput 或已发布素材。',
    deep: '深度美化',
    listing: '商业说明',
    destinations: '发布边界',
    context: '当前任务上下文',
    source: '原始商标',
    run: 'Studio Run',
    direction: '当前方向',
    version: '当前成果',
    conversation: '目标与修改意见',
    prompt: '修改意见',
    placeholder: '例如：保留原来的商标图样，只让颜色更克制。',
    adjust: '生成 Demo 调整版',
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
    demoOnly: '浏览器本地 Demo',
    notCharged: '未调用模型 · 未产生费用',
    capability: '真实视觉生成能力尚未接入',
    capabilityBody:
      '你仍可体验确定性的 Demo 版本调整与比较；这里不会伪造模型调用、用量审批、付款或生成回执。',
    saved: 'Demo 草稿已保存在此浏览器。没有创建生产成果或发布记录。',
    restored: '已恢复此 Workspace、原商标、Studio Run 与方向对应的浏览器 Demo 草稿。',
    failed: 'Demo 草稿保存失败。当前画面仍保留，未显示虚假成功。',
    qaFailed: '当前调整版未通过 Demo 视觉质检，只能比较，不能保存为确认版本。',
    sourceChanged: '来源版本已变化',
    sourceChangedBody: '当前 Demo 草稿已失效。请返回 Studio 刷新来源后重新开始。'
  },
  en: {
    title: 'Trademark creative workbench',
    description:
      'Compare, refine, and save an isolated Demo draft against the exact selected direction.',
    validation: 'Preview validation',
    boundaryTitle: 'The original trademark is never modified',
    boundary:
      'These images are interaction Demo AI concepts—not a registered mark, a proposed new mark, a production VisualOutput, or published material.',
    deep: 'Deep build',
    listing: 'Commercial story',
    destinations: 'Release boundary',
    context: 'Current task context',
    source: 'Source trademark',
    run: 'Studio Run',
    direction: 'Current direction',
    version: 'Current output',
    conversation: 'Goal and feedback',
    prompt: 'Revision note',
    placeholder: 'For example: keep the original mark and make the colors more restrained.',
    adjust: 'Create Demo revision',
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
    demoOnly: 'Browser-local Demo',
    notCharged: 'No model call · No charge',
    capability: 'Production visual generation is not connected',
    capabilityBody:
      'You can still try deterministic Demo revisions and comparison. No model call, usage approval, payment, or generation receipt is fabricated.',
    saved:
      'Demo draft saved in this browser. No production output or publication record was created.',
    restored:
      'Restored the browser Demo draft for this exact Workspace, source mark, Studio Run, and direction.',
    failed:
      'The Demo draft could not be saved. The current view is preserved; no false success is shown.',
    qaFailed: 'This Demo revision failed visual QA. It can be compared but not saved as confirmed.',
    sourceChanged: 'Source version changed',
    sourceChangedBody:
      'This Demo draft is stale. Return to Studio, refresh the source, and start again.'
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
  locale: Locale;
  onChange: (stage: SellerValidationStage) => void;
}) {
  const text = copy[locale];
  const stages: ReadonlyArray<{ stage: SellerValidationStage; label: string }> = [
    { stage: 'DEEP_BUILD', label: text.deep },
    { stage: 'LISTING_PREVIEW', label: text.listing },
    { stage: 'DESTINATIONS', label: text.destinations }
  ];
  return (
    <nav className="trading-seller-validation__stages" aria-label="Creative workbench stages">
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
  locale: Locale;
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
  setVisualVersion
}: {
  state: Readonly<TradingStudioState>;
  sourceIsCurrent: boolean;
  locale: Locale;
  scenario: CreativePilotScenario;
  visualVersion: number;
  setVisualVersion: (version: number) => void;
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
  const [status, setStatus] = useState('');
  const storageKey = direction
    ? `markorbit:creative-demo:${state.run.workspaceId}:${state.run.trademarkAsset.id}:${state.run.trademarkAsset.version}:${state.run.studioRunId}:${direction.commercialDirectionId}:${direction.version}`
    : '';

  useEffect(() => {
    setPalette('ORIGINAL');
    setVisualVersion(1);
    setCompare(false);
    setPinned(false);
    setReferenceName('');
    setStatus('');
    if (!direction || !sourceIsCurrent || !state.brandDna) return;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored && scenario === 'SAVED') {
      setVisualVersion(2);
      setPalette('RESTRAINED');
      setPinned(true);
      setStatus(text.saved);
      return;
    }
    if (!stored) return;
    try {
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
        setStatus(text.restored);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [
    direction?.commercialDirectionId,
    direction?.version,
    sourceIsCurrent,
    storageKey,
    scenario,
    state.brandDna
  ]);

  if (!direction)
    return (
      <EmptyState
        title="Choose a direction first"
        description="Deep Build requires an exact current Direction Selection."
      />
    );
  const revise = () => {
    setVisualVersion(2);
    setPalette('RESTRAINED');
    setCompare(false);
    setStatus(
      locale === 'zh-CN'
        ? '已创建可见的 Demo v2：颜色更克制，原始图样保持不变。'
        : 'Visible Demo v2 created: restrained color, original mark form preserved.'
    );
  };
  const restore = () => {
    setVisualVersion(1);
    setPalette('ORIGINAL');
    setCompare(false);
    setStatus(locale === 'zh-CN' ? '已恢复 Demo v1。' : 'Demo v1 restored.');
  };
  const save = () => {
    if (!sourceIsCurrent || !state.brandDna || scenario === 'QA_FAILED') return;
    if (scenario === 'SAVE_FAILURE') {
      setStatus(text.failed);
      return;
    }
    const draft: DemoDraft = {
      sourceId: state.run.trademarkAsset.id,
      sourceVersion: state.run.trademarkAsset.version,
      directionId: direction.commercialDirectionId,
      directionVersion: direction.version,
      visualVersion,
      palette,
      scene,
      pinned,
      referenceName
    };
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
    setStatus(text.saved);
  };
  const recordReference = () => {
    const trimmed = referenceInput.trim();
    if (!trimmed) return;
    setReferenceName(trimmed);
    setReferenceInput('');
    setStatus(
      locale === 'zh-CN'
        ? `已记录 Demo 参考：${trimmed}。未上传任何文件。`
        : `Demo reference recorded: ${trimmed}. No file was uploaded.`
    );
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
        <Alert tone="danger" title="Demo Visual QA · failed">
          {text.qaFailed}
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
              ? `我会保留 ${state.run.trademarkAsset.id} 的原始图样，只调整 ${direction.title} 的 Demo 展示系统。`
              : `I’ll preserve the original form of ${state.run.trademarkAsset.id} and only refine the ${direction.title} Demo presentation system.`}
          </div>
          {feedback ? (
            <div className="creative-workbench__message creative-workbench__message--user">
              {feedback}
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
          <div className="creative-workbench__quick-prompts" aria-label="Suggested revision notes">
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
              onChange={(event) => setScene(event.target.value)}
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
            <div className="creative-workbench__comparison" aria-label="Demo version comparison">
              <figure>
                <CreativeDemoVisual
                  role={direction.role}
                  kind={kind}
                  paletteName="ORIGINAL"
                  version={1}
                  label="Demo version 1"
                />
                <figcaption>Demo v1 · Original</figcaption>
              </figure>
              <figure>
                <CreativeDemoVisual
                  role={direction.role}
                  kind={kind}
                  paletteName={palette === 'ORIGINAL' ? 'RESTRAINED' : palette}
                  version={2}
                  label="Demo version 2"
                />
                <figcaption>Demo v2 · {palette === 'ORIGINAL' ? 'Restrained' : palette}</figcaption>
              </figure>
            </div>
          ) : (
            <figure className="creative-workbench__current-visual">
              <CreativeDemoVisual
                role={direction.role}
                kind={kind}
                paletteName={palette}
                version={visualVersion}
                label={`${direction.title} ${scene} Demo version ${visualVersion}`}
              />
              <figcaption>
                {state.run.trademarkAsset.id}@{state.run.trademarkAsset.version} →{' '}
                {direction.commercialDirectionId}@{direction.version} → demo-visual@{visualVersion}
              </figcaption>
            </figure>
          )}
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
            {status}
          </p>
        </section>
      </div>
    </div>
  );
}

function ListingPreviewStage({ model }: { model: Readonly<TradingSellerValidationModel> }) {
  return (
    <section
      className="trading-seller-validation__preview"
      aria-labelledby="seller-listing-preview-title"
    >
      <div className="trading-seller-validation__preview-heading">
        <div>
          <p className="trading-seller-validation__eyebrow">
            Validation preview · not a saved listing
          </p>
          <h3 id="seller-listing-preview-title">{model.listingHeadline}</h3>
        </div>
        <Badge>Not published</Badge>
      </div>
      <div className="trading-seller-validation__grid trading-seller-validation__grid--three">
        <Card className="trading-seller-validation__card">
          <h4>Workspace facts</h4>
          <ul>
            {model.workspaceFacts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="trading-seller-validation__card">
          <h4>AI interpretation</h4>
          <ul>
            {model.aiInterpretations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="trading-seller-validation__card">
          <h4>Assumptions and limits</h4>
          {model.assumptions.length ? (
            <ul>
              {model.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No additional assumptions were supplied.</p>
          )}
        </Card>
      </div>
      <Alert tone="info" title="Preview boundary">
        This screen does not save a listing, approve publication, send anything externally, or
        publish to a marketplace.
      </Alert>
    </section>
  );
}

function DestinationsStage({ model }: { model: Readonly<TradingSellerValidationModel> }) {
  return (
    <section
      className="trading-seller-validation__destinations"
      aria-labelledby="seller-destinations-title"
    >
      <div className="trading-seller-validation__preview-heading">
        <div>
          <p className="trading-seller-validation__eyebrow">Publication preparation</p>
          <h3 id="seller-destinations-title">Destination readiness</h3>
        </div>
        <Badge>Needs attention</Badge>
      </div>
      {model.destinations.length ? (
        <div className="trading-seller-validation__grid">
          {model.destinations.map((destination) => (
            <Card key={destination.id} className="trading-seller-validation__card">
              <Badge>{destinationLabel[destination.state]}</Badge>
              <h4>{destination.label}</h4>
              <p>{destination.note}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Needs attention — no destination is connected"
          description="No marketplace destination is connected. Nothing can be confirmed or published from here."
        />
      )}
    </section>
  );
}

export function TradingSellerValidationFlow({
  state,
  model,
  sourceIsCurrent,
  initialStage = 'DEEP_BUILD',
  scenario = 'CAPABILITY_UNAVAILABLE'
}: TradingSellerValidationFlowProps) {
  const [stage, setStage] = useState<SellerValidationStage>(initialStage);
  const [locale, setLocale] = useState<Locale>('zh-CN');
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
        <div className="creative-workbench__locale" aria-label="Language">
          <button
            type="button"
            aria-pressed={locale === 'zh-CN'}
            onClick={() => setLocale('zh-CN')}
          >
            中文
          </button>
          <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
            English
          </button>
        </div>
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
        />
      ) : null}
      {stage === 'LISTING_PREVIEW' ? <ListingPreviewStage model={model} /> : null}
      {stage === 'DESTINATIONS' ? <DestinationsStage model={model} /> : null}
      <Card className="trading-seller-validation__confirmation">
        <div>
          <p className="trading-seller-validation__eyebrow">Final confirmation preview</p>
          <h3>Not published yet</h3>
          <p>
            Only a browser-local Demo draft can be saved here. No production artifact, payment,
            listing, publication, or trademark record is created.
          </p>
          <Badge>{sourceReady ? 'Preparation sources up to date' : 'Preparation blocked'}</Badge>
        </div>
        <Button disabled>Publication not enabled</Button>
      </Card>
      <p className="trading-seller-validation__boundary">
        Deep Build Preview does not create finished owner assets, a saved listing, publication
        approval, or a marketplace result.
      </p>
    </section>
  );
}
