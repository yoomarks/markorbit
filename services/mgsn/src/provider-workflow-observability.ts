import type {
  EvidenceHandoffReference,
  HandoffProviderReturnEvidenceCommand
} from '@markorbit/contracts/provider-execution';
import {
  AllocationProviderAcceptanceService,
  type AllocationProviderAcceptanceRepository,
  type ProviderAcceptanceRecord,
  type RespondToAllocationServiceCommand
} from './allocation-provider-acceptance.js';
import type { ProviderRegistryRepository } from './provider-registry.js';
import {
  ProviderReturnService,
  type CreateProviderReturnServiceCommand,
  type ProviderReturnEvidenceHandoffTarget,
  type ProviderReturnRecord,
  type ProviderReturnRepository
} from './provider-return.js';
import {
  observeMgsnSemanticOperationV1,
  type MgsnSemanticTelemetrySinkV1
} from './semantic-observability.js';
import type {
  ExecutionSourceAdmissionSource,
  ServicePackageEligibilityRepository
} from './service-package-eligibility.js';

/**
 * Operational observation around Provider acceptance/decline only.
 *
 * The observer is deliberately downstream of the same domain service and cannot alter its
 * authority checks, retry semantics, or persisted truth. Acceptance/decline telemetry is not
 * Provider Trust evidence, ranking, quality, professional judgment, or contact authority.
 */
export class ObservedAllocationProviderAcceptanceService extends AllocationProviderAcceptanceService {
  constructor(
    repository: AllocationProviderAcceptanceRepository,
    servicePackageEligibility: ServicePackageEligibilityRepository,
    providerRegistry: ProviderRegistryRepository,
    executionSource: ExecutionSourceAdmissionSource,
    private readonly semanticTelemetrySink?: MgsnSemanticTelemetrySinkV1
  ) {
    super(repository, servicePackageEligibility, providerRegistry, executionSource);
  }

  override respondToAllocation(
    command: RespondToAllocationServiceCommand
  ): Promise<ProviderAcceptanceRecord> {
    return observeMgsnSemanticOperationV1(
      this.semanticTelemetrySink,
      'PROVIDER_ALLOCATION_RESPOND',
      () => super.respondToAllocation(command),
      (result) => ({
        outcomeClass: 'SUCCESS',
        resultCode: result.decision === 'DECLINED' ? 'DECLINED' : 'ACCEPTED'
      })
    );
  }
}

/**
 * Operational observation around Provider Return submission/correction and evidence handoff.
 *
 * No Return payload, work-status claim, assertion, artifact, evidence reference, Provider identity,
 * Workspace identity, or correlation lineage is copied into semantic telemetry.
 */
export class ObservedProviderReturnService extends ProviderReturnService {
  constructor(
    repository: ProviderReturnRepository,
    allocationAcceptance: AllocationProviderAcceptanceRepository,
    servicePackages: ServicePackageEligibilityRepository,
    providerRegistry: ProviderRegistryRepository,
    evidenceHandoff: ProviderReturnEvidenceHandoffTarget,
    private readonly semanticTelemetrySink?: MgsnSemanticTelemetrySinkV1
  ) {
    super(repository, allocationAcceptance, servicePackages, providerRegistry, evidenceHandoff);
  }

  override createProviderReturn(
    command: CreateProviderReturnServiceCommand
  ): Promise<ProviderReturnRecord> {
    return observeMgsnSemanticOperationV1(
      this.semanticTelemetrySink,
      'PROVIDER_RETURN_CREATE',
      () => super.createProviderReturn(command),
      (result) => ({
        outcomeClass: 'SUCCESS',
        resultCode: result.version > 1 ? 'RETURN_CORRECTED' : 'RETURN_SUBMITTED'
      })
    );
  }

  override handoffProviderReturnEvidence(
    command: HandoffProviderReturnEvidenceCommand
  ): Promise<EvidenceHandoffReference> {
    return observeMgsnSemanticOperationV1(
      this.semanticTelemetrySink,
      'PROVIDER_RETURN_HANDOFF',
      () => super.handoffProviderReturnEvidence(command),
      () => ({ outcomeClass: 'SUCCESS', resultCode: 'EVIDENCE_HANDOFF_COMPLETED' })
    );
  }
}
