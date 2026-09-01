/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- HTTP payloads are normalized immediately and validated by the domain services. */
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  AllocationId,
  EligibilityEvaluationId,
  ProviderAcceptanceId,
  ProviderId,
  ProviderReturnId,
  ProviderSupplyCapabilityId,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import type { NetworkParticipationId } from '@markorbit/contracts/network-participation';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  AllocationProviderAcceptanceError,
  type AllocationProviderAcceptanceService
} from './allocation-provider-acceptance.js';
import { ProviderRegistryError, type ProviderRegistryService } from './provider-registry.js';
import { ProviderReturnError, type ProviderReturnService } from './provider-return.js';
import {
  ServicePackageEligibilityError,
  type ServicePackageEligibilityService
} from './service-package-eligibility.js';
import {
  NetworkParticipationError,
  type NetworkParticipationService
} from './network-participation.js';

export interface MgsnHttpServices {
  providerRegistry: ProviderRegistryService;
  servicePackageEligibility: ServicePackageEligibilityService;
  allocationProviderAcceptance: AllocationProviderAcceptanceService;
  providerReturn: ProviderReturnService;
  networkParticipation: NetworkParticipationService;
}

export interface MgsnHttpOptions {
  internalServiceSecret?: string;
  services?: MgsnHttpServices;
}

type Body = any;

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function requireIdempotency(request: JsonRequest, body: Body) {
  const key = request.headers['idempotency-key'];
  if (!key) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== key)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_MISMATCH',
      'Body idempotencyKey must match Idempotency-Key.'
    );
  return key;
}

function mapDomainError(error: unknown): never {
  if (
    error instanceof ProviderRegistryError ||
    error instanceof ServicePackageEligibilityError ||
    error instanceof AllocationProviderAcceptanceError ||
    error instanceof ProviderReturnError ||
    error instanceof NetworkParticipationError
  )
    if (
      error instanceof NetworkParticipationError &&
      (error.code === 'PROVIDER_NOT_FOUND' || error.code === 'PROVIDER_WORKSPACE_MISMATCH')
    )
      throw new HttpError(
        404,
        'NETWORK_PARTICIPATION_NOT_FOUND',
        'Network Participation was not found.'
      );
    else throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

function notFound(entity: string): never {
  throw new HttpError(404, 'NOT_FOUND', `${entity} was not found.`);
}

function assertTargetWorkspace(principal: WorkspacePrincipal, workspaceId: unknown) {
  if (typeof workspaceId !== 'string' || !workspaceId.trim())
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Target Workspace is required.');
  if (workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
}

function assertRecordWorkspace(principal: WorkspacePrincipal, workspaceId: string) {
  if (workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
}

function rejectNetworkParticipationAuthorityPayload(body: Body) {
  const authorityFields = [
    'workspaceId',
    'actorId',
    'providerWorkspaceId',
    'principal',
    'trustedActorId'
  ];
  if (authorityFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'SPOOFED_AUTHORITY_CONTEXT',
      'Network Participation authority must come only from the trusted Workspace Principal.'
    );
}

export function createMgsnHttpRoutes(options: MgsnHttpOptions = {}): JsonRoute[] {
  const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
  const services = () => {
    if (!options.services)
      throw new HttpError(
        503,
        'MGSN_RUNTIME_UNCONFIGURED',
        'MGSN provider execution runtime is not configured.',
        true
      );
    return options.services;
  };
  const trustedPrincipalFor = (request: JsonRequest): WorkspacePrincipal => {
    if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
      throw new HttpError(
        401,
        'UNTRUSTED_INTERNAL_CALLER',
        'Trusted internal authorization is required.'
      );
    let principal: WorkspacePrincipal;
    try {
      principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
    } catch {
      throw new HttpError(
        401,
        'INVALID_INTERNAL_PRINCIPAL',
        'A trusted Workspace Principal is required.'
      );
    }
    return principal;
  };
  const principalFor = (request: JsonRequest, manage: boolean): WorkspacePrincipal => {
    const principal = trustedPrincipalFor(request);
    const permission = manage ? 'execution:manage' : 'execution:read';
    if (!principal.permissions.includes(permission))
      throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
    return principal;
  };
  const networkParticipationOwnerPrincipalFor = (
    request: JsonRequest,
    manage: boolean
  ): WorkspacePrincipal => {
    const principal = trustedPrincipalFor(request);
    const asserted = request.headers['x-markorbit-network-participation-owner-authority'];
    if (manage ? asserted !== 'manage' : asserted !== 'read' && asserted !== 'manage')
      throw new HttpError(
        403,
        'NETWORK_PARTICIPATION_OWNER_AUTHORITY_REQUIRED',
        `Reviewed Network Participation owner ${manage ? 'manage' : 'read'} authority is required.`
      );
    return principal;
  };
  const operation = async <T>(work: () => Promise<T>) => {
    try {
      return await work();
    } catch (error) {
      return mapDomainError(error);
    }
  };

  return [
    {
      method: 'GET',
      path: '/v1/network-participation/providers/:providerId',
      handle: async (request) => {
        const principal = networkParticipationOwnerPrincipalFor(request, false);
        const record = await operation(() =>
          services().networkParticipation.read(
            { workspaceId: principal.workspaceId, actorId: principal.userId },
            request.params.providerId! as ProviderId
          )
        );
        return json(200, { networkParticipation: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/network-participation/providers/:providerId/opt-in',
      handle: async (request) => {
        const principal = networkParticipationOwnerPrincipalFor(request, true);
        const body = bodyOf(request);
        rejectNetworkParticipationAuthorityPayload(body);
        const record = await operation(() =>
          services().networkParticipation.optIn(
            { workspaceId: principal.workspaceId, actorId: principal.userId },
            {
              schemaVersion: body.schemaVersion,
              providerId: request.params.providerId! as ProviderId,
              authorizationReference: body.authorizationReference,
              reason: body.reason,
              idempotencyKey: requireIdempotency(request, body),
              correlationId: body.correlationId
            }
          )
        );
        return json(201, { networkParticipation: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/network-participation/providers/:providerId/state',
      handle: async (request) => {
        const principal = networkParticipationOwnerPrincipalFor(request, true);
        const body = bodyOf(request);
        rejectNetworkParticipationAuthorityPayload(body);
        const record = await operation(() =>
          services().networkParticipation.changeState(
            { workspaceId: principal.workspaceId, actorId: principal.userId },
            {
              schemaVersion: body.schemaVersion,
              action: body.action,
              networkParticipationId: body.networkParticipationId as NetworkParticipationId,
              providerId: request.params.providerId! as ProviderId,
              expectedParticipationVersion: body.expectedParticipationVersion,
              expectedVisibilityPolicyVersion: body.expectedVisibilityPolicyVersion,
              authorizationReference: body.authorizationReference,
              reason: body.reason,
              idempotencyKey: requireIdempotency(request, body),
              correlationId: body.correlationId
            }
          )
        );
        return json(200, { networkParticipation: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/network-participation/providers/:providerId/visibility-policy',
      handle: async (request) => {
        const principal = networkParticipationOwnerPrincipalFor(request, true);
        const body = bodyOf(request);
        rejectNetworkParticipationAuthorityPayload(body);
        const record = await operation(() =>
          services().networkParticipation.replaceVisibilityPolicy(
            { workspaceId: principal.workspaceId, actorId: principal.userId },
            {
              schemaVersion: body.schemaVersion,
              networkParticipationId: body.networkParticipationId as NetworkParticipationId,
              providerId: request.params.providerId! as ProviderId,
              expectedParticipationVersion: body.expectedParticipationVersion,
              expectedVisibilityPolicyVersion: body.expectedVisibilityPolicyVersion,
              replacement: body.replacement,
              authorizationReference: body.authorizationReference,
              reason: body.reason,
              idempotencyKey: requireIdempotency(request, body),
              correlationId: body.correlationId
            }
          )
        );
        return json(200, { networkParticipation: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/providers',
      handle: async (request) => {
        principalFor(request, false);
        return json(200, {
          providers: await operation(() => services().providerRegistry.listProviders())
        });
      }
    },
    {
      method: 'POST',
      path: '/v1/providers',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        const record = await operation(() =>
          services().providerRegistry.createProvider({
            providerWorkspaceId: body.providerWorkspaceId,
            displayName: body.displayName,
            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(201, { provider: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/providers/:providerId',
      handle: async (request) => {
        principalFor(request, false);
        const record = await operation(() =>
          services().providerRegistry.getProvider(request.params.providerId! as ProviderId)
        );
        if (!record) notFound('Provider');
        return json(200, { provider: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/providers/:providerId/status',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        const record = await operation(() =>
          services().providerRegistry.setProviderOperationalStatus({
            providerId: request.params.providerId! as ProviderId,
            expectedVersion: body.expectedVersion,
            operationalStatus: body.operationalStatus,
            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(200, { provider: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/providers/:providerId/supply-capabilities',
      handle: async (request) => {
        principalFor(request, false);
        const records = await operation(() =>
          services().providerRegistry.listCurrentSupplyCapabilities(
            request.params.providerId! as ProviderId
          )
        );
        return json(200, { supplyCapabilities: records });
      }
    },
    {
      method: 'POST',
      path: '/v1/providers/:providerId/supply-capabilities',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        const record = await operation(() =>
          services().providerRegistry.createSupplyCapability({
            ...body,
            providerId: request.params.providerId! as ProviderId,
            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(201, { supplyCapability: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/supply-capabilities/:providerSupplyCapabilityId',
      handle: async (request) => {
        principalFor(request, false);
        const record = await operation(() =>
          services().providerRegistry.getSupplyCapability(
            request.params.providerSupplyCapabilityId! as ProviderSupplyCapabilityId,
            request.query.version ? Number(request.query.version) : undefined
          )
        );
        if (!record) notFound('Provider Supply Capability');
        return json(200, { supplyCapability: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/supply-capabilities/:providerSupplyCapabilityId/revise',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        const record = await operation(() =>
          services().providerRegistry.reviseSupplyCapability({
            ...body,
            providerSupplyCapabilityId: request.params
              .providerSupplyCapabilityId! as ProviderSupplyCapabilityId,
            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(200, { supplyCapability: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/service-packages',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        assertTargetWorkspace(principal, body.workspaceId);
        const record = await operation(() =>
          services().servicePackageEligibility.admitServicePackage({
            ...body,
            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(201, { servicePackage: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/service-packages/:servicePackageId',
      handle: async (request) => {
        const principal = principalFor(request, false);
        const record = await operation(() =>
          services().servicePackageEligibility.getServicePackage(
            request.params.servicePackageId! as ServicePackageId,
            request.query.version ? Number(request.query.version) : undefined
          )
        );
        if (!record) notFound('Service Package');
        assertRecordWorkspace(principal, record.workspaceId);
        return json(200, { servicePackage: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/service-packages/:servicePackageId/candidate-supply-capabilities',
      handle: async (request) => {
        const principal = principalFor(request, false);
        const servicePackage = await operation(() =>
          services().servicePackageEligibility.getServicePackage(
            request.params.servicePackageId! as ServicePackageId
          )
        );
        if (!servicePackage) notFound('Service Package');
        assertRecordWorkspace(principal, servicePackage.workspaceId);
        const records = await operation(() =>
          services().servicePackageEligibility.listCandidateSupplyCapabilities(
            request.params.servicePackageId! as ServicePackageId,
            request.query.limit ? Number(request.query.limit) : 50
          )
        );
        return json(200, { supplyCapabilities: records });
      }
    },
    {
      method: 'POST',
      path: '/v1/service-packages/:servicePackageId/evaluate-provider',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        assertTargetWorkspace(principal, body.workspaceId);
        const record = await operation(() =>
          services().servicePackageEligibility.evaluateProviderEligibility({
            ...body,
            servicePackageId: request.params.servicePackageId! as ServicePackageId,
            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(201, { eligibilityEvaluation: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/eligibility-evaluations/:eligibilityEvaluationId',
      handle: async (request) => {
        const principal = principalFor(request, false);
        const record = await operation(() =>
          services().servicePackageEligibility.getEligibilityEvaluation(
            request.params.eligibilityEvaluationId! as EligibilityEvaluationId
          )
        );
        if (!record) notFound('Eligibility Evaluation');
        assertRecordWorkspace(principal, record.workspaceId);
        return json(200, { eligibilityEvaluation: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/allocations',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        assertTargetWorkspace(principal, body.workspaceId);
        const record = await operation(() =>
          services().allocationProviderAcceptance.allocateProvider({
            ...body,
            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(201, { allocation: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/allocations/:allocationId',
      handle: async (request) => {
        const principal = principalFor(request, false);
        const record = await operation(() =>
          services().allocationProviderAcceptance.getAllocation(
            request.params.allocationId! as AllocationId,
            request.query.version ? Number(request.query.version) : undefined
          )
        );
        if (!record) notFound('Allocation');
        assertRecordWorkspace(principal, record.workspaceId);
        return json(200, { allocation: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/provider-acceptances/:providerAcceptanceId',
      handle: async (request) => {
        const principal = principalFor(request, false);
        const record = await operation(() =>
          services().allocationProviderAcceptance.getProviderAcceptance(
            request.params.providerAcceptanceId! as ProviderAcceptanceId
          )
        );
        if (!record) notFound('Provider Acceptance');
        assertRecordWorkspace(principal, record.workspaceId);
        return json(200, { providerAcceptance: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/provider-returns/:providerReturnId/handoff',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        assertTargetWorkspace(principal, body.workspaceId);
        const record = await operation(() =>
          services().providerReturn.handoffProviderReturnEvidence({
            ...body,
            providerReturnId: request.params.providerReturnId! as ProviderReturnId,
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(201, { evidenceHandoff: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/provider/allocations/:allocationId',
      handle: async (request) => {
        const principal = principalFor(request, false);
        const record = await operation(() =>
          services().allocationProviderAcceptance.getAllocation(
            request.params.allocationId! as AllocationId,
            request.query.version ? Number(request.query.version) : undefined
          )
        );
        if (!record || record.provider.providerWorkspaceId !== principal.workspaceId)
          notFound('Allocation');
        return json(200, { allocation: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/provider/allocations/:allocationId/respond',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        const record = await operation(() =>
          services().allocationProviderAcceptance.respondToAllocation({
            ...body,
            allocationId: request.params.allocationId! as AllocationId,
            principal: {
              actorId: principal.userId,
              providerWorkspaceId: principal.workspaceId
            },
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(201, { providerAcceptance: record });
      }
    },
    {
      method: 'POST',
      path: '/v1/provider/returns',
      handle: async (request) => {
        const principal = principalFor(request, true);
        const body = bodyOf(request);
        const record = await operation(() =>
          services().providerReturn.createProviderReturn({
            ...body,
            principal: {
              actorId: principal.userId,
              providerWorkspaceId: principal.workspaceId
            },
            idempotencyKey: requireIdempotency(request, body)
          })
        );
        return json(201, { providerReturn: record });
      }
    },
    {
      method: 'GET',
      path: '/v1/provider/returns/:providerReturnId',
      handle: async (request) => {
        const principal = principalFor(request, false);
        const record = await operation(() =>
          services().providerReturn.getProviderReturn(
            request.params.providerReturnId! as ProviderReturnId,
            request.query.version ? Number(request.query.version) : undefined
          )
        );
        if (!record || record.providerWorkspaceId !== principal.workspaceId)
          notFound('Provider Return');
        return json(200, { providerReturn: record });
      }
    }
  ];
}
