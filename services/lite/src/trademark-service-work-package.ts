import { createHash, randomUUID } from 'node:crypto';
import {
  trademarkServiceIntentKinds,
  type TrademarkServiceIntent,
  type TrademarkServiceWorkPackage,
  type TrademarkServiceWorkPackageId
} from '@markorbit/contracts/trademark-service-workbench';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;

export type TrademarkServiceWorkPackagePersistenceErrorCode =
  | 'INVALID_INPUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'NOT_FOUND'
  | 'PERSISTENCE_UNAVAILABLE';

export class TrademarkServiceWorkPackagePersistenceError extends Error {
  constructor(
    readonly code: TrademarkServiceWorkPackagePersistenceErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TrademarkServiceWorkPackagePersistenceError';
  }
}

export interface CreateTrademarkServiceWorkPackageCommand {
  workspaceId: string;
  asset?: Readonly<{ id: TrademarkAssetId; version: number | string }>;
  matterReference?: string;
  managementRecommendationReference?: string;
  intent: Readonly<TrademarkServiceIntent>;
  createdByUserId: string;
  idempotencyKey: string;
}

export interface UpdateTrademarkServiceWorkPackageContextCommand {
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  expectedVersion: number;
  asset?: Readonly<{ id: TrademarkAssetId; version: number | string }>;
  matterReference?: string;
  managementRecommendationReference?: string;
  intent: Readonly<TrademarkServiceIntent>;
  idempotencyKey: string;
}

const clone = <T>(value: T): T => structuredClone(value);

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stable(entry)])
    );
  }
  return value;
}

const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function cleanText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string') {
    throw new TrademarkServiceWorkPackagePersistenceError(
      'INVALID_INPUT',
      `${field} must be a string.`,
      400
    );
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new TrademarkServiceWorkPackagePersistenceError(
      'INVALID_INPUT',
      `${field} must contain between 1 and ${maximum} characters.`,
      400
    );
  }
  return cleaned;
}

function optionalText(value: unknown, field: string, maximum: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return cleanText(value, field, maximum);
}

function cleanWorkspaceId(value: string): string {
  const workspaceId = cleanText(value, 'workspaceId', 100);
  if (!UUID.test(workspaceId)) {
    throw new TrademarkServiceWorkPackagePersistenceError(
      'INVALID_INPUT',
      'workspaceId must be a UUID.',
      400
    );
  }
  return workspaceId;
}

function cleanWorkPackageId(value: string): TrademarkServiceWorkPackageId {
  const id = cleanText(value, 'workPackageId', 300);
  if (!id.startsWith('trademark-service-work-package_')) {
    throw new TrademarkServiceWorkPackagePersistenceError(
      'INVALID_INPUT',
      'workPackageId is invalid.',
      400
    );
  }
  return id as TrademarkServiceWorkPackageId;
}

function cleanAsset(
  value: Readonly<{ id: TrademarkAssetId; version: number | string }> | undefined
): { id: TrademarkAssetId; version: number | string } | undefined {
  if (!value) return undefined;
  const id = cleanText(value.id, 'asset.id', 300);
  if (!id.startsWith('trademark-asset_')) {
    throw new TrademarkServiceWorkPackagePersistenceError('INVALID_INPUT', 'asset.id is invalid.', 400);
  }
  const version =
    typeof value.version === 'number'
      ? value.version
      : cleanText(value.version, 'asset.version', 200);
  if (typeof version === 'number' && (!Number.isInteger(version) || version < 1)) {
    throw new TrademarkServiceWorkPackagePersistenceError(
      'INVALID_INPUT',
      'asset.version must be positive.',
      400
    );
  }
  return { id: id as TrademarkAssetId, version };
}

function cleanIntent(value: Readonly<TrademarkServiceIntent>): TrademarkServiceIntent {
  if (!trademarkServiceIntentKinds.includes(value.kind)) {
    throw new TrademarkServiceWorkPackagePersistenceError(
      'INVALID_INPUT',
      'Unknown Trademark Service Intent.',
      400
    );
  }
  return {
    kind: value.kind,
    jurisdiction: cleanText(value.jurisdiction, 'intent.jurisdiction', 100),
    title: cleanText(value.title, 'intent.title', 500),
    rationale: cleanText(value.rationale, 'intent.rationale', 4000),
    inferredFromProductContext: Boolean(value.inferredFromProductContext),
    reviewedByUser: Boolean(value.reviewedByUser),
    legalConclusionCreated: false,
    serviceAvailabilityVerified: false,
    legalDeadlineCertified: false
  };
}

function ensureAnchor(asset: unknown, matterReference: string | undefined): void {
  if (!asset && !matterReference) {
    throw new TrademarkServiceWorkPackagePersistenceError(
      'INVALID_INPUT',
      'A Service Work Package requires an Asset or Matter anchor.',
      400
    );
  }
}

function ensureVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new TrademarkServiceWorkPackagePersistenceError(
      'INVALID_INPUT',
      'expectedVersion must be positive.',
      400
    );
  }
}

const rowPackage = (row: Row | undefined): TrademarkServiceWorkPackage | undefined =>
  row ? clone(row.document_json as TrademarkServiceWorkPackage) : undefined;

export class PostgresTrademarkServiceWorkPackageStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async create(
    command: Readonly<CreateTrademarkServiceWorkPackageCommand>
  ): Promise<TrademarkServiceWorkPackage> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const asset = cleanAsset(command.asset);
    const matterReference = optionalText(command.matterReference, 'matterReference', 1000);
    const managementRecommendationReference = optionalText(
      command.managementRecommendationReference,
      'managementRecommendationReference',
      1000
    );
    const intent = cleanIntent(command.intent);
    const createdByUserId = cleanText(command.createdByUserId, 'createdByUserId', 300);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    ensureAnchor(asset, matterReference);
    const requestFingerprint = fingerprint({
      workspaceId,
      asset: asset ?? null,
      matterReference: matterReference ?? null,
      managementRecommendationReference: managementRecommendationReference ?? null,
      intent,
      createdByUserId
    });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-service-work-package-create:${idempotencyKey}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,result_json
             FROM lite_trademark_service_work_package_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) return this.replay(prior, requestFingerprint);
        if (asset) await this.assertAssetVisible(client, workspaceId, asset.id);

        const timestamp = new Date(this.now()).toISOString();
        const workPackage: TrademarkServiceWorkPackage = {
          schemaVersion: 1,
          workPackageId: `trademark-service-work-package_${randomUUID()}`,
          workspaceId,
          version: 1,
          ...(asset ? { asset } : {}),
          ...(matterReference ? { matterReference } : {}),
          ...(managementRecommendationReference ? { managementRecommendationReference } : {}),
          intent,
          requirementCandidates: [],
          missingInputs: [],
          readiness: {
            state: 'DRAFT',
            presentRequirementCount: 0,
            blockingMissingCount: 0,
            reviewRequiredCount: 0,
            evaluatedAt: timestamp,
            preparationCompletenessOnly: true,
            successProbabilityCalculated: false,
            filingEligibilityCertified: false,
            legalValidityCertified: false
          },
          capabilityCandidates: [],
          providerCandidates: [],
          servicePackageCandidates: [],
          communicationDrafts: [],
          createdByUserId,
          createdAt: timestamp,
          updatedAt: timestamp,
          parallelMatterLifecycleCreated: false,
          officialTruthCreated: false,
          protectedActionAuthorized: false
        };
        await client.query(
          `INSERT INTO lite_trademark_service_work_packages(
             workspace_id,work_package_id,version,trademark_asset_id,
             document_fingerprint_sha256,document_json,created_at,updated_at
           ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
          [
            workspaceId,
            workPackage.workPackageId,
            1,
            asset?.id ?? null,
            fingerprint(workPackage),
            JSON.stringify(workPackage),
            timestamp,
            timestamp
          ]
        );
        await this.persistVersion(client, workPackage, timestamp);
        await this.persistCommand(
          client,
          workspaceId,
          idempotencyKey,
          'CREATE_WORK_PACKAGE',
          requestFingerprint,
          workPackage,
          timestamp
        );
        return clone(workPackage);
      });
    } catch (error) {
      if (error instanceof TrademarkServiceWorkPackagePersistenceError) throw error;
      throw this.unavailable(error);
    }
  }

  async updateContext(
    command: Readonly<UpdateTrademarkServiceWorkPackageContextCommand>
  ): Promise<TrademarkServiceWorkPackage> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const workPackageId = cleanWorkPackageId(command.workPackageId);
    ensureVersion(command.expectedVersion);
    const asset = cleanAsset(command.asset);
    const matterReference = optionalText(command.matterReference, 'matterReference', 1000);
    const managementRecommendationReference = optionalText(
      command.managementRecommendationReference,
      'managementRecommendationReference',
      1000
    );
    const intent = cleanIntent(command.intent);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey', 300);
    ensureAnchor(asset, matterReference);
    const requestFingerprint = fingerprint({
      workspaceId,
      workPackageId,
      expectedVersion: command.expectedVersion,
      asset: asset ?? null,
      matterReference: matterReference ?? null,
      managementRecommendationReference: managementRecommendationReference ?? null,
      intent
    });

    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:trademark-service-work-package:${workPackageId}`
        ]);
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,result_json
             FROM lite_trademark_service_work_package_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) return this.replay(prior, requestFingerprint);

        const currentResult = await client.query(
          `SELECT document_json
             FROM lite_trademark_service_work_packages
            WHERE workspace_id=$1 AND work_package_id=$2 FOR UPDATE`,
          [workspaceId, workPackageId]
        );
        const current = rowPackage(currentResult.rows[0] as Row | undefined);
        if (!current) this.notFound();
        if (current.version !== command.expectedVersion) {
          throw new TrademarkServiceWorkPackagePersistenceError(
            'VERSION_CONFLICT',
            'Service Work Package changed since the requested version.',
            409
          );
        }
        if (asset) await this.assertAssetVisible(client, workspaceId, asset.id);
        const timestamp = new Date(this.now()).toISOString();
        const {
          asset: _previousAsset,
          matterReference: _previousMatter,
          managementRecommendationReference: _previousRecommendation,
          ...unchanged
        } = current;
        const updated: TrademarkServiceWorkPackage = {
          ...unchanged,
          version: current.version + 1,
          ...(asset ? { asset } : {}),
          ...(matterReference ? { matterReference } : {}),
          ...(managementRecommendationReference ? { managementRecommendationReference } : {}),
          intent,
          updatedAt: timestamp,
          parallelMatterLifecycleCreated: false,
          officialTruthCreated: false,
          protectedActionAuthorized: false
        };
        await client.query(
          `UPDATE lite_trademark_service_work_packages
              SET version=$3,trademark_asset_id=$4,document_fingerprint_sha256=$5,
                  document_json=$6::jsonb,updated_at=$7
            WHERE workspace_id=$1 AND work_package_id=$2`,
          [
            workspaceId,
            workPackageId,
            updated.version,
            asset?.id ?? null,
            fingerprint(updated),
            JSON.stringify(updated),
            timestamp
          ]
        );
        await this.persistVersion(client, updated, timestamp);
        await this.persistCommand(
          client,
          workspaceId,
          idempotencyKey,
          'UPDATE_CONTEXT',
          requestFingerprint,
          updated,
          timestamp
        );
        return clone(updated);
      });
    } catch (error) {
      if (error instanceof TrademarkServiceWorkPackagePersistenceError) throw error;
      throw this.unavailable(error);
    }
  }

  async get(workspaceIdInput: string, workPackageIdInput: string): Promise<TrademarkServiceWorkPackage> {
    return this.read(workspaceIdInput, workPackageIdInput);
  }

  async getVersion(
    workspaceIdInput: string,
    workPackageIdInput: string,
    version: number
  ): Promise<TrademarkServiceWorkPackage> {
    const workspaceId = cleanWorkspaceId(workspaceIdInput);
    const workPackageId = cleanWorkPackageId(workPackageIdInput);
    ensureVersion(version);
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_trademark_service_work_package_versions
          WHERE workspace_id=$1 AND work_package_id=$2 AND version=$3`,
        [workspaceId, workPackageId, version]
      );
      const workPackage = rowPackage(result.rows[0] as Row | undefined);
      if (!workPackage) this.notFound();
      return workPackage;
    } catch (error) {
      if (error instanceof TrademarkServiceWorkPackagePersistenceError) throw error;
      throw this.unavailable(error);
    }
  }

  private async read(workspaceIdInput: string, workPackageIdInput: string) {
    const workspaceId = cleanWorkspaceId(workspaceIdInput);
    const workPackageId = cleanWorkPackageId(workPackageIdInput);
    try {
      const result = await this.query.query(
        `SELECT document_json FROM lite_trademark_service_work_packages
          WHERE workspace_id=$1 AND work_package_id=$2`,
        [workspaceId, workPackageId]
      );
      const workPackage = rowPackage(result.rows[0] as Row | undefined);
      if (!workPackage) this.notFound();
      return workPackage;
    } catch (error) {
      if (error instanceof TrademarkServiceWorkPackagePersistenceError) throw error;
      throw this.unavailable(error);
    }
  }

  private replay(row: Row, requestedFingerprint: string): TrademarkServiceWorkPackage {
    if (String(row.request_fingerprint_sha256) !== requestedFingerprint) {
      throw new TrademarkServiceWorkPackagePersistenceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different Service Work Package command.',
        409
      );
    }
    return clone(row.result_json as TrademarkServiceWorkPackage);
  }

  private async assertAssetVisible(client: QueryClient, workspaceId: string, assetId: TrademarkAssetId) {
    const result = await client.query(
      'SELECT 1 FROM lite_trademark_assets WHERE workspace_id=$1 AND trademark_asset_id=$2',
      [workspaceId, assetId]
    );
    if (!result.rows[0]) this.notFound('Trademark Asset not found in this workspace.');
  }

  private async persistVersion(
    client: QueryClient,
    workPackage: TrademarkServiceWorkPackage,
    recordedAt: string
  ) {
    await client.query(
      `INSERT INTO lite_trademark_service_work_package_versions(
         workspace_id,work_package_id,version,document_fingerprint_sha256,document_json,recorded_at
       ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
      [
        workPackage.workspaceId,
        workPackage.workPackageId,
        workPackage.version,
        fingerprint(workPackage),
        JSON.stringify(workPackage),
        recordedAt
      ]
    );
  }

  private async persistCommand(
    client: QueryClient,
    workspaceId: string,
    idempotencyKey: string,
    commandType: 'CREATE_WORK_PACKAGE' | 'UPDATE_CONTEXT',
    requestFingerprint: string,
    workPackage: TrademarkServiceWorkPackage,
    createdAt: string
  ) {
    await client.query(
      `INSERT INTO lite_trademark_service_work_package_commands(
         workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at
       ) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
      [
        workspaceId,
        idempotencyKey,
        commandType,
        requestFingerprint,
        JSON.stringify(workPackage),
        createdAt
      ]
    );
  }

  private notFound(message = 'Service Work Package not found.'): never {
    throw new TrademarkServiceWorkPackagePersistenceError('NOT_FOUND', message, 404);
  }

  private unavailable(error: unknown): TrademarkServiceWorkPackagePersistenceError {
    return new TrademarkServiceWorkPackagePersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'Trademark Service Work Package persistence is unavailable.',
      503,
      true,
      { cause: error }
    );
  }
}
