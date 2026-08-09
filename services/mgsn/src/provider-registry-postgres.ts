import type {
  ProviderId,
  ProviderSupplyCapabilityId
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  ProviderRegistryError,
  type ProviderRegistryRecord,
  type ProviderRegistryReplay,
  type ProviderRegistryRepository,
  type ProviderSupplyCapabilityRecord
} from './provider-registry.js';

type Row = Record<string, unknown>;

export interface ProviderRegistryTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

export class PostgresProviderRegistryRepository implements ProviderRegistryRepository {
  constructor(
    private readonly database: ProviderRegistryTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findReplay(scopeKey: string, idempotencyKey: string): Promise<ProviderRegistryReplay | undefined> {
    try {
      const result = await this.query.query(
        'SELECT request_fingerprint,target_type,target_id,response_version FROM mgsn_provider_registry_commands WHERE scope_key=$1 AND idempotency_key=$2',
        [scopeKey, idempotencyKey]
      );
      if (!result.rowCount) return undefined;
      const row = result.rows[0] as Row;
      return {
        fingerprint: String(row.request_fingerprint),
        targetType: String(row.target_type) as ProviderRegistryReplay['targetType'],
        targetId: String(row.target_id),
        responseVersion: Number(row.response_version)
      };
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findProviderById(providerId: ProviderId) {
    try {
      const result = await this.query.query(
        'SELECT provider_record,operational_status,version,updated_by,updated_at FROM mgsn_providers WHERE provider_id=$1',
        [providerId]
      );
      return result.rowCount ? this.mapProvider(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findProviderByWorkspaceId(providerWorkspaceId: string) {
    try {
      const result = await this.query.query(
        'SELECT provider_record,operational_status,version,updated_by,updated_at FROM mgsn_providers WHERE provider_workspace_id=$1',
        [providerWorkspaceId]
      );
      return result.rowCount ? this.mapProvider(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async listProviders() {
    try {
      const result = await this.query.query(
        'SELECT provider_record,operational_status,version,updated_by,updated_at FROM mgsn_providers ORDER BY updated_at DESC,provider_id',
        []
      );
      return result.rows.map((row) => this.mapProvider(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async createProvider(
    record: ProviderRegistryRecord,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.lockReplay(client, scopeKey, idempotencyKey, requestFingerprint);
        if (replay) return this.requireProviderWithClient(client, replay.targetId as ProviderId);
        await client.query(
          'INSERT INTO mgsn_providers(provider_id,provider_workspace_id,display_name,operational_status,version,provider_record,created_by,updated_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$7,$8,$8)',
          [
            record.providerId,
            record.providerWorkspaceId,
            record.displayName,
            record.operationalStatus,
            record.version,
            JSON.stringify(record),
            record.createdBy,
            record.createdAt
          ]
        );
        await this.insertCommand(client, {
          scopeKey,
          idempotencyKey,
          requestFingerprint,
          targetType: 'PROVIDER',
          targetId: record.providerId,
          commandType: 'PROVIDER_CREATE',
          responseVersion: record.version,
          responseRecord: record,
          actorId: record.createdBy,
          createdAt: record.createdAt
        });
        await this.insertAudit(client, record, 'PROVIDER_CREATED');
        return record;
      });
    } catch (cause) {
      if (cause instanceof ProviderRegistryError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new ProviderRegistryError(
          'PROVIDER_IDENTITY_EXISTS',
          'Referenced Core Workspace is already bound to a Provider record.',
          409
        );
      throw this.unavailable(cause);
    }
  }

  async updateProvider(
    record: ProviderRegistryRecord,
    expectedVersion: number,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.lockReplay(client, scopeKey, idempotencyKey, requestFingerprint);
        if (replay) return this.requireProviderWithClient(client, replay.targetId as ProviderId);
        const updated = await client.query(
          'UPDATE mgsn_providers SET display_name=$3,operational_status=$4,version=$5,provider_record=$6::jsonb,updated_by=$7,updated_at=$8 WHERE provider_id=$1 AND provider_workspace_id=$2 AND version=$9',
          [
            record.providerId,
            record.providerWorkspaceId,
            record.displayName,
            record.operationalStatus,
            record.version,
            JSON.stringify(record),
            record.updatedBy,
            record.updatedAt,
            expectedVersion
          ]
        );
        if (!updated.rowCount)
          throw new ProviderRegistryError(
            'STALE_PROVIDER',
            'Provider changed; reload the exact latest version.',
            409
          );
        await this.insertCommand(client, {
          scopeKey,
          idempotencyKey,
          requestFingerprint,
          targetType: 'PROVIDER',
          targetId: record.providerId,
          commandType: 'PROVIDER_STATUS',
          responseVersion: record.version,
          responseRecord: record,
          actorId: record.updatedBy,
          createdAt: record.updatedAt
        });
        await this.insertAudit(client, record, `PROVIDER_STATUS_${record.operationalStatus}`);
        return record;
      });
    } catch (cause) {
      if (cause instanceof ProviderRegistryError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async findSupplyCapability(providerSupplyCapabilityId: ProviderSupplyCapabilityId, version?: number) {
    try {
      const result = await this.query.query(
        version === undefined
          ? 'SELECT capability_record FROM mgsn_provider_supply_capabilities WHERE provider_supply_capability_id=$1 AND is_current=true'
          : 'SELECT capability_record FROM mgsn_provider_supply_capabilities WHERE provider_supply_capability_id=$1 AND version=$2',
        version === undefined ? [providerSupplyCapabilityId] : [providerSupplyCapabilityId, version]
      );
      return result.rowCount
        ? (result.rows[0] as Row).capability_record as ProviderSupplyCapabilityRecord
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async listCurrentSupplyCapabilities(providerId: ProviderId) {
    try {
      const result = await this.query.query(
        'SELECT capability_record FROM mgsn_provider_supply_capabilities WHERE provider_id=$1 AND is_current=true ORDER BY updated_at DESC,provider_supply_capability_id',
        [providerId]
      );
      return result.rows.map(
        (row) => (row as Row).capability_record as ProviderSupplyCapabilityRecord
      );
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async createSupplyCapability(
    record: ProviderSupplyCapabilityRecord,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.lockReplay(client, scopeKey, idempotencyKey, requestFingerprint);
        if (replay)
          return this.requireCapabilityWithClient(
            client,
            replay.targetId as ProviderSupplyCapabilityId,
            replay.responseVersion
          );
        await this.insertCapability(client, record, true);
        await this.insertCommand(client, {
          scopeKey,
          idempotencyKey,
          requestFingerprint,
          targetType: 'SUPPLY_CAPABILITY',
          targetId: record.providerSupplyCapabilityId,
          commandType: 'SUPPLY_CREATE',
          responseVersion: record.version,
          responseRecord: record,
          actorId: record.createdBy,
          createdAt: record.createdAt
        });
        await this.insertSupplyAudit(client, record, 'SUPPLY_CAPABILITY_CREATED');
        return record;
      });
    } catch (cause) {
      if (cause instanceof ProviderRegistryError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new ProviderRegistryError(
          'SUPPLY_CAPABILITY_EXISTS',
          'Provider Supply Capability already exists.',
          409
        );
      throw this.unavailable(cause);
    }
  }

  async reviseSupplyCapability(
    record: ProviderSupplyCapabilityRecord,
    expectedVersion: number,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.lockReplay(client, scopeKey, idempotencyKey, requestFingerprint);
        if (replay)
          return this.requireCapabilityWithClient(
            client,
            replay.targetId as ProviderSupplyCapabilityId,
            replay.responseVersion
          );
        const closed = await client.query(
          'UPDATE mgsn_provider_supply_capabilities SET is_current=false WHERE provider_supply_capability_id=$1 AND version=$2 AND is_current=true',
          [record.providerSupplyCapabilityId, expectedVersion]
        );
        if (!closed.rowCount)
          throw new ProviderRegistryError(
            'STALE_SUPPLY_CAPABILITY',
            'Provider Supply Capability changed; reload the exact latest version.',
            409
          );
        await this.insertCapability(client, record, true);
        await this.insertCommand(client, {
          scopeKey,
          idempotencyKey,
          requestFingerprint,
          targetType: 'SUPPLY_CAPABILITY',
          targetId: record.providerSupplyCapabilityId,
          commandType: 'SUPPLY_REVISE',
          responseVersion: record.version,
          responseRecord: record,
          actorId: record.updatedBy,
          createdAt: record.updatedAt
        });
        await this.insertSupplyAudit(client, record, `SUPPLY_CAPABILITY_${record.status}`);
        return record;
      });
    } catch (cause) {
      if (cause instanceof ProviderRegistryError) throw cause;
      throw this.unavailable(cause);
    }
  }

  private async lockReplay(
    client: QueryClient,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    const result = await client.query(
      'SELECT request_fingerprint,target_type,target_id,response_version FROM mgsn_provider_registry_commands WHERE scope_key=$1 AND idempotency_key=$2 FOR UPDATE',
      [scopeKey, idempotencyKey]
    );
    if (!result.rowCount) return undefined;
    const row = result.rows[0] as Row;
    if (String(row.request_fingerprint) !== requestFingerprint)
      throw new ProviderRegistryError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    return {
      fingerprint: String(row.request_fingerprint),
      targetType: String(row.target_type) as ProviderRegistryReplay['targetType'],
      targetId: String(row.target_id),
      responseVersion: Number(row.response_version)
    } satisfies ProviderRegistryReplay;
  }

  private async requireProviderWithClient(client: QueryClient, providerId: ProviderId) {
    const result = await client.query(
      'SELECT provider_record,operational_status,version,updated_by,updated_at FROM mgsn_providers WHERE provider_id=$1',
      [providerId]
    );
    if (!result.rowCount)
      throw new ProviderRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Provider result is unavailable.',
        503
      );
    return this.mapProvider(result.rows[0] as Row);
  }

  private async requireCapabilityWithClient(
    client: QueryClient,
    providerSupplyCapabilityId: ProviderSupplyCapabilityId,
    version: number
  ) {
    const result = await client.query(
      'SELECT capability_record FROM mgsn_provider_supply_capabilities WHERE provider_supply_capability_id=$1 AND version=$2',
      [providerSupplyCapabilityId, version]
    );
    if (!result.rowCount)
      throw new ProviderRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Provider Supply Capability result is unavailable.',
        503
      );
    return (result.rows[0] as Row).capability_record as ProviderSupplyCapabilityRecord;
  }

  private async insertCapability(
    client: QueryClient,
    record: ProviderSupplyCapabilityRecord,
    isCurrent: boolean
  ) {
    await client.query(
      'INSERT INTO mgsn_provider_supply_capabilities(provider_supply_capability_id,version,provider_id,provider_workspace_id,status,jurisdictions,service_types,effective_from,effective_until,capacity_units,availability_units,verification_state,evidence_references,source_fingerprint_sha256,capability_record,is_current,created_by,updated_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16,$17,$18,$19,$20)',
      [
        record.providerSupplyCapabilityId,
        record.version,
        record.provider.providerId,
        record.provider.providerWorkspaceId,
        record.status,
        [...record.jurisdictions],
        [...record.serviceTypes],
        record.effectivePeriod.effectiveFrom,
        record.effectivePeriod.effectiveUntil ?? null,
        record.capacityUnits ?? 0,
        record.availabilityUnits,
        record.verificationState,
        JSON.stringify(record.evidenceReferences),
        record.sourceFingerprintSha256,
        JSON.stringify(record),
        isCurrent,
        record.createdBy,
        record.updatedBy,
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  private insertCommand(
    client: QueryClient,
    value: {
      scopeKey: string;
      idempotencyKey: string;
      requestFingerprint: string;
      targetType: 'PROVIDER' | 'SUPPLY_CAPABILITY';
      targetId: string;
      commandType: 'PROVIDER_CREATE' | 'PROVIDER_STATUS' | 'SUPPLY_CREATE' | 'SUPPLY_REVISE';
      responseVersion: number;
      responseRecord: ProviderRegistryRecord | ProviderSupplyCapabilityRecord;
      actorId: string;
      createdAt: string;
    }
  ) {
    return client.query(
      'INSERT INTO mgsn_provider_registry_commands(scope_key,idempotency_key,request_fingerprint,target_type,target_id,command_type,response_version,response_record,actor_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)',
      [
        value.scopeKey,
        value.idempotencyKey,
        value.requestFingerprint,
        value.targetType,
        value.targetId,
        value.commandType,
        value.responseVersion,
        JSON.stringify(value.responseRecord),
        value.actorId,
        value.createdAt
      ]
    );
  }

  private insertAudit(client: QueryClient, record: ProviderRegistryRecord, action: string) {
    return client.query(
      'INSERT INTO mgsn_provider_registry_audit(provider_workspace_id,target_type,target_id,action,record_version,actor_id,created_at) VALUES($1,\'PROVIDER\',$2,$3,$4,$5,$6)',
      [
        record.providerWorkspaceId,
        record.providerId,
        action,
        record.version,
        record.updatedBy,
        record.updatedAt
      ]
    );
  }

  private insertSupplyAudit(
    client: QueryClient,
    record: ProviderSupplyCapabilityRecord,
    action: string
  ) {
    return client.query(
      'INSERT INTO mgsn_provider_registry_audit(provider_workspace_id,target_type,target_id,action,record_version,actor_id,source_fingerprint,created_at) VALUES($1,\'SUPPLY_CAPABILITY\',$2,$3,$4,$5,$6,$7)',
      [
        record.provider.providerWorkspaceId,
        record.providerSupplyCapabilityId,
        action,
        record.version,
        record.updatedBy,
        record.sourceFingerprintSha256,
        record.updatedAt
      ]
    );
  }

  private mapProvider(row: Row): ProviderRegistryRecord {
    const stored = row.provider_record as ProviderRegistryRecord;
    return {
      ...stored,
      operationalStatus: String(row.operational_status) as ProviderRegistryRecord['operationalStatus'],
      version: Number(row.version),
      updatedBy: String(row.updated_by),
      updatedAt: new Date(row.updated_at as string).toISOString()
    };
  }

  private unavailable(cause: unknown) {
    return new ProviderRegistryError(
      'PERSISTENCE_UNAVAILABLE',
      'MGSN Provider Registry persistence is unavailable.',
      503,
      cause instanceof Error ? { cause: cause.message } : undefined
    );
  }
}
