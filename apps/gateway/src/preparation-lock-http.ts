import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest } from '@markorbit/service-kit';
import {
  type CoreAuthenticationClient,
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf
} from './auth.js';

export interface GatewayPreparationLockOptions {
  markRegUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fixtureTestRuntime?: boolean;
}

const createFields = new Set([
  'documentPackageId',
  'expectedDocumentPackageVersion',
  'expectedCanonicalEvidenceHash'
]);

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  const body = request.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new HttpError(400, 'INVALID_PREPARATION_LOCK_REQUEST', 'Request body must be an object.');
  return body as Record<string, unknown>;
}

function rejectUnexpectedCreateFields(body: Readonly<Record<string, unknown>>): void {
  const unexpected = Object.keys(body).find((field) => !createFields.has(field));
  if (unexpected)
    throw new HttpError(
      400,
      'INVALID_PREPARATION_LOCK_REQUEST',
      `${unexpected} is not part of the durable Preparation Lock command.`
    );
}

function durableCreateBody(body: Readonly<Record<string, unknown>>) {
  return {
    ...(typeof body.documentPackageId === 'string'
      ? { documentPackageId: body.documentPackageId }
      : {}),
    ...(typeof body.expectedDocumentPackageVersion === 'number'
      ? { expectedDocumentPackageVersion: body.expectedDocumentPackageVersion }
      : {}),
    ...(typeof body.expectedCanonicalEvidenceHash === 'string'
      ? { expectedCanonicalEvidenceHash: body.expectedCanonicalEvidenceHash }
      : {})
  };
}

function mapAuthentication(error: unknown): never {
  if (error instanceof HttpError) throw error;
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

export function createGatewayPreparationLockHandler(options: GatewayPreparationLockOptions) {
  const fixtureMode =
    options.fixtureTestRuntime === true &&
    options.authenticationClient === undefined &&
    options.internalServiceSecret === undefined;

  const correlation = (request: JsonRequest) => request.headers['x-correlation-id'];

  const token = (request: JsonRequest) => {
    const value = readSessionCookie(request.headers.cookie);
    if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    return value;
  };

  const principalFor = async (
    request: JsonRequest,
    permission: Permission,
    mutation: boolean
  ): Promise<WorkspacePrincipal> => {
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
      const principal = await options.authenticationClient.resolveWorkspace(
        token(request),
        workspaceId,
        correlation(request)
      );
      if (mutation) {
        requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
        validateCsrf(
          principal.sessionId,
          options.csrfSecret,
          request.headers['x-markorbit-csrf-token']
        );
      }
      if (!principal.permissions.includes(permission))
        throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const forwardFixture = async (request: JsonRequest) => {
    try {
      const response = await fetch(
        `${options.markRegUrl}${request.path.replace('/api/markreg', '/v1')}`,
        {
          method: request.method,
          headers: {
            'content-type': 'application/json',
            ...(request.headers['idempotency-key']
              ? { 'idempotency-key': request.headers['idempotency-key'] }
              : {})
          },
          ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
        }
      );
      return json(response.status, await response.json());
    } catch {
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg Preparation service is unavailable.',
        true
      );
    }
  };

  const forwardGoverned = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    body?: unknown
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg service authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(
        `${options.markRegUrl}${request.path.replace('/api/markreg', '/v1')}`,
        {
          method: request.method,
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
              : {}),
            ...(request.headers['idempotency-key']
              ? { 'idempotency-key': request.headers['idempotency-key'] }
              : {})
          },
          ...(request.method === 'GET'
            ? {}
            : { body: JSON.stringify(body === undefined ? (request.body ?? {}) : body) })
        }
      );
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg Preparation service is unavailable.',
        true
      );
    }
  };

  return async (request: JsonRequest) => {
    if (fixtureMode) return forwardFixture(request);

    const isCreate = request.method === 'POST' && request.path === '/api/markreg/preparation-locks';
    if (isCreate) {
      const body = bodyRecord(request);
      rejectUnexpectedCreateFields(body);
      if (!request.headers['idempotency-key']?.trim())
        throw new HttpError(
          400,
          'IDEMPOTENCY_KEY_REQUIRED',
          'Idempotency-Key is required for durable Preparation Lock creation.'
        );
      const principal = await principalFor(request, 'document-package:mark-ready', true);
      return forwardGoverned(request, principal, durableCreateBody(body));
    }

    const isRead = request.method === 'GET';
    const isValidate = request.method === 'POST' && request.path.endsWith('/validate-current');

    if (isRead) {
      const principal = await principalFor(request, 'document-package:read', false);
      return forwardGoverned(request, principal);
    }
    if (isValidate) {
      const principal = await principalFor(request, 'document-package:read', true);
      return forwardGoverned(request, principal);
    }

    throw new HttpError(
      404,
      'PREPARATION_LOCK_ROUTE_NOT_FOUND',
      'Preparation Lock route is not available.'
    );
  };
}
