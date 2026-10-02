import type { TradingStudioState } from '../../api/trading-studio.js';

export const TRADING_STUDIO_PREVIEW_WORKSPACE_ID = '81818181-8181-4818-8818-818181818181';
export const TRADING_STUDIO_PREVIEW_RUN_ID = 'standard-studio-run_story' as const;

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

export const tradingStudioPreviewState = {
  run: {
    studioRunId: TRADING_STUDIO_PREVIEW_RUN_ID,
    workspaceId: TRADING_STUDIO_PREVIEW_WORKSPACE_ID,
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

export function selectedTradingStudioPreviewState(): TradingStudioState {
  const direction = tradingStudioPreviewState.directionSet!.directions[0];
  return {
    ...tradingStudioPreviewState,
    selection: {
      selectedDirection: { id: direction.commercialDirectionId, version: direction.version }
    }
  } as unknown as TradingStudioState;
}
