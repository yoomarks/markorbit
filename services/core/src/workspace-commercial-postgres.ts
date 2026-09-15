import type { ManagedDatabase } from '@markorbit/persistence';
import type {
  AssignableEntitlementGrantV1,
  CommercialAgreementV1,
  CommercialOfferVersionV1,
  EntitlementGrantAssignmentV1,
  EntitlementGrantV1,
  RatePolicyKindV1,
  RatePolicyVersionV1,
  WorkspaceProductInstallationV1
} from '@markorbit/contracts/workspace-commercial';
import {
  WorkspaceCommercialError,
  type WorkspaceCommercialRepositoryV1
} from './workspace-commercial.js';

type RecordType =
  | 'PRODUCT_INSTALLATION'
  | 'OFFER'
  | 'AGREEMENT'
  | 'ENTITLEMENT_GRANT'
  | 'ASSIGNABLE_GRANT'
  | 'GRANT_ASSIGNMENT'
  | 'RATE_POLICY';
type Row = { record_json: unknown };

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function fail(error: unknown): never {
  if (error instanceof WorkspaceCommercialError) throw error;
  if (pgCode(error) === '23505')
    throw new WorkspaceCommercialError('CONFLICT', 'Commercial record version already exists.');
  throw new WorkspaceCommercialError(
    'CONFLICT',
    'Workspace commercial persistence is unavailable.'
  );
}

function stored<T>(value: unknown): T {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { schemaVersion?: unknown }).schemaVersion !== 1
  )
    throw new WorkspaceCommercialError('CONFLICT', 'Stored commercial record is invalid.');
  return structuredClone(value) as T;
}

export class PostgresWorkspaceCommercialRepositoryV1 implements WorkspaceCommercialRepositoryV1 {
  constructor(private readonly database: ManagedDatabase) {}

  private async append(
    recordType: RecordType,
    aggregateId: string,
    version: number,
    value: unknown,
    dimensions: Readonly<{
      workspaceId?: string;
      userId?: string;
      commercialKind?: string;
      effectiveFrom?: string;
    }> = {}
  ): Promise<void> {
    try {
      await this.database.getPool().query(
        `INSERT INTO core_workspace_commercial_records(
           record_type,aggregate_id,version,workspace_id,user_id,commercial_kind,
           effective_from,record_json,recorded_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [
          recordType,
          aggregateId,
          version,
          dimensions.workspaceId ?? null,
          dimensions.userId ?? null,
          dimensions.commercialKind ?? null,
          dimensions.effectiveFrom ?? null,
          JSON.stringify(value),
          (value as { recordedAt: string }).recordedAt
        ]
      );
    } catch (error) {
      fail(error);
    }
  }

  private async list<T>(
    recordType: RecordType,
    clause = '',
    values: readonly unknown[] = []
  ): Promise<readonly T[]> {
    try {
      const result = await this.database.getPool().query<Row>(
        `SELECT record_json FROM core_workspace_commercial_records
          WHERE record_type=$1 ${clause} ORDER BY aggregate_id,version`,
        [recordType, ...values]
      );
      return result.rows.map((row) => stored<T>(row.record_json));
    } catch (error) {
      fail(error);
    }
  }

  async appendInstallation(value: WorkspaceProductInstallationV1) {
    await this.append('PRODUCT_INSTALLATION', value.installationId, value.version, value, {
      workspaceId: value.workspaceId,
      commercialKind: value.productKey,
      effectiveFrom: value.effectiveAt
    });
  }
  async listInstallations(workspaceId: string) {
    return this.list<WorkspaceProductInstallationV1>(
      'PRODUCT_INSTALLATION',
      'AND workspace_id=$2',
      [workspaceId]
    );
  }
  async appendOffer(value: CommercialOfferVersionV1) {
    await this.append('OFFER', value.offerId, value.version, value, {
      commercialKind: value.productKey,
      effectiveFrom: value.effectiveFrom
    });
  }
  async getOffer(offerId: string, version: number) {
    return (
      await this.list<CommercialOfferVersionV1>('OFFER', 'AND aggregate_id=$2 AND version=$3', [
        offerId,
        version
      ])
    )[0];
  }
  async appendAgreement(value: CommercialAgreementV1) {
    await this.append('AGREEMENT', value.agreementId, value.version, value, {
      ...(value.subject.scope === 'WORKSPACE'
        ? { workspaceId: value.subject.workspaceId }
        : { userId: value.subject.userId }),
      effectiveFrom: value.effectiveFrom
    });
  }
  async listAgreementVersions(agreementId: string) {
    return this.list<CommercialAgreementV1>('AGREEMENT', 'AND aggregate_id=$2', [agreementId]);
  }
  async appendGrant(value: EntitlementGrantV1) {
    await this.append('ENTITLEMENT_GRANT', value.grantId, value.version, value, {
      ...(value.subject.scope === 'WORKSPACE'
        ? { workspaceId: value.subject.workspaceId }
        : { userId: value.subject.userId }),
      commercialKind: value.entitlement.key,
      effectiveFrom: value.effectiveFrom
    });
  }
  async listGrants() {
    return this.list<EntitlementGrantV1>('ENTITLEMENT_GRANT');
  }
  async appendAssignableGrant(value: AssignableEntitlementGrantV1) {
    await this.append('ASSIGNABLE_GRANT', value.assignableGrantId, value.version, value, {
      workspaceId: value.sponsorWorkspaceId,
      commercialKind: value.benefitKey,
      effectiveFrom: value.effectiveFrom
    });
  }
  async listAssignableGrantVersions(assignableGrantId: string) {
    return this.list<AssignableEntitlementGrantV1>('ASSIGNABLE_GRANT', 'AND aggregate_id=$2', [
      assignableGrantId
    ]);
  }
  async appendAssignment(value: EntitlementGrantAssignmentV1) {
    await this.append('GRANT_ASSIGNMENT', value.assignmentId, value.version, value, {
      workspaceId: value.workspaceId,
      userId: value.userId,
      commercialKind: value.assignableGrantId,
      effectiveFrom: value.effectiveFrom
    });
  }
  async listAssignments(assignableGrantId?: string) {
    return this.list<EntitlementGrantAssignmentV1>(
      'GRANT_ASSIGNMENT',
      assignableGrantId ? 'AND commercial_kind=$2' : '',
      assignableGrantId ? [assignableGrantId] : []
    );
  }
  async appendRatePolicy(value: RatePolicyVersionV1) {
    await this.append('RATE_POLICY', value.policyId, value.version, value, {
      commercialKind: value.kind,
      effectiveFrom: value.effectiveFrom
    });
  }
  async listRatePolicies(kind: RatePolicyKindV1) {
    return this.list<RatePolicyVersionV1>('RATE_POLICY', 'AND commercial_kind=$2', [kind]);
  }
}
