import {
  HttpError,
  createServiceRuntime,
  json,
  type JsonRequest,
  type JsonRoute
} from '@markorbit/service-kit';
import {
  DataEngineClientError,
  createDataEngineClient,
  type DataEngineTrace
} from './data-engine-http.js';

export interface DataEngineProtectedQueryRuntimeOptions {
  dataEngineUrl: string;
  dataEngineApiKey: string;
  port?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function mapDataEngineError(error: unknown): never {
  if (!(error instanceof DataEngineClientError)) throw error;
  throw new HttpError(
    error.status ?? 503,
    error.options.providerCode ?? error.code,
    error.message,
    error.retryable,
    {
      integrationErrorCode: error.code,
      ...(error.factState ? { factState: error.factState } : {}),
      ...(error.coverageState ? { coverageState: error.coverageState } : {}),
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
      ...(error.options.requestId ? { providerRequestId: error.options.requestId } : {}),
      ...(error.options.correlationId ? { correlationId: error.options.correlationId } : {})
    }
  );
}

function context(request: JsonRequest) {
  return {
    ...(request.headers['x-correlation-id']
      ? { correlationId: request.headers['x-correlation-id'] }
      : {}),
    ...(request.headers['x-request-id'] ? { requestId: request.headers['x-request-id'] } : {})
  };
}

function traceHeaders(
  trace: DataEngineTrace | undefined
): Readonly<Record<string, string>> | undefined {
  if (!trace) return undefined;
  return {
    'x-correlation-id': trace.correlationId,
    'x-data-engine-request-id': trace.providerRequestId,
    'x-data-engine-contract-version': trace.contractVersion,
    'x-data-engine-source-owner': trace.sourceOwner
  };
}

export function createDataEngineProtectedQueryRuntime(
  options: DataEngineProtectedQueryRuntimeOptions
) {
  const run = async (
    request: JsonRequest,
    call: (client: ReturnType<typeof createDataEngineClient>) => Promise<unknown>
  ) => {
    let trace: DataEngineTrace | undefined;
    const client = createDataEngineClient({
      dataEngineUrl: options.dataEngineUrl,
      apiKey: options.dataEngineApiKey,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      onTrace: (value) => {
        trace = value;
      }
    });
    try {
      const body = await call(client);
      return json(200, body, traceHeaders(trace));
    } catch (error) {
      return mapDataEngineError(error);
    }
  };

  const routes: readonly JsonRoute[] = [
    {
      method: 'GET',
      path: '/api/data-engine/contract',
      handle: (request) => run(request, (client) => client.contract(context(request)))
    },
    {
      method: 'GET',
      path: '/api/data-engine/not-found-probe',
      handle: (request) =>
        run(request, (client) =>
          client.rawGet('/api/v1/__mo_de_006_not_found_probe__', context(request))
        )
    }
  ];

  return createServiceRuntime(
    {
      name: 'gateway-data-engine-g1',
      port: options.port ?? 0,
      version: 'MO-DE-006'
    },
    { routes }
  );
}
