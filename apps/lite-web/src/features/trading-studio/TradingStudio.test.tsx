// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TradingStudioClient, TradingStudioState } from '../../api/trading-studio.js';
import { TradingStudioHttpError } from '../../api/trading-studio.js';
import { TradingStudio } from './TradingStudio.js';

const workspaceId = '81818181-8181-4818-8818-818181818181';
const studioRunId = 'standard-studio-run_ui' as const;

function state(selected = false): TradingStudioState {
  const directions = [
    ['best', 'BEST_FIT', 'Focused operator'],
    ['value', 'VALUE_UP', 'Premium system'],
    ['possible', 'POSSIBILITY', 'Category creator']
  ].map(([suffix, role, title]) => ({
    schemaVersion: 1,
    commercialDirectionId: `trading-ai-derived_commercial-direction_${suffix}`,
    version: 1,
    role,
    title,
    summary: `${title} summary`,
    rationale: `${title} rationale`,
    aiProfile: { id: 'trading-ai-derived_ai-profile_ui', version: 2 },
    thesis: `${title} connects a specific operator to a plausible launch path.`,
    targetConsumerRefs: ['trading-commercial-persona_consumer-ui'],
    operatorPersonaRefs: ['trading-commercial-persona_operator-ui'],
    trademarkBuyerPersonaRefs: ['trading-commercial-persona_buyer-ui'],
    sellingPointRefs: ['trading-selling-point_identity-ui'],
    buyingPointRefs: ['trading-buying-point_launch-ui'],
    scenarioRefs: ['trading-commercial-scenario_launch-ui'],
    riskNotes: ['Market demand remains unverified.'],
    constraints: ['Keep claims evidence-based'],
    status: 'CANDIDATE'
  }));
  return {
    run: {
      studioRunId,
      workspaceId,
      version: 3,
      currentness: 'CURRENT',
      status: 'COMPLETED',
      trademarkAsset: { id: 'trademark-asset_ui', version: 4 }
    },
    aiProfile: {
      aiProfileId: 'trading-ai-derived_ai-profile_ui',
      version: 2,
      commercialInsights: {
        schemaVersion: 1,
        evidenceCoverage: 'LIMITED',
        personas: [
          {
            commercialPersonaId: 'trading-commercial-persona_consumer-ui',
            kind: 'END_CONSUMER',
            label: 'Active consumer',
            summary: 'A possible audience for a future offer.'
          },
          {
            commercialPersonaId: 'trading-commercial-persona_operator-ui',
            kind: 'BUSINESS_OPERATOR',
            label: 'Focused operator',
            summary: 'An operator exploring a business around the asset.'
          },
          {
            commercialPersonaId: 'trading-commercial-persona_buyer-ui',
            kind: 'TRADEMARK_BUYER',
            label: 'Asset buyer',
            summary: 'A buyer assessing fit for a future launch.'
          }
        ],
        sellingPoints: [
          {
            sellingPointId: 'trading-selling-point_identity-ui',
            label: 'Concise identity',
            description: 'The supplied mark text is concise.',
            basisType: 'TRUTH_DERIVED'
          }
        ],
        buyingPoints: [
          {
            buyingPointId: 'trading-buying-point_launch-ui',
            label: 'Potential launch fit',
            description: 'The identity may suit a future launch.',
            sellingPointRefs: ['trading-selling-point_identity-ui'],
            personaRefs: ['trading-commercial-persona_buyer-ui']
          }
        ],
        scenarios: [
          {
            commercialScenarioId: 'trading-commercial-scenario_launch-ui',
            label: 'Focused launch',
            description: 'A possible launch path for the operator.'
          }
        ],
        evidenceBasis: [],
        assumptions: [
          {
            commercialAssumptionId: 'trading-commercial-assumption_demand-ui',
            label: 'Future demand',
            description: 'Market demand has not been established.'
          }
        ],
        limits: ['Evidence coverage does not predict commercial success.']
      }
    },
    brandDna: {
      brandDnaId: 'trading-ai-derived_brand-dna_ui',
      version: 1,
      brandPromise: 'A focused, evidence-aware brand direction for a future operator.',
      positioning: ['Focused and credible', 'Easy to understand'],
      constraints: ['Do not imply verified demand.']
    },
    directionSet: {
      commercialDirectionSetId: 'commercial-direction-set_ui',
      version: 1,
      aiProfile: { id: 'trading-ai-derived_ai-profile_ui', version: 2 },
      directions
    },
    selection: selected
      ? {
          selectedDirection: {
            id: 'trading-ai-derived_commercial-direction_best',
            version: 1
          }
        }
      : null
  } as unknown as TradingStudioState;
}

function client(initial: TradingStudioState) {
  const loadState = vi.fn<TradingStudioClient['loadState']>().mockResolvedValue(initial);
  const selectDirection = vi.fn<TradingStudioClient['selectDirection']>();
  return { api: { loadState, selectDirection }, loadState, selectDirection };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('Orbit Trading Studio direction comparison', () => {
  it('renders exactly the three semantic roles and the authority boundary', async () => {
    render(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={studioRunId}
        client={client(state()).api}
      />
    );

    expect(await screen.findByText('Best Fit')).toBeInTheDocument();
    expect(screen.getByText('Value Up')).toBeInTheDocument();
    expect(screen.getByText('Possibility')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Commercial Value Map' })).toBeInTheDocument();
    expect(screen.getByText('Active consumer')).toBeInTheDocument();
    expect(screen.getAllByText('Potential launch fit')).toHaveLength(4);
    expect(screen.getByText(/not Trademark Truth, verified market demand/u)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Choose/u })).toHaveLength(3);
    expect(screen.getByText(/Selection does not start Deep Build/u)).toBeInTheDocument();
    expect(screen.getAllByText('WHO')).toHaveLength(3);
    expect(screen.getAllByText('Focused launch')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Build this direction' })).not.toBeInTheDocument();
  });

  it('opens a visual workbench, creates a visible revision, compares, saves, restores and never implies production execution', async () => {
    render(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={studioRunId}
        client={client(state(true)).api}
        sellerValidationPrototype
        sellerValidationTrustedPrincipalId="person-a"
      />
    );

    await userEvent.click(await screen.findByRole('button', { name: '制作此方向' }));
    expect(await screen.findByText('商标视觉美化工作台')).toBeInTheDocument();
    expect(screen.getByText('原始商标不会被修改')).toBeInTheDocument();
    expect(screen.getByText('trademark-asset_ui@4')).toBeInTheDocument();
    expect(screen.getByText('demo-visual@1')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Focused operator · SVG 布局示意/u })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '应用结构化 Demo 调整' }));
    expect(screen.getByText('demo-visual@2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Demo v2/u })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '版本对比' }));
    expect(screen.getByLabelText('Demo 版本对比')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '保存 Demo 草稿' }));
    expect(screen.getByText(/个人 Demo 草稿/u)).toBeInTheDocument();
    expect(screen.getByText(/未调用模型/u)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByText('Trademark creative workbench')).toBeInTheDocument();
    expect(screen.getByText('trademark-asset_ui@4')).toBeInTheDocument();
    expect(screen.getByText('demo-visual@2')).toBeInTheDocument();
    expect(screen.getByText(/Personal Demo draft saved/u)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '中文' }));

    await userEvent.click(screen.getByRole('button', { name: '商业说明' }));
    expect(screen.getByRole('heading', { name: /Focused operator —/u })).toBeInTheDocument();
    expect(screen.getByText('Workspace 事实')).toBeInTheDocument();
    expect(screen.getByText('AI 解读')).toBeInTheDocument();
    expect(screen.getByText('未发布')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '发布边界' }));
    expect(screen.getByText('需要处理——未连接发布目的地')).toBeInTheDocument();
    expect(screen.getByText('尚未发布')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未开启发布' })).toBeDisabled();
  });

  it('keeps unsupported language as a pending note while structured controls deterministically change the Demo', async () => {
    render(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={studioRunId}
        client={client(state(true)).api}
        sellerValidationPrototype
        sellerValidationTrustedPrincipalId="person-a"
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: '制作此方向' }));
    await userEvent.type(screen.getByLabelText('待处理修改意见'), '让图形旋转并加入动画');
    await userEvent.selectOptions(screen.getByLabelText('使用场景'), 'WEB');
    await userEvent.selectOptions(screen.getByLabelText('颜色气质'), 'WARM');
    expect(screen.getByRole('img', { name: /WEB · Demo v2/u })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '应用结构化 Demo 调整' }));
    expect(screen.getByText(/修改意见已作为待处理文本保存/u)).toBeInTheDocument();
    expect(screen.getAllByText('让图形旋转并加入动画')).toHaveLength(2);
    expect(screen.getAllByText(/网站首页 · 温暖质感/u)).toHaveLength(2);
  });

  it('isolates browser drafts by trusted principal and restores only the matching person', async () => {
    const first = render(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={studioRunId}
        client={client(state(true)).api}
        sellerValidationPrototype
        sellerValidationTrustedPrincipalId="person-a"
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: '制作此方向' }));
    await userEvent.type(screen.getByLabelText('待处理修改意见'), '仅属于 A 的修改意见');
    await userEvent.selectOptions(screen.getByLabelText('颜色气质'), 'RESTRAINED');
    await userEvent.click(screen.getByRole('button', { name: '保存 Demo 草稿' }));
    first.unmount();

    const second = render(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={studioRunId}
        client={client(state(true)).api}
        sellerValidationPrototype
        sellerValidationTrustedPrincipalId="person-b"
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: '制作此方向' }));
    expect(screen.queryByText('仅属于 A 的修改意见')).not.toBeInTheDocument();
    expect(screen.getByText('demo-visual@1')).toBeInTheDocument();
    second.unmount();

    render(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={studioRunId}
        client={client(state(true)).api}
        sellerValidationPrototype
        sellerValidationTrustedPrincipalId="person-a"
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: '制作此方向' }));
    expect(await screen.findAllByText('仅属于 A 的修改意见')).toHaveLength(2);
    expect(screen.getByText('demo-visual@2')).toBeInTheDocument();
  });

  it('keeps memory state usable when browser storage reads and writes fail', async () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('read failed');
      }),
      setItem: vi.fn(() => {
        throw new Error('write failed');
      }),
      removeItem: vi.fn(() => {
        throw new Error('remove failed');
      })
    };
    render(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={studioRunId}
        client={client(state(true)).api}
        sellerValidationPrototype
        sellerValidationTrustedPrincipalId="person-a"
        sellerValidationStorage={storage}
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: '制作此方向' }));
    expect(await screen.findByText(/无法读取浏览器草稿/u)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('待处理修改意见'), '存储失败后仍可编辑');
    await userEvent.selectOptions(screen.getByLabelText('颜色气质'), 'WARM');
    await userEvent.click(screen.getByRole('button', { name: '保存 Demo 草稿' }));
    expect(screen.getByText(/浏览器存储不可用/u)).toBeInTheDocument();
    expect(screen.getAllByText('存储失败后仍可编辑')).toHaveLength(2);
    expect(screen.getByText('demo-visual@2')).toBeInTheDocument();
  });

  it('records one explicit exact-version choice and reloads durable owner state', async () => {
    const { api, loadState, selectDirection } = client(state());
    loadState.mockResolvedValueOnce(state()).mockResolvedValueOnce(state(true));
    selectDirection.mockResolvedValue(state(true).selection!);
    render(<TradingStudio workspaceId={workspaceId} studioRunId={studioRunId} client={api} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose Best Fit' }));

    await waitFor(() => expect(selectDirection).toHaveBeenCalledTimes(1));
    expect(selectDirection).toHaveBeenCalledWith(
      expect.objectContaining({
        directionSetId: 'commercial-direction-set_ui',
        expectedDirectionSetVersion: 1,
        selectedDirectionId: 'trading-ai-derived_commercial-direction_best',
        expectedDirectionVersion: 1
      })
    );
    expect(await screen.findByRole('button', { name: 'Selected' })).toBeDisabled();
    expect(loadState).toHaveBeenCalledTimes(2);
  });

  it('retains one idempotency key until durable reload confirms the choice', async () => {
    const { api, loadState, selectDirection } = client(state());
    loadState.mockResolvedValue(state());
    selectDirection.mockResolvedValue(state(true).selection!);
    render(<TradingStudio workspaceId={workspaceId} studioRunId={studioRunId} client={api} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose Best Fit' }));
    expect(await screen.findByText('Studio state changed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose Best Fit' }));

    await waitFor(() => expect(selectDirection).toHaveBeenCalledTimes(2));
    const firstKey = selectDirection.mock.calls[0]![0].idempotencyKey;
    expect(selectDirection.mock.calls[1]![0].idempotencyKey).toBe(firstKey);
  });

  it('fails closed for stale and partial owner state', async () => {
    const stale = state();
    (stale.run as { currentness: string }).currentness = 'STALE';
    const { rerender } = render(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={studioRunId}
        client={client(stale).api}
      />
    );
    expect(await screen.findByText('Source version is stale')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Choose/u })[0]).toBeDisabled();

    const partial = state();
    (partial.directionSet as unknown as { directions: unknown[] }).directions =
      partial.directionSet!.directions.slice(0, 2);
    rerender(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={'standard-studio-run_partial'}
        client={client(partial).api}
      />
    );
    expect(await screen.findByText('Incomplete direction set')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Choose/u })).not.toBeInTheDocument();
  });

  it('distinguishes permission failure from an empty run', async () => {
    const denied = client(state());
    denied.loadState.mockRejectedValue(
      new TradingStudioHttpError(403, 'PERMISSION_DENIED', 'Forbidden')
    );
    const { rerender } = render(
      <TradingStudio workspaceId={workspaceId} studioRunId={studioRunId} client={denied.api} />
    );
    expect(await screen.findByText('Studio access unavailable')).toBeInTheDocument();

    const empty = client({ ...state(), directionSet: null });
    rerender(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={'standard-studio-run_empty'}
        client={empty.api}
      />
    );
    expect(await screen.findByText('Directions are not ready')).toBeInTheDocument();
  });

  it('distinguishes a missing profile from a legacy profile without commercial insights', async () => {
    const missing = client({ ...state(), aiProfile: null });
    const { rerender } = render(
      <TradingStudio workspaceId={workspaceId} studioRunId={studioRunId} client={missing.api} />
    );
    expect(await screen.findByText('Commercial Value Map is not ready')).toBeInTheDocument();

    const legacy = state();
    (legacy as unknown as { aiProfile: object }).aiProfile = {
      ...legacy.aiProfile,
      commercialInsights: undefined
    };
    rerender(
      <TradingStudio
        workspaceId={workspaceId}
        studioRunId={'standard-studio-run_legacy'}
        client={client(legacy).api}
      />
    );
    expect(
      await screen.findByText('Commercial Value Map is unavailable for this profile')
    ).toBeInTheDocument();
  });
});
