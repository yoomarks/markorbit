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
    constraints: ['Keep claims evidence-based'],
    status: 'CANDIDATE'
  }));
  return {
    run: {
      studioRunId,
      currentness: 'CURRENT',
      status: 'COMPLETED'
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
        scenarios: [],
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
    directionSet: {
      commercialDirectionSetId: 'commercial-direction-set_ui',
      version: 1,
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

afterEach(cleanup);

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
    expect(screen.getByText('Potential launch fit')).toBeInTheDocument();
    expect(screen.getByText(/not Trademark Truth, verified market demand/u)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Choose/u })).toHaveLength(3);
    expect(screen.getByText(/Selection does not start Deep Build/u)).toBeInTheDocument();
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
