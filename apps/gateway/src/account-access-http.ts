import { AuthenticationError, type SelfServiceAccountType } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  csrfToken,
  type CoreAuthenticationClient,
  readSessionCookie,
  requireTrustedOrigin,
  sessionCookie,
  validateCsrf
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
  const status =
    code === 'AUTHENTICATION_SERVICE_UNAVAILABLE' || code === 'PERSISTENCE_UNAVAILABLE'
      ? 503
      : code === 'EMAIL_ALREADY_REGISTERED' || code === 'DUPLICATE_WORKSPACE_SLUG'
        ? 409
        : ['INVALID_ACCOUNT_TYPE', 'WEAK_PASSWORD', 'INVALID_WORKSPACE'].includes(code)
          ? 400
          : code === 'USER_NOT_FOUND'
            ? 404
            : [
                  'UNTRUSTED_ORIGIN',
                  'INVALID_CSRF_TOKEN',
                  'USER_DISABLED',
                  'WORKSPACE_ARCHIVED',
                  'MEMBERSHIP_SUSPENDED'
                ].includes(code)
              ? 403
              : 401;
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
            workspaces: await authentication.listWorkspaces(
              principal.userId,
              correlation(request)
            )
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
    }
  ];
}
