import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient
} from './auth.js';
import { authorizeGovernedWorkspaceMutation } from './governed-action.js';

export const PROVIDER_WORKSPACE_HEADER_NAME = 'x-markorbit-provider-workspace-id';
export const GOVERNED_HUMAN_ACTION_HEADER_NAME =
  'x-markorbit-governed-network-human-action' as const;

export interface GatewayMgsnRouteOptions {
  mgsnUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
}

type RouteMethod = 'GET' | 'POST';
type RouteDefinition = readonly [RouteMethod, string];
type NetworkParticipationOwnerAuthority = 'read' | 'manage';
type GovernedHumanActionKind = 'PROVIDER_SELECTION' | 'CONTROLLED_HANDOFF';
type GovernedPermission = 'workspace:read' | 'workspace:manage';
interface GovernedRouteDefinition {
  method: 'POST';
  path: string;
  permission: GovernedPermission;
  idempotency: boolean;
  humanAction?: GovernedHumanActionKind;
  forbiddenBodyFields?: readonly string[];
}

const controlledHandoffPreparationForbiddenAuthorityFields = [
  'workspaceId',
  'userId',
  'membershipId',
  'actorId',
  'principal',
  'principalReference',
  'trustedHumanAuthority',
  'directExecutorAuthority',
  'currentSelectionValidation',
  'currentSourceVersions',
  'authorizedProjection',
  'recipient',
  'purposeFingerprintSha256',
  'projectionFingerprintSha256',
  'sourceSetFingerprintSha256',
  'previewFingerprintSha256',
  'authorityReference',
  'authorityVersion'
] as const;

const operationsRoutes: readonly RouteDefinition[] = [
  ['GET', '/api/mgsn/providers'],
  ['POST', '/api/mgsn/providers'],
  ['GET', '/api/mgsn/providers/:providerId'],
  ['POST', '/api/mgsn/providers/:providerId/status'],
  ['GET', '/api/mgsn/providers/:providerId/supply-capabilities'],
  ['POST', '/api/mgsn/providers/:providerId/supply-capabilities'],
  ['GET', '/api/mgsn/supply-capabilities/:providerSupplyCapabilityId'],
  ['POST', '/api/mgsn/supply-capabilities/:providerSupplyCapabilityId/revise'],
  ['POST', '/api/mgsn/service-packages'],
  ['GET', '/api/mgsn/service-packages/:servicePackageId'],
  ['GET', '/api/mgsn/service-packages/:servicePackageId/candidate-supply-capabilities'],
  ['POST', '/api/mgsn/service-packages/:servicePackageId/evaluate-provider'],
  ['GET', '/api/mgsn/eligibility-evaluations/:eligibilityEvaluationId'],
  ['POST', '/api/mgsn/allocations'],
  ['GET', '/api/mgsn/allocations/:allocationId'],
  ['GET', '/api/mgsn/provider-acceptances/:providerAcceptanceId'],
  ['POST', '/api/mgsn/provider-returns/:providerReturnId/handoff']
];

const governedRoutes: readonly GovernedRouteDefinition[] = [
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/discovery/evaluate',
    permission: 'workspace:read',
    idempotency: false
  },
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/selections',
    permission: 'workspace:manage',
    idempotency: true,
    humanAction: 'PROVIDER_SELECTION'
  },
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/selections/:providerSelectionId/revoke',
    permission: 'workspace:manage',
    idempotency: true,
    humanAction: 'PROVIDER_SELECTION'
  },
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/selections/:providerSelectionId/validate-current',
    permission: 'workspace:read',
    idempotency: false
  },
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/handoffs/prepare',
    permission: 'workspace:read',
    idempotency: false,
    forbiddenBodyFields: controlledHandoffPreparationForbiddenAuthorityFields
  },
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/handoffs',
    permission: 'workspace:manage',
    idempotency: true,
    humanAction: 'CONTROLLED_HANDOFF'
  },
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/handoffs/:controlledHandoffId/revoke',
    permission: 'workspace:manage',
    idempotency: true,
    humanAction: 'CONTROLLED_HANDOFF'
  },
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/handoffs/:controlledHandoffId/validate-current',
    permission: 'workspace:read',
    idempotency: false
  },
  {
    method: 'POST',
    path: '/api/mgsn/governed-network/allocations',
    permission: 'workspace:manage',
    idempotency: true
  }
];

const networkParticipationRoutes: readonly RouteDefinition[] = [
  ['GET', '/api/mgsn/network-participation/providers/:providerId'],
  ['POST', '/api/mgsn/network-participation/providers/:providerId/opt-in'],
  ['POST', '/api/mgsn/network-participation/providers/:providerId/state'],
  ['POST', '/api/mgsn/network-participation/providers/:providerId/visibility-policy']
];

const providerRoutes: readonly RouteDefinition[] = [
  ['GET', '/api/provider/work-items'],
  ['GET', '/api/provider/work-items/:allocationId'],
  ['GET', '/api/provider/allocations/:allocationId'],
  ['POST', '/api/provider/allocations/:allocationId/respond'],
  ['POST', '/api/provider/returns'],
  ['GET', '/api/provider/returns/:providerReturnId']
];

function requestToken(request: JsonRequest) {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function recordBody(request: JsonRequest): Record<string, unknown> {
  if (request.body === undefined || request.body === null) return {};
  if (typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function mapAuthentication(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      ? 503
      : error.code === 'INVALID_WORKSPACE_CONTEXT'
        ? 400
        : [
              'MEMBERSHIP_REQUIRED',
              'MEMBERSHIP_SUSPENDED',
              'WORKSPACE_ARCHIVED',
              'PERMISSION_DENIED',
              'INVALID_CSRF_TOKEN',
              'UNTRUSTED_ORIGIN'
            ].includes(error.code)
          ? 403
          : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
}

function requirePermission(principal: WorkspacePrincipal, mutation: boolean) {
  const permission = mutation ? 'execution:manage' : 'execution:read';
  if (!principal.permissions.includes(permission))
    throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
}

function requireNetworkParticipationPermission(
  principal: WorkspacePrincipal,
  mutation: boolean
): NetworkParticipationOwnerAuthority {
  const permission = mutation ? 'workspace:manage' : 'workspace:read';
  if (!principal.permissions.includes(permission))
    throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
  return mutation ? 'manage' : 'read';
}

function forbidProviderIdentityPayload(request: JsonRequest) {
  const body = recordBody(request);
  if ('providerId' in body || 'providerWorkspaceId' in body)
    throw new HttpError(
      400,
      'PROVIDER_IDENTITY_PAYLOAD_FORBIDDEN',
      'Provider identity is derived from the authenticated Provider Workspace.'
    );
}

function validateProviderWorkQuery(request: JsonRequest) {
  if (request.path === '/api/provider/work-items') {
    const allowed = new Set(['limit', 'cursor']);
    const forbidden = Object.keys(request.query).filter((key) => !allowed.has(key));
    if (forbidden.length > 0)
      throw new HttpError(
        400,
        'PROVIDER_WORK_QUERY_FORBIDDEN',
        'Provider work list accepts only limit and cursor query controls.'
      );
    return;
  }
  if (request.path.startsWith('/api/provider/work-items/') && Object.keys(request.query).length > 0)
    throw new HttpError(
      400,
      'PROVIDER_WORK_QUERY_FORBIDDEN',
      'Provider work detail does not accept query controls.'
    );
}

function downstreamPath(path: string, provider: boolean) {
  return provider
    ? path.replace('/api/provider', '/v1/provider')
    : path.replace('/api/mgsn', '/v1');
}

export function createGatewayMgsnRoutes(options: GatewayMgsnRouteOptions): JsonRoute[] {
  const authentication = () => {
    if (!options.authenticationClient)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.',
        true
      );
    return options.authenticationClient;
  };
  const correlation = (request: JsonRequest) => request.headers['x-correlation-id'];
  const resolvePrincipal = async (request: JsonRequest, provider: boolean) => {
    const workspaceId = provider
      ? request.headers[PROVIDER_WORKSPACE_HEADER_NAME]
      : (request.headers['x-markorbit-workspace-id'] ??
        (typeof recordBody(request).workspaceId === 'string'
          ? (recordBody(request).workspaceId as string)
          : undefined));
    if (!workspaceId)
      throw new HttpError(
        400,
        provider ? 'PROVIDER_WORKSPACE_CONTEXT_REQUIRED' : 'INVALID_WORKSPACE_CONTEXT',
        provider ? 'Provider Workspace context is required.' : 'Workspace context is required.'
      );
    try {
      return await authentication().resolveWorkspace(
        requestToken(request),
        workspaceId,
        correlation(request)
      );
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const forward = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    provider: boolean,
    networkParticipationOwnerAuthority?: NetworkParticipationOwnerAuthority,
    governedHumanAction?: string
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'MGSN_INTERNAL_AUTHORIZATION_UNAVAILABLE',
        'MGSN internal authorization is unavailable.',
        true
      );
    const search = new URLSearchParams(request.query).toString();
    try {
      const response = await fetch(
        `${options.mgsnUrl}${downstreamPath(request.path, provider)}${search ? `?${search}` : ''}`,
        {
          method: request.method,
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': options.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': principal.workspaceId,
            ...(networkParticipationOwnerAuthority
              ? {
                  'x-markorbit-network-participation-owner-authority':
                    networkParticipationOwnerAuthority
                }
              : {}),
            ...(governedHumanAction
              ? { [GOVERNED_HUMAN_ACTION_HEADER_NAME]: governedHumanAction }
              : {}),
            ...(correlation(request) ? { 'x-correlation-id': correlation(request)! } : {}),
            ...(request.headers['idempotency-key']
              ? { 'idempotency-key': request.headers['idempotency-key'] }
              : {})
          },
          ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
        }
      );
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'MGSN_UNAVAILABLE', 'MGSN service is unavailable.', true);
    }
  };
  const handle = async (request: JsonRequest, provider: boolean) => {
    const mutation = request.method !== 'GET';
    if (provider && mutation) forbidProviderIdentityPayload(request);
    try {
      const principal = await resolvePrincipal(request, provider);
      requirePermission(principal, mutation);
      if (provider && !mutation) validateProviderWorkQuery(request);
      if (mutation) {
        requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
        validateCsrf(
          principal.sessionId,
          options.csrfSecret,
          request.headers['x-markorbit-csrf-token']
        );
      }
      return forward(request, principal, provider);
    } catch (error) {
      return mapAuthentication(error);
    }
  };
  const handleGoverned = async (request: JsonRequest, route: GovernedRouteDefinition) => {
    try {
      const context = await authorizeGovernedWorkspaceMutation(
        request,
        {
          authenticationClient: authentication(),
          csrfSecret: options.csrfSecret,
          allowedOrigins: options.allowedOrigins
        },
        {
          permission: route.permission,
          idempotency: route.idempotency ? 'REQUIRED' : 'OPTIONAL',
          ...(route.idempotency
            ? {
                idempotencyError: {
                  code: 'IDEMPOTENCY_KEY_REQUIRED',
                  message: 'Idempotency-Key is required for governed-network mutations.'
                }
              }
            : {}),
          ...(route.forbiddenBodyFields ? { forbiddenBodyFields: route.forbiddenBodyFields } : {}),
          forbiddenHeaders: [GOVERNED_HUMAN_ACTION_HEADER_NAME],
          browserAuthorityError: {
            code: 'BROWSER_GOVERNED_AUTHORITY_FORBIDDEN',
            message: () => 'Browser-supplied governed-network authority is not accepted.'
          },
          workspaceContextError: {
            code: 'INVALID_WORKSPACE_CONTEXT',
            message: 'Trusted Workspace header is required for governed-network operations.'
          },
          ...(route.humanAction ? { humanAction: route.humanAction } : {})
        }
      );
      return forward(request, context.principal, false, undefined, context.humanActionEnvelope);
    } catch (error) {
      return mapAuthentication(error);
    }
  };
  const handleNetworkParticipation = async (request: JsonRequest) => {
    const mutation = request.method !== 'GET';
    try {
      if (mutation) {
        const context = await authorizeGovernedWorkspaceMutation(
          request,
          {
            authenticationClient: authentication(),
            csrfSecret: options.csrfSecret,
            allowedOrigins: options.allowedOrigins
          },
          {
            permission: 'workspace:manage',
            workspaceHeaderName: PROVIDER_WORKSPACE_HEADER_NAME,
            workspaceContextError: {
              code: 'PROVIDER_WORKSPACE_CONTEXT_REQUIRED',
              message: 'Provider Workspace context is required.'
            },
            idempotency: 'REQUIRED',
            idempotencyError: {
              code: 'IDEMPOTENCY_KEY_REQUIRED',
              message: 'Idempotency-Key is required for Network Participation mutations.'
            },
            forbiddenBodyFields: [
              'workspaceId',
              'actorId',
              'providerWorkspaceId',
              'providerId',
              'principal',
              'trustedActorId'
            ],
            browserAuthorityError: {
              code: 'NETWORK_PARTICIPATION_AUTHORITY_PAYLOAD_FORBIDDEN',
              message: () =>
                'Network Participation identity and authority come only from the authenticated Provider Workspace.'
            }
          }
        );
        return forward(request, context.principal, false, 'manage');
      }
      const principal = await resolvePrincipal(request, true);
      const ownerAuthority = requireNetworkParticipationPermission(principal, false);
      return forward(request, principal, false, ownerAuthority);
    } catch (error) {
      return mapAuthentication(error);
    }
  };
  return [
    ...governedRoutes.map((route): JsonRoute => ({
      method: route.method,
      path: route.path,
      handle: (request) => handleGoverned(request, route)
    })),
    ...networkParticipationRoutes.map(([method, path]): JsonRoute => ({
      method,
      path,
      handle: handleNetworkParticipation
    })),
    ...operationsRoutes.map(([method, path]): JsonRoute => ({
      method,
      path,
      handle: (request) => handle(request, false)
    })),
    ...providerRoutes.map(([method, path]): JsonRoute => ({
      method,
      path,
      handle: (request) => handle(request, true)
    }))
  ];
}
