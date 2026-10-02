import type { Meta, StoryObj } from '@storybook/react';
import type { TradingStudioClient, TradingStudioState } from '../../api/trading-studio.js';
import { TradingStudioHttpError } from '../../api/trading-studio.js';
import {
  selectedTradingStudioPreviewState,
  tradingStudioPreviewState,
  TRADING_STUDIO_PREVIEW_RUN_ID,
  TRADING_STUDIO_PREVIEW_WORKSPACE_ID
} from './preview-fixture.js';
import { TradingStudio } from './TradingStudio.js';
const state = tradingStudioPreviewState;

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
  workspaceId: TRADING_STUDIO_PREVIEW_WORKSPACE_ID,
  studioRunId: TRADING_STUDIO_PREVIEW_RUN_ID
};

export const ReadyToChoose: Story = { args: { ...base, client: client(state) } };
export const CreativeDirectionsWithVisuals: Story = {
  args: { ...base, client: client(state), sellerValidationPrototype: true }
};
export const Selected: Story = {
  args: {
    ...base,
    client: client(selectedTradingStudioPreviewState())
  }
};
export const SellerValidationPrototype: Story = {
  args: {
    ...Selected.args,
    sellerValidationPrototype: true,
    sellerValidationTrustedPrincipalId: 'storybook-person-a'
  },
  play: ({ canvasElement }) => {
    Array.from(canvasElement.querySelectorAll('button'))
      .find((button) => button.textContent === '制作此方向')
      ?.click();
  }
};
export const SellerValidationPrototypeMobile390: Story = {
  ...SellerValidationPrototype,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
export const CreativeNoMaterials: Story = {
  ...SellerValidationPrototype,
  args: { ...SellerValidationPrototype.args, sellerValidationScenario: 'NO_MATERIALS' }
};
export const CreativePartialOutput: Story = {
  ...SellerValidationPrototype,
  args: { ...SellerValidationPrototype.args, sellerValidationScenario: 'PARTIAL' }
};
export const CreativeRunning: Story = {
  ...SellerValidationPrototype,
  args: { ...SellerValidationPrototype.args, sellerValidationScenario: 'RUNNING' }
};
export const CreativeQaFailed: Story = {
  ...SellerValidationPrototype,
  args: { ...SellerValidationPrototype.args, sellerValidationScenario: 'QA_FAILED' }
};
const unavailableStorage = {
  getItem(): string | null {
    throw new Error('Demo storage unavailable');
  },
  setItem(): void {
    throw new Error('Demo storage unavailable');
  },
  removeItem(): void {
    throw new Error('Demo storage unavailable');
  }
};

export const CreativeStorageUnavailable: Story = {
  ...SellerValidationPrototype,
  args: { ...SellerValidationPrototype.args, sellerValidationStorage: unavailableStorage }
};
export const CreativeSessionOnlyDraft: Story = {
  ...SellerValidationPrototype,
  args: {
    ...SellerValidationPrototype.args,
    sellerValidationTrustedPrincipalId: undefined
  }
};
export const CreativeUserA: Story = {
  ...SellerValidationPrototype,
  args: {
    ...SellerValidationPrototype.args,
    sellerValidationTrustedPrincipalId: 'storybook-person-a'
  }
};
export const CreativeUserB: Story = {
  ...SellerValidationPrototype,
  args: {
    ...SellerValidationPrototype.args,
    sellerValidationTrustedPrincipalId: 'storybook-person-b'
  }
};
export const CreativeSavedAndRestored: Story = {
  ...SellerValidationPrototype,
  args: { ...SellerValidationPrototype.args, sellerValidationScenario: 'SAVED' }
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
export const LegacyProfileWithoutValueMap: Story = {
  args: {
    ...base,
    client: client({
      ...state,
      aiProfile: { ...state.aiProfile, commercialInsights: undefined }
    } as unknown as TradingStudioState)
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
