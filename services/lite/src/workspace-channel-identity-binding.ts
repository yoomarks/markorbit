import { createHash, randomUUID } from 'node:crypto';
import {
  noWorkspaceChannelIdentityAuthorityConsequencesV1,
  parseWorkspaceChannelIdentityBindingV1,
  type WorkspaceChannelExternalIdentityV1,
  type WorkspaceChannelIdentityBindingId,
  type WorkspaceChannelIdentityBindingV1,
  type WorkspaceChannelIdentityConnectionV1
} from '@markorbit/contracts/channel-identity-binding';
import { workspaceChannelIdentityBindingFingerprintSha256V1 } from '@markorbit/contracts/channel-identity-binding-fingerprint';
import {
  channelFeatureDefinitionV1,
  type ChannelFeatureKeyV1
} from '@markorbit/contracts/channel-platform';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

type Row = Record<string, unknown>;
type CommandType = 'ADMIT_TRUSTED' | 'MARK_STALE' | 'REVOKE';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BINDING_ID = /^workspace-channel-identity-binding_[A-Za-z0-9._:-]+$/u;

export type WorkspaceChannelIdentityBindingRuntimeErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'DUPLICATE_ACTIVE_IDENTITY'
  | 'INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class WorkspaceChannelIdentityBindingRuntimeError extends Error {
  constructor(
    readonly code: WorkspaceChannelIdentityBindingRuntimeErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceChannelIdentityBindingRuntimeError';
  }
}

/** Trusted-server input only. No browser or public mutation route accepts this command. */
export interface AdmitTrustedWorkspaceChannelIdentityBindingCommandV1 {
  workspaceId: string;
  idempotencyKey: string;
  featureKey: ChannelFeatureKeyV1;
  identity: Readonly<WorkspaceChannelExternalIdentityV1>;
  connection: Readonly<WorkspaceChannelIdentityConnectionV1>;
}

export interface TransitionWorkspaceChannelIdentityBindingCommandV1 {
  workspaceId: string;
  workspaceChannelIdentityBindingId: WorkspaceChannelIdentityBindingId;
  expectedVersion: number;
  idempotencyKey: string;
  evidenceRef: string;
}

const clone = <T>(value: T): T => structuredClone(value);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const result = value.trim().toLowerCase();
  if (!UUID.test(result))
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return result;
}

function cleanText(value: string, field: string, maximum = 500): string {
  const result = value.trim();
  if (!result || result.length > maximum)
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INVALID_INPUT',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return result;
}

function cleanVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INVALID_INPUT',
      'expectedVersion must be a positive safe integer.',
      422
    );
  return value;
}

function cleanBindingId(value: WorkspaceChannelIdentityBindingId) {
  const result = value.trim();
  if (!BINDING_ID.test(result))
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INVALID_INPUT',
      'workspaceChannelIdentityBindingId is invalid.',
      422
    );
  return result as WorkspaceChannelIdentityBindingId;
}

function timestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INVALID_INPUT',
      'Runtime clock must return an ISO timestamp.',
      422
    );
  return parsed.toISOString();
}

function later(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function assertIdentityBoundFeature(featureKey: ChannelFeatureKeyV1): void {
  let definition;
  try {
    definition = channelFeatureDefinitionV1(featureKey);
  } catch (error) {
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INVALID_INPUT',
      'featureKey is not a known Channel feature.',
      422,
      { cause: error instanceof Error ? error : undefined }
    );
  }
  if (
    definition.sendingIdentityOwnership !== 'WORKSPACE_OWNED_IDENTITY' ||
    definition.workspaceOwnedAccountRequired !== true
  )
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INVALID_INPUT',
      'featureKey does not require a Workspace-owned identity.',
      422
    );
}

function parseRuntimeBinding(value: unknown, workspaceId: string) {
  try {
    const parsed = parseWorkspaceChannelIdentityBindingV1(value);
    if (parsed.workspaceId !== workspaceId) throw new Error('Workspace mismatch.');
    return parsed;
  } catch (error) {
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INVALID_INPUT',
      'Workspace Channel Identity Binding contract validation failed.',
      422,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function parsePersistedBinding(value: unknown, workspaceId: string) {
  try {
    const parsed = parseWorkspaceChannelIdentityBindingV1(value);
    if (parsed.workspaceId !== workspaceId) throw new Error('Workspace mismatch.');
    return parsed;
  } catch (error) {
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INTEGRITY_FAILURE',
      'Persisted Workspace Channel Identity Binding failed contract validation.',
      500,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function normalizeTrustedInput(
  command: Readonly<AdmitTrustedWorkspaceChannelIdentityBindingCommandV1>
) {
  const workspaceId = cleanWorkspaceId(command.workspaceId);
  assertIdentityBoundFeature(command.featureKey);
  const at = '2000-01-01T00:00:00.000Z';
  const parsed = parseRuntimeBinding(
    {
      schemaVersion: 1,
      workspaceChannelIdentityBindingId: 'workspace-channel-identity-binding_validation',
      version: 1,
      workspaceId,
      featureKey: command.featureKey,
      identity: command.identity,
      status: 'ACTIVE',
      connection: command.connection,
      bindingFingerprintSha256: '0'.repeat(64),
      boundAt: at,
      lastVerifiedAt: at,
      updatedAt: at,
      authority: noWorkspaceChannelIdentityAuthorityConsequencesV1
    },
    workspaceId
  );
  return {
    workspaceId,
    featureKey: parsed.featureKey,
    identity: parsed.identity,
    connection: parsed.connection
  };
}

export function workspaceChannelExternalIdentityFingerprintSha256V1(
  value: Readonly<{
    featureKey: ChannelFeatureKeyV1;
    identity: Readonly<WorkspaceChannelExternalIdentityV1>;
  }>
): string {
  assertIdentityBoundFeature(value.featureKey);
  return fingerprint({
    featureKey: value.featureKey,
    externalAccountRef: value.identity.externalAccountRef,
    ...(value.identity.externalChannelRef
      ? { externalChannelRef: value.identity.externalChannelRef }
      : {})
  });
}

export function materializeTrustedWorkspaceChannelIdentityBindingV1(
  command: Readonly<AdmitTrustedWorkspaceChannelIdentityBindingCommandV1>,
  atValue: string,
  bindingId: WorkspaceChannelIdentityBindingId
): WorkspaceChannelIdentityBindingV1 {
  const normalized = normalizeTrustedInput(command);
  const at = timestamp(atValue);
  const candidate = parseRuntimeBinding(
    {
      schemaVersion: 1,
      workspaceChannelIdentityBindingId: cleanBindingId(bindingId),
      version: 1,
      workspaceId: normalized.workspaceId,
      featureKey: normalized.featureKey,
      identity: normalized.identity,
      status: 'ACTIVE',
      connection: normalized.connection,
      bindingFingerprintSha256: '0'.repeat(64),
      boundAt: at,
      lastVerifiedAt: at,
      updatedAt: at,
      authority: noWorkspaceChannelIdentityAuthorityConsequencesV1
    },
    normalized.workspaceId
  );
  return parseRuntimeBinding(
    {
      ...candidate,
      bindingFingerprintSha256: workspaceChannelIdentityBindingFingerprintSha256V1(candidate)
    },
    normalized.workspaceId
  );
}

function identityFingerprint(binding: Readonly<WorkspaceChannelIdentityBindingV1>) {
  return workspaceChannelExternalIdentityFingerprintSha256V1({
    featureKey: binding.featureKey,
    identity: binding.identity
  });
}

function timestampEqual(value: unknown, expected: string | undefined): boolean {
  if (expected === undefined) return value === null || value === undefined;
  if (value === null || value === undefined) return false;
  const actual =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'string'
        ? Date.parse(value)
        : Number.NaN;
  return Number.isFinite(actual) && actual === Date.parse(expected);
}

function versionFromRow(row: Row): WorkspaceChannelIdentityBindingV1 {
  const workspaceId = String(row.workspace_id);
  const binding = parsePersistedBinding(row.document_json, workspaceId);
  const oauth = binding.connection.oauthCredentialRef;
  const mismatch =
    binding.workspaceChannelIdentityBindingId !== row.workspace_channel_identity_binding_id ||
    binding.version !== Number(row.version) ||
    binding.featureKey !== row.feature_key ||
    binding.status !== row.status ||
    identityFingerprint(binding) !== row.identity_fingerprint_sha256 ||
    binding.identity.externalAccountRef !== row.external_account_ref ||
    (binding.identity.externalChannelRef ?? null) !== row.external_channel_ref ||
    binding.connection.capabilityRef.capabilityId !== row.capability_id ||
    binding.connection.capabilityRef.capabilityVersion !== row.capability_version ||
    binding.connection.implementationRef.implementationProfileId !==
      row.implementation_profile_id ||
    binding.connection.implementationRef.version !== Number(row.implementation_profile_version) ||
    (oauth?.credentialBindingId ?? null) !== row.oauth_credential_binding_id ||
    (oauth?.version ?? null) !==
      (row.oauth_credential_binding_version === null
        ? null
        : Number(row.oauth_credential_binding_version)) ||
    binding.bindingFingerprintSha256 !== row.binding_fingerprint_sha256 ||
    !timestampEqual(row.bound_at, binding.boundAt) ||
    !timestampEqual(row.last_verified_at, binding.lastVerifiedAt) ||
    !timestampEqual(row.stale_at, binding.staleAt) ||
    !timestampEqual(row.revoked_at, binding.revokedAt) ||
    !timestampEqual(row.updated_at, binding.updatedAt);
  if (mismatch)
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INTEGRITY_FAILURE',
      'Workspace Channel Identity Binding columns do not match document_json.',
      500
    );
  const computed = workspaceChannelIdentityBindingFingerprintSha256V1(binding);
  if (computed !== binding.bindingFingerprintSha256)
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INTEGRITY_FAILURE',
      'Workspace Channel Identity Binding fingerprint is invalid.',
      500
    );
  return binding;
}

function latestFromRow(row: Row): WorkspaceChannelIdentityBindingV1 {
  const binding = versionFromRow(row);
  if (
    binding.version !== Number(row.head_latest_version) ||
    binding.featureKey !== row.head_feature_key ||
    binding.status !== row.head_status ||
    identityFingerprint(binding) !== row.head_identity_fingerprint_sha256 ||
    binding.bindingFingerprintSha256 !== row.head_binding_fingerprint_sha256 ||
    !timestampEqual(row.head_updated_at, binding.updatedAt)
  )
    throw new WorkspaceChannelIdentityBindingRuntimeError(
      'INTEGRITY_FAILURE',
      'Workspace Channel Identity Binding head does not match its exact version.',
      500
    );
  return binding;
}

const latestSelect = `SELECT v.*,
       h.latest_version AS head_latest_version,
       h.feature_key AS head_feature_key,
       h.status AS head_status,
       h.identity_fingerprint_sha256 AS head_identity_fingerprint_sha256,
       h.binding_fingerprint_sha256 AS head_binding_fingerprint_sha256,
       h.updated_at AS head_updated_at
  FROM lite_workspace_channel_identity_binding_heads h
  JOIN lite_workspace_channel_identity_binding_versions v
    ON v.workspace_id=h.workspace_id
   AND v.workspace_channel_identity_binding_id=h.workspace_channel_identity_binding_id
   AND v.version=h.latest_version`;

export class PostgresWorkspaceChannelIdentityBindingStoreV1 {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => WorkspaceChannelIdentityBindingId = () =>
      `workspace-channel-identity-binding_${randomUUID().replaceAll('-', '')}`
  ) {}

  async admitTrusted(
    command: Readonly<AdmitTrustedWorkspaceChannelIdentityBindingCommandV1>
  ): Promise<WorkspaceChannelIdentityBindingV1> {
    const normalized = normalizeTrustedInput(command);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const requestFingerprint = fingerprint({
      commandType: 'ADMIT_TRUSTED',
      ...normalized
    });
    const identityKey = workspaceChannelExternalIdentityFingerprintSha256V1(normalized);
    return this.command(
      normalized.workspaceId,
      idempotencyKey,
      'ADMIT_TRUSTED',
      requestFingerprint,
      async (client) => {
        await this.lock(
          client,
          `${normalized.workspaceId}:channel-identity:${normalized.featureKey}:${identityKey}`
        );
        const existing = await client.query<Row>(
          `SELECT workspace_channel_identity_binding_id
             FROM lite_workspace_channel_identity_binding_heads
            WHERE workspace_id=$1 AND feature_key=$2
              AND identity_fingerprint_sha256=$3 AND status='ACTIVE'`,
          [normalized.workspaceId, normalized.featureKey, identityKey]
        );
        if (existing.rows[0])
          throw new WorkspaceChannelIdentityBindingRuntimeError(
            'DUPLICATE_ACTIVE_IDENTITY',
            'An ACTIVE binding already owns this exact Workspace Channel identity.'
          );
        const binding = materializeTrustedWorkspaceChannelIdentityBindingV1(
          { ...normalized, idempotencyKey },
          this.timestamp(),
          this.id()
        );
        await this.insertVersion(client, binding);
        await this.insertHead(client, binding);
        return binding;
      }
    );
  }

  markStale(command: Readonly<TransitionWorkspaceChannelIdentityBindingCommandV1>) {
    return this.transition(command, 'MARK_STALE');
  }

  revoke(command: Readonly<TransitionWorkspaceChannelIdentityBindingCommandV1>) {
    return this.transition(command, 'REVOKE');
  }

  async getExact(
    workspaceIdValue: string,
    bindingIdValue: WorkspaceChannelIdentityBindingId,
    versionValue: number
  ): Promise<WorkspaceChannelIdentityBindingV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const bindingId = cleanBindingId(bindingIdValue);
    const version = cleanVersion(versionValue);
    try {
      return await this.readExact(this.query, workspaceId, bindingId, version);
    } catch (error) {
      if (error instanceof WorkspaceChannelIdentityBindingRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  async getLatest(
    workspaceIdValue: string,
    bindingIdValue: WorkspaceChannelIdentityBindingId
  ): Promise<WorkspaceChannelIdentityBindingV1 | undefined> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const bindingId = cleanBindingId(bindingIdValue);
    try {
      const result = await this.query.query<Row>(
        `${latestSelect}
         WHERE h.workspace_id=$1 AND h.workspace_channel_identity_binding_id=$2`,
        [workspaceId, bindingId]
      );
      return result.rows[0] ? latestFromRow(result.rows[0]) : undefined;
    } catch (error) {
      if (error instanceof WorkspaceChannelIdentityBindingRuntimeError) throw error;
      throw this.persistenceError(error);
    }
  }

  private async transition(
    command: Readonly<TransitionWorkspaceChannelIdentityBindingCommandV1>,
    commandType: 'MARK_STALE' | 'REVOKE'
  ) {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const bindingId = cleanBindingId(command.workspaceChannelIdentityBindingId);
    const expectedVersion = cleanVersion(command.expectedVersion);
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const evidenceRef = cleanText(command.evidenceRef, 'evidenceRef');
    const requestFingerprint = fingerprint({
      commandType,
      workspaceId,
      bindingId,
      expectedVersion,
      evidenceRef
    });
    return this.command(
      workspaceId,
      idempotencyKey,
      commandType,
      requestFingerprint,
      async (client) => {
        await this.lock(client, `${workspaceId}:channel-binding:${bindingId}`);
        const current = await this.requireLatest(client, workspaceId, bindingId);
        if (current.version !== expectedVersion)
          throw new WorkspaceChannelIdentityBindingRuntimeError(
            'VERSION_CONFLICT',
            `Expected binding version ${expectedVersion}, found ${current.version}.`
          );
        if (
          (commandType === 'MARK_STALE' && current.status !== 'ACTIVE') ||
          (commandType === 'REVOKE' && current.status === 'REVOKED')
        )
          throw new WorkspaceChannelIdentityBindingRuntimeError(
            'INVALID_TRANSITION',
            `Binding cannot apply ${commandType} from ${current.status}.`
          );
        const at = later(current.updatedAt, this.timestamp());
        const candidate = parseRuntimeBinding(
          {
            ...clone(current),
            version: current.version + 1,
            status: commandType === 'MARK_STALE' ? 'STALE' : 'REVOKED',
            connection: {
              ...clone(current.connection),
              evidenceRefs: [...current.connection.evidenceRefs, evidenceRef]
            },
            bindingFingerprintSha256: '0'.repeat(64),
            ...(commandType === 'MARK_STALE' ? { staleAt: at } : { revokedAt: at }),
            updatedAt: at
          },
          workspaceId
        );
        const next = parseRuntimeBinding(
          {
            ...candidate,
            bindingFingerprintSha256: workspaceChannelIdentityBindingFingerprintSha256V1(candidate)
          },
          workspaceId
        );
        await this.insertVersion(client, next);
        await this.updateHead(client, next, expectedVersion);
        return next;
      }
    );
  }

  private async command(
    workspaceId: string,
    idempotencyKey: string,
    commandType: CommandType,
    requestFingerprint: string,
    write: (client: QueryClient) => Promise<WorkspaceChannelIdentityBindingV1>
  ) {
    try {
      return await this.database.transact(async (client) => {
        await this.lock(client, `${workspaceId}:channel-binding-command:${idempotencyKey}`);
        const replay = await client.query<Row>(
          `SELECT command_type,request_fingerprint_sha256,result_json
             FROM lite_workspace_channel_identity_binding_commands
            WHERE workspace_id=$1 AND idempotency_key=$2`,
          [workspaceId, idempotencyKey]
        );
        if (replay.rows[0])
          return this.validateReplay(
            client,
            workspaceId,
            replay.rows[0],
            commandType,
            requestFingerprint
          );
        const result = await write(client);
        await client.query(
          `INSERT INTO lite_workspace_channel_identity_binding_commands(
             workspace_id,idempotency_key,command_type,request_fingerprint_sha256,
             result_binding_id,result_version,result_json,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [
            workspaceId,
            idempotencyKey,
            commandType,
            requestFingerprint,
            result.workspaceChannelIdentityBindingId,
            result.version,
            JSON.stringify(result),
            this.timestamp()
          ]
        );
        return clone(result);
      });
    } catch (error) {
      if (error instanceof WorkspaceChannelIdentityBindingRuntimeError) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'constraint' in error &&
        error.constraint === 'lite_workspace_channel_identity_one_active_identity'
      )
        throw new WorkspaceChannelIdentityBindingRuntimeError(
          'DUPLICATE_ACTIVE_IDENTITY',
          'An ACTIVE binding already owns this exact Workspace Channel identity.'
        );
      throw this.persistenceError(error);
    }
  }

  private async validateReplay(
    client: QueryClient,
    workspaceId: string,
    row: Row,
    commandType: CommandType,
    requestFingerprint: string
  ) {
    if (row.command_type !== commandType || row.request_fingerprint_sha256 !== requestFingerprint)
      throw new WorkspaceChannelIdentityBindingRuntimeError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different Channel binding command.'
      );
    const replay = parsePersistedBinding(row.result_json, workspaceId);
    const durable = await this.readExact(
      client,
      workspaceId,
      replay.workspaceChannelIdentityBindingId,
      replay.version
    );
    if (!durable || fingerprint(durable) !== fingerprint(replay))
      throw new WorkspaceChannelIdentityBindingRuntimeError(
        'INTEGRITY_FAILURE',
        'Channel binding command replay no longer matches durable owner truth.',
        500
      );
    return clone(replay);
  }

  private async requireLatest(
    client: QueryClient,
    workspaceId: string,
    bindingId: WorkspaceChannelIdentityBindingId
  ) {
    const result = await client.query<Row>(
      `${latestSelect}
       WHERE h.workspace_id=$1 AND h.workspace_channel_identity_binding_id=$2`,
      [workspaceId, bindingId]
    );
    if (!result.rows[0])
      throw new WorkspaceChannelIdentityBindingRuntimeError(
        'NOT_FOUND',
        'Workspace Channel Identity Binding was not found.',
        404
      );
    return latestFromRow(result.rows[0]);
  }

  private async readExact(
    client: QueryClient,
    workspaceId: string,
    bindingId: WorkspaceChannelIdentityBindingId,
    version: number
  ) {
    const result = await client.query<Row>(
      `SELECT * FROM lite_workspace_channel_identity_binding_versions
        WHERE workspace_id=$1 AND workspace_channel_identity_binding_id=$2 AND version=$3`,
      [workspaceId, bindingId, version]
    );
    return result.rows[0] ? versionFromRow(result.rows[0]) : undefined;
  }

  private async insertVersion(
    client: QueryClient,
    binding: Readonly<WorkspaceChannelIdentityBindingV1>
  ) {
    const oauth = binding.connection.oauthCredentialRef;
    await client.query(
      `INSERT INTO lite_workspace_channel_identity_binding_versions(
         workspace_id,workspace_channel_identity_binding_id,version,feature_key,status,
         identity_fingerprint_sha256,external_account_ref,external_channel_ref,
         capability_id,capability_version,implementation_profile_id,
         implementation_profile_version,oauth_credential_binding_id,
         oauth_credential_binding_version,binding_fingerprint_sha256,document_json,
         bound_at,last_verified_at,stale_at,revoked_at,updated_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21)`,
      [
        binding.workspaceId,
        binding.workspaceChannelIdentityBindingId,
        binding.version,
        binding.featureKey,
        binding.status,
        identityFingerprint(binding),
        binding.identity.externalAccountRef,
        binding.identity.externalChannelRef ?? null,
        binding.connection.capabilityRef.capabilityId,
        binding.connection.capabilityRef.capabilityVersion,
        binding.connection.implementationRef.implementationProfileId,
        binding.connection.implementationRef.version,
        oauth?.credentialBindingId ?? null,
        oauth?.version ?? null,
        binding.bindingFingerprintSha256,
        JSON.stringify(binding),
        binding.boundAt,
        binding.lastVerifiedAt,
        binding.staleAt ?? null,
        binding.revokedAt ?? null,
        binding.updatedAt
      ]
    );
  }

  private insertHead(client: QueryClient, binding: Readonly<WorkspaceChannelIdentityBindingV1>) {
    return client.query(
      `INSERT INTO lite_workspace_channel_identity_binding_heads(
         workspace_id,workspace_channel_identity_binding_id,latest_version,feature_key,status,
         identity_fingerprint_sha256,binding_fingerprint_sha256,updated_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        binding.workspaceId,
        binding.workspaceChannelIdentityBindingId,
        binding.version,
        binding.featureKey,
        binding.status,
        identityFingerprint(binding),
        binding.bindingFingerprintSha256,
        binding.updatedAt
      ]
    );
  }

  private async updateHead(
    client: QueryClient,
    binding: Readonly<WorkspaceChannelIdentityBindingV1>,
    expectedVersion: number
  ) {
    const result = await client.query(
      `UPDATE lite_workspace_channel_identity_binding_heads
          SET latest_version=$3,feature_key=$4,status=$5,identity_fingerprint_sha256=$6,
              binding_fingerprint_sha256=$7,updated_at=$8
        WHERE workspace_id=$1 AND workspace_channel_identity_binding_id=$2
          AND latest_version=$9`,
      [
        binding.workspaceId,
        binding.workspaceChannelIdentityBindingId,
        binding.version,
        binding.featureKey,
        binding.status,
        identityFingerprint(binding),
        binding.bindingFingerprintSha256,
        binding.updatedAt,
        expectedVersion
      ]
    );
    if (result.rowCount !== 1)
      throw new WorkspaceChannelIdentityBindingRuntimeError(
        'VERSION_CONFLICT',
        'Workspace Channel Identity Binding head changed concurrently.'
      );
  }

  private lock(client: QueryClient, key: string) {
    return client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
  }

  private timestamp() {
    return timestamp(this.now());
  }

  private persistenceError(error: unknown) {
    return new WorkspaceChannelIdentityBindingRuntimeError(
      'PERSISTENCE_UNAVAILABLE',
      'Workspace Channel Identity Binding persistence is unavailable.',
      503,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
