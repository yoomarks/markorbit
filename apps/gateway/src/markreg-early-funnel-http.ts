import {
  assertDirectIntake,
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  parseIntakeCreateCommand,
  parseQuoteConfirmationCommand,
  parseQuoteCreateCommand,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { randomUUID } from 'node:crypto';
import {
  type CoreAuthenticationClient,
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf
} from './auth.js';

export interface GatewayMarkRegEarlyFunnelOptions {
  markRegUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fixtureTestRuntime?: boolean;
}

const topLevelAuthorityFields = [
  'actorId',
  'userId',
  'workspaceId',
  'workplaceId',
  'membershipId',
  'subjectUserId'
] as const;
const matterIntelligenceQueryFields = ['page', 'pageSize', 'reviewHistoryLimit'] as const;

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function token(request: JsonRequest): string {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
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

function rejectTopLevelAuthoritySpoof(body: Readonly<Record<string, unknown>>): void {
  const field = topLevelAuthorityFields.find((candidate) =>
    Object.prototype.hasOwnProperty.call(body, candidate)
  );
  if (field)
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      `${field} is trusted authority context and must not be supplied by the browser.`
    );
}

function idempotency(request: JsonRequest, body: Readonly<Record<string, unknown>>): string {
  const key = request.headers['idempotency-key'];
  if (!key || !key.trim())
    throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== key)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  return key;
}

function correlationId(request: JsonRequest): string {
  const value = request.headers['x-correlation-id'];
  return value && value.length > 0 ? value : `correlation_${randomUUID()}`;
}

function purpose(body: Readonly<Record<string, unknown>>): string {
  const actor = body.actor;
  if (!actor || typeof actor !== 'object' || Array.isArray(actor)) return 'MarkReg early funnel';
  const value = (actor as Record<string, unknown>).purpose;
  return typeof value === 'string' && value.trim() ? value : 'MarkReg early funnel';
}

function trustedActor(
  principal: WorkspacePrincipal,
  body: Readonly<Record<string, unknown>>
): Readonly<Record<string, string>> {
  return {
    actorId: `user_${principal.userId}`,
    workplaceId: `workspace_${principal.workspaceId}`,
    product: 'MARKREG_COM',
    purpose: purpose(body)
  };
}

// prettier-ignore
export function createGatewayMarkRegEarlyFunnelRoutes(
  options: GatewayMarkRegEarlyFunnelOptions
): readonly JsonRoute[] {
  if (options.fixtureTestRuntime && !options.authenticationClient) return [];

  const resolveWorkspacePrincipal = async (request: JsonRequest): Promise<WorkspacePrincipal> => {
    if (!options.authenticationClient)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.',
        true
      );
    const workspaceId = request.headers['x-markorbit-workspace-id'];
    if (!workspaceId)
      throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
    try {
      return await options.authenticationClient.resolveWorkspace(
        token(request),
        workspaceId,
        request.headers['x-correlation-id']
      );
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const authenticate = async (request: JsonRequest): Promise<WorkspacePrincipal> => {
    const principal = await resolveWorkspacePrincipal(request);
    try {
      requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
      validateCsrf(
        principal.sessionId,
        options.csrfSecret,
        request.headers['x-markorbit-csrf-token']
      );
      if (!principal.permissions.includes('matter:create'))
        throw new AuthenticationError(
          'PERMISSION_DENIED',
          'matter:create permission is required for MarkReg early-funnel mutations.'
        );
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const authenticateRead = async (request: JsonRequest): Promise<WorkspacePrincipal> => {
    const principal = await resolveWorkspacePrincipal(request);
    if (!principal.permissions.includes('workspace:read'))
      return mapAuthentication(
        new AuthenticationError(
          'PERMISSION_DENIED',
          'workspace:read permission is required for governed Formal Matter reads.'
        )
      );
    return principal;
  };

  const forward = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    path: string,
    command: unknown,
    key: string,
    correlation: string
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg service authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(`${options.markRegUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': key,
          'x-correlation-id': correlation,
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId,
          ...(request.headers['x-request-id']
            ? { 'x-request-id': request.headers['x-request-id'] }
            : {})
        },
        body: JSON.stringify(command)
      });
      return json(response.status, await response.json(), { 'x-correlation-id': correlation });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg service is unavailable.', true);
    }
  };

  const forwardFormalMatterRead = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    projection: 'intelligence' | 'evidence'
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg service authentication is unavailable.',
        true
      );
    const query = new URLSearchParams();
    for (const field of matterIntelligenceQueryFields) {
      const value = request.query[field];
      if (value !== undefined) query.set(field, value);
    }
    const search = query.toString();
    const formalMatterId = encodeURIComponent(request.params.formalMatterId ?? '');
    try {
      const response = await fetch(
        `${options.markRegUrl}/internal/v1/formal-matters/${formalMatterId}/${projection}${search ? `?${search}` : ''}`,
        {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': options.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': principal.workspaceId,
            ...(request.headers['x-correlation-id']
              ? { 'x-correlation-id': request.headers['x-correlation-id'] }
              : {}),
            ...(request.headers['x-request-id']
              ? { 'x-request-id': request.headers['x-request-id'] }
              : {})
          }
        }
      );
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg service is unavailable.', true);
    }
  };

  const matterIntelligenceRoute: JsonRoute = {
    method: 'GET',
    path: '/api/markreg/formal-matters/:formalMatterId/intelligence',
    handle: async (request) => {
      const principal = await authenticateRead(request);
      return forwardFormalMatterRead(request, principal, 'intelligence');
    }
  };

  const formalMatterEvidenceRoute: JsonRoute = {
    method: 'GET',
    path: '/api/markreg/formal-matters/:formalMatterId/evidence',
    handle: async (request) => {
      const principal = await authenticateRead(request);
      return forwardFormalMatterRead(request, principal, 'evidence');
    }
  };

  const quoteRoute: JsonRoute = {
    method: 'POST',
    path: '/v1/markreg/quotes',
    handle: async (request) => {
      const body = bodyRecord(request);
      rejectTopLevelAuthoritySpoof(body);
      const key = idempotency(request, body);
      const correlation = correlationId(request);
      const principal = await authenticate(request);
      try {
        const command = parseQuoteCreateCommand({
          ...body,
          actor: trustedActor(principal, body),
          idempotencyKey: key,
          correlationId: correlation
        });
        return forward(request, principal, '/v1/quotes', command, key, correlation);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          422,
          'INVALID_QUOTE_REQUEST',
          error instanceof Error ? error.message : 'Invalid quote request.'
        );
      }
    }
  };

  const confirmationRoute: JsonRoute = {
    method: 'POST',
    path: '/v1/markreg/quotes/:quoteId/confirm',
    handle: async (request) => {
      const body = bodyRecord(request);
      rejectTopLevelAuthoritySpoof(body);
      const key = idempotency(request, body);
      const correlation = correlationId(request);
      const principal = await authenticate(request);
      try {
        const command = parseQuoteConfirmationCommand({
          ...body,
          quoteId: request.params.quoteId,
          actor: trustedActor(principal, body),
          idempotencyKey: key,
          correlationId: correlation
        });
        return forward(
          request,
          principal,
          `/v1/quotes/${encodeURIComponent(command.quoteId)}/confirm`,
          command,
          key,
          correlation
        );
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          422,
          'INVALID_CONFIRMATION_REQUEST',
          error instanceof Error ? error.message : 'Invalid confirmation request.'
        );
      }
    }
  };

  const intakeRoute: JsonRoute = {
    method: 'POST',
    path: '/v1/markreg/intakes',
    handle: async (request) => {
      const body = bodyRecord(request);
      rejectTopLevelAuthoritySpoof(body);
      const key = idempotency(request, body);
      const correlation = correlationId(request);
      const principal = await authenticate(request);
      let command;
      try {
        command = parseIntakeCreateCommand({
          ...body,
          actor: trustedActor(principal, body),
          idempotencyKey: key,
          correlationId: correlation
        });
      } catch (error) {
        throw new HttpError(
          400,
          'INVALID_REQUEST',
          error instanceof Error ? error.message : 'Invalid request.'
        );
      }
      try {
        assertDirectIntake(command);
      } catch {
        throw new HttpError(
          422,
          'UNSUPPORTED_CHANNEL_RELATIONSHIP',
          'Only MARKREG_DIRECT with DIRECT is supported.'
        );
      }
      return forward(request, principal, '/v1/intakes', command, key, correlation);
    }
  };

  return [
    intakeRoute,
    quoteRoute,
    confirmationRoute,
    matterIntelligenceRoute,
    formalMatterEvidenceRoute
  ];
}
