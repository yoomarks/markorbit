import type {
  EligibilityEvaluationId,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  ServicePackageEligibilityError,
  type EligibilityEvaluationRecord,
  type ServicePackageEligibilityReplay,
  type ServicePackageEligibilityRepository,
  type ServicePackageRecord
} from './service-package-eligibility.js';

type Row = Record<string, unknown>;

export interface ServicePackageEligibilityTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

export class PostgresServicePackageEligibilityRepository implements ServicePackageEligibilityRepository {
  constructor(
    private readonly database: ServicePackageEligibilityTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findReplay(scopeKey: string, idempotencyKey: string) {
    try {
      const result = await this.query.query(
        'SELECT request_fingerprint,target_type,target_id,response_version,response_record FROM mgsn_service_package_commands WHERE scope_key=$1 AND idempotency_key=$2',
        [scopeKey, idempotencyKey]
      );
      if (!result.rowCount) return undefined;
      return this.mapReplay(result.rows[0] as Row);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findServicePackage(servicePackageId: ServicePackageId, version?: number) {
    try {
      const result = await this.query.query(
        version === undefined
          ? 'SELECT service_package_record FROM mgsn_service_packages WHERE service_package_id=$1'
          : 'SELECT service_package_record FROM mgsn_service_packages WHERE service_package_id=$1 AND version=$2',
        version === undefined ? [servicePackageId] : [servicePackageId, version]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).service_package_record as ServicePackageRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async createServicePackage(
    record: ServicePackageRecord,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.lockReplay(client, scopeKey, idempotencyKey, requestFingerprint);
        if (replay) {
          if (
            replay.targetType !== 'SERVICE_PACKAGE' ||
            !('servicePackageId' in replay.responseRecord)
          )
            throw new ServicePackageEligibilityError(
              'PERSISTENCE_UNAVAILABLE',
              'Idempotent Service Package result is unavailable.',
              503
            );
          return replay.responseRecord;
        }
        await client.query(
          'INSERT INTO mgsn_service_packages(service_package_id,workspace_id,version,status,execution_source_fingerprint_sha256,service_package_fingerprint_sha256,jurisdiction,service_type,source_record,service_package_record,created_by,updated_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14)',
          [
            record.servicePackageId,
            record.workspaceId,
            record.version,
            record.status,
            record.source.sourceFingerprintSha256,
            record.servicePackageFingerprintSha256,
            record.jurisdiction,
            record.serviceType,
            JSON.stringify(record.source),
            JSON.stringify(record),
            record.createdBy,
            record.updatedBy,
            record.createdAt,
            record.updatedAt
          ]
        );
        await this.insertCommand(client, {
          scopeKey,
          idempotencyKey,
          requestFingerprint,
          targetType: 'SERVICE_PACKAGE',
          targetId: record.servicePackageId,
          commandType: 'SERVICE_PACKAGE_ADMIT',
          responseVersion: record.version,
          responseRecord: record,
          actorId: record.createdBy,
          createdAt: record.createdAt
        });
        await this.insertAudit(
          client,
          record.workspaceId,
          'SERVICE_PACKAGE',
          record.servicePackageId,
          'SERVICE_PACKAGE_ADMITTED',
          record.version,
          record.createdBy,
          record.servicePackageFingerprintSha256,
          record.createdAt
        );
        return record;
      });
    } catch (cause) {
      if (cause instanceof ServicePackageEligibilityError) throw cause;
      if ((cause as { code?: string }).code === '23505')
        throw new ServicePackageEligibilityError(
          'VERSION_CONFLICT',
          'This exact governed Execution source has already been admitted.',
          409
        );
      throw this.unavailable(cause);
    }
  }

  async findEligibilityEvaluation(eligibilityEvaluationId: EligibilityEvaluationId) {
    try {
      const result = await this.query.query(
        'SELECT evaluation_record FROM mgsn_eligibility_evaluations WHERE eligibility_evaluation_id=$1',
        [eligibilityEvaluationId]
      );
      return result.rowCount
        ? ((result.rows[0] as Row).evaluation_record as EligibilityEvaluationRecord)
        : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async listEligibilityEvaluations(servicePackageId: ServicePackageId, limit: number) {
    try {
      const result = await this.query.query(
        'SELECT evaluation_record FROM mgsn_eligibility_evaluations WHERE service_package_id=$1 ORDER BY evaluated_at DESC,eligibility_evaluation_id LIMIT $2',
        [servicePackageId, limit]
      );
      return result.rows.map(
        (row) => (row as Row).evaluation_record as EligibilityEvaluationRecord
      );
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async createEligibilityEvaluation(
    record: EligibilityEvaluationRecord,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await this.lockReplay(client, scopeKey, idempotencyKey, requestFingerprint);
        if (replay) {
          if (
            replay.targetType !== 'ELIGIBILITY_EVALUATION' ||
            !('eligibilityEvaluationId' in replay.responseRecord)
          )
            throw new ServicePackageEligibilityError(
              'PERSISTENCE_UNAVAILABLE',
              'Idempotent Eligibility result is unavailable.',
              503
            );
          return replay.responseRecord;
        }
        await client.query(
          'INSERT INTO mgsn_eligibility_evaluations(eligibility_evaluation_id,workspace_id,version,service_package_id,service_package_version,service_package_fingerprint_sha256,provider_id,provider_version,provider_supply_capability_id,provider_supply_capability_version,provider_supply_capability_fingerprint_sha256,policy_version,outcome,checks,deterministic_fingerprint_sha256,evaluation_record,evaluated_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16::jsonb,$17,$18)',
          [
            record.eligibilityEvaluationId,
            record.workspaceId,
            record.version,
            record.servicePackage.id,
            record.servicePackage.version,
            record.servicePackageFingerprintSha256,
            record.provider.providerId,
            record.providerVersion,
            record.providerSupplyCapability.id,
            record.providerSupplyCapability.version,
            record.providerSupplyCapabilityFingerprintSha256,
            record.policyVersion,
            record.outcome,
            JSON.stringify(record.checks),
            record.deterministicFingerprintSha256,
            JSON.stringify(record),
            record.evaluatedAt,
            record.createdBy
          ]
        );
        await this.insertCommand(client, {
          scopeKey,
          idempotencyKey,
          requestFingerprint,
          targetType: 'ELIGIBILITY_EVALUATION',
          targetId: record.eligibilityEvaluationId,
          commandType: 'ELIGIBILITY_EVALUATE',
          responseVersion: record.version,
          responseRecord: record,
          actorId: record.createdBy,
          createdAt: record.evaluatedAt
        });
        await this.insertAudit(
          client,
          record.workspaceId,
          'ELIGIBILITY_EVALUATION',
          record.eligibilityEvaluationId,
          `ELIGIBILITY_${record.outcome}`,
          record.version,
          record.createdBy,
          record.deterministicFingerprintSha256,
          record.evaluatedAt
        );
        return record;
      });
    } catch (cause) {
      if (cause instanceof ServicePackageEligibilityError) throw cause;
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
      'SELECT request_fingerprint,target_type,target_id,response_version,response_record FROM mgsn_service_package_commands WHERE scope_key=$1 AND idempotency_key=$2 FOR UPDATE',
      [scopeKey, idempotencyKey]
    );
    if (!result.rowCount) return undefined;
    const replay = this.mapReplay(result.rows[0] as Row);
    if (replay.fingerprint !== requestFingerprint)
      throw new ServicePackageEligibilityError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    return replay;
  }

  private mapReplay(row: Row): ServicePackageEligibilityReplay {
    return {
      fingerprint: String(row.request_fingerprint),
      targetType: String(row.target_type) as ServicePackageEligibilityReplay['targetType'],
      targetId: String(row.target_id),
      responseVersion: Number(row.response_version),
      responseRecord: row.response_record as ServicePackageRecord | EligibilityEvaluationRecord
    };
  }

  private insertCommand(
    client: QueryClient,
    value: {
      scopeKey: string;
      idempotencyKey: string;
      requestFingerprint: string;
      targetType: 'SERVICE_PACKAGE' | 'ELIGIBILITY_EVALUATION';
      targetId: string;
      commandType: 'SERVICE_PACKAGE_ADMIT' | 'ELIGIBILITY_EVALUATE';
      responseVersion: number;
      responseRecord: ServicePackageRecord | EligibilityEvaluationRecord;
      actorId: string;
      createdAt: string;
    }
  ) {
    return client.query(
      'INSERT INTO mgsn_service_package_commands(scope_key,idempotency_key,request_fingerprint,target_type,target_id,command_type,response_version,response_record,actor_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)',
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
    targetType: 'SERVICE_PACKAGE' | 'ELIGIBILITY_EVALUATION',
    targetId: string,
    action: string,
    recordVersion: number,
    actorId: string,
    sourceFingerprint: string,
    createdAt: string
  ) {
    return client.query(
      'INSERT INTO mgsn_service_package_audit(workspace_id,target_type,target_id,action,record_version,actor_id,source_fingerprint,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
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
    if (cause instanceof ServicePackageEligibilityError) return cause;
    return new ServicePackageEligibilityError(
      'PERSISTENCE_UNAVAILABLE',
      'MGSN Service Package persistence is unavailable.',
      503,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}
