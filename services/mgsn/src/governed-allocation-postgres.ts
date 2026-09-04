import { createHash } from 'node:crypto';
import type { QueryClient } from '@markorbit/persistence';
import { noDownstreamHandoffAuthorityConsequences } from '@markorbit/contracts/controlled-privacy-handoff';
import { noDownstreamProviderSelectionAuthorityConsequences } from '@markorbit/contracts/provider-selection';
import {
  AllocationProviderAcceptanceError,
  type AllocationRecord
} from './allocation-provider-acceptance.js';
import {
  GovernedAllocationError,
  type AllocationAdmissionLineageRecord,
  type GovernedAllocationReplay,
  type GovernedAllocationRepository
} from './governed-allocation.js';

type Row = Record<string, unknown>;

export interface GovernedAllocationTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

function asObject(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Persisted governed Allocation JSON is malformed.');
  }
  return value as Row;
}

function iso(value: unknown): string {
  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.valueOf()))
    throw new Error('Persisted governed Allocation timestamp is malformed.');
  return parsed.toISOString();
}

function jsonVersion(value: unknown): number | string {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) return value;
  throw new Error('Persisted governed Allocation authority version is malformed.');
}

function legacyStableSerialize(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => legacyStableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${legacyStableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function legacyAllocationRequestFingerprint(record: Readonly<AllocationRecord>): string {
  return createHash('sha256')
    .update(
      legacyStableSerialize({
        command: 'ALLOCATE_PROVIDER',
        workspaceId: record.workspaceId.toLowerCase(),
        servicePackageId: record.servicePackage.id,
        expectedServicePackageVersion: record.servicePackage.version,
        expectedPackageFingerprint: record.servicePackageFingerprintSha256,
        eligibilityEvaluationId: record.eligibilityEvaluation.id,
        expectedEligibilityEvaluationVersion: record.eligibilityEvaluation.version,
        expectedEligibilityFingerprint: record.eligibilityFingerprintSha256,
        providerId: record.provider.providerId,
        providerSupplyCapabilityId: record.providerSupplyCapability.id,
        expectedProviderSupplyCapabilityVersion: record.providerSupplyCapability.version,
        rationale: record.rationale,
        actorId: record.allocatedBy,
        correlationId: record.correlationId
      })
    )
    .digest('hex');
}

export class PostgresGovernedAllocationRepository implements GovernedAllocationRepository {
  constructor(
    private readonly database: GovernedAllocationTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findReplay(scopeKey: string, idempotencyKey: string) {
    try {
      return await this.readReplay(this.query, scopeKey, idempotencyKey);
    } catch {
      throw this.unavailable();
    }
  }

  async commit(input: {
    allocation: Readonly<AllocationRecord>;
    lineage: Readonly<AllocationAdmissionLineageRecord>;
    scopeKey: string;
    idempotencyKey: string;
    requestFingerprintSha256: string;
    actorId: string;
  }): Promise<GovernedAllocationReplay | undefined> {
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          input.scopeKey
        ]);

        const replay = await this.readReplay(client, input.scopeKey, input.idempotencyKey, true);
        if (replay) {
          if (replay.requestFingerprintSha256 !== input.requestFingerprintSha256) {
            throw new GovernedAllocationError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different Selection/Handoff lineage or Allocation payload.',
              409
            );
          }
          return replay;
        }

        await client.query(
          'SELECT service_package_id FROM mgsn_service_packages WHERE service_package_id=$1 FOR UPDATE',
          [input.allocation.servicePackage.id]
        );
        const active = await client.query(
          "SELECT allocation_id FROM mgsn_allocations WHERE service_package_id=$1 AND is_current=true AND status='ACTIVE' FOR UPDATE",
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
        await this.insertLegacyReplay(client, input);
        await this.insertLegacyAudit(client, input);
        await this.insertLineage(client, input.lineage);
        await this.insertGovernedReplay(client, input);
        await this.insertLineageAudit(client, input);
        return undefined;
      });
    } catch (cause) {
      if (
        cause instanceof GovernedAllocationError ||
        cause instanceof AllocationProviderAcceptanceError
      )
        throw cause;
      const code = (cause as { code?: string }).code;
      if (code === '23505') {
        throw new GovernedAllocationError(
          'IDEMPOTENCY_CONFLICT',
          'Governed Allocation conflicted with a concurrent Allocation or replay.',
          409
        );
      }
      if (code === '23503' || code === '23514') {
        throw new GovernedAllocationError(
          'SELECTION_MISMATCH',
          'Governed Allocation lineage no longer matches current durable MGSN truth.',
          409
        );
      }
      throw this.unavailable();
    }
  }

  private async readReplay(
    client: QueryClient,
    scopeKey: string,
    idempotencyKey: string,
    forUpdate = false
  ): Promise<GovernedAllocationReplay | undefined> {
    const result = await client.query(
      `SELECT
         r.request_fingerprint_sha256,
         a.allocation_record,
         l.*,
         s.selection_record,
         h.envelope_record
       FROM mgsn_allocation_admission_lineage_replays r
       JOIN mgsn_allocations a
         ON a.allocation_id=r.allocation_id AND a.version=r.allocation_version
       JOIN mgsn_allocation_admission_lineages l
         ON l.allocation_admission_lineage_id=r.allocation_admission_lineage_id
        AND l.version=r.lineage_version
       JOIN mgsn_provider_selection_versions s
         ON s.provider_selection_id=l.provider_selection_id
        AND s.version=l.selection_version
        AND s.scope_version=l.selection_scope_version
       LEFT JOIN mgsn_controlled_handoff_versions h
         ON h.controlled_handoff_id=l.controlled_handoff_id
        AND h.version=l.controlled_handoff_version
       WHERE r.scope_key=$1 AND r.idempotency_key=$2${forUpdate ? ' FOR UPDATE OF r' : ''}`,
      [scopeKey, idempotencyKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;

    const allocation = asObject(row.allocation_record) as unknown as AllocationRecord;
    const selection = asObject(row.selection_record);
    const selectionScope = asObject(selection.scope);
    const selectionValidation = {
      schemaVersion: 1,
      selection: {
        providerSelectionId: String(row.provider_selection_id),
        version: Number(row.selection_version),
        scopeVersion: Number(row.selection_scope_version)
      },
      requesterWorkspaceId: String(row.originating_workspace_id),
      scope: selectionScope,
      purpose: 'ALLOCATION_PREREQUISITE_REVIEW',
      evaluatedAt: iso(row.selection_validation_evaluated_at),
      validationPolicyVersion: String(row.selection_validation_policy_version),
      checkedAuthorityReferences: Array.isArray(
        row.selection_validation_checked_authority_references
      )
        ? row.selection_validation_checked_authority_references
        : [],
      authorityConsequences: noDownstreamProviderSelectionAuthorityConsequences,
      validationDoesNotAuthorizeDownstreamAction: true,
      decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
      currentlyUsable: true,
      publicReason: 'Historical admission validation was positive at governed Allocation commit.'
    } as unknown as AllocationAdmissionLineageRecord['selectionValidation'];

    const directExecutor = {
      established: true as const,
      providerId: String(
        row.direct_executor_provider_id
      ) as AllocationAdmissionLineageRecord['providerId'],
      providerWorkspaceId: String(row.direct_executor_provider_workspace_id),
      authorityReference: String(row.direct_executor_authority_reference),
      authorityVersion: jsonVersion(row.direct_executor_authority_version),
      checkedAt: iso(row.direct_executor_checked_at),
      validationFingerprintSha256: String(row.direct_executor_validation_fingerprint_sha256)
    };

    let handoff: AllocationAdmissionLineageRecord['handoff'];
    if (row.handoff_binding_state === 'EXACT_CONTROLLED_HANDOFF') {
      const envelope = asObject(row.envelope_record) as unknown as NonNullable<
        AllocationAdmissionLineageRecord['handoff']
      >['envelope'];
      const validation = {
        schemaVersion: 1,
        envelope: {
          controlledHandoffId: envelope.controlledHandoffId,
          version: envelope.version
        },
        purpose: 'HANDOFF_CONSUMPTION',
        attempt: {
          originatingWorkspaceId: String(row.originating_workspace_id),
          recipientProviderId: String(row.provider_id),
          recipientProviderWorkspaceId: String(row.provider_workspace_id),
          purposeFingerprintSha256: String(row.handoff_purpose_fingerprint_sha256),
          projectionFingerprintSha256: String(row.handoff_projection_fingerprint_sha256),
          sourceSetFingerprintSha256: String(row.handoff_source_set_fingerprint_sha256),
          artifactRetrievalRequested: false,
          attemptedAt: iso(row.handoff_validation_evaluated_at),
          correlationId: String(row.correlation_id)
        },
        evaluatedAt: iso(row.handoff_validation_evaluated_at),
        validationPolicyVersion: String(row.handoff_validation_policy_version),
        checkedAuthorityReferences: Array.isArray(
          row.handoff_validation_checked_authority_references
        )
          ? row.handoff_validation_checked_authority_references
          : [],
        authorityConsequences: noDownstreamHandoffAuthorityConsequences,
        validationIsNotBearerCapability: true,
        validationDoesNotAuthorizeDownstreamAction: true,
        decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
        currentlyUsable: true,
        currentExactDisclosurePermitted: true,
        publicReason: 'Historical admission validation was positive at governed Allocation commit.'
      } as unknown as NonNullable<AllocationAdmissionLineageRecord['handoff']>['validation'];
      handoff = {
        envelope,
        validation,
        validationFingerprintSha256: String(row.handoff_validation_fingerprint_sha256)
      };
    }

    const lineage: AllocationAdmissionLineageRecord = {
      allocationAdmissionLineageId: String(
        row.allocation_admission_lineage_id
      ) as AllocationAdmissionLineageRecord['allocationAdmissionLineageId'],
      version: 1,
      allocationId: String(row.allocation_id),
      allocationVersion: Number(row.allocation_version),
      originatingWorkspaceId: String(row.originating_workspace_id),
      servicePackageId: String(row.service_package_id),
      servicePackageVersion: Number(row.service_package_version),
      servicePackageFingerprintSha256: String(row.service_package_fingerprint_sha256),
      providerId: String(row.provider_id) as AllocationAdmissionLineageRecord['providerId'],
      providerWorkspaceId: String(row.provider_workspace_id),
      providerSupplyCapabilityId: String(
        row.provider_supply_capability_id
      ) as AllocationAdmissionLineageRecord['providerSupplyCapabilityId'],
      providerSupplyCapabilityVersion: Number(row.provider_supply_capability_version),
      providerSupplyCapabilityFingerprintSha256: String(
        row.provider_supply_capability_fingerprint_sha256
      ),
      providerSelectionId: String(row.provider_selection_id),
      selectionVersion: Number(row.selection_version),
      selectionScopeVersion: Number(row.selection_scope_version),
      selectionScopeFingerprintSha256: String(row.selection_scope_fingerprint_sha256),
      selectionValidation,
      selectionValidationFingerprintSha256: String(row.selection_validation_fingerprint_sha256),
      directExecutor,
      handoffBindingState:
        row.handoff_binding_state as AllocationAdmissionLineageRecord['handoffBindingState'],
      ...(handoff ? { handoff } : {}),
      lineageFingerprintSha256: String(row.lineage_fingerprint_sha256),
      correlationId: String(row.correlation_id),
      createdAt: iso(row.created_at)
    };

    return {
      requestFingerprintSha256: String(row.request_fingerprint_sha256),
      allocation,
      lineage
    };
  }

  private insertAllocation(client: QueryClient, record: Readonly<AllocationRecord>) {
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

  private insertLegacyReplay(
    client: QueryClient,
    input: {
      allocation: Readonly<AllocationRecord>;
      scopeKey: string;
      idempotencyKey: string;
      requestFingerprintSha256: string;
      actorId: string;
    }
  ) {
    const legacyScope = `allocation:${input.allocation.workspaceId.toLowerCase()}:${input.allocation.servicePackage.id}`;
    return client.query(
      `INSERT INTO mgsn_allocation_commands(
        scope_key,idempotency_key,request_fingerprint,target_type,target_id,command_type,
        response_version,response_record,actor_id,created_at
      ) VALUES($1,$2,$3,'ALLOCATION',$4,'ALLOCATE_PROVIDER',$5,$6::jsonb,$7,$8)`,
      [
        legacyScope,
        input.idempotencyKey,
        legacyAllocationRequestFingerprint(input.allocation),
        input.allocation.allocationId,
        input.allocation.version,
        JSON.stringify(input.allocation),
        input.actorId,
        input.allocation.createdAt
      ]
    );
  }

  private insertLegacyAudit(
    client: QueryClient,
    input: { allocation: Readonly<AllocationRecord>; actorId: string }
  ) {
    const record = input.allocation;
    return client.query(
      `INSERT INTO mgsn_allocation_audit(
        workspace_id,target_type,target_id,action,record_version,actor_id,source_fingerprint,created_at
      ) VALUES($1,'ALLOCATION',$2,'PROVIDER_ALLOCATED',$3,$4,$5,$6)`,
      [
        record.workspaceId,
        record.allocationId,
        record.version,
        input.actorId,
        record.eligibilityFingerprintSha256,
        record.createdAt
      ]
    );
  }

  private insertLineage(client: QueryClient, lineage: Readonly<AllocationAdmissionLineageRecord>) {
    const selectionValidation = lineage.selectionValidation;
    const direct = lineage.directExecutor;
    const handoff = lineage.handoff;
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
        $1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true,$19,$20,$21::jsonb,$22,true,
        true,$23,$24,$25,$26::jsonb,$27,$28,true,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42::jsonb,
        $43,$44,$45,$46,$47,$48,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false
      )`,
      [
        lineage.allocationAdmissionLineageId,
        lineage.allocationId,
        lineage.allocationVersion,
        lineage.originatingWorkspaceId,
        lineage.servicePackageId,
        lineage.servicePackageVersion,
        lineage.servicePackageFingerprintSha256,
        lineage.providerId,
        lineage.providerWorkspaceId,
        lineage.providerSupplyCapabilityId,
        lineage.providerSupplyCapabilityVersion,
        lineage.providerSupplyCapabilityFingerprintSha256,
        lineage.providerSelectionId,
        lineage.selectionVersion,
        lineage.selectionScopeVersion,
        lineage.selectionScopeFingerprintSha256,
        selectionValidation.purpose,
        selectionValidation.decision,
        selectionValidation.evaluatedAt,
        selectionValidation.validationPolicyVersion,
        JSON.stringify(selectionValidation.checkedAuthorityReferences),
        lineage.selectionValidationFingerprintSha256,
        direct.providerId,
        direct.providerWorkspaceId,
        direct.authorityReference,
        JSON.stringify(direct.authorityVersion),
        direct.checkedAt,
        direct.validationFingerprintSha256,
        lineage.handoffBindingState,
        handoff?.envelope.controlledHandoffId ?? null,
        handoff?.envelope.version ?? null,
        handoff?.envelope.envelopeFingerprintSha256 ?? null,
        handoff?.envelope.purpose.purposeFingerprintSha256 ?? null,
        handoff?.envelope.authorizedProjection.projectionFingerprintSha256 ?? null,
        handoff?.envelope.authorizedProjection.sourceSetFingerprintSha256 ?? null,
        handoff?.validation.purpose ?? null,
        handoff?.validation.decision ?? null,
        handoff?.validation.currentlyUsable ?? null,
        handoff?.validation.currentExactDisclosurePermitted ?? null,
        handoff?.validation.evaluatedAt ?? null,
        handoff?.validation.validationPolicyVersion ?? null,
        handoff ? JSON.stringify(handoff.validation.checkedAuthorityReferences) : null,
        handoff?.validationFingerprintSha256 ?? null,
        handoff?.validation.validationIsNotBearerCapability ?? null,
        handoff?.validation.validationDoesNotAuthorizeDownstreamAction ?? null,
        lineage.lineageFingerprintSha256,
        lineage.correlationId,
        lineage.createdAt
      ]
    );
  }

  private insertGovernedReplay(
    client: QueryClient,
    input: {
      lineage: Readonly<AllocationAdmissionLineageRecord>;
      allocation: Readonly<AllocationRecord>;
      scopeKey: string;
      idempotencyKey: string;
      requestFingerprintSha256: string;
    }
  ) {
    return client.query(
      `INSERT INTO mgsn_allocation_admission_lineage_replays(
        scope_key,idempotency_key,request_fingerprint_sha256,allocation_id,allocation_version,
        allocation_admission_lineage_id,lineage_version,lineage_fingerprint_sha256,correlation_id,created_at
      ) VALUES($1,$2,$3,$4,$5,$6,1,$7,$8,$9)`,
      [
        input.scopeKey,
        input.idempotencyKey,
        input.requestFingerprintSha256,
        input.allocation.allocationId,
        input.allocation.version,
        input.lineage.allocationAdmissionLineageId,
        input.lineage.lineageFingerprintSha256,
        input.lineage.correlationId,
        input.lineage.createdAt
      ]
    );
  }

  private insertLineageAudit(
    client: QueryClient,
    input: {
      lineage: Readonly<AllocationAdmissionLineageRecord>;
      allocation: Readonly<AllocationRecord>;
      actorId: string;
    }
  ) {
    const lineage = input.lineage;
    return client.query(
      `INSERT INTO mgsn_allocation_admission_lineage_audit(
        originating_workspace_id,allocation_id,allocation_version,allocation_admission_lineage_id,lineage_version,
        action,actor_id,selection_validation_fingerprint_sha256,handoff_binding_state,
        handoff_validation_fingerprint_sha256,lineage_fingerprint_sha256,correlation_id,created_at
      ) VALUES($1,$2,$3,$4,1,'GOVERNED_ALLOCATION_LINEAGE_BOUND',$5,$6,$7,$8,$9,$10,$11)`,
      [
        lineage.originatingWorkspaceId,
        input.allocation.allocationId,
        input.allocation.version,
        lineage.allocationAdmissionLineageId,
        input.actorId,
        lineage.selectionValidationFingerprintSha256,
        lineage.handoffBindingState,
        lineage.handoff?.validationFingerprintSha256 ?? null,
        lineage.lineageFingerprintSha256,
        lineage.correlationId,
        lineage.createdAt
      ]
    );
  }

  private unavailable() {
    return new GovernedAllocationError(
      'AUTHORITY_UNAVAILABLE',
      'Governed Allocation persistence is unavailable.',
      503
    );
  }
}
