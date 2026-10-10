import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationMaterialsReview } from '../src/ApplicationMaterialsReview.js';
import {
  partialConflictFixture,
  readyForHandoffFixture,
  unsupportedFixture
} from '../src/application-materials-review-fixtures.js';

afterEach(cleanup);

describe('ApplicationMaterialsReview', () => {
  it('presents a fixture-only, bilingual preparation workbench with exact authority boundaries', async () => {
    const { container } = render(
      <ApplicationMaterialsReview fixture={partialConflictFixture} surfaceState="WORKING" />
    );

    expect(screen.getByText(/Demonstration only/i)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '申请资料核对' })).toBeTruthy();
    expect(screen.getByText('Application Materials Review')).toBeTruthy();
    expect(screen.getByText('仅用于资料准备；未形成法律意见，未提交申请。')).toBeTruthy();
    expect(
      screen.getByText(
        'For application-material preparation only; no legal opinion has been formed and no application has been filed.'
      )
    ).toBeTruthy();
    expect(screen.getAllByText('来源冲突').length).toBeGreaterThan(0);
    expect(screen.getByText('Orbit Atlas LLC')).toBeTruthy();
    expect(screen.getByText('Orbit Atlas Inc.')).toBeTruthy();
    expect(screen.getByText(/MO 不会自动选择/)).toBeTruthy();
    expect(screen.queryByText('一键报件')).toBeNull();
    expect(screen.queryByText('完成申请')).toBeNull();
    expect(screen.queryByText('申请已提交')).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('records only a proposed conflict value and keeps owner data unchanged', async () => {
    const user = userEvent.setup();
    render(<ApplicationMaterialsReview fixture={partialConflictFixture} />);

    const proposeButtons = screen.getAllByRole('button', { name: '记录为本次拟采用值' });
    await user.click(proposeButtons[1]!);

    expect(screen.getByRole('button', { name: '已记录为本次拟采用值' })).toBeTruthy();
    expect(screen.getByText(/仍需保存核对结果，且不会修改来源 Owner/)).toBeTruthy();
    expect(screen.getByText('Orbit Atlas LLC')).toBeTruthy();
    expect(screen.getByText('Orbit Atlas Inc.')).toBeTruthy();
  });

  it('prepares editable questions without sending a message or changing formal state', async () => {
    const user = userEvent.setup();
    render(<ApplicationMaterialsReview fixture={partialConflictFixture} />);

    await user.click(screen.getByRole('button', { name: /生成待问清单/ }));

    expect(screen.getByRole('heading', { name: '待问清单（草稿，未发送）' })).toBeTruthy();
    expect(screen.getByText('不会自动发送')).toBeTruthy();
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.getByText(/不会创建站内信、邮件、客户通知/)).toBeTruthy();
  });

  it('saves only a non-authoritative fixture snapshot with the locked success copy', async () => {
    const user = userEvent.setup();
    render(<ApplicationMaterialsReview fixture={partialConflictFixture} />);

    await user.click(screen.getByRole('button', { name: /保存核对结果/ }));

    expect(screen.getByText('演示快照已保存')).toBeTruthy();
    expect(
      screen.getByText(
        '本次资料核对结果已保存，可交由下一步复核。尚未形成法律意见，也未提交任何商标申请。'
      )
    ).toBeTruthy();
    expect(screen.getByText(/Fixture receipt/)).toBeTruthy();
  });

  it('demonstrates handler handoff without creating professional review or filing state', async () => {
    const user = userEvent.setup();
    render(<ApplicationMaterialsReview fixture={readyForHandoffFixture} />);

    const handoff = screen.getByRole('button', { name: /提交经办复核/ });
    expect(handoff).toBeEnabled();
    await user.click(handoff);
    expect(screen.getByRole('heading', { name: '确认提交经办复核？' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '确认提交经办复核（演示）' }));
    expect(screen.getByText('已记录经办复核请求（界面演示）')).toBeTruthy();
    expect(screen.getByText(/未创建或推进 Professional Review owner 状态/)).toBeTruthy();
  });

  it('blocks unsafe save and handoff when the pinned source version is stale', () => {
    render(<ApplicationMaterialsReview fixture={partialConflictFixture} surfaceState="STALE" />);

    expect(screen.getByText('来源版本已变化，旧快照仅供比较')).toBeTruthy();
    expect(screen.getByRole('button', { name: /保存核对结果/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /提交经办复核/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /生成待问清单/ })).toBeEnabled();
  });

  it('keeps permission denial and unsupported scope distinct without leaking case values', () => {
    const { rerender } = render(
      <ApplicationMaterialsReview fixture={partialConflictFixture} surfaceState="FORBIDDEN" />
    );
    expect(screen.getByText('需要申请资料准备权限')).toBeTruthy();
    expect(screen.queryByText('ORBIT ATLAS')).toBeNull();
    expect(screen.queryByText('Orbit Atlas LLC')).toBeNull();

    rerender(
      <ApplicationMaterialsReview fixture={unsupportedFixture} surfaceState="UNSUPPORTED" />
    );
    expect(screen.getByText('当前申请范围暂不支持')).toBeTruthy();
    expect(screen.getByText(/包含两个申请人/)).toBeTruthy();
    expect(screen.queryByText('Orbit Atlas LLC')).toBeNull();
  });
});
