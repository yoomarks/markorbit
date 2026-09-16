import { createHash, randomUUID } from 'node:crypto';
import {
  businessAttributionFingerprintSha256V1,
  noBusinessAttributionAuthorityConsequencesV1,
  parseBusinessAttributionLinkV1,
  type BusinessAttributionEvidenceBasisV1,
  type BusinessAttributionLinkIdV1,
  type BusinessAttributionLinkV1,
  type BusinessAttributionMotionKindV1,
  type BusinessAttributionReferenceV1,
  type BusinessAttributionStateV1
} from '@markorbit/contracts/business-attribution';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
type Row = Record<string, unknown>;

export type BusinessAttributionRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class BusinessAttributionRuntimeError extends Error {
  constructor(
    readonly code: BusinessAttributionRuntimeErrorCode,
    message: string,
    readonly status = 409,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'BusinessAttributionRuntimeError';
  }
}

export interface CreateBusinessAttributionLinkCommand {
  workspaceId: string;
  actorPrincipalId: string;
  idempotencyKey: string;
  motionKind: BusinessAttributionMotionKindV1;
  sourceRefs: readonly Readonly<BusinessAttributionReferenceV1>[];
  touchpointRefs: readonly Readonly<BusinessAttributionReferenceV1>[];
  downstreamRef?: Readonly<BusinessAttributionReferenceV1>;
  attributionState: BusinessAttributionStateV1;
  evidenceBasis: BusinessAttributionEvidenceBasisV1;
  evaluatedAt?: string;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}
function hash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
function workspace(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID.test(normalized)) {
    throw new BusinessAttributionRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  }
  return normalized;
}
function text(value: string, field: string, maximum = 500): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new BusinessAttributionRuntimeError('INVALID_INPUT', `${field} is invalid.`, 422);
  }
  return normalized;
}
function at(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BusinessAttributionRuntimeError('INVALID_INPUT', 'evaluatedAt is invalid.', 422);
  }
  return parsed.toISOString();
}
function persisted(value: unknown, expectedWorkspace: string): BusinessAttributionLinkV1 {
  try {
    const parsed = parseBusinessAttributionLinkV1(value);
    if (parsed.workspaceId !== expectedWorkspace) throw new Error('workspace mismatch');
    return parsed;
  } catch (error) {
    throw new BusinessAttributionRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Business Attribution Link failed contract validation.',
      500,
      false,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

export class PostgresBusinessAttributionStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => randomUUID().replaceAll('-', '')
  ) {}

  async create(
    command: Readonly<CreateBusinessAttributionLinkCommand>
  ): Promise<BusinessAttributionLinkV1> {
    const workspaceId = workspace(command.workspaceId);
    const actorPrincipalId = text(command.actorPrincipalId, 'actorPrincipalId', 240);
    const idempotencyKey = text(command.idempotencyKey, 'idempotencyKey', 300);
    const evaluatedAt = at(command.evaluatedAt ?? this.now());
    const requestFingerprint = hash({ ...command, workspaceId, actorPrincipalId });
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `${workspaceId}:business-attribution:${idempotencyKey}`
        ]);
        const replay = await client.query(
          'SELECT request_fingerprint_sha256,result_json FROM lite_business_attribution_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, idempotencyKey]
        );
        const prior = replay.rows[0] as Row | undefined;
        if (prior) {
          if (String(prior.request_fingerprint_sha256) !== requestFingerprint) {
            throw new BusinessAttributionRuntimeError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key was already used for different attribution evidence.'
            );
          }
          return persisted(prior.result_json, workspaceId);
        }
        const businessAttributionLinkId: BusinessAttributionLinkIdV1 = `business-attribution_${this.id()}`;
        const withoutFingerprint = {
          schemaVersion: 1 as const,
          businessAttributionLinkId,
          workspaceId,
          version: 1 as const,
          motionKind: command.motionKind,
          sourceRefs: command.sourceRefs,
          touchpointRefs: command.touchpointRefs,
          ...(command.downstreamRef ? { downstreamRef: command.downstreamRef } : {}),
          attributionState: command.attributionState,
          evidenceBasis: command.evidenceBasis,
          evaluatedAt,
          recordedByPrincipalId: actorPrincipalId,
          authorityConsequences: noBusinessAttributionAuthorityConsequencesV1
        };
        const value = parseBusinessAttributionLinkV1({
          ...withoutFingerprint,
          businessAttributionFingerprintSha256:
            businessAttributionFingerprintSha256V1(withoutFingerprint)
        });
        const downstream = value.downstreamRef;
        await client.query(
          `INSERT INTO lite_business_attribution_links
          (workspace_id,business_attribution_link_id,version,motion_kind,attribution_state,evidence_basis,downstream_owner,downstream_kind,downstream_id,downstream_version,downstream_fingerprint_sha256,business_attribution_fingerprint_sha256,document_json,evaluated_at,recorded_by_principal_id,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16)`,
          [
            workspaceId,
            value.businessAttributionLinkId,
            value.version,
            value.motionKind,
            value.attributionState,
            value.evidenceBasis,
            downstream?.owner ?? null,
            downstream?.kind ?? null,
            downstream?.id ?? null,
            downstream ? String(downstream.version) : null,
            downstream?.fingerprintSha256 ?? null,
            value.businessAttributionFingerprintSha256,
            JSON.stringify(value),
            value.evaluatedAt,
            actorPrincipalId,
            at(this.now())
          ]
        );
        await client.query(
          `INSERT INTO lite_business_attribution_commands
          (workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at)
          VALUES($1,$2,'CREATE_BUSINESS_ATTRIBUTION_LINK',$3,$4::jsonb,$5)`,
          [workspaceId, idempotencyKey, requestFingerprint, JSON.stringify(value), at(this.now())]
        );
        return value;
      });
    } catch (error) {
      if (error instanceof BusinessAttributionRuntimeError) throw error;
      throw new BusinessAttributionRuntimeError(
        'PERSISTENCE_UNAVAILABLE',
        'Business Attribution persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async find(
    workspaceIdValue: string,
    linkId: BusinessAttributionLinkIdV1
  ): Promise<BusinessAttributionLinkV1 | undefined> {
    const workspaceId = workspace(workspaceIdValue);
    try {
      const result = await this.query.query(
        'SELECT document_json FROM lite_business_attribution_links WHERE workspace_id=$1 AND business_attribution_link_id=$2 AND version=1',
        [workspaceId, text(linkId, 'businessAttributionLinkId', 240)]
      );
      if (!result.rowCount) return undefined;
      return persisted((result.rows[0] as Row).document_json, workspaceId);
    } catch (error) {
      if (error instanceof BusinessAttributionRuntimeError) throw error;
      throw new BusinessAttributionRuntimeError(
        'PERSISTENCE_UNAVAILABLE',
        'Business Attribution persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
