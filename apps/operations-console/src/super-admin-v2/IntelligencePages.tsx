import { useEffect, useMemo, useState } from 'react';
import type { ModuleId } from './catalog.js';

export const BATCH_C_PAGE_IDS = {
  brain: [
    'overview',
    'models',
    'orchestration',
    'routing',
    'prompts',
    'runs',
    'quality',
    'cost',
    'settings'
  ],
  capabilities: [
    'overview',
    'catalog',
    'skills',
    'agents',
    'tools',
    'evaluation',
    'runs',
    'versions',
    'permissions'
  ]
} as const;

type BatchCModule = Extract<ModuleId, 'brain' | 'capabilities'>;
type IntelVariant =
  | 'brain-map'
  | 'models'
  | 'orchestration'
  | 'routing'
  | 'prompts'
  | 'brain-runs'
  | 'quality'
  | 'cost'
  | 'settings'
  | 'domain-map'
  | 'catalog'
  | 'hierarchy'
  | 'agents'
  | 'tools'
  | 'evaluation'
  | 'evidence'
  | 'lineage'
  | 'permissions';

interface IntelObject {
  id: string;
  name: string;
  kind: string;
  status: string;
  meta: string;
  fields: readonly (readonly [string, string])[];
  chain: readonly string[];
  evidence: readonly string[];
}
interface IntelPage {
  eyebrow: string;
  title: string;
  description: string;
  objectLabel: string;
  variant: IntelVariant;
  facts: readonly (readonly [string, string, string])[];
  action: string;
  protected?: boolean;
  objects: readonly IntelObject[];
}
interface IntelligencePagesProps {
  moduleId: BatchCModule;
  pageId: string;
  query: string;
  setQuery: (value: string) => void;
  onAction: (label: string, protectedAction?: boolean) => void;
}

const x = (
  id: string,
  name: string,
  kind: string,
  status: string,
  meta: string,
  fields: readonly (readonly [string, string])[],
  chain: readonly string[],
  evidence: readonly string[]
): IntelObject => ({ id, name, kind, status, meta, fields, chain, evidence });

const brainObjects = {
  routes: [
    x(
      'BR-12',
      'Professional analysis route',
      'Model route',
      '正常',
      'P95 2.3s · 98.8%',
      [
        ['Primary', 'GPT-4.1'],
        ['Fallback', 'Claude 3.7'],
        ['Budget', '$0.18 / run'],
        ['Capability', 'CAP-ANALYZE-001']
      ],
      ['Request policy', 'CAP-ANALYZE-001', 'GPT-4.1', 'Critic evaluation'],
      ['route decision rd-8821', 'provider receipt pr-118']
    ),
    x(
      'BR-18',
      'Knowledge summarization route',
      'Model route',
      '降级',
      'P95 4.8s · 94.2%',
      [
        ['Primary', 'Claude 3.7'],
        ['Fallback', 'Gemini 2.5'],
        ['Budget', '$0.08 / run'],
        ['Capability', 'CAP-EVIDENCE-SUMMARY']
      ],
      ['Evidence input', 'CAP-EVIDENCE-SUMMARY', 'Claude 3.7', 'Fallback Gemini'],
      ['route decision rd-8814', 'timeout evidence te-42']
    ),
    x(
      'BR-22',
      'Fast classification route',
      'Model route',
      '正常',
      'P95 680ms · 99.6%',
      [
        ['Primary', 'GPT-4.1 mini'],
        ['Fallback', 'Local classifier'],
        ['Budget', '$0.01 / run'],
        ['Capability', 'CAP-CLASSIFY-008']
      ],
      ['Input guard', 'CAP-CLASSIFY-008', 'Mini model', 'Schema validator'],
      ['route decision rd-8798', 'schema receipt sr-19']
    )
  ],
  models: [
    x(
      'MOD-GPT41',
      'GPT-4.1',
      'Provider model',
      '可用',
      'OpenAI · text+vision',
      [
        ['Context', '1M'],
        ['Region', 'US/EU'],
        ['Data policy', 'No training'],
        ['Unit cost', '$2 / $8']
      ],
      ['Provider OpenAI', 'Credential CRED-OAI-18', 'Route policies 8'],
      ['health probe hp-118', 'evaluation EV-882']
    ),
    x(
      'MOD-CLD37',
      'Claude 3.7 Sonnet',
      'Provider model',
      '可用',
      'Anthropic · text',
      [
        ['Context', '200K'],
        ['Region', 'US'],
        ['Data policy', 'No training'],
        ['Unit cost', '$3 / $15']
      ],
      ['Provider Anthropic', 'Credential CRED-ANT-04', 'Route policies 6'],
      ['health probe hp-114', 'evaluation EV-879']
    ),
    x(
      'MOD-LOCAL',
      'MO classifier v6',
      'Owned model',
      '受限',
      'Local · classification',
      [
        ['Context', '8K'],
        ['Region', 'Local'],
        ['Version', 'v6.2'],
        ['Unit cost', 'Internal']
      ],
      ['Model registry', 'Artifact sha256:82a…', 'Route BR-22'],
      ['model card mc-6', 'evaluation EV-861']
    )
  ],
  runs: [
    x(
      'BRUN-8821',
      'Matter opportunity analysis',
      'Brain run',
      '已完成',
      '2.18s · $0.14',
      [
        ['Workspace', 'WSP-ACME'],
        ['Route', 'BR-12'],
        ['Model', 'GPT-4.1'],
        ['Capability', 'CAP-ANALYZE-001']
      ],
      [
        'Input guard',
        'Capability CAP-ANALYZE-001',
        'Route BR-12',
        'Provider call',
        'Critic CAP-QUALITY-004'
      ],
      ['prompt pv-42', 'route decision rd-8821', 'provider receipt pr-118', 'critic score 0.94']
    ),
    x(
      'BRUN-8814',
      'Evidence summary',
      'Brain run',
      '降级完成',
      '4.92s · $0.09',
      [
        ['Workspace', 'WSP-SUNRISE'],
        ['Route', 'BR-18'],
        ['Model', 'Gemini fallback'],
        ['Capability', 'CAP-EVIDENCE-SUMMARY']
      ],
      [
        'Evidence locator',
        'Capability CAP-EVIDENCE-SUMMARY',
        'Primary timeout',
        'Fallback Gemini',
        'Schema valid'
      ],
      ['prompt pv-18', 'timeout te-42', 'fallback receipt fr-82']
    ),
    x(
      'BRUN-8808',
      'Trademark classification',
      'Brain run',
      '失败',
      '1.12s · $0.01',
      [
        ['Workspace', 'WSP-GLOBAL'],
        ['Route', 'BR-22'],
        ['Model', 'Local classifier'],
        ['Capability', 'CAP-CLASSIFY-008']
      ],
      ['Input guard', 'Capability CAP-CLASSIFY-008', 'Model output', 'Schema rejected'],
      ['prompt pv-11', 'schema error se-18']
    )
  ]
};

const capabilityObjects = {
  catalog: [
    x(
      'CAP-ANALYZE-001',
      'Analyze trademark opportunity',
      'Capability',
      'Verified v3.2',
      'Domain: Strategy',
      [
        ['Outcome contract', 'Opportunity assessment'],
        ['Primary', 'Market analysis'],
        ['Supporting', 'Evidence retrieval, Risk scan'],
        ['Critic', 'Quality review']
      ],
      ['Domain Strategy', 'Capability CAP-ANALYZE-001', 'Skills 4', 'Actions 12'],
      ['Contract OC-118', 'Implementation IMP-42', 'Evaluation EV-882', 'Run BRUN-8821']
    ),
    x(
      'CAP-EVIDENCE-SUMMARY',
      'Summarize governed evidence',
      'Capability',
      'Verified v2.4',
      'Domain: Knowledge',
      [
        ['Outcome contract', 'Cited evidence summary'],
        ['Primary', 'Evidence synthesis'],
        ['Supporting', 'Locator verification'],
        ['Critic', 'Citation review']
      ],
      ['Domain Knowledge', 'Capability CAP-EVIDENCE-SUMMARY', 'Skills 3', 'Actions 8'],
      ['Contract OC-104', 'Implementation IMP-31', 'Evaluation EV-879', 'Run BRUN-8814']
    ),
    x(
      'CAP-CLASSIFY-008',
      'Classify trademark goods',
      'Capability',
      'Candidate v1.8',
      'Domain: Classification',
      [
        ['Outcome contract', 'Suggested classes with rationale'],
        ['Primary', 'Goods classification'],
        ['Supporting', 'Knowledge lookup'],
        ['Critic', 'Schema validation']
      ],
      ['Domain Classification', 'Capability CAP-CLASSIFY-008', 'Skills 2', 'Actions 6'],
      ['Contract OC-92', 'Implementation IMP-28', 'Evaluation EV-861', 'Run BRUN-8808']
    )
  ],
  skills: [
    x(
      'SKL-MARKET-04',
      'Market signal analysis',
      'Skill',
      'Active v4.2',
      'Used by 3 capabilities',
      [
        ['Input', 'Market evidence set'],
        ['Output', 'Signal assessment'],
        ['Implementation', 'workflow: market-v4'],
        ['Owner', 'Capability']
      ],
      ['CAP-ANALYZE-001', 'Skill SKL-MARKET-04', 'Actions 4'],
      ['Skill spec SS-42', 'Test set TS-82', 'Runs 1,248']
    ),
    x(
      'SKL-LOCATOR-02',
      'Evidence locator verification',
      'Skill',
      'Active v2.1',
      'Used by 6 capabilities',
      [
        ['Input', 'Evidence + locator'],
        ['Output', 'Verified locator result'],
        ['Implementation', 'toolchain: locator-v2'],
        ['Owner', 'Capability']
      ],
      ['CAP-EVIDENCE-SUMMARY', 'Skill SKL-LOCATOR-02', 'Actions 3'],
      ['Skill spec SS-31', 'Test set TS-64', 'Runs 8,421']
    )
  ],
  agents: [
    x(
      'AGT-REVIEW-03',
      'Evidence Review Agent',
      'Agent implementation',
      'Active v3.1',
      'Knowledge workflows',
      [
        ['Capabilities', '2'],
        ['Tools', 'Knowledge retrieval, locator'],
        ['Prompt set', 'PS-18'],
        ['Authority', 'Advisory only']
      ],
      ['Agent AGT-REVIEW-03', 'CAP-EVIDENCE-SUMMARY', 'SKL-LOCATOR-02', 'Tool K-SEARCH'],
      ['Agent spec AS-18', 'Evaluation EV-879', 'Runs 682']
    ),
    x(
      'AGT-OPP-07',
      'Opportunity Analyst',
      'Agent implementation',
      'Active v2.8',
      'Lite workbench',
      [
        ['Capabilities', '3'],
        ['Tools', 'Market search, calculator'],
        ['Prompt set', 'PS-42'],
        ['Authority', 'Advisory only']
      ],
      ['Agent AGT-OPP-07', 'CAP-ANALYZE-001', 'SKL-MARKET-04', 'Brain route BR-12'],
      ['Agent spec AS-42', 'Evaluation EV-882', 'Runs 1,248']
    )
  ]
};

const page = (
  eyebrow: string,
  title: string,
  description: string,
  objectLabel: string,
  variant: IntelVariant,
  facts: readonly (readonly [string, string, string])[],
  action: string,
  objects: readonly IntelObject[],
  protectedAction = false
): IntelPage => ({
  eyebrow,
  title,
  description,
  objectLabel,
  variant,
  facts,
  action,
  objects,
  protected: protectedAction
});

const definitions: Record<BatchCModule, Record<string, IntelPage>> = {
  brain: {
    overview: page(
      'AI CONTROL PLANE',
      'Brain 运行总览',
      '聚合模型、路由、执行、质量、延迟与成本；不把模型输出提升为正式状态。',
      '路由',
      'brain-map',
      [
        ['路由', '24', '6 个能力域'],
        ['今日运行', '128K', '98.8% schema valid'],
        ['降级调用', '32', '有 fallback receipt'],
        ['预算', '74%', '非财务账本']
      ],
      '模拟刷新 Brain 快照',
      brainObjects.routes
    ),
    models: page(
      'MODEL REGISTRY',
      '模型管理',
      '管理 provider/owned model 的能力、区域、数据策略、评估和路由引用。',
      '模型',
      'models',
      [
        ['模型', '6', '3 providers'],
        ['可用', '5', 'Owner probe'],
        ['受限', '1', 'Local only'],
        ['待评估', '2', '版本更新']
      ],
      '登记模型候选',
      brainObjects.models,
      true
    ),
    orchestration: page(
      'ORCHESTRATION GRAPH',
      '智能编排',
      '检查请求如何通过 guard、Capability、模型路由、工具与 Critic。',
      '编排模板',
      'orchestration',
      [
        ['编排', '18', 'Versioned'],
        ['Capability 节点', '42', 'Canonical IDs'],
        ['Critic', '12', '显式配置'],
        ['无 Critic', '6', '风险标记']
      ],
      '创建编排草案',
      brainObjects.runs,
      true
    ),
    routing: page(
      'MODEL ROUTING',
      '路由策略',
      '按任务、区域、质量、延迟和预算选择 Primary 与 fallback，不隐藏降级。',
      '路由策略',
      'routing',
      [
        ['路由', '24', 'Versioned'],
        ['Primary 健康', '22', '2 degraded'],
        ['Fallback 就绪', '20', '4 missing'],
        ['策略冲突', '1', '待复核']
      ],
      '审阅路由变更',
      brainObjects.routes,
      true
    ),
    prompts: page(
      'PROMPT VERSIONING',
      'Prompt',
      '管理 Prompt 模板、变量、适用 Capability、版本与评估证据。',
      'Prompt 版本',
      'prompts',
      [
        ['Prompt sets', '36', 'Capability scoped'],
        ['Active', '28', '有评估'],
        ['Candidate', '6', 'A/B 中'],
        ['Deprecated', '2', '有迁移']
      ],
      '创建 Prompt 候选',
      brainObjects.runs.map((r, i) => ({
        ...r,
        id: `PRM-${[42, 18, 11][i]}`,
        name: ['Opportunity analysis prompt', 'Evidence summary prompt', 'Classification prompt'][
          i
        ]!,
        kind: 'Prompt version',
        status: ['Active v4.2', 'Active v1.8', 'Candidate v1.1'][i]!,
        meta: `Capability ${r.fields[3]?.[1]}`
      })),
      true
    ),
    runs: page(
      'BRAIN EXECUTION LEDGER',
      '执行记录',
      '逐次查看输入 guard、Capability 调用、路由选择、provider receipt 与 Critic 结果。',
      'Brain 执行',
      'brain-runs',
      [
        ['今日运行', '128K', 'Receipts'],
        ['成功', '98%', 'Schema valid'],
        ['降级', '32', 'Fallback used'],
        ['失败', '18', 'Evidence retained']
      ],
      '导出运行证据',
      brainObjects.runs
    ),
    quality: page(
      'QUALITY EVALUATION',
      '质量评估',
      '按 Capability 和路由查看评估集、Critic、一致性与回归差异。',
      '质量评估',
      'quality',
      [
        ['评估集', '18', 'Versioned'],
        ['通过', '16', 'Threshold met'],
        ['回归', '2', 'Candidate blocked'],
        ['人工复核', '42', 'Sampled']
      ],
      '运行 Demo 评估',
      brainObjects.routes.map((r, i) => ({
        ...r,
        id: `EV-${[882, 879, 861][i]}`,
        name: `${r.name} evaluation`,
        kind: 'Evaluation',
        status: ['通过 94%', '需关注 86%', '回归 78%'][i]!,
        meta: `Dataset v${4 - i} · 1,200 cases`
      }))
    ),
    cost: page(
      'AI COST OBSERVABILITY',
      '成本分析',
      '展示 provider 计量、路由估算与预算；不作为财务 owner 账本。',
      '成本流',
      'cost',
      [
        ['本月估算', '$86.4K', 'Provider metering'],
        ['预算使用', '74%', 'Brain budget'],
        ['Fallback 成本', '$1.2K', '32K calls'],
        ['财务账本', '—', 'Payment owner']
      ],
      '导出成本估算',
      brainObjects.models.map((m, i) => ({
        ...m,
        id: `COST-${m.id}`,
        kind: 'Cost stream',
        status: `$${[64.2, 18.4, 3.8][i]}K`,
        meta: `${[68, 24, 8][i]}% of estimate`
      }))
    ),
    settings: page(
      'BRAIN GOVERNANCE',
      '系统设置',
      '查看默认区域、保留、预算和安全策略；更改通过 owner 审批。',
      '配置策略',
      'settings',
      [
        ['策略', '12', 'Owner managed'],
        ['生效版本', 'v18', 'Audited'],
        ['待变更', '2', 'Not applied'],
        ['直接保存', '0', 'Governed']
      ],
      '提交 Brain 配置变更',
      brainObjects.routes.map((r, i) => ({
        ...r,
        id: `CFG-BR-${i + 1}`,
        name: ['Provider data policy', 'Default fallback policy', 'Run retention policy'][i]!,
        kind: 'Brain config',
        status: 'Effective',
        meta: `version ${18 - i}`
      })),
      true
    )
  },
  capabilities: {
    overview: page(
      'CAPABILITY SYSTEM',
      '能力总览',
      '按 Domain → Capability → Skill → Action 查看稳定结果契约、实现与证据覆盖。',
      'Capability',
      'domain-map',
      [
        ['Domains', '8', 'Canonical'],
        ['Capabilities', '36', 'Stable outcomes'],
        ['Verified', '28', 'Evidence current'],
        ['Candidates', '8', 'Not canonical truth']
      ],
      '创建 Capability candidate',
      capabilityObjects.catalog,
      true
    ),
    catalog: page(
      'STABLE OUTCOME CATALOG',
      '能力目录',
      '目录以稳定结果契约为中心，并明确 Primary、Supporting 与 Critic 组合。',
      'Capability',
      'catalog',
      [
        ['Capabilities', '36', '8 domains'],
        ['Verified', '28', 'Current'],
        ['Candidate', '6', 'Not verified'],
        ['Deprecated', '2', 'Migration path']
      ],
      '创建 Capability candidate',
      capabilityObjects.catalog,
      true
    ),
    skills: page(
      'SKILL REGISTRY',
      'Skills',
      'Skill 是 Capability 的受治理实现组成，不等于 Capability 本身。',
      'Skill',
      'hierarchy',
      [
        ['Skills', '84', 'Capability scoped'],
        ['Active', '72', 'Current versions'],
        ['Candidate', '8', 'Evaluation pending'],
        ['Deprecated', '4', 'Referenced']
      ],
      '创建 Skill candidate',
      capabilityObjects.skills,
      true
    ),
    agents: page(
      'AGENT IMPLEMENTATIONS',
      'Agents',
      'Agent 是受治理实现，调用 Capability、Skill 与工具；不拥有正式业务状态。',
      'Agent',
      'agents',
      [
        ['Agents', '12', 'Governed'],
        ['Active', '10', 'Evaluation current'],
        ['Candidate', '2', 'Limited'],
        ['Protected actions', '0', 'Advisory only']
      ],
      '创建 Agent candidate',
      capabilityObjects.agents,
      true
    ),
    tools: page(
      'TOOL REGISTRY',
      '工具集成',
      '管理工具契约、作用域、实现版本和调用证据，外部保护动作仍需审批。',
      '工具',
      'tools',
      [
        ['Tools', '28', 'Contracted'],
        ['Healthy', '24', 'Probe current'],
        ['Degraded', '2', 'Fallback'],
        ['Protected', '8', 'Approval required']
      ],
      '登记工具候选',
      [
        x(
          'TOOL-K-SEARCH',
          'Knowledge cited search',
          'Read tool',
          '健康',
          'v3.2 · 682K calls',
          [
            ['Contract', 'knowledge.search.v3'],
            ['Scope', 'evidence:read'],
            ['Owner', 'Knowledge'],
            ['Fallback', 'None']
          ],
          ['Capability consumers 8', 'Agent consumers 4', 'Gateway route'],
          ['Tool contract TC-18', 'Probe HP-118', 'Calls 682K']
        ),
        x(
          'TOOL-MARKET',
          'Market data lookup',
          'Read tool',
          '降级',
          'v2.1 · 84K calls',
          [
            ['Contract', 'market.lookup.v2'],
            ['Scope', 'market:read'],
            ['Owner', 'Data Engine'],
            ['Fallback', 'Cached snapshot']
          ],
          ['Capability consumers 3', 'Agent consumers 2', 'Gateway route'],
          ['Tool contract TC-22', 'Probe HP-114', 'Calls 84K']
        )
      ],
      true
    ),
    evaluation: page(
      'CAPABILITY EVALUATION',
      '测试与评估',
      '使用版本化评估集验证结果契约、实现和 Critic，不从任务完成自动验证 Capability。',
      '评估',
      'evaluation',
      [
        ['评估套件', '42', 'Versioned'],
        ['通过', '36', 'Threshold met'],
        ['阻断候选', '4', 'Regression'],
        ['人工复核', '2', 'Required']
      ],
      '启动 Demo 评估',
      capabilityObjects.catalog.map((c, i) => ({
        ...c,
        id: `CEV-${[118, 104, 92][i]}`,
        name: `${c.name} evaluation`,
        kind: 'Capability evaluation',
        status: ['通过', '通过', '阻断'][i]!,
        meta: `Test set v${4 - i} · ${1200 - i * 180} cases`
      }))
    ),
    runs: page(
      'CAPABILITY RUN EVIDENCE',
      '执行记录',
      '查看 Capability invocation、实现版本、输入/输出证据及关联 Brain/Execution 调用。',
      'Capability 调用',
      'evidence',
      [
        ['调用', '1.2M', 'Invocation receipts'],
        ['成功', '98.6%', 'Contract result'],
        ['需复核', '1,284', 'No auto verification'],
        ['关联 Brain', '128K', 'Bidirectional link']
      ],
      '导出调用证据',
      [
        ...brainObjects.runs.map((r) => ({
          ...r,
          id: `CINV-${r.id}`,
          name: r.fields[3]?.[1] ?? r.name,
          kind: 'Capability invocation',
          meta: `via ${r.id}`,
          status: r.status
        }))
      ]
    ),
    versions: page(
      'VERSION LINEAGE',
      '版本管理',
      '追踪 Outcome Contract、实现、Skill、Agent、评估和受控迁移谱系。',
      '版本线',
      'lineage',
      [
        ['版本线', '36', 'Per Capability'],
        ['Current', '36', 'One active each'],
        ['Candidates', '8', 'Not promoted'],
        ['Migrations', '3', 'In progress']
      ],
      '创建新版本 candidate',
      capabilityObjects.catalog.map((c, i) => ({
        ...c,
        id: `VER-${c.id}`,
        name: `${c.name} version lineage`,
        kind: 'Version lineage',
        status: c.status,
        meta: `current v${[3.2, 2.4, 1.8][i]}`
      })),
      true
    ),
    permissions: page(
      'CAPABILITY AUTHORITY',
      '权限配置',
      '精确控制谁可发现、调用、评估和发布 Capability；调用权限不等于保护动作批准。',
      '权限策略',
      'permissions',
      [
        ['策略', '64', 'Exact scopes'],
        ['调用主体', '126', 'Workspace + service'],
        ['发布权限', '8', 'Internal only'],
        ['过宽候选', '2', 'Blocked']
      ],
      '提交权限策略变更',
      capabilityObjects.catalog.map((c, i) => ({
        ...c,
        id: `PERM-${c.id}`,
        name: `${c.name} access policy`,
        kind: 'Capability permission',
        status: ['Compliant', 'Compliant', 'Review'][i]!,
        meta: `invoke ${12 - i * 3} principals`
      })),
      true
    )
  }
};

export function IntelligencePages({
  moduleId,
  pageId,
  query,
  setQuery,
  onAction
}: IntelligencePagesProps) {
  const modulePages = definitions[moduleId];
  const page = modulePages[pageId] ?? modulePages[Object.keys(modulePages)[0]!]!;
  const [selectedId, setSelectedId] = useState(page.objects[0]?.id ?? '');
  useEffect(() => setSelectedId(page.objects[0]?.id ?? ''), [page]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return page.objects.filter(
      (item) =>
        !q || `${item.id} ${item.name} ${item.kind} ${item.status}`.toLowerCase().includes(q)
    );
  }, [page, query]);
  const selected = page.objects.find((item) => item.id === selectedId) ?? visible[0];
  return (
    <section
      className={`sa2-depth sa2-intel-page sa2-intel-page--${page.variant}`}
      data-testid={`${moduleId}-page-${pageId}`}
    >
      <header className="sa2-depth-head">
        <div>
          <span>{page.eyebrow}</span>
          <h3>{page.title}</h3>
          <p>{page.description}</p>
        </div>
        <button className="sa2-button" onClick={() => onAction(page.action, page.protected)}>
          ＋ {page.action}
        </button>
      </header>
      <div className="sa2-page-facts">
        {page.facts.map((f) => (
          <article key={f[0]}>
            <span>{f[0]}</span>
            <strong>{f[1]}</strong>
            <small>{f[2]}</small>
          </article>
        ))}
      </div>
      <IntelCanvas
        variant={page.variant}
        objects={page.objects}
        selectedId={selected?.id}
        onSelect={setSelectedId}
      />
      <div className="sa2-operator-workspace">
        <article className="sa2-depth-card sa2-object-browser">
          <header>
            <div>
              <span>{page.objectLabel.toUpperCase()}</span>
              <h4>{page.objectLabel}列表</h4>
            </div>
            <b>{visible.length} DEMO</b>
          </header>
          <div className="sa2-inline-search">
            <input
              aria-label={`搜索${page.objectLabel}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`搜索 ${page.objectLabel} ID 或名称`}
            />
            <select aria-label="状态筛选">
              <option>全部状态</option>
              <option>正常</option>
              <option>需关注</option>
            </select>
          </div>
          {visible.map((item) => (
            <button
              className={item.id === selected?.id ? 'is-active' : ''}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <i />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.id} · {item.meta}
                </small>
              </span>
              <u>{item.kind}</u>
              <b>{item.status}</b>
            </button>
          ))}
        </article>
        {selected && (
          <article
            className="sa2-depth-card sa2-object-detail sa2-intel-detail"
            data-testid={`${moduleId}-${pageId}-detail`}
          >
            <header>
              <div>
                <span>SELECTED {page.objectLabel.toUpperCase()}</span>
                <h4>{selected.name}</h4>
              </div>
              <b>{selected.status}</b>
            </header>
            <dl>
              {selected.fields.map((f) => (
                <div key={f[0]}>
                  <dt>{f[0]}</dt>
                  <dd>{f[1]}</dd>
                </div>
              ))}
            </dl>
            <h5>{moduleId === 'brain' ? '执行 / 路由链' : '实现谱系'}</h5>
            <ol>
              {selected.chain.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <b>{step}</b>
                  {index < selected.chain.length - 1 && <i>→</i>}
                </li>
              ))}
            </ol>
            <h5>证据与相关调用</h5>
            <div className="sa2-evidence-chips">
              {selected.evidence.map((item) => (
                <button key={item} onClick={() => onAction(`打开 Demo 证据 ${item}`)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="sa2-callout">
              <b>Authority boundary</b>
              <span>
                {moduleId === 'brain'
                  ? 'Brain 路由和模型输出不是正式业务状态；Capability 调用保留 canonical ID。'
                  : 'Reflection Candidate 与任务完成都不是 Capability canonical truth 或自动验证。'}
              </span>
            </div>
            <div className="sa2-action-row">
              <button
                className="sa2-button sa2-button--secondary"
                onClick={() => onAction(`查看 ${selected.id} 关联调用`)}
              >
                查看关联调用
              </button>
              <button
                className="sa2-button"
                onClick={() => onAction(`${page.action}：${selected.id}`, page.protected)}
              >
                预演主要操作
              </button>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function IntelCanvas({
  variant,
  objects,
  selectedId,
  onSelect
}: {
  variant: IntelVariant;
  objects: readonly IntelObject[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (['brain-map', 'orchestration', 'routing'].includes(variant))
    return (
      <article className="sa2-depth-card sa2-intel-flow">
        {objects.map((item) => (
          <button
            className={item.id === selectedId ? 'is-active' : ''}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            {item.chain.map((step, index) => (
              <span key={step}>
                <i>{index + 1}</i>
                <b>{step}</b>
                {index < item.chain.length - 1 && <em>→</em>}
              </span>
            ))}
            <u>{item.status}</u>
          </button>
        ))}
      </article>
    );
  if (['domain-map', 'hierarchy', 'lineage'].includes(variant))
    return (
      <article className="sa2-depth-card sa2-cap-tree">
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span className="domain">D{index + 1}</span>
            <i>→</i>
            <span className="cap">{item.name}</span>
            <i>→</i>
            {item.chain.slice(2).map((node) => (
              <span key={node}>{node}</span>
            ))}
          </button>
        ))}
      </article>
    );
  if (['models', 'agents', 'catalog', 'tools'].includes(variant))
    return (
      <div className="sa2-intel-cards">
        {objects.map((item, index) => (
          <button
            className={item.id === selectedId ? 'is-active' : ''}
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <span>{['AI', 'AG', 'CP'][index] ?? 'AI'}</span>
            <strong>{item.name}</strong>
            <small>
              {item.kind} · {item.meta}
            </small>
            <u>{item.status}</u>
            <div>
              {item.fields.slice(0, 3).map((f) => (
                <i key={f[0]}>
                  <b>{f[0]}</b>
                  {f[1]}
                </i>
              ))}
            </div>
          </button>
        ))}
      </div>
    );
  if (['brain-runs', 'evidence', 'evaluation', 'quality'].includes(variant))
    return (
      <article className="sa2-depth-card sa2-intel-runs">
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <time>{['10:42:18', '10:31:04', '09:58:22'][index]}</time>
            <span>
              <strong>{item.name}</strong>
              <small>
                {item.id} · {item.meta}
              </small>
            </span>
            <i>
              <em style={{ width: `${[94, 86, 64][index]}%` }} />
            </i>
            <u>{item.status}</u>
          </button>
        ))}
      </article>
    );
  if (variant === 'cost')
    return (
      <article className="sa2-depth-card sa2-intel-cost">
        {objects.map((item, index) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>
              <strong>{item.name}</strong>
              <small>{item.meta}</small>
            </span>
            <i style={{ height: `${[110, 72, 38][index]}px` }} />
            <b>{item.status}</b>
          </button>
        ))}
      </article>
    );
  if (variant === 'permissions' || variant === 'settings')
    return (
      <article className="sa2-depth-card sa2-intel-policy">
        {objects.map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)}>
            <span>
              <strong>{item.name}</strong>
              <small>{item.id}</small>
            </span>
            {item.fields.map((f) => (
              <i key={f[0]}>
                <b>{f[0]}</b>
                {f[1]}
              </i>
            ))}
            <u>{item.status}</u>
          </button>
        ))}
      </article>
    );
  return (
    <article className="sa2-depth-card sa2-intel-prompts">
      {objects.map((item) => (
        <button key={item.id} onClick={() => onSelect(item.id)}>
          <code>{`system: use ${item.fields[3]?.[1] ?? item.name}\nconstraints: governed evidence only\noutput: schema.v2`}</code>
          <span>
            <strong>{item.name}</strong>
            <small>{item.meta}</small>
          </span>
          <u>{item.status}</u>
        </button>
      ))}
    </article>
  );
}
