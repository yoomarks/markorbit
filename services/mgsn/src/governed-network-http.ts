/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- trusted transport payloads are narrowed before owner services revalidate canonical domain contracts. */
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { ProviderDiscoveryRequestReferenceV1 } from '@markorbit/contracts/provider-discovery';
import type {
  AuthorizeOrReplaceControlledHandoffCommandV1,
  ControlledHandoffConsumptionAttemptV1,
  ControlledHandoffId,
  ControlledHandoffValidationPurpose,
  RevokeControlledHandoffCommandV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  CreateOrReplaceProviderSelectionCommandV1,
  ProviderSelectionId,
  ProviderSelectionValidationPurpose,
  RevokeProviderSelectionCommandV1
} from '@markorbit/contracts/provider-selection';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ControlledHandoffError,
  type ControlledHandoffPrincipal,
  type ControlledPrivacyHandoffService
} from './controlled-privacy-handoff.js';
import { GovernedAllocationError, type GovernedAllocationService } from './governed-allocation.js';
import type { ProviderDiscoveryCurrentResponsibilityService } from './provider-discovery-current-responsibility.js';
import { ProviderDiscoveryError } from './provider-discovery.js';
import {
  ProviderSelectionError,
  type ProviderSelectionPrincipal,
  type ProviderSelectionService
} from './provider-selection.js';

export const MGSN_GOVERNED_HUMAN_ACTION_HEADER =
  'x-markorbit-governed-network-human-action' as const;

export type MgsnGovernedHumanActionKind = 'PROVIDER_SELECTION' | 'CONTROLLED_HANDOFF';

/**
 * Internal transport evidence only. This envelope is not a bearer capability and is unusable
 * without the existing internal-service secret plus an exact trusted Workspace Principal.
 * Browser/Gateway code must construct it from a separately reviewed explicit human action and must
 * never forward a browser-supplied value verbatim.
 */
export interface MgsnGovernedHumanActionEnvelopeV1 {
  schemaVersion: 1;
  kind: MgsnGovernedHumanActionKind;
  actorKind: 'HUMAN_USER';
  workspaceId: string;
  userId: string;
  membershipId: string;
  principalReference: string;
  authorityReference: string;
  authorityVersion: number | string;
  authenticatedAt: string;
  affirmativeHumanActionEvidenceReference: string;
  payloadIdentityAuthoritative: false;
}

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

type Body = Record<string, unknown>;

const forbiddenTopLevelAuthorityFields = new Set([
  'workspaceId',
  'actorId',
  'userId',
  'membershipId',
  'principal',
  'principalReference',
  'workspaceMembershipReference',
  'requesterWorkspaceId',
  'originatingWorkspaceId',
  'trustedHumanAuthority',
  'selectionAuthorityReference',
  'handoffAuthorityReference',
  'authorityReference',
  'authorityVersion',
  'authenticatedAt',
  'affirmativeHumanActionEvidenceReference'
]);

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_GOVERNED_NETWORK_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function objectOf(value: unknown, field: string): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_GOVERNED_NETWORK_REQUEST', `${field} must be an object.`);
  return value as Body;
}

function rejectTopLevelAuthority(body: Body): void {
  const field = Object.keys(body).find((candidate) => forbiddenTopLevelAuthorityFields.has(candidate));
  if (field)
    throw new HttpError(
      400,
      'SPOOFED_GOVERNED_NETWORK_AUTHORITY',
      `${field} cannot be supplied as governed-network authority.`
    );
}

function requireIdempotency(request: JsonRequest, body: Body): string {
  const key = request.headers['idempotency-key']?.trim();
  if (!key)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key is required for governed-network mutations.'
    );
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== key)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_MISMATCH',
      'Body idempotencyKey must match Idempotency-Key.'
    );
  return key;
}

function validVersion(value: unknown): value is number | string {
  return (
    (typeof value === 'number' && Number.isInteger(value) && value > 0) ||
    (typeof value === 'string' && value.trim().length > 0)
  );
}

function parseHumanActionEnvelope(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  expectedKind: MgsnGovernedHumanActionKind
): MgsnGovernedHumanActionEnvelopeV1 {
  const encoded = request.headers[MGSN_GOVERNED_HUMAN_ACTION_HEADER];
  if (!encoded)
    throw new HttpError(
      403,
      'GOVERNED_HUMAN_ACTION_REQUIRED',
      `A reviewed ${expectedKind} human-action authority is required.`
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority is invalid.'
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority is invalid.'
    );
  const envelope = parsed as Partial<MgsnGovernedHumanActionEnvelopeV1>;
  const strings = [
    envelope.workspaceId,
    envelope.userId,
    envelope.membershipId,
    envelope.principalReference,
    envelope.authorityReference,
    envelope.authenticatedAt,
    envelope.affirmativeHumanActionEvidenceReference
  ];
  if (
    envelope.schemaVersion !== 1 ||
    envelope.kind !== expectedKind ||
    envelope.actorKind !== 'HUMAN_USER' ||
    envelope.payloadIdentityAuthoritative !== false ||
    strings.some((value) => typeof value !== 'string' || !value.trim()) ||
    !validVersion(envelope.authorityVersion) ||
    !Number.isFinite(Date.parse(envelope.authenticatedAt!)) ||
    envelope.workspaceId!.toLowerCase() !== principal.workspaceId.toLowerCase() ||
    envelope.userId!.toLowerCase() !== principal.userId.toLowerCase() ||
    envelope.membershipId!.toLowerCase() !== principal.membershipId.toLowerCase()
  )
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority does not match the trusted Workspace Principal.'
    );
  return structuredClone(envelope as MgsnGovernedHumanActionEnvelopeV1);
}

function selectionPrincipal(
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1
): ProviderSelectionPrincipal {
  return {
    workspaceId: principal.workspaceId,
    actorId: principal.userId,
    actorKind: 'HUMAN_USER',
    principalReference: envelope.principalReference,
    workspaceMembershipReference: principal.membershipId,
    selectionAuthorityReference: envelope.authorityReference,
    selectionAuthorityVersion: envelope.authorityVersion,
    authenticatedAt: envelope.authenticatedAt,
    affirmativeHumanActionEvidenceReference: envelope.affirmativeHumanActionEvidenceReference
  };
}

function selectionAuthority(
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1
): CreateOrReplaceProviderSelectionCommandV1['trustedHumanAuthority'] {
  return {
    source: 'CORE_WORKSPACE_PRINCIPAL',
    requesterWorkspaceId: principal.workspaceId,
    selectingActorId: principal.userId,
    principalReference: envelope.principalReference,
    workspaceMembershipReference: principal.membershipId,
    selectionAuthorityReference: envelope.authorityReference,
    selectionAuthorityVersion: envelope.authorityVersion,
    authenticatedAt: envelope.authenticatedAt,
    affirmativeHumanActionEvidenceReference: envelope.affirmativeHumanActionEvidenceReference,
    payloadIdentityAuthoritative: false
  };
}

function handoffPrincipal(
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1
): ControlledHandoffPrincipal {
  return {
    workspaceId: principal.workspaceId,
    actorId: principal.userId,
    actorKind: 'HUMAN_USER',
    principalReference: envelope.principalReference,
    workspaceMembershipReference: principal.membershipId,
    handoffAuthorityReference: envelope.authorityReference,
    handoffAuthorityVersion: envelope.authorityVersion,
    authenticatedAt: envelope.authenticatedAt,
    affirmativeHumanActionEvidenceReference: envelope.affirmativeHumanActionEvidenceReference
  };
}

function handoffAuthority(
  principal: WorkspacePrincipal,
  envelope: MgsnGovernedHumanActionEnvelopeV1
): AuthorizeOrReplaceControlledHandoffCommandV1['trustedHumanAuthority'] {
  return {
    source: 'CORE_WORKSPACE_PRINCIPAL',
    originatingWorkspaceId: principal.workspaceId,
    authorizingActorId: principal.userId,
    principalReference: envelope.principalReference,
    workspaceMembershipReference: principal.membershipId,
    handoffAuthorityReference: envelope.authorityReference,
    handoffAuthorityVersion: envelope.authorityVersion,
    authenticatedAt: envelope.authenticatedAt,
    affirmativeHumanActionEvidenceReference: envelope.affirmativeHumanActionEvidenceReference,
    payloadIdentityAuthoritative: false
  };
}

function mapDomainError(error: unknown): never {
  if (
    error instanceof ProviderDiscoveryError ||
    error instanceof ProviderSelectionError ||
    error instanceof ControlledHandoffError ||
    error instanceof GovernedAllocationError
  )
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
  const trustedPrincipalFor = (request: JsonRequest): WorkspacePrincipal => {
    if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
      throw new HttpError(
        401,
        'UNTRUSTED_INTERNAL_CALLER',
        'Trusted internal authorization is required.'
      );
    try {
      return parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
    } catch {
      throw new HttpError(
        401,
        'INVALID_INTERNAL_PRINCIPAL',
        'A trusted Workspace Principal is required.'
      );
    }
  };
  const operation = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      return mapDomainError(error);
    }
  };

  return [
    {
      method: 'POST',
      path: '/v1/governed-network/discovery/evaluate',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const discoveryRequest = {
          ...body,
          requesterWorkspaceId: principal.workspaceId
        } as unknown as ProviderDiscoveryRequestReferenceV1;
        const result = await operation(() =>
          services().providerDiscovery.evaluate(
            { workspaceId: principal.workspaceId, actorId: principal.userId },
            discoveryRequest
          )
        );
        return json(200, { providerDiscovery: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/selections',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');
        const sourceLineage = objectOf(body.sourceLineage, 'sourceLineage');
        const discoveryRequest = objectOf(sourceLineage.discoveryRequest, 'sourceLineage.discoveryRequest');
        const command = {
          ...body,
          requesterWorkspaceId: principal.workspaceId,
          sourceLineage: {
            ...sourceLineage,
            discoveryRequest: {
              ...discoveryRequest,
              requesterWorkspaceId: principal.workspaceId
            }
          },
          trustedHumanAuthority: selectionAuthority(principal, envelope),
          idempotencyKey: requireIdempotency(request, body)
        } as unknown as CreateOrReplaceProviderSelectionCommandV1;
        const result = await operation(() =>
          services().providerSelection.createOrReplace(selectionPrincipal(principal, envelope), command)
        );
        return json(result.mutation === 'CREATED' ? 201 : 200, { providerSelection: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/selections/:providerSelectionId/revoke',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');
        const target = objectOf(body.target, 'target');
        if (
          target.providerSelectionId !== undefined &&
          target.providerSelectionId !== request.params.providerSelectionId
        )
          throw new HttpError(
            400,
            'GOVERNED_NETWORK_TARGET_MISMATCH',
            'Selection route target does not match the command target.'
          );
        const command = {
          ...body,
          requesterWorkspaceId: principal.workspaceId,
          target: {
            ...target,
            providerSelectionId: request.params.providerSelectionId! as ProviderSelectionId
          },
          trustedHumanAuthority: selectionAuthority(principal, envelope),
          idempotencyKey: requireIdempotency(request, body)
        } as unknown as RevokeProviderSelectionCommandV1;
        const result = await operation(() =>
          services().providerSelection.revoke(selectionPrincipal(principal, envelope), command)
        );
        return json(200, { providerSelection: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/selections/:providerSelectionId/validate-current',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const purpose = body.purpose as ProviderSelectionValidationPurpose;
        if (!['CONTROLLED_HANDOFF_REVIEW', 'ALLOCATION_PREREQUISITE_REVIEW'].includes(purpose))
          throw new HttpError(
            400,
            'INVALID_GOVERNED_NETWORK_REQUEST',
            'Selection validation purpose is not available on the Workplace producer.'
          );
        const result = await operation(() =>
          services().providerSelection.validateCurrent(
            { workspaceId: principal.workspaceId },
            {
              scope: body.scope as CreateOrReplaceProviderSelectionCommandV1['scope'],
              providerSelectionId: request.params.providerSelectionId! as ProviderSelectionId,
              purpose,
              ...(typeof body.checkedAt === 'string' ? { checkedAt: body.checkedAt } : {})
            }
          )
        );
        return json(200, { providerSelectionValidation: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/handoffs',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');
        const preview = objectOf(body.privacyPreviewAcknowledgement, 'privacyPreviewAcknowledgement');
        const command = {
          ...body,
          originatingWorkspaceId: principal.workspaceId,
          trustedHumanAuthority: handoffAuthority(principal, envelope),
          privacyPreviewAcknowledgement: {
            ...preview,
            originatingWorkspaceId: principal.workspaceId
          },
          idempotencyKey: requireIdempotency(request, body)
        } as unknown as AuthorizeOrReplaceControlledHandoffCommandV1;
        const result = await operation(() =>
          services().controlledHandoff.authorizeOrReplace(handoffPrincipal(principal, envelope), command)
        );
        return json(result.mutation === 'AUTHORIZED' ? 201 : 200, { controlledHandoff: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/handoffs/:controlledHandoffId/revoke',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');
        const target = objectOf(body.target, 'target');
        if (
          target.controlledHandoffId !== undefined &&
          target.controlledHandoffId !== request.params.controlledHandoffId
        )
          throw new HttpError(
            400,
            'GOVERNED_NETWORK_TARGET_MISMATCH',
            'Handoff route target does not match the command target.'
          );
        const command = {
          ...body,
          originatingWorkspaceId: principal.workspaceId,
          target: {
            ...target,
            controlledHandoffId: request.params.controlledHandoffId! as ControlledHandoffId
          },
          trustedHumanAuthority: handoffAuthority(principal, envelope),
          idempotencyKey: requireIdempotency(request, body)
        } as unknown as RevokeControlledHandoffCommandV1;
        const result = await operation(() =>
          services().controlledHandoff.revoke(handoffPrincipal(principal, envelope), command)
        );
        return json(200, { controlledHandoff: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/handoffs/:controlledHandoffId/validate-current',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const purpose = body.purpose as ControlledHandoffValidationPurpose;
        if (!['HANDOFF_CONSUMPTION', 'PRIVACY_PREVIEW_REFRESH'].includes(purpose))
          throw new HttpError(
            400,
            'INVALID_GOVERNED_NETWORK_REQUEST',
            'Handoff validation purpose is not available on the Workplace producer.'
          );
        const envelope = objectOf(body.envelope, 'envelope');
        const attempt = objectOf(body.attempt, 'attempt');
        if (attempt.artifactRetrievalRequested !== false)
          throw new HttpError(
            403,
            'ARTIFACT_RETRIEVAL_NOT_AUTHORIZED',
            'Generic governed-network transport cannot request evidence artifacts.'
          );
        const validationAttempt = {
          ...attempt,
          originatingWorkspaceId: principal.workspaceId
        } as unknown as ControlledHandoffConsumptionAttemptV1;
        const result = await operation(() =>
          services().controlledHandoff.validateCurrent(
            { workspaceId: principal.workspaceId },
            {
              envelope: {
                controlledHandoffId: request.params.controlledHandoffId! as ControlledHandoffId,
                version: Number(envelope.version)
              },
              purpose,
              attempt: validationAttempt
            }
          )
        );
        return json(200, { controlledHandoffValidation: result });
      }
    },
    {
      method: 'POST',
      path: '/v1/governed-network/allocations',
      handle: async (request) => {
        const principal = trustedPrincipalFor(request);
        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const result = await operation(() =>
          services().governedAllocation.allocate({
            ...body,
            workspaceId: principal.workspaceId,
            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          } as Parameters<GovernedAllocationService['allocate']>[0])
        );
        return json(201, { governedAllocation: result });
      }
    }
  ];
}
