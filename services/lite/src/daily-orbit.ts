import { createHash } from 'node:crypto';
import type {
  ContentPick,
  ContentPickPlatform,
  CreatorPreference,
  DailyOrbitItem,
  DailyOrbitScoreComponent,
  DailyOrbitSection,
  DailySignal
} from '@markorbit/contracts/daily-workspace';
import type {
  LiteTodaySnapshot,
  ProductLoopSourceReference,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DailyOrbitErrorCode = 'INVALID_INPUT' | 'PERSISTENCE_UNAVAILABLE';

export class DailyOrbitError extends Error {
  constructor(
    readonly code: DailyOrbitErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DailyOrbitError';
  }
}

export interface DailySignalReader {
  listRecent(workspaceId: string, limit?: number): Promise<readonly DailySignal[]>;
}

export interface DailyOrbitTodayReader {
  listToday(workspaceId: string): Promise<LiteTodaySnapshot>;
}

export interface DailyOrbitPreferenceProvider {
  resolve(workspaceId: string, subjectUserId: string): Promise<CreatorPreference | undefined>;
}

export class NoCreatorPreferenceProvider implements DailyOrbitPreferenceProvider {
  resolve(): Promise<undefined> {
    return Promise.resolve(undefined);
  }
}

export interface DailyOrbitSnapshot {
  schemaVersion: 1;
  workspaceId: string;
  subjectUserId: string;
  generatedAt: string;
  preferenceSource: CreatorPreference['source'] | 'NONE';
  items: ReadonlyArray<Readonly<DailyOrbitItem>>;
  contentPicks: ReadonlyArray<Readonly<ContentPick>>;
  partial: boolean;
  warnings: readonly string[];
  executionAuthorized: false;
  legalTruthVerified: false;
}

type Row = Record<string, unknown>;

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new DailyOrbitError('INVALID_INPUT', 'workspaceId must be a Core Workspace UUID.', 422);
  return cleaned;
}

function cleanUserId(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new DailyOrbitError('INVALID_INPUT', 'subjectUserId is required.', 422);
  return cleaned;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function component(score: number, reason: string): DailyOrbitScoreComponent {
  return { score: Math.max(0, Math.min(100, Math.round(score))), reason };
}

function importance(signal: Readonly<DailySignal>): DailyOrbitScoreComponent {
  const scores: Record<DailySignal['changeType'], number> = {
    DEADLINE_CHANGE: 95,
    RULE_CHANGE: 90,
    FEE_CHANGE: 85,
    CASE_DECISION: 80,
    OFFICE_NOTICE: 65,
    INDUSTRY_NEWS: 55,
    MARKET_SIGNAL: 55,
    OTHER: 40
  };
  return component(
    scores[signal.changeType],
    `${signal.changeType} carries the bounded importance weight for this Orbit.`
  );
}

function timeSensitivity(signal: Readonly<DailySignal>): DailyOrbitScoreComponent {
  const scores: Record<DailySignal['timeSensitivity'], number> = {
    URGENT: 100,
    HIGH: 85,
    MEDIUM: 60,
    LOW: 30
  };
  return component(
    scores[signal.timeSensitivity],
    `Source-derived time sensitivity is ${signal.timeSensitivity}.`
  );
}

function contentPotential(signal: Readonly<DailySignal>): DailyOrbitScoreComponent {
  const scores: Record<DailySignal['changeType'], number> = {
    RULE_CHANGE: 90,
    FEE_CHANGE: 90,
    CASE_DECISION: 85,
    DEADLINE_CHANGE: 75,
    INDUSTRY_NEWS: 75,
    MARKET_SIGNAL: 75,
    OFFICE_NOTICE: 70,
    OTHER: 45
  };
  const factNote = signal.keyFacts.length
    ? ` It carries ${signal.keyFacts.length} source-derived key fact${signal.keyFacts.length === 1 ? '' : 's'}.`
    : ' It carries no separate source-derived key facts.';
  return component(
    scores[signal.changeType],
    `${signal.changeType} has bounded editorial potential.${factNote}`
  );
}

function normalized(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function personalRelevance(
  signal: Readonly<DailySignal>,
  preference: Readonly<CreatorPreference> | undefined
): DailyOrbitScoreComponent {
  if (!preference)
    return component(
      50,
      'This is a Workspace-scoped signal; no explicit Creator Preference is available.'
    );

  const preferredJurisdictions = normalized(preference.primaryJurisdictions);
  const preferredTopics = normalized(preference.professionalTopics);
  if (!preferredJurisdictions.size && !preferredTopics.size)
    return component(50, 'The explicit Creator Preference has no jurisdiction or topic selectors.');

  const signalJurisdictions = normalized(signal.jurisdictions);
  const signalTopics = normalized(signal.topicTags);
  const jurisdictionMatch =
    preferredJurisdictions.size > 0 &&
    [...signalJurisdictions].some((value) => preferredJurisdictions.has(value));
  const topicMatch =
    preferredTopics.size > 0 && [...signalTopics].some((value) => preferredTopics.has(value));
  const configuredDimensions =
    Number(preferredJurisdictions.size > 0) + Number(preferredTopics.size > 0);
  const matchedDimensions = Number(jurisdictionMatch) + Number(topicMatch);

  if (matchedDimensions === configuredDimensions)
    return component(
      95,
      'The signal matches every configured jurisdiction/topic preference dimension.'
    );
  if (matchedDimensions > 0)
    return component(
      75,
      'The signal matches part of the explicit jurisdiction/topic Creator Preference.'
    );
  return component(
    25,
    'The signal does not match the configured jurisdiction/topic Creator Preference.'
  );
}

function exactSource(
  left: Readonly<ProductLoopSourceReference>,
  right: Readonly<ProductLoopSourceReference>
) {
  return (
    left.owner === right.owner &&
    left.kind === right.kind &&
    left.sourceId === right.sourceId &&
    String(left.sourceVersion) === String(right.sourceVersion) &&
    left.sourceFingerprintSha256 === right.sourceFingerprintSha256
  );
}

function evidenceText(signal: Readonly<DailySignal>): string {
  return [signal.title, signal.summary, ...signal.keyFacts].join('\n').toLowerCase();
}

function sectionFor(
  signal: Readonly<DailySignal>,
  relevance: Readonly<DailyOrbitScoreComponent>,
  preference: Readonly<CreatorPreference> | undefined,
  rankedAt: string
): DailyOrbitSection {
  const text = evidenceText(signal);
  if (
    /\brisk\b|penalt|refusal|rejection|cancellation|expiration|风险|罚款|驳回|撤销|失效/u.test(text)
  )
    return 'RISK';
  if (
    /\bopportunit(y|ies)\b|new (route|program|option)|available now|机会|新渠道|新途径|新选项/u.test(
      text
    )
  )
    return 'OPPORTUNITY';

  const ageMs = Math.max(0, Date.parse(rankedAt) - Date.parse(signal.observedAt));
  if (signal.timeSensitivity === 'LOW' && ageMs >= 72 * 60 * 60 * 1000) return 'WORTH_REVISITING';
  if (preference && relevance.score >= 75) return 'FOR_YOU';
  return 'TODAYS_ORBIT';
}

function matchedRecommendation(
  signal: Readonly<DailySignal>,
  recommendations: readonly Readonly<TodayRecommendation>[]
): Readonly<TodayRecommendation> | undefined {
  return recommendations.find((recommendation) =>
    recommendation.sources.some((source) => exactSource(source, signal.source))
  );
}

export function rankDailyOrbitItem(
  signal: Readonly<DailySignal>,
  subjectUserIdValue: string,
  preference: Readonly<CreatorPreference> | undefined,
  recommendation: Readonly<TodayRecommendation> | undefined,
  rankedAt: string
): DailyOrbitItem {
  const subjectUserId = cleanUserId(subjectUserIdValue);
  if (preference) {
    if (preference.workspaceId.toLowerCase() !== signal.workspaceId.toLowerCase())
      throw new DailyOrbitError(
        'INVALID_INPUT',
        'Creator Preference belongs to a different Workspace.',
        422
      );
    if (preference.subjectUserId !== subjectUserId)
      throw new DailyOrbitError(
        'INVALID_INPUT',
        'Creator Preference belongs to a different user.',
        422
      );
  }

  const importanceScore = importance(signal);
  const relevanceScore = personalRelevance(signal, preference);
  const timeScore = timeSensitivity(signal);
  const contentScore = contentPotential(signal);
  const total = Math.round(
    importanceScore.score * 0.3 +
      relevanceScore.score * 0.3 +
      timeScore.score * 0.25 +
      contentScore.score * 0.15
  );
  const score = {
    importance: importanceScore,
    personalRelevance: relevanceScore,
    timeSensitivity: timeScore,
    contentPotential: contentScore,
    total
  };
  const identity = digest(`${signal.dailySignalFingerprintSha256}:${subjectUserId}`);

  return {
    schemaVersion: 1,
    dailyOrbitItemId: `daily-orbit-item_${identity.slice(0, 32)}`,
    workspaceId: signal.workspaceId,
    version: 1,
    signal: { id: signal.dailySignalId, version: signal.version },
    ...(recommendation
      ? {
          recommendation: {
            id: recommendation.todayRecommendationId,
            version: recommendation.version
          }
        }
      : {}),
    section: sectionFor(signal, relevanceScore, preference, rankedAt),
    score,
    whyThisMatters: `${importanceScore.reason} ${timeScore.reason} ${relevanceScore.reason}`,
    source: structuredClone(signal.source),
    rankedAt,
    executionAuthorized: false,
    legalTruthVerified: false
  };
}

function contentPickFor(
  item: Readonly<DailyOrbitItem>,
  signal: Readonly<DailySignal>,
  recommendation: Readonly<TodayRecommendation> | undefined,
  preference: Readonly<CreatorPreference> | undefined
): ContentPick | undefined {
  if (!recommendation || recommendation.kind !== 'CONTENT_PREPARATION') return undefined;
  if (item.score.contentPotential.score < 70) return undefined;

  const preferredPlatforms = preference?.preferredPlatforms ?? [];
  const platforms: readonly ContentPickPlatform[] = preferredPlatforms.length
    ? [...preferredPlatforms]
    : ['WECHAT_OFFICIAL_ACCOUNT', 'WECHAT_MOMENTS'];
  const angles = signal.keyFacts.length ? signal.keyFacts.slice(0, 3) : [signal.summary];
  const identity = digest(
    `${item.dailyOrbitItemId}:${recommendation.todayRecommendationId}:${recommendation.version}`
  );
  return {
    schemaVersion: 1,
    contentPickId: `content-pick_${identity.slice(0, 32)}`,
    workspaceId: signal.workspaceId,
    version: 1,
    orbitItem: { id: item.dailyOrbitItemId, version: item.version },
    recommendation: {
      id: recommendation.todayRecommendationId,
      version: recommendation.version
    },
    title: signal.title,
    whyPublish: item.score.contentPotential.reason,
    suggestedAngles: [...angles],
    recommendedPlatforms: [...platforms],
    publishAuthorized: false,
    externalPublishExecuted: false,
    createdAt: signal.createdAt
  };
}

export class PostgresDailySignalReader implements DailySignalReader {
  constructor(private readonly query: QueryClient) {}

  async listRecent(workspaceIdValue: string, limit = 100): Promise<readonly DailySignal[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const boundedLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    try {
      const result = await this.query.query(
        'SELECT document_json FROM lite_daily_signals WHERE workspace_id=$1 ORDER BY observed_at DESC,created_at DESC,daily_signal_id ASC LIMIT $2',
        [workspaceId, boundedLimit]
      );
      return result.rows.map((row) => {
        const signal = structuredClone((row as Row).document_json as DailySignal);
        if (signal.workspaceId.toLowerCase() !== workspaceId)
          throw new DailyOrbitError(
            'PERSISTENCE_UNAVAILABLE',
            'Stored Daily Signal violates Workspace isolation.',
            503,
            true
          );
        return signal;
      });
    } catch (error) {
      if (error instanceof DailyOrbitError) throw error;
      throw new DailyOrbitError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Daily Orbit source persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export class DailyOrbitService {
  constructor(
    private readonly signals: DailySignalReader,
    private readonly today: DailyOrbitTodayReader,
    private readonly preferences: DailyOrbitPreferenceProvider = new NoCreatorPreferenceProvider(),
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async snapshot(
    workspaceIdValue: string,
    subjectUserIdValue: string
  ): Promise<DailyOrbitSnapshot> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const subjectUserId = cleanUserId(subjectUserIdValue);
    const generatedAt = new Date(this.now()).toISOString();
    const warnings: string[] = [];

    const signalValues = await this.signals.listRecent(workspaceId);
    let preference: CreatorPreference | undefined;
    try {
      preference = await this.preferences.resolve(workspaceId, subjectUserId);
    } catch {
      warnings.push('CREATOR_PREFERENCE_UNAVAILABLE');
    }
    if (preference) {
      if (preference.workspaceId.toLowerCase() !== workspaceId)
        throw new DailyOrbitError(
          'INVALID_INPUT',
          'Creator Preference belongs to a different Workspace.',
          422
        );
      if (preference.subjectUserId !== subjectUserId)
        throw new DailyOrbitError(
          'INVALID_INPUT',
          'Creator Preference belongs to a different user.',
          422
        );
    }

    let recommendations: readonly Readonly<TodayRecommendation>[] = [];
    try {
      const today = await this.today.listToday(workspaceId);
      recommendations = today.items.map((entry) => entry.recommendation);
      if (today.partial) warnings.push(...today.warnings.map((warning) => `TODAY:${warning}`));
    } catch {
      warnings.push('TODAY_RECOMMENDATIONS_UNAVAILABLE');
    }

    const ranked = signalValues
      .map((signal) => {
        const recommendation = matchedRecommendation(signal, recommendations);
        return {
          signal,
          recommendation,
          item: rankDailyOrbitItem(signal, subjectUserId, preference, recommendation, generatedAt)
        };
      })
      .sort(
        (left, right) =>
          right.item.score.total - left.item.score.total ||
          Date.parse(right.signal.observedAt) - Date.parse(left.signal.observedAt) ||
          left.item.dailyOrbitItemId.localeCompare(right.item.dailyOrbitItemId)
      );

    const items = ranked.map((entry) => entry.item);
    const contentPicks = ranked
      .map((entry) => contentPickFor(entry.item, entry.signal, entry.recommendation, preference))
      .filter((value): value is ContentPick => Boolean(value));

    return {
      schemaVersion: 1,
      workspaceId,
      subjectUserId,
      generatedAt,
      preferenceSource: preference?.source ?? 'NONE',
      items,
      contentPicks,
      partial: warnings.length > 0,
      warnings,
      executionAuthorized: false,
      legalTruthVerified: false
    };
  }
}
