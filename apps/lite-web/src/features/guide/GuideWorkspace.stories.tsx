import type { Meta, StoryObj } from '@storybook/react';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import { TrademarkAssetHttpError, type TrademarkAssetClient } from '../../api/trademark-assets.js';
import { GuideWorkspace } from './GuideWorkspace.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_guide_story',
  sourceVersion: '12',
  observedAt: '2026-09-05T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const view: TrademarkAssetView = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_guide-story',
  workspaceId,
  anchorVersion: 9,
  anchor: {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_guide-story',
    workspaceId,
    version: 9,
    identity: { jurisdiction: 'US', markText: 'NORTH STAR' },
    externalIdentifiers: [],
    workspaceRelationships: [{ kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }],
    sourceReferences: [source],
    relations: [],
    workspaceTags: ['guide-ready'],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z'
  },
  observedFacts: [],
  contextSignals: [],
  conflicts: [],
  sourceReferences: [source],
  freshness: 'CURRENT',
  composedAt: '2026-09-05T00:01:00.000Z',
  officialTruthVerifiedByLite: false,
  legalDeadlineCertified: false,
  protectedActionAuthorized: false
};

function storyClient(overrides: Partial<TrademarkAssetClient> = {}): TrademarkAssetClient {
  return {
    search: () =>
      Promise.resolve({
        schemaVersion: 1,
        workspaceId,
        assets: [view.anchor],
        hasMore: false,
        officialTruthVerifiedByLite: false,
        management: {
          totalSignals: 0,
          urgentSignals: 0,
          importantSignals: 0,
          changedAssets: 0,
          generatedAt: '2026-09-05T00:00:00.000Z'
        },
        managementByAsset: []
      }),
    load: () => Promise.resolve({ view, commerceProfile: null }),
    loadManagementDispositions: () => Promise.reject(new Error('not used in Guide story')),
    recordManagementDisposition: () => Promise.reject(new Error('not used in Guide story')),
    prepareAiGuide: () => Promise.reject(new Error('Story does not submit AI guidance.')),
    saveCommerceProfile: () => Promise.reject(new Error('not used in Guide story')),
    loadServiceWorkPackage: () => Promise.reject(new Error('not used in Guide story')),
    prepareServiceWorkPackage: () => Promise.reject(new Error('not used in Guide story')),
    ...overrides
  };
}

const meta = {
  title: 'Lite/Guide/Contextual AI Guide',
  component: GuideWorkspace,
  parameters: { layout: 'fullscreen' },
  args: { workspaceId, client: storyClient() }
} satisfies Meta<typeof GuideWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AssetChooser: Story = {};

export const ExactAssetContext: Story = {
  args: {
    initialTrademarkAssetId: view.trademarkAssetId,
    initialTrademarkAssetVersion: 9
  }
};

export const VersionDriftMobile390: Story = {
  args: {
    initialTrademarkAssetId: view.trademarkAssetId,
    initialTrademarkAssetVersion: 8
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile390',
      viewports: {
        mobile390: { name: '390px mobile', styles: { width: '390px', height: '844px' } }
      }
    }
  }
};

export const ExplicitAssetUnavailable: Story = {
  args: {
    initialTrademarkAssetId: view.trademarkAssetId,
    client: storyClient({
      load: () =>
        Promise.reject(
          new TrademarkAssetHttpError(
            503,
            'DOWNSTREAM_UNAVAILABLE',
            'Asset source unavailable.',
            true
          )
        )
    })
  }
};
