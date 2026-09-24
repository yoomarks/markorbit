import { useMemo, useState } from 'react';
import type { DemoRecord } from './fixtures.js';

export const KNOWLEDGE_PAGE_IDS = [
  'overview',
  'sources',
  'plans',
  'runs',
  'workers',
  'raw-files',
  'transforms',
  'evidence',
  'search',
  'packages',
  'supply-health'
] as const;

interface KnowledgePagesProps {
  pageId: string;
  records: readonly DemoRecord[];
  query: string;
  setQuery: (value: string) => void;
  onSelect: (record: DemoRecord) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}

const sourceRows = [
  ['SRC-EUIPO', 'EUIPO Guidelines', '法规与指南', '已批准', '4 小时前'],
  ['SRC-CNIPA', 'CNIPA Gazette', '公告', '已批准', '38 分钟前'],
  ['SRC-USPTO', 'USPTO TMEP', '审查手册', '已批准', '1 天前'],
  ['SRC-WIPO', 'WIPO Madrid Notices', '国际公告', '待审核', '2 天前']
] as const;

const planRows = [
  ['PLAN-EU-12', 'EUIPO 指南监测', '每 6 小时', '法规文档', '已启用'],
  ['PLAN-CN-08', 'CNIPA 公告采集', '工作日 10:00', '公告条目', '已启用'],
  ['PLAN-US-19', 'USPTO 手册扫描', '每日 02:00', '章节版本', '已启用'],
  ['PLAN-WO-03', 'Madrid notices', '每周一', '通知', '已暂停']
] as const;

const evidenceRows = [
  {
    id: 'EVD-11842',
    title: 'Absolute grounds · distinctiveness',
    source: 'EUIPO',
    locator: 'Guidelines 2026 · §4.2.1',
    page: 'Page 84',
    quote:
      'Assessment of distinctive character must consider the sign as a whole and the goods or services for which registration is sought.',
    candidate:
      'Evidence candidate: the assessment is contextual and cannot be reduced to an isolated token.',
    digest: 'a83…91f · lines 1842–1851',
    status: '待审核'
  },
  {
    id: 'EVD-11841',
    title: 'Classification practice update',
    source: 'CNIPA',
    locator: 'CNIPA Examination Guide · Chapter 3 §2.4',
    page: 'Page 116',
    quote: '类似商品判断应结合功能、用途、销售渠道及相关公众的一般认知。',
    candidate: 'Evidence candidate: classification similarity requires contextual comparison.',
    digest: 'c42…18a · lines 2260–2274',
    status: '待审核'
  },
  {
    id: 'EVD-11838',
    title: 'Specimen requirements',
    source: 'USPTO',
    locator: 'TMEP · §904.03',
    page: 'Page 312',
    quote: 'A specimen must show the mark as actually used in commerce for the identified goods.',
    candidate: 'Evidence candidate: the specimen must preserve the actual-use context.',
    digest: 'f18…02c · lines 8120–8131',
    status: '高风险'
  }
] as const;

const knowledgeHits = [
  {
    id: 'KH-EU-1',
    title: 'Distinctive character: assessment as a whole',
    source: 'EUIPO',
    locator: 'EUIPO Guidelines · §4.2.1 · Page 84',
    summary: '整体评估显著性并保留商品、服务和适用范围。',
    currentness: '当前'
  },
  {
    id: 'KH-CN-1',
    title: '整体观察与显著部分的关系',
    source: 'CNIPA',
    locator: 'CNIPA 审查指南 · 第三章 §2.4',
    summary: '整体观察与显著部分比较需要结合相关公众认知。',
    currentness: '6 小时前'
  },
  {
    id: 'KH-US-1',
    title: 'Failure-to-function doctrine',
    source: 'USPTO',
    locator: 'USPTO TMEP · §1202.04',
    summary: '判断标志是否发挥来源识别功能并保留实际使用语境。',
    currentness: '当前'
  }
] as const;

const readyPackages = [
  { id: 'RPK-4208', lane: 'Preparing', evidence: 24, target: 'Core intake', receipt: '尚未生成' },
  { id: 'RPK-4207', lane: 'Preparing', evidence: 18, target: 'Core intake', receipt: '尚未生成' },
  { id: 'RPK-4186', lane: 'Ready', evidence: 24, target: 'Core intake', receipt: 'Ready only' },
  { id: 'RPK-4185', lane: 'Ready', evidence: 18, target: 'Core intake', receipt: 'Ready only' },
  {
    id: 'RPK-4164',
    lane: 'Delivering',
    evidence: 24,
    target: 'Core content',
    receipt: '等待 receipt'
  },
  {
    id: 'RPK-4163',
    lane: 'Delivering',
    evidence: 18,
    target: 'Core content',
    receipt: '等待 receipt'
  },
  { id: 'RPK-4142', lane: 'Reconciled', evidence: 24, target: 'Core content', receipt: 'REC-4142' },
  { id: 'RPK-4141', lane: 'Reconciled', evidence: 18, target: 'Core content', receipt: 'REC-4141' }
] as const;

export function KnowledgePages(props: KnowledgePagesProps) {
  switch (props.pageId) {
    case 'sources':
      return <Sources {...props} />;
    case 'plans':
      return <Plans {...props} />;
    case 'runs':
      return <Runs {...props} />;
    case 'workers':
      return <Workers {...props} />;
    case 'raw-files':
      return <RawFiles {...props} />;
    case 'transforms':
      return <Transforms {...props} />;
    case 'evidence':
      return <Evidence {...props} />;
    case 'search':
      return <Search {...props} />;
    case 'packages':
      return <Packages {...props} />;
    case 'supply-health':
      return <SupplyHealth {...props} />;
    default:
      return <Overview {...props} />;
  }
}

function Shell({
  pageId,
  eyebrow,
  title,
  description,
  action,
  children
}: {
  pageId: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sa2-depth sa2-depth--knowledge" data-testid={`knowledge-page-${pageId}`}>
      <header className="sa2-depth-head">
        <div>
          <span>{eyebrow}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Head({ label, title, badge }: { label: string; title: string; badge?: string }) {
  return (
    <header className="sa2-card-title">
      <div>
        <span>{label}</span>
        <h4>{title}</h4>
      </div>
      {badge && <b>{badge}</b>}
    </header>
  );
}

function Overview({ records, onSelect }: KnowledgePagesProps) {
  const stages = [
    ['来源', '48', '2 待审核'],
    ['原始文件', '12,842', '96% 当前'],
    ['转换', '12', '2 运行中'],
    ['证据集', '1,284', '18 待审核'],
    ['Ready', '326', '4 待交付']
  ];
  return (
    <Shell
      pageId="overview"
      eyebrow="SUPPLY CHAIN"
      title="知识供应总览"
      description="从来源到 Ready Package 追踪产物、证据与交付，不把供应商回传当作正式真相。"
    >
      <div className="sa2-knowledge-funnel">
        {stages.map((stage, index) => (
          <article key={stage[0]}>
            <span>{index + 1}</span>
            <h4>{stage[0]}</h4>
            <strong>{stage[1]}</strong>
            <small>{stage[2]}</small>
            {index < stages.length - 1 && <b>→</b>}
          </article>
        ))}
      </div>
      <div className="sa2-depth-grid sa2-depth-grid--overview">
        <article className="sa2-depth-card">
          <Head label="ATTENTION" title="供应链关注项" />
          {records.map((record) => (
            <button className="sa2-attention-row" key={record.id} onClick={() => onSelect(record)}>
              <i />
              <span>
                <strong>{record.name}</strong>
                <small>{record.detail}</small>
              </span>
              <u>{record.status}</u>
            </button>
          ))}
        </article>
        <article className="sa2-depth-card">
          <Head label="CURRENTNESS" title="来源新鲜度" badge="目标 95%" />
          <div className="sa2-ring">
            <div>
              <strong>92%</strong>
              <span>当前</span>
            </div>
            <ul>
              <li>
                <b>36</b> SLA 内
              </li>
              <li>
                <b>8</b> 即将过期
              </li>
              <li>
                <b>4</b> 已过期
              </li>
            </ul>
          </div>
        </article>
      </div>
    </Shell>
  );
}

function Sources({ query, setQuery, onAction }: KnowledgePagesProps) {
  const rows = sourceRows.filter((row) =>
    row.join(' ').toLowerCase().includes(query.toLowerCase())
  );
  return (
    <Shell
      pageId="sources"
      eyebrow="SOURCE REGISTRY"
      title="来源管理"
      description="管理来源批准、启用状态、采集边界和关系图；来源登记不自动进入正式知识。"
      action={
        <button className="sa2-button" onClick={() => onAction('登记 Knowledge 来源', true)}>
          ＋ 登记来源
        </button>
      }
    >
      <div className="sa2-split-workspace">
        <article className="sa2-depth-card">
          <div className="sa2-inline-search">
            <input
              aria-label="搜索知识来源"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="来源名、ID 或类型"
            />
            <select>
              <option>全部批准状态</option>
              <option>已批准</option>
              <option>待审核</option>
            </select>
          </div>
          <div className="sa2-registry-list">
            {rows.map((row, index) => (
              <button className={index === 0 ? 'is-active' : ''} key={row[0]}>
                <span>
                  <strong>{row[1]}</strong>
                  <small>
                    {row[0]} · {row[2]}
                  </small>
                </span>
                <u>{row[3]}</u>
                <time>{row[4]}</time>
              </button>
            ))}
          </div>
        </article>
        <article className="sa2-depth-card sa2-source-profile">
          <Head label="SOURCE PROFILE" title="EUIPO Guidelines" badge="已批准" />
          <dl>
            <div>
              <dt>Canonical URL</dt>
              <dd>euipo.europa.eu/guidelines</dd>
            </div>
            <div>
              <dt>覆盖</dt>
              <dd>EU · 法规 / 审查实践</dd>
            </div>
            <div>
              <dt>当前版本</dt>
              <dd>2026.09 · 4 小时前验证</dd>
            </div>
          </dl>
          <h4>来源关系</h4>
          <div className="sa2-source-graph">
            <span>Publisher</span>
            <b>EUIPO</b>
            <i>→</i>
            <span>Collection plan</span>
            <b>PLAN-EU-12</b>
            <i>→</i>
            <span>Evidence sets</span>
          </div>
          <button onClick={() => onAction('重新评估 EUIPO 来源')}>运行只读来源评估</button>
        </article>
      </div>
    </Shell>
  );
}

function Plans({ onAction }: KnowledgePagesProps) {
  return (
    <Shell
      pageId="plans"
      eyebrow="COLLECTION POLICY"
      title="采集计划"
      description="编排来源、频率、输出与允许的抓取边界；启停计划是受保护的 owner 操作。"
      action={
        <button className="sa2-button" onClick={() => onAction('创建采集计划', true)}>
          ＋ 创建计划
        </button>
      }
    >
      <div className="sa2-plan-calendar">
        <article className="sa2-depth-card">
          <Head label="WEEK 39" title="调度日历" />
          <div className="sa2-calendar-head">
            {['一 21', '二 22', '三 23', '四 24', '五 25', '六 26', '日 27'].map((day) => (
              <b key={day}>{day}</b>
            ))}
          </div>
          <div className="sa2-calendar-body">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index}>
                {index < 5 && (
                  <>
                    <span>10:00 CNIPA</span>
                    <span>14:00 EUIPO</span>
                  </>
                )}
                {index === 0 && <span>08:00 WIPO</span>}
              </div>
            ))}
          </div>
        </article>
        <article className="sa2-depth-card">
          <Head label="PLAN DETAIL" title="PLAN-EU-12" badge="已启用" />
          <label>
            策略
            <select defaultValue="diff">
              <option value="diff">版本差异采集</option>
              <option>全量快照</option>
            </select>
          </label>
          <label>
            节奏
            <input defaultValue="0 */6 * * *" readOnly />
          </label>
          <label>
            输出
            <select>
              <option>法规文档 + locator</option>
            </select>
          </label>
          <div className="sa2-callout">
            <b>演示编辑器</b>
            <span>更改只用于产品评审；保存会进入受保护确认。</span>
          </div>
          <button className="sa2-button" onClick={() => onAction('保存采集计划变更', true)}>
            审阅计划变更
          </button>
        </article>
      </div>
      <article className="sa2-depth-card sa2-plan-table">
        {planRows.map((row) => (
          <div key={row[0]}>
            <span>
              <strong>{row[1]}</strong>
              <small>{row[0]}</small>
            </span>
            <span>{row[2]}</span>
            <span>{row[3]}</span>
            <u>{row[4]}</u>
          </div>
        ))}
      </article>
    </Shell>
  );
}

function Runs({ onAction }: KnowledgePagesProps) {
  return (
    <Shell
      pageId="runs"
      eyebrow="EXECUTION LEDGER"
      title="执行任务"
      description="关联 CollectionRun、Job snapshot、Worker lease 和交付 receipt，失败按阶段隔离。"
    >
      <div className="sa2-run-timeline">
        <aside>
          {[
            ['RUN-9821', '运行中'],
            ['RUN-9818', '失败'],
            ['RUN-9814', '已完成'],
            ['RUN-9809', '已完成']
          ].map((row, index) => (
            <button className={index === 0 ? 'is-active' : ''} key={row[0]}>
              <i />
              <span>
                <strong>{row[0]}</strong>
                <small>PLAN-EU-12 · 09:42</small>
              </span>
              <u>{row[1]}</u>
            </button>
          ))}
        </aside>
        <article className="sa2-depth-card">
          <Head label="RUN TIMELINE" title="RUN-9821 · EUIPO 指南监测" badge="运行中" />
          {[
            ['09:42:08', 'CollectionRun 创建', 'receipt: rcpt-443'],
            ['09:42:11', 'Job snapshot 冻结', '18 URLs'],
            ['09:42:14', 'Worker lease 获取', 'worker-web-03'],
            ['09:44:32', '原始产物写入', '14 / 18'],
            ['现在', '等待剩余页面', 'lease 还有 4m']
          ].map((item, index) => (
            <div className="sa2-event-line" key={item[0]}>
              <span>{index + 1}</span>
              <time>{item[0]}</time>
              <b>{item[1]}</b>
              <code>{item[2]}</code>
            </div>
          ))}
          <div className="sa2-action-row">
            <button onClick={() => onAction('刷新 RUN-9821 owner receipt')}>刷新 receipt</button>
            <button onClick={() => onAction('取消 RUN-9821', true)}>受控取消</button>
          </div>
        </article>
      </div>
    </Shell>
  );
}

function Workers({ onAction }: KnowledgePagesProps) {
  const workers = [
    ['worker-web-03', 'Web fetch · PDF', '3 / 4', '12 秒前', '健康'],
    ['worker-ocr-02', 'OCR · zh/en', '1 / 2', '28 秒前', '健康'],
    ['worker-convert-07', 'HTML → Evidence', '4 / 4', '9 秒前', '繁忙'],
    ['worker-embed-01', 'Embedding v4', '0 / 2', '6 分钟前', '失联']
  ];
  return (
    <Shell
      pageId="workers"
      eyebrow="WORKER FLEET"
      title="Workers"
      description="查看能力声明、心跳、并发和当前租约；聚合后台不伪造 heartbeat。"
    >
      <div className="sa2-worker-grid">
        {workers.map((worker, index) => (
          <article className="sa2-depth-card" key={worker[0]}>
            <header>
              <i className={`health-${index}`} />
              <span>
                <strong>{worker[0]}</strong>
                <small>{worker[4]}</small>
              </span>
              <button onClick={() => onAction(`查看 ${worker[0]} 日志`)}>•••</button>
            </header>
            <dl>
              <div>
                <dt>Capabilities</dt>
                <dd>{worker[1]}</dd>
              </div>
              <div>
                <dt>并发</dt>
                <dd>{worker[2]}</dd>
              </div>
              <div>
                <dt>Heartbeat</dt>
                <dd>{worker[3]}</dd>
              </div>
            </dl>
            <div className="sa2-worker-load">
              <i>
                <em style={{ width: `${[75, 50, 100, 0][index]}%` }} />
              </i>
              <span>{[75, 50, 100, 0][index]}%</span>
            </div>
          </article>
        ))}
      </div>
      <article className="sa2-depth-card">
        <Head label="ASSIGNMENTS" title="当前租约" badge="8 active" />
        <div className="sa2-simple-table">
          <b>Job</b>
          <b>Worker</b>
          <b>租约剩余</b>
          <b>阶段</b>
          {[
            ['JOB-4412', 'worker-web-03', '04:12', 'Fetch'],
            ['JOB-4413', 'worker-convert-07', '02:48', 'Convert'],
            ['JOB-4414', 'worker-ocr-02', '07:31', 'OCR']
          ].flatMap((row) => row.map((cell) => <span key={`${row[0]}-${cell}`}>{cell}</span>))}
        </div>
      </article>
    </Shell>
  );
}

function RawFiles({ onAction }: KnowledgePagesProps) {
  return (
    <Shell
      pageId="raw-files"
      eyebrow="IMMUTABLE INVENTORY"
      title="原始文件"
      description="追踪不可变原件、重复关系、来源版本与转换资格；替换会创建新版本。"
      action={
        <button className="sa2-button" onClick={() => onAction('手动上传原始文件', true)}>
          上传原始文件
        </button>
      }
    >
      <div className="sa2-file-browser">
        <aside className="sa2-depth-card">
          <Head label="FACETS" title="库存筛选" />
          <label>
            <input type="checkbox" defaultChecked /> 可转换 <b>8,421</b>
          </label>
          <label>
            <input type="checkbox" /> 重复项 <b>326</b>
          </label>
          <label>
            <input type="checkbox" /> 缺少 locator <b>18</b>
          </label>
          <hr />
          <button className="is-active">
            EUIPO <b>3,282</b>
          </button>
          <button>
            CNIPA <b>5,921</b>
          </button>
          <button>
            USPTO <b>2,884</b>
          </button>
        </aside>
        <article className="sa2-depth-card">
          <Head label="RAW ARTIFACTS" title="12,842 个文件" badge="Immutable" />
          {[
            ['RAW-88421', 'guidelines-2026-09.pdf', 'sha256: a83…91f', '可转换'],
            ['RAW-88420', 'guidelines-2026-06.pdf', 'sha256: 88d…4a2', '历史版本'],
            ['RAW-88419', 'annex-17.html', 'sha256: 1b7…002', '可转换'],
            ['RAW-88418', 'decision-1142.pdf', 'sha256: 74a…21c', '重复']
          ].map((row) => (
            <button className="sa2-raw-row" key={row[0]}>
              <span>▤</span>
              <span>
                <strong>{row[1]}</strong>
                <small>
                  {row[0]} · {row[2]}
                </small>
              </span>
              <u>{row[3]}</u>
              <b>›</b>
            </button>
          ))}
        </article>
      </div>
    </Shell>
  );
}

function Transforms({ onAction }: KnowledgePagesProps) {
  return (
    <Shell
      pageId="transforms"
      eyebrow="CONVERSION PIPELINE"
      title="转换处理"
      description="以输入资格、转换 profile、Worker 租约和输出 receipt 形成可重放的转换账本。"
      action={
        <button className="sa2-button" onClick={() => onAction('派发 Knowledge 转换批次', true)}>
          派发转换
        </button>
      }
    >
      <div className="sa2-transform-board">
        {[
          ['Eligible', '128', '通过输入检查'],
          ['Queued', '36', '等待兼容 Worker'],
          ['Converting', '12', '持有有效 lease'],
          ['Review', '18', '等待证据审核'],
          ['Failed', '3', '已隔离']
        ].map((lane, index) => (
          <article key={lane[0]}>
            <header>
              <span>{lane[0]}</span>
              <b>{lane[1]}</b>
            </header>
            <p>{lane[2]}</p>
            {[0, 1].map((card) => (
              <button key={card}>
                <strong>{index === 0 ? 'RAW-88421' : `CONV-${9821 - index * 8 - card}`}</strong>
                <small>{['PDF text v3', 'HTML clean v2'][card]}</small>
                <i style={{ width: `${35 + index * 12 + card * 10}%` }} />
              </button>
            ))}
          </article>
        ))}
      </div>
      <article className="sa2-depth-card sa2-receipt-strip">
        <Head label="OUTPUT RECEIPT" title="CONV-9821" badge="处理中" />
        <span>
          Input <b>RAW-88421</b>
        </span>
        <i>→</i>
        <span>
          Profile <b>pdf-evidence-v3</b>
        </span>
        <i>→</i>
        <span>
          Worker <b>worker-convert-07</b>
        </span>
        <i>→</i>
        <span>
          Output <b>等待 receipt</b>
        </span>
      </article>
    </Shell>
  );
}

function Evidence({ onAction }: KnowledgePagesProps) {
  const [selectedId, setSelectedId] = useState<string>(evidenceRows[0].id);
  const selected = evidenceRows.find((item) => item.id === selectedId) ?? evidenceRows[0];
  return (
    <Shell
      pageId="evidence"
      eyebrow="EVIDENCE REVIEW"
      title="证据审核"
      description="逐条核对原文定位、转换结果和审核历史；批准不会自动改变 Capability 或平台 canon。"
    >
      <div className="sa2-evidence-workspace">
        <aside className="sa2-depth-card">
          <Head label="REVIEW QUEUE" title="18 条待审核" />
          {evidenceRows.map((row) => (
            <button
              className={row.id === selected.id ? 'is-active' : ''}
              key={row.id}
              onClick={() => setSelectedId(row.id)}
            >
              <span>
                <strong>{row.title}</strong>
                <small>
                  {row.id} · {row.source}
                </small>
              </span>
              <u>{row.status}</u>
            </button>
          ))}
        </aside>
        <article
          className="sa2-depth-card sa2-document-preview"
          data-testid="knowledge-evidence-detail"
        >
          <Head
            label={`EXACT LOCATOR · ${selected.id}`}
            title={selected.locator}
            badge={selected.page}
          />
          <div className="sa2-paper">
            <p>{selected.quote}</p>
            <mark>{selected.candidate}</mark>
            <small>source_sha256: {selected.digest}</small>
          </div>
          <div className="sa2-review-history">
            <b>审核历史</b>
            <span>10:18 · 转换完成 · worker-convert-07</span>
            <span>10:22 · 自动 locator 校验通过</span>
            <span>未作正式批准</span>
          </div>
        </article>
        <aside className="sa2-depth-card sa2-review-form">
          <Head label="REVIEW DECISION" title="审核结论" />
          <label>
            定位准确性
            <select>
              <option>准确</option>
              <option>需修正</option>
            </select>
          </label>
          <label>
            来源当前性
            <select>
              <option>当前</option>
              <option>已过期</option>
            </select>
          </label>
          <label>
            审核说明
            <textarea defaultValue="Locator 与原文一致；保留适用范围限定。" />
          </label>
          <div className="sa2-callout warning">
            <b>治理边界</b>
            <span>这是证据供应审核，不是 Capability 验证或 canon mutation。</span>
          </div>
          <button className="sa2-button" onClick={() => onAction(`批准证据 ${selected.id}`, true)}>
            批准证据
          </button>
          <button onClick={() => onAction(`退回证据 ${selected.id}`, true)}>退回修订</button>
        </aside>
      </div>
    </Shell>
  );
}

function Search({ query, setQuery, onAction }: KnowledgePagesProps) {
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [sources, setSources] = useState(() => new Set(['EUIPO', 'CNIPA', 'USPTO', 'WIPO']));
  const results = useMemo(() => {
    const needle = submittedQuery.trim().toLowerCase();
    return knowledgeHits.filter(
      (hit) =>
        sources.has(hit.source) &&
        (!needle ||
          `${hit.id} ${hit.title} ${hit.source} ${hit.locator} ${hit.summary}`
            .toLowerCase()
            .includes(needle))
    );
  }, [sources, submittedQuery]);
  return (
    <Shell
      pageId="search"
      eyebrow="CITED RETRIEVAL"
      title="知识检索"
      description="按来源、辖区和当前性检索可引用知识，结果始终携带精确 locator。"
    >
      <div className="sa2-search-workspace">
        <aside className="sa2-depth-card">
          <Head label="FACETS" title="过滤结果" />
          {['EUIPO', 'CNIPA', 'USPTO', 'WIPO'].map((source) => (
            <label key={source}>
              <input
                type="checkbox"
                checked={sources.has(source)}
                onChange={(event) => {
                  const next = new Set(sources);
                  if (event.target.checked) next.add(source);
                  else next.delete(source);
                  setSources(next);
                }}
              />
              {source} · {knowledgeHits.filter((hit) => hit.source === source).length}
            </label>
          ))}
          <hr />
          <label>
            <input type="checkbox" defaultChecked />
            仅当前版本
          </label>
          <label>
            <input type="checkbox" />
            包括历史版本
          </label>
        </aside>
        <article>
          <div className="sa2-knowledge-search">
            <input
              aria-label="知识检索词"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：非显著性标志的整体判断"
            />
            <button
              onClick={() => {
                setSubmittedQuery(query);
                onAction('在本地 Demo 知识集中执行带引用检索');
              }}
            >
              检索
            </button>
          </div>
          <p className="sa2-result-count">
            {results.length} 条演示结果 · 本地确定性 fixture · 检索不会修改知识状态
          </p>
          {results.map((row, index) => (
            <article className="sa2-depth-card sa2-search-hit" key={row.id}>
              <span>{index + 1}</span>
              <div>
                <h4>{row.title}</h4>
                <p>{row.summary}</p>
                <button onClick={() => onAction(`在本地打开 Demo 来源 ${row.locator}`)}>
                  {row.locator}
                </button>
              </div>
              <u>{row.currentness}</u>
            </article>
          ))}
          {!results.length && (
            <article
              className="sa2-depth-card sa2-inline-empty"
              data-testid="knowledge-search-empty"
            >
              <h4>没有匹配的演示知识</h4>
              <p>查询词和来源筛选已执行；0 条结果不会显示预置命中。</p>
            </article>
          )}
        </article>
      </div>
    </Shell>
  );
}

function Packages({ onAction }: KnowledgePagesProps) {
  const [selectedId, setSelectedId] = useState('RPK-4164');
  const selected = readyPackages.find((item) => item.id === selectedId) ?? readyPackages[0];
  return (
    <Shell
      pageId="packages"
      eyebrow="READY PACKAGE DELIVERY"
      title="Ready Packages"
      description="管理 manifest、交付目标、receipt 与对账状态；Ready 不等于下游接受或正式生效。"
      action={
        <button className="sa2-button" onClick={() => onAction('创建 Ready Package', true)}>
          组装 Package
        </button>
      }
    >
      <div className="sa2-package-kanban">
        {[
          ['Preparing', '8'],
          ['Ready', '18'],
          ['Delivering', '3'],
          ['Reconciled', '297']
        ].map((lane) => (
          <article key={lane[0]}>
            <header>
              <span>{lane[0]}</span>
              <b>{lane[1]}</b>
            </header>
            {readyPackages
              .filter((item) => item.lane === lane[0])
              .map((item, card) => (
                <button
                  key={item.id}
                  className={item.id === selected.id ? 'is-active' : ''}
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{item.id}</strong>
                  <small>{['EUIPO distinctiveness', 'CN examination practice'][card]}</small>
                  <dl>
                    <div>
                      <dt>证据</dt>
                      <dd>{item.evidence}</dd>
                    </div>
                    <div>
                      <dt>目标</dt>
                      <dd>{item.target}</dd>
                    </div>
                  </dl>
                  <u>{item.receipt}</u>
                </button>
              ))}
          </article>
        ))}
      </div>
      <article className="sa2-depth-card sa2-delivery-line" data-testid="knowledge-package-detail">
        <Head label="DELIVERY DETAIL" title={selected.id} badge={selected.receipt} />
        <span>Manifest 已冻结</span>
        <i>→</i>
        <span>{selected.evidence} evidence items</span>
        <i>→</i>
        <span>{selected.target}</span>
        <i>→</i>
        <b>{selected.receipt}</b>
        <button onClick={() => onAction(`在本地刷新 ${selected.id} 的 Demo receipt`)}>
          模拟刷新 receipt
        </button>
      </article>
    </Shell>
  );
}

function SupplyHealth({ onAction }: KnowledgePagesProps) {
  const cols = ['法规', '公告', '审查手册', '裁决'];
  const rows = ['CN', 'US', 'EU', 'WO'];
  return (
    <Shell
      pageId="supply-health"
      eyebrow="SOURCE SUPPLY HEALTH"
      title="供应健康"
      description="用来源 × 辖区热力图观察 SLA、新鲜度和失败隔离，不把无数据误判为健康。"
    >
      <div className="sa2-health-layout">
        <article className="sa2-depth-card">
          <Head label="CURRENTNESS HEATMAP" title="来源供应矩阵" badge="过去 24 小时" />
          <div className="sa2-health-matrix">
            <span />
            {cols.map((col) => (
              <b key={col}>{col}</b>
            ))}
            {rows.flatMap((row, r) => [
              <strong key={row}>{row}</strong>,
              ...cols.map((col, c) => (
                <button
                  className={
                    (r === 3 && c < 2) || (r === 0 && c === 3)
                      ? 'bad'
                      : r === 2 && c === 1
                        ? 'warn'
                        : 'good'
                  }
                  key={`${row}-${col}`}
                  onClick={() => onAction(`查看 ${row} ${col} 供应详情`)}
                >
                  <b>{r === 3 && c < 2 ? '—' : `${98 - r * 4 - c}%`}</b>
                  <small>{r === 3 && c < 2 ? '未建模' : `${6 + r * 8 + c}m`}</small>
                </button>
              ))
            ])}
          </div>
        </article>
        <article className="sa2-depth-card">
          <Head label="SLA & ISOLATION" title="异常来源" badge="3 attention" />
          {[
            ['WIPO Madrid notices', '超过 SLA 2h', '隔离中'],
            ['CNIPA decisions', '缺少安全 API', '未建模'],
            ['EUIPO Gazette', '新鲜度 87%', '观察']
          ].map((row) => (
            <button className="sa2-health-alert" key={row[0]}>
              <i />
              <span>
                <strong>{row[0]}</strong>
                <small>{row[1]}</small>
              </span>
              <u>{row[2]}</u>
            </button>
          ))}
          <div className="sa2-callout">
            <b>缺失 ≠ 零</b>
            <span>未接入或无权限的 owner 数据单独显示，不纳入健康率。</span>
          </div>
        </article>
      </div>
    </Shell>
  );
}
