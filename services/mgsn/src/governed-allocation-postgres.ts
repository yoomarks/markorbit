import type { QueryClient } from '@markorbit/persistence';
import { AllocationProviderAcceptanceError } from './allocation-provider-acceptance.js';
import {
  GovernedAllocationError,
  type GovernedAllocationAdmissionLineageRecord,
  type GovernedAllocationReplay,
  type GovernedAllocationRepository,
  type GovernedAllocationResult
} from './governed-allocation.js';

export interface GovernedAllocationTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

type Row = Record<string, unknown>;

export class PostgresGovernedAllocationRepository implements GovernedAllocationRepository {
  constructor(
    private readonly database: GovernedAllocationTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findReplay(scopeKey: string, idempotencyKey: string): Promise<GovernedAllocationReplay | undefined> {
    try {
      const replay = await this.query.query(
        `SELECT request_fingerprint_sha256,allocation_id,allocation_version,
                allocation_admission_lineage_id,lineage_version
           FROM mgsn_allocation_admission_lineage_replays
          WHERE scope_key=$1 AND idempotency_key=$2`,
        [scopeKey, idempotencyKey]
      );
      if (!replay.rowCount) return undefined;
      const row = replay.rows[0] as Row;
      return {
        requestFingerprintSha256: String(row.request_fingerprint_sha256),
        result: await this.resultFor(
          this.query,
          String(row.allocation_id),
          Number(row.allocation_version),
          String(row.allocation_admission_lineage_id),
          Number(row.lineage_version),
          true
        )
      };
    } catch (cause) {
      if (cause instanceof GovernedAllocationError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async findLineage(allocationId: string, allocationVersion?: number) {
    try {
      const result = await this.query.query(
        allocationVersion === undefined
          ? `SELECT * FROM mgsn_allocation_admission_lineages
              WHERE allocation_id=$1
              ORDER BY allocation_version DESC LIMIT 1`
          : `SELECT * FROM mgsn_allocation_admission_lineages
              WHERE allocation_id=$1 AND allocation_version=$2`,
        allocationVersion === undefined ? [allocationId] : [allocationId, allocationVersion]
      );
      return result.rowCount ? this.mapLineage(result.rows[0] as Row) : undefined;
    } catch (cause) {
      if (cause instanceof GovernedAllocationError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async commit(input: Parameters<GovernedAllocationRepository['commit']>[0]) {
    try {
      return await this.database.transact(async (client) => {
        const replay = await client.query(
          `SELECT request_fingerprint_sha256,allocation_id,allocation_version,
                  allocation_admission_lineage_id,lineage_version
             FROM mgsn_allocation_admission_lineage_replays
            WHERE scope_key=$1 AND idempotency_key=$2 FOR UPDATE`,
          [input.lineageScopeKey, input.idempotencyKey]
        );
        if (replay.rowCount) {
          const row = replay.rows[0] as Row;
          if (String(row.request_fingerprint_sha256) !== input.requestFingerprintSha256) {
            throw new GovernedAllocationError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key is already bound to different Selection/Handoff lineage.',
              409
            );
          }
          return this.resultFor(
            client,
            String(row.allocation_id),
            Number(row.allocation_version),
            String(row.allocation_admission_lineage_id),
            Number(row.lineage_version),
            true
          );
        }

        const legacyReplay = await client.query(
          `SELECT request_fingerprint,target_type,target_id,response_version,response_record
             FROM mgsn_allocation_commands
            WHERE scope_key=$1 AND idempotency_key=$2 FOR UPDATE`,
          [input.allocationScopeKey, input.idempotencyKey]
        );
        if (legacyReplay.rowCount) {
          throw new GovernedAllocationError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key is already bound to another Allocation command.',
            409
          );
        }

        await client.query(
          'SELECT service_package_id FROM mgsn_service_packages WHERE service_package_id=$1 FOR UPDATE',
          [input.allocation.servicePackage.id]
        );
        const active = await client.query(
          `SELECT allocation_id FROM mgsn_allocations
            WHERE service_package_id=$1 AND is_current=true AND status='ACTIVE' FOR UPDATE`,
          [input.allocation.servicePackage.id]
        );
        if (active.rowCount) {
          throw new AllocationProviderAcceptanceError(
            'ACTIVE_ALLOCATION_EXISTS',
            'An active Allocation already exists for this Service Package.',
            409
          );
        }

        await this.insertAllocation(client, input.allocation);
        await this.insertLineage(client, input.lineage);
        await client.query(
          `INSERT INTO mgsn_allocation_commands(
             scope_key,idempotency_key,request_fingerprint,target_type,target_id,command_type,
             response_version,response_record,actor_id,created_at
           ) VALUES($1,$2,$3,'ALLOCATION',$4,'ALLOCATE_PROVIDER',$5,$6::jsonb,$7,$8)`,
          [
            input.allocationScopeKey,
            input.idempotencyKey,
            input.requestFingerprintSha256,
            input.allocation.allocationId,
            input.allocation.version,
            JSON.stringify(input.allocation),
            input.allocation.allocatedBy,
            input.allocation.createdAt
          ]
        );
        await client.query(
          `INSERT INTO mgsn_allocation_audit(
             workspace_id,target_type,target_id,action,record_version,actor_id,source_fingerprint,created_at
           ) VALUES($1,'ALLOCATION',$2,'PROVIDER_ALLOCATED',$3,$4,$5,$6)`,
          [
            input.allocation.workspaceId,
            input.allocation.allocationId,
            input.allocation.version,
            input.allocation.allocatedBy,
            input.allocation.eligibilityFingerprintSha256,
            input.allocation.createdAt
          ]
        );
        await client.query(
          `INSERT INTO mgsn_allocation_admission_lineage_replays(
             scope_key,idempotency_key,request_fingerprint_sha256,allocation_id,allocation_version,
             allocation_admission_lineage_id,lineage_version,lineage_fingerprint_sha256,
             correlation_id,created_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            input.lineageScopeKey,
            input.idempotencyKey,
            input.requestFingerprintSha256,
            input.allocation.allocationId,
            input.allocation.version,
            input.lineage.allocationAdmissionLineageId,
            input.lineage.version,
            input.lineage.lineageFingerprintSha256,
            input.lineage.correlationId,
            input.lineage.createdAt
          ]
        );
        await client.query(
          `INSERT INTO mgsn_allocation_admission_lineage_audit(
             originating_workspace_id,allocation_id,allocation_version,
             allocation_admission_lineage_id,lineage_version,action,actor_id,
             selection_validation_fingerprint_sha256,handoff_binding_state,
             handoff_validation_fingerprint_sha256,lineage_fingerprint_sha256,
             correlation_id,created_at
           ) VALUES($1,$2,$3,$4,$5,'GOVERNED_ALLOCATION_LINEAGE_BOUND',$6,$7,$8,$9,$10,$11,$12)`,
          [
            input.lineage.originatingWorkspaceId,
            input.allocation.allocationId,
            input.allocation.version,
            input.lineage.allocationAdmissionLineageId,
            input.lineage.version,
            input.allocation.allocatedBy,
            input.lineage.selection.validationFingerprintSha256,
            this.bindingState(input.lineage),
            input.lineage.handoff.mode === 'EXACT'
              ? input.lineage.handoff.validationFingerprintSha256
              : null,
            input.lineage.lineageFingerprintSha256,
            input.lineage.correlationId,
            input.lineage.createdAt
          ]
        );
        return undefined;
      });
    } catch (cause) {
      if (cause instanceof GovernedAllocationError || cause instanceof AllocationProviderAcceptanceError)
        throw cause;
      if ((cause as { code?: string }).code === '23505') {
        throw new GovernedAllocationError(
          'IDEMPOTENCY_CONFLICT',
          'Governed Allocation encountered a conflicting durable binding.',
          409
        );
      }
      throw this.unavailable(cause);
    }
  }

  private insertAllocation(client: QueryClient, record: Parameters<GovernedAllocationRepository['commit']>[0]['allocation']) {
    return client.query(
      `INSERT INTO mgsn_allocations(
         allocation_id,version,is_current,workspace_id,service_package_id,service_package_version,
         service_package_fingerprint_sha256,eligibility_evaluation_id,eligibility_evaluation_version,
         eligibility_fingerprint_sha256,provider_id,provider_version,provider_supply_capability_id,
         provider_supply_capability_version,provider_supply_capability_fingerprint_sha256,allocated_by,
         rationale,status,allocation_record,created_at,updated_at
       ) VALUES($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20)`,
      [
        record.allocationId,
        record.version,
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

  private insertLineage(client: QueryClient, lineage: GovernedAllocationAdmissionLineageRecord) {
    const exact = lineage.handoff.mode === 'EXACT' ? lineage.handoff : undefined;
    return client.query(
      `INSERT INTO mgsn_allocation_admission_lineages(
         allocation_admission_lineage_id,version,allocation_id,allocation_version,originating_workspace_id,
         service_package_id,service_package_version,service_package_fingerprint_sha256,
         provider_id,provider_workspace_id,provider_supply_capability_id,provider_supply_capability_version,
         provider_supply_capability_fingerprint_sha256,provider_selection_id,selection_version,
         selection_scope_version,selection_scope_fingerprint_sha256,selection_validation_purpose,
         selection_validation_decision,selection_validation_currently_usable,selection_validation_evaluated_at,
         selection_validation_policy_version,selection_validation_checked_authority_references,
         selection_validation_fingerprint_sha256,selection_validation_does_not_authorize_downstream_action,
         direct_executor_established,direct_executor_provider_id,direct_executor_provider_workspace_id,
         direct_executor_authority_reference,direct_executor_authority_version,direct_executor_checked_at,
         direct_executor_validation_fingerprint_sha256,current_authority_revalidation_required_before_owner_commit,
         handoff_binding_state,controlled_handoff_id,controlled_handoff_version,
         controlled_handoff_envelope_fingerprint_sha256,handoff_purpose_fingerprint_sha256,
         handoff_projection_fingerprint_sha256,handoff_source_set_fingerprint_sha256,handoff_validation_purpose,
         handoff_validation_decision,handoff_validation_currently_usable,
         handoff_validation_current_exact_disclosure_permitted,handoff_validation_evaluated_at,
         handoff_validation_policy_version,handoff_validation_checked_authority_references,
         handoff_validation_fingerprint_sha256,handoff_validation_is_not_bearer_capability,
         handoff_validation_does_not_authorize_downstream_action,lineage_fingerprint_sha256,correlation_id,created_at,
         contains_incoming_field_values,contains_bearer_secrets,contains_raw_customer_data,
         contains_raw_evidence_artifacts,contains_end_client_relationship_information,contains_pricing_margin_or_profit,
         provider_acceptance_authorized,provider_contact_authorized,professional_appointment_created,
         protected_action_released,filing_authorized,filing_submitted,payment_authorized,payment_created,
         official_truth_created,matter_completed
       ) VALUES(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24,$25,
         $26,$27,$28,$29,$30::jsonb,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47::jsonb,
         $48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59,$60,$61,$62,$63,$64,$65,$66,$67,$68,$69,$70
       )`,
      [
        lineage.allocationAdmissionLineageId,
        lineage.version,
        lineage.allocation.id,
        lineage.allocation.version,
        lineage.originatingWorkspaceId,
        lineage.servicePackage.id,
        lineage.servicePackage.version,
        lineage.servicePackage.fingerprintSha256,
        lineage.provider.providerId,
        lineage.provider.providerWorkspaceId,
        lineage.providerSupplyCapability.id,
        lineage.providerSupplyCapability.version,
        lineage.providerSupplyCapability.fingerprintSha256,
        lineage.selection.reference.providerSelectionId,
        lineage.selection.reference.version,
        lineage.selection.reference.scopeVersion,
        lineage.selection.scopeFingerprintSha256,
        lineage.selection.validationPurpose,
        lineage.selection.validationDecision,
        lineage.selection.validationCurrentlyUsable,
        lineage.selection.validationEvaluatedAt,
        lineage.selection.validationPolicyVersion,
        JSON.stringify(lineage.selection.validationCheckedAuthorityReferences),
        lineage.selection.validationFingerprintSha256,
        lineage.selection.validationDoesNotAuthorizeDownstreamAction,
        lineage.directExecutor.established,
        lineage.directExecutor.providerId,
        lineage.directExecutor.providerWorkspaceId,
        lineage.directExecutor.authorityReference,
        JSON.stringify(lineage.directExecutor.authorityVersion),
        lineage.directExecutor.checkedAt,
        lineage.directExecutor.validationFingerprintSha256,
        lineage.directExecutor.currentAuthorityRevalidationRequiredBeforeOwnerCommit,
        this.bindingState(lineage),
        exact?.handoff.controlledHandoffId ?? null,
        exact?.handoff.version ?? null,
        exact?.envelopeFingerprintSha256 ?? null,
        exact?.purposeFingerprintSha256 ?? null,
        exact?.projectionFingerprintSha256 ?? null,
        exact?.sourceSetFingerprintSha256 ?? null,
        exact?.validationPurpose ?? null,
        exact?.validationDecision ?? null,
        exact?.validationCurrentlyUsable ?? null,
        exact?.validationCurrentExactDisclosurePermitted ?? null,
        exact?.validationEvaluatedAt ?? null,
        exact?.validationPolicyVersion ?? null,
        exact ? JSON.stringify(exact.validationCheckedAuthorityReferences) : null,
        exact?.validationFingerprintSha256 ?? null,
        exact?.validationIsNotBearerCapability ?? null,
        exact?.validationDoesNotAuthorizeDownstreamAction ?? null,
        lineage.lineageFingerprintSha256,
        lineage.correlationId,
        lineage.createdAt,
        lineage.containsIncomingFieldValues,
        lineage.containsBearerSecrets,
        lineage.containsRawCustomerData,
        lineage.containsRawEvidenceArtifacts,
        lineage.containsEndClientRelationshipInformation,
        lineage.containsPricingMarginOrProfit,
        lineage.providerAcceptanceAuthorized,
        lineage.providerContactAuthorized,
        lineage.professionalAppointmentCreated,
        lineage.protectedActionReleased,
        lineage.filingAuthorized,
        lineage.filingSubmitted,
        lineage.paymentAuthorized,
        lineage.paymentCreated,
        lineage.officialTruthCreated,
        lineage.matterCompleted
      ]
    );
  }

  private async resultFor(
    client: QueryClient,
    allocationId: string,
    allocationVersion: number,
    lineageId: string,
    lineageVersion: number,
    replayed: boolean
  ): Promise<GovernedAllocationResult> {
    const result = await client.query(
      `SELECT allocation_record FROM mgsn_allocations WHERE allocation_id=$1 AND version=$2`,
      [allocationId, allocationVersion]
    );
    const lineage = await client.query(
      `SELECT * FROM mgsn_allocation_admission_lineages
        WHERE allocation_admission_lineage_id=$1 AND version=$2`,
      [lineageId, lineageVersion]
    );
    if (!result.rowCount || !lineage.rowCount) {
      throw new GovernedAllocationError(
        'PERSISTENCE_UNAVAILABLE',
        'Governed Allocation replay points to incomplete durable state.',
        503
      );
    }
    return {
      allocation: (result.rows[0] as Row).allocation_record as GovernedAllocationResult['allocation'],
      lineage: this.mapLineage(lineage.rows[0] as Row),
      replayed,
      selectionIsPrerequisiteNotAllocationAuthority: true,
      handoffIsPrerequisiteNotAllocationAuthority: true,
      allocationDoesNotCreateProviderAcceptance: true
    };
  }

  private mapLineage(row: Row): GovernedAllocationAdmissionLineageRecord {
    const bindingState = String(row.handoff_binding_state);
    const exact = bindingState === 'EXACT_CONTROLLED_HANDOFF';
    const jsonArray = (value: unknown): string[] =>
      Array.isArray(value) ? value.map(String) : [];
    const jsonVersion = (value: unknown): number | string => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return value;
      throw new GovernedAllocationError(
        'PERSISTENCE_UNAVAILABLE',
        'Persisted governed authority version is malformed.',
        503
      );
    };
    return {
      allocationAdmissionLineageId: String(row.allocation_admission_lineage_id),
      version: 1,
      allocation: { id: String(row.allocation_id), version: Number(row.allocation_version) },
      originatingWorkspaceId: String(row.originating_workspace_id),
      servicePackage: {
        id: String(row.service_package_id),
        version: Number(row.service_package_version),
        fingerprintSha256: String(row.service_package_fingerprint_sha256)
      },
      provider: {
        providerId: String(row.provider_id) as GovernedAllocationAdmissionLineageRecord['provider']['providerId'],
        providerWorkspaceId: String(row.provider_workspace_id)
      },
      providerSupplyCapability: {
        id: String(row.provider_supply_capability_id) as GovernedAllocationAdmissionLineageRecord['providerSupplyCapability']['id'],
        version: Number(row.provider_supply_capability_version),
        fingerprintSha256: String(row.provider_supply_capability_fingerprint_sha256)
      },
      selection: {
        reference: {
          providerSelectionId: String(row.provider_selection_id) as GovernedAllocationAdmissionLineageRecord['selection']['reference']['providerSelectionId'],
          version: Number(row.selection_version),
          scopeVersion: Number(row.selection_scope_version)
        },
        scopeFingerprintSha256: String(row.selection_scope_fingerprint_sha256),
        validationPurpose: 'ALLOCATION_PREREQUISITE_REVIEW',
        validationDecision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
        validationCurrentlyUsable: true,
        validationEvaluatedAt: this.timestamp(row.selection_validation_evaluated_at),
        validationPolicyVersion: String(row.selection_validation_policy_version),
        validationCheckedAuthorityReferences: jsonArray(row.selection_validation_checked_authority_references),
        validationFingerprintSha256: String(row.selection_validation_fingerprint_sha256),
        validationDoesNotAuthorizeDownstreamAction: true
      },
      directExecutor: {
        established: true,
        providerId: String(row.direct_executor_provider_id) as GovernedAllocationAdmissionLineageRecord['directExecutor']['providerId'],
        providerWorkspaceId: String(row.direct_executor_provider_workspace_id),
        authorityReference: String(row.direct_executor_authority_reference),
        authorityVersion: jsonVersion(row.direct_executor_authority_version),
        checkedAt: this.timestamp(row.direct_executor_checked_at),
        validationFingerprintSha256: String(row.direct_executor_validation_fingerprint_sha256),
        currentAuthorityRevalidationRequiredBeforeOwnerCommit: true
      },
      handoff: exact
        ? {
            mode: 'EXACT',
            handoff: {
              controlledHandoffId: String(row.controlled_handoff_id) as GovernedAllocationAdmissionLineageRecord['handoff'] extends { mode: 'EXACT'; handoff: infer T } ? T extends { controlledHandoffId: infer I } ? I : never : never,
              version: Number(row.controlled_handoff_version)
            },
            envelopeFingerprintSha256: String(row.controlled_handoff_envelope_fingerprint_sha256),
            purposeFingerprintSha256: String(row.handoff_purpose_fingerprint_sha256),
            projectionFingerprintSha256: String(row.handoff_projection_fingerprint_sha256),
            sourceSetFingerprintSha256: String(row.handoff_source_set_fingerprint_sha256),
            validationPurpose: 'HANDOFF_CONSUMPTION',
            validationDecision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
            validationCurrentlyUsable: true,
            validationCurrentExactDisclosurePermitted: true,
            validationEvaluatedAt: this.timestamp(row.handoff_validation_evaluated_at),
            validationPolicyVersion: String(row.handoff_validation_policy_version),
            validationCheckedAuthorityReferences: jsonArray(row.handoff_validation_checked_authority_references),
            validationFingerprintSha256: String(row.handoff_validation_fingerprint_sha256),
            validationIsNotBearerCapability: true,
            validationDoesNotAuthorizeDownstreamAction: true
          }
        : { mode: 'NONE_EXPLICIT' },
      lineageFingerprintSha256: String(row.lineage_fingerprint_sha256),
      correlationId: String(row.correlation_id),
      createdAt: this.timestamp(row.created_at),
      containsIncomingFieldValues: false,
      containsBearerSecrets: false,
      containsRawCustomerData: false,
      containsRawEvidenceArtifacts: false,
      containsEndClientRelationshipInformation: false,
      containsPricingMarginOrProfit: false,
      providerAcceptanceAuthorized: false,
      providerContactAuthorized: false,
      professionalAppointmentCreated: false,
      protectedActionReleased: false,
      filingAuthorized: false,
      filingSubmitted: false,
      paymentAuthorized: false,
      paymentCreated: false,
      officialTruthCreated: false,
      matterCompleted: false
    };
  }

  private bindingState(lineage: GovernedAllocationAdmissionLineageRecord) {
    return lineage.handoff.mode === 'EXACT'
      ? 'EXACT_CONTROLLED_HANDOFF'
      : 'NO_CONTROLLED_HANDOFF_BY_DESIGN';
  }

  private timestamp(value: unknown): string {
    return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
  }

  private unavailable(cause: unknown) {
    return new GovernedAllocationError(
      'PERSISTENCE_UNAVAILABLE',
      'Governed Allocation persistence is unavailable.',
      503,
      { cause: cause instanceof Error ? cause.message : String(cause) }
    );
  }
}