import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, PageHeader, Select, TextInput } from '@markorbit/ui';
import './super-admin/styles.css';

type Locale = 'zh-CN' | 'en';
type QuotaFixture = Readonly<{
  id: string;
  name: string;
  status: '正常' | '临界';
  limit: number;
  allocated: number;
  used: number;
  reserved: number;
  source: string;
}>;

const fixtures: readonly QuotaFixture[] = [
  {
    id: 'quota_workspace_members',
    name: 'Workspace 成员席位',
    status: '正常',
    limit: 50,
    allocated: 32,
    used: 27,
    reserved: 2,
    source: 'Commercial plan v4 → Core Workspace allocation v7'
  },
  {
    id: 'quota_ai_runs_monthly',
    name: '每月 AI 运行次数',
    status: '临界',
    limit: 10000,
    allocated: 10000,
    used: 8710,
    reserved: 640,
    source: 'Commercial plan v4 → Execution usage projection v12'
  },
  {
    id: 'quota_storage_gb',
    name: '证据存储空间（GB）',
    status: '正常',
    limit: 500,
    allocated: 420,
    used: 286,
    reserved: 35,
    source: 'Commercial plan v4 → Knowledge storage projection v3'
  }
];

const copy = {
  'zh-CN': {
    title: '配额',
    description: '少量固定配额采用选择—详情；大量配额切换为独立列表与详情路由。',
    fixture: '设计评审数据，不是 Owner 真相',
    small: '3 项配额',
    large: '大量配额模式',
    search: '搜索配额',
    status: '状态',
    all: '全部状态',
    sort: '排序',
    detail: '配额详情',
    limit: '套餐上限',
    allocated: 'Workspace 分配',
    used: '已使用',
    reserved: '已保留',
    available: '可用',
    source: '来源关系',
    noHistory: '当前评审数据没有真实历史记录，因此不展示趋势图。',
    adjust: '调整配额',
    open: '打开详情',
    result: '项结果'
  },
  en: {
    title: 'Quotas',
    description:
      'Use selection and detail for a few fixed quotas; use separate list and detail routes at scale.',
    fixture: 'Design-review data, not owner truth',
    small: '3 quotas',
    large: 'Large-list mode',
    search: 'Search quotas',
    status: 'Status',
    all: 'All statuses',
    sort: 'Sort',
    detail: 'Quota detail',
    limit: 'Plan limit',
    allocated: 'Workspace allocation',
    used: 'Used',
    reserved: 'Reserved',
    available: 'Available',
    source: 'Source lineage',
    noHistory: 'No real history is available in this review fixture, so no trend chart is shown.',
    adjust: 'Adjust quota',
    open: 'Open detail',
    result: 'results'
  }
} as const;

export function QuotaLayoutReview({
  initialMode = 'small',
  initialLocale = 'zh-CN'
}: {
  initialMode?: 'small' | 'large';
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [mode, setMode] = useState<'small' | 'large'>(initialMode);
  const [selectedId, setSelectedId] = useState(fixtures[0]!.id);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const t = copy[locale];
  const rows = useMemo(
    () =>
      fixtures.filter(
        (item) =>
          `${item.name} ${item.id}`.toLowerCase().includes(search.toLowerCase()) &&
          (status === 'ALL' || item.status === status)
      ),
    [search, status]
  );
  const selected = fixtures.find((item) => item.id === selectedId) ?? fixtures[0]!;

  return (
    <main className="mo-quota-review">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="mo-quota-review__actions">
            <Badge>{t.fixture}</Badge>
            <Button
              variant="secondary"
              onClick={() => setLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')}
            >
              {locale === 'zh-CN' ? 'English' : '简体中文'}
            </Button>
          </div>
        }
      />
      <Alert tone="warning" title={t.fixture}>
        {t.noHistory}
      </Alert>
      <div className="mo-quota-review__mode" role="group" aria-label="Quota layout mode">
        <Button
          variant={mode === 'small' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'small'}
          onClick={() => setMode('small')}
        >
          {t.small}
        </Button>
        <Button
          variant={mode === 'large' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'large'}
          onClick={() => setMode('large')}
        >
          {t.large}
        </Button>
      </div>

      {mode === 'small' ? (
        <div className="mo-quota-review__master-detail">
          <nav aria-label="Quota selection" className="mo-quota-review__selector">
            {fixtures.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === selected.id ? 'is-selected' : undefined}
                aria-current={item.id === selected.id ? 'true' : undefined}
                onClick={() => setSelectedId(item.id)}
              >
                <span>{item.name}</span>
                <small>
                  {item.used.toLocaleString()} / {item.limit.toLocaleString()}
                </small>
              </button>
            ))}
          </nav>
          <QuotaDetail item={selected} labels={t} />
        </div>
      ) : (
        <Card className="mo-quota-review__list">
          <div className="mo-quota-review__filters">
            <TextInput
              label={t.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              label={t.status}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">{t.all}</option>
              <option value="正常">正常 / Healthy</option>
              <option value="临界">临界 / Near limit</option>
            </Select>
            <Select label={t.sort} defaultValue="usage-desc">
              <option value="usage-desc">使用率 ↓ / Usage ↓</option>
              <option value="name-asc">名称 ↑ / Name ↑</option>
            </Select>
          </div>
          <p>
            {rows.length} {t.result} · page 1 / 1
          </p>
          <div className="mo-quota-review__table-wrap">
            <table className="mo-quota-review__table">
              <thead>
                <tr>
                  <th>{t.title}</th>
                  <th>{t.status}</th>
                  <th>{t.limit}</th>
                  <th>{t.used}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td data-label={t.title}>
                      <strong>{item.name}</strong>
                      <small>{item.id}</small>
                    </td>
                    <td data-label={t.status}>{item.status}</td>
                    <td data-label={t.limit}>{item.limit.toLocaleString()}</td>
                    <td data-label={t.used}>{item.used.toLocaleString()}</td>
                    <td>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelectedId(item.id);
                          setMode('small');
                        }}
                      >
                        {t.open}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}

function QuotaDetail({ item, labels }: { item: QuotaFixture; labels: (typeof copy)[Locale] }) {
  const available = item.allocated - item.used - item.reserved;
  return (
    <Card className="mo-quota-review__detail">
      <div className="mo-quota-review__detail-heading">
        <div>
          <span>{labels.detail}</span>
          <h2>{item.name}</h2>
          <code>{item.id}</code>
        </div>
        <Badge>{item.status}</Badge>
      </div>
      <dl className="mo-quota-review__facts">
        <div>
          <dt>{labels.limit}</dt>
          <dd>{item.limit.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{labels.allocated}</dt>
          <dd>{item.allocated.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{labels.used}</dt>
          <dd>{item.used.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{labels.reserved}</dt>
          <dd>{item.reserved.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{labels.available}</dt>
          <dd>{available.toLocaleString()}</dd>
        </div>
      </dl>
      <div className="mo-quota-review__source">
        <strong>{labels.source}</strong>
        <p>{item.source}</p>
      </div>
      <Alert title={labels.noHistory}>{labels.fixture}</Alert>
      <Button disabled title="No owner command is connected in this review fixture">
        {labels.adjust}
      </Button>
    </Card>
  );
}
