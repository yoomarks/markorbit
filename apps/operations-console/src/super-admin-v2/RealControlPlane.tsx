import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadDataOwnerSummary, type DataOwnerSummary } from '../data-platform.js';
import {
  loadKnowledgeOwnerHealth,
  type KnowledgeOwnerHealthResult
} from '../knowledge-platform.js';
import { OwnerReadError, type OwnerReadFailureKind } from '../owner-read-error.js';
import { formatSuperAdminDateTime, useSuperAdminI18n } from './i18n.js';

type ReadFailureKind = OwnerReadFailureKind | 'context';

type ReadState<T> =
  | { phase: 'loading' }
  | { phase: 'success'; value: T }
  | { phase: 'failure'; kind: ReadFailureKind; message: string; code?: string };

interface RealControlPlaneProps {
  moduleId: string;
  pageId: string;
  pageLabel: string;
  navigate: (path: string) => void;
}

const READ_TIMEOUT_MS = 4_000;

function timedFetch(parentSignal: AbortSignal): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    parentSignal.addEventListener('abort', abort, { once: true });
    const timer = window.setTimeout(abort, READ_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
      parentSignal.removeEventListener('abort', abort);
    }
  };
}

function failureState(error: unknown): ReadState<never> {
  if (error instanceof OwnerReadError)
    return {
      phase: 'failure',
      kind: error.kind,
      message: error.message,
      ...(error.code ? { code: error.code } : {})
    };
  if (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))
    return { phase: 'failure', kind: 'timeout', message: '读取超过本地等待时限。' };
  return {
    phase: 'failure',
    kind: 'unavailable',
    message: error instanceof Error ? error.message : 'Owner 读取不可用。'
  };
}

function useOwnerRead<T>(load: ((signal: AbortSignal) => Promise<T>) | null, key: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ReadState<T>>(
    load
      ? { phase: 'loading' }
      : {
          phase: 'failure',
          kind: 'context',
          message: '缺少已选择并可由 Core 校验的 Workspace 上下文。'
        }
  );

  useEffect(() => {
    if (!load) {
      setState({
        phase: 'failure',
        kind: 'context',
        message: '缺少已选择并可由 Core 校验的 Workspace 上下文。'
      });
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setState({ phase: 'loading' });
    void load(controller.signal).then(
      (value) => active && setState({ phase: 'success', value }),
      (error: unknown) => active && setState(failureState(error))
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, load, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { state, reload };
}

function workspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('markorbit-workspace-id');
}

const failureTitles: Record<ReadFailureKind, string> = {
  authentication: '需要登录',
  permission: '无读取权限',
  timeout: '读取超时',
  unavailable: 'Owner 暂不可用',
  contract: '返回数据不可信',
  context: '需要 Workspace 上下文'
};

function Failure({
  state,
  onRetry
}: {
  state: Extract<ReadState<never>, { phase: 'failure' }>;
  onRetry: () => void;
}) {
  return (
    <div className="sa2-real-failure" role="alert">
      <strong>{failureTitles[state.kind]}</strong>
      <p>{state.message}</p>
      {state.code && <code>{state.code}</code>}
      {state.kind !== 'context' && (
        <button className="sa2-button sa2-button--secondary" onClick={onRetry}>
          重试只读请求
        </button>
      )}
    </div>
  );
}

function ReadLoading({ owner }: { owner: string }) {
  return (
    <div className="sa2-real-loading" role="status">
      <span aria-hidden="true" />
      <strong>正在读取 {owner}</strong>
      <p>等待 Gateway 完成身份、权限和 owner contract 校验。</p>
    </div>
  );
}

function DataOwnerCard({
  state,
  onRetry,
  detail = false,
  navigate
}: {
  state: ReadState<DataOwnerSummary>;
  onRetry: () => void;
  detail?: boolean;
  navigate?: (path: string) => void;
}) {
  const { locale } = useSuperAdminI18n();
  return (
    <article className="sa2-real-owner" data-testid="real-owner-data">
      <header>
        <div>
          <span>DATA OWNER</span>
          <h2>Data Engine</h2>
        </div>
        <b>READ ONLY</b>
      </header>
      {state.phase === 'loading' && <ReadLoading owner="Data Engine" />}
      {state.phase === 'failure' && <Failure state={state} onRetry={onRetry} />}
      {state.phase === 'success' && (
        <>
          <div className="sa2-real-badges">
            <span>{state.value.health.status === 'degraded' ? '部分可用' : 'Owner 正常'}</span>
            <span>只读投影</span>
          </div>
          <dl className="sa2-real-facts">
            <div>
              <dt>Owner</dt>
              <dd>{state.value.source_owner}</dd>
            </div>
            <div>
              <dt>生成时间</dt>
              <dd>{formatSuperAdminDateTime(state.value.generated_at, locale)}</dd>
            </div>
            <div>
              <dt>来源</dt>
              <dd>{state.value.contract_version}</dd>
            </div>
            <div>
              <dt>Freshness</dt>
              <dd>该投影未提供 freshness SLA</dd>
            </div>
          </dl>
          <div className="sa2-real-counts">
            <span>
              <b>{state.value.operations.summary.operation_count}</b> operations
            </span>
            <span>
              <b>{state.value.operations.summary.operator_required}</b> operator required
            </span>
            <span>
              <b>{state.value.domain_progress.active_count}</b> active domains
            </span>
          </div>
          {detail && (
            <section className="sa2-real-detail">
              <h3>Owner 返回语义</h3>
              <dl>
                <div>
                  <dt>Authority</dt>
                  <dd>{state.value.authority}</dd>
                </div>
                <div>
                  <dt>Engine</dt>
                  <dd>{state.value.engine_version}</dd>
                </div>
                <div>
                  <dt>Operations model</dt>
                  <dd>{state.value.operations.version}</dd>
                </div>
                <div>
                  <dt>Action authority</dt>
                  <dd>{state.value.operations.action_authority}</dd>
                </div>
              </dl>
            </section>
          )}
          <div className="sa2-real-actions">
            <button className="sa2-button sa2-button--secondary" onClick={onRetry}>
              刷新只读摘要
            </button>
            {navigate && (
              <a
                href="/super-admin-v2/data/overview?mode=real"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/super-admin-v2/data/overview?mode=real');
                }}
              >
                查看 Data Engine
              </a>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function KnowledgeOwnerCard({
  state,
  onRetry,
  detail = false,
  navigate
}: {
  state: ReadState<KnowledgeOwnerHealthResult>;
  onRetry: () => void;
  detail?: boolean;
  navigate?: (path: string) => void;
}) {
  const { locale } = useSuperAdminI18n();
  return (
    <article className="sa2-real-owner" data-testid="real-owner-knowledge">
      <header>
        <div>
          <span>KNOWLEDGE OWNER</span>
          <h2>Evidence Supply Health</h2>
        </div>
        <b>READ ONLY</b>
      </header>
      {state.phase === 'loading' && <ReadLoading owner="Knowledge" />}
      {state.phase === 'failure' && <Failure state={state} onRetry={onRetry} />}
      {state.phase === 'success' && (
        <>
          <div className="sa2-real-badges">
            {state.value.summary.stale > 0 && <span className="is-warning">数据过期</span>}
            {(state.value.summary.coverage.PARTIAL > 0 ||
              state.value.summary.byState.PARTIAL > 0) && <span>部分可用</span>}
            {(state.value.summary.coverage.PARTIAL > 0 ||
              state.value.summary.byState.PARTIAL > 0) && <span>PARTIAL</span>}
            <span>{state.value.access}</span>
          </div>
          <dl className="sa2-real-facts">
            <div>
              <dt>Owner</dt>
              <dd>{state.value.owner}</dd>
            </div>
            <div>
              <dt>Observed at</dt>
              <dd>{formatSuperAdminDateTime(state.value.observedAt, locale)}</dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd>{state.value.workspaceId}</dd>
            </div>
            <div>
              <dt>来源</dt>
              <dd>{state.value.sourceReadModel}</dd>
            </div>
          </dl>
          <div className="sa2-real-counts">
            <span>
              <b>{state.value.summary.total}</b> targets
            </span>
            <span>
              <b>{state.value.summary.requiringAttention}</b> attention
            </span>
            <span>
              <b>{state.value.summary.stale}</b> stale
            </span>
          </div>
          {detail && (
            <section className="sa2-real-detail">
              <h3>Evidence supply targets</h3>
              {state.value.items.length === 0 ? (
                <p>Owner 成功返回 0 个 target；这是有效空状态，不是读取失败。</p>
              ) : (
                <ul className="sa2-real-targets">
                  {state.value.items.map((item) => (
                    <li key={item.targetId}>
                      <div>
                        <strong>{item.displayName}</strong>
                        <small>
                          {item.targetId} · {item.authorityName}
                        </small>
                      </div>
                      <span>{item.state}</span>
                      <span>{item.coverage.state}</span>
                      <span>{item.freshness.state}</span>
                      <time dateTime={item.observedAt}>
                        {formatSuperAdminDateTime(item.observedAt, locale)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <div className="sa2-real-actions">
            <button className="sa2-button sa2-button--secondary" onClick={onRetry}>
              刷新只读摘要
            </button>
            {navigate && (
              <a
                href="/super-admin-v2/knowledge/overview?mode=real"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/super-admin-v2/knowledge/overview?mode=real');
                }}
              >
                查看 Knowledge
              </a>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function useDataOwner() {
  const loadData = useCallback(
    (signal: AbortSignal) => loadDataOwnerSummary(timedFetch(signal)),
    []
  );
  return useOwnerRead(loadData, 'data');
}

function useKnowledgeOwner() {
  const selectedWorkspaceId = workspaceId();
  const loadKnowledge = useMemo<
    ((signal: AbortSignal) => Promise<KnowledgeOwnerHealthResult>) | null
  >(
    () =>
      selectedWorkspaceId
        ? (signal: AbortSignal) => loadKnowledgeOwnerHealth(timedFetch(signal), selectedWorkspaceId)
        : null,
    [selectedWorkspaceId]
  );
  return useOwnerRead(loadKnowledge, `knowledge:${selectedWorkspaceId ?? 'missing'}`);
}

export function RealControlPlane({ moduleId, pageId, pageLabel, navigate }: RealControlPlaneProps) {
  if (moduleId === 'overview' && pageId === 'platform')
    return <RealPlatformOverview navigate={navigate} />;

  if (moduleId === 'data' && pageId === 'overview') return <RealDataOverview />;

  if (moduleId === 'knowledge' && pageId === 'overview') return <RealKnowledgeOverview />;

  return (
    <section className="sa2-depth sa2-real sa2-real-unconnected">
      <header className="sa2-depth-head">
        <div>
          <span>REAL READ-ONLY · OWNER BOUNDARY</span>
          <h1>{pageLabel}</h1>
          <p>该页面尚无已批准的 Gateway 只读 projection。</p>
        </div>
      </header>
      <article>
        <strong>暂未接入</strong>
        <p>Real 模式不会使用 Demo fixture 填补缺失数据，也不会直接访问 owner 数据库。</p>
        <code>
          {moduleId}/{pageId}
        </code>
      </article>
    </section>
  );
}

function RealPlatformOverview({ navigate }: { navigate: (path: string) => void }) {
  const data = useDataOwner();
  const knowledge = useKnowledgeOwner();
  return (
    <section className="sa2-depth sa2-real" data-testid="real-platform-overview">
      <header className="sa2-depth-head">
        <div>
          <span>GOVERNED OWNER READS</span>
          <h1>真实只读运行摘要</h1>
          <p>两个 owner 独立读取；任一来源失败不会被解释为零数据，也不会遮蔽另一来源。</p>
        </div>
      </header>
      <div className="sa2-real-grid">
        <DataOwnerCard state={data.state} onRetry={data.reload} navigate={navigate} />
        <KnowledgeOwnerCard
          state={knowledge.state}
          onRetry={knowledge.reload}
          navigate={navigate}
        />
      </div>
    </section>
  );
}

function RealDataOverview() {
  const data = useDataOwner();
  return (
    <section className="sa2-depth sa2-real">
      <header className="sa2-depth-head">
        <div>
          <span>MARKORBIT_DATA_ENGINE · OWNER READ</span>
          <h1>Data Engine 真实摘要</h1>
          <p>经 Gateway 和精确 Data read capability 获取；不重建 owner 任务或管理状态。</p>
        </div>
      </header>
      <DataOwnerCard state={data.state} onRetry={data.reload} detail />
    </section>
  );
}

function RealKnowledgeOverview() {
  const knowledge = useKnowledgeOwner();
  return (
    <section className="sa2-depth sa2-real">
      <header className="sa2-depth-head">
        <div>
          <span>KNOWLEDGE · WORKSPACE-SCOPED OWNER READ</span>
          <h1>Knowledge 真实摘要</h1>
          <p>Gateway 同时校验 Knowledge read capability 与 Workspace membership。</p>
        </div>
      </header>
      <KnowledgeOwnerCard state={knowledge.state} onRetry={knowledge.reload} detail />
    </section>
  );
}
