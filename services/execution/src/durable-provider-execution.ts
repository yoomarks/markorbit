import type { ManagedDatabase } from '@markorbit/persistence';
import type { JsonRoute } from '@markorbit/service-kit';
import { PostgresFilingGovernanceRepository } from './filing-authorization-postgres.js';
import { createExecutionProviderInternalRoutes } from './provider-execution-http.js';
import { ProviderExecutionSourceVerificationService } from './provider-execution-source.js';
import { ProviderReturnEvidenceService } from './provider-return-evidence.js';
import { PostgresProviderReturnEvidenceRepository } from './provider-return-evidence-postgres.js';

export interface DurableExecutionProviderRoutesOptions {
  database: ManagedDatabase;
  internalServiceSecret: string;
}

export function createDurableExecutionProviderRoutes(
  options: DurableExecutionProviderRoutesOptions
): JsonRoute[] {
  const query = options.database.getPool();
  const evidenceRepository = new PostgresProviderReturnEvidenceRepository(options.database, query);
  const filingFor = (workspaceId: string) =>
    new PostgresFilingGovernanceRepository(
      options.database,
      query,
      workspaceId,
      'system_mgsn_provider_execution'
    );

  return createExecutionProviderInternalRoutes({
    internalServiceSecret: options.internalServiceSecret,
    sourceVerificationFor: (workspaceId) => {
      const filing = filingFor(workspaceId);
      return new ProviderExecutionSourceVerificationService(filing, filing, filing);
    },
    providerReturnEvidenceFor: (workspaceId) => {
      const filing = filingFor(workspaceId);
      return new ProviderReturnEvidenceService(evidenceRepository, filing, filing);
    }
  });
}
