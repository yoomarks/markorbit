// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { TrademarkLifecycleRail } from './TrademarkLifecycleRail.js';
import {
  euOppositionFixture,
  philippinesLimitedFixture,
  portfolioLifecycleFixtures,
  staleFixture,
  usMaintenanceFixture
} from './trademark-lifecycle-rail-fixtures.js';

afterEach(cleanup);

describe('TrademarkLifecycleRail high-fidelity prototype', () => {
  it('answers current stage, next matter, timing class, and provenance without false authority', async () => {
    const user = userEvent.setup();
    const { container } = render(<TrademarkLifecycleRail fixture={usMaintenanceFixture} />);

    expect(screen.getByText(/演示数据——不构成法律意见或官方报件建议/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'NORTH STAR' })).toBeTruthy();
    expect(screen.getByText('注册后维持')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '准备 §8 使用材料（演示建议）' })).toBeTruthy();
    expect(screen.getAllByText('规则计算窗口').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2026年11月18日起/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/健康度/)).toBeNull();
    expect(screen.queryByText(/完成率/)).toBeNull();
    expect(screen.queryByText('官方期限')).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: '§8 使用宣誓准备' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '查看要求' }));
    expect(screen.getByText('美国商标记录快照（演示）')).toBeTruthy();
    expect(screen.getAllByText(/Lite 未将其核验为 Official Truth/).length).toBeGreaterThan(0);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('uses ordered lifecycle semantics and keeps current stage separate from an action milestone', () => {
    render(<TrademarkLifecycleRail fixture={usMaintenanceFixture} />);

    const stageRail = screen.getByRole('list', { name: '商标生命周期阶段' });
    expect(within(stageRail).getAllByRole('listitem')).toHaveLength(5);
    const currentStage = within(stageRail).getByRole('button', { name: /第 5 阶段，维持/ });
    expect(currentStage).toHaveAttribute('aria-current', 'step');
    expect(currentStage).toHaveAttribute('aria-pressed', 'true');

    const milestoneRail = screen.getByRole('list', { name: '维持阶段详细节点' });
    const currentMilestone = within(milestoneRail).getByRole('button', {
      name: /§8 使用宣誓准备，当前阶段，规则计算窗口/
    });
    expect(currentMilestone).toHaveAttribute('aria-current', 'step');
    expect(currentMilestone).toHaveAttribute('aria-pressed', 'true');
    expect(currentMilestone).not.toBe(currentStage);
  });

  it('distinguishes source-recorded dates from MO prediction and never invents zero oppositions', async () => {
    const user = userEvent.setup();
    render(<TrademarkLifecycleRail fixture={euOppositionFixture} surfaceState="PARTIAL" />);

    await user.click(screen.getByRole('button', { name: /第 2 个节点，异议期/ }));
    expect(screen.getAllByText('来源记录结束日期（Lite 未核验）').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /第 4 阶段，注册/ }));
    await user.click(screen.getByRole('button', { name: /第 1 个节点，预计注册/ }));
    expect(screen.getAllByText('MO 预测').length).toBeGreaterThan(0);
    expect(screen.getAllByText('预计 2026年12月').length).toBeGreaterThan(0);
    expect(screen.getByText(/不是 EUIPO 承诺、期限或官方日期/)).toBeTruthy();
    expect(screen.getByText(/当前无法确认异议数量/)).toBeTruthy();
    expect(screen.queryByText(/0 oppositions/i)).toBeNull();
    expect(screen.queryByText(/0 个异议/)).toBeNull();
  });

  it('opens milestone detail by keyboard and returns focus to the exact node when closed', async () => {
    const user = userEvent.setup();
    render(<TrademarkLifecycleRail fixture={usMaintenanceFixture} />);

    const registrationStage = screen.getByRole('button', { name: /第 4 阶段，注册/ });
    await user.click(registrationStage);

    const registrationMilestone = screen.getByRole('button', {
      name: /第 1 个节点，注册记录/
    });
    expect(screen.queryByRole('heading', { level: 3, name: '注册记录' })).toBeNull();
    await user.click(registrationMilestone);

    const detailHeading = screen.getByRole('heading', { level: 3, name: '注册记录' });
    await waitFor(() => expect(detailHeading).toHaveFocus());

    await user.click(screen.getByRole('button', { name: '关闭详情' }));
    await waitFor(() => expect(registrationMilestone).toHaveFocus());
  });

  it('creates only a local handoff receipt and does not change lifecycle or navigate', async () => {
    const user = userEvent.setup();
    const startingUrl = window.location.href;
    render(<TrademarkLifecycleRail fixture={usMaintenanceFixture} />);

    const startButtons = screen.getAllByRole('button', { name: '开始准备（演示）' });
    expect(startButtons[0]).toBeEnabled();
    await user.click(startButtons[0]!);

    const handoffHeading = screen.getByRole('heading', { name: '准备进入受控工作台' });
    await waitFor(() => expect(handoffHeading).toHaveFocus());
    expect(screen.getByText(/不会自动创建工作、案件、订单、付款或报件/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '生成演示交接回执' }));
    expect(screen.getByText('已生成演示交接回执')).toBeTruthy();
    expect(screen.getByText(/未创建 Work、Matter、Order/)).toBeTruthy();
    expect(window.location.href).toBe(startingUrl);
    expect(
      screen.getByRole('button', { name: /第 5 阶段，维持/ }).getAttribute('aria-current')
    ).toBe('step');
    await user.click(screen.getByRole('button', { name: '返回资产' }));
    await waitFor(() => expect(startButtons[0]).toHaveFocus());
  });

  it('keeps unsafe action entry disabled for stale, partial, and limited coverage', () => {
    const { rerender } = render(
      <TrademarkLifecycleRail fixture={staleFixture} surfaceState="STALE" />
    );
    screen
      .getAllByRole('button', { name: '开始准备（演示）' })
      .forEach((button) => expect(button).toBeDisabled());

    rerender(<TrademarkLifecycleRail fixture={usMaintenanceFixture} surfaceState="PARTIAL" />);
    screen
      .getAllByRole('button', { name: '开始准备（演示）' })
      .forEach((button) => expect(button).toBeDisabled());

    rerender(
      <TrademarkLifecycleRail fixture={philippinesLimitedFixture} surfaceState="LIMITED_MANUAL" />
    );
    expect(screen.getByText('当前法域仅支持有限人工管理')).toBeTruthy();
    expect(screen.getByText(/不生成 DAU、续展或其他未来日期/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '开始准备（演示）' })).toBeNull();
  });

  it('keeps permission denial distinct and does not leak asset identity', () => {
    render(<TrademarkLifecycleRail fixture={usMaintenanceFixture} surfaceState="FORBIDDEN" />);

    expect(screen.getByText('需要商标资产查看权限')).toBeTruthy();
    expect(screen.queryByText('NORTH STAR')).toBeNull();
    expect(screen.queryByText('6,088,196')).toBeNull();
    expect(screen.queryByText('注册后维持')).toBeNull();
  });

  it('keeps stale and permission-denied adverse states accessible', async () => {
    const { container, rerender } = render(
      <TrademarkLifecycleRail fixture={staleFixture} surfaceState="STALE" />
    );
    expect((await axe(container)).violations).toEqual([]);

    rerender(<TrademarkLifecycleRail fixture={usMaintenanceFixture} surfaceState="FORBIDDEN" />);
    expect((await axe(container)).violations).toEqual([]);
  });

  it('renders compact portfolio cues from the same lifecycle fixtures without percentages', () => {
    render(
      <TrademarkLifecycleRail
        fixture={usMaintenanceFixture}
        mode="PORTFOLIO"
        portfolioFixtures={portfolioLifecycleFixtures}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: '商标资产' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'NORTH STAR 生命周期摘要' })).toBeTruthy();
    expect(screen.getByText('BLUE ORBIT')).toBeTruthy();
    expect(screen.getByText('ISLAND SIGNAL')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
