import { createHash, randomUUID } from 'node:crypto';
import {
  contentPickPlatforms,
  productPreferenceEventKinds,
  type ContentPickPlatform,
  type CreatorPreference,
  type ProductPreferenceEvent,
  type ProductPreferenceEventId,
  type ProductPreferenceEventKind
} from '@markorbit/contracts/daily-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
import type { DailyOrbitPreferenceProvider } from './daily-orbit.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TARGET_TYPES: readonly ProductPreferenceEvent['targetType'][] = [
  'DAILY_ORBIT_ITEM',
  'CONTENT_PICK',
  'CONTENT_KIT',
  'PLATFORM_VARIANT',
  'VISUAL_OUTPUT'
];

export type ProductPreferenceErrorCode =
  'INVALID_INPUT' | 'IDEMPOTENCY_CONFLICT' | 'PERSISTENCE_UNAVAILABLE';

export class ProductPreferenceError extends Error {
  constructor(
    readonly code: ProductPreferenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ProductPreferenceError';
  }
}

/**
 * Internal-only, server-derived semantic context for a Product interaction.
 * This is deliberately not accepted as browser-authored truth by the HTTP boundary.
 */
export interface ProductPreferenceContext {
  jurisdictions: readonly string[];
  topics: readonly string[];
  platforms: readonly ContentPickPlatform[];
}

export interface RecordCanonicalProductPreferenceEventCommand {
  workspaceId: string;
  subjectUserId: string;
  kind: ProductPreferenceEventKind;
  targetType: ProductPreferenceEvent['targetType'];
  targetId: string;
  targetVersion: number | string;
  context: Readonly<ProductPreferenceContext>;
  idempotencyKey: string;
}

export interface RecordProductPreferenceEventResult {
  event: Readonly<ProductPreferenceEvent>;
  preference: Readonly<CreatorPreference>;
}

type Row = Record<string, unknown>;
type StoredEvidence = Readonly<{
  event: ProductPreferenceEvent;
  context: ProductPreferenceContext;
}>;

const weights: Readonly<Record<ProductPreferenceEventKind, number>> = Object.freeze({
  SHOWN: 0,
  OPENED: 1,
  DISMISSED: -2,
  SAVED: 3,
  CONTENT_STARTED: 3,
  ANGLE_SELECTED: 2,
  PLATFORM_VARIANT_GENERATED: 2,
  DRAFT_EDITED: 3,
  VISUAL_REQUESTED: 2,
  VISUAL_GENERATED: 0,
  VISUAL_SELECTED: 3,
  COPIED: 2,
  EXPORTED: 3,
  USER_REPORTED_PUBLISHED: 4,
  USER_REPORTED_USED: 4,
  NOT_USED: -3
});

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new ProductPreferenceError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return cleaned;
}

function cleanText(value: string, field: string, maximum: number): string {
  const cleaned = value.trim();
  if (!cleaned) throw new ProductPreferenceError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new ProductPreferenceError('INVALID_INPUT', `${field} exceeds the allowed length.`, 422);
  return cleaned;
}

function cleanVersion(value: number | string): number | string {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1)
      throw new ProductPreferenceError('INVALID_INPUT', 'targetVersion must be positive.', 422);
    return value;
  }
  return cleanText(value, 'targetVersion', 200);
}

function cleanValues(values: unknown, field: string, maximum = 25): string[] {
  if (!Array.isArray(values))
    throw new ProductPreferenceError('INVALID_INPUT', `${field} must be an array.`, 422);
  const entries: readonly unknown[] = values;
  const cleaned: string[] = [];
  for (const raw of entries) {
    if (typeof raw !== 'string')
      throw new ProductPreferenceError('INVALID_INPUT', `${field} must contain strings.`, 422);
    cleaned.push(cleanText(raw, field, 200));
  }
  const unique = [...new Set(cleaned)];
  if (unique.length > maximum)
    throw new ProductPreferenceError('INVALID_INPUT', `${field} has too many values.`, 422);
  return unique;
}

function isContentPickPlatform(value: string): value is ContentPickPlatform {
  return (contentPickPlatforms as readonly string[]).includes(value);
}

function normalizeContext(value: Readonly<ProductPreferenceContext>): ProductPreferenceContext {
  const platforms = cleanValues(value.platforms, 'context.platforms').map((platform) => {
    if (!isContentPickPlatform(platform))
      throw new ProductPreferenceError(
        'INVALID_INPUT',
        'context.platforms contains an invalid platform.',
        422
      );
    return platform;
  });
  return {
    jurisdictions: cleanValues(value.jurisdictions, 'context.jurisdictions'),
    topics: cleanValues(value.topics, 'context.topics'),
    platforms
  };
}

function timestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new ProductPreferenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Preference clock returned an invalid timestamp.',
      503,
      true
    );
  return parsed.toISOString();
}

function eventId(): ProductPreferenceEventId {
  return `product-preference-event_${randomUUID().replaceAll('-', '')}`;
}

function preferenceId(
  workspaceId: string,
  subjectUserId: string
): CreatorPreference['creatorPreferenceId'] {
  return `creator-preference_${fingerprint(`${workspaceId}:${subjectUserId}`).slice(0, 32)}`;
}

function sortedPositiveScores(scores: ReadonlyMap<string, number>, limit: number): string[] {
  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort(
      ([leftValue, leftScore], [rightValue, rightScore]) =>
        rightScore - leftScore || leftValue.localeCompare(rightValue)
    )
    .slice(0, limit)
    .map(([value]) => value);
}

function addScores(scores: Map<string, number>, values: readonly string[], weight: number): void {
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    scores.set(value, (scores.get(value) ?? 0) + weight);
  }
}

export function projectProductFeedbackPreference(
  workspaceIdValue: string,
  subjectUserIdValue: string,
  evidence: readonly StoredEvidence[]
): CreatorPreference | undefined {
  if (!evidence.length) return undefined;
  const workspaceId = cleanWorkspaceId(workspaceIdValue);
  const subjectUserId = cleanText(subjectUserIdValue, 'subjectUserId', 300);
  const jurisdictions = new Map<string, number>();
  const topics = new Map<string, number>();
  const platforms = new Map<string, number>();

  for (const entry of evidence) {
    if (
      entry.event.workspaceId.toLowerCase() !== workspaceId ||
      entry.event.subjectUserId !== subjectUserId
    )
      throw new ProductPreferenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Stored Product preference evidence violates Workspace/user isolation.',
        503,
        true
      );
    const weight = weights[entry.event.kind];
    addScores(jurisdictions, entry.context.jurisdictions, weight);
    addScores(topics, entry.context.topics, weight);
    addScores(platforms, entry.context.platforms, weight);
  }

  const updatedAt = evidence
    .map((entry) => timestamp(entry.event.recordedAt))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0]!;

  return {
    schemaVersion: 1,
    creatorPreferenceId: preferenceId(workspaceId, subjectUserId),
    workspaceId,
    subjectUserId,
    version: evidence.length,
    source: 'PRODUCT_FEEDBACK',
    primaryJurisdictions: sortedPositiveScores(jurisdictions, 12),
    professionalTopics: sortedPositiveScores(topics, 20),
    targetAudiences: [],
    preferredPlatforms: sortedPositiveScores(
      platforms,
      contentPickPlatforms.length
    ) as ContentPickPlatform[],
    tonePreferences: [],
    capabilityVerified: false,
    updatedAt
  };
}

export class PostgresProductPreferenceStore implements DailyOrbitPreferenceProvider {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextEventId: () => ProductPreferenceEventId = eventId
  ) {}

  async recordCanonicalEvent(
    command: Readonly<RecordCanonicalProductPreferenceEventCommand>
  ): Promise<RecordProductPreferenceEventResult> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const subjectUserId = cleanText(command.subjectUserId, 'subjectUserId', 300);
    if (!productPreferenceEventKinds.includes(command.kind))
      throw new ProductPreferenceError(
        'INVALID_INPUT',
        'Product preference event kind is invalid.',
        422
      );
    if (!TARGET_TYPES.includes(command.targetType))
      throw new ProductPreferenceError(
        'INVALID_INPUT',
        'Product preference target type is invalid.',
        422
      );
    const targetId = cleanText(command.targetId, 'targetId', 500);
    const targetVersion = cleanVersion(command.targetVersion);
    const context = normalizeContext(command.context);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      subjectUserId,
      kind: command.kind,
      targetType: command.targetType,
      targetId,
      targetVersion,
      context
    });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:${subjectUserId}:product-preference:${idempotencyKey}`
        ]);
        const replay = await client.query(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM lite_product_preference_commands WHERE workspace_id=$1 AND subject_user_id=$2 AND idempotency_key=$3',
          [workspaceId, subjectUserId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (
            prior.command_type !== 'RECORD_PRODUCT_PREFERENCE_EVENT' ||
            prior.request_fingerprint_sha256 !== requestFingerprintSha256
          )
            throw new ProductPreferenceError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency-Key was already used for different Product preference evidence.'
            );
          return structuredClone(prior.result_json as RecordProductPreferenceEventResult);
        }

        const recordedAt = timestamp(this.now());
        const event: ProductPreferenceEvent = {
          schemaVersion: 1,
          productPreferenceEventId: this.nextEventId(),
          workspaceId,
          subjectUserId,
          kind: command.kind,
          targetType: command.targetType,
          targetId,
          targetVersion,
          recordedAt,
          externalActionExecutedByMarkOrbit: false,
          externalOutcomeVerifiedByMarkOrbit: false,
          capabilityVerified: false
        };
        await client.query(
          `INSERT INTO lite_product_preference_events(
             workspace_id,product_preference_event_id,subject_user_id,kind,target_type,target_id,
             target_version,context_json,document_json,recorded_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
          [
            workspaceId,
            event.productPreferenceEventId,
            subjectUserId,
            event.kind,
            event.targetType,
            event.targetId,
            String(event.targetVersion),
            JSON.stringify(context),
            JSON.stringify(event),
            recordedAt
          ]
        );

        const all = await client.query(
          `SELECT document_json,context_json
             FROM lite_product_preference_events
            WHERE workspace_id=$1 AND subject_user_id=$2
            ORDER BY recorded_at,product_preference_event_id`,
          [workspaceId, subjectUserId]
        );
        const evidence: StoredEvidence[] = all.rows.map((row) => ({
          event: structuredClone((row as Row).document_json as ProductPreferenceEvent),
          context: normalizeContext((row as Row).context_json as ProductPreferenceContext)
        }));
        const preference = projectProductFeedbackPreference(workspaceId, subjectUserId, evidence);
        if (!preference)
          throw new ProductPreferenceError(
            'PERSISTENCE_UNAVAILABLE',
            'Preference projection unexpectedly produced no result.',
            503,
            true
          );

        await client.query(
          `INSERT INTO lite_creator_preferences(
             workspace_id,subject_user_id,creator_preference_id,version,source,document_json,updated_at
           ) VALUES($1,$2,$3,$4,'PRODUCT_FEEDBACK',$5::jsonb,$6)
           ON CONFLICT(workspace_id,subject_user_id) DO UPDATE SET
             creator_preference_id=EXCLUDED.creator_preference_id,
             version=EXCLUDED.version,
             source=EXCLUDED.source,
             document_json=EXCLUDED.document_json,
             updated_at=EXCLUDED.updated_at`,
          [
            workspaceId,
            subjectUserId,
            preference.creatorPreferenceId,
            preference.version,
            JSON.stringify(preference),
            preference.updatedAt
          ]
        );

        const result: RecordProductPreferenceEventResult = { event, preference };
        await client.query(
          `INSERT INTO lite_product_preference_commands(
             workspace_id,subject_user_id,idempotency_key,command_type,request_fingerprint_sha256,
             result_json,created_at
           ) VALUES($1,$2,$3,'RECORD_PRODUCT_PREFERENCE_EVENT',$4,$5::jsonb,$6)`,
          [
            workspaceId,
            subjectUserId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(result),
            recordedAt
          ]
        );
        return result;
      });
    } catch (error) {
      if (error instanceof ProductPreferenceError) throw error;
      throw new ProductPreferenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Product preference persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async resolve(
    workspaceIdValue: string,
    subjectUserIdValue: string
  ): Promise<CreatorPreference | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const subjectUserId = cleanText(subjectUserIdValue, 'subjectUserId', 300);
    try {
      const result = await this.query.query(
        'SELECT document_json FROM lite_creator_preferences WHERE workspace_id=$1 AND subject_user_id=$2',
        [workspaceId, subjectUserId]
      );
      const row = result.rows[0] as Row | undefined;
      if (!row) return undefined;
      const preference = structuredClone(row.document_json as CreatorPreference);
      if (
        preference.workspaceId.toLowerCase() !== workspaceId ||
        preference.subjectUserId !== subjectUserId ||
        preference.source !== 'PRODUCT_FEEDBACK' ||
        preference.capabilityVerified !== false
      )
        throw new ProductPreferenceError(
          'PERSISTENCE_UNAVAILABLE',
          'Stored Creator Preference violates Product authority boundaries.',
          503,
          true
        );
      return preference;
    } catch (error) {
      if (error instanceof ProductPreferenceError) throw error;
      throw new ProductPreferenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Creator Preference persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async listRecentEvents(
    workspaceIdValue: string,
    subjectUserIdValue: string,
    limit = 100
  ): Promise<ProductPreferenceEvent[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const subjectUserId = cleanText(subjectUserIdValue, 'subjectUserId', 300);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
      throw new ProductPreferenceError('INVALID_INPUT', 'limit must be between 1 and 500.', 422);
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_product_preference_events
          WHERE workspace_id=$1 AND subject_user_id=$2
          ORDER BY recorded_at DESC,product_preference_event_id DESC LIMIT $3`,
        [workspaceId, subjectUserId, limit]
      );
      return result.rows.map((row) =>
        structuredClone((row as Row).document_json as ProductPreferenceEvent)
      );
    } catch (error) {
      if (error instanceof ProductPreferenceError) throw error;
      throw new ProductPreferenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Product preference event persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
