import type {
  AllocationId,
  AllocationStatus,
  ProviderAcceptanceDecision,
  ProviderAcceptanceId,
  ProviderId,
  ProviderReturnId,
  ProviderReturnStatus,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  ProviderWorkReadModelError,
  type ProviderWorkProjectionSource,
  type ProviderWorkReadRepository
} from './provider-work-read-model.js';

type Row = Record<string, unknown>;

const projectionColumns = `
  provider.provider_id,
  provider.provider_workspace_id::text AS provider_workspace_id,
  allocation.allocation_id,
  allocation.version AS allocation_version,
  allocation.status AS allocation_status,
  allocation.updated_at,
  allocation.workspace_id::text AS originating_workspace_id,
  allocation.service_package_id AS allocation_service_package_id,
  allocation.service_package_version AS allocation_service_package_version,
  allocation.service_package_fingerprint_sha256 AS allocation_service_package_fingerprint_sha256,
  package.service_package_id,
  package.version AS service_package_version,
  package.service_package_fingerprint_sha256,
  package.workspace_id::text AS service_package_workspace_id,
  acceptance.provider_acceptance_id,
  acceptance.version AS provider_acceptance_version,
  acceptance.allocation_id AS acceptance_allocation_id,
  acceptance.service_package_id AS acceptance_service_package_id,
  acceptance.service_package_version AS acceptance_service_package_version,
  acceptance.provider_id AS acceptance_provider_id,
  acceptance.provider_workspace_id::text AS acceptance_provider_workspace_id,
  acceptance.decision AS acceptance_decision,
  acceptance.responded_at AS acceptance_responded_at,
  acceptance.response_fingerprint_sha256 AS acceptance_fingerprint_sha256,
  provider_return.provider_return_id,
  provider_return.version AS provider_return_version,
  provider_return.allocation_id AS return_allocation_id,
  provider_return.service_package_id AS return_service_package_id,
  provider_return.service_package_version AS return_service_package_version,
  provider_return.provider_id AS return_provider_id,
  provider_return.provider_workspace_id::text AS return_provider_workspace_id,
  provider_return.status AS return_status,
  provider_return.submitted_at AS return_submitted_at,
  provider_return.return_fingerprint_sha256`;

const projectionJoins = `
  FROM mgsn_providers provider
  JOIN mgsn_allocations allocation
    ON allocation.provider_id = provider.provider_id
   AND allocation.is_current = true
  LEFT JOIN mgsn_service_packages package
    ON package.service_package_id = allocation.service_package_id
  LEFT JOIN mgsn_provider_acceptances acceptance
    ON acceptance.allocation_id = allocation.allocation_id
  LEFT JOIN mgsn_provider_returns provider_return
    ON provider_return.allocation_id = allocation.allocation_id
   AND provider_return.is_current = true
  WHERE provider.provider_workspace_id = $1`;

export class PostgresProviderWorkReadRepository implements ProviderWorkReadRepository {
  constructor(private readonly query: QueryClient) {}

  async listCurrentProviderWork(
    input: Parameters<ProviderWorkReadRepository['listCurrentProviderWork']>[0]
  ) {
    try {
      const cursorClause = input.cursor
        ? ` AND (
              allocation.updated_at < $2::timestamptz
              OR (allocation.updated_at = $2::timestamptz AND allocation.allocation_id > $3)
            )`
        : '';
      const values = input.cursor
        ? [
            input.providerWorkspaceId,
            input.cursor.updatedAt,
            input.cursor.allocationId,
            input.limit
          ]
        : [input.providerWorkspaceId, input.limit];
      const limitParameter = input.cursor ? '$4' : '$2';
      const result = await this.query.query(
        `SELECT ${projectionColumns}
           ${projectionJoins}
           ${cursorClause}
          ORDER BY allocation.updated_at DESC, allocation.allocation_id
          LIMIT ${limitParameter}`,
        values
      );
      return result.rows.map((row) => this.map(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findCurrentProviderWork(
    input: Parameters<ProviderWorkReadRepository['findCurrentProviderWork']>[0]
  ) {
    try {
      const result = await this.query.query(
        `SELECT ${projectionColumns}
           ${projectionJoins}
            AND allocation.allocation_id = $2
          LIMIT 1`,
        [input.providerWorkspaceId, input.allocationId]
      );
      return result.rowCount ? this.map(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private map(row: Row): ProviderWorkProjectionSource {
    return {
      providerId: String(row.provider_id) as ProviderId,
      providerWorkspaceId: String(row.provider_workspace_id),
      allocationId: String(row.allocation_id) as AllocationId,
      allocationVersion: Number(row.allocation_version),
      allocationStatus: String(row.allocation_status) as AllocationStatus,
      allocationUpdatedAt: this.timestamp(row.updated_at),
      originatingWorkspaceId: String(row.originating_workspace_id),
      allocationServicePackageId: String(row.allocation_service_package_id) as ServicePackageId,
      allocationServicePackageVersion: Number(row.allocation_service_package_version),
      allocationServicePackageFingerprintSha256: String(
        row.allocation_service_package_fingerprint_sha256
      ),
      ...(row.service_package_id === null || row.service_package_id === undefined
        ? {}
        : {
            servicePackageId: this.text(row.service_package_id) as ServicePackageId,
            servicePackageVersion: Number(row.service_package_version),
            servicePackageFingerprintSha256: String(row.service_package_fingerprint_sha256),
            servicePackageWorkspaceId: String(row.service_package_workspace_id)
          }),
      ...(row.provider_acceptance_id === null || row.provider_acceptance_id === undefined
        ? {}
        : {
            providerAcceptanceId: this.text(row.provider_acceptance_id) as ProviderAcceptanceId,
            providerAcceptanceVersion: Number(row.provider_acceptance_version),
            acceptanceAllocationId: String(row.acceptance_allocation_id) as AllocationId,
            acceptanceServicePackageId: String(
              row.acceptance_service_package_id
            ) as ServicePackageId,
            acceptanceServicePackageVersion: Number(row.acceptance_service_package_version),
            acceptanceProviderId: String(row.acceptance_provider_id) as ProviderId,
            acceptanceProviderWorkspaceId: String(row.acceptance_provider_workspace_id),
            acceptanceDecision: String(row.acceptance_decision) as ProviderAcceptanceDecision,
            acceptanceRespondedAt: this.timestamp(row.acceptance_responded_at),
            acceptanceFingerprintSha256: String(row.acceptance_fingerprint_sha256)
          }),
      ...(row.provider_return_id === null || row.provider_return_id === undefined
        ? {}
        : {
            providerReturnId: this.text(row.provider_return_id) as ProviderReturnId,
            providerReturnVersion: Number(row.provider_return_version),
            returnAllocationId: String(row.return_allocation_id) as AllocationId,
            returnServicePackageId: String(row.return_service_package_id) as ServicePackageId,
            returnServicePackageVersion: Number(row.return_service_package_version),
            returnProviderId: String(row.return_provider_id) as ProviderId,
            returnProviderWorkspaceId: String(row.return_provider_workspace_id),
            returnStatus: String(row.return_status) as ProviderReturnStatus,
            returnSubmittedAt: this.timestamp(row.return_submitted_at),
            returnFingerprintSha256: String(row.return_fingerprint_sha256)
          })
    };
  }

  private timestamp(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private unavailable(cause: unknown) {
    if (cause instanceof ProviderWorkReadModelError) return cause;
    return new ProviderWorkReadModelError(
      'PERSISTENCE_UNAVAILABLE',
      'Provider work PostgreSQL projection is unavailable.',
      503,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}
