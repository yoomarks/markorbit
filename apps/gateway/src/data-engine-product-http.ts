import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import { HttpError, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { readSessionCookie, type CoreAuthenticationClient } from './auth.js';
import {
  dataEngineRequestContext,
  runDataEngineQuery,
  type DataEngineQueryRuntimeOptions
} from './data-engine-route-support.js';

export interface GatewayDataEngineRouteOptions {
  dataEngineUrl?: string;
  dataEngineApiKey?: string;
  dataEngineTimeoutMs?: number;
  authenticationClient?: CoreAuthenticationClient;
  fetchImpl?: typeof fetch;
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

function requestToken(request: JsonRequest) {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function requireWorkspaceRead(principal: WorkspacePrincipal) {
  if (!principal.permissions.includes('workspace:read'))
    throw new AuthenticationError('PERMISSION_DENIED', 'workspace:read permission is required.');
}

function assertOnlyQueryKeys(request: JsonRequest, allowed: readonly string[]) {
  const unexpected = Object.keys(request.query).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `Unsupported Data Engine query parameter: ${unexpected[0]}.`
    );
}

function queryPositiveInteger(
  request: JsonRequest,
  key: string,
  maximum: number
): number | undefined {
  const raw = request.query[key];
  if (raw === undefined || raw === '') return undefined;
  if (!/^[1-9]\d*$/u.test(raw))
    throw new HttpError(400, 'INVALID_REQUEST', `${key} must be a positive integer.`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > maximum)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `${key} must be a positive integer no greater than ${maximum}.`
    );
  return parsed;
}

function queryAsOf(request: JsonRequest): string | undefined {
  const raw = request.query.as_of;
  if (raw === undefined || raw === '') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(raw);
  if (!match)
    throw new HttpError(400, 'INVALID_REQUEST', 'as_of must use YYYY-MM-DD format.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  )
    throw new HttpError(400, 'INVALID_REQUEST', 'as_of must be a valid calendar date.');
  return raw;
}

function configuredRuntime(options: GatewayDataEngineRouteOptions): DataEngineQueryRuntimeOptions {
  const dataEngineUrl = options.dataEngineUrl?.trim() ?? '';
  const dataEngineApiKey = options.dataEngineApiKey?.trim() ?? '';
  const timeout = options.dataEngineTimeoutMs;
  if (
    !dataEngineUrl ||
    dataEngineApiKey.length < 32 ||
    (timeout !== undefined && (!Number.isSafeInteger(timeout) || timeout < 1))
  )
    throw new HttpError(
      503,
      'DATA_ENGINE_CONFIGURATION_UNAVAILABLE',
      'Data Engine protected query configuration is unavailable.',
      true
    );
  return {
    dataEngineUrl,
    dataEngineApiKey,
    ...(timeout === undefined ? {} : { timeoutMs: timeout }),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
  };
}

export function createGatewayDataEngineRoutes(options: GatewayDataEngineRouteOptions): JsonRoute[] {
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
  const resolvePrincipal = async (request: JsonRequest) => {
    const workspaceId = request.headers['x-markorbit-workspace-id'];
    if (!workspaceId)
      throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
    try {
      const principal = await authentication().resolveWorkspace(
        requestToken(request),
        workspaceId,
        correlation(request)
      );
      requireWorkspaceRead(principal);
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };
  const handle = async (
    request: JsonRequest,
    call: Parameters<typeof runDataEngineQuery>[2]
  ) => {
    await resolvePrincipal(request);
    return runDataEngineQuery(configuredRuntime(options), request, call);
  };

  return [
    {
      method: 'GET',
      path: '/api/data-engine/contract',
      handle: (request) => {
        assertOnlyQueryKeys(request, []);
        return handle(request, (client) => client.contract(dataEngineRequestContext(request)));
      }
    },
    {
      method: 'GET',
      path: '/api/data-engine/cn/cases/:applicationNumber',
      handle: (request) => {
        assertOnlyQueryKeys(request, []);
        return handle(request, (client) =>
          client.cnCase(
            request.params.applicationNumber ?? '',
            dataEngineRequestContext(request)
          )
        );
      }
    },
    {
      method: 'GET',
      path: '/api/data-engine/us/cases/:serialNumber',
      handle: (request) => {
        assertOnlyQueryKeys(request, []);
        return handle(request, (client) =>
          client.usCase(request.params.serialNumber ?? '', dataEngineRequestContext(request))
        );
      }
    },
    {
      method: 'GET',
      path: '/api/data-engine/us/cases/:serialNumber/360',
      handle: (request) => {
        assertOnlyQueryKeys(request, [
          'as_of',
          'history_limit',
          'assignment_limit',
          'ttab_limit'
        ]);
        const query = {
          ...(queryAsOf(request) ? { asOf: queryAsOf(request) } : {}),
          ...(queryPositiveInteger(request, 'history_limit', 5000) === undefined
            ? {}
            : { historyLimit: queryPositiveInteger(request, 'history_limit', 5000) }),
          ...(queryPositiveInteger(request, 'assignment_limit', 500) === undefined
            ? {}
            : { assignmentLimit: queryPositiveInteger(request, 'assignment_limit', 500) }),
          ...(queryPositiveInteger(request, 'ttab_limit', 500) === undefined
            ? {}
            : { ttabLimit: queryPositiveInteger(request, 'ttab_limit', 500) })
        };
        return handle(request, (client) =>
          client.usCase360(
            request.params.serialNumber ?? '',
            query,
            dataEngineRequestContext(request)
          )
        );
      }
    },
    {
      method: 'GET',
      path: '/api/data-engine/us/cases/:serialNumber/history',
      handle: (request) => {
        assertOnlyQueryKeys(request, ['limit']);
        return handle(request, (client) =>
          client.usCaseHistory(
            request.params.serialNumber ?? '',
            queryPositiveInteger(request, 'limit', 5000),
            dataEngineRequestContext(request)
          )
        );
      }
    },
    {
      method: 'GET',
      path: '/api/data-engine/us/cases/:serialNumber/assignments',
      handle: (request) => {
        assertOnlyQueryKeys(request, ['limit']);
        return handle(request, (client) =>
          client.usAssignments(
            request.params.serialNumber ?? '',
            queryPositiveInteger(request, 'limit', 500),
            dataEngineRequestContext(request)
          )
        );
      }
    },
    {
      method: 'GET',
      path: '/api/data-engine/us/cases/:serialNumber/ttab',
      handle: (request) => {
        assertOnlyQueryKeys(request, ['limit']);
        return handle(request, (client) =>
          client.usTtab(
            request.params.serialNumber ?? '',
            queryPositiveInteger(request, 'limit', 500),
            dataEngineRequestContext(request)
          )
        );
      }
    }
  ];
}
