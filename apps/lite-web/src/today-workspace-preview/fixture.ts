import type {
  ContentKit,
  ContentPick,
  CreatorPreference,
  DailyOrbitItem,
  ProductPreferenceEvent,
  VisualBrief
} from '@markorbit/contracts/daily-workspace';
import type { PreparedActionJourney, TodayRecommendation } from '@markorbit/contracts/product-loop';
import type {
  DailyOrbitSnapshot,
  DailyWorkspaceClient,
  DailyWorkspaceSnapshot,
  VisualBriefRecordResponse
} from '../api/daily-workspace.js';
import { DailyWorkspaceHttpError } from '../api/daily-workspace.js';
import type { TodayClient, TodayProductLoopSnapshot } from '../api/product-loop.js';
import { TodayHttpError } from '../api/product-loop.js';

export type TodayPreviewScenario =
  'ready' | 'loading' | 'empty' | 'partial' | 'unauthorized' | 'permission' | 'error';

export const fixtureWorkspaceId = '25252525-2525-4252-8252-252525252525';
const subjectUserId = '11111111-1111-4111-8111-111111111111';
const generatedAt = '2026-10-03T08:15:00.000Z';

const source = {
  schemaVersion: 1 as const,
  owner: 'KNOWLEDGE' as const,
  kind: 'KNOWLEDGE_READY_PACKAGE' as const,
  sourceId: 'ready-package_us-renewal',
  sourceVersion: 7,
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-10-03T08:00:00.000Z'
};

const recommendation: TodayRecommendation = {
  schemaVersion: 1,
  todayRecommendationId: 'today-recommendation_preview',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  kind: 'CONTENT_PREPARATION',
  title: 'Explain the US renewal window to this client segment',
  explanation:
    'A reviewed Knowledge package changed the recommended timing explanation and is ready for a professional content preparation step.',
  sources: [source],
  status: 'OPEN',
  recommendationFingerprintSha256: 'b'.repeat(64),
  executionAuthorized: false,
  createdAt: '2026-10-03T08:05:00.000Z',
  updatedAt: '2026-10-03T08:05:00.000Z'
};

const prepared: PreparedActionJourney = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_preview',
    workspaceId: fixtureWorkspaceId,
    version: 1,
    recommendation: { id: recommendation.todayRecommendationId, version: 1 },
    recommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
    kind: 'PREPARE_CONTENT',
    summary: 'Prepare one bounded Lite content line from the reviewed renewal explanation.',
    confirmationEffect:
      'Create one Lite Content Opportunity from this exact Recommendation. No external publication, customer contact, Order, Matter or filing will occur.',
    handoffTarget: 'LITE_CONTENT_PREPARATION',
    sources: recommendation.sources,
    preparedActionFingerprintSha256: 'c'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: '2026-10-03T08:10:00.000Z',
    updatedAt: '2026-10-03T08:10:00.000Z'
  },
  handoffState: 'AWAITING_CONFIRMATION'
};

const completed: PreparedActionJourney = {
  ...prepared,
  confirmation: {
    schemaVersion: 1,
    preparedAction: { id: prepared.preparedAction.preparedActionId, version: 1 },
    expectedPreparedActionFingerprintSha256:
      prepared.preparedAction.preparedActionFingerprintSha256,
    confirmedByPrincipalId: subjectUserId,
    confirmedAt: '2026-10-03T08:16:00.000Z',
    acknowledgedEffect: prepared.preparedAction.confirmationEffect,
    protectedActionAuthorized: false
  },
  handoffState: 'HANDOFF_COMPLETED',
  handoffResult: {
    schemaVersion: 1,
    preparedAction: { id: prepared.preparedAction.preparedActionId, version: 1 },
    target: 'LITE_CONTENT_PREPARATION',
    owner: 'LITE',
    ownerRecord: { id: 'content-opportunity_preview', version: 1 },
    completedAt: '2026-10-03T08:16:01.000Z',
    consequences: {
      externalPublishExecuted: false,
      customerContactedAutomatically: false,
      formalOpportunityCreatedAutomatically: false,
      orderCreatedAutomatically: false,
      matterCreatedAutomatically: false,
      paymentCreated: false,
      providerAppointed: false,
      filingSubmitted: false,
      officialTruthCreated: false
    }
  }
};

const orbitItem: DailyOrbitItem = {
  schemaVersion: 1,
  dailyOrbitItemId: 'daily-orbit-item_us-renewal',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  signal: { id: 'daily-signal_us-renewal', version: 1 },
  recommendation: { id: recommendation.todayRecommendationId, version: 1 },
  section: 'TODAYS_ORBIT',
  score: {
    importance: { score: 88, reason: 'Renewal timing affects an active professional audience.' },
    personalRelevance: {
      score: 92,
      reason: 'Matches the workspace jurisdiction and topic profile.'
    },
    timeSensitivity: { score: 78, reason: 'The reviewed package changed this week.' },
    contentPotential: { score: 90, reason: 'The change has a clear explanatory angle.' },
    total: 87
  },
  whyThisMatters:
    'A current, reviewed source can help clients understand the renewal window without implying legal advice or filing authority.',
  source,
  rankedAt: generatedAt,
  executionAuthorized: false,
  legalTruthVerified: false
};

const revisitingItem: DailyOrbitItem = {
  schemaVersion: 1,
  dailyOrbitItemId: 'daily-orbit-item_madrid-follow-up',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  signal: { id: 'daily-signal_madrid-follow-up', version: 2 },
  section: 'WORTH_REVISITING',
  score: {
    importance: { score: 72, reason: 'Still relevant to recurring portfolio reviews.' },
    personalRelevance: { score: 76, reason: 'Matches a saved workspace topic.' },
    timeSensitivity: { score: 40, reason: 'No immediate deadline is asserted.' },
    contentPotential: { score: 70, reason: 'Useful as a later educational follow-up.' },
    total: 65
  },
  whyThisMatters: 'A previously saved Madrid Protocol explainer may be worth refreshing.',
  source,
  rankedAt: '2026-10-03T08:14:00.000Z',
  executionAuthorized: false,
  legalTruthVerified: false
};

const contentPick: ContentPick = {
  schemaVersion: 1,
  contentPickId: 'content-pick_us-renewal',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  orbitItem: { id: orbitItem.dailyOrbitItemId, version: 1 },
  recommendation: { id: recommendation.todayRecommendationId, version: 1 },
  title: 'US renewal window: a calm client explainer',
  whyPublish:
    'Turn a reviewed timing change into a practical explainer while keeping legal and publication authority explicit.',
  suggestedAngles: [
    'What changed and what did not',
    'Three questions to ask before planning a renewal',
    'Why timing guidance is not filing instruction'
  ],
  recommendedPlatforms: ['WECHAT_OFFICIAL_ACCOUNT', 'XIAOHONGSHU'],
  contentOpportunity: { id: 'content-opportunity_preview', version: 1 },
  publishAuthorized: false,
  externalPublishExecuted: false,
  createdAt: generatedAt
};

const baseKit: ContentKit = {
  schemaVersion: 1,
  contentKitId: 'content-kit_us-renewal',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  contentPick: { id: contentPick.contentPickId, version: 1 },
  contentOpportunity: { id: 'content-opportunity_preview', version: 1 },
  sources: [source],
  whyItMatters:
    'Professionals need a concise way to explain the reviewed timing change without overstating certainty.',
  whyPublish: contentPick.whyPublish,
  angles: [
    {
      angleId: 'angle_what-changed',
      title: 'What changed and what did not',
      thesis: 'Separate reviewed timing guidance from customer-specific filing decisions.',
      audience: 'Trademark managers and brand operations teams',
      evidenceNotes: [
        'Use the exact Knowledge package provenance.',
        'Keep all deadlines qualified.'
      ]
    },
    {
      angleId: 'angle_three-questions',
      title: 'Three questions before planning renewal',
      thesis: 'A question-led format helps teams prepare without treating content as instruction.',
      audience: 'Small brand teams',
      evidenceNotes: ['Human review remains required.', 'No filing action is implied.']
    }
  ],
  audience: 'Trademark managers, brand operations teams and professional advisers',
  platformVariants: [
    {
      variantId: 'variant_wechat-outline',
      kind: 'WECHAT_OFFICIAL_ACCOUNT_OUTLINE',
      title: 'US renewal timing: what teams should review now',
      body: 'A five-part outline grounded in the reviewed source, with clear boundaries around customer-specific advice and filing authority.',
      topicTags: ['US trademark', 'renewal planning'],
      humanReviewRequired: true,
      externalPublishExecuted: false
    },
    {
      variantId: 'variant_xiaohongshu',
      kind: 'XIAOHONGSHU_POST',
      title: '商标续展时间窗：先看清这 3 件事',
      body: '一份面向品牌团队的简明草稿。内容仅用于准备与人工审阅，不构成申请指令。',
      topicTags: ['商标续展', '品牌管理'],
      humanReviewRequired: true,
      externalPublishExecuted: false
    }
  ],
  draftReferences: [],
  publishPackageReferences: [],
  visualBriefReferences: [],
  externalPublishExecuted: false,
  createdAt: generatedAt,
  updatedAt: generatedAt
};

function workspaceSnapshot(
  journey: PreparedActionJourney,
  scenario: TodayPreviewScenario
): DailyWorkspaceSnapshot {
  const empty = scenario === 'empty';
  const partial = scenario === 'partial';
  return {
    schemaVersion: 1,
    workspaceId: fixtureWorkspaceId,
    subjectUserId,
    generatedAt,
    see: {
      preferenceSource: empty ? null : 'EXPLICIT',
      savedOrbitItemIds: [],
      orbitItems: empty ? [] : [orbitItem, revisitingItem]
    },
    create: { contentPicks: empty ? [] : [contentPick] },
    move: {
      todayItems: empty ? [] : [{ recommendation, preparedActions: [journey] }],
      recentFeedback: [],
      feedbackPendingPackages: []
    },
    partial,
    warnings: partial
      ? [
          'SEE_CREATE:Knowledge refresh is delayed; exact stored provenance is shown.',
          'MOVE:Today is using the latest durable Recommendation while one upstream source refreshes.'
        ]
      : [],
    executionAuthorized: false,
    externalPublishExecuted: false,
    officialTruthCreated: false
  };
}

function orbitSnapshot(snapshot: DailyWorkspaceSnapshot): DailyOrbitSnapshot {
  return {
    schemaVersion: 1,
    workspaceId: snapshot.workspaceId,
    subjectUserId: snapshot.subjectUserId,
    generatedAt: snapshot.generatedAt,
    preferenceSource: snapshot.see.preferenceSource ?? 'NONE',
    savedOrbitItemIds: snapshot.see.savedOrbitItemIds,
    items: snapshot.see.orbitItems,
    contentPicks: snapshot.create.contentPicks,
    partial: snapshot.partial,
    warnings: snapshot.warnings,
    executionAuthorized: false,
    legalTruthVerified: false
  };
}

function todaySnapshot(journey: PreparedActionJourney): TodayProductLoopSnapshot {
  return {
    schemaVersion: 1,
    workspaceId: fixtureWorkspaceId,
    generatedAt,
    items: [{ recommendation, preparedActions: [journey] }],
    partial: false,
    warnings: [],
    recentFeedback: [],
    feedbackPendingPackages: []
  };
}

function accessFailure(status: 401 | 403): DailyWorkspaceHttpError {
  return new DailyWorkspaceHttpError(
    status,
    status === 401 ? 'AUTHENTICATION_REQUIRED' : 'PERMISSION_DENIED',
    status === 401
      ? 'Sign in to open this Daily Workspace.'
      : 'workspace:read permission is required to open this Daily Workspace.'
  );
}

export function previewClients(scenario: TodayPreviewScenario): {
  todayClient: TodayClient;
  dailyClient: DailyWorkspaceClient;
} {
  let currentJourney = prepared;
  let currentKit = baseKit;
  let currentVisualRecord: VisualBriefRecordResponse | undefined;
  let workspaceAttempts = 0;
  let preferenceSequence = 0;

  const loadWorkspace = (): Promise<DailyWorkspaceSnapshot> => {
    workspaceAttempts += 1;
    if (scenario === 'loading') return new Promise(() => undefined);
    if (scenario === 'unauthorized') return Promise.reject(accessFailure(401));
    if (scenario === 'permission') return Promise.reject(accessFailure(403));
    if (scenario === 'error' && workspaceAttempts === 1)
      return Promise.reject(
        new DailyWorkspaceHttpError(
          503,
          'PREVIEW_OWNER_UNAVAILABLE',
          'The fixture owner is temporarily unavailable.',
          true
        )
      );
    return Promise.resolve(workspaceSnapshot(currentJourney, scenario));
  };

  const dailyClient: DailyWorkspaceClient = {
    loadWorkspace,
    loadOrbit: async () => orbitSnapshot(await loadWorkspace()),
    loadContentKit: () => Promise.resolve(currentKit),
    loadVisualBrief: () => {
      if (currentVisualRecord) return Promise.resolve(currentVisualRecord);
      return Promise.reject(
        new DailyWorkspaceHttpError(404, 'VISUAL_BRIEF_NOT_FOUND', 'Visual Brief not found.')
      );
    },
    createVisualBrief: (_contentPickId, kit, input) => {
      const brief: VisualBrief = {
        schemaVersion: 1,
        visualBriefId: 'visual-brief_preview',
        workspaceId: fixtureWorkspaceId,
        version: 1,
        contentKit: { id: kit.contentKitId, version: kit.version },
        title: contentPick.title,
        keyMessage: kit.angles[0]?.thesis ?? kit.whyPublish,
        audience: kit.audience,
        outputKind: input.outputKind,
        aspectRatio: input.outputKind === 'XIAOHONGSHU_COVER' ? '3:4' : '16:9',
        styleIntent: 'Clear professional editorial graphic with explicit provenance boundaries.',
        requestedIpPackage: input.requestedIpPackage,
        sceneIntent: input.sceneIntent,
        reuseFirstRequired: true,
        paidExecutionAuthorized: false,
        createdAt: generatedAt
      };
      currentVisualRecord = {
        brief,
        visualBriefFingerprintSha256: 'd'.repeat(64)
      };
      currentKit = {
        ...currentKit,
        version: currentKit.version + 1,
        visualBriefReferences: [{ id: brief.visualBriefId, version: brief.version }],
        updatedAt: '2026-10-03T08:18:00.000Z'
      };
      return Promise.resolve(currentVisualRecord);
    },
    startVisualRequest: (record) =>
      Promise.resolve({
        requestReference: 'preview-request_reuse-first',
        output: {
          schemaVersion: 1,
          visualOutputReferenceId: 'visual-output_preview',
          workspaceId: fixtureWorkspaceId,
          version: 1,
          visualBrief: { id: record.brief.visualBriefId, version: record.brief.version },
          owner: 'VISUAL_ENGINE',
          requestReference: 'preview-request_reuse-first',
          outputReference: 'certified-asset_preview',
          status: 'REUSED_CERTIFIED_ASSET',
          qcStatus: 'PASS',
          providerExecutionAuthorizedByLite: false,
          paidExecutionAuthorizedByLite: false,
          createdAt: '2026-10-03T08:19:00.000Z'
        },
        acceptedAt: '2026-10-03T08:19:00.000Z'
      }),
    recordPreferenceEvent: (kind, target) => {
      preferenceSequence += 1;
      const event: ProductPreferenceEvent = {
        schemaVersion: 1,
        productPreferenceEventId: `product-preference-event_preview-${preferenceSequence}`,
        workspaceId: fixtureWorkspaceId,
        subjectUserId,
        kind,
        targetType: target.targetType,
        targetId: target.targetId,
        targetVersion: target.targetVersion,
        recordedAt: generatedAt,
        externalActionExecutedByMarkOrbit: false,
        externalOutcomeVerifiedByMarkOrbit: false,
        capabilityVerified: false
      };
      const preference: CreatorPreference = {
        schemaVersion: 1,
        creatorPreferenceId: 'creator-preference_preview',
        workspaceId: fixtureWorkspaceId,
        subjectUserId,
        version: preferenceSequence,
        source: 'EXPLICIT',
        primaryJurisdictions: ['US'],
        professionalTopics: ['renewal planning'],
        targetAudiences: ['brand operations teams'],
        preferredPlatforms: ['WECHAT_OFFICIAL_ACCOUNT', 'XIAOHONGSHU'],
        tonePreferences: ['clear', 'evidence-led'],
        capabilityVerified: false,
        updatedAt: generatedAt
      };
      return Promise.resolve({ event, preference });
    }
  };

  const todayClient: TodayClient = {
    loadToday: () => Promise.resolve(todaySnapshot(currentJourney)),
    loadPreparedAction: () => Promise.resolve(currentJourney),
    loadQualifiedOpportunityReview: () =>
      Promise.reject(
        new TodayHttpError(
          409,
          'OPPORTUNITY_REVIEW_NOT_SELECTED',
          'This preview action is content preparation, not an Opportunity Review.'
        )
      ),
    prepareContent: () => Promise.resolve(prepared),
    prepareQualifiedOpportunity: () =>
      Promise.reject(
        new TodayHttpError(
          409,
          'OPPORTUNITY_REVIEW_NOT_SELECTED',
          'This preview action is content preparation, not an Opportunity Review.'
        )
      ),
    confirm: () => {
      currentJourney = completed;
      return Promise.resolve(currentJourney);
    },
    recordUseFeedback: () =>
      Promise.reject(
        new TodayHttpError(
          409,
          'PUBLISH_PACKAGE_NOT_SELECTED',
          'No PublishPackage is selected in this preview state.'
        )
      )
  };

  return { todayClient, dailyClient };
}
