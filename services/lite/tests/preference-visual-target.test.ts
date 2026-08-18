import { describe, expect, it, vi } from 'vitest';
import type {
  ContentKit,
  ContentPick,
  DailyOrbitItem,
  DailySignal,
  VisualBrief,
  VisualOutputReference
} from '@markorbit/contracts/daily-workspace';
import type { ContentKitService } from '../src/content-kit.js';
import type { DailySignalReader } from '../src/daily-orbit.js';
import {
  DailyWorkspacePreferenceTargetResolver,
  type DailyOrbitSnapshotReader
} from '../src/preference-target.js';
import type { PostgresVisualBridgeStore } from '../src/visual-bridge.js';

const workspaceId = '95959595-9595-4959-8959-959595959595';
const userId = 'user_m9_wp07_visual_target';

const signal: DailySignal = {
  schemaVersion: 1,
  dailySignalId: 'daily-signal_wp07-visual-target',
  workspaceId,
  version: 1,
  source: {
    schemaVersion: 1,
    owner: 'CORE',
    kind: 'KNOWLEDGE_READY_PACKAGE',
    sourceId: 'rdp_wp07-visual-target',
    sourceVersion: 'CORE_CONTENT_V1',
    sourceFingerprintSha256: '7'.repeat(64),
    observedAt: '2026-08-18T09:00:00.000Z'
  },
  title: 'USPTO visual target source',
  summary: 'A governed source for visual preference target resolution.',
  keyFacts: ['The source concerns United States trademark practice.'],
  jurisdictions: ['US'],
  institution: 'USPTO',
  topicTags: ['trademark'],
  changeType: 'RULE_CHANGE',
  observedAt: '2026-08-18T09:00:00.000Z',
  timeSensitivity: 'MEDIUM',
  dailySignalFingerprintSha256: '6'.repeat(64),
  legalTruthVerified: false,
  recommendationCreatedAutomatically: false,
  createdAt: '2026-08-18T09:00:00.000Z'
};

const orbitItem: DailyOrbitItem = {
  schemaVersion: 1,
  dailyOrbitItemId: 'daily-orbit-item_wp07-visual-target',
  workspaceId,
  version: 1,
  signal: { id: signal.dailySignalId, version: signal.version },
  recommendation: { id: 'today-recommendation_wp07-visual-target', version: 1 },
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
  rankedAt: '2026-08-18T09:01:00.000Z',
  executionAuthorized: false,
  legalTruthVerified: false
};

const pick: ContentPick = {
  schemaVersion: 1,
  contentPickId: 'content-pick_wp07-visual-target',
  workspaceId,
  version: 1,
  orbitItem: { id: orbitItem.dailyOrbitItemId, version: orbitItem.version },
  recommendation: { id: 'today-recommendation_wp07-visual-target', version: 1 },
  title: 'Explain the USPTO update visually',
  whyPublish: 'Practitioners need the update.',
  suggestedAngles: ['What changed'],
  recommendedPlatforms: ['WECHAT_OFFICIAL_ACCOUNT'],
  publishAuthorized: false,
  externalPublishExecuted: false,
  createdAt: '2026-08-18T09:01:00.000Z'
};

const kit: ContentKit = {
  schemaVersion: 1,
  contentKitId: 'content-kit_wp07-visual-target',
  workspaceId,
  version: 2,
  contentPick: { id: pick.contentPickId, version: pick.version },
  contentOpportunity: { id: 'content-opportunity_wp07-visual-target', version: 1 },
  sources: [signal.source],
  whyItMatters: orbitItem.whyThisMatters,
  whyPublish: pick.whyPublish,
  angles: [],
  audience: 'Trademark practitioners',
  platformVariants: [],
  draftReferences: [],
  publishPackageReferences: [],
  visualBriefReferences: [{ id: 'visual-brief_wp07-visual-target', version: 1 }],
  externalPublishExecuted: false,
  createdAt: '2026-08-18T09:02:00.000Z',
  updatedAt: '2026-08-18T09:03:00.000Z'
};

const brief: VisualBrief = {
  schemaVersion: 1,
  visualBriefId: 'visual-brief_wp07-visual-target',
  workspaceId,
  version: 1,
  contentKit: { id: kit.contentKitId, version: kit.version },
  title: 'USPTO update visual',
  keyMessage: 'Explain the update.',
  audience: kit.audience,
  outputKind: 'XIAOHONGSHU_COVER',
  aspectRatio: '3:4',
  styleIntent: 'MarkOrbit Lite editorial visual',
  requestedIpPackage: 'MOKI',
  sceneIntent: 'MOKI explains the update.',
  reuseFirstRequired: true,
  paidExecutionAuthorized: false,
  createdAt: '2026-08-18T09:04:00.000Z'
};

const output: VisualOutputReference = {
  schemaVersion: 1,
  visualOutputReferenceId: 'visual-output_wp07-visual-target',
  workspaceId,
  version: 1,
  visualBrief: { id: brief.visualBriefId, version: brief.version },
  owner: 'VISUAL_ENGINE',
  requestReference: 'illustration-request://wp07-visual-target',
  outputReference: 'delivery://wp07-visual-target',
  status: 'READY',
  qcStatus: 'PASS',
  providerExecutionAuthorizedByLite: false,
  paidExecutionAuthorizedByLite: false,
  createdAt: '2026-08-18T09:05:00.000Z'
};

const snapshot = {
  schemaVersion: 1 as const,
  workspaceId,
  subjectUserId: userId,
  generatedAt: '2026-08-18T09:06:00.000Z',
  preferenceSource: 'NONE' as const,
  items: [orbitItem],
  contentPicks: [pick],
  partial: false,
  warnings: [],
  executionAuthorized: false as const,
  legalTruthVerified: false as const
};

function resolver() {
  const orbit: DailyOrbitSnapshotReader = {
    snapshot: vi.fn(() => Promise.resolve(snapshot))
  };
  const signals: DailySignalReader = {
    listRecent: vi.fn(() => Promise.resolve([signal]))
  };
  const contentKits = {
    find: vi.fn(() => Promise.resolve(kit))
  } as unknown as ContentKitService;
  const visuals = {
    findOutput: vi.fn(
      (_workspaceId: string, reference: { id: string; version: number }) =>
        Promise.resolve(
          reference.id === output.visualOutputReferenceId && reference.version === output.version
            ? output
            : undefined
        )
    ),
    findBrief: vi.fn(
      (_workspaceId: string, reference: { id: string; version: number }) =>
        Promise.resolve(
          reference.id === brief.visualBriefId && reference.version === brief.version
            ? {
                brief,
                visualBriefFingerprintSha256: '8'.repeat(64),
                consumerIdentity: { ipId: 'MOKI', styleId: 'markorbit-lite-editorial-v1' }
              }
            : undefined
        )
    )
  } as unknown as PostgresVisualBridgeStore;
  return new DailyWorkspacePreferenceTargetResolver(orbit, signals, contentKits, visuals);
}

describe('M9-WP07 Visual preference target resolution', () => {
  it('derives semantic context from the exact canonical Visual Output chain', async () => {
    await expect(
      resolver().resolve(workspaceId, userId, {
        targetType: 'VISUAL_OUTPUT',
        targetId: output.visualOutputReferenceId,
        targetVersion: output.version
      })
    ).resolves.toEqual({
      jurisdictions: ['US'],
      topics: ['trademark'],
      platforms: ['XIAOHONGSHU']
    });
  });

  it('fails closed for a Visual Output that is not current in the Workspace', async () => {
    await expect(
      resolver().resolve(workspaceId, userId, {
        targetType: 'VISUAL_OUTPUT',
        targetId: 'visual-output_not-current',
        targetVersion: 1
      })
    ).rejects.toMatchObject({
      code: 'TARGET_NOT_FOUND',
      status: 404
    });
  });
});
