import { AuthenticationError, type SelfServiceAccountType } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  csrfToken,
  type CoreAuthenticationClient,
  requireTrustedOrigin,
  sessionCookie
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
  const status =
    error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      ? 503
      : error.code === 'EMAIL_ALREADY_REGISTERED'
        ? 409
        : ['INVALID_ACCOUNT_TYPE', 'WEAK_PASSWORD'].includes(error.code)
          ? 400
          : ['UNTRUSTED_ORIGIN'].includes(error.code)
            ? 403
            : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
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
    }
  ];
}
