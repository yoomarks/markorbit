import type { Meta, StoryObj } from '@storybook/react';
import type { TradingStudioClient, TradingStudioState } from '../../api/trading-studio.js';
import { TradingStudioHttpError } from '../../api/trading-studio.js';
import { TradingStudio } from './TradingStudio.js';

const state = {
  run: { studioRunId: 'standard-studio-run_story', currentness: 'CURRENT', status: 'COMPLETED' },
  directionSet: {
    commercialDirectionSetId: 'commercial-direction-set_story',
    version: 1,
    directions: [
      {
        commercialDirectionId: 'trading-ai-derived_commercial-direction_story-best',
        version: 1,
        role: 'BEST_FIT',
        title: 'Focused operator',
        summary: 'A clear, credible route grounded in the strongest existing signals.',
        rationale: 'Balances differentiation with immediate comprehension.',
        constraints: ['Keep claims evidence-based']
      },
      {
        commercialDirectionId: 'trading-ai-derived_commercial-direction_story-value',
        version: 1,
        role: 'VALUE_UP',
        title: 'Premium system',
        summary: 'Elevates the mark into a higher-value service and experience system.',
        rationale: 'Creates room for premium positioning without implying verified market value.',
        constraints: ['Avoid unverified leadership claims']
      },
      {
        commercialDirectionId: 'trading-ai-derived_commercial-direction_story-possible',
        version: 1,
        role: 'POSSIBILITY',
        title: 'Category creator',
        summary: 'Explores a more imaginative adjacent category opportunity.',
        rationale: 'Tests distinctive potential while keeping the concept explicitly speculative.',
        constraints: ['Validate category fit before investment']
      }
    ]
  },
  selection: null
} as unknown as TradingStudioState;

const client = (value: TradingStudioState | Error): TradingStudioClient => ({
  loadState: () => (value instanceof Error ? Promise.reject(value) : Promise.resolve(value)),
  selectDirection: () => Promise.reject(new Error('Fixture mutation is disabled.'))
});

export default {
  title: 'Products/Lite/Orbit Trading Studio',
  component: TradingStudio,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof TradingStudio>;
type Story = StoryObj<typeof TradingStudio>;
const base = {
  workspaceId: '81818181-8181-4818-8818-818181818181',
  studioRunId: 'standard-studio-run_story' as const
};

export const ReadyToChoose: Story = { args: { ...base, client: client(state) } };
export const Selected: Story = {
  args: {
    ...base,
    client: client({
      ...state,
      selection: {
        selectedDirection: {
          id: state.directionSet!.directions[0].commercialDirectionId,
          version: 1
        }
      }
    } as unknown as TradingStudioState)
  }
};
export const Empty: Story = { args: { ...base, client: client({ ...state, directionSet: null }) } };
export const Stale: Story = {
  args: {
    ...base,
    client: client({
      ...state,
      run: { ...state.run, currentness: 'STALE' }
    } as unknown as TradingStudioState)
  }
};
export const PermissionDenied: Story = {
  args: {
    ...base,
    client: client(new TradingStudioHttpError(403, 'PERMISSION_DENIED', 'Forbidden'))
  }
};
export const ReadyToChooseMobile390: Story = {
  ...ReadyToChoose,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
