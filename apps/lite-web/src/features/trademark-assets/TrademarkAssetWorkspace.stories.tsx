import type { Meta, StoryObj } from '@storybook/react';
import type { TrademarkAssetCommerceProfile } from '@markorbit/contracts/trademark-asset-commerce';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import { TrademarkAssetWorkspace } from './TrademarkAssetWorkspace.js';

const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_story',
  sourceVersion: '3',
  observedAt: '2026-09-01T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const view: TrademarkAssetView = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_story',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  anchorVersion: 3,
  anchor: {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_story',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 3,
    identity: { jurisdiction: 'US', markText: 'NORTH STAR' },
    externalIdentifiers: [],
    workspaceRelationships: [{ kind: 'OWNED', sourceAssetEditableByWorkspace: true }],
    sourceReferences: [source],
    relations: [],
    workspaceTags: [],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  },
  observedFacts: [
    {
      kind: 'OWNER_NAME',
      value: 'North Star Holdings',
      source,
      freshness: 'CURRENT',
      consequential: true,
      officialTruthVerifiedByLite: false
    }
  ],
  contextSignals: [],
  conflicts: [],
  sourceReferences: [source],
  freshness: 'CURRENT',
  composedAt: '2026-09-01T00:00:00.000Z',
  officialTruthVerifiedByLite: false,
  legalDeadlineCertified: false,
  protectedActionAuthorized: false
};

const profile: TrademarkAssetCommerceProfile = {
  schemaVersion: 1,
  commerceProfileId: 'trademark-asset-commerce_story',
  workspaceId: view.workspaceId,
  trademarkAssetId: view.trademarkAssetId,
  trademarkAssetVersion: 3,
  version: 2,
  saleIntent: 'FOR_SALE',
  askingPrice: { amountMinor: 12500000, currency: 'USD' },
  negotiable: true,
  saleTerritories: ['US', 'CA'],
  sellerRole: 'OWNER',
  headline: 'Established NORTH STAR brand context',
  sellingPoints: ['Longstanding workspace record', 'Prepared media references'],
  aiTags: ['consumer', 'north-america'],
  showcaseTemplateReference: 'showcase_professional',
  mediaAssetReferences: ['media_wordmark', 'media_specimen'],
  marketplaceListingCreatedByLite: false,
  sourceTrademarkFactsMutatedByLite: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T02:00:00.000Z'
};

const meta = {
  title: 'Lite/Trademark Asset/Sell-side Workspace',
  component: TrademarkAssetWorkspace,
  parameters: { layout: 'fullscreen' },
  args: { view }
} satisfies Meta<typeof TrademarkAssetWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoCommerceProfile: Story = {
  args: {
    onSaveCommerceProfile: () => Promise.resolve(profile)
  }
};

export const ExistingCommerceProfile: Story = {
  args: {
    commerceProfile: profile,
    onSaveCommerceProfile: () => Promise.resolve({ ...profile, version: profile.version + 1 })
  }
};

export const MarketplaceAddedReadOnly: Story = {
  args: {
    view: {
      ...view,
      anchor: {
        ...view.anchor,
        workspaceRelationships: [
          { kind: 'MARKETPLACE_ADDED', sourceAssetEditableByWorkspace: false }
        ]
      }
    },
    commerceProfile: profile
  }
};

export const NarrowCommerceProfile: Story = {
  args: {
    commerceProfile: profile,
    onSaveCommerceProfile: () => Promise.resolve(profile)
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' }
  }
};
