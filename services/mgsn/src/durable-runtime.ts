import type { ManagedDatabase } from '@markorbit/persistence';
import { AllocationProviderAcceptanceService } from './allocation-provider-acceptance.js';
import { PostgresAllocationProviderAcceptanceRepository } from './allocation-provider-acceptance-postgres.js';
import {
  ControlledPrivacyHandoffService,
  type ControlledHandoffCurrentAuthoritySource
} from './controlled-privacy-handoff.js';
import { PostgresControlledHandoffRepository } from './controlled-privacy-handoff-postgres.js';
import type { MgsnHttpServices } from './http.js';
import { NetworkParticipationService } from './network-participation.js';
import { PostgresNetworkParticipationRepository } from './network-participation-postgres.js';
import {
  OutcomeTrustEvidenceService,
  type TrustEvidenceCurrentAuthoritySource
} from './outcome-trust-evidence.js';
import { PostgresOutcomeTrustEvidenceRepository } from './outcome-trust-evidence-postgres.js';
import { ProviderRegistryService } from './provider-registry.js';
import { PostgresProviderRegistryRepository } from './provider-registry-postgres.js';
import { ProviderResponsibilityService } from './provider-responsibility.js';
import { PostgresProviderResponsibilityRepository } from './provider-responsibility-postgres.js';
import { ProviderReturnService } from './provider-return.js';
import { PostgresProviderReturnRepository } from './provider-return-postgres.js';
import {
  ProviderSelectionService,
  type ProviderSelectionCurrentAuthoritySource
} from './provider-selection.js';
import { PostgresProviderSelectionRepository } from './provider-selection-postgres.js';
import { ProviderWorkReadModelService } from './provider-work-read-model.js';
import { PostgresProviderWorkReadRepository } from './provider-work-read-model-postgres.js';
import {
  HttpCoreWorkspaceIdentitySource,
  HttpExecutionSourceAdmissionSource,
  HttpProviderReturnEvidenceHandoffTarget
} from './runtime-dependencies.js';
import { ServicePackageEligibilityService } from './service-package-eligibility.js';
import { PostgresServicePackageEligibilityRepository } from './service-package-eligibility-postgres.js';

// Durable Selection history is never a substitute for current requester/provider authority.
const unavailableProviderSelectionAuthority: ProviderSelectionCurrentAuthoritySource = {
  evaluateCurrentAuthority() {
    return Promise.resolve({
      authorityAvailable: false,
      requesterAuthorityCurrent: false,
      actorAuthorityCurrent: false,
      candidateCurrent: false,
      participationActive: false,
      visibilityAuthorized: false,
      trustedRelationshipRequired: false,
      trustedRelationshipCurrent: false,
      providerOperational: false,
      supplyCurrent: false,
      directExecutorEstablished: false,
      sourceVersionsMatch: false,
      checkedAuthorityReferences: []
    });
  }
};

// Persisted AUTHORIZED history never substitutes for current disclosure permission.
const unavailableControlledHandoffAuthority: ControlledHandoffCurrentAuthoritySource = {
  evaluateCurrentAuthority() {
    return Promise.resolve({
      authorityAvailable: false,
      selectionCurrent: false,
      selectionScopeMatch: false,
      sourceVersionsMatch: false,
      sourceAccessCurrent: false,
      participationActive: false,
      visibilityAuthorized: false,
      directExecutorEstablished: false,
      hiddenIntermediaryDetected: false,
      evidenceArtifactAccessAuthorized: false,
      checkedAuthorityReferences: []
    });
  }
};

// Durable Trust Evidence is historical/contextual evidence only. Serving still requires a live owner authority.
const unavailableTrustEvidenceCurrentAuthority: TrustEvidenceCurrentAuthoritySource = {
  evaluateCurrentAuthority() {
    return Promise.resolve({
      authorityAvailable: false,
      participationActive: false,
      visibilityAuthorized: false,
      relationshipAuthorityCurrent: false,
      sourceAuthoritiesCurrent: false,
      contextMatches: false,
      executorAttributionCurrent: false,
      authorityReferences: []
    });
  }
};

export interface DurableMgsnServicesOptions {
  database: ManagedDatabase;
  coreUrl: string;
  executionUrl: string;
  internalServiceSecret: string;
  providerSelectionCurrentAuthoritySource?: ProviderSelectionCurrentAuthoritySource;
  controlledHandoffCurrentAuthoritySource?: ControlledHandoffCurrentAuthoritySource;
  trustEvidenceCurrentAuthoritySource?: TrustEvidenceCurrentAuthoritySource;
}

export type DurableMgsnServices = MgsnHttpServices & {
  providerResponsibility: ProviderResponsibilityService;
  providerSelection: ProviderSelectionService;
  controlledHandoff: ControlledPrivacyHandoffService;
  outcomeTrustEvidence: OutcomeTrustEvidenceService;
};

export function createDurableMgsnServices(
  options: DurableMgsnServicesOptions
): DurableMgsnServices {
  const query = options.database.getPool();
  const providerRepository = new PostgresProviderRegistryRepository(options.database, query);
  const servicePackageRepository = new PostgresServicePackageEligibilityRepository(
    options.database,
    query
  );
  const allocationRepository = new PostgresAllocationProviderAcceptanceRepository(
    options.database,
    query
  );
  const providerReturnRepository = new PostgresProviderReturnRepository(options.database, query);
  const providerWorkReadRepository = new PostgresProviderWorkReadRepository(query);
  const networkParticipationRepository = new PostgresNetworkParticipationRepository(
    options.database,
    query
  );
  const providerResponsibilityRepository = new PostgresProviderResponsibilityRepository(
    options.database,
    query
  );
  const providerSelectionRepository = new PostgresProviderSelectionRepository(
    options.database,
    query
  );
  const controlledHandoffRepository = new PostgresControlledHandoffRepository(
    options.database,
    query
  );
  const outcomeTrustEvidenceRepository = new PostgresOutcomeTrustEvidenceRepository(
    options.database,
    query
  );
  const coreWorkspaces = new HttpCoreWorkspaceIdentitySource(
    options.coreUrl,
    options.internalServiceSecret
  );
  const executionSource = new HttpExecutionSourceAdmissionSource(
    options.executionUrl,
    options.internalServiceSecret
  );
  const evidenceHandoff = new HttpProviderReturnEvidenceHandoffTarget(
    options.executionUrl,
    options.internalServiceSecret
  );

  return {
    providerRegistry: new ProviderRegistryService(providerRepository, coreWorkspaces),
    servicePackageEligibility: new ServicePackageEligibilityService(
      servicePackageRepository,
      providerRepository,
      executionSource
    ),
    allocationProviderAcceptance: new AllocationProviderAcceptanceService(
      allocationRepository,
      servicePackageRepository,
      providerRepository,
      executionSource
    ),
    providerReturn: new ProviderReturnService(
      providerReturnRepository,
      allocationRepository,
      servicePackageRepository,
      providerRepository,
      evidenceHandoff
    ),
    providerWorkRead: new ProviderWorkReadModelService(
      providerWorkReadRepository,
      providerRepository
    ),
    networkParticipation: new NetworkParticipationService(
      networkParticipationRepository,
      providerRepository
    ),
    providerResponsibility: new ProviderResponsibilityService(
      providerResponsibilityRepository,
      providerRepository
    ),
    providerSelection: new ProviderSelectionService(
      providerSelectionRepository,
      options.providerSelectionCurrentAuthoritySource ?? unavailableProviderSelectionAuthority
    ),
    controlledHandoff: new ControlledPrivacyHandoffService(
      controlledHandoffRepository,
      options.controlledHandoffCurrentAuthoritySource ?? unavailableControlledHandoffAuthority
    ),
    outcomeTrustEvidence: new OutcomeTrustEvidenceService(
      outcomeTrustEvidenceRepository,
      options.trustEvidenceCurrentAuthoritySource ?? unavailableTrustEvidenceCurrentAuthority
    )
  };
}
