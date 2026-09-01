import type { ManagedDatabase } from '@markorbit/persistence';
import { AllocationProviderAcceptanceService } from './allocation-provider-acceptance.js';
import { PostgresAllocationProviderAcceptanceRepository } from './allocation-provider-acceptance-postgres.js';
import type { MgsnHttpServices } from './http.js';
import { NetworkParticipationService } from './network-participation.js';
import { PostgresNetworkParticipationRepository } from './network-participation-postgres.js';
import { ProviderRegistryService } from './provider-registry.js';
import { PostgresProviderRegistryRepository } from './provider-registry-postgres.js';
import { ProviderReturnService } from './provider-return.js';
import { PostgresProviderReturnRepository } from './provider-return-postgres.js';
import {
  HttpCoreWorkspaceIdentitySource,
  HttpExecutionSourceAdmissionSource,
  HttpProviderReturnEvidenceHandoffTarget
} from './runtime-dependencies.js';
import { ServicePackageEligibilityService } from './service-package-eligibility.js';
import { PostgresServicePackageEligibilityRepository } from './service-package-eligibility-postgres.js';

export interface DurableMgsnServicesOptions {
  database: ManagedDatabase;
  coreUrl: string;
  executionUrl: string;
  internalServiceSecret: string;
}

export function createDurableMgsnServices(options: DurableMgsnServicesOptions): MgsnHttpServices {
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
  const networkParticipationRepository = new PostgresNetworkParticipationRepository(
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
    networkParticipation: new NetworkParticipationService(
      networkParticipationRepository,
      providerRepository
    )
  };
}
