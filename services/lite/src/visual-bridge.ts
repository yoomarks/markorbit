import { createHash, randomUUID } from 'node:crypto';
import type {
  ContentKit,
  ContentKitId,
  VisualAssetReference,
  VisualBrief,
  VisualBriefId,
  VisualOutput,
  VisualOutputId
} from '@markorbit/contracts/daily-workspace';
import type { ProductLoopExactReference } from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
import type { ContentKitService, ContentKitVisualBriefReferenceReader } from './content-kit.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/u;
const REQUEST_REFERENCE = /^illustration-request:\/\/[^\s]+$/u;
const OUTPUT_REFERENCE = /^(library|delivery):\/\/[^\s]+$/u;
const LITE_VISUAL_API_VERSION = 'lite-illustration-request/v1' as const;

export type VisualBridgeErrorCode =
  | 'INVALID_INPUT'
  | 'CONTENT_KIT_STALE'
  | 'VISUAL_BRIEF_NOT_FOUND'
  | 'VISUAL_CONSUMER_UNAVAILABLE'
  | 'VISUAL_CONSUMER_REJECTED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class VisualBridgeError extends Error {
  constructor(
    readonly code: VisualBridgeErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'VisualBridgeError';
  }
}

export interface LiteVisualRequestEnvelope {
  readonly api_version: typeof LITE_VISUAL_API_VERSION;
  readonly operation: 'request.start';
  readonly request_id: string;
  readonly input: Readonly<{
    ip_id: string;
    style_id: string;
    scene_intent: string;
    composition?: string;
    mood?: string;
    props?: readonly string[];
  }>;
}

export type VisualConsumerStatus =
  | 'ACCEPTED'
  | 'PLANNING_ONLY'
  | 'REUSE_SELECTION_REQUIRED'
  | 'REUSE_SELECTED';

export interface VisualConsumerAcceptance {
  readonly requestReference: string;
  readonly status: VisualConsumerStatus;
  readonly certifiedAssetReferences?: readonly string[];
}

export interface VisualEngineConsumerPort {
  start(request: Readonly<LiteVisualRequestEnvelope>): Promise<Readonly<VisualConsumerAcceptance>>;
}

export class UnavailableVisualEngineConsumer implements VisualEngineConsumerPort {
  start(): Promise<never> {
    return Promise.reject(
      new VisualBridgeError(
        'VISUAL_CONSUMER_UNAVAILABLE',
        'No governed MOKI Visual Engine consumer transport is configured.',
        503,
        true
      )
    );
  }
}

export interface VisualBriefRecord {
  readonly brief: Readonly<VisualBrief>;
  readonly visualBriefFingerprintSha256: string;
  readonly consumerIdentity: Readonly<{
    ipId: string;
    styleId: string;
  }>;
}

export interface VisualRequestRecord {
  readonly visualBrief: ProductLoopExactReference<VisualBriefId>;
  readonly requestReference: string;
  readonly requestSha256: string;
  readonly request: Readonly<LiteVisualRequestEnvelope>;
  readonly consumerStatus: VisualConsumerStatus;
  readonly certifiedAssetReferences: readonly string[];
  readonly acceptedAt: string;
}

export interface CreateVisualBriefCommand {
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly contentPickId: string;
  readonly expectedContentKit: ProductLoopExactReference<ContentKitId>;
  readonly ipId: string;
  readonly reusableAssets: readonly VisualAssetReference[];
  readonly idempotencyKey: string;
}

export interface StartVisualRequestCommand {
  readonly workspaceId: string;
  readonly visualBrief: ProductLoopExactReference<VisualBriefId>;
  readonly expectedVisualBriefFingerprintSha256: string;
  readonly idempotencyKey: string;
}

export interface RecordVisualOutputCommand {
  readonly workspaceId: string;
  readonly visualBrief: ProductLoopExactReference<VisualBriefId>;
  readonly assetReferences: readonly string[];
  readonly generatedAt: string;
  readonly idempotencyKey: string;
}

type Row = Record<string, unknown>;

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new VisualBridgeError('INVALID_INPUT', 'workspaceId must be a Core Workspace UUID.', 422);
  return cleaned;
}

function text(value: string, field: string, maximum = 500): string {
  const cleaned = value.trim();
  if (!cleaned) throw new VisualBridgeError('INVALID_INPUT', `${field} is required.`, 422);
  if (cleaned.length > maximum)
    throw new VisualBridgeError('INVALID_INPUT', `${field} exceeds the allowed length.`, 422);
  return cleaned;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assetPriority(asset: Readonly<VisualAssetReference>): number {
  if (asset.discriminative && asset.reusable && asset.source === 'USER_IP') return 0;
  if (asset.discriminative && asset.reusable && asset.source === 'USER_COMMERCIAL') return 1;
  if (asset.discriminative && asset.reusable && asset.source === 'BRAND_KIT') return 2;
  if (asset.reusable && asset.source === 'VISUAL_LIBRARY') return 3;
  if (asset.reusable) return 4;
  return 5;
}

export function normalizeReusableAssets(
  values: readonly Readonly<VisualAssetReference>[]
): readonly VisualAssetReference[] {
  const seen = new Set<string>();
  return values
    .map((asset) => ({
      assetId: text(asset.assetId, 'reusableAssets.assetId', 500),
      source: asset.source,
      discriminative: Boolean(asset.discriminative),
      reusable: Boolean(asset.reusable)
    }))
    .filter((asset) => {
      const key = `${asset.source}:${asset.assetId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        assetPriority(left) - assetPriority(right) || left.assetId.localeCompare(right.assetId)
    );
}

function conceptsFrom(kit: Readonly<ContentKit>): readonly string[] {
  const angles = kit.angles.map((angle) => angle.title.trim()).filter(Boolean);
  if (angles.length) return [...new Set(angles)].slice(0, 8);
  return [kit.whyPublish.trim()].filter(Boolean);
}

function requestId(brief: Readonly<VisualBrief>): string {
  return `lite_${fingerprint({ id: brief.visualBriefId, version: brief.version }).slice(0, 32)}`;
}

export function buildLiteVisualRequest(
  record: Readonly<VisualBriefRecord>
): LiteVisualRequestEnvelope {
  const brief = record.brief;
  const props = brief.reusableAssets
    .filter((asset) => asset.reusable && asset.discriminative)
    .map((asset) => asset.assetId)
    .slice(0, 20);
  return {
    api_version: LITE_VISUAL_API_VERSION,
    operation: 'request.start',
    request_id: requestId(brief),
    input: {
      ip_id: record.consumerIdentity.ipId,
      style_id: record.consumerIdentity.styleId,
      scene_intent: brief.objective,
      composition: 'MO Lite Content Kit editorial visual',
      ...(brief.concepts[0] ? { mood: brief.concepts[0] } : {}),
      ...(props.length ? { props } : {})
    }
  };
}

function assertConsumerAcceptance(value: Readonly<VisualConsumerAcceptance>): void {
  if (!REQUEST_REFERENCE.test(value.requestReference))
    throw new VisualBridgeError(
      'VISUAL_CONSUMER_REJECTED',
      'Visual Engine returned an invalid opaque request reference.',
      502
    );
  for (const reference of value.certifiedAssetReferences ?? []) {
    if (!/^library:\/\/[^\s]+$/u.test(reference))
      throw new VisualBridgeError(
        'VISUAL_CONSUMER_REJECTED',
        'Visual Engine returned a non-certified reuse reference.',
        502
      );
  }
}

export class PostgresVisualBridgeStore implements ContentKitVisualBriefReferenceReader {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextBriefId: () => VisualBriefId = () =>
      `visual-brief_${randomUUID().replaceAll('-', '')}`,
    private readonly nextOutputId: () => VisualOutputId = () =>
      `visual-output_${randomUUID().replaceAll('-', '')}`
  ) {}

  async listByContentKit(
    workspaceIdValue: string,
    contentKit: Readonly<ProductLoopExactReference<ContentKitId>>
  ): Promise<readonly ProductLoopExactReference<VisualBriefId>[]> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT visual_brief_id,version FROM lite_visual_briefs WHERE workspace_id=$1 AND content_kit_id=$2 AND content_kit_version=$3 ORDER BY created_at,visual_brief_id,version',
      [workspaceId, contentKit.id, contentKit.version]
    );
    return result.rows.map((row) => ({
      id: String((row as Row).visual_brief_id) as VisualBriefId,
      version: Number((row as Row).version)
    }));
  }

  async createBrief(
    command: Readonly<CreateVisualBriefCommand>,
    kit: Readonly<ContentKit>,
    styleIdValue: string
  ): Promise<VisualBriefRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const ipId = text(command.ipId, 'ipId', 300);
    const styleId = text(styleIdValue, 'styleId', 300);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey', 300);
    if (
      kit.workspaceId.toLowerCase() !== workspaceId ||
      kit.contentKitId !== command.expectedContentKit.id ||
      kit.version !== command.expectedContentKit.version
    )
      throw new VisualBridgeError(
        'CONTENT_KIT_STALE',
        'Content Kit changed before the Visual Brief could be created.',
        409
      );
    const reusableAssets = normalizeReusableAssets(command.reusableAssets);
    const createdAt = new Date(this.now()).toISOString();
    const base = {
      schemaVersion: 1 as const,
      visualBriefId: this.nextBriefId(),
      workspaceId,
      version: 1,
      contentKit: { id: kit.contentKitId, version: kit.version },
      objective: kit.whyPublish,
      audience: kit.audience,
      concepts: conceptsFrom(kit),
      reusableAssets,
      reuseFirstRequired: true as const,
      providerOverrideAllowed: false as const,
      modelOverrideAllowed: false as const,
      styleOverrideAllowed: false as const,
      paymentOverrideAllowed: false as const,
      qcOverrideAllowed: false as const,
      paidExecutionAuthorized: false as const,
      externalPublishAuthorized: false as const,
      createdAt,
      updatedAt: createdAt
    };
    const visualBriefFingerprintSha256 = fingerprint(base);
    const record: VisualBriefRecord = {
      brief: base,
      visualBriefFingerprintSha256,
      consumerIdentity: { ipId, styleId }
    };
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      contentKit: command.expectedContentKit,
      ipId,
      styleId,
      reusableAssets
    });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:visual-brief:${kit.contentKitId}:${kit.version}`
        ]);
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_json FROM lite_visual_bridge_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256)
            throw new VisualBridgeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Visual Brief request.',
              409
            );
          return clone(prior.result_json as VisualBriefRecord);
        }
        await client.query(
          `INSERT INTO lite_visual_briefs(
            workspace_id,visual_brief_id,version,content_kit_id,content_kit_version,
            visual_brief_fingerprint_sha256,document_json,created_at,updated_at
          ) VALUES($1,$2,1,$3,$4,$5,$6::jsonb,$7,$7)`,
          [
            workspaceId,
            record.brief.visualBriefId,
            kit.contentKitId,
            kit.version,
            visualBriefFingerprintSha256,
            JSON.stringify(record),
            createdAt
          ]
        );
        await client.query(
          `INSERT INTO lite_visual_bridge_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'CREATE_VISUAL_BRIEF',$3,$4::jsonb,$5)`,
          [workspaceId, idempotencyKey, requestFingerprintSha256, JSON.stringify(record), createdAt]
        );
        return clone(record);
      });
    } catch (error) {
      if (error instanceof VisualBridgeError) throw error;
      throw new VisualBridgeError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Visual Brief persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async findBrief(
    workspaceIdValue: string,
    reference: Readonly<ProductLoopExactReference<VisualBriefId>>
  ): Promise<VisualBriefRecord | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_visual_briefs WHERE workspace_id=$1 AND visual_brief_id=$2 AND version=$3',
      [workspaceId, reference.id, reference.version]
    );
    const row = result.rows[0] as Row | undefined;
    return row ? clone(row.document_json as VisualBriefRecord) : undefined;
  }

  async saveRequest(
    workspaceIdValue: string,
    record: Readonly<VisualRequestRecord>,
    idempotencyKeyValue: string
  ): Promise<VisualRequestRecord> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const idempotencyKey = text(idempotencyKeyValue, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({
      visualBrief: record.visualBrief,
      request: record.request
    });
    try {
      return await this.database.transact(async (client) => {
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_json FROM lite_visual_bridge_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256)
            throw new VisualBridgeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for a different Visual request.',
              409
            );
          return clone(prior.result_json as VisualRequestRecord);
        }
        await client.query(
          `INSERT INTO lite_visual_requests(
            workspace_id,visual_brief_id,visual_brief_version,request_reference,request_sha256,
            request_json,consumer_status,accepted_at
          ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
          [
            workspaceId,
            record.visualBrief.id,
            record.visualBrief.version,
            record.requestReference,
            record.requestSha256,
            JSON.stringify(record.request),
            record.consumerStatus,
            record.acceptedAt
          ]
        );
        await client.query(
          `INSERT INTO lite_visual_bridge_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'START_VISUAL_REQUEST',$3,$4::jsonb,$5)`,
          [workspaceId, idempotencyKey, requestFingerprintSha256, JSON.stringify(record), record.acceptedAt]
        );
        return clone(record);
      });
    } catch (error) {
      if (error instanceof VisualBridgeError) throw error;
      throw new VisualBridgeError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Visual request persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async recordOutput(
    command: Readonly<RecordVisualOutputCommand>
  ): Promise<VisualOutput> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey', 300);
    const references = [...new Set(command.assetReferences.map((value) => text(value, 'assetReference', 1000)))];
    if (!references.length || references.some((reference) => !OUTPUT_REFERENCE.test(reference)))
      throw new VisualBridgeError(
        'INVALID_INPUT',
        'Visual outputs must contain only opaque library:// or delivery:// references.',
        422
      );
    const generatedAt = new Date(command.generatedAt).toISOString();
    const outputFingerprintSha256 = fingerprint({
      visualBrief: command.visualBrief,
      assetReferences: references,
      generatedAt
    });
    const output: VisualOutput = {
      schemaVersion: 1,
      visualOutputId: this.nextOutputId(),
      workspaceId,
      version: 1,
      visualBrief: clone(command.visualBrief),
      owner: 'VISUAL_ENGINE',
      outputFingerprintSha256,
      assetReferences: references,
      generatedAt,
      externalPublishExecuted: false,
      officialTruthClaimed: false
    };
    const requestFingerprintSha256 = fingerprint({
      visualBrief: command.visualBrief,
      outputFingerprintSha256
    });
    try {
      return await this.database.transact(async (client) => {
        const brief = await client.query(
          'SELECT 1 FROM lite_visual_briefs WHERE workspace_id=$1 AND visual_brief_id=$2 AND version=$3',
          [workspaceId, command.visualBrief.id, command.visualBrief.version]
        );
        if (!brief.rows[0])
          throw new VisualBridgeError(
            'VISUAL_BRIEF_NOT_FOUND',
            'Visual Brief was not found in this Workspace.',
            404
          );
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_json FROM lite_visual_bridge_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprintSha256)
            throw new VisualBridgeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for different Visual output evidence.',
              409
            );
          return clone(prior.result_json as VisualOutput);
        }
        await client.query(
          `INSERT INTO lite_visual_outputs(
            workspace_id,visual_output_id,version,visual_brief_id,visual_brief_version,
            output_fingerprint_sha256,document_json,generated_at
          ) VALUES($1,$2,1,$3,$4,$5,$6::jsonb,$7)`,
          [
            workspaceId,
            output.visualOutputId,
            output.visualBrief.id,
            output.visualBrief.version,
            output.outputFingerprintSha256,
            JSON.stringify(output),
            output.generatedAt
          ]
        );
        await client.query(
          `INSERT INTO lite_visual_bridge_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'RECORD_VISUAL_OUTPUT',$3,$4::jsonb,$5)`,
          [workspaceId, idempotencyKey, requestFingerprintSha256, JSON.stringify(output), this.now()]
        );
        return clone(output);
      });
    } catch (error) {
      if (error instanceof VisualBridgeError) throw error;
      throw new VisualBridgeError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Visual output persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export class VisualBridgeService {
  constructor(
    private readonly contentKits: ContentKitService,
    private readonly store: PostgresVisualBridgeStore,
    private readonly consumer: VisualEngineConsumerPort,
    private readonly productStyleId: string,
    private readonly now: () => string = () => new Date().toISOString()
  ) {
    text(productStyleId, 'productStyleId', 300);
  }

  async createBrief(command: Readonly<CreateVisualBriefCommand>): Promise<VisualBriefRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const kit = await this.contentKits.find(workspaceId, command.subjectUserId, command.contentPickId);
    return this.store.createBrief(command, kit, this.productStyleId);
  }

  async startRequest(command: Readonly<StartVisualRequestCommand>): Promise<VisualRequestRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    if (!SHA256.test(command.expectedVisualBriefFingerprintSha256))
      throw new VisualBridgeError('INVALID_INPUT', 'Visual Brief fingerprint is invalid.', 422);
    const stored = await this.store.findBrief(workspaceId, command.visualBrief);
    if (!stored)
      throw new VisualBridgeError(
        'VISUAL_BRIEF_NOT_FOUND',
        'Visual Brief was not found in this Workspace.',
        404
      );
    if (stored.visualBriefFingerprintSha256 !== command.expectedVisualBriefFingerprintSha256)
      throw new VisualBridgeError(
        'CONTENT_KIT_STALE',
        'Visual Brief changed before the request could be started.',
        409
      );
    const request = buildLiteVisualRequest(stored);
    const acceptance = await this.consumer.start(request);
    assertConsumerAcceptance(acceptance);
    const acceptedAt = new Date(this.now()).toISOString();
    const record: VisualRequestRecord = {
      visualBrief: clone(command.visualBrief),
      requestReference: acceptance.requestReference,
      requestSha256: fingerprint(request),
      request,
      consumerStatus: acceptance.status,
      certifiedAssetReferences: [...(acceptance.certifiedAssetReferences ?? [])],
      acceptedAt
    };
    return this.store.saveRequest(workspaceId, record, command.idempotencyKey);
  }
}
