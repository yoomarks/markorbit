import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from './domain.js';

const preferenceKey = 'markorbit:site-v1-preview:admin-locale';

const zh = {
  Overview: '站点总览',
  'Pages & navigation': '页面与导航',
  'Visual editor': '可视化编辑',
  Content: '内容管理',
  Services: '服务展示',
  Insights: '专业洞察',
  Contact: '联系我们',
  'Leads & inquiries': '咨询与线索',
  'Client service': '客户服务',
  Analytics: '访问分析',
  'Domain & SEO/GEO': '域名与 SEO/GEO',
  Settings: '站点设置',
  'Site overview': '站点总览',
  'Readiness, reach, and the work that needs attention.':
    '优先查看发布准备度、未发布变更与待处理线索。',
  'Manage the routes, visibility, and hierarchy of this Site projection.':
    '管理站点页面、可见性与导航顺序。',
  'Shape a bounded page from blocks and compare the draft with the published demo.':
    '编辑页面区块，并对照草稿与已发布演示。',
  'Prepare reviewed knowledge for an explicit Site demo publication.':
    '管理经过审核、可明确发布到演示站点的内容。',
  'Services & offers': '服务与展示',
  'Choose which owner-backed service references are visible on the Site.':
    '选择站点可展示的权威来源服务引用。',
  'Trace every demo inquiry back to its page, content, and service source.':
    '将每条演示咨询追溯到页面、内容和服务来源。',
  'Preview request and progress information without creating a second order or matter truth.':
    '展示请求与进度，但不创建第二套订单或 Matter 真相。',
  'Operations & analytics': '运营与访问分析',
  'Connect Site attention to demo inquiries and the content that influenced them.':
    '连接站点关注、演示咨询及其内容归因。',
  'Review projection metadata and readiness without executing DNS or search submissions.':
    '检查站点元数据与准备度，不执行 DNS 或搜索提交。',
  'Site settings': '站点设置',
  'Control demo modules, locale, and access without duplicating Workspace billing or identity.':
    '管理演示模块、语言与访问权限，不复制 Workspace 账单或身份。',
  Workspace: '工作空间',
  'View Site': '查看站点',
  'Edit Site': '装修站点',
  'Unpublished draft': '有未发布更改',
  'View-only access': '仅查看权限',
  'Draft differs from the customer-facing demo': '草稿与客户可见版本不同',
  Draft: '草稿',
  Desktop: '桌面',
  'Save draft': '保存草稿',
  'Review & publish': '检查并发布',
  'Site map': '站点地图',
  'Add page unavailable in preview': '此预览暂不支持新增页面',
  'Preview draft': '预览草稿',
  'Content library': '内容库',
  'New content': '新建内容',
  'Edit content': '编辑内容',
  Title: '标题',
  Excerpt: '摘要',
  Body: '正文',
  'Related service': '关联服务',
  'Prepare demo publication': '准备演示发布',
  'Publish content demo': '发布内容演示',
  'No demo leads yet': '暂无演示线索',
  Inbox: '线索收件箱',
  'Mark qualified': '标记为已确认',
  'Prepare follow-up': '准备跟进',
  Modules: '功能模块',
  'Workspace & access': '工作空间与访问',
  'Demo permission': '演示权限',
  Locale: '站点语言',
  'Reset this demo Workspace': '重置此演示工作空间',
  'Reset demo access and fixtures': '重置演示权限与数据',
  'Demo fixtures only': '仅浏览器本地演示数据',
  'INTERACTIVE PRODUCT PREVIEW': '交互式产品预览',
  'Published version': '已发布版本',
  Inquiries: '咨询线索',
  'Publication readiness': '发布准备度',
  'Pending leads': '待处理线索',
  'Latest content': '最新内容',
  'Latest inquiry': '最新咨询',
  'Authority boundary': '权限边界',
  'Illustrative visitors': '示意访客数',
  'Inquiry rate': '咨询转化率',
  'Content-assisted leads': '内容辅助线索',
  'Top market': '主要市场',
  Unavailable: '不可计算',
  Visible: '显示',
  'Site health': '发布准备度',
  'One action before launch': '发布前还有一项待处理',
  'Published demo': '已发布演示',
  'Safe preview': '安全预览',
  'No demo inquiries yet': '暂无演示咨询',
  'Projection, not business truth': '仅为投影，不是业务真相',
  Page: '页面',
  Path: '路径',
  Status: '状态',
  Actions: '操作',
  Home: '首页',
  Properties: '属性',
  'Block label': '区块名称',
  Heading: '标题',
  'Supporting copy': '辅助文案',
  'Show this block': '显示此区块',
  'Brand name': '品牌名称',
  'Publish this snapshot?': '发布此内容快照？',
  'Version history': '版本历史',
  'Restore to draft': '恢复为草稿',
  'Publication boundary': '发布边界',
  Markets: '市场',
  'Fee display': '费用展示',
  Authority: '权限边界',
  'Visitor message': '访客原始消息',
  'Attribution lineage': '归因链路',
  'Handoff boundary': '交接边界',
  'Projection only': '仅供投影演示',
  'Customer requests': '客户请求',
  Reference: '编号',
  Request: '请求',
  Stage: '阶段',
  'Last update': '最近更新',
  'Partial demo analytics': '部分演示分析数据',
  'Conversion path': '转化路径',
  'Content to demand': '内容与需求',
  'Demo domain': '演示域名',
  'Verification not executed': '尚未执行验证',
  'Proposed hostname': '建议主机名',
  'Search preview': '搜索结果预览',
  'Workspace-owned settings': 'Workspace 管理的设置',
  'Demo access recovery': 'Demo 权限恢复',
  Published: '已发布',
  Hidden: '隐藏',
  'Add block': '添加区块',
  'Start an inquiry': '预约咨询',
  'Move up': '上移',
  'Move down': '下移',
  Primary: '主色',
  Accent: '强调色',
  'Draft has unpublished changes': '草稿有未发布更改',
  'Draft matches published demo': '草稿与已发布演示一致',
  'Draft saved locally': '草稿已保存到当前浏览器',
  'Demo published as version': '演示已发布为版本',
  'Restore creates a new draft. Historical demo snapshots remain unchanged.':
    '恢复操作会创建新草稿，历史演示快照保持不变。',
  English: 'English',
  'Simplified Chinese': '简体中文'
} as const;

export type AdminMessage = keyof typeof zh;

interface AdminI18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (message: string) => string;
  formatDate: (value: string) => string;
  formatNumber: (value: number) => string;
}

const Context = createContext<AdminI18n | undefined>(undefined);

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setValue] = useState<Locale>(() =>
    localStorage.getItem(preferenceKey) === 'en-US' ? 'en-US' : 'zh-CN'
  );
  const value = useMemo<AdminI18n>(
    () => ({
      locale,
      setLocale(next) {
        localStorage.setItem(preferenceKey, next);
        setValue(next);
      },
      t(message) {
        return locale === 'zh-CN' ? (zh[message as AdminMessage] ?? message) : message;
      },
      formatDate(value) {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
      },
      formatNumber(value) {
        return new Intl.NumberFormat(locale).format(value);
      }
    }),
    [locale]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdminI18n(): AdminI18n {
  const value = useContext(Context);
  if (!value) throw new Error('AdminLocaleProvider is required.');
  return value;
}

export const adminLocaleStorageKey = preferenceKey;
