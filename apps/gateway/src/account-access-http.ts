import { AuthenticationError, type SelfServiceAccountType } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  clearSessionCookie,
  csrfToken,
  type CoreAuthenticationClient,
  readSessionCookie,
  requireTrustedOrigin,
  sessionCookie,
  validateCsrf,
  WORKSPACE_HEADER_NAME
} from './auth.js';

export interface GatewayAccountAccessOptions {
  authenticationClient?: CoreAuthenticationClient;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  secureCookies: boolean;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return value as Record<string, unknown>;
}

function mapAuthentication(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const code = String(error.code);
  let status: number;
  if (code === 'AUTHENTICATION_SERVICE_UNAVAILABLE' || code === 'PERSISTENCE_UNAVAILABLE')
    status = 503;
  else if (code === 'EMAIL_ALREADY_REGISTERED' || code === 'DUPLICATE_WORKSPACE_SLUG') status = 409;
  else if (
    [
      'INVALID_ACCOUNT_TYPE',
      'WEAK_PASSWORD',
      'INVALID_WORKSPACE',
      'WORKSPACE_CONTEXT_REQUIRED'
    ].includes(code)
  )
    status = 400;
  else if (code === 'USER_NOT_FOUND') status = 404;
  else if (
    [
      'UNTRUSTED_ORIGIN',
      'INVALID_CSRF_TOKEN',
      'USER_DISABLED',
      'WORKSPACE_ARCHIVED',
      'MEMBERSHIP_SUSPENDED',
      'PERMISSION_DENIED'
    ].includes(code)
  )
    status = 403;
  else status = 401;
  throw new HttpError(status, code, error.message, status === 503);
}

function correlation(request: JsonRequest) {
  return request.headers['x-correlation-id'];
}

function client(options: GatewayAccountAccessOptions) {
  if (!options.authenticationClient)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
      true
    );
  return options.authenticationClient;
}

function token(request: JsonRequest) {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

export async function resolveBrowserWorkspacePrincipal(
  request: JsonRequest,
  options: GatewayAccountAccessOptions,
  workspaceId = request.headers[WORKSPACE_HEADER_NAME]
) {
  if (!workspaceId)
    throw new AuthenticationError('WORKSPACE_CONTEXT_REQUIRED', 'Workspace context is required.');
  return client(options).resolveWorkspace(token(request), workspaceId, correlation(request));
}

function response(
  result: Awaited<ReturnType<NonNullable<CoreAuthenticationClient['login']>>>,
  status: 200 | 201,
  options: GatewayAccountAccessOptions
) {
  const maxAge = Math.max(
    0,
    Math.floor((Date.parse(result.session.expiresAt) - Date.now()) / 1000)
  );
  return json(
    status,
    {
      authenticated: true,
      account: result.account,
      sessionId: result.session.sessionId,
      sessionExpiresAt: result.session.expiresAt,
      csrfToken: csrfToken(result.session.sessionId, options.csrfSecret)
    },
    {
      'set-cookie': sessionCookie(result.rawToken, maxAge, options.secureCookies)
    }
  );
}

export function createGatewayAccountAccessRoutes(
  options: GatewayAccountAccessOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/api/auth/register',
      handle: async (request) => {
        try {
          requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
          const authentication = client(options);
          if (!authentication.register)
            throw new AuthenticationError(
              'AUTHENTICATION_SERVICE_UNAVAILABLE',
              'Registration service is unavailable.'
            );
          const value = record(request.body);
          if (
            typeof value.email !== 'string' ||
            typeof value.displayName !== 'string' ||
            typeof value.password !== 'string' ||
            typeof value.accountType !== 'string'
          )
            throw new HttpError(400, 'INVALID_REQUEST', 'Registration data is invalid.');
          const result = await authentication.register(
            {
              email: value.email,
              displayName: value.displayName,
              password: value.password,
              accountType: value.accountType as SelfServiceAccountType
            },
            correlation(request)
          );
          return response(result, 201, options);
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/api/auth/login',
      handle: async (request) => {
        try {
          requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
          const authentication = client(options);
          if (!authentication.login)
            throw new AuthenticationError(
              'AUTHENTICATION_SERVICE_UNAVAILABLE',
              'Login service is unavailable.'
            );
          const value = record(request.body);
          if (typeof value.email !== 'string' || typeof value.password !== 'string')
            throw new HttpError(400, 'INVALID_REQUEST', 'Email and password are required.');
          const result = await authentication.login(
            { email: value.email, password: value.password },
            correlation(request)
          );
          return response(result, 200, options);
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/auth/session',
      handle: async (request) => {
        try {
          const principal = await client(options).resolve(token(request), correlation(request));
          return json(200, {
            authenticated: true,
            userId: principal.userId,
            sessionId: principal.sessionId,
            sessionExpiresAt: principal.sessionExpiresAt,
            csrfToken: csrfToken(principal.sessionId, options.csrfSecret)
          });
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/api/auth/logout',
      handle: async (request) => {
        try {
          requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
          const authentication = client(options);
          const principal = await authentication.resolve(token(request), correlation(request));
          validateCsrf(
            principal.sessionId,
            options.csrfSecret,
            request.headers['x-markorbit-csrf-token']
          );
          await authentication.revoke(principal.sessionId, correlation(request));
          return json(
            200,
            { authenticated: false },
            { 'set-cookie': clearSessionCookie(options.secureCookies) }
          );
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/auth/workspace-principal',
      handle: async (request) => {
        try {
          const principal = await resolveBrowserWorkspacePrincipal(request, options);
          return json(200, { principal });
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/workspaces',
      handle: async (request) => {
        try {
          const authentication = client(options);
          if (!authentication.listWorkspaces)
            throw new AuthenticationError(
              'AUTHENTICATION_SERVICE_UNAVAILABLE',
              'Workspace onboarding service is unavailable.'
            );
          const principal = await authentication.resolve(token(request), correlation(request));
          return json(200, {
            workspaces: await authentication.listWorkspaces(principal.userId, correlation(request))
          });
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/api/workspaces',
      handle: async (request) => {
        try {
          requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
          const authentication = client(options);
          if (!authentication.createWorkspace)
            throw new AuthenticationError(
              'AUTHENTICATION_SERVICE_UNAVAILABLE',
              'Workspace onboarding service is unavailable.'
            );
          const principal = await authentication.resolve(token(request), correlation(request));
          validateCsrf(
            principal.sessionId,
            options.csrfSecret,
            request.headers['x-markorbit-csrf-token']
          );
          const value = record(request.body);
          if (
            typeof value.name !== 'string' ||
            (value.slug !== undefined && typeof value.slug !== 'string')
          )
            throw new HttpError(400, 'INVALID_REQUEST', 'Workspace data is invalid.');
          const workspace = await authentication.createWorkspace(
            principal.userId,
            {
              name: value.name,
              ...(typeof value.slug === 'string' && value.slug.trim() ? { slug: value.slug } : {})
            },
            correlation(request)
          );
          return json(201, workspace);
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/internal/commercial-admin/operator',
      handle: async (request) => {
        try {
          const authentication = client(options);
          if (!authentication.resolveInternalOperator)
            throw new AuthenticationError(
              'AUTHENTICATION_SERVICE_UNAVAILABLE',
              'Commercial admin authentication is unavailable.'
            );
          return json(
            200,
            await authentication.resolveInternalOperator(token(request), correlation(request))
          );
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/api/internal/commercial-admin/accounts/:userId',
      handle: async (request) => {
        try {
          const authentication = client(options);
          if (
            !authentication.resolveInternalOperator ||
            !authentication.inspectCommercialAdminAccount
          )
            throw new AuthenticationError(
              'AUTHENTICATION_SERVICE_UNAVAILABLE',
              'Commercial admin account inspection is unavailable.'
            );
          const rawToken = token(request);
          const operator = await authentication.resolveInternalOperator(
            rawToken,
            correlation(request)
          );
          if (!operator.capabilities.includes('commercial-admin:read'))
            throw new AuthenticationError(
              'PERMISSION_DENIED',
              'Commercial admin read capability is required.'
            );
          return json(
            200,
            await authentication.inspectCommercialAdminAccount(
              rawToken,
              request.params.userId!,
              correlation(request)
            )
          );
        } catch (error) {
          return mapAuthentication(error);
        }
      }
    }
  ];
}
