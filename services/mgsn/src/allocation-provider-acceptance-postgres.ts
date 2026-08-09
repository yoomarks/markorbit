import type {
  AllocationId,
  ProviderAcceptanceId,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  AllocationProviderAcceptanceError,
  type AllocationProviderAcceptanceReplay,
  type AllocationProviderAcceptanceRepository,
  type AllocationRecord,
  type ProviderAcceptanceRecord
} from './allocation-provider-acceptance.js';

type Row = Record<string, unknown>;

export interface AllocationProviderAcceptanceTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

export class PostgresAllocationProviderAcceptanceRepository implements AllocationProviderAcceptanceRepository {
  constructor(
    private readonly database: AllocationProviderAcceptanceTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findReplay(scopeKey: string, idempotencyKey: string) {
    try {
      const result = await this.query.query(
        'SELECT request_fingerprint,target_type,target_id,response_version,response_record FROM mgsn_allocation_commands WHERE scope_key=$1 AND idempotency_key=$2',
        [scopeKey, idempotencyKey]
      );
      if (!result.rowCount) return undefined;
      return this.mapReplay(result.rows[0] as Row);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findAllocation(allocationId: AllocationId, version?: number) {
    try {
      const result = await this.query.query(
        version === undefined
          ? 'SELECT allocation_record FROM mgsn_allocations WHERE allocation_id=$1 AND is_current=true'
          : 'SELECT allocation_record FROM mgsn_allocations WHERE allocation_id=$1 AND version=$2',
        version === undefined ? [allocationId] : [allocationId, version]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).allocation_record as AllocationRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findActiveAllocation(servicePackageId: ServicePackageId) {
    try {
      const result = await this.query.query(
        "SELECT allocation_record FROM mgsn_allocations WHERE service_package_id=$1 AND is_current=true AND status='ACTIVE'",
        [servicePackageId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).allocation_record as AllocationRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async createAllocation(
    record: AllocationRecord,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.lockReplay(client, scopeKey, idempotencyKey, requestFingerprint);
        if (replay) {
          if (replay.targetType !== 'ALLOCATION' || !('allocationId' in replay.responseRecord))
            throw new AllocationProviderAcceptanceError(
              'PERSISTENCE_UNAVAILABLE',
              'Idempotent Allocation result is unavailable.',
              503
            );
          return replay.responseRecord;
        }

        await client.query(
          'SELECT service_package_id FROM mgsn_service_packages WHERE service_package_id=$1 FOR UPDATE',
          [record.servicePackage.id]
        );
        const active = await client.query(
          "SELECT allocation_id FROM mgsn_allocations WHERE service_package_id=$1 AND is_current=true AND status='ACTIVE' FOR UPDATE",
          [record.servicePackage.id]
        );
        if (active.rowCount)
          throw new AllocationProviderAcceptanceError(
            'ACTIVE_ALLOCATION_EXISTS',
            'An active Allocation already exists for this Service Package.',
            409
          );

        await this.insertAllocation(client, record, true);
        await this.insertCommand(client, {
          scopeKey,
          idempotencyKey,
          requestFingerprint,
          targetType: 'ALLOCATION',
          targetId: record.allocationId,
          commandType: 'ALLOCATE_PROVIDER',
          responseVersion: record.version,
          responseRecord: record,
          actorId: record.allocatedBy,
          createdAt: record.createdAt
        });
        await this.insertAudit(
          client,
          record.workspaceId,
          'ALLOCATION',
          record.allocationId,
          'PROVIDER_ALLOCATED',
          record.version,
          record.allocatedBy,
          record.eligibilityFingerprintSha256,
          record.createdAt
        );
        return record;
      });
    } catch (cause) {
      if (cause instanceof AllocationProviderAcceptanceError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new AllocationProviderAcceptanceError(
          'ACTIVE_ALLOCATION_EXISTS',
          'An active Allocation already exists for this Service Package.',
          409
        );
      throw this.unavailable(cause);
    }
  }

  async findProviderAcceptance(providerAcceptanceId: ProviderAcceptanceId) {
    try {
      const result = await this.query.query(
        'SELECT acceptance_record FROM mgsn_provider_acceptances WHERE provider_acceptance_id=$1',
        [providerAcceptanceId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).acceptance_record as ProviderAcceptanceRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findProviderAcceptanceForAllocation(allocationId: AllocationId) {
    try {
      const result = await this.query.query(
        'SELECT acceptance_record FROM mgsn_provider_acceptances WHERE allocation_id=$1',
        [allocationId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).acceptance_record as ProviderAcceptanceRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async recordProviderResponse(
    record: ProviderAcceptanceRecord,
    currentAllocation: AllocationRecord,
    supersededAllocation: AllocationRecord | undefined,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.lockReplay(client, scopeKey, idempotencyKey, requestFingerprint);
        if (replay) {
          if (
            replay.targetType !== 'PROVIDER_ACCEPTANCE' ||
            !('providerAcceptanceId' in replay.responseRecord)
          )
            throw new AllocationProviderAcceptanceError(
              'PERSISTENCE_UNAVAILABLE',
              'Idempotent Provider Acceptance result is unavailable.',
              503
            );
          return replay.responseRecord;
        }

        const locked = await client.query(
          'SELECT version,status FROM mgsn_allocations WHERE allocation_id=$1 AND is_current=true FOR UPDATE',
          [currentAllocation.allocationId]
        );
        if (
          !locked.rowCount ||
          Number((locked.rows[0] as Row).version) !== currentAllocation.version ||
          String((locked.rows[0] as Row).status) !== 'ACTIVE'
        )
          throw new AllocationProviderAcceptanceError(
            'ALLOCATION_NOT_CURRENT',
            'Allocation is no longer the current active version.',
            409
          );
        const existing = await client.query(
          'SELECT provider_acceptance_id FROM mgsn_provider_acceptances WHERE allocation_id=$1 FOR UPDATE',
          [currentAllocation.allocationId]
        );
        if (existing.rowCount)
          throw new AllocationProviderAcceptanceError(
            'ALLOCATION_NOT_CURRENT',
            'Provider response has already been recorded for this Allocation.',
            409
          );

        await client.query(
          'INSERT INTO mgsn_provider_acceptances(provider_acceptance_id,workspace_id,version,allocation_id,allocation_version,service_package_id,service_package_version,provider_id,provider_workspace_id,provider_actor_id,decision,acknowledgement,response_fingerprint_sha256,acceptance_record,responded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)',
          [
            record.providerAcceptanceId,
            record.workspaceId,
            record.version,
            record.allocation.id,
            record.allocation.version,
            record.servicePackage.id,
            record.servicePackage.version,
            record.providerId,
            record.providerWorkspaceId,
            record.providerActorId,
            record.decision,
            record.acknowledgement,
            record.responseFingerprintSha256,
            JSON.stringify(record),
            record.respondedAt
          ]
        );

        if (supersededAllocation) {
          await client.query(
            'UPDATE mgsn_allocations SET is_current=false WHERE allocation_id=$1 AND version=$2 AND is_current=true',
            [currentAllocation.allocationId, currentAllocation.version]
          );
          await this.insertAllocation(client, supersededAllocation, true);
        }

        await this.insertCommand(client, {
          scopeKey,
          idempotencyKey,
          requestFingerprint,
          targetType: 'PROVIDER_ACCEPTANCE',
          targetId: record.providerAcceptanceId,
          commandType: 'RESPOND_TO_ALLOCATION',
          responseVersion: record.version,
          responseRecord: record,
          actorId: record.providerActorId,
          createdAt: record.respondedAt
        });
        await this.insertAudit(
          client,
          record.workspaceId,
          'PROVIDER_ACCEPTANCE',
          record.providerAcceptanceId,
          record.decision === 'ACCEPTED' ? 'PROVIDER_ACCEPTED' : 'PROVIDER_DECLINED',
          record.version,
          record.providerActorId,
          record.responseFingerprintSha256,
          record.respondedAt
        );
        if (supersededAllocation)
          await this.insertAudit(
            client,
            supersededAllocation.workspaceId,
            'ALLOCATION',
            supersededAllocation.allocationId,
            'ALLOCATION_SUPERSEDED',
            supersededAllocation.version,
            record.providerActorId,
            record.responseFingerprintSha256,
            record.respondedAt
          );
        return record;
      });
    } catch (cause) {
      if (cause instanceof AllocationProviderAcceptanceError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new AllocationProviderAcceptanceError(
          'ALLOCATION_NOT_CURRENT',
          'Provider response has already been recorded for this Allocation.',
          409
        );
      throw this.unavailable(cause);
    }
  }

  private insertAllocation(client: QueryClient, record: AllocationRecord, isCurrent: boolean) {
    return client.query(
      'INSERT INTO mgsn_allocations(allocation_id,version,is_current,workspace_id,service_package_id,service_package_version,service_package_fingerprint_sha256,eligibility_evaluation_id,eligibility_evaluation_version,eligibility_fingerprint_sha256,provider_id,provider_version,provider_supply_capability_id,provider_supply_capability_version,provider_supply_capability_fingerprint_sha256,allocated_by,rationale,status,allocation_record,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21)',
      [
        record.allocationId,
        record.version,
        isCurrent,
        record.workspaceId,
        record.servicePackage.id,
        record.servicePackage.version,
        record.servicePackageFingerprintSha256,
        record.eligibilityEvaluation.id,
        record.eligibilityEvaluation.version,
        record.eligibilityFingerprintSha256,
        record.provider.providerId,
        record.providerVersion,
        record.providerSupplyCapability.id,
        record.providerSupplyCapability.version,
        record.providerSupplyCapabilityFingerprintSha256,
        record.allocatedBy,
        record.rationale,
        record.status,
        JSON.stringify(record),
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  private async lockReplay(
    client: QueryClient,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    const result = await client.query(
      'SELECT request_fingerprint,target_type,target_id,response_version,response_record FROM mgsn_allocation_commands WHERE scope_key=$1 AND idempotency_key=$2 FOR UPDATE',
      [scopeKey, idempotencyKey]
    );
    if (!result.rowCount) return undefined;
    const replay = this.mapReplay(result.rows[0] as Row);
    if (replay.fingerprint !== requestFingerprint)
      throw new AllocationProviderAcceptanceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    return replay;
  }

  private mapReplay(row: Row): AllocationProviderAcceptanceReplay {
    return {
      fingerprint: String(row.request_fingerprint),
      targetType: String(row.target_type) as AllocationProviderAcceptanceReplay['targetType'],
      targetId: String(row.target_id),
      responseVersion: Number(row.response_version),
      responseRecord: row.response_record as AllocationRecord | ProviderAcceptanceRecord
    };
  }

  private insertCommand(
    client: QueryClient,
    value: {
      scopeKey: string;
      idempotencyKey: string;
      requestFingerprint: string;
      targetType: 'ALLOCATION' | 'PROVIDER_ACCEPTANCE';
      targetId: string;
      commandType: 'ALLOCATE_PROVIDER' | 'RESPOND_TO_ALLOCATION';
      responseVersion: number;
      responseRecord: AllocationRecord | ProviderAcceptanceRecord;
      actorId: string;
      createdAt: string;
    }
  ) {
    return client.query(
      'INSERT INTO mgsn_allocation_commands(scope_key,idempotency_key,request_fingerprint,target_type,target_id,command_type,response_version,response_record,actor_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)',
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

  private insertAudit(
    client: QueryClient,
    workspaceId: string,
    targetType: 'ALLOCATION' | 'PROVIDER_ACCEPTANCE',
    targetId: string,
    action:
      'PROVIDER_ALLOCATED' | 'PROVIDER_ACCEPTED' | 'PROVIDER_DECLINED' | 'ALLOCATION_SUPERSEDED',
    recordVersion: number,
    actorId: string,
    sourceFingerprint: string,
    createdAt: string
  ) {
    return client.query(
      'INSERT INTO mgsn_allocation_audit(workspace_id,target_type,target_id,action,record_version,actor_id,source_fingerprint,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        workspaceId,
        targetType,
        targetId,
        action,
        recordVersion,
        actorId,
        sourceFingerprint,
        createdAt
      ]
    );
  }

  private unavailable(cause: unknown) {
    if (cause instanceof AllocationProviderAcceptanceError) return cause;
    return new AllocationProviderAcceptanceError(
      'PERSISTENCE_UNAVAILABLE',
      'MGSN Allocation persistence is unavailable.',
      503,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}
