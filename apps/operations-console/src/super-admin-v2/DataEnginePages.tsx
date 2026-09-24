import type { DemoRecord } from './fixtures.js';

export const DATA_ENGINE_PAGE_IDS = [
  'overview',
  'coverage',
  'sources',
  'packages',
  'jobs',
  'query',
  'storage',
  'settings'
] as const;

interface DataEnginePagesProps {
  pageId: string;
  records: readonly DemoRecord[];
  query: string;
  setQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  onSelect: (record: DemoRecord) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}

const runs = [
  ['RUN-CN-8821', 'CNIPA 公告增量', '等待审核', '72%', 'CP-88421'],
  ['RUN-US-9914', 'USPTO TSDR 同步', '运行中', '46%', 'CP-99104'],
  ['RUN-EU-7712', 'EUIPO 商标回填', '已完成', '100%', 'CP-77120'],
  ['RUN-WO-5531', 'WIPO Madrid 解析', '失败', '63%', 'CP-55318']
] as const;

const packages = [
  ['PKG-CN-2409', 'CN · Gazette', '18.4 GB', '98.7%', '需关注'],
  ['PKG-US-2409', 'US · Case files', '42.1 GB', '99.6%', 'Ready'],
  ['PKG-EU-2409', 'EU · Open data', '27.8 GB', '99.1%', 'Ready'],
  ['PKG-WO-2408', 'Global · Madrid', '8.2 GB', '96.4%', '降级']
] as const;

export function DataEnginePages(props: DataEnginePagesProps) {
  switch (props.pageId) {
    case 'coverage':
      return <CoveragePage {...props} />;
    case 'sources':
      return <SourcesPage {...props} />;
    case 'packages':
      return <PackagesPage {...props} />;
    case 'jobs':
      return <JobsPage {...props} />;
    case 'query':
      return <QueryPage {...props} />;
    case 'storage':
      return <StoragePage {...props} />;
    case 'settings':
      return <SettingsPage {...props} />;
    default:
      return <OverviewPage {...props} />;
  }
}

function PageShell({
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
    <section className="sa2-depth" data-testid={`data-page-${pageId}`}>
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

function OverviewPage({ records, onSelect }: DataEnginePagesProps) {
  return (
    <PageShell
      pageId="overview"
      eyebrow="DOMAIN CONTROL PLANE"
      title="数据域运行总览"
      description="按司法辖区汇总覆盖、任务推进和质量风险；异常不会被平均值隐藏。"
    >
      <div className="sa2-depth-grid sa2-depth-grid--overview">
        <article className="sa2-depth-card sa2-domain-map">
          <CardTitle label="DOMAIN PROGRESS" title="司法辖区推进" badge="Owner snapshot" />
          {records.map((record, index) => (
            <button key={record.id} onClick={() => onSelect(record)}>
              <b>{['CN', 'US', 'EU', 'WO'][index]}</b>
              <span>
                <strong>{record.name}</strong>
                <small>{record.freshness}</small>
              </span>
              <i>
                <em style={{ width: `${92 - index * 7}%` }} />
              </i>
              <u>{record.status}</u>
            </button>
          ))}
        </article>
        <article className="sa2-depth-card">
          <CardTitle label="ATTENTION" title="需要处理" badge="3 items" />
          <Timeline
            items={[
              ['10:42', 'CNIPA 增量等待 plan approval', '受保护'],
              ['10:18', 'WIPO parser 连续失败 3 次', '阻断'],
              ['09:56', 'US package 校验完成', '正常']
            ]}
          />
        </article>
        <article className="sa2-depth-card sa2-ledger">
          <CardTitle label="PIPELINE" title="今日流水线" />
          {['发现', '采集', '规范化', '校验', '发布'].map((step, index) => (
            <div key={step}>
              <span>{index + 1}</span>
              <b>{step}</b>
              <small>{[12, 8, 6, 5, 3][index]} 批次</small>
            </div>
          ))}
        </article>
      </div>
    </PageShell>
  );
}

function CoveragePage({ records, onSelect }: DataEnginePagesProps) {
  const columns = ['案件', '事件', '权利人', '图样', '分类'];
  return (
    <PageShell
      pageId="coverage"
      eyebrow="COVERAGE MATRIX"
      title="数据覆盖矩阵"
      description="从国家、对象类型和时间范围识别真实缺口，并保留每格的新鲜度来源。"
    >
      <div className="sa2-depth-card sa2-matrix-wrap">
        <div className="sa2-matrix-toolbar">
          <b>4 个司法辖区</b>
          <span>时间范围：2012–至今</span>
          <button>导出缺口清单</button>
        </div>
        <div className="sa2-coverage-matrix" role="table" aria-label="数据覆盖矩阵">
          <div className="head">辖区</div>
          {columns.map((item) => (
            <div className="head" key={item}>
              {item}
            </div>
          ))}
          {records.flatMap((record, row) => [
            <button
              className="country"
              key={`${record.id}-country`}
              onClick={() => onSelect(record)}
            >
              <b>{['CN', 'US', 'EU', 'WO'][row]}</b>
              <span>{record.freshness}</span>
            </button>,
            ...columns.map((column, col) => (
              <div
                key={`${record.id}-${column}`}
                className={(row === 3 && col > 2) || (row === 0 && col === 3) ? 'gap' : 'covered'}
              >
                <b>{(99.8 - row * 0.8 - col * 0.2).toFixed(1)}%</b>
                <small>{row === 0 && col === 3 ? '缺 18h' : '已覆盖'}</small>
              </div>
            ))
          ])}
        </div>
      </div>
    </PageShell>
  );
}

function SourcesPage({ records, onSelect, onAction }: DataEnginePagesProps) {
  return (
    <PageShell
      pageId="sources"
      eyebrow="SOURCE CONNECTIONS"
      title="数据源连接"
      description="管理连接方式、抓取节奏和凭证存在性；密钥值永不在此页回显。"
      action={
        <button className="sa2-button" onClick={() => onAction('登记数据源', true)}>
          ＋ 登记数据源
        </button>
      }
    >
      <div className="sa2-source-workspace">
        <div className="sa2-source-rail">
          <label>
            连接类型
            <select>
              <option>全部类型</option>
              <option>API</option>
              <option>文件投递</option>
            </select>
          </label>
          <label>
            司法辖区
            <select>
              <option>全球</option>
              <option>CN</option>
              <option>US</option>
            </select>
          </label>
          <div>
            <b>凭证状态</b>
            <span>4 已配置</span>
            <span>1 将到期</span>
          </div>
        </div>
        <div className="sa2-connection-list">
          {records.map((record, index) => (
            <article key={record.id}>
              <button className="sa2-connection-main" onClick={() => onSelect(record)}>
                <span className="sa2-source-mark">{['CN', 'US', 'EU', 'WO'][index]}</span>
                <span>
                  <strong>{record.name}</strong>
                  <small>{index % 2 ? 'REST API · OAuth client' : 'SFTP · Manifest file'}</small>
                </span>
              </button>
              <dl>
                <div>
                  <dt>节奏</dt>
                  <dd>{index === 0 ? '每 30 分钟' : '每日 02:00 UTC'}</dd>
                </div>
                <div>
                  <dt>最近握手</dt>
                  <dd>{record.freshness}</dd>
                </div>
                <div>
                  <dt>凭证</dt>
                  <dd>已配置 · 不可见</dd>
                </div>
              </dl>
              <button onClick={() => onAction(`${record.name} 连接测试`)}>测试连接</button>
            </article>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function PackagesPage({ query, setQuery, onAction }: DataEnginePagesProps) {
  const visible = packages.filter((item) =>
    item.join(' ').toLowerCase().includes(query.toLowerCase())
  );
  return (
    <PageShell
      pageId="packages"
      eyebrow="PACKAGE INVENTORY"
      title="数据包工作区"
      description="检查包清单、内部文件、质量问题与可恢复阶段；包状态不等同于 Official Truth。"
      action={
        <button
          className="sa2-button sa2-button--secondary"
          onClick={() => onAction('导出 package manifest')}
        >
          导出 Manifest
        </button>
      }
    >
      <div className="sa2-split-workspace">
        <article className="sa2-depth-card">
          <div className="sa2-inline-search">
            <input
              aria-label="搜索数据包"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 package ID 或辖区"
            />
            <select>
              <option>全部质量状态</option>
              <option>Ready</option>
              <option>需关注</option>
            </select>
          </div>
          <div className="sa2-package-list">
            {visible.map((item, index) => (
              <button key={item[0]} className={index === 0 ? 'is-active' : ''}>
                <span>
                  <strong>{item[0]}</strong>
                  <small>{item[1]}</small>
                </span>
                <span>{item[2]}</span>
                <span>{item[3]}</span>
                <u>{item[4]}</u>
              </button>
            ))}
          </div>
        </article>
        <article className="sa2-depth-card sa2-package-detail">
          <CardTitle label="PACKAGE DETAIL" title="PKG-CN-2409" badge="需关注" />
          <dl>
            <div>
              <dt>内容范围</dt>
              <dd>2026-09-23 Gazette delta</dd>
            </div>
            <div>
              <dt>校验摘要</dt>
              <dd>1,284,532 records · 28 rejected</dd>
            </div>
            <div>
              <dt>Checkpoint</dt>
              <dd>CP-88421</dd>
            </div>
          </dl>
          <h4>内部文件</h4>
          {[
            'manifest.json · 12 KB',
            'applications.parquet · 12.8 GB',
            'events.parquet · 5.6 GB'
          ].map((file) => (
            <p className="sa2-file-row" key={file}>
              {file}
              <button>查看元数据</button>
            </p>
          ))}
          <div className="sa2-callout warning">
            <b>28 条质量问题</b>
            <span>需由 owner 修复或接受，不在聚合后台直接改写。</span>
          </div>
        </article>
      </div>
    </PageShell>
  );
}

function JobsPage({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  onAction
}: DataEnginePagesProps) {
  const visible = runs.filter(
    (run) =>
      (statusFilter === '全部状态' || run[2] === statusFilter) &&
      run.join(' ').toLowerCase().includes(query.toLowerCase())
  );
  return (
    <PageShell
      pageId="jobs"
      eyebrow="DURABLE RUN CONTROL"
      title="任务与调度中心"
      description="以冻结计划、单次审批、检查点和可恢复日志管理 owner 任务；演示不会派发真实运行。"
      action={
        <button className="sa2-button" onClick={() => onAction('创建 Data Engine 任务', true)}>
          ＋ 创建任务
        </button>
      }
    >
      <div className="sa2-jobs-toolbar">
        <input
          aria-label="搜索运行"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="运行 ID / 任务名"
        />
        <select
          aria-label="运行状态"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option>全部状态</option>
          <option>运行中</option>
          <option>等待审核</option>
          <option>已完成</option>
          <option>失败</option>
        </select>
        <button onClick={() => onAction('刷新任务快照')}>刷新 owner 快照</button>
      </div>
      <div className="sa2-job-console">
        <article className="sa2-depth-card sa2-run-list">
          {visible.map((run, index) => (
            <button key={run[0]} className={index === 0 ? 'is-active' : ''}>
              <span className={`sa2-run-state s${index}`} />
              <span>
                <strong>{run[1]}</strong>
                <small>
                  {run[0]} · {run[4]}
                </small>
              </span>
              <i>
                <em style={{ width: run[3] }} />
              </i>
              <u>{run[2]}</u>
            </button>
          ))}
        </article>
        <article className="sa2-depth-card sa2-run-detail">
          <CardTitle label="FROZEN PLAN" title="RUN-CN-8821" badge="等待审核" />
          <div className="sa2-plan-hash">
            <span>Plan SHA-256</span>
            <code>63c7…a884</code>
            <b>范围已冻结</b>
          </div>
          <div className="sa2-checkpoints">
            <h4>阶段与检查点</h4>
            {[
              ['Fetch', '完成', '18,420'],
              ['Normalize', '完成', '18,392'],
              ['Validate', '暂停', '18,364'],
              ['Publish', '未开始', '—']
            ].map((step, index) => (
              <div key={step[0]}>
                <span>{index + 1}</span>
                <b>{step[0]}</b>
                <small>{step[2]} records</small>
                <u>{step[1]}</u>
              </div>
            ))}
          </div>
          <div className="sa2-console-log" aria-label="最近运行日志">
            <code>10:42:18 checkpoint CP-88421 persisted</code>
            <code>10:42:19 plan requires explicit approval</code>
            <code>10:42:19 no owner mutation dispatched</code>
          </div>
          <div className="sa2-action-row">
            <button className="sa2-button" onClick={() => onAction('批准冻结计划并继续', true)}>
              审核并继续
            </button>
            <button
              className="sa2-button sa2-button--secondary"
              onClick={() => onAction('从检查点恢复运行', true)}
            >
              从检查点恢复
            </button>
          </div>
        </article>
      </div>
    </PageShell>
  );
}

function QueryPage({ onAction }: DataEnginePagesProps) {
  return (
    <PageShell
      pageId="query"
      eyebrow="SOURCE-FACT QUERY"
      title="数据查询实验台"
      description="按辖区与对象字段构造只读查询，并保留命中来源、版本与未命中的区别。"
    >
      <div className="sa2-query-builder">
        <article className="sa2-depth-card">
          <CardTitle label="QUERY BUILDER" title="案件检索条件" />
          <label>
            司法辖区
            <select>
              <option>US · USPTO</option>
              <option>CN · CNIPA</option>
            </select>
          </label>
          <label>
            查询字段
            <select>
              <option>Application number</option>
              <option>Mark text</option>
              <option>Owner name</option>
            </select>
          </label>
          <label>
            查询值
            <input defaultValue="87342156" />
          </label>
          <label>
            事件时间
            <select>
              <option>不限</option>
              <option>最近 12 个月</option>
            </select>
          </label>
          <button className="sa2-button" onClick={() => onAction('执行只读数据查询')}>
            执行只读查询
          </button>
        </article>
        <article className="sa2-depth-card sa2-query-result">
          <CardTitle label="1 MATCH · 128 MS" title="案件 US-87342156" badge="Source fact" />
          <h4>MARKORBIT</h4>
          <p>Word mark · Class 42 · LIVE</p>
          <dl>
            <div>
              <dt>申请人</dt>
              <dd>Acme Technology Co.</dd>
            </div>
            <div>
              <dt>申请日</dt>
              <dd>2016-07-18</dd>
            </div>
            <div>
              <dt>最近事件</dt>
              <dd>Maintenance accepted</dd>
            </div>
            <div>
              <dt>来源版本</dt>
              <dd>USPTO TSDR · 2026-09-24T02:00Z</dd>
            </div>
          </dl>
          <div className="sa2-callout">
            <b>读取边界</b>
            <span>这是 owner source-fact 投影，不被标记为平台 Official Truth。</span>
          </div>
        </article>
      </div>
    </PageShell>
  );
}

function StoragePage({ onAction }: DataEnginePagesProps) {
  return (
    <PageShell
      pageId="storage"
      eyebrow="STORAGE TOPOLOGY"
      title="存储与原始库存"
      description="观察 PostgreSQL、ClickHouse 与 raw inventory 的容量、分区和保留策略；不提供聚合层删除。"
    >
      <div className="sa2-storage-grid">
        {[
          ['PostgreSQL', 'Operational metadata', '68%', '412 GB / 600 GB'],
          ['ClickHouse', 'Search & analytics', '74%', '8.9 TB / 12 TB'],
          ['Raw object store', 'Immutable source files', '51%', '24.6 TB / 48 TB']
        ].map((item) => (
          <article className="sa2-depth-card" key={item[0]}>
            <span className="sa2-storage-icon">▱</span>
            <h3>{item[0]}</h3>
            <p>{item[1]}</p>
            <div className="sa2-capacity">
              <i>
                <em style={{ width: item[2] }} />
              </i>
              <b>{item[2]}</b>
            </div>
            <small>{item[3]}</small>
            <button onClick={() => onAction(`查看 ${item[0]} 分区`)}>查看分区</button>
          </article>
        ))}
      </div>
      <article className="sa2-depth-card sa2-partitions">
        <CardTitle label="RAW INVENTORY" title="最近分区" badge="只读" />
        <div className="sa2-simple-table">
          <b>路径</b>
          <b>对象数</b>
          <b>大小</b>
          <b>保留策略</b>
          {[
            ['raw/cn/2026/09/23', '18,420', '18.4 GB', 'Immutable'],
            ['raw/us/2026/09/23', '41,882', '42.1 GB', '7 years'],
            ['raw/eu/2026/09/22', '28,204', '27.8 GB', '7 years']
          ].flatMap((row) => row.map((cell) => <span key={`${row[0]}-${cell}`}>{cell}</span>))}
        </div>
      </article>
    </PageShell>
  );
}

function SettingsPage({ onAction }: DataEnginePagesProps) {
  return (
    <PageShell
      pageId="settings"
      eyebrow="COMPONENT GOVERNANCE"
      title="Data Engine 系统设置"
      description="核对组件版本、只读运行参数与变更边界；配置变更由 owner 审批执行。"
      action={
        <button
          className="sa2-button"
          onClick={() => onAction('提交 Data Engine 配置变更申请', true)}
        >
          提交变更申请
        </button>
      }
    >
      <div className="sa2-settings-layout">
        <nav className="sa2-settings-nav" aria-label="设置分组">
          <button className="is-active">组件版本</button>
          <button>运行参数</button>
          <button>保留策略</button>
          <button>访问边界</button>
        </nav>
        <article className="sa2-depth-card sa2-config-list">
          <CardTitle label="READ-ONLY SNAPSHOT" title="组件与版本" badge="Owner managed" />
          {[
            ['ingestion-api', 'v2.14.3', 'Healthy'],
            ['normalizer-worker', 'v4.8.1', 'Healthy'],
            ['package-builder', 'v3.2.0', 'Degraded'],
            ['query-service', 'v1.19.6', 'Healthy']
          ].map((row) => (
            <div key={row[0]}>
              <span>
                <strong>{row[0]}</strong>
                <small>Data Engine owner</small>
              </span>
              <code>{row[1]}</code>
              <u>{row[2]}</u>
              <button onClick={() => onAction(`查看 ${row[0]} 变更历史`)}>历史</button>
            </div>
          ))}
          <div className="sa2-callout warning">
            <b>没有直接保存</b>
            <span>此聚合后台只提交带审计上下文的变更申请，不绕过 owner 配置治理。</span>
          </div>
        </article>
      </div>
    </PageShell>
  );
}

function CardTitle({ label, title, badge }: { label: string; title: string; badge?: string }) {
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

function Timeline({ items }: { items: readonly (readonly [string, string, string])[] }) {
  return (
    <div className="sa2-mini-timeline">
      {items.map((item) => (
        <div key={item[0]}>
          <time>{item[0]}</time>
          <span>
            <b>{item[1]}</b>
            <small>{item[2]}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
