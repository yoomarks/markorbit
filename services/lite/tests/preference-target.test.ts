import { describe, expect, it, vi } from 'vitest';
import type {
  ContentKit,
  ContentPick,
  DailyOrbitItem,
  DailySignal
} from '@markorbit/contracts/daily-workspace';
import type { ProductLoopUseFeedback } from '@markorbit/contracts/product-loop';
import type { ContentKitService } from '../src/content-kit.js';
import type { DailyOrbitSnapshot, DailySignalReader } from '../src/daily-orbit.js';
import type { PostgresProductPreferenceStore } from '../src/preference-feedback.js';
import {
  DailyWorkspacePreferenceTargetResolver,
  ProductPreferenceService,
  productPreferenceKindForUseOutcome
} from '../src/preference-target.js';
import type { PostgresVisualBridgeStore } from '../src/visual-bridge.js';

const workspaceId = '94949494-9494-4949-8949-949494949494';
const userId = 'user_m9_wp07_use_feedback';

const signal: DailySignal = {
  schemaVersion: 1,
  dailySignalId: 'daily-signal_wp07-use-feedback',
  workspaceId,
  version: 1,
  source: {
    schemaVersion: 1,
    owner: 'CORE',
    kind: 'KNOWLEDGE_READY_PACKAGE',
    sourceId: 'rdp_wp07-use-feedback',
    sourceVersion: 'CORE_CONTENT_V1',
    sourceFingerprintSha256: '7'.repeat(64),
    observedAt: '2026-08-18T07:00:00.000Z'
  },
  title: 'USPTO trademark use feedback source',
  summary: 'A governed source for the WP07 feedback bridge.',
  keyFacts: ['The source concerns United States trademark practice.'],
  jurisdictions: ['US'],
  institution: 'USPTO',
  topicTags: ['trademark'],
  changeType: 'RULE_CHANGE',
  observedAt: '2026-08-18T07:00:00.000Z',
  timeSensitivity: 'MEDIUM',
  dailySignalFingerprintSha256: '6'.repeat(64),
  legalTruthVerified: false,
  recommendationCreatedAutomatically: false,
  createdAt: '2026-08-18T07:00:00.000Z'
};

const orbitItem: DailyOrbitItem = {
  schemaVersion: 1,
  dailyOrbitItemId: 'daily-orbit-item_wp07-use-feedback',
  workspaceId,
  version: 1,
  signal: { id: signal.dailySignalId, version: signal.version },
  recommendation: { id: 'today-recommendation_wp07-use-feedback', version: 1 },
  section: 'TODAYS_ORBIT',
  score: {
    importance: { score: 90, reason: 'rule' },
    personalRelevance: { score: 50, reason: 'baseline' },
    timeSensitivity: { score: 60, reason: 'medium' },
    contentPotential: { score: 80, reason: 'content' },
    total: 70
  },
  whyThisMatters: 'It changes professional guidance.',
  source: signal.source,
  rankedAt: '2026-08-18T07:01:00.000Z',
  executionAuthorized: false,
  legalTruthVerified: false
};

const pick: ContentPick = {
  schemaVersion: 1,
  contentPickId: 'content-pick_wp07-use-feedback',
  workspaceId,
  version: 1,
  orbitItem: { id: orbitItem.dailyOrbitItemId, version: orbitItem.version },
  recommendation: { id: 'today-recommendation_wp07-use-feedback', version: 1 },
  title: 'Explain the USPTO update',
  whyPublish: 'Practitioners need the update.',
  suggestedAngles: ['What changed'],
  recommendedPlatforms: ['WECHAT_OFFICIAL_ACCOUNT'],
  publishAuthorized: false,
  externalPublishExecuted: false,
  createdAt: '2026-08-18T07:01:00.000Z'
};

const kit: ContentKit = {
  schemaVersion: 1,
  contentKitId: 'content-kit_wp07-use-feedback',
  workspaceId,
  version: 2,
  contentPick: { id: pick.contentPickId, version: pick.version },
  contentOpportunity: { id: 'content-opportunity_wp07-use-feedback', version: 1 },
  sources: [signal.source],
  whyItMatters: orbitItem.whyThisMatters,
  whyPublish: pick.whyPublish,
  angles: [],
  audience: 'Trademark practitioners',
  platformVariants: [],
  draftReferences: [],
  publishPackageReferences: [{ id: 'publish-package_wp07-use-feedback', version: 1 }],
  visualBriefReferences: [],
  externalPublishExecuted: false,
  createdAt: '2026-08-18T07:02:00.000Z',
  updatedAt: '2026-08-18T07:03:00.000Z'
};

const snapshot: DailyOrbitSnapshot = {
  schemaVersion: 1,
  workspaceId,
  subjectUserId: userId,
  generatedAt: '2026-08-18T07:04:00.000Z',
  preferenceSource: 'NONE',
  items: [orbitItem],
  contentPicks: [pick],
  partial: false,
  warnings: [],
  executionAuthorized: false,
  legalTruthVerified: false
};

function resolver() {
  const orbit = { snapshot: vi.fn(() => Promise.resolve(snapshot)) };
  const signals: DailySignalReader = {
    listRecent: vi.fn(() => Promise.resolve([signal]))
  };
  const contentKits = {
    find: vi.fn(() => Promise.resolve(kit))
  } as unknown as ContentKitService;
  const visuals = {} as PostgresVisualBridgeStore;
  return new DailyWorkspacePreferenceTargetResolver(orbit, signals, contentKits, visuals);
}

function feedback(outcome: ProductLoopUseFeedback['outcome']): ProductLoopUseFeedback {
  return {
    schemaVersion: 1,
    productLoopFeedbackId: `product-loop-feedback_wp07-${outcome.toLowerCase()}`,
    workspaceId,
    version: 1,
    publishPackage: { id: 'publish-package_wp07-use-feedback', version: 1 },
    outcome,
    recordedByPrincipalId: userId,
    recordedAt: '2026-08-18T07:05:00.000Z',
    externalActionExecutedByMarkOrbit: false,
    externalOutcomeVerifiedByMarkOrbit: false
  };
}

describe('M9-WP07 use feedback preference derivation', () => {
  it('maps only semantically equivalent use outcomes into preference kinds', () => {
    expect(productPreferenceKindForUseOutcome('USER_REPORTED_PUBLISHED')).toBe(
      'USER_REPORTED_PUBLISHED'
    );
    expect(productPreferenceKindForUseOutcome('USER_REPORTED_USED')).toBe('USER_REPORTED_USED');
    expect(productPreferenceKindForUseOutcome('NOT_USED')).toBe('NOT_USED');
    expect(productPreferenceKindForUseOutcome('USER_REPORTED_DELIVERED')).toBeUndefined();
  });

  it('resolves an exact PublishPackage through the canonical Content Kit before deriving context', async () => {
    const resolved = await resolver().resolvePublishPackageTarget(workspaceId, userId, {
      id: 'publish-package_wp07-use-feedback',
      version: 1
    });

    expect(resolved).toEqual({
      target: {
        targetType: 'CONTENT_KIT',
        targetId: kit.contentKitId,
        targetVersion: kit.version
      },
      context: {
        jurisdictions: ['US'],
        topics: ['trademark'],
        platforms: ['WECHAT_OFFICIAL_ACCOUNT']
      }
    });

    expect(
      await resolver().resolvePublishPackageTarget(workspaceId, userId, {
        id: 'publish-package_not-current',
        version: 1
      })
    ).toBeUndefined();
  });

  it('records Published preference evidence with deterministic feedback identity and keeps Delivered unmapped', async () => {
    const recordCanonicalEvent = vi.fn((command) =>
      Promise.resolve({
        event: {
          schemaVersion: 1 as const,
          productPreferenceEventId: 'product-preference-event_wp07-use-feedback',
          workspaceId,
          subjectUserId: userId,
          kind: command.kind,
          targetType: command.targetType,
          targetId: command.targetId,
          targetVersion: command.targetVersion,
          recordedAt: '2026-08-18T07:06:00.000Z',
          externalActionExecutedByMarkOrbit: false as const,
          externalOutcomeVerifiedByMarkOrbit: false as const,
          capabilityVerified: false as const
        },
        preference: {
          schemaVersion: 1 as const,
          creatorPreferenceId: 'creator-preference_wp07-use-feedback',
          workspaceId,
          subjectUserId: userId,
          version: 1,
          source: 'PRODUCT_FEEDBACK' as const,
          primaryJurisdictions: ['US'],
          professionalTopics: ['trademark'],
          targetAudiences: [],
          preferredPlatforms: ['WECHAT_OFFICIAL_ACCOUNT'] as const,
          tonePreferences: [],
          capabilityVerified: false as const,
          updatedAt: '2026-08-18T07:06:00.000Z'
        }
      })
    );
    const store = { recordCanonicalEvent } as unknown as PostgresProductPreferenceStore;
    const service = new ProductPreferenceService(store, resolver());

    const published = feedback('USER_REPORTED_PUBLISHED');
    await service.recordUseFeedback(published);
    expect(recordCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        subjectUserId: userId,
        kind: 'USER_REPORTED_PUBLISHED',
        targetType: 'CONTENT_KIT',
        targetId: kit.contentKitId,
        targetVersion: kit.version,
        idempotencyKey: `preference-use-feedback:${published.productLoopFeedbackId}`
      })
    );

    recordCanonicalEvent.mockClear();
    expect(await service.recordUseFeedback(feedback('USER_REPORTED_DELIVERED'))).toBeUndefined();
    expect(recordCanonicalEvent).not.toHaveBeenCalled();
  });
});
