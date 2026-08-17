import { describe, expect, it } from 'vitest';
import type { CreatorPreference, DailySignal } from '@markorbit/contracts/daily-workspace';
import type { LiteTodaySnapshot, TodayRecommendation } from '@markorbit/contracts/product-loop';
import {
  DailyOrbitService,
  rankDailyOrbitItem,
  type DailyOrbitPreferenceProvider,
  type DailyOrbitTodayReader,
  type DailySignalReader
} from '../src/daily-orbit.js';

const workspaceId = '81818181-8181-4818-8818-818181818181';
const userId = 'user_m9_wp03';
const source = {
  schemaVersion: 1 as const,
  owner: 'CORE' as const,
  kind: 'KNOWLEDGE_READY_PACKAGE' as const,
  sourceId: 'rdp_m9-wp03-uspto',
  sourceVersion: 'CORE_CONTENT_V1',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-08-18T02:00:00.000Z'
};

function signal(overrides: Partial<DailySignal> = {}): DailySignal {
  return {
    schemaVersion: 1,
    dailySignalId: 'daily-signal_m9-wp03',
    workspaceId,
    version: 1,
    source,
    title: 'USPTO trademark fee update',
    summary: 'The USPTO fee update becomes effective from next month.',
    keyFacts: ['Applicants should review the new filing fee schedule.'],
    jurisdictions: ['US'],
    institution: 'USPTO',
    topicTags: ['trademark'],
    changeType: 'FEE_CHANGE',
    observedAt: source.observedAt,
    timeSensitivity: 'HIGH',
    dailySignalFingerprintSha256: 'b'.repeat(64),
    legalTruthVerified: false,
    recommendationCreatedAutomatically: false,
    createdAt: '2026-08-18T02:01:00.000Z',
    ...overrides
  };
}

function preference(): CreatorPreference {
  return {
    schemaVersion: 1,
    creatorPreferenceId: 'creator-preference_m9-wp03',
    workspaceId,
    subjectUserId: userId,
    version: 1,
    source: 'EXPLICIT',
    primaryJurisdictions: ['US'],
    professionalTopics: ['trademark'],
    targetAudiences: ['brand owners'],
    preferredPlatforms: ['WECHAT_OFFICIAL_ACCOUNT'],
    tonePreferences: ['professional'],
    capabilityVerified: false,
    updatedAt: '2026-08-18T02:02:00.000Z'
  };
}

function recommendation(exact = true): TodayRecommendation {
  return {
    schemaVersion: 1,
    todayRecommendationId: 'today-recommendation_m9-wp03',
    workspaceId,
    version: 1,
    kind: 'CONTENT_PREPARATION',
    title: 'Prepare a fee update explainer',
    explanation: 'The exact governed source is suitable for content preparation.',
    sources: [
      exact
        ? source
        : {
            ...source,
            sourceFingerprintSha256: 'f'.repeat(64)
          }
    ],
    status: 'OPEN',
    recommendationFingerprintSha256: 'c'.repeat(64),
    executionAuthorized: false,
    createdAt: '2026-08-18T02:03:00.000Z',
    updatedAt: '2026-08-18T02:03:00.000Z'
  };
}

function today(value: TodayRecommendation | undefined): LiteTodaySnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt: '2026-08-18T03:00:00.000Z',
    items: value ? [{ recommendation: value, preparedActions: [] }] : [],
    partial: false,
    warnings: []
  };
}

class Signals implements DailySignalReader {
  constructor(private readonly values: readonly DailySignal[]) {}
  listRecent(requestWorkspaceId: string): Promise<readonly DailySignal[]> {
    expect(requestWorkspaceId).toBe(workspaceId);
    return Promise.resolve(this.values);
  }
}

class Today implements DailyOrbitTodayReader {
  constructor(private readonly value: LiteTodaySnapshot) {}
  listToday(requestWorkspaceId: string): Promise<LiteTodaySnapshot> {
    expect(requestWorkspaceId).toBe(workspaceId);
    return Promise.resolve(this.value);
  }
}

class Preferences implements DailyOrbitPreferenceProvider {
  constructor(private readonly value: CreatorPreference | Error | undefined) {}
  resolve(
    requestWorkspaceId: string,
    requestUserId: string
  ): Promise<CreatorPreference | undefined> {
    expect(requestWorkspaceId).toBe(workspaceId);
    expect(requestUserId).toBe(userId);
    if (this.value instanceof Error) return Promise.reject(this.value);
    return Promise.resolve(this.value);
  }
}

describe('M9-WP-03 Personal Daily Orbit', () => {
  it('uses an explicit Creator Preference and keeps every score explainable', () => {
    const item = rankDailyOrbitItem(
      signal(),
      userId,
      preference(),
      recommendation(),
      '2026-08-18T03:00:00.000Z'
    );
    expect(item.section).toBe('FOR_YOU');
    expect(item.score.personalRelevance.score).toBe(95);
    expect(item.score.importance.reason).toContain('FEE_CHANGE');
    expect(item.score.timeSensitivity.reason).toContain('HIGH');
    expect(item.score.contentPotential.reason).toContain('editorial potential');
    expect(item.whyThisMatters).toContain('Creator Preference');
    expect(item.source).toEqual(source);
    expect(item.recommendation).toEqual({ id: recommendation().todayRecommendationId, version: 1 });
    expect(item.executionAuthorized).toBe(false);
    expect(item.legalTruthVerified).toBe(false);
  });

  it('uses a transparent Workspace baseline when no explicit preference exists', () => {
    const item = rankDailyOrbitItem(
      signal(),
      userId,
      undefined,
      undefined,
      '2026-08-18T03:00:00.000Z'
    );
    expect(item.section).toBe('TODAYS_ORBIT');
    expect(item.score.personalRelevance.score).toBe(50);
    expect(item.score.personalRelevance.reason).toContain('no explicit Creator Preference');
  });

  it('uses RISK only when the source-derived signal carries explicit risk evidence', () => {
    const neutral = rankDailyOrbitItem(
      signal({ title: 'Trademark deadline update', changeType: 'DEADLINE_CHANGE' }),
      userId,
      undefined,
      undefined,
      '2026-08-18T03:00:00.000Z'
    );
    expect(neutral.section).toBe('TODAYS_ORBIT');

    const explicitRisk = rankDailyOrbitItem(
      signal({
        title: 'Trademark cancellation risk notice',
        summary: 'The notice describes an explicit cancellation risk.'
      }),
      userId,
      undefined,
      undefined,
      '2026-08-18T03:00:00.000Z'
    );
    expect(explicitRisk.section).toBe('RISK');
  });

  it('creates a Content Pick only from an exact real CONTENT_PREPARATION Recommendation', async () => {
    const exactService = new DailyOrbitService(
      new Signals([signal()]),
      new Today(today(recommendation(true))),
      new Preferences(preference()),
      () => '2026-08-18T03:00:00.000Z'
    );
    const exact = await exactService.snapshot(workspaceId, userId);
    expect(exact.items).toHaveLength(1);
    expect(exact.contentPicks).toHaveLength(1);
    expect(exact.contentPicks[0]?.recommendation).toEqual({
      id: 'today-recommendation_m9-wp03',
      version: 1
    });
    expect(exact.contentPicks[0]?.recommendedPlatforms).toEqual(['WECHAT_OFFICIAL_ACCOUNT']);
    expect(exact.contentPicks[0]?.publishAuthorized).toBe(false);
    expect(exact.contentPicks[0]?.externalPublishExecuted).toBe(false);

    const staleService = new DailyOrbitService(
      new Signals([signal()]),
      new Today(today(recommendation(false))),
      new Preferences(preference()),
      () => '2026-08-18T03:00:00.000Z'
    );
    const stale = await staleService.snapshot(workspaceId, userId);
    expect(stale.items[0]?.recommendation).toBeUndefined();
    expect(stale.contentPicks).toEqual([]);
  });

  it('degrades preference-provider failure explicitly without inventing preference evidence', async () => {
    const service = new DailyOrbitService(
      new Signals([signal()]),
      new Today(today(undefined)),
      new Preferences(new Error('preference store unavailable')),
      () => '2026-08-18T03:00:00.000Z'
    );
    const snapshot = await service.snapshot(workspaceId, userId);
    expect(snapshot.preferenceSource).toBe('NONE');
    expect(snapshot.partial).toBe(true);
    expect(snapshot.warnings).toContain('CREATOR_PREFERENCE_UNAVAILABLE');
    expect(snapshot.items[0]?.score.personalRelevance.score).toBe(50);
  });
});
