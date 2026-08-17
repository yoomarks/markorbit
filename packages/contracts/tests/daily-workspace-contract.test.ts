import { describe, expect, it } from 'vitest';
import {
  contentPickPlatforms,
  creatorPreferenceSources,
  dailyOrbitSections,
  dailySignalChangeTypes,
  dailySignalTimeSensitivity,
  dailyWorkspaceAiAuthority,
  noAutomaticDailyWorkspaceConsequences,
  platformVariantKinds,
  productPreferenceEventKinds,
  visualOutputKinds,
  visualOutputStatuses,
  type ContentKit,
  type ContentPick,
  type CreatorPreference,
  type DailyOrbitItem,
  type DailySignal,
  type ProductPreferenceEvent,
  type VisualBrief,
  type VisualOutputReference
} from '../src/daily-workspace.js';

const sha = 'a'.repeat(64);
const workspaceId = 'workspace_m9-wp01';
const source = {
  schemaVersion: 1,
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'rdp_m9-wp01',
  sourceVersion: '1.0',
  sourceFingerprintSha256: sha,
  observedAt: '2026-08-18T00:00:00.000Z'
} as const;

const signal = {
  schemaVersion: 1,
  dailySignalId: 'daily-signal_m9-wp01',
  workspaceId,
  version: 1,
  source,
  title: 'USPTO announces a rule change',
  summary: 'A governed source describes a rule change relevant to trademark professionals.',
  keyFacts: ['The source records a rule change.'],
  jurisdictions: ['US'],
  institution: 'USPTO',
  topicTags: ['trademark', 'rule-change'],
  changeType: 'RULE_CHANGE',
  observedAt: source.observedAt,
  timeSensitivity: 'HIGH',
  dailySignalFingerprintSha256: sha,
  legalTruthVerified: false,
  recommendationCreatedAutomatically: false,
  createdAt: source.observedAt
} as const satisfies DailySignal;

const orbitItem = {
  schemaVersion: 1,
  dailyOrbitItemId: 'daily-orbit-item_m9-wp01',
  workspaceId,
  version: 1,
  signal: { id: signal.dailySignalId, version: signal.version },
  recommendation: { id: 'today-recommendation_m9-wp01', version: 1 },
  section: 'TODAYS_ORBIT',
  score: {
    importance: { score: 90, reason: 'Rule changes are operationally important.' },
    personalRelevance: { score: 80, reason: 'The Workspace follows US trademark work.' },
    timeSensitivity: { score: 85, reason: 'The change may affect near-term decisions.' },
    contentPotential: { score: 75, reason: 'The change is useful client education material.' },
    total: 83
  },
  whyThisMatters: 'The source may affect current US trademark work.',
  source,
  rankedAt: '2026-08-18T00:01:00.000Z',
  executionAuthorized: false,
  legalTruthVerified: false
} as const satisfies DailyOrbitItem;

const pick = {
  schemaVersion: 1,
  contentPickId: 'content-pick_m9-wp01',
  workspaceId,
  version: 1,
  orbitItem: { id: orbitItem.dailyOrbitItemId, version: orbitItem.version },
  recommendation: { id: 'today-recommendation_m9-wp01', version: 1 },
  title: 'What the USPTO change means for applicants',
  whyPublish: 'Clients may benefit from a concise explanation.',
  suggestedAngles: ['What changed', 'Who should care', 'What to review now'],
  recommendedPlatforms: ['WECHAT_MOMENTS', 'XIAOHONGSHU'],
  contentOpportunity: { id: 'content-opportunity_m9-wp01', version: 1 },
  publishAuthorized: false,
  externalPublishExecuted: false,
  createdAt: '2026-08-18T00:02:00.000Z'
} as const satisfies ContentPick;

const visualBrief = {
  schemaVersion: 1,
  visualBriefId: 'visual-brief_m9-wp01',
  workspaceId,
  version: 1,
  contentKit: { id: 'content-kit_m9-wp01', version: 1 },
  title: pick.title,
  keyMessage: 'Explain the USPTO rule change clearly.',
  audience: 'Trademark applicants and professional clients',
  outputKind: 'XIAOHONGSHU_COVER',
  aspectRatio: '3:4',
  styleIntent: 'professional, clear, branded',
  requestedIpPackage: 'MOKI',
  sceneIntent: 'MOKI reviewing a trademark rule update',
  reuseFirstRequired: true,
  paidExecutionAuthorized: false,
  createdAt: '2026-08-18T00:03:00.000Z'
} as const satisfies VisualBrief;

const kit = {
  schemaVersion: 1,
  contentKitId: 'content-kit_m9-wp01',
  workspaceId,
  version: 1,
  contentPick: { id: pick.contentPickId, version: pick.version },
  contentOpportunity: { id: 'content-opportunity_m9-wp01', version: 1 },
  sources: [source],
  whyItMatters: orbitItem.whyThisMatters,
  whyPublish: pick.whyPublish,
  angles: [
    {
      angleId: 'angle-1',
      title: 'Client impact',
      thesis: 'Explain the practical impact without overstating the source.',
      audience: 'Trademark applicants',
      evidenceNotes: ['Use the exact governed source.']
    }
  ],
  audience: 'Trademark applicants',
  platformVariants: [
    {
      variantId: 'variant-1',
      kind: 'XIAOHONGSHU_POST',
      title: pick.title,
      body: 'Prepared platform-native draft.',
      topicTags: ['trademark'],
      draft: { id: 'content-draft_m9-wp01', version: 1 },
      humanReviewRequired: true,
      externalPublishExecuted: false
    }
  ],
  draftReferences: [{ id: 'content-draft_m9-wp01', version: 1 }],
  publishPackageReferences: [{ id: 'publish-package_m9-wp01', version: 1 }],
  visualBriefReferences: [{ id: visualBrief.visualBriefId, version: 1 }],
  externalPublishExecuted: false,
  createdAt: '2026-08-18T00:04:00.000Z',
  updatedAt: '2026-08-18T00:04:00.000Z'
} as const satisfies ContentKit;

const creatorPreference = {
  schemaVersion: 1,
  creatorPreferenceId: 'creator-preference_m9-wp01',
  workspaceId,
  subjectUserId: 'user_m9-wp01',
  version: 1,
  source: 'EXPLICIT',
  professionalRole: 'Trademark professional',
  primaryJurisdictions: ['US', 'EU'],
  professionalTopics: ['trademark'],
  targetAudiences: ['brand owners'],
  preferredPlatforms: ['XIAOHONGSHU'],
  tonePreferences: ['professional', 'clear'],
  capabilityVerified: false,
  updatedAt: '2026-08-18T00:05:00.000Z'
} as const satisfies CreatorPreference;

const visualOutput = {
  schemaVersion: 1,
  visualOutputReferenceId: 'visual-output_m9-wp01',
  workspaceId,
  version: 1,
  visualBrief: { id: visualBrief.visualBriefId, version: visualBrief.version },
  owner: 'VISUAL_ENGINE',
  requestReference: 'illustration-request://request_m9-wp01',
  outputReference: 'library://asset_m9-wp01',
  status: 'REUSED_CERTIFIED_ASSET',
  qcStatus: 'PASS',
  providerExecutionAuthorizedByLite: false,
  paidExecutionAuthorizedByLite: false,
  createdAt: '2026-08-18T00:06:00.000Z'
} as const satisfies VisualOutputReference;

const preferenceEvent = {
  schemaVersion: 1,
  productPreferenceEventId: 'product-preference-event_m9-wp01',
  workspaceId,
  subjectUserId: 'user_m9-wp01',
  kind: 'VISUAL_SELECTED',
  targetType: 'VISUAL_OUTPUT',
  targetId: visualOutput.visualOutputReferenceId,
  targetVersion: visualOutput.version,
  recordedAt: '2026-08-18T00:07:00.000Z',
  externalActionExecutedByMarkOrbit: false,
  externalOutcomeVerifiedByMarkOrbit: false,
  capabilityVerified: false
} as const satisfies ProductPreferenceEvent;

describe('M9-WP-01 Daily Workspace contracts', () => {
  it('freezes the bounded product vocabulary', () => {
    expect(dailySignalChangeTypes).toContain('RULE_CHANGE');
    expect(dailySignalTimeSensitivity).toEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
    expect(dailyOrbitSections).toContain('WORTH_REVISITING');
    expect(contentPickPlatforms).toEqual([
      'WECHAT_MOMENTS',
      'XIAOHONGSHU',
      'WECHAT_OFFICIAL_ACCOUNT',
      'VIDEO_SCRIPT'
    ]);
    expect(platformVariantKinds).toContain('VIDEO_SCRIPT_60S');
    expect(creatorPreferenceSources).toEqual(['EXPLICIT', 'PRODUCT_FEEDBACK']);
    expect(visualOutputKinds).toContain('WECHAT_OFFICIAL_ACCOUNT_COVER');
    expect(visualOutputStatuses).toContain('REUSED_CERTIFIED_ASSET');
    expect(productPreferenceEventKinds).toContain('USER_REPORTED_PUBLISHED');
  });

  it('maps Daily -> Content Pick -> existing content lifecycle without creating publish authority', () => {
    expect(signal.recommendationCreatedAutomatically).toBe(false);
    expect(orbitItem.executionAuthorized).toBe(false);
    expect(pick.contentOpportunity?.id).toBe('content-opportunity_m9-wp01');
    expect(pick.publishAuthorized).toBe(false);
    expect(kit.contentOpportunity.id).toBe('content-opportunity_m9-wp01');
    expect(kit.draftReferences[0]?.id).toBe('content-draft_m9-wp01');
    expect(kit.publishPackageReferences[0]?.id).toBe('publish-package_m9-wp01');
    expect(kit.platformVariants[0]?.humanReviewRequired).toBe(true);
    expect(kit.externalPublishExecuted).toBe(false);
  });

  it('keeps visual requests consumer-safe and reuse-first', () => {
    expect(visualBrief.reuseFirstRequired).toBe(true);
    expect(visualBrief.paidExecutionAuthorized).toBe(false);
    expect(visualOutput.owner).toBe('VISUAL_ENGINE');
    expect(visualOutput.providerExecutionAuthorizedByLite).toBe(false);
    expect(visualOutput.paidExecutionAuthorizedByLite).toBe(false);
  });

  it('keeps product preferences separate from professional Capability truth', () => {
    expect(creatorPreference.capabilityVerified).toBe(false);
    expect(preferenceEvent.capabilityVerified).toBe(false);
    expect(preferenceEvent.externalActionExecutedByMarkOrbit).toBe(false);
    expect(preferenceEvent.externalOutcomeVerifiedByMarkOrbit).toBe(false);
  });

  it('keeps AI assistive and all protected consequences false', () => {
    expect(dailyWorkspaceAiAuthority).toMatchObject({
      mayRankDailySignals: true,
      mayExplainRelevance: true,
      mayDraftPlatformVariants: true,
      mayPrepareVisualBrief: true,
      mayConfirmForUser: false,
      mayApproveContent: false,
      mayPublishExternally: false,
      mayContactCustomer: false,
      mayQualifyFormalOpportunity: false,
      mayCreateOrderOrMatter: false,
      mayAuthorizePaidVisualExecution: false,
      mayVerifyProfessionalCapability: false,
      mayCreateOfficialTruth: false
    });
    expect(Object.values(noAutomaticDailyWorkspaceConsequences).every((value) => value === false)).toBe(
      true
    );
  });
});
