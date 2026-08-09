import type { ManagedDatabase } from '@markorbit/persistence';
import type { JsonRoute } from '@markorbit/service-kit';
import type {
  ExecutionReleaseRepository,
  FilingAuthorizationRepository,
  FilingExecutionTaskDraftRepository
} from './filing-authorization.js';
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
  const repositoriesFor = (workspaceId: string) => {
    const filing = filingFor(workspaceId);
    return {
      authorizations: filing as unknown as FilingAuthorizationRepository,
      releases: filing as unknown as ExecutionReleaseRepository,
      tasks: filing as unknown as FilingExecutionTaskDraftRepository
    };
  };

  return createExecutionProviderInternalRoutes({
    internalServiceSecret: options.internalServiceSecret,
    sourceVerificationFor: (workspaceId) => {
      const repositories = repositoriesFor(workspaceId);
      return new ProviderExecutionSourceVerificationService(
        repositories.authorizations,
        repositories.releases,
        repositories.tasks
      );
    },
    providerReturnEvidenceFor: (workspaceId) => {
      const repositories = repositoriesFor(workspaceId);
      return new ProviderReturnEvidenceService(
        evidenceRepository,
        repositories.releases,
        repositories.tasks
      );
    }
  });
}
