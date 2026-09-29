import { useEffect, useMemo, useState } from 'react';
import {
  demoContext,
  demoIssues,
  draftStorageKey,
  emptyAnswers,
  hasExactSource,
  invalidateAnswer,
  type Draft,
  type IssueAnswer,
  type IssueId,
  type Locale,
  type OaIssue,
  type WorkbenchScenario
} from './model.js';
import './oa-workbench.css';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type View = 'issues' | 'source' | 'result';

const copy = {
  zh: {
    title: 'OA 对话式专业工作台',
    demo: '隔离 Demo · 不构成法律意见',
    back: '返回原案件',
    match: '核对文件与案件匹配',
    confirm: '确认此 Demo 匹配',
    issues: '问题',
    source: '原文证据',
    result: '待审核成果',
    prepare: '准备 Demo 解读',
    save: '保存 Demo 工作草稿',
    saved: 'Demo 草稿已保存并可恢复',
    review: '专业审核确认',
    deadline: '答复期限：待核对（未从获准官方来源证实）',
    original: '官方文件原文（不受信输入）',
    citedSource: '查看引用原文',
    assumption: 'MO 待核对解读 · Fixture 假设',
    userFacts: '用户提供的信息',
    note: '专业意见',
    material: '需要向客户补充索取资料',
    select: '选择结构化事实',
    unknown: '尚未确认',
    partial: '源文件缺少第 3 页；当前只能准备部分草稿。',
    stale: '文件版本已变化。依赖旧版本的成果已失效，不能继续审核。',
    conflict: '来源冲突：客户邮件称仅在线提供，内部清单同时记录可下载版本。',
    restored: '已恢复同一可信主体、Workspace、Matter 和文件版本的 Demo 草稿。'
  },
  en: {
    title: 'OA conversational professional workbench',
    demo: 'Isolated Demo · Not legal advice',
    back: 'Back to matter',
    match: 'Verify document–matter match',
    confirm: 'Confirm this Demo match',
    issues: 'Issues',
    source: 'Source evidence',
    result: 'Review output',
    prepare: 'Prepare Demo analysis',
    save: 'Save Demo working draft',
    saved: 'Demo draft saved and recoverable',
    review: 'Practitioner confirmation',
    deadline:
      'Response deadline: verification required (not established by an admitted official source)',
    original: 'Official-document text (untrusted input)',
    citedSource: 'View cited source text',
    assumption: 'MO interpretation to verify · Fixture assumption',
    userFacts: 'User-provided information',
    note: 'Professional opinion',
    material: 'Request supporting material from the client',
    select: 'Choose a structured fact',
    unknown: 'Not confirmed',
    partial: 'Page 3 is missing. Only a partial draft can be prepared.',
    stale:
      'The document version changed. Outputs based on the old version are invalid and cannot be reviewed.',
    conflict:
      'Source conflict: the client email says online-only, while an internal list also records a downloadable version.',
    restored:
      'Restored the Demo draft for the same trusted principal, Workspace, Matter, and document version.'
  }
} as const;

const initialDraft = (scenario: WorkbenchScenario): Draft => {
  const answers = emptyAnswers();
  const prepared = ['PREPARED', 'REVIEW_PENDING', 'SAVED_DEMO'].includes(scenario);
  if (prepared) {
    answers['issue-identification'] = {
      ...answers['issue-identification'],
      selection: 'online',
      facts: '客户确认目前仅通过网页提供服务。',
      professionalNote: '需与现有商品服务清单逐项核对。',
      reviewed: scenario === 'SAVED_DEMO'
    };
    answers['issue-specification'] = {
      ...answers['issue-specification'],
      selection: 'both',
      facts: '客户提供分析报告与在线仪表板。',
      professionalNote: '需确认最终限定用语。',
      reviewed: scenario === 'SAVED_DEMO'
    };
  }
  return {
    source: demoContext,
    answers,
    prepared,
    ...(scenario === 'SAVED_DEMO' ? { savedAt: '2026-09-29T16:00:00.000Z' } : {})
  };
};

function BoundaryState({ scenario, locale }: { scenario: WorkbenchScenario; locale: Locale }) {
  const messages: Partial<Record<WorkbenchScenario, readonly [string, string]>> = {
    LOADING: ['正在核对授权来源…', 'Checking the authorized source…'],
    EMPTY: [
      '当前 Demo 没有可进入的文件；这不表示没有 OA。',
      'No file is available in this Demo. This does not establish that no OA exists.'
    ],
    PERMISSION: [
      '文件授权已撤销，私有原文未显示。',
      'Document access was revoked; private source text is hidden.'
    ],
    WRONG_WORKSPACE: [
      '此链接不属于当前 Workspace，未读取任何私有数据。',
      'This link does not belong to the current Workspace; no private data was read.'
    ],
    SOURCE_UNAVAILABLE: [
      '来源服务暂时不可用；这不是空结果。',
      'The source service is unavailable; this is not an empty result.'
    ],
    PREPARING: [
      '正在准备固定的 Demo 解读；未调用模型或外部服务。',
      'Preparing the fixed Demo analysis; no model or external service is being called.'
    ],
    STALE_SOURCE: [copy.zh.stale, copy.en.stale]
  };
  const message = messages[scenario];
  if (!message) return null;
  return (
    <main className="oa-boundary" aria-live="polite">
      <p className="oa-eyebrow">{locale === 'zh' ? copy.zh.demo : copy.en.demo}</p>
      <h1>{locale === 'zh' ? copy.zh.title : copy.en.title}</h1>
      <div className="oa-alert" role={scenario === 'LOADING' ? 'status' : 'alert'}>
        {message[locale === 'zh' ? 0 : 1]}
      </div>
    </main>
  );
}

type WorkbenchProps = {
  scenario?: WorkbenchScenario;
  initialLocale?: Locale;
  trustedPrincipalId?: string;
  storage?: StorageLike;
  onBack?: () => void;
};

export function OaWorkbench(props: WorkbenchProps) {
  return <OaWorkbenchSession key={props.trustedPrincipalId || 'session-only'} {...props} />;
}

function OaWorkbenchSession({
  scenario = 'READY',
  initialLocale = 'zh',
  trustedPrincipalId = '',
  storage = typeof window === 'undefined' ? undefined : window.localStorage,
  onBack
}: WorkbenchProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [confirmed, setConfirmed] = useState(scenario !== 'AMBIGUOUS_MATCH');
  const [candidateSelection, setCandidateSelection] = useState<'current' | 'historical' | ''>('');
  const [selectedIssue, setSelectedIssue] = useState<IssueId>('issue-identification');
  const [view, setView] = useState<View>('issues');
  const [draft, setDraft] = useState<Draft>(() => initialDraft(scenario));
  const [notice, setNotice] = useState(scenario === 'SAVED_DEMO' ? copy[initialLocale].saved : '');
  const [storageFailed, setStorageFailed] = useState(false);
  const t = copy[locale];
  const key = trustedPrincipalId ? draftStorageKey(trustedPrincipalId) : '';
  const issue = useMemo<OaIssue>(
    () => demoIssues.find((candidate) => candidate.id === selectedIssue) ?? demoIssues[0]!,
    [selectedIssue]
  );

  useEffect(() => {
    if (!key || !storage) return;
    try {
      const saved = storage.getItem(key);
      if (!saved) return;
      const value = JSON.parse(saved) as Draft;
      if (hasExactSource(value)) {
        setDraft(value);
        setNotice(copy[initialLocale].restored);
      }
    } catch {
      setStorageFailed(true);
    }
  }, [initialLocale, key, storage]);

  if (
    [
      'LOADING',
      'EMPTY',
      'PERMISSION',
      'WRONG_WORKSPACE',
      'SOURCE_UNAVAILABLE',
      'PREPARING',
      'STALE_SOURCE'
    ].includes(scenario)
  ) {
    return <BoundaryState scenario={scenario} locale={locale} />;
  }

  const updateAnswer = (id: IssueId, patch: Partial<IssueAnswer>) => {
    setDraft((current) => ({
      ...current,
      prepared:
        current.prepared &&
        !Object.keys(patch).some((field) => field !== 'reviewed' && field !== 'professionalNote'),
      savedAt: undefined,
      answers: { ...current.answers, [id]: invalidateAnswer(current.answers[id], patch) }
    }));
    setNotice('');
  };

  const save = () => {
    const value = { ...draft, savedAt: new Date().toISOString() };
    setDraft(value);
    if (!key || !storage) {
      setNotice(
        locale === 'zh'
          ? '没有可信主体：仅保留当前页面内存草稿。'
          : 'No trusted principal: this draft remains in page memory only.'
      );
      return;
    }
    try {
      storage.setItem(key, JSON.stringify(value));
      setNotice(t.saved);
    } catch {
      setStorageFailed(true);
      setNotice(
        locale === 'zh'
          ? '浏览器存储失败；当前页编辑仍保留，但未持久化。'
          : 'Browser storage failed. Edits remain on this page but were not persisted.'
      );
    }
  };

  const hasClarification = (answer: IssueAnswer) =>
    Boolean(answer.selection || answer.facts.trim() || answer.professionalNote.trim());
  const allReviewed = demoIssues.every(
    (item) => draft.answers[item.id].reviewed && hasClarification(draft.answers[item.id])
  );

  return (
    <div className="oa-shell">
      <header className="oa-topbar">
        <div>
          <p className="oa-eyebrow">{t.demo}</p>
          <h1>{t.title}</h1>
        </div>
        <div className="oa-top-actions">
          <button
            className="oa-quiet"
            type="button"
            disabled={!onBack}
            title={
              !onBack
                ? locale === 'zh'
                  ? '隔离 Demo 未连接案件路由'
                  : 'This isolated Demo has no matter route'
                : undefined
            }
            onClick={onBack}
          >
            ← {t.back}
          </button>
          <button
            className="oa-language"
            type="button"
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
          >
            {locale === 'zh' ? 'English' : '中文'}
          </button>
        </div>
      </header>

      <section
        className="oa-context"
        aria-label={
          locale === 'zh' ? '当前案件与文件上下文' : 'Current matter and document context'
        }
      >
        <div>
          <span>Workspace</span>
          <strong>{demoContext.workspaceName}</strong>
          <small>{demoContext.workspaceId}</small>
        </div>
        <div>
          <span>{locale === 'zh' ? '当前用户' : 'Current actor'}</span>
          <strong>
            {trustedPrincipalId
              ? demoContext.actorName
              : locale === 'zh'
                ? '未提供可信主体 · 仅页面内存草稿'
                : 'No trusted principal · Page-memory draft only'}
          </strong>
          <small>{trustedPrincipalId || (locale === 'zh' ? '未绑定' : 'Not bound')}</small>
        </div>
        <div>
          <span>Formal Matter / Trademark</span>
          <strong>{demoContext.trademarkName}</strong>
          <small>
            {demoContext.matterId}@{demoContext.matterVersion} · {demoContext.applicationNumber}
          </small>
        </div>
        <div>
          <span>{locale === 'zh' ? '确切 OA 文件' : 'Exact OA document'}</span>
          <strong>{demoContext.documentName}</strong>
          <small>
            {demoContext.documentId}@{demoContext.documentVersion}
          </small>
        </div>
      </section>

      {!confirmed ? (
        <main className="oa-match">
          <p className="oa-step">SELECT_SOURCE → CONFIRM_MATCH</p>
          <h2>{t.match}</h2>
          <div className="oa-alert" role="alert">
            {locale === 'zh'
              ? '找到两个候选案件，不能静默确认。请选择 exact Formal Matter。'
              : 'Two candidate matters were found. Silent confirmation is not allowed; choose the exact Formal Matter.'}
          </div>
          <fieldset>
            <legend>{locale === 'zh' ? '候选案件' : 'Candidate matters'}</legend>
            <label>
              <input
                checked={candidateSelection === 'current'}
                name="matter"
                type="radio"
                onChange={() => setCandidateSelection('current')}
              />{' '}
              {demoContext.matterId}@{demoContext.matterVersion} · {demoContext.trademarkName}
            </label>
            <label>
              <input
                checked={candidateSelection === 'historical'}
                name="matter"
                type="radio"
                onChange={() => setCandidateSelection('historical')}
              />{' '}
              formal-matter_demo-archive@2 · MOKI archive (historical)
            </label>
            {candidateSelection === 'historical' && (
              <div className="oa-alert" role="alert">
                {locale === 'zh'
                  ? '历史候选案件不属于当前 Demo 文件；请核对并选择匹配的当前案件。'
                  : 'The historical candidate does not match this Demo document; verify and select the current matter.'}
              </div>
            )}
          </fieldset>
          <button
            className="oa-primary"
            type="button"
            disabled={candidateSelection !== 'current'}
            onClick={() => {
              if (candidateSelection === 'current') setConfirmed(true);
            }}
          >
            {t.confirm}
          </button>
        </main>
      ) : (
        <main className="oa-workbench">
          <nav
            className="oa-mobile-nav"
            aria-label={locale === 'zh' ? '工作台视图' : 'Workbench views'}
          >
            {(['issues', 'source', 'result'] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-current={view === item ? 'page' : undefined}
                onClick={() => setView(item)}
              >
                {t[item]}
              </button>
            ))}
          </nav>

          <aside
            className={`oa-panel oa-issues ${view === 'issues' ? 'is-active' : ''}`}
            aria-labelledby="oa-issues-heading"
          >
            <p className="oa-step">VIEW_ISSUES</p>
            <h2 id="oa-issues-heading">{t.issues} · 2</h2>
            <p className="oa-deadline">{t.deadline}</p>
            {demoIssues.map((item, index) => (
              <button
                className="oa-issue-card"
                aria-current={selectedIssue === item.id}
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedIssue(item.id);
                  setView('source');
                }}
              >
                <span>0{index + 1}</span>
                <strong>
                  {locale === 'zh'
                    ? index === 0
                      ? '商品/服务描述澄清'
                      : '服务范围具体化'
                    : index === 0
                      ? 'Identification clarification'
                      : 'Service scope specificity'}
                </strong>
                <small>{item.locator}</small>
                <em>
                  {draft.answers[item.id].reviewed
                    ? locale === 'zh'
                      ? 'Demo 已审核'
                      : 'Demo reviewed'
                    : locale === 'zh'
                      ? '待专业审核'
                      : 'Practitioner check pending'}
                </em>
              </button>
            ))}
            {scenario === 'PARTIAL_FILE' && (
              <div className="oa-alert" role="alert">
                {t.partial}
              </div>
            )}
            {scenario === 'CONFLICTED_EVIDENCE' && (
              <div className="oa-alert" role="alert">
                {t.conflict}
              </div>
            )}
          </aside>

          <section
            className={`oa-panel oa-source ${view === 'source' ? 'is-active' : ''}`}
            aria-labelledby="oa-source-heading"
          >
            <p className="oa-step">CLARIFY · {issue.locator}</p>
            <h2 id="oa-source-heading">{t.source}</h2>
            <article className="oa-source-card">
              <h3>{t.original}</h3>
              <p lang="en">{issue.original}</p>
              <footer>
                {demoContext.documentId}@{demoContext.documentVersion} · {issue.locator}
              </footer>
            </article>
            <article className="oa-assumption">
              <h3>{t.assumption}</h3>
              <p>{issue.explanation[locale]}</p>
            </article>
            <form className="oa-clarify" onSubmit={(event) => event.preventDefault()}>
              <h3>{issue.question[locale]}</h3>
              <label>
                {t.select}
                <select
                  value={draft.answers[issue.id].selection}
                  onChange={(event) => updateAnswer(issue.id, { selection: event.target.value })}
                >
                  <option value="">{t.unknown}</option>
                  {issue.options.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label[locale]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.userFacts}
                <textarea
                  value={draft.answers[issue.id].facts}
                  onChange={(event) => updateAnswer(issue.id, { facts: event.target.value })}
                  placeholder={
                    locale === 'zh'
                      ? '记录客户陈述；不要把它改写为官方原文'
                      : 'Record the client statement; do not rewrite it as official source text'
                  }
                />
              </label>
              <label className="oa-check">
                <input
                  checked={draft.answers[issue.id].requestClientMaterial}
                  type="checkbox"
                  onChange={(event) =>
                    updateAnswer(issue.id, { requestClientMaterial: event.target.checked })
                  }
                />{' '}
                {t.material}
              </label>
              <label>
                {t.note}
                <textarea
                  value={draft.answers[issue.id].professionalNote}
                  onChange={(event) =>
                    updateAnswer(issue.id, { professionalNote: event.target.value })
                  }
                />
              </label>
            </form>
            <button
              className="oa-primary"
              type="button"
              disabled={!hasClarification(draft.answers[issue.id])}
              onClick={() => {
                if (!hasClarification(draft.answers[issue.id])) return;
                setDraft((current) => ({ ...current, prepared: true, savedAt: undefined }));
                setView('result');
                setNotice('');
              }}
            >
              {t.prepare}
            </button>
          </section>

          <section
            className={`oa-panel oa-result ${view === 'result' ? 'is-active' : ''}`}
            aria-labelledby="oa-result-heading"
          >
            <p className="oa-step">PREPARE → PROFESSIONAL_REVIEW</p>
            <h2 id="oa-result-heading">{t.result}</h2>
            {!draft.prepared ? (
              <div className="oa-empty-result">
                {locale === 'zh'
                  ? '完成至少一次澄清后准备成果。'
                  : 'Complete a clarification, then prepare the output.'}
              </div>
            ) : (
              demoIssues.map((item, index) => {
                const answer = draft.answers[item.id];
                return (
                  <article className="oa-output-card" key={item.id}>
                    <h3>
                      0{index + 1} · {item.locator}
                    </h3>
                    <details className="oa-output-source">
                      <summary>{t.citedSource}</summary>
                      <p lang="en">{item.original}</p>
                    </details>
                    <p>
                      <strong>{t.userFacts}:</strong> {answer.facts || t.unknown}
                    </p>
                    <p>
                      <strong>
                        {locale === 'zh' ? '客户待补资料' : 'Client material needed'}:
                      </strong>{' '}
                      {answer.requestClientMaterial
                        ? locale === 'zh'
                          ? '是'
                          : 'Yes'
                        : locale === 'zh'
                          ? '否'
                          : 'No'}
                    </p>
                    <label>
                      {t.note}
                      <textarea
                        value={answer.professionalNote}
                        onChange={(event) =>
                          updateAnswer(item.id, { professionalNote: event.target.value })
                        }
                      />
                    </label>
                    <label className="oa-check">
                      <input
                        checked={answer.reviewed}
                        type="checkbox"
                        disabled={!hasClarification(answer)}
                        onChange={(event) =>
                          updateAnswer(item.id, { reviewed: event.target.checked })
                        }
                      />{' '}
                      {t.review}
                    </label>
                  </article>
                );
              })
            )}
            {draft.prepared && <p className="oa-deadline">{t.deadline}</p>}
            {notice && (
              <div className="oa-notice" role="status">
                {notice}
              </div>
            )}
            {storageFailed && !notice && (
              <div className="oa-alert" role="alert">
                {locale === 'zh'
                  ? '无法读取浏览器草稿；当前页仍可使用。'
                  : 'The browser draft could not be read; this page remains usable.'}
              </div>
            )}
            <button
              className="oa-primary"
              type="button"
              disabled={!draft.prepared || !allReviewed || scenario === 'PARTIAL_FILE'}
              onClick={save}
            >
              {t.save}
            </button>
            <p className="oa-boundary-copy">
              {locale === 'zh'
                ? '仅保存隔离 Demo 工作草稿 · 未调用模型 · 未创建正式案件记录 · 未发送或递交'
                : 'Saves an isolated Demo working draft only · No model call · No formal matter record · Nothing sent or filed'}
            </p>
          </section>
        </main>
      )}
    </div>
  );
}
