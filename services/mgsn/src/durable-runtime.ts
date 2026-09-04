import type { ManagedDatabase } from '@markorbit/persistence';
import { AllocationProviderAcceptanceService } from './allocation-provider-acceptance.js';
import { PostgresAllocationProviderAcceptanceRepository } from './allocation-provider-acceptance-postgres.js';
import { MgsnControlledHandoffCurrentAuthoritySource } from './controlled-handoff-current-authority.js';
import {
  ControlledPrivacyHandoffService,
  type ControlledHandoffCurrentAuthoritySource
} from './controlled-privacy-handoff.js';
import { PostgresControlledHandoffRepository } from './controlled-privacy-handoff-postgres.js';
import type { MgsnHttpServices } from './http.js';
import { NetworkParticipationService } from './network-participation.js';
import { PostgresNetworkParticipationRepository } from './network-participation-postgres.js';
import { MgsnTrustEvidenceCurrentAuthoritySource } from './outcome-trust-evidence-current-authority.js';
import {
  OutcomeTrustEvidenceService,
  type TrustEvidenceCurrentAuthoritySource
} from './outcome-trust-evidence.js';
import { PostgresOutcomeTrustEvidenceRepository } from './outcome-trust-evidence-postgres.js';
import { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';
import { PostgresProviderDiscoverySourceRepository } from './provider-discovery-postgres.js';
import { ProviderDiscoveryService } from './provider-discovery.js';
import { ProviderRegistryService } from './provider-registry.js';
import { PostgresProviderRegistryRepository } from './provider-registry-postgres.js';
import { ProviderResponsibilityService } from './provider-responsibility.js';
import { PostgresProviderResponsibilityRepository } from './provider-responsibility-postgres.js';
import { ProviderReturnService } from './provider-return.js';
import { PostgresProviderReturnRepository } from './provider-return-postgres.js';
import { MgsnProviderSelectionCurrentAuthoritySource } from './provider-selection-current-authority.js';
import {
  ProviderSelectionService,
  type ProviderSelectionCurrentAuthoritySource
} from './provider-selection.js';
import { PostgresProviderSelectionRepository } from './provider-selection-postgres.js';
import { ProviderWorkReadModelService } from './provider-work-read-model.js';
import { PostgresProviderWorkReadRepository } from './provider-work-read-model-postgres.js';
import {
  HttpCoreCurrentWorkspaceAuthoritySource,
  HttpCoreWorkspaceIdentitySource,
  HttpExecutionSourceAdmissionSource,
  HttpProviderReturnEvidenceHandoffTarget
} from './runtime-dependencies.js';
import { ServicePackageEligibilityService } from './service-package-eligibility.js';
import { PostgresServicePackageEligibilityRepository } from './service-package-eligibility-postgres.js';
import {
  TrustedPublicExposureService,
  type TrustedPublicCurrentAuthoritySource
} from './trusted-public-exposure.js';

// Shared public eligibility/projection metadata never establishes current public serving authority.
const unavailableTrustedPublicAuthority: TrustedPublicCurrentAuthoritySource = {
  evaluateCurrentAuthority() {
    return Promise.resolve({
      authorityAvailable: false,
      providerIdentityCurrent: false,
      organizationIdentityCurrent: false,
      participationCurrent: false,
      visibilityCurrent: false,
      purposeAuthorized: false,
      audienceAuthorized: false,
      sourceAuthoritiesCurrent: false,
      sourceVersionsMatch: false,
      sourceOwnerAuthorizationCurrent: false,
      trustAuthorityCurrent: false,
      directExecutorEstablished: false,
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
  trustedPublicCurrentAuthoritySource?: TrustedPublicCurrentAuthoritySource;
}

export type DurableMgsnServices = MgsnHttpServices & {
  providerDiscovery: ProviderDiscoveryCurrentResponsibilityService;
  providerResponsibility: ProviderResponsibilityService;
  providerSelection: ProviderSelectionService;
  controlledHandoff: ControlledPrivacyHandoffService;
  outcomeTrustEvidence: OutcomeTrustEvidenceService;
  trustedPublicExposure: TrustedPublicExposureService;
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
  const providerDiscoveryRepository = new PostgresProviderDiscoverySourceRepository(query);
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
  const coreCurrentWorkspaceAuthority = new HttpCoreCurrentWorkspaceAuthoritySource(
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
  const providerResponsibility = new ProviderResponsibilityService(
    providerResponsibilityRepository,
    providerRepository
  );
  const providerSelectionCurrentAuthority = new MgsnProviderSelectionCurrentAuthoritySource(
    coreCurrentWorkspaceAuthority,
    networkParticipationRepository,
    providerRepository,
    providerResponsibility
  );
  const providerSelection = new ProviderSelectionService(
    providerSelectionRepository,
    options.providerSelectionCurrentAuthoritySource ?? providerSelectionCurrentAuthority
  );
  const controlledHandoffCurrentAuthority = new MgsnControlledHandoffCurrentAuthoritySource(
    providerSelection,
    networkParticipationRepository,
    providerRepository,
    providerResponsibility
  );
  const controlledHandoff = new ControlledPrivacyHandoffService(
    controlledHandoffRepository,
    options.controlledHandoffCurrentAuthoritySource ?? controlledHandoffCurrentAuthority
  );
  const trustEvidenceCurrentAuthority = new MgsnTrustEvidenceCurrentAuthoritySource(
    networkParticipationRepository,
    providerReturnRepository,
    providerRepository,
    providerResponsibility
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
    providerDiscovery: new ProviderDiscoveryCurrentResponsibilityService(
      new ProviderDiscoveryService(providerDiscoveryRepository),
      providerResponsibility
    ),
    providerResponsibility,
    providerSelection,
    controlledHandoff,
    outcomeTrustEvidence: new OutcomeTrustEvidenceService(
      outcomeTrustEvidenceRepository,
      options.trustEvidenceCurrentAuthoritySource ?? trustEvidenceCurrentAuthority
    ),
    trustedPublicExposure: new TrustedPublicExposureService(
      options.trustedPublicCurrentAuthoritySource ?? unavailableTrustedPublicAuthority
    )
  };
}
