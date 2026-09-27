import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CustomerPortalPreview } from '../src/customer-portal-preview/CustomerPortalPreview.js';

describe('Customer Portal V1.2 preview', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps a visitor consultation as lead-only', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview fixtureMode="signed-out" storageKey="lead" />);
    await user.click(screen.getByRole('button', { name: /先提交咨询/ }));
    expect(screen.getByRole('dialog', { name: '首次咨询' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /提交 Demo 咨询/ }));
    expect(screen.getByText('线索状态 · 尚未建立客户关系')).toBeInTheDocument();
    expect(screen.queryByText('总览与待办')).not.toBeInTheDocument();
  });

  it('rejects an unverified relationship claim without disclosing objects', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview fixtureMode="signed-out" storageKey="claim" />);
    await user.click(screen.getByRole('button', { name: '关联已有客户关系' }));
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
    await user.click(screen.getByRole('button', { name: '继续办理' }));
    await user.click(screen.getByRole('button', { name: /确认资料用途并提交 Demo/ }));
    expect(screen.getByText('当前没有待办')).toBeInTheDocument();
    unmount();
    render(<CustomerPortalPreview storageKey="channel" defaultChannel="mini" />);
    expect(screen.getByText('当前没有待办')).toBeInTheDocument();
    expect(screen.getAllByText(/matter-cn-nova-2026/).length).toBeGreaterThan(0);
  });

  it('isolates another customer in the same Workspace', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview persist={false} />);
    await user.click(screen.getByRole('button', { name: /澄远知识产权/ }));
    await user.click(screen.getByRole('button', { name: /刘娅 · other customer/ }));
    expect(screen.getByText('PICO 文字商标 · 中国申请')).toBeInTheDocument();
    expect(screen.queryByText('NOVA 图形商标 · 中国申请')).not.toBeInTheDocument();
    expect(screen.queryByText('NOVA 美国商标检索与申请')).not.toBeInTheDocument();
  });

  it('limits an enterprise member to explicitly granted objects', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview persist={false} />);
    await user.click(screen.getByRole('button', { name: /澄远知识产权/ }));
    await user.click(screen.getByRole('button', { name: /赵霖 · enterprise grant/ }));
    expect(screen.getAllByText(/NOVA 图形商标 · 中国申请/).length).toBeGreaterThan(0);
    expect(screen.queryByText('NOVA 美国商标检索与申请')).not.toBeInTheDocument();
  });

  it('keeps IDs and submitted state unchanged across locale switching and protects logout', async () => {
    const user = userEvent.setup();
    render(<CustomerPortalPreview persist={false} />);
    expect(screen.getAllByText(/matter-cn-nova-2026/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getAllByText(/matter-cn-nova-2026/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: /Account & company/ })[0]!);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      screen.getByRole('heading', { name: 'Continue your trademark work' })
    ).toBeInTheDocument();
    expect(screen.queryByText('MO-CN-2026-0184')).not.toBeInTheDocument();
  });

  it('renders a generic permission denial without sensitive object detail', () => {
    render(<CustomerPortalPreview fixtureMode="permission" persist={false} />);
    const main = screen.getByRole('main');
    expect(
      within(main).getByRole('heading', { name: '你没有权限查看这项业务' })
    ).toBeInTheDocument();
    expect(within(main).queryByText('NOVA')).not.toBeInTheDocument();
  });
});
