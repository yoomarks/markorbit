import { useEffect, useRef, useState } from 'react';
import type { TradingAiProfileV1 } from '@markorbit/contracts/trading-ai-profile';
import type { TradingCommercialDirectionVersionV1 } from '@markorbit/contracts/trading-commercial-direction';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import {
  createTradingStudioClient,
  TradingStudioHttpError,
  type TradingStudioClient,
  type TradingStudioState
} from '../../api/trading-studio.js';
import {
  TradingSellerValidationFlow,
  type CreativePilotScenario,
  type CreativeLocale,
  type DemoDraftStorage,
  type TradingSellerValidationModel
} from './TradingSellerValidationFlow.js';
import { DirectionPreviewPair } from './CreativeDemoVisual.js';
import './trading-studio.css';

export interface TradingStudioProps {
  workspaceId: string;
  studioRunId: TradingStudioRunV1['studioRunId'];
  client?: TradingStudioClient;
  sellerValidationPrototype?: boolean;
  sellerValidationScenario?: CreativePilotScenario;
  sellerValidationTrustedPrincipalId?: string | undefined;
  sellerValidationStorage?: DemoDraftStorage | undefined;
}

const roleLabel = {
  BEST_FIT: 'Best Fit',
  VALUE_UP: 'Value Up',
  POSSIBILITY: 'Possibility'
} as const;

const personaLabel = {
  END_CONSUMER: 'End consumer',
  BUSINESS_OPERATOR: 'Business operator',
  TRADEMARK_BUYER: 'Trademark buyer'
} as const;

function CommercialValueMap({
  profile,
  locale
}: {
  profile: Readonly<TradingAiProfileV1> | null;
  locale: CreativeLocale;
}) {
  const zh = locale === 'zh-CN';
  const insights = profile?.commercialInsights;
  if (!profile)
    return (
      <Alert tone="info" title={zh ? '商业价值图尚未准备' : 'Commercial Value Map is not ready'}>
        {zh
          ? '请先生成 AI Profile 检查点，以形成当前且有证据边界的商业解读。'
          : 'Generate the AI Profile checkpoint to create a current, evidence-bounded commercial interpretation.'}
      </Alert>
    );
  if (!insights)
    return (
      <Alert
        tone="warning"
        title={
          zh ? '此 Profile 暂无商业价值图' : 'Commercial Value Map is unavailable for this profile'
        }
      >
        {zh
          ? '该早期 AI Profile 仍可阅读，但不包含新版结构化商业洞察。'
          : 'This earlier AI Profile remains readable, but it does not contain the newer structured commercial insights.'}
      </Alert>
    );

  return (
    <section className="trading-studio__value-map" aria-labelledby="commercial-value-map-title">
      <div className="trading-studio__section-heading">
        <div>
          <p className="trading-studio__eyebrow">
            {zh ? 'AI 推断' : 'AI inference'} · {zh ? '版本' : 'Version'} {profile.version}
          </p>
          <h2 id="commercial-value-map-title">{zh ? '商业价值图' : 'Commercial Value Map'}</h2>
          <p>
            {zh
              ? '定性展示谁可能重视该商标资产、他们可能关心什么，以及解读所依据的证据或假设。'
              : 'A qualitative view of who may value this Trademark Asset, what could matter to them, and which evidence or assumptions support the interpretation.'}
          </p>
        </div>
        <Badge>
          {zh ? '证据覆盖' : 'Evidence coverage'}: {insights.evidenceCoverage.toLowerCase()}
        </Badge>
      </div>

      <div
        className="trading-studio__persona-grid"
        aria-label={zh ? '商业受众' : 'Commercial audiences'}
      >
        {insights.personas.map((persona) => (
          <Card key={persona.commercialPersonaId} className="trading-studio__insight-card">
            <Badge>
              {zh
                ? (
                    {
                      END_CONSUMER: '终端消费者',
                      BUSINESS_OPERATOR: '业务经营者',
                      TRADEMARK_BUYER: '商标买家'
                    } as const
                  )[persona.kind]
                : personaLabel[persona.kind]}
            </Badge>
            <h3>{persona.label}</h3>
            <p>{persona.summary}</p>
            {persona.desiredOutcomes?.length ? (
              <>
                <h4>{zh ? '期望结果' : 'Desired outcomes'}</h4>
                <ul>
                  {persona.desiredOutcomes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="trading-studio__map-columns">
        <section aria-labelledby="selling-points-title">
          <h3 id="selling-points-title">{zh ? '卖点' : 'Selling points'}</h3>
          {insights.sellingPoints.length ? (
            <ul className="trading-studio__detail-list">
              {insights.sellingPoints.map((point) => (
                <li key={point.sellingPointId}>
                  <strong>{point.label}</strong>
                  <span>{point.description}</span>
                  <small>{point.basisType.replaceAll('_', ' ').toLowerCase()}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {zh ? '尚未产生有支持依据的卖点。' : 'No supported selling points were produced.'}
            </p>
          )}
        </section>
        <section aria-labelledby="buying-points-title">
          <h3 id="buying-points-title">{zh ? '购买理由' : 'Buying points'}</h3>
          {insights.buyingPoints.length ? (
            <ul className="trading-studio__detail-list">
              {insights.buyingPoints.map((point) => (
                <li key={point.buyingPointId}>
                  <strong>{point.label}</strong>
                  <span>{point.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {zh ? '尚未产生有支持依据的购买理由。' : 'No supported buying points were produced.'}
            </p>
          )}
        </section>
        <section aria-labelledby="scenarios-title">
          <h3 id="scenarios-title">{zh ? '商业场景' : 'Commercial scenarios'}</h3>
          {insights.scenarios.length ? (
            <ul className="trading-studio__detail-list">
              {insights.scenarios.map((scenario) => (
                <li key={scenario.commercialScenarioId}>
                  <strong>{scenario.label}</strong>
                  <span>{scenario.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{zh ? '尚未产生有支持依据的场景。' : 'No supported scenarios were produced.'}</p>
          )}
        </section>
      </div>

      <div className="trading-studio__evidence">
        <section aria-labelledby="evidence-title">
          <h3 id="evidence-title">{zh ? '证据依据' : 'Evidence basis'}</h3>
          {insights.evidenceBasis.length ? (
            <ul>
              {insights.evidenceBasis.map((evidence) => (
                <li key={evidence.commercialEvidenceId}>
                  <strong>{evidence.label}</strong> · {evidence.sourceType}
                  {evidence.description ? ` — ${evidence.description}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>{zh ? '未提供直接证据依据。' : 'No direct evidence basis was supplied.'}</p>
          )}
        </section>
        <section aria-labelledby="assumptions-title">
          <h3 id="assumptions-title">{zh ? '假设与限制' : 'Assumptions and limits'}</h3>
          {insights.assumptions.length || insights.limits?.length ? (
            <ul>
              {insights.assumptions.map((assumption) => (
                <li key={assumption.commercialAssumptionId}>
                  <strong>{assumption.label}</strong> — {assumption.description}
                </li>
              ))}
              {insights.limits?.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          ) : (
            <p>
              {zh ? '未提供其他假设或限制。' : 'No additional assumptions or limits were supplied.'}
            </p>
          )}
        </section>
      </div>
      <p className="trading-studio__boundary">
        {zh
          ? '此图是 AI 推断，不是商标官方事实、经验证的市场需求、估值或商业成功概率。'
          : 'This map is AI inference, not Trademark Truth, verified market demand, valuation, or a probability of commercial success.'}
      </p>
    </section>
  );
}

function DirectionCommercialSummary({
  direction,
  profile,
  locale
}: {
  direction: Readonly<TradingCommercialDirectionVersionV1>;
  profile: Readonly<TradingAiProfileV1> | null;
  locale: CreativeLocale;
}) {
  const zh = locale === 'zh-CN';
  const insights = profile?.commercialInsights;
  const personaRefs = [
    ...(direction.targetConsumerRefs ?? []),
    ...(direction.operatorPersonaRefs ?? []),
    ...(direction.trademarkBuyerPersonaRefs ?? [])
  ];
  const personas = insights?.personas.filter((item) =>
    personaRefs.includes(item.commercialPersonaId)
  );
  const buyingPoints = insights?.buyingPoints.filter((item) =>
    direction.buyingPointRefs?.includes(item.buyingPointId)
  );
  const scenarios = insights?.scenarios.filter((item) =>
    direction.scenarioRefs?.includes(item.commercialScenarioId)
  );
  const sellingPoints = insights?.sellingPoints.filter((item) =>
    direction.sellingPointRefs?.includes(item.sellingPointId)
  );
  const enriched = Boolean(direction.aiProfile && direction.thesis && insights);

  if (!enriched)
    return (
      <>
        <h3>{zh ? '为什么可行' : 'Why it could work'}</h3>
        <p>{direction.rationale}</p>
        <h3>{zh ? '限制' : 'Constraints'}</h3>
        <ul>
          {direction.constraints.map((constraint) => (
            <li key={constraint}>{constraint}</li>
          ))}
        </ul>
      </>
    );

  return (
    <div className="trading-studio__direction-value">
      <p className="trading-studio__thesis">{direction.thesis}</p>
      <section>
        <h3>{zh ? '适合谁' : 'WHO'}</h3>
        <p>
          {personas?.map((item) => item.label).join(' · ') ||
            (zh ? '无受众引用' : 'No audience reference')}
        </p>
      </section>
      <section>
        <h3>{zh ? '为什么' : 'WHY'}</h3>
        <p>
          {buyingPoints
            ?.slice(0, 2)
            .map((item) => item.label)
            .join(' · ') || direction.rationale}
        </p>
      </section>
      <section>
        <h3>{zh ? '用在哪里' : 'WHERE'}</h3>
        <p>
          {scenarios
            ?.slice(0, 2)
            .map((item) => item.label)
            .join(' · ') || (zh ? '无场景引用' : 'No scenario reference')}
        </p>
      </section>
      <details>
        <summary>{zh ? '为什么选这个方向？' : 'Why this direction?'}</summary>
        {direction.valueProposition ? <p>{direction.valueProposition}</p> : null}
        {sellingPoints?.length ? (
          <>
            <h4>{zh ? '卖点' : 'Selling points'}</h4>
            <ul>
              {sellingPoints.map((item) => (
                <li key={item.sellingPointId}>{item.label}</li>
              ))}
            </ul>
          </>
        ) : null}
        {buyingPoints?.length ? (
          <>
            <h4>{zh ? '购买理由' : 'Buying points'}</h4>
            <ul>
              {buyingPoints.map((item) => (
                <li key={item.buyingPointId}>{item.description}</li>
              ))}
            </ul>
          </>
        ) : null}
        {direction.riskNotes?.length ? (
          <>
            <h4>{zh ? '风险与限制' : 'Risks and limits'}</h4>
            <ul>
              {direction.riskNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
      </details>
    </div>
  );
}

function failureMessage(
  error: unknown,
  locale: CreativeLocale = 'en'
): { title: string; description: string } {
  const zh = locale === 'zh-CN';
  if (error instanceof TradingStudioHttpError && (error.status === 401 || error.status === 403))
    return {
      title: zh ? 'Studio 访问不可用' : 'Studio access unavailable',
      description: zh
        ? '当前会话无权查看或选择这些方向。'
        : 'Your current session does not have permission to view or select these directions.'
    };
  if (error instanceof TradingStudioHttpError && error.status === 409)
    return {
      title: zh ? 'Studio 状态已变化' : 'Studio state changed',
      description: zh
        ? '选择前请重新加载当前 Studio 真实状态。'
        : 'Reload current Studio truth before making a selection.'
    };
  return {
    title: zh ? 'Studio 不可用' : 'Studio unavailable',
    description: zh
      ? '无法加载当前 Studio 状态。现有工作未被修改。'
      : 'The current Studio state could not be loaded. Your existing work has not been changed.'
  };
}

export function TradingStudio({
  workspaceId,
  studioRunId,
  client,
  sellerValidationPrototype = false,
  sellerValidationScenario = 'CAPABILITY_UNAVAILABLE',
  sellerValidationTrustedPrincipalId,
  sellerValidationStorage
}: TradingStudioProps) {
  const api = client ?? createTradingStudioClient(workspaceId);
  const [state, setState] = useState<TradingStudioState>();
  const [error, setError] = useState<unknown>();
  const [selecting, setSelecting] = useState<string>();
  const [validationOpen, setValidationOpen] = useState(false);
  const [creativeLocale, setCreativeLocale] = useState<CreativeLocale>('zh-CN');
  const locale: CreativeLocale = sellerValidationPrototype ? creativeLocale : 'en';
  const zh = locale === 'zh-CN';
  const selectionKeys = useRef(new Map<string, string>());

  const load = async () => {
    setError(undefined);
    try {
      setState(await api.loadState(studioRunId));
    } catch (cause) {
      setError(cause);
    }
  };

  useEffect(() => {
    setValidationOpen(false);
    void load();
  }, [studioRunId]);

  const choose = async (direction: Readonly<TradingCommercialDirectionVersionV1>) => {
    if (!state?.directionSet || selecting || state.run.currentness !== 'CURRENT') return;
    setSelecting(direction.commercialDirectionId);
    setError(undefined);
    const signature = `${state.directionSet.commercialDirectionSetId}:${state.directionSet.version}:${direction.commercialDirectionId}:${direction.version}`;
    const operationId = selectionKeys.current.get(signature) ?? crypto.randomUUID();
    selectionKeys.current.set(signature, operationId);
    try {
      await api.selectDirection({
        schemaVersion: 1,
        directionSetId: state.directionSet.commercialDirectionSetId,
        expectedDirectionSetVersion: state.directionSet.version,
        selectedDirectionId: direction.commercialDirectionId,
        expectedDirectionVersion: direction.version,
        idempotencyKey: `direction-selection:${operationId}`,
        correlationId: `correlation_${operationId}`
      });
      const refreshed = await api.loadState(studioRunId);
      if (
        refreshed.selection?.selectedDirection.id !== direction.commercialDirectionId ||
        refreshed.selection.selectedDirection.version !== direction.version
      )
        throw new TradingStudioHttpError(
          409,
          'DURABLE_SELECTION_NOT_VISIBLE',
          'The Selection write completed but current owner state does not confirm it.'
        );
      selectionKeys.current.delete(signature);
      setState(refreshed);
    } catch (cause) {
      setError(cause);
    } finally {
      setSelecting(undefined);
    }
  };

  if (!state && !error)
    return (
      <LoadingState label={zh ? '正在加载当前 Studio 方向' : 'Loading current Studio directions'} />
    );
  if (!state && error) {
    const message = failureMessage(error, locale);
    return <ErrorState {...message} onRetry={() => void load()} />;
  }
  if (!state) return null;

  if (state.directionSet && state.directionSet.directions.length !== 3)
    return (
      <ErrorState
        title={zh ? '方向集不完整' : 'Incomplete direction set'}
        description={
          zh
            ? 'Owner 返回了不完整的方向数据。三个角色全部可用前不能选择。'
            : 'The owner returned partial direction data. No selection can be made until all three roles are available.'
        }
        onRetry={() => void load()}
      />
    );

  const selected = state.selection?.selectedDirection;
  const stale = state.run.currentness === 'STALE';
  const mutationError = error ? failureMessage(error, locale) : undefined;
  const selectedDirectionRecord = state.directionSet?.directions.find(
    (direction) =>
      direction.commercialDirectionId === selected?.id && direction.version === selected.version
  );
  const sellerValidationModel: TradingSellerValidationModel | undefined = selectedDirectionRecord
    ? {
        listingHeadline: state.brandDna?.brandPromise
          ? `${selectedDirectionRecord.title} — ${state.brandDna.brandPromise}`
          : selectedDirectionRecord.title,
        workspaceFacts: [
          `${zh ? '商标记录版本' : 'Trademark record version'}: ${state.run.trademarkAsset.version}`,
          `${zh ? '来源状态' : 'Source status'}: ${state.run.currentness === 'CURRENT' ? (zh ? '最新' : 'Up to date') : zh ? '需要刷新' : 'Needs refresh'}`
        ],
        aiInterpretations: [
          selectedDirectionRecord.thesis ?? selectedDirectionRecord.summary,
          ...(state.brandDna?.positioning.slice(0, 2) ?? [])
        ],
        assumptions:
          state.aiProfile?.commercialInsights?.assumptions.map(
            (item) => `${item.label}: ${item.description}`
          ) ?? [],
        destinations: []
      }
    : undefined;

  return (
    <main className="trading-studio">
      <PageHeader
        title={zh ? 'Orbit Studio 方向' : 'Orbit Studio directions'}
        description={
          zh
            ? '比较当前商标资产版本的三个 AI 商业概念。只有你的明确选择才会创建 Selection。'
            : 'Compare three AI concepts for this exact Trademark Asset version. Only your explicit choice creates a Selection.'
        }
        actions={
          <div className="creative-workbench__header">
            <Badge>
              {stale
                ? zh
                  ? '来源已变化'
                  : 'Source changed'
                : selected
                  ? zh
                    ? '已选方向'
                    : 'Direction selected'
                  : zh
                    ? '等待选择'
                    : 'Awaiting your choice'}
            </Badge>
            {sellerValidationPrototype ? (
              <div
                className="creative-workbench__locale"
                aria-label={zh ? '界面语言' : 'Interface language'}
              >
                <button type="button" aria-pressed={zh} onClick={() => setCreativeLocale('zh-CN')}>
                  中文
                </button>
                <button type="button" aria-pressed={!zh} onClick={() => setCreativeLocale('en')}>
                  English
                </button>
              </div>
            ) : null}
          </div>
        }
      />
      {stale && (
        <Alert tone="warning" title={zh ? '来源版本已过期' : 'Source version is stale'}>
          {zh
            ? '这些概念仍可供参考，但在加载当前 Owner 真实状态前无法选择。'
            : 'These concepts remain visible for reference, but selection is locked until current owner truth is loaded.'}
        </Alert>
      )}
      {mutationError && (
        <Alert tone="danger" title={mutationError.title}>
          {mutationError.description}
        </Alert>
      )}
      <CommercialValueMap profile={state.aiProfile ?? null} locale={locale} />
      {!state.directionSet ? (
        <EmptyState
          title={zh ? '方向尚未准备' : 'Directions are not ready'}
          description={
            zh
              ? '此 Run 尚未产生完整且当前有效的 Direction Set，此页暂无法继续。'
              : 'This run has not produced a complete current Direction Set. Resume remains unavailable on this screen.'
          }
        />
      ) : (
        <div
          className="trading-studio__directions"
          aria-label={zh ? '商业方向' : 'Commercial directions'}
        >
          {state.directionSet.directions.map((direction) => {
            const isSelected =
              selected?.id === direction.commercialDirectionId &&
              selected.version === direction.version;
            return (
              <Card
                key={`${direction.commercialDirectionId}:${direction.version}`}
                className={
                  isSelected ? 'trading-studio__direction is-selected' : 'trading-studio__direction'
                }
              >
                <div className="trading-studio__direction-heading">
                  <Badge>
                    {zh
                      ? (
                          {
                            BEST_FIT: '最佳匹配',
                            VALUE_UP: '价值提升',
                            POSSIBILITY: '可能性'
                          } as const
                        )[direction.role]
                      : roleLabel[direction.role]}
                  </Badge>
                  <span>
                    {zh ? '版本' : 'Version'} {direction.version}
                  </span>
                </div>
                <h2>{direction.title}</h2>
                <p>{direction.summary}</p>
                {sellerValidationPrototype ? (
                  <DirectionPreviewPair
                    role={direction.role}
                    title={direction.title}
                    directionId={direction.commercialDirectionId}
                    directionVersion={direction.version}
                    locale={locale}
                  />
                ) : null}
                <DirectionCommercialSummary
                  direction={direction}
                  profile={state.aiProfile}
                  locale={locale}
                />
                <Button
                  variant={isSelected ? 'secondary' : 'primary'}
                  disabled={stale || Boolean(selecting) || isSelected}
                  onClick={() => void choose(direction)}
                >
                  {isSelected
                    ? zh
                      ? '已选择'
                      : 'Selected'
                    : selecting === direction.commercialDirectionId
                      ? zh
                        ? '正在记录选择…'
                        : 'Recording choice…'
                      : `${zh ? '选择' : 'Choose'} ${zh ? ({ BEST_FIT: '最佳匹配', VALUE_UP: '价值提升', POSSIBILITY: '可能性' } as const)[direction.role] : roleLabel[direction.role]}`}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
      {sellerValidationPrototype && selectedDirectionRecord && sellerValidationModel ? (
        <section
          className="trading-studio__seller-validation-entry"
          aria-label={zh ? '卖家验证入口' : 'Seller validation entry'}
        >
          <Card className="trading-studio__seller-validation-card">
            <div>
              <Badge>{zh ? '已选方向可开始验证' : 'Selected direction ready for validation'}</Badge>
              <h2>{zh ? '制作此方向' : 'Build this direction'}</h2>
              <p>
                {zh
                  ? '检查深度美化准备状态、面向卖家的商业说明与发布目的地缺口，不会开启发布。'
                  : 'Inspect Deep Build readiness, a seller-facing listing story, and destination gaps without enabling publication.'}
              </p>
            </div>
            <Button disabled={stale} onClick={() => setValidationOpen((open) => !open)}>
              {validationOpen
                ? zh
                  ? '关闭创作工作台'
                  : 'Close creative workbench'
                : zh
                  ? '制作此方向'
                  : 'Build this direction'}
            </Button>
          </Card>
          {validationOpen ? (
            <TradingSellerValidationFlow
              state={state}
              model={sellerValidationModel}
              sourceIsCurrent={!stale}
              scenario={sellerValidationScenario}
              locale={locale}
              trustedPrincipalId={sellerValidationTrustedPrincipalId}
              demoStorage={sellerValidationStorage}
            />
          ) : null}
        </section>
      ) : null}
      <p className="trading-studio__boundary">
        {sellerValidationPrototype
          ? zh
            ? '方向是 AI 商业概念，不是官方商标记录。当前视觉图为未渲染原始商标的确定性 SVG 布局示意，不会发布任何内容。'
            : 'Directions are AI commercial concepts, not official trademark records. Current visuals are deterministic SVG layout illustrations that do not render the source trademark, and nothing is published.'
          : 'Directions are AI concepts, not Trademark Truth. Selection does not start Deep Build or create a Listing. Refinement is not yet available through a governed execution boundary.'}
      </p>
    </main>
  );
}
