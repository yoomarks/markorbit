import {
  networkVisibilityFieldsByDataClass,
  noNetworkParticipationAuthorityConsequences,
  type NetworkParticipationAuditProvenanceV1,
  type NetworkParticipationId,
  type NetworkParticipationSnapshotV1,
  type NetworkVisibilityDataClass,
  type NetworkVisibilityGrantV1
} from '@markorbit/contracts/network-participation';
import type { MarkOrbitId } from '@markorbit/contracts';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  NetworkParticipationError,
  type NetworkParticipationCommandType,
  type NetworkParticipationCommit,
  type NetworkParticipationReplayRecord,
  type NetworkParticipationRepository,
  type NetworkParticipationVersionRecord,
  type NetworkVisibilityPolicyVersionRecord
} from './network-participation.js';

type Row = Record<string, unknown>;

export interface NetworkParticipationTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

const participationStates = new Set(['ACTIVE', 'PAUSED', 'REVOKED']);
const visibilityScopes = new Set(['PRIVATE', 'TRUSTED', 'BOUNDED_PUBLIC']);
const commandTypes = new Set<NetworkParticipationCommandType>([
  'OPT_IN',
  'PAUSE',
  'RESUME',
  'REVOKE',
  'REPLACE_VISIBILITY_POLICY'
]);

function record(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function iso(value: unknown): string {
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.valueOf())) throw new Error('Persisted timestamp is invalid.');
  return date.toISOString();
}

function validGrant(value: unknown, scope: string): value is NetworkVisibilityGrantV1 {
  if (!record(value) || value.scope !== scope || value.purpose !== 'PROVIDER_DISCOVERY')
    return false;
  if (!nonEmptyString(value.dataClass) || !(value.dataClass in networkVisibilityFieldsByDataClass))
    return false;
  const allowed = new Set<string>(
    networkVisibilityFieldsByDataClass[value.dataClass as NetworkVisibilityDataClass]
  );
  if (
    !Array.isArray(value.fields) ||
    value.fields.length === 0 ||
    value.fields.some((field) => typeof field !== 'string' || !allowed.has(field)) ||
    !Array.isArray(value.authorityReferences) ||
    value.authorityReferences.length === 0 ||
    value.authorityReferences.some((authority) => !nonEmptyString(authority)) ||
    !record(value.audience)
  )
    return false;
  if (scope === 'TRUSTED')
    return (
      value.audience.kind === 'TRUSTED_RELATIONSHIP' &&
      nonEmptyString(value.audience.relationshipAuthorityReference)
    );
  return scope === 'BOUNDED_PUBLIC' && value.audience.kind === 'BOUNDED_NETWORK';
}

function validGrants(value: unknown, scope: string): value is NetworkVisibilityGrantV1[] {
  if (!Array.isArray(value)) return false;
  if (scope === 'PRIVATE') return value.length === 0;
  return value.length > 0 && value.every((grant) => validGrant(grant, scope));
}

function validAuthorityConsequences(value: unknown): boolean {
  if (!record(value)) return false;
  return Object.entries(noNetworkParticipationAuthorityConsequences).every(
    ([key, expected]) => value[key] === expected
  );
}

function persistedSnapshot(value: unknown): NetworkParticipationSnapshotV1 {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !nonEmptyString(value.networkParticipationId) ||
    !value.networkParticipationId.startsWith('network-participation_') ||
    !nonEmptyString(value.workspaceId) ||
    !nonEmptyString(value.providerId) ||
    !positiveInteger(value.participationVersion) ||
    !nonEmptyString(value.state) ||
    !participationStates.has(value.state) ||
    !nonEmptyString(value.authorizationReference) ||
    !nonEmptyString(value.checkedAt) ||
    !validAuthorityConsequences(value.authorityConsequences) ||
    !record(value.visibilityPolicy)
  )
    throw new Error('Persisted Network Participation replay is malformed.');
  const policy = value.visibilityPolicy;
  if (
    policy.schemaVersion !== 1 ||
    !positiveInteger(policy.version) ||
    !nonEmptyString(policy.scope) ||
    !visibilityScopes.has(policy.scope) ||
    !validGrants(policy.grants, policy.scope) ||
    !nonEmptyString(policy.authorizationReference) ||
    !nonEmptyString(policy.updatedAt)
  )
    throw new Error('Persisted Network Participation replay policy is malformed.');
  iso(value.checkedAt);
  iso(policy.updatedAt);
  return structuredClone(value) as NetworkParticipationSnapshotV1;
}

export class PostgresNetworkParticipationRepository implements NetworkParticipationRepository {
  constructor(
    private readonly database: NetworkParticipationTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findCurrentParticipation(workspaceId: string, providerId: ProviderId) {
    return this.readOneParticipation(
      this.query,
      'workspace_id=$1 AND provider_id=$2 AND is_current',
      [workspaceId, providerId]
    );
  }

  async findLatestParticipation(networkParticipationId: NetworkParticipationId) {
    return this.readOneParticipation(
      this.query,
      'network_participation_id=$1 ORDER BY version DESC LIMIT 1',
      [networkParticipationId]
    );
  }

  async findCurrentVisibilityPolicy(networkParticipationId: NetworkParticipationId) {
    return this.readOnePolicy(this.query, 'network_participation_id=$1 AND is_current', [
      networkParticipationId
    ]);
  }

  async findReplay(scopeKey: string, idempotencyKey: string) {
    try {
      return await this.readReplay(this.query, scopeKey, idempotencyKey);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async commit(
    mutation: NetworkParticipationCommit
  ): Promise<NetworkParticipationReplayRecord | undefined> {
    try {
      return await this.database.transact(async (client) => {
        const binding = await client.query(
          'SELECT provider_id FROM mgsn_providers WHERE provider_id=$1 AND provider_workspace_id=$2 FOR UPDATE',
          [mutation.providerId, mutation.workspaceId]
        );
        if (!binding.rowCount)
          throw new NetworkParticipationError(
            'PROVIDER_NOT_FOUND',
            'Provider was not found for the trusted Principal Workspace.',
            404
          );

        const replay = await this.readReplay(
          client,
          mutation.replay.scopeKey,
          mutation.replay.idempotencyKey
        );
        if (replay) {
          if (
            replay.fingerprint !== mutation.replay.fingerprint ||
            replay.commandType !== mutation.replay.commandType
          )
            throw new NetworkParticipationError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different trusted context or command payload.',
              409
            );
          return replay;
        }

        const current = await this.readOneParticipation(
          client,
          'workspace_id=$1 AND provider_id=$2 AND is_current',
          [mutation.workspaceId, mutation.providerId]
        );
        const currentPolicy = current
          ? await this.readOnePolicy(client, 'network_participation_id=$1 AND is_current', [
              current.networkParticipationId
            ])
          : undefined;
        if (
          (current?.networkParticipationId ?? null) !== mutation.expectedCurrentParticipationId ||
          (current?.version ?? null) !== mutation.expectedCurrentParticipationVersion
        )
          throw new NetworkParticipationError(
            'STALE_PARTICIPATION',
            'Network Participation changed; reload the exact latest version.',
            409
          );
        if ((currentPolicy?.version ?? null) !== mutation.expectedCurrentVisibilityPolicyVersion)
          throw new NetworkParticipationError(
            'STALE_VISIBILITY_POLICY',
            'Visibility Policy changed; reload the exact latest version.',
            409
          );

        const previousTarget = await this.readOneParticipation(
          client,
          'network_participation_id=$1 ORDER BY version DESC LIMIT 1',
          [mutation.participation.networkParticipationId]
        );
        if (previousTarget?.state === 'REVOKED')
          throw new NetworkParticipationError(
            'PARTICIPATION_REVOKED',
            'Revoked Network Participation cannot be revived; opt in with a fresh identity.',
            409
          );
        const policyOnly = Boolean(
          mutation.visibilityPolicy &&
          previousTarget &&
          current?.networkParticipationId === previousTarget.networkParticipationId &&
          current.version === mutation.participation.version &&
          previousTarget.version === mutation.participation.version
        );
        if (!policyOnly && mutation.participation.version !== (previousTarget?.version ?? 0) + 1)
          throw new NetworkParticipationError(
            'STALE_PARTICIPATION',
            'Network Participation history is not appendable at the requested version.',
            409
          );

        if (!policyOnly) {
          await client.query(
            'UPDATE mgsn_network_participations SET is_current=false WHERE workspace_id=$1 AND provider_id=$2 AND is_current',
            [mutation.workspaceId, mutation.providerId]
          );
          await this.insertParticipation(client, mutation.participation);
        }

        if (mutation.visibilityPolicy) {
          const latestPolicy = await this.readOnePolicy(
            client,
            'network_participation_id=$1 ORDER BY version DESC LIMIT 1',
            [mutation.visibilityPolicy.networkParticipationId]
          );
          if (mutation.visibilityPolicy.version !== (latestPolicy?.version ?? 0) + 1)
            throw new NetworkParticipationError(
              'STALE_VISIBILITY_POLICY',
              'Visibility Policy history is not appendable at the requested version.',
              409
            );
          await client.query(
            'UPDATE mgsn_network_visibility_policies SET is_current=false WHERE network_participation_id=$1 AND is_current',
            [mutation.visibilityPolicy.networkParticipationId]
          );
          await this.insertPolicy(client, mutation.visibilityPolicy);
        }

        await this.insertCommand(client, mutation);
        await this.insertAudit(client, mutation);
        return undefined;
      });
    } catch (cause) {
      if (cause instanceof NetworkParticipationError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async listParticipationHistory(networkParticipationId: NetworkParticipationId) {
    try {
      const result = await this.query.query(
        'SELECT * FROM mgsn_network_participations WHERE network_participation_id=$1 ORDER BY version',
        [networkParticipationId]
      );
      return result.rows.map((row) => this.mapParticipation(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async listVisibilityPolicyHistory(networkParticipationId: NetworkParticipationId) {
    try {
      const result = await this.query.query(
        'SELECT * FROM mgsn_network_visibility_policies WHERE network_participation_id=$1 ORDER BY version',
        [networkParticipationId]
      );
      return result.rows.map((row) => this.mapPolicy(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async listAuditHistory(networkParticipationId: NetworkParticipationId) {
    try {
      const result = await this.query.query(
        'SELECT * FROM mgsn_network_participation_audit WHERE network_participation_id=$1 ORDER BY audit_id',
        [networkParticipationId]
      );
      return result.rows.map((row) => this.mapAudit(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private async readOneParticipation(client: QueryClient, predicate: string, values: unknown[]) {
    try {
      const result = await client.query(
        `SELECT * FROM mgsn_network_participations WHERE ${predicate}`,
        values
      );
      return result.rowCount ? this.mapParticipation(result.rows[0] as Row) : undefined;
    } catch (cause) {
      if (client === this.query) throw this.unavailable(cause);
      throw cause;
    }
  }

  private async readOnePolicy(client: QueryClient, predicate: string, values: unknown[]) {
    try {
      const result = await client.query(
        `SELECT * FROM mgsn_network_visibility_policies WHERE ${predicate}`,
        values
      );
      return result.rowCount ? this.mapPolicy(result.rows[0] as Row) : undefined;
    } catch (cause) {
      if (client === this.query) throw this.unavailable(cause);
      throw cause;
    }
  }

  private async readReplay(client: QueryClient, scopeKey: string, idempotencyKey: string) {
    const result = await client.query(
      'SELECT request_fingerprint,command_type,response_record FROM mgsn_network_participation_commands WHERE scope_key=$1 AND idempotency_key=$2',
      [scopeKey, idempotencyKey]
    );
    if (!result.rowCount) return undefined;
    const row = result.rows[0] as Row;
    if (
      !nonEmptyString(row.request_fingerprint) ||
      !nonEmptyString(row.command_type) ||
      !commandTypes.has(row.command_type as NetworkParticipationCommandType)
    )
      throw new Error('Persisted Network Participation replay metadata is malformed.');
    return {
      scopeKey,
      idempotencyKey,
      fingerprint: row.request_fingerprint,
      commandType: row.command_type as NetworkParticipationCommandType,
      response: persistedSnapshot(row.response_record)
    } satisfies NetworkParticipationReplayRecord;
  }

  private insertParticipation(client: QueryClient, value: NetworkParticipationVersionRecord) {
    return client.query(
      'INSERT INTO mgsn_network_participations(network_participation_id,version,is_current,workspace_id,provider_id,state,authorization_reference,reason,actor_id,correlation_id,occurred_at,created_at) VALUES($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        value.networkParticipationId,
        value.version,
        value.workspaceId,
        value.providerId,
        value.state,
        value.authorizationReference,
        value.reason,
        value.actorId,
        value.correlationId,
        value.occurredAt,
        value.createdAt
      ]
    );
  }

  private insertPolicy(client: QueryClient, value: NetworkVisibilityPolicyVersionRecord) {
    return client.query(
      'INSERT INTO mgsn_network_visibility_policies(network_participation_id,version,participation_version,is_current,scope,grants,authorization_reference,reason,actor_id,correlation_id,updated_at,created_at) VALUES($1,$2,$3,true,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)',
      [
        value.networkParticipationId,
        value.version,
        value.participationVersion,
        value.scope,
        JSON.stringify(value.grants),
        value.authorizationReference,
        value.reason,
        value.actorId,
        value.correlationId,
        value.updatedAt,
        value.createdAt
      ]
    );
  }

  private insertCommand(client: QueryClient, mutation: NetworkParticipationCommit) {
    const value = mutation.replay;
    return client.query(
      'INSERT INTO mgsn_network_participation_commands(scope_key,idempotency_key,request_fingerprint,command_type,workspace_id,provider_id,network_participation_id,response_participation_version,response_visibility_policy_version,response_record,actor_id,authorization_reference,reason,correlation_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15)',
      [
        value.scopeKey,
        value.idempotencyKey,
        value.fingerprint,
        value.commandType,
        mutation.workspaceId,
        mutation.providerId,
        mutation.participation.networkParticipationId,
        value.response.participationVersion,
        value.response.visibilityPolicy.version,
        JSON.stringify(value.response),
        mutation.audit.trustedActorId,
        mutation.audit.authorityReference,
        mutation.audit.reason,
        mutation.audit.correlationId,
        mutation.audit.occurredAt
      ]
    );
  }

  private insertAudit(client: QueryClient, mutation: NetworkParticipationCommit) {
    const value = mutation.audit;
    const actions: Record<NetworkParticipationCommandType, string> = {
      OPT_IN: 'PARTICIPATION_OPTED_IN',
      PAUSE: 'PARTICIPATION_PAUSED',
      RESUME: 'PARTICIPATION_RESUMED',
      REVOKE: 'PARTICIPATION_REVOKED',
      REPLACE_VISIBILITY_POLICY: 'VISIBILITY_POLICY_REPLACED'
    };
    return client.query(
      'INSERT INTO mgsn_network_participation_audit(network_participation_id,workspace_id,provider_id,action,previous_participation_state,new_participation_state,previous_participation_version,new_participation_version,previous_visibility_policy_version,new_visibility_policy_version,affected_data_classes,actor_id,authority_reference,reason,correlation_id,occurred_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)',
      [
        value.networkParticipationId,
        value.workspaceId,
        value.providerId,
        actions[mutation.replay.commandType],
        value.previousParticipationState === 'NOT_PARTICIPATING'
          ? null
          : value.previousParticipationState,
        value.newParticipationState,
        value.previousParticipationVersion,
        value.newParticipationVersion,
        value.previousVisibilityPolicyVersion,
        value.newVisibilityPolicyVersion,
        [...value.affectedDataClasses],
        value.trustedActorId,
        value.authorityReference,
        value.reason,
        value.correlationId,
        value.occurredAt
      ]
    );
  }

  private mapParticipation(row: Row): NetworkParticipationVersionRecord {
    const state = String(row.state);
    if (!participationStates.has(state))
      throw new Error('Persisted participation state is invalid.');
    return {
      schemaVersion: 1,
      networkParticipationId: String(row.network_participation_id) as NetworkParticipationId,
      workspaceId: String(row.workspace_id),
      providerId: String(row.provider_id) as ProviderId,
      version: Number(row.version),
      state: state as NetworkParticipationVersionRecord['state'],
      authorizationReference: String(row.authorization_reference),
      reason: String(row.reason),
      actorId: String(row.actor_id) as MarkOrbitId,
      correlationId: String(row.correlation_id) as MarkOrbitId,
      occurredAt: iso(row.occurred_at),
      createdAt: iso(row.created_at)
    };
  }

  private mapPolicy(row: Row): NetworkVisibilityPolicyVersionRecord {
    const scope = String(row.scope);
    if (!visibilityScopes.has(scope) || !validGrants(row.grants, scope))
      throw new Error('Persisted Visibility Policy authority is malformed.');
    const common = {
      schemaVersion: 1,
      networkParticipationId: String(row.network_participation_id) as NetworkParticipationId,
      participationVersion: Number(row.participation_version),
      version: Number(row.version),
      authorizationReference: String(row.authorization_reference),
      reason: String(row.reason),
      actorId: String(row.actor_id) as MarkOrbitId,
      correlationId: String(row.correlation_id) as MarkOrbitId,
      updatedAt: iso(row.updated_at),
      createdAt: iso(row.created_at)
    };
    if (scope === 'PRIVATE')
      return { ...common, scope: 'PRIVATE', grants: [] } as NetworkVisibilityPolicyVersionRecord;
    const grants = structuredClone(row.grants);
    return {
      ...common,
      scope: scope as 'TRUSTED' | 'BOUNDED_PUBLIC',
      grants: [grants[0]!, ...grants.slice(1)]
    } as NetworkVisibilityPolicyVersionRecord;
  }

  private mapAudit(row: Row): NetworkParticipationAuditProvenanceV1 {
    const previousState = row.previous_participation_state;
    if (
      previousState !== null &&
      (typeof previousState !== 'string' || !participationStates.has(previousState))
    )
      throw new Error('Persisted previous participation state is invalid.');
    return {
      schemaVersion: 1,
      networkParticipationId: String(row.network_participation_id) as NetworkParticipationId,
      workspaceId: String(row.workspace_id),
      providerId: String(row.provider_id) as ProviderId,
      trustedActorId: String(row.actor_id) as MarkOrbitId,
      authorityReference: String(row.authority_reference),
      reason: String(row.reason),
      previousParticipationState: previousState
        ? (previousState as NetworkParticipationAuditProvenanceV1['previousParticipationState'])
        : 'NOT_PARTICIPATING',
      newParticipationState: String(
        row.new_participation_state
      ) as NetworkParticipationAuditProvenanceV1['newParticipationState'],
      previousParticipationVersion:
        row.previous_participation_version === null
          ? null
          : Number(row.previous_participation_version),
      newParticipationVersion: Number(row.new_participation_version),
      previousVisibilityPolicyVersion:
        row.previous_visibility_policy_version === null
          ? null
          : Number(row.previous_visibility_policy_version),
      newVisibilityPolicyVersion: Number(row.new_visibility_policy_version),
      affectedDataClasses: [...(row.affected_data_classes as NetworkVisibilityDataClass[])],
      occurredAt: iso(row.occurred_at),
      correlationId: String(row.correlation_id) as MarkOrbitId
    };
  }

  private unavailable(cause: unknown) {
    const error = new NetworkParticipationError(
      'PERSISTENCE_UNAVAILABLE',
      'MGSN Network Participation persistence is unavailable.',
      503
    );
    error.cause = cause;
    return error;
  }
}
