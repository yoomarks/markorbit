import type { Meta, StoryObj } from '@storybook/react';
import type { TrademarkAssetAiGuidePreparedResult } from '@markorbit/contracts/trademark-asset-ai-guide';
import type { TrademarkAssetCommerceProfile } from '@markorbit/contracts/trademark-asset-commerce';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type {
  TrademarkAssetManagementDisposition,
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementSignal
} from '@markorbit/contracts/trademark-asset-management';
import { TrademarkAssetWorkspace } from './TrademarkAssetWorkspace.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
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
  workspaceId,
  anchorVersion: 3,
  anchor: {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_story',
    workspaceId,
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

const managementSignal: TrademarkAssetManagementSignal = {
  schemaVersion: 1,
  managementSignalId: 'trademark-asset-management-signal_story',
  workspaceId,
  version: 4,
  asset: { id: view.trademarkAssetId, version: view.anchor.version },
  dimension: 'USER_PRIORITY',
  severity: 'IMPORTANT',
  reason: 'Review this private Product signal before deciding the next step.',
  changes: [],
  evidence: [source],
  freshness: 'CURRENT',
  generatedAt: '2026-09-03T01:00:00.000Z',
  legalDeadlineCertified: false,
  officialStatusVerifiedByLite: false,
  legalConclusionVerified: false,
  conflictResolvedByLite: false,
  executionAuthorized: false
};

const managementRecommendation: TrademarkAssetManagementRecommendation = {
  schemaVersion: 1,
  recommendationId: 'trademark-asset-management-recommendation_story',
  workspaceId,
  version: 2,
  asset: { id: view.trademarkAssetId, version: view.anchor.version },
  signalReferences: [
    { id: managementSignal.managementSignalId, version: managementSignal.version }
  ],
  kind: 'WATCH',
  title: 'Keep under private review',
  explanation: 'This recommendation remains Product guidance, not official or execution truth.',
  evidence: [source],
  relatedOwnerReferences: [],
  staleOrConflictingEvidencePresent: false,
  userConfirmationRequired: true,
  officialTruthVerified: false,
  legalDeadlineCertified: false,
  filingAuthorized: false,
  customerOrProviderContactAuthorized: false,
  externalPublicationAuthorized: false,
  paidExecutionAuthorized: false,
  capabilityVerified: false,
  createdAt: '2026-09-03T01:00:00.000Z'
};

function disposition(kind: TrademarkAssetManagementDisposition['kind']) {
  return {
    schemaVersion: 1,
    dispositionId: `trademark-asset-management-disposition_story-${kind.toLowerCase()}`,
    workspaceId,
    version: 1,
    asset: { id: view.trademarkAssetId, version: view.anchor.version },
    signal: { id: managementSignal.managementSignalId, version: managementSignal.version },
    recommendation: {
      id: managementRecommendation.recommendationId,
      version: managementRecommendation.version
    },
    kind,
    subjectUserId: 'fixture-user',
    recordedAt: '2026-09-03T01:05:00.000Z',
    officialTruthCreated: false,
    legalConclusionVerified: false,
    capabilityVerified: false
  } as TrademarkAssetManagementDisposition;
}

function dispositionProjection(value: TrademarkAssetManagementDisposition | null) {
  return {
    schemaVersion: 1 as const,
    workspaceId,
    asset: { id: view.trademarkAssetId, version: view.anchor.version },
    items: [
      {
        signal: { id: managementSignal.managementSignalId, version: managementSignal.version },
        disposition: value
      }
    ]
  };
}

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

const aiGuideResult: TrademarkAssetAiGuidePreparedResult = {
  schemaVersion: 1,
  workspaceId: view.workspaceId,
  subjectUserId: 'fixture-user',
  trademarkAssetId: view.trademarkAssetId,
  trademarkAssetVersion: view.anchorVersion,
  contextReferences: [
    {
      kind: 'ASSET_COMPOSITION',
      referenceId: view.trademarkAssetId,
      referenceVersion: String(view.anchorVersion),
      fingerprintSha256: 'fixture-composition-fingerprint'
    },
    {
      kind: 'COMMERCE_PROFILE',
      referenceId: profile.commerceProfileId,
      referenceVersion: String(profile.version)
    }
  ],
  evidence: [source],
  suggestions: [
    {
      schemaVersion: 1,
      aiGuideSuggestionId: 'ai-guide-suggestion_story-explain',
      workspaceId: view.workspaceId,
      version: 1,
      asset: { id: view.trademarkAssetId, version: view.anchorVersion },
      kind: 'EXPLAIN_ASSET',
      title: 'Asset context summary',
      explanation:
        'The current owner evidence identifies North Star Holdings. This is advisory explanation, not official verification.',
      evidence: [source],
      staleOrConflictingEvidencePresent: false,
      userConfirmationRequiredForAnyConsequence: true,
      externalActionAuthorized: false,
      filingAuthorized: false,
      customerOrProviderContactAuthorized: false,
      paidExecutionAuthorized: false,
      officialTruthVerified: false,
      capabilityVerified: false,
      createdAt: '2026-09-02T09:00:00.000Z'
    },
    {
      schemaVersion: 1,
      aiGuideSuggestionId: 'ai-guide-suggestion_story-checklist',
      workspaceId: view.workspaceId,
      version: 1,
      asset: { id: view.trademarkAssetId, version: view.anchorVersion },
      kind: 'PREPARE_CHECKLIST',
      title: 'Evidence review checklist',
      explanation:
        'Review source freshness, ownership evidence, and any unresolved observations before consequential work.',
      evidence: [source],
      staleOrConflictingEvidencePresent: false,
      userConfirmationRequiredForAnyConsequence: true,
      externalActionAuthorized: false,
      filingAuthorized: false,
      customerOrProviderContactAuthorized: false,
      paidExecutionAuthorized: false,
      officialTruthVerified: false,
      capabilityVerified: false,
      createdAt: '2026-09-02T09:00:00.000Z'
    }
  ],
  staleOrConflictingEvidencePresent: false,
  officialTruthCreatedByGuide: false,
  officialStatusVerifiedByGuide: false,
  deadlineCertifiedByGuide: false,
  externalActionAuthorizedByGuide: false,
  customerOrProviderContactAuthorizedByGuide: false,
  paidExecutionAuthorizedByGuide: false,
  generatedAt: '2026-09-02T09:00:00.000Z'
};

const durableManagementArgs = {
  managementSignals: [managementSignal],
  recommendations: [managementRecommendation],
  onRecordManagementDisposition: () => Promise.resolve(disposition('WATCHED')),
  onReloadManagementDispositions: () => Promise.resolve(dispositionProjection(null))
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

export const NoDurableDisposition: Story = {
  args: {
    ...durableManagementArgs,
    managementDispositions: dispositionProjection(null)
  }
};

export const DurableWatched: Story = {
  args: {
    ...durableManagementArgs,
    managementDispositions: dispositionProjection(disposition('WATCHED'))
  }
};

export const DurableDeferred: Story = {
  args: {
    ...durableManagementArgs,
    managementDispositions: dispositionProjection(disposition('DEFERRED'))
  }
};

export const DurableDismissed: Story = {
  args: {
    ...durableManagementArgs,
    managementDispositions: dispositionProjection(disposition('DISMISSED'))
  }
};

export const DurableContinued: Story = {
  args: {
    ...durableManagementArgs,
    managementDispositions: dispositionProjection(disposition('CONTINUED'))
  }
};

export const OwnerResolvedReadOnly: Story = {
  args: {
    ...durableManagementArgs,
    managementDispositions: dispositionProjection(disposition('RESOLVED_BY_WORKFLOW_REFERENCE'))
  }
};

export const DurableReadUnavailable: Story = {
  args: {
    ...durableManagementArgs,
    managementDispositionReadUnavailable: true
  }
};

export const DurableManagementMobile390: Story = {
  args: {
    ...durableManagementArgs,
    managementDispositions: dispositionProjection(disposition('WATCHED'))
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

export const AiGuidePrepared: Story = {
  args: {
    commerceProfile: profile,
    aiGuide: aiGuideResult,
    onPrepareAiGuide: () => Promise.resolve(aiGuideResult)
  }
};

export const AiGuideStaleEvidenceMobile390: Story = {
  args: {
    aiGuide: {
      ...aiGuideResult,
      staleOrConflictingEvidencePresent: true,
      suggestions: aiGuideResult.suggestions.map((suggestion) => ({
        ...suggestion,
        staleOrConflictingEvidencePresent: true
      }))
    },
    onPrepareAiGuide: () =>
      Promise.resolve({ ...aiGuideResult, staleOrConflictingEvidencePresent: true })
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
