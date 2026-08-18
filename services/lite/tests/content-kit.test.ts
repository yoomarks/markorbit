import { describe, expect, it } from 'vitest';
import type {
  ContentPick,
  CreatorPreference,
  DailyOrbitItem
} from '@markorbit/contracts/daily-workspace';
import type {
  ContentDraft,
  ContentOpportunity,
  ProductLoopSourceReference,
  PublishPackage
} from '@markorbit/contracts/product-loop';
import {
  ContentKitError,
  ContentKitService,
  projectContentKit,
  type ContentKitLifecycleReader,
  type DailyOrbitSnapshotReader
} from '../src/content-kit.js';

const workspaceId = '91919191-9191-4919-8919-919191919191';
const userId = 'user_m9_wp04';
const source: ProductLoopSourceReference = {
  schemaVersion: 1,
  owner: 'CORE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'rdp_m9-wp04',
  sourceVersion: 'CORE_CONTENT_V1',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-08-18T05:00:00.000Z'
};
const orbitItem: DailyOrbitItem = {
  schemaVersion: 1,
  dailyOrbitItemId: 'daily-orbit-item_m9-wp04',
  workspaceId,
  version: 1,
  signal: { id: 'daily-signal_m9-wp04', version: 1 },
  recommendation: { id: 'today-recommendation_m9-wp04', version: 1 },
  section: 'FOR_YOU',
  score: {
    importance: { score: 85, reason: 'Fee change matters.' },
    personalRelevance: { score: 95, reason: 'Matches explicit preference.' },
    timeSensitivity: { score: 85, reason: 'High time sensitivity.' },
    contentPotential: { score: 90, reason: 'Strong editorial potential.' },
    total: 89
  },
  whyThisMatters: 'This fee change is timely and relevant to the Workspace.',
  source,
  rankedAt: '2026-08-18T05:05:00.000Z',
  executionAuthorized: false,
  legalTruthVerified: false
};
const pick: ContentPick = {
  schemaVersion: 1,
  contentPickId: 'content-pick_m9-wp04',
  workspaceId,
  version: 1,
  orbitItem: { id: orbitItem.dailyOrbitItemId, version: 1 },
  recommendation: { id: 'today-recommendation_m9-wp04', version: 1 },
  title: 'USPTO fee update',
  whyPublish: 'The source-derived change has strong editorial potential.',
  suggestedAngles: ['What changed and when it becomes effective', 'What applicants should review'],
  recommendedPlatforms: ['WECHAT_OFFICIAL_ACCOUNT', 'XIAOHONGSHU'],
  publishAuthorized: false,
  externalPublishExecuted: false,
  createdAt: '2026-08-18T05:01:00.000Z'
};
const opportunity: ContentOpportunity = {
  schemaVersion: 1,
  contentOpportunityId: 'content-opportunity_m9-wp04',
  workspaceId,
  version: 1,
  sourceRecommendation: { id: pick.recommendation.id, version: pick.recommendation.version },
  sources: [source],
  title: 'Prepare a fee update explainer',
  rationale: 'Use the exact governed source.',
  status: 'ACCEPTED_FOR_PREPARATION',
  contentOpportunityFingerprintSha256: 'b'.repeat(64),
  publishAuthorized: false,
  formalBusinessOpportunityCreated: false,
  createdAt: '2026-08-18T05:06:00.000Z',
  updatedAt: '2026-08-18T05:06:00.000Z'
};
const draft: ContentDraft = {
  schemaVersion: 1,
  contentDraftId: 'content-draft_m9-wp04',
  workspaceId,
  version: 2,
  contentOpportunity: { id: opportunity.contentOpportunityId, version: 1 },
  sources: [source],
  title: 'USPTO fee update explained',
  body: 'Human-editable draft body.',
  status: 'DRAFT',
  contentDraftFingerprintSha256: 'c'.repeat(64),
  humanReviewRequired: true,
  published: false,
  createdAt: '2026-08-18T05:07:00.000Z',
  updatedAt: '2026-08-18T05:08:00.000Z'
};
const publishPackage: PublishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_m9-wp04',
  workspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: draft.version },
  contentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
  reviewDecision: { id: 'content-review-decision_m9-wp04', version: 1 },
  title: draft.title,
  body: draft.body,
  status: 'PREPARED',
  publishPackageFingerprintSha256: 'd'.repeat(64),
  externalPublishExecuted: false,
  createdAt: '2026-08-18T05:09:00.000Z'
};
const preference: CreatorPreference = {
  schemaVersion: 1,
  creatorPreferenceId: 'creator-preference_m9-wp04',
  workspaceId,
  subjectUserId: userId,
  version: 1,
  source: 'EXPLICIT',
  primaryJurisdictions: ['US'],
  professionalTopics: ['trademark'],
  targetAudiences: ['international trademark applicants'],
  preferredPlatforms: ['WECHAT_OFFICIAL_ACCOUNT'],
  tonePreferences: ['professional'],
  capabilityVerified: false,
  updatedAt: '2026-08-18T05:04:00.000Z'
};

class Orbit implements DailyOrbitSnapshotReader {
  snapshot(requestWorkspaceId: string, requestUserId: string) {
    expect(requestWorkspaceId).toBe(workspaceId);
    expect(requestUserId).toBe(userId);
    return Promise.resolve({
      schemaVersion: 1 as const,
      workspaceId,
      subjectUserId: userId,
      generatedAt: '2026-08-18T05:10:00.000Z',
      preferenceSource: 'NONE' as const,
      items: [orbitItem],
      contentPicks: [pick],
      partial: false,
      warnings: [],
      executionAuthorized: false as const,
      legalTruthVerified: false as const
    });
  }
}

class Lifecycle implements ContentKitLifecycleReader {
  constructor(private readonly exists = true) {}
  resolve(requestWorkspaceId: string) {
    expect(requestWorkspaceId).toBe(workspaceId);
    return Promise.resolve(
      this.exists ? { opportunity, drafts: [draft], publishPackages: [publishPackage] } : undefined
    );
  }
}

describe('M9-WP-04 Content Kit / Studio projection', () => {
  it('projects the existing lifecycle without creating a parallel draft or publication state machine', () => {
    const kit = projectContentKit({
      pick,
      orbitItem,
      lifecycle: { opportunity, drafts: [draft], publishPackages: [publishPackage] },
      preference
    });
    expect(kit.contentOpportunity).toEqual({ id: opportunity.contentOpportunityId, version: 1 });
    expect(kit.contentPick).toEqual({ id: pick.contentPickId, version: 1 });
    expect(kit.sources).toEqual([source]);
    expect(kit.audience).toBe('international trademark applicants');
    expect(kit.angles).toHaveLength(2);
    expect(kit.angles[0]?.evidenceNotes[0]).toContain(source.sourceFingerprintSha256);
    expect(kit.platformVariants).toHaveLength(2);
    expect(kit.platformVariants[0]?.draft).toEqual({ id: draft.contentDraftId, version: 2 });
    expect(kit.platformVariants.every((variant) => variant.humanReviewRequired)).toBe(true);
    expect(kit.platformVariants.every((variant) => !variant.externalPublishExecuted)).toBe(true);
    expect(kit.draftReferences).toEqual([{ id: draft.contentDraftId, version: 2 }]);
    expect(kit.publishPackageReferences).toEqual([
      { id: publishPackage.publishPackageId, version: 1 }
    ]);
    expect(kit.externalPublishExecuted).toBe(false);
    expect(kit.version).toBe(4);
  });

  it('states that audience is unconfigured instead of inventing a profile', () => {
    const kit = projectContentKit({
      pick,
      orbitItem,
      lifecycle: { opportunity, drafts: [], publishPackages: [] }
    });
    expect(kit.audience).toBe('Audience not explicitly configured');
    expect(kit.platformVariants[0]?.kind).toBe('WECHAT_OFFICIAL_ACCOUNT_OUTLINE');
    expect(kit.platformVariants[0]?.body).toContain(pick.suggestedAngles[0]!);
    expect(kit.draftReferences).toEqual([]);
    expect(kit.publishPackageReferences).toEqual([]);
  });

  it('does not expose a Content Kit before the existing Content Opportunity is accepted', async () => {
    const service = new ContentKitService(new Orbit(), new Lifecycle(false));
    await expect(service.find(workspaceId, userId, pick.contentPickId)).rejects.toEqual(
      expect.objectContaining<Partial<ContentKitError>>({
        code: 'CONTENT_OPPORTUNITY_REQUIRED',
        status: 409
      })
    );
  });
});
