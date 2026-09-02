import { createHash, randomUUID } from 'node:crypto';
import {
  visualOutputKinds,
  visualOutputStatuses,
  type ContentKit,
  type ContentKitId,
  type VisualBrief,
  type VisualBriefId,
  type VisualOutputKind,
  type VisualOutputReference,
  type VisualOutputReferenceId,
  type VisualOutputStatus
} from '@markorbit/contracts/daily-workspace';
import type { ProductLoopExactReference } from '@markorbit/contracts/product-loop';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
import type { ContentKitVisualBriefReferenceReader } from './content-kit.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/u;
const REQUEST_REFERENCE = /^illustration-request:\/\/[^\s]+$/u;
const OUTPUT_REFERENCE = /^(library|delivery):\/\/[^\s]+$/u;
const LITE_VISUAL_API_VERSION = 'lite-illustration-request/v1' as const;

export type VisualBridgeErrorCode =
  | 'INVALID_INPUT'
  | 'CONTENT_KIT_STALE'
  | 'VISUAL_BRIEF_NOT_FOUND'
  | 'VISUAL_REQUEST_NOT_FOUND'
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
  }>;
}

export interface VisualConsumerAcceptance {
  readonly requestReference: string;
  readonly status: VisualOutputStatus;
  readonly outputReference?: string;
  readonly qcStatus?: 'PASS' | 'PASS_WITH_WARNINGS';
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
  readonly output: Readonly<VisualOutputReference>;
  readonly acceptedAt: string;
}

export interface ContentKitReader {
  find(workspaceId: string, subjectUserId: string, contentPickId: string): Promise<ContentKit>;
}

export interface CreateVisualBriefCommand {
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly contentPickId: string;
  readonly expectedContentKit: ProductLoopExactReference<ContentKitId>;
  readonly requestedIpPackage: string;
  readonly outputKind: VisualOutputKind;
  readonly sceneIntent: string;
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
  readonly requestReference: string;
  readonly status: VisualOutputStatus;
  readonly outputReference?: string;
  readonly qcStatus?: 'PASS' | 'PASS_WITH_WARNINGS';
  readonly createdAt: string;
  readonly idempotencyKey: string;
}

type Row = Record<string, unknown>;

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!UUID.test(cleaned))
    throw new VisualBridgeError('INVALID_INPUT', 'workspaceId must be a Core Workspace UUID.', 422);
  return cleaned;
}

function text(value: string, field: string, maximum = 1000): string {
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

function aspectRatioFor(kind: VisualOutputKind): string {
  if (kind === 'XIAOHONGSHU_COVER') return '3:4';
  if (kind === 'WECHAT_OFFICIAL_ACCOUNT_COVER') return '2.35:1';
  if (kind === 'MOMENTS_SOCIAL_CARD') return '1:1';
  return '9:16';
}

function titleFrom(kit: Readonly<ContentKit>): string {
  return kit.angles[0]?.title.trim() || kit.whyPublish.trim();
}

function requestId(brief: Readonly<VisualBrief>): string {
  return `lite_${fingerprint({ id: brief.visualBriefId, version: brief.version }).slice(0, 32)}`;
}

export function buildLiteVisualRequest(
  record: Readonly<VisualBriefRecord>
): LiteVisualRequestEnvelope {
  return {
    api_version: LITE_VISUAL_API_VERSION,
    operation: 'request.start',
    request_id: requestId(record.brief),
    input: {
      ip_id: record.consumerIdentity.ipId,
      style_id: record.consumerIdentity.styleId,
      scene_intent: record.brief.sceneIntent,
      composition: `${record.brief.outputKind} ${record.brief.aspectRatio}`
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
  if (!visualOutputStatuses.includes(value.status))
    throw new VisualBridgeError(
      'VISUAL_CONSUMER_REJECTED',
      'Visual Engine returned an unsupported output status.',
      502
    );
  if (value.outputReference && !OUTPUT_REFERENCE.test(value.outputReference))
    throw new VisualBridgeError(
      'VISUAL_CONSUMER_REJECTED',
      'Visual Engine returned an invalid opaque output reference.',
      502
    );
  if (value.status === 'REUSED_CERTIFIED_ASSET' && !value.outputReference?.startsWith('library://'))
    throw new VisualBridgeError(
      'VISUAL_CONSUMER_REJECTED',
      'Certified reuse must return a library:// reference.',
      502
    );
  if (value.status === 'READY' && !value.outputReference)
    throw new VisualBridgeError(
      'VISUAL_CONSUMER_REJECTED',
      'Ready Visual output must include an opaque output reference.',
      502
    );
  if ((value.status === 'PLANNING_REQUIRED' || value.status === 'FAILED') && value.outputReference)
    throw new VisualBridgeError(
      'VISUAL_CONSUMER_REJECTED',
      'Planning/failed Visual output cannot expose a completed output reference.',
      502
    );
}

function outputReference(
  workspaceId: string,
  visualBrief: Readonly<ProductLoopExactReference<VisualBriefId>>,
  requestReference: string,
  acceptance: Readonly<Pick<VisualConsumerAcceptance, 'status' | 'outputReference' | 'qcStatus'>>,
  id: VisualOutputReferenceId,
  createdAt: string
): VisualOutputReference {
  return {
    schemaVersion: 1,
    visualOutputReferenceId: id,
    workspaceId,
    version: 1,
    visualBrief: clone(visualBrief),
    owner: 'VISUAL_ENGINE',
    requestReference,
    ...(acceptance.outputReference ? { outputReference: acceptance.outputReference } : {}),
    status: acceptance.status,
    ...(acceptance.qcStatus ? { qcStatus: acceptance.qcStatus } : {}),
    providerExecutionAuthorizedByLite: false,
    paidExecutionAuthorizedByLite: false,
    createdAt
  };
}

export class PostgresVisualBridgeStore implements ContentKitVisualBriefReferenceReader {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly nextBriefId: () => VisualBriefId = () =>
      `visual-brief_${randomUUID().replaceAll('-', '')}`,
    private readonly nextOutputId: () => VisualOutputReferenceId = () =>
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
    styleIdValue: string,
    styleIntentValue: string
  ): Promise<VisualBriefRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const ipId = text(command.requestedIpPackage, 'requestedIpPackage', 300);
    const styleId = text(styleIdValue, 'styleId', 300);
    const styleIntent = text(styleIntentValue, 'styleIntent', 500);
    const sceneIntent = text(command.sceneIntent, 'sceneIntent', 2000);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey', 300);
    if (!visualOutputKinds.includes(command.outputKind))
      throw new VisualBridgeError('INVALID_INPUT', 'outputKind is invalid.', 422);
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
    const createdAt = new Date(this.now()).toISOString();
    const brief: VisualBrief = {
      schemaVersion: 1,
      visualBriefId: this.nextBriefId(),
      workspaceId,
      version: 1,
      contentKit: { id: kit.contentKitId, version: kit.version },
      title: titleFrom(kit),
      keyMessage: kit.whyPublish,
      audience: kit.audience,
      outputKind: command.outputKind,
      aspectRatio: aspectRatioFor(command.outputKind),
      styleIntent,
      requestedIpPackage: ipId,
      sceneIntent,
      reuseFirstRequired: true,
      paidExecutionAuthorized: false,
      createdAt
    };
    const visualBriefFingerprintSha256 = fingerprint(brief);
    const record: VisualBriefRecord = {
      brief,
      visualBriefFingerprintSha256,
      consumerIdentity: { ipId, styleId }
    };
    const requestFingerprintSha256 = fingerprint({
      workspaceId,
      contentKit: command.expectedContentKit,
      requestedIpPackage: ipId,
      outputKind: command.outputKind,
      sceneIntent,
      styleId,
      styleIntent
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
            content_opportunity_id,content_opportunity_version,
            visual_brief_fingerprint_sha256,document_json,created_at
          ) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            workspaceId,
            brief.visualBriefId,
            kit.contentKitId,
            kit.version,
            kit.contentOpportunity.id,
            kit.contentOpportunity.version,
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

  async replayVisualRequest(
    workspaceIdValue: string,
    idempotencyKeyValue: string,
    visualBrief: Readonly<ProductLoopExactReference<VisualBriefId>>,
    request: Readonly<LiteVisualRequestEnvelope>
  ): Promise<VisualRequestRecord | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const idempotencyKey = text(idempotencyKeyValue, 'idempotencyKey', 300);
    const expected = fingerprint({ visualBrief, request });
    const result = await this.query.query(
      'SELECT request_fingerprint_sha256,result_json FROM lite_visual_bridge_commands WHERE workspace_id=$1 AND idempotency_key=$2',
      [workspaceId, idempotencyKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    if (String(row.request_fingerprint_sha256) !== expected)
      throw new VisualBridgeError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different Visual request.',
        409
      );
    return clone(row.result_json as VisualRequestRecord);
  }

  async saveRequest(
    workspaceIdValue: string,
    visualBrief: Readonly<ProductLoopExactReference<VisualBriefId>>,
    request: Readonly<LiteVisualRequestEnvelope>,
    acceptance: Readonly<VisualConsumerAcceptance>,
    idempotencyKeyValue: string
  ): Promise<VisualRequestRecord> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const idempotencyKey = text(idempotencyKeyValue, 'idempotencyKey', 300);
    const requestFingerprintSha256 = fingerprint({ visualBrief, request });
    const acceptedAt = new Date(this.now()).toISOString();
    const output = outputReference(
      workspaceId,
      visualBrief,
      acceptance.requestReference,
      acceptance,
      this.nextOutputId(),
      acceptedAt
    );
    const record: VisualRequestRecord = {
      visualBrief: clone(visualBrief),
      requestReference: acceptance.requestReference,
      requestSha256: fingerprint(request),
      request: clone(request),
      output,
      acceptedAt
    };
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
            request_json,accepted_at
          ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
          [
            workspaceId,
            visualBrief.id,
            visualBrief.version,
            acceptance.requestReference,
            record.requestSha256,
            JSON.stringify(request),
            acceptedAt
          ]
        );
        await client.query(
          `INSERT INTO lite_visual_output_references(
            workspace_id,visual_output_reference_id,version,visual_brief_id,visual_brief_version,
            request_reference,output_reference,status,qc_status,document_json,created_at
          ) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
          [
            workspaceId,
            output.visualOutputReferenceId,
            visualBrief.id,
            visualBrief.version,
            output.requestReference,
            output.outputReference ?? null,
            output.status,
            output.qcStatus ?? null,
            JSON.stringify(output),
            acceptedAt
          ]
        );
        await client.query(
          `INSERT INTO lite_visual_bridge_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'START_VISUAL_REQUEST',$3,$4::jsonb,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(record),
            acceptedAt
          ]
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

  async recordOutput(command: Readonly<RecordVisualOutputCommand>): Promise<VisualOutputReference> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey', 300);
    const requestReference = text(command.requestReference, 'requestReference', 1000);
    if (!REQUEST_REFERENCE.test(requestReference))
      throw new VisualBridgeError('INVALID_INPUT', 'requestReference is invalid.', 422);
    const acceptance: VisualConsumerAcceptance = {
      requestReference,
      status: command.status,
      ...(command.outputReference ? { outputReference: command.outputReference } : {}),
      ...(command.qcStatus ? { qcStatus: command.qcStatus } : {})
    };
    assertConsumerAcceptance(acceptance);
    const createdAt = new Date(command.createdAt).toISOString();
    const requestFingerprintSha256 = fingerprint({
      visualBrief: command.visualBrief,
      requestReference,
      status: command.status,
      outputReference: command.outputReference ?? null,
      qcStatus: command.qcStatus ?? null,
      createdAt
    });
    const output = outputReference(
      workspaceId,
      command.visualBrief,
      requestReference,
      acceptance,
      this.nextOutputId(),
      createdAt
    );
    try {
      return await this.database.transact(async (client) => {
        const requestResult = await client.query(
          'SELECT 1 FROM lite_visual_requests WHERE workspace_id=$1 AND visual_brief_id=$2 AND visual_brief_version=$3 AND request_reference=$4',
          [workspaceId, command.visualBrief.id, command.visualBrief.version, requestReference]
        );
        if (!requestResult.rows[0])
          throw new VisualBridgeError(
            'VISUAL_REQUEST_NOT_FOUND',
            'Visual request was not found in this Workspace.',
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
          return clone(prior.result_json as VisualOutputReference);
        }
        await client.query(
          `INSERT INTO lite_visual_output_references(
            workspace_id,visual_output_reference_id,version,visual_brief_id,visual_brief_version,
            request_reference,output_reference,status,qc_status,document_json,created_at
          ) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
          [
            workspaceId,
            output.visualOutputReferenceId,
            output.visualBrief.id,
            output.visualBrief.version,
            output.requestReference,
            output.outputReference ?? null,
            output.status,
            output.qcStatus ?? null,
            JSON.stringify(output),
            output.createdAt
          ]
        );
        await client.query(
          `INSERT INTO lite_visual_bridge_commands(
            workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
          ) VALUES($1,$2,'RECORD_VISUAL_OUTPUT',$3,$4::jsonb,$5)`,
          [
            workspaceId,
            idempotencyKey,
            requestFingerprintSha256,
            JSON.stringify(output),
            this.now()
          ]
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

  async findOutput(
    workspaceIdValue: string,
    reference: Readonly<ProductLoopExactReference<VisualOutputReferenceId>>
  ): Promise<VisualOutputReference | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const result = await this.query.query(
      'SELECT document_json FROM lite_visual_output_references WHERE workspace_id=$1 AND visual_output_reference_id=$2 AND version=$3',
      [workspaceId, reference.id, reference.version]
    );
    const row = result.rows[0] as Row | undefined;
    return row ? clone(row.document_json as VisualOutputReference) : undefined;
  }
}

export class VisualBridgeService {
  constructor(
    private readonly contentKits: ContentKitReader,
    private readonly store: PostgresVisualBridgeStore,
    private readonly consumer: VisualEngineConsumerPort,
    private readonly productStyleId: string,
    private readonly productStyleIntent = 'MarkOrbit Lite editorial visual'
  ) {
    text(productStyleId, 'productStyleId', 300);
    text(productStyleIntent, 'productStyleIntent', 500);
  }

  async createBrief(command: Readonly<CreateVisualBriefCommand>): Promise<VisualBriefRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const kit = await this.contentKits.find(
      workspaceId,
      command.subjectUserId,
      command.contentPickId
    );
    return this.store.createBrief(command, kit, this.productStyleId, this.productStyleIntent);
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
    const replay = await this.store.replayVisualRequest(
      workspaceId,
      command.idempotencyKey,
      command.visualBrief,
      request
    );
    if (replay) return replay;
    const acceptance = await this.consumer.start(request);
    assertConsumerAcceptance(acceptance);
    return this.store.saveRequest(
      workspaceId,
      command.visualBrief,
      request,
      acceptance,
      command.idempotencyKey
    );
  }
}
