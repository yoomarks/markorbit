import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ControlledHandoffId } from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  EligibilityEvaluationId,
  ProviderId,
  ProviderSupplyCapabilityId,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { ControlledPrivacyHandoffService } from './controlled-privacy-handoff.js';
import {
  GovernedAllocationError,
  type GovernedAllocationCommand,
  type GovernedAllocationService
} from './governed-allocation.js';
import type { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';
import { createMgsnProviderDiscoveryHttpRoutes } from './governed-network-discovery-http.js';
import { createMgsnControlledHandoffHttpRoutes } from './governed-network-handoff-http.js';
import {
  assertExactTransportShape,
  bodyOf,
  markOrbitId,
  objectOf,
  positiveInteger,
  prefixedId,
  rejectTopLevelAuthority,
  requireIdempotency,
  requiredEnum,
  requiredString,
  sha256,
  trustedWorkspacePrincipalFor,
  type Body,
  type TransportShape
} from './governed-network-http-boundary.js';
import {
  createMgsnProviderSelectionHttpRoutes,
  parseSelectionScope,
  parseSelectionVersionReference,
  selectionScopeTransportShape
} from './governed-network-selection-http.js';
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

const governedAllocationTransportShape = {
  servicePackageId: null,
  expectedServicePackageVersion: null,
  expectedServicePackageFingerprintSha256: null,
  eligibilityEvaluationId: null,
  expectedEligibilityEvaluationVersion: null,
  expectedEligibilityFingerprintSha256: null,
  providerId: null,
  providerSupplyCapabilityId: null,
  expectedProviderSupplyCapabilityVersion: null,
  rationale: null,
  selection: {
    providerSelectionId: null,
    version: null,
    scopeVersion: null
  },
  selectionScope: selectionScopeTransportShape,
  handoffBinding: {
    mode: null,
    handoff: {
      controlledHandoffId: null,
      version: null
    },
    envelopeFingerprintSha256: null,
    purposeFingerprintSha256: null,
    projectionFingerprintSha256: null,
    sourceSetFingerprintSha256: null
  },
  idempotencyKey: null,
  correlationId: null
} satisfies TransportShape;

function parseGovernedAllocationCommand(
  body: Body,
  principal: WorkspacePrincipal,
  idempotencyKey: string
): GovernedAllocationCommand {
  const handoffBinding = objectOf(body.handoffBinding, 'body.handoffBinding');
  const mode = requiredEnum(
    handoffBinding.mode,
    ['NONE_EXPLICIT', 'EXACT'] as const,
    'body.handoffBinding.mode'
  );
  const parsedHandoffBinding: GovernedAllocationCommand['handoffBinding'] =
    mode === 'NONE_EXPLICIT'
      ? { mode }
      : (() => {
          const handoff = objectOf(handoffBinding.handoff, 'body.handoffBinding.handoff');
          return {
            mode,
            handoff: {
              controlledHandoffId: prefixedId<ControlledHandoffId>(
                handoff.controlledHandoffId,
                'controlled-handoff_',
                'body.handoffBinding.handoff.controlledHandoffId'
              ),
              version: positiveInteger(handoff.version, 'body.handoffBinding.handoff.version')
            },
            envelopeFingerprintSha256: sha256(
              handoffBinding.envelopeFingerprintSha256,
              'body.handoffBinding.envelopeFingerprintSha256'
            ),
            purposeFingerprintSha256: sha256(
              handoffBinding.purposeFingerprintSha256,
              'body.handoffBinding.purposeFingerprintSha256'
            ),
            projectionFingerprintSha256: sha256(
              handoffBinding.projectionFingerprintSha256,
              'body.handoffBinding.projectionFingerprintSha256'
            ),
            sourceSetFingerprintSha256: sha256(
              handoffBinding.sourceSetFingerprintSha256,
              'body.handoffBinding.sourceSetFingerprintSha256'
            )
          };
        })();
  return {
    workspaceId: principal.workspaceId,
    servicePackageId: prefixedId<ServicePackageId>(
      body.servicePackageId,
      'service-package_',
      'body.servicePackageId'
    ),
    expectedServicePackageVersion: positiveInteger(
      body.expectedServicePackageVersion,
      'body.expectedServicePackageVersion'
    ),
    expectedServicePackageFingerprintSha256: sha256(
      body.expectedServicePackageFingerprintSha256,
      'body.expectedServicePackageFingerprintSha256'
    ),
    eligibilityEvaluationId: prefixedId<EligibilityEvaluationId>(
      body.eligibilityEvaluationId,
      'eligibility-evaluation_',
      'body.eligibilityEvaluationId'
    ),
    expectedEligibilityEvaluationVersion: positiveInteger(
      body.expectedEligibilityEvaluationVersion,
      'body.expectedEligibilityEvaluationVersion'
    ),
    expectedEligibilityFingerprintSha256: sha256(
      body.expectedEligibilityFingerprintSha256,
      'body.expectedEligibilityFingerprintSha256'
    ),
    providerId: prefixedId<ProviderId>(body.providerId, 'provider_', 'body.providerId'),
    providerSupplyCapabilityId: prefixedId<ProviderSupplyCapabilityId>(
      body.providerSupplyCapabilityId,
      'provider-supply-capability_',
      'body.providerSupplyCapabilityId'
    ),
    expectedProviderSupplyCapabilityVersion: positiveInteger(
      body.expectedProviderSupplyCapabilityVersion,
      'body.expectedProviderSupplyCapabilityVersion'
    ),
    rationale: requiredString(body.rationale, 'body.rationale', 1000),
    idempotencyKey,
    correlationId: markOrbitId(body.correlationId, 'body.correlationId'),
    actorId: principal.userId,
    selection: parseSelectionVersionReference(body.selection, 'body.selection'),
    selectionScope: parseSelectionScope(body.selectionScope, 'body.selectionScope'),
    handoffBinding: parsedHandoffBinding
  };
}

function mapDomainError(error: unknown): never {
  if (error instanceof GovernedAllocationError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createMgsnGovernedNetworkHttpRoutes(
  options: MgsnGovernedNetworkHttpOptions = {}
): JsonRoute[] {
  const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
  const services = () => {
    if (!options.services)
      throw new HttpError(
        503,
        'MGSN_GOVERNED_NETWORK_RUNTIME_UNCONFIGURED',
        'MGSN governed-network runtime is not configured.',
        true
      );
    return options.services;
  };
  const trustedPrincipalFor = (request: JsonRequest): WorkspacePrincipal =>
    trustedWorkspacePrincipalFor(request, secret);
  const operation = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      return mapDomainError(error);
    }
  };

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

  return [
    ...createMgsnProviderDiscoveryHttpRoutes(discoveryOptions),
    ...createMgsnProviderSelectionHttpRoutes(selectionOptions),
    ...createMgsnControlledHandoffHttpRoutes(handoffOptions),
    {
      method: 'POST',
      path: '/v1/governed-network/allocations',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, governedAllocationTransportShape, 'body');
        const idempotencyKey = requireIdempotency(request, body);
        const handoffBinding =
          body.handoffBinding === undefined
            ? undefined
            : objectOf(body.handoffBinding, 'handoffBinding');
        if (
          handoffBinding?.mode === 'NONE_EXPLICIT' &&
          Object.keys(handoffBinding).some((field) => field !== 'mode')
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'NONE_EXPLICIT Handoff binding cannot carry an exact Handoff reference or fingerprints.'
          );
        const command = parseGovernedAllocationCommand(body, principal, idempotencyKey);
        const result = await operation(() => services().governedAllocation.allocate(command));
        return json(201, { governedAllocation: result });
      }
    }
  ];
}
