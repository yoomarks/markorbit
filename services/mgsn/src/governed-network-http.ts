import type { JsonRoute } from '@markorbit/service-kit';
import type { ControlledPrivacyHandoffService } from './controlled-privacy-handoff.js';
import type { GovernedAllocationService } from './governed-allocation.js';
import type { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';
import { createMgsnGovernedAllocationHttpRoutes } from './governed-network-allocation-http.js';
import { createMgsnProviderDiscoveryHttpRoutes } from './governed-network-discovery-http.js';
import { createMgsnControlledHandoffHttpRoutes } from './governed-network-handoff-http.js';
import { createMgsnProviderSelectionHttpRoutes } from './governed-network-selection-http.js';
import type { ProviderSelectionService } from './provider-selection.js';

export {
  MGSN_GOVERNED_HUMAN_ACTION_HEADER,
  type MgsnGovernedHumanActionEnvelopeV1,
  type MgsnGovernedHumanActionKind
} from './governed-network-human-action.js';

export interface MgsnGovernedNetworkHttpServices {
  providerDiscovery: Pick<ProviderDiscoveryCurrentResponsibilityService, 'evaluate'>;
  providerSelection: Pick<
    ProviderSelectionService,
    'createOrReplace' | 'revoke' | 'validateCurrent'
  >;
  controlledHandoff: Pick<
    ControlledPrivacyHandoffService,
    'authorizeOrReplace' | 'revoke' | 'validateCurrent'
  >;
  governedAllocation: Pick<GovernedAllocationService, 'allocate'>;
}

export interface MgsnGovernedNetworkHttpOptions {
  internalServiceSecret?: string;
  services?: MgsnGovernedNetworkHttpServices;
}

export function createMgsnGovernedNetworkHttpRoutes(
  options: MgsnGovernedNetworkHttpOptions = {}
): JsonRoute[] {
  const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
  const discoveryOptions = {
    ...(secret ? { internalServiceSecret: secret } : {}),
    ...(options.services?.providerDiscovery ? { service: options.services.providerDiscovery } : {})
  };
  const selectionOptions = {
    ...(secret ? { internalServiceSecret: secret } : {}),
    ...(options.services?.providerSelection ? { service: options.services.providerSelection } : {})
  };
  const handoffOptions = {
    ...(secret ? { internalServiceSecret: secret } : {}),
    ...(options.services?.controlledHandoff ? { service: options.services.controlledHandoff } : {})
  };
  const allocationOptions = {
    ...(secret ? { internalServiceSecret: secret } : {}),
    ...(options.services?.governedAllocation
      ? { service: options.services.governedAllocation }
      : {})
  };

  return [
    ...createMgsnProviderDiscoveryHttpRoutes(discoveryOptions),
    ...createMgsnProviderSelectionHttpRoutes(selectionOptions),
    ...createMgsnControlledHandoffHttpRoutes(handoffOptions),
    ...createMgsnGovernedAllocationHttpRoutes(allocationOptions)
  ];
}
