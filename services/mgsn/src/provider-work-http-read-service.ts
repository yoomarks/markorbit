import type { AllocationId } from '@markorbit/contracts/provider-execution';
import type { ProviderWorkItemReadResultV1 } from '@markorbit/contracts/provider-work-read-model';
import type { ProviderRegistryRepository } from './provider-registry.js';
import type { GovernedProviderWorkReadModelService } from './provider-work-incoming-authority.js';
import {
  ProviderWorkReadModelService,
  type ProviderWorkListQuery,
  type ProviderWorkListResultV1,
  type ProviderWorkPrincipal,
  type ProviderWorkReadRepository
} from './provider-work-read-model.js';

/**
 * Compile-time checked compatibility adapter for the existing MGSN HTTP consumer boundary.
 *
 * HTTP still consumes the historical ProviderWorkReadModelService nominal type, while the durable
 * runtime must serve the governed #716 incoming-authority projection. This subclass delegates the
 * complete public read surface to the governed service instead of casting through unknown. If the
 * governed list/read contract drifts from the HTTP consumer contract, TypeScript fails here.
 */
export class GovernedProviderWorkHttpReadService extends ProviderWorkReadModelService {
  constructor(
    repository: ProviderWorkReadRepository,
    providerRegistry: ProviderRegistryRepository,
    private readonly governed: GovernedProviderWorkReadModelService
  ) {
    super(repository, providerRegistry);
  }

  override list(
    principal: Readonly<ProviderWorkPrincipal>,
    query: Readonly<ProviderWorkListQuery> = {}
  ): Promise<ProviderWorkListResultV1> {
    return this.governed.list(principal, query);
  }

  override read(
    principal: Readonly<ProviderWorkPrincipal>,
    allocationId: AllocationId
  ): Promise<ProviderWorkItemReadResultV1> {
    return this.governed.read(principal, allocationId);
  }
}
