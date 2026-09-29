import type { Meta, StoryObj } from '@storybook/react';
import type { TradingStudioClient, TradingStudioState } from '../../api/trading-studio.js';
import { TradingStudioHttpError } from '../../api/trading-studio.js';
import { TradingStudio } from './TradingStudio.js';

const commercialDirectionContext = {
  aiProfile: { id: 'trading-ai-derived_ai-profile_story', version: 2 },
  targetConsumerRefs: ['trading-commercial-persona_consumer-story'],
  operatorPersonaRefs: ['trading-commercial-persona_operator-story'],
  trademarkBuyerPersonaRefs: ['trading-commercial-persona_buyer-story'],
  sellingPointRefs: ['trading-selling-point_clarity-story'],
  buyingPointRefs: ['trading-buying-point_launch-story'],
  scenarioRefs: ['trading-commercial-scenario_launch-story'],
  evidenceRefs: ['trading-commercial-evidence_asset-story'],
  assumptionRefs: ['trading-commercial-assumption_demand-story'],
  riskNotes: ['Market demand remains unverified.']
} as const;

const state = {
  run: {
    studioRunId: 'standard-studio-run_story',
    workspaceId: '81818181-8181-4818-8818-818181818181',
    version: 3,
    currentness: 'CURRENT',
    status: 'COMPLETED',
    trademarkAsset: { id: 'trademark-asset_story', version: 4 }
  },
  aiProfile: {
    aiProfileId: 'trading-ai-derived_ai-profile_story',
    version: 2,
    commercialInsights: {
      schemaVersion: 1,
      evidenceCoverage: 'LIMITED',
      personas: [
        {
          commercialPersonaId: 'trading-commercial-persona_consumer-story',
          kind: 'END_CONSUMER',
          label: 'Design-aware customer',
          summary: 'A possible customer seeking an accessible, modern offer.'
        },
        {
          commercialPersonaId: 'trading-commercial-persona_operator-story',
          kind: 'BUSINESS_OPERATOR',
          label: 'Focused operator',
          summary: 'An operator exploring a tightly positioned offer.'
        },
        {
          commercialPersonaId: 'trading-commercial-persona_buyer-story',
          kind: 'TRADEMARK_BUYER',
          label: 'Launch-oriented buyer',
          summary: 'A buyer assessing whether the asset supports a future launch.'
        }
      ],
      sellingPoints: [
        {
          sellingPointId: 'trading-selling-point_clarity-story',
          label: 'Clear identity',
          description: 'The supplied identity is concise and easy to scan.',
          basisType: 'TRUTH_DERIVED'
        }
      ],
      buyingPoints: [
        {
          buyingPointId: 'trading-buying-point_launch-story',
          label: 'Potential launch fit',
          description: 'The concise identity may help a buyer frame a future launch.',
          sellingPointRefs: ['trading-selling-point_clarity-story'],
          personaRefs: ['trading-commercial-persona_buyer-story']
        }
      ],
      scenarios: [
        {
          commercialScenarioId: 'trading-commercial-scenario_launch-story',
          label: 'Possible launch',
          description: 'A hypothetical launch scenario, not an existing business fact.'
        }
      ],
      evidenceBasis: [
        {
          commercialEvidenceId: 'trading-commercial-evidence_asset-story',
          label: 'Supplied Trademark Asset',
          sourceType: 'TRADEMARK_ASSET'
        }
      ],
      assumptions: [
        {
          commercialAssumptionId: 'trading-commercial-assumption_demand-story',
          label: 'Future demand',
          description: 'Market demand has not been established.',
          risk: 'HIGH'
        }
      ],
      limits: ['Evidence coverage is qualitative and does not predict commercial success.']
    }
  },
  brandDna: {
    brandDnaId: 'trading-ai-derived_brand-dna_story',
    version: 1,
    brandPromise: 'A focused identity system that can support a credible future launch.',
    positioning: ['Focused and credible', 'Accessible modern offer'],
    constraints: ['Do not present imagined demand as fact.']
  },
  directionSet: {
    commercialDirectionSetId: 'commercial-direction-set_story',
    version: 1,
    aiProfile: { id: 'trading-ai-derived_ai-profile_story', version: 2 },
    directions: [
      {
        ...commercialDirectionContext,
        commercialDirectionId: 'trading-ai-derived_commercial-direction_story-best',
        version: 1,
        role: 'BEST_FIT',
        title: 'Focused operator',
        summary: 'A clear, credible route grounded in the strongest existing signals.',
        rationale: 'Balances differentiation with immediate comprehension.',
        thesis: 'A focused operator can turn the clear identity into an accessible launch.',
        constraints: ['Keep claims evidence-based']
      },
      {
        ...commercialDirectionContext,
        commercialDirectionId: 'trading-ai-derived_commercial-direction_story-value',
        version: 1,
        role: 'VALUE_UP',
        title: 'Premium system',
        summary: 'Elevates the mark into a higher-value service and experience system.',
        rationale: 'Creates room for premium positioning without implying verified market value.',
        thesis: 'A premium operator can build a higher-touch system around the same identity.',
        constraints: ['Avoid unverified leadership claims']
      },
      {
        ...commercialDirectionContext,
        commercialDirectionId: 'trading-ai-derived_commercial-direction_story-possible',
        version: 1,
        role: 'POSSIBILITY',
        title: 'Category creator',
        summary: 'Explores a more imaginative adjacent category opportunity.',
        rationale: 'Tests distinctive potential while keeping the concept explicitly speculative.',
        thesis: 'An exploratory operator can test an adjacent category without claiming demand.',
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
export const CreativeDirectionsWithVisuals: Story = {
  args: { ...base, client: client(state), sellerValidationPrototype: true }
};
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
