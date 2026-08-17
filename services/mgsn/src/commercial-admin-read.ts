import type { InternalOperatorPrincipal } from '@markorbit/contracts';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import type {
  ProviderRegistryRecord,
  ProviderRegistryService,
  ProviderSupplyCapabilityRecord
} from './provider-registry.js';

export type MgsnCommercialAdminReadErrorCode =
  'AUTHENTICATION_REQUIRED' | 'PERMISSION_DENIED' | 'PROVIDER_NOT_FOUND';

export class MgsnCommercialAdminReadError extends Error {
  constructor(
    readonly code: MgsnCommercialAdminReadErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'MgsnCommercialAdminReadError';
  }
}

export interface MgsnAdminProviderInspection {
  schemaVersion: 1;
  source: Readonly<{ domain: 'MGSN'; authority: 'PROVIDER_NETWORK' }>;
  provider: Readonly<ProviderRegistryRecord>;
  supplyCapabilities: readonly Readonly<ProviderSupplyCapabilityRecord>[];
}

function authorize(principal: InternalOperatorPrincipal): void {
  if (principal.kind !== 'INTERNAL_OPERATOR')
    throw new MgsnCommercialAdminReadError(
      'AUTHENTICATION_REQUIRED',
      'An INTERNAL_OPERATOR Principal is required.'
    );
  if (!principal.capabilities.includes('commercial-admin:read'))
    throw new MgsnCommercialAdminReadError(
      'PERMISSION_DENIED',
      'commercial-admin:read capability is required.'
    );
}

const freezeClone = <T>(value: T): Readonly<T> => Object.freeze(structuredClone(value));

export class MgsnCommercialAdminReadService {
  constructor(private readonly providers: ProviderRegistryService) {}

  async listProviders(
    principal: InternalOperatorPrincipal
  ): Promise<readonly Readonly<ProviderRegistryRecord>[]> {
    authorize(principal);
    const values = await this.providers.listProviders();
    return Object.freeze(values.map(freezeClone));
  }

  async inspectProvider(
    principal: InternalOperatorPrincipal,
    providerId: ProviderId
  ): Promise<Readonly<MgsnAdminProviderInspection>> {
    authorize(principal);
    const provider = await this.providers.getProvider(providerId);
    if (!provider)
      throw new MgsnCommercialAdminReadError('PROVIDER_NOT_FOUND', 'Provider was not found.');
    const supplyCapabilities = await this.providers.listCurrentSupplyCapabilities(providerId);
    return Object.freeze({
      schemaVersion: 1,
      source: Object.freeze({ domain: 'MGSN', authority: 'PROVIDER_NETWORK' }),
      provider: freezeClone(provider),
      supplyCapabilities: Object.freeze(supplyCapabilities.map(freezeClone))
    });
  }
}
