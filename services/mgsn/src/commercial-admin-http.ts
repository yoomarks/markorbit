import {
  AuthenticationError,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  MgsnCommercialAdminReadError,
  type MgsnCommercialAdminReadService
} from './commercial-admin-read.js';
import { ProviderRegistryError } from './provider-registry.js';

export interface MgsnCommercialAdminHttpOptions {
  service?: MgsnCommercialAdminReadService;
  internalServiceSecret?: string;
}

function service(options: MgsnCommercialAdminHttpOptions): MgsnCommercialAdminReadService {
  if (!options.service)
    throw new HttpError(
      503,
      'MGSN_RUNTIME_UNCONFIGURED',
      'MGSN commercial admin read service is unavailable.',
      true
    );
  return options.service;
}

function principalFor(
  request: JsonRequest,
  internalServiceSecret: string | undefined
): InternalOperatorPrincipal {
  if (
    !internalServiceSecret ||
    request.headers['x-markorbit-internal-authorization'] !== internalServiceSecret
  )
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  try {
    return parseInternalOperatorPrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
}

function translate(error: unknown): never {
  if (error instanceof MgsnCommercialAdminReadError) {
    const status =
      error.code === 'AUTHENTICATION_REQUIRED'
        ? 401
        : error.code === 'PERMISSION_DENIED'
          ? 403
          : 404;
    throw new HttpError(status, error.code, error.message);
  }
  if (error instanceof ProviderRegistryError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

async function run<T>(work: () => Promise<T>) {
  try {
    return json(200, await work());
  } catch (error) {
    return translate(error);
  }
}

export function createMgsnCommercialAdminHttpRoutes(
  options: MgsnCommercialAdminHttpOptions
): readonly JsonRoute[] {
  const principal = (request: JsonRequest) => principalFor(request, options.internalServiceSecret);
  return [
    {
      method: 'GET',
      path: '/internal/commercial-admin/providers',
      handle: (request) => run(() => service(options).listProviders(principal(request)))
    },
    {
      method: 'GET',
      path: '/internal/commercial-admin/providers/:providerId',
      handle: (request) =>
        run(() =>
          service(options).inspectProvider(
            principal(request),
            request.params.providerId! as ProviderId
          )
        )
    }
  ];
}
