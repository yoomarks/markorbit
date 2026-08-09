import type { AllocationId, ProviderReturnId } from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  ProviderReturnError,
  type ProviderReturnRecord,
  type ProviderReturnReplay,
  type ProviderReturnRepository
} from './provider-return.js';

type Row = Record<string, unknown>;

export interface ProviderReturnTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

export class PostgresProviderReturnRepository implements ProviderReturnRepository {
  constructor(
    private readonly database: ProviderReturnTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findReplay(scopeKey: string, idempotencyKey: string) {
    try {
      const result = await this.query.query(
        'SELECT request_fingerprint,provider_return_id,response_version,response_record FROM mgsn_provider_return_commands WHERE scope_key=$1 AND idempotency_key=$2',
        [scopeKey, idempotencyKey]
      );
      return result.rowCount ? this.mapReplay(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findProviderReturn(providerReturnId: ProviderReturnId, version?: number) {
    try {
      const result = await this.query.query(
        version === undefined
          ? 'SELECT return_record FROM mgsn_provider_returns WHERE provider_return_id=$1 AND is_current=true'
          : 'SELECT return_record FROM mgsn_provider_returns WHERE provider_return_id=$1 AND version=$2',
        version === undefined ? [providerReturnId] : [providerReturnId, version]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).return_record as ProviderReturnRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findCurrentProviderReturnForAllocation(allocationId: AllocationId) {
    try {
      const result = await this.query.query(
        "SELECT return_record FROM mgsn_provider_returns WHERE allocation_id=$1 AND is_current=true AND status='CURRENT'",
        [allocationId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).return_record as ProviderReturnRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async saveProviderReturn(
    record: ProviderReturnRecord,
    expectedSuperseded: ProviderReturnRecord | undefined,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await client.query(
          'SELECT request_fingerprint,provider_return_id,response_version,response_record FROM mgsn_provider_return_commands WHERE scope_key=$1 AND idempotency_key=$2 FOR UPDATE',
          [scopeKey, idempotencyKey]
        );
        if (replay.rowCount) {
          const value = this.mapReplay(replay.rows[0] as Row);
          if (value.fingerprint !== requestFingerprint)
            throw new ProviderReturnError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different Provider Return payload.',
              409
            );
          return value.responseRecord;
        }

        await client.query(
          'SELECT allocation_id FROM mgsn_allocations WHERE allocation_id=$1 AND version=$2 FOR UPDATE',
          [record.allocation.id, record.allocation.version]
        );
        const current = await client.query(
          'SELECT provider_return_id,version FROM mgsn_provider_returns WHERE allocation_id=$1 AND is_current=true FOR UPDATE',
          [record.allocation.id]
        );
        if (expectedSuperseded) {
          if (
            !current.rowCount ||
            String((current.rows[0] as Row).provider_return_id) !== expectedSuperseded.providerReturnId ||
            Number((current.rows[0] as Row).version) !== expectedSuperseded.version
          )
            throw new ProviderReturnError(
              'RETURN_SUPERSEDED',
              'Provider Return changed before the correction could be committed.',
              409
            );
          await client.query(
            'UPDATE mgsn_provider_returns SET is_current=false WHERE provider_return_id=$1 AND version=$2 AND is_current=true',
            [expectedSuperseded.providerReturnId, expectedSuperseded.version]
          );
        } else if (current.rowCount) {
          throw new ProviderReturnError(
            'VERSION_CONFLICT',
            'A current Provider Return already exists for this Allocation.',
            409
          );
        }

        await client.query(
          `INSERT INTO mgsn_provider_returns(
             provider_return_id,version,is_current,workspace_id,service_package_id,service_package_version,
             allocation_id,allocation_version,provider_acceptance_id,provider_acceptance_version,
             provider_id,provider_workspace_id,provider_actor_id,work_status_claim,return_fingerprint_sha256,
             status,supersedes_provider_return_id,supersedes_version,return_record,submitted_at
           ) VALUES($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19)`,
          [
            record.providerReturnId,
            record.version,
            record.workspaceId,
            record.servicePackage.id,
            record.servicePackage.version,
            record.allocation.id,
            record.allocation.version,
            record.providerAcceptance.id,
            record.providerAcceptance.version,
            record.providerId,
            record.providerWorkspaceId,
            record.providerActorId,
            record.workStatusClaim,
            record.returnFingerprintSha256,
            record.status,
            record.supersedes?.id ?? null,
            record.supersedes?.version ?? null,
            JSON.stringify(record),
            record.submittedAt
          ]
        );
        await client.query(
          `INSERT INTO mgsn_provider_return_commands(
             scope_key,idempotency_key,request_fingerprint,provider_return_id,response_version,response_record,provider_actor_id,created_at
           ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
          [
            scopeKey,
            idempotencyKey,
            requestFingerprint,
            record.providerReturnId,
            record.version,
            JSON.stringify(record),
            record.providerActorId,
            record.submittedAt
          ]
        );
        await client.query(
          `INSERT INTO mgsn_provider_return_audit(
             workspace_id,provider_return_id,record_version,action,provider_actor_id,return_fingerprint_sha256,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            record.workspaceId,
            record.providerReturnId,
            record.version,
            expectedSuperseded ? 'PROVIDER_RETURN_CORRECTED' : 'PROVIDER_RETURN_CREATED',
            record.providerActorId,
            record.returnFingerprintSha256,
            record.submittedAt
          ]
        );
        return record;
      });
    } catch (cause) {
      if (cause instanceof ProviderReturnError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new ProviderReturnError(
          expectedSuperseded ? 'RETURN_SUPERSEDED' : 'VERSION_CONFLICT',
          'Provider Return changed concurrently.',
          409
        );
      throw this.unavailable(cause);
    }
  }

  private mapReplay(row: Row): ProviderReturnReplay {
    return {
      fingerprint: String(row.request_fingerprint),
      providerReturnId: String(row.provider_return_id) as ProviderReturnId,
      responseVersion: Number(row.response_version),
      responseRecord: row.response_record as ProviderReturnRecord
    };
  }

  private unavailable(cause: unknown) {
    if (cause instanceof ProviderReturnError) return cause;
    return new ProviderReturnError(
      'PERSISTENCE_UNAVAILABLE',
      'MGSN Provider Return persistence is unavailable.',
      503,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}
