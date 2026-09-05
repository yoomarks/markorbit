import { createHash } from 'node:crypto';
import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  GovernedHumanActionReceiptClientError,
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient,
  type GovernedHumanActionReceiptMaterializationV1
} from './auth.js';

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
}

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

function mapGovernedReceipt(error: unknown): never {
  if (!(error instanceof GovernedHumanActionReceiptClientError)) throw error;
  throw new HttpError(error.status, error.code, error.message, error.status === 503);
}

function requirePermission(principal: WorkspacePrincipal, mutation: boolean) {
  const permission = mutation ? 'execution:manage' : 'execution:read';
  if (!principal.permissions.includes(permission))
    throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
}

function requireGovernedPermission(principal: WorkspacePrincipal, permission: GovernedPermission) {
  if (!principal.permissions.includes(permission))
    throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function requireGovernedIdempotency(request: JsonRequest): string {
  const key = request.headers['idempotency-key']?.trim();
  if (!key)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key is required for governed-network mutations.'
    );
  return key;
}

function forbidBrowserGovernedAuthority(request: JsonRequest): void {
  if (request.headers[GOVERNED_HUMAN_ACTION_HEADER_NAME])
    throw new HttpError(
      400,
      'BROWSER_GOVERNED_AUTHORITY_FORBIDDEN',
      'Browser-supplied governed-network authority is not accepted.'
    );
}

async function governedHumanActionEnvelope(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  kind: GovernedHumanActionKind,
  authentication: CoreAuthenticationClient,
  correlationId?: string
): Promise<string> {
  const authenticatedAt = principal.sessionCreatedAt;
  if (!authenticatedAt || !Number.isFinite(Date.parse(authenticatedAt)))
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core session authentication time is unavailable for governed human action.',
      true
    );
  const materialize = authentication.materializeGovernedHumanActionReceipt;
  if (!materialize)
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core governed human-action receipt authority is unavailable.',
      true
    );
  const idempotencyKey = requireGovernedIdempotency(request);
  const principalReference = `core-workspace-principal:${fingerprint({
    kind: principal.kind,
    workspaceId: principal.workspaceId.toLowerCase(),
    userId: principal.userId,
    membershipId: principal.membershipId,
    role: principal.role,
    permissions: [...principal.permissions].sort(),
    sessionCreatedAt: authenticatedAt,
    sessionExpiresAt: principal.sessionExpiresAt
  })}`;
  const actionFingerprint = fingerprint({
    kind,
    principalReference,
    method: request.method,
    path: request.path,
    idempotencyKey,
    body: request.body ?? {}
  });
  const authorityReference = `gateway-governed-action:${kind.toLowerCase()}:${actionFingerprint}`;
  const materialization: GovernedHumanActionReceiptMaterializationV1 = {
    schemaVersion: 1,
    kind,
    workspaceId: principal.workspaceId,
    userId: principal.userId,
    membershipId: principal.membershipId,
    principalReference,
    authorityReference,
    idempotencyKeySha256: fingerprint(idempotencyKey),
    requestFingerprintSha256: actionFingerprint,
    authenticatedAt
  };
  let receipt;
  try {
    receipt = await materialize.call(authentication, materialization, correlationId);
  } catch (error) {
    return mapGovernedReceipt(error);
  }
  if (
    receipt.schemaVersion !== 1 ||
    receipt.kind !== materialization.kind ||
    receipt.workspaceId !== materialization.workspaceId ||
    receipt.userId !== materialization.userId ||
    receipt.membershipId !== materialization.membershipId ||
    receipt.principalReference !== materialization.principalReference ||
    receipt.authorityReference !== materialization.authorityReference ||
    receipt.idempotencyKeySha256 !== materialization.idempotencyKeySha256 ||
    receipt.requestFingerprintSha256 !== materialization.requestFingerprintSha256 ||
    receipt.authenticatedAt !== materialization.authenticatedAt ||
    typeof receipt.receiptReference !== 'string' ||
    !receipt.receiptReference.startsWith('core-governed-human-action-receipt:')
  )
    throw new HttpError(
      503,
      'GOVERNED_HUMAN_AUTHORITY_UNAVAILABLE',
      'Core governed human-action receipt did not match the trusted action context.',
      true
    );
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      kind,
      actorKind: 'HUMAN_USER',
      workspaceId: principal.workspaceId,
      userId: principal.userId,
      membershipId: principal.membershipId,
      principalReference,
      authorityReference,
      authorityVersion: 1,
      authenticatedAt,
      affirmativeHumanActionEvidenceReference: receipt.receiptReference,
      payloadIdentityAuthoritative: false
    }),
    'utf8'
  ).toString('base64url');
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

function forbidNetworkParticipationAuthorityPayload(request: JsonRequest) {
  const body = recordBody(request);
  const forbidden = [
    'workspaceId',
    'actorId',
    'providerWorkspaceId',
    'providerId',
    'principal',
    'trustedActorId'
  ];
  if (forbidden.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'NETWORK_PARTICIPATION_AUTHORITY_PAYLOAD_FORBIDDEN',
      'Network Participation identity and authority come only from the authenticated Provider Workspace.'
    );
}

function requireNetworkParticipationIdempotency(request: JsonRequest) {
  if (!request.headers['idempotency-key'])
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key is required for Network Participation mutations.'
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
  const resolveGovernedPrincipal = async (request: JsonRequest) => {
    const workspaceId = request.headers['x-markorbit-workspace-id'];
    if (!workspaceId)
      throw new HttpError(
        400,
        'INVALID_WORKSPACE_CONTEXT',
        'Trusted Workspace header is required for governed-network operations.'
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
      const principal = await resolveGovernedPrincipal(request);
      requireGovernedPermission(principal, route.permission);
      requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
      validateCsrf(
        principal.sessionId,
        options.csrfSecret,
        request.headers['x-markorbit-csrf-token']
      );
      forbidBrowserGovernedAuthority(request);
      if (route.idempotency) requireGovernedIdempotency(request);
      const client = authentication();
      const humanAction = route.humanAction
        ? await governedHumanActionEnvelope(
            request,
            principal,
            route.humanAction,
            client,
            correlation(request)
          )
        : undefined;
      return forward(request, principal, false, undefined, humanAction);
    } catch (error) {
      if (error instanceof GovernedHumanActionReceiptClientError) return mapGovernedReceipt(error);
      return mapAuthentication(error);
    }
  };
  const handleNetworkParticipation = async (request: JsonRequest) => {
    const mutation = request.method !== 'GET';
    try {
      const principal = await resolvePrincipal(request, true);
      const ownerAuthority = requireNetworkParticipationPermission(principal, mutation);
      if (mutation) {
        forbidNetworkParticipationAuthorityPayload(request);
        requireNetworkParticipationIdempotency(request);
        requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
        validateCsrf(
          principal.sessionId,
          options.csrfSecret,
          request.headers['x-markorbit-csrf-token']
        );
      }
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