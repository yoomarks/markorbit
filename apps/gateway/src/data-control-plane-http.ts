import {
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import {
  HttpError,
  json,
  type JsonRequest,
  type JsonResult,
  type JsonRoute
} from '@markorbit/service-kit';
import { readSessionCookie } from './auth.js';
import { readDataEngineOwnerSummary } from './data-engine-owner-summary.js';
import {
  dataEngineRequestContext,
  runDataEngineQuery,
  type DataEngineQueryRuntimeOptions
} from './data-engine-route-support.js';

export interface GatewayDataControlPlaneOptions {
  coreUrl?: string;
  internalServiceSecret?: string;
  dataEngineUrl?: string;
  dataEngineApiKey?: string;
  dataEngineTimeoutMs?: number;
  operatorTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DATA_READ_CAPABILITY = 'control-plane:data:read' as const;

function requestToken(request: JsonRequest): string {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function configuredDataRuntime(
  options: GatewayDataControlPlaneOptions
): DataEngineQueryRuntimeOptions {
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

function parseOperator(value: unknown): InternalOperatorPrincipal {
  try {
    return parseInternalOperatorPrincipal(
      Buffer.from(JSON.stringify({ schemaVersion: 1, principal: value }), 'utf8').toString(
        'base64url'
      )
    );
  } catch {
    throw new HttpError(
      503,
      'DATA_OPERATOR_RESPONSE_INVALID',
      'Core Data operator response is malformed.',
      true
    );
  }
}

export function createGatewayDataControlPlaneRoutes(
  options: GatewayDataControlPlaneOptions
): readonly JsonRoute[] {
  const coreUrl = options.coreUrl ?? process.env.CORE_URL ?? 'http://127.0.0.1:4101';
  const operatorTimeoutMs = options.operatorTimeoutMs ?? 3_000;

  const resolveDataOperator = async (
    request: JsonRequest
  ): Promise<{ principal: InternalOperatorPrincipal } | { response: JsonResult }> => {
    const internalServiceSecret = options.internalServiceSecret?.trim() ?? '';
    if (!internalServiceSecret)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Data operator authentication is unavailable.',
        true
      );
    if (!Number.isSafeInteger(operatorTimeoutMs) || operatorTimeoutMs < 1)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Data operator authentication is unavailable.',
        true
      );

    let response: Response;
    try {
      response = await fetch(`${coreUrl}/internal/control-plane/operator-principals/resolve`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': internalServiceSecret,
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {}),
          ...(request.headers['x-request-id']
            ? { 'x-request-id': request.headers['x-request-id'] }
            : {})
        },
        body: JSON.stringify({
          token: requestToken(request),
          requiredCapability: DATA_READ_CAPABILITY
        }),
        signal: AbortSignal.timeout(operatorTimeoutMs)
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Data operator authentication is unavailable.',
        true
      );
    }

    const value: unknown = await response.json().catch(() => undefined);
    if (value === undefined)
      throw new HttpError(
        503,
        'DATA_OPERATOR_RESPONSE_INVALID',
        'Core Data operator response is malformed.',
        true
      );
    if (!response.ok) return { response: json(response.status, value) };

    const principal = parseOperator(value);
    if (!principal.capabilities.includes(DATA_READ_CAPABILITY))
      return {
        response: json(403, {
          code: 'PERMISSION_DENIED',
          message: `${DATA_READ_CAPABILITY} capability is required.`
        })
      };
    return { principal };
  };

  return [
    {
      method: 'GET',
      path: '/api/internal/control-plane/data/summary',
      handle: async (request) => {
        const resolution = await resolveDataOperator(request);
        if ('response' in resolution) return resolution.response;
        return runDataEngineQuery(configuredDataRuntime(options), request, (client) =>
          readDataEngineOwnerSummary(client, dataEngineRequestContext(request))
        );
      }
    }
  ];
}
