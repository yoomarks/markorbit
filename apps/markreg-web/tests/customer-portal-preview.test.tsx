import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CustomerPortalPreview } from '../src/customer-portal-preview/CustomerPortalPreview.js';

describe('Customer Portal V1.2 preview', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps a visitor consultation as lead-only', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview fixtureMode="signed-out" storageKey="lead" />);
    await user.click(screen.getByRole('button', { name: /先咨询一下/ }));
    expect(screen.getByRole('dialog', { name: '首次咨询' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /提交 Demo 咨询/ }));
    expect(screen.getByText(/尚未建立正式客户关系/)).toBeInTheDocument();
    expect(screen.queryByText('首页')).not.toBeInTheDocument();
  });

  it('rejects an unverified relationship claim without disclosing objects', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview fixtureMode="signed-out" storageKey="claim" />);
    await user.click(screen.getByRole('button', { name: '我是已有客户' }));
    await user.click(screen.getByRole('button', { name: '验证并关联' }));
    expect(screen.getByRole('alert')).toHaveTextContent('未披露任何客户或业务是否存在');
    expect(screen.queryByText('NOVA 图形商标 · 中国申请')).not.toBeInTheDocument();
  });

  it('persists the same business task across Web and mini channel views', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <CustomerPortalPreview fixtureMode="signed-out" storageKey="channel" defaultChannel="web" />
    );
    await user.click(screen.getByRole('button', { name: '使用 MO 账号登录' }));
    await user.click(screen.getAllByRole('button', { name: '去处理' })[0]!);
    await user.click(screen.getByRole('button', { name: /确认并提交 Demo 资料/ }));
    expect(screen.getByText(/你有 1 件事需要处理/)).toBeInTheDocument();
    unmount();
    render(<CustomerPortalPreview storageKey="channel" defaultChannel="mini" />);
    expect(screen.getByText('1 项待处理')).toBeInTheDocument();
    expect(screen.getAllByText(/matter-cn-nova-2026/).length).toBeGreaterThan(0);
  });

  it('isolates another customer in the same Workspace', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview persist={false} />);
    await user.click(screen.getByRole('button', { name: /澄远知识产权/ }));
    await user.click(screen.getByRole('button', { name: /刘娅 · 另一位客户/ }));
    expect(screen.getByText('PICO 文字商标 · 中国申请')).toBeInTheDocument();
    expect(screen.queryByText('NOVA 图形商标 · 中国申请')).not.toBeInTheDocument();
    expect(screen.queryByText('NOVA 美国商标检索与申请')).not.toBeInTheDocument();
  });

  it('limits an enterprise member to explicitly granted objects', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview persist={false} />);
    await user.click(screen.getByRole('button', { name: /澄远知识产权/ }));
    await user.click(screen.getByRole('button', { name: /赵霖 · 企业成员/ }));
    expect(screen.getAllByText(/NOVA 图形商标 · 中国申请/).length).toBeGreaterThan(0);
    expect(screen.queryByText('NOVA 美国商标检索与申请')).not.toBeInTheDocument();
  });

  it('keeps IDs and submitted state unchanged across locale switching and protects logout', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview persist={false} />);
    expect(screen.getAllByText(/matter-cn-nova-2026/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getAllByText(/matter-cn-nova-2026/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: 'Me' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      screen.getByRole('heading', { name: 'Continue your trademark work' })
    ).toBeInTheDocument();
    expect(screen.queryByText('MO-CN-2026-0184')).not.toBeInTheDocument();
  });

  it('reviews an exact quote and keeps the confirmed state on the same business object', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview persist={false} />);
    await user.click(screen.getAllByRole('button', { name: '去处理' })[1]!);
    const dialog = screen.getByRole('dialog', { name: '确认报价' });
    expect(within(dialog).getByText(/quote-us-nova-318/)).toBeInTheDocument();
    expect(within(dialog).getByText('¥12,800.00')).toBeInTheDocument();
    expect(within(dialog).getByText(/不含后续审查意见答复/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '确认此 Demo 报价' }));
    await user.click(screen.getAllByRole('button', { name: /^消息/ })[0]!);
    expect(screen.getAllByText('已确认 Demo 报价').length).toBeGreaterThan(0);
    expect(screen.getByText(/quote-us-nova-318/)).toBeInTheDocument();
  });

  it('renders a generic permission denial without sensitive object detail', () => {
    render(<CustomerPortalPreview fixtureMode="permission" persist={false} />);
    const main = screen.getByRole('main');
    expect(
      within(main).getByRole('heading', { name: '你没有权限查看这项业务' })
    ).toBeInTheDocument();
    expect(within(main).queryByText('NOVA')).not.toBeInTheDocument();
  });

  it('presents all five mature mini-program service destinations', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview persist={false} defaultChannel="mini" />);
    expect(screen.getByRole('heading', { name: '陈玫' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '常用服务' })).toBeInTheDocument();
    expect(screen.getByText('林顾问正在为你服务')).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: '小程序主导航' });
    await user.click(within(navigation).getByRole('button', { name: '办业务' }));
    expect(screen.getByRole('heading', { name: '热门服务' })).toBeInTheDocument();
    await user.click(within(navigation).getByRole('button', { name: '进度' }));
    expect(
      screen.getByText('页面显示的是服务进展；正式法律程序和官方期限以详情中的来源文件为准。')
    ).toBeInTheDocument();
    await user.click(within(navigation).getByRole('button', { name: '消息' }));
    expect(screen.getByRole('button', { name: /顾 顾问消息/ })).toBeInTheDocument();
    await user.click(within(navigation).getByRole('button', { name: '我的' }));
    expect(screen.getByText('我的业务与资料')).toBeInTheDocument();
    expect(screen.getByText('账户与服务')).toBeInTheDocument();
  });
});
