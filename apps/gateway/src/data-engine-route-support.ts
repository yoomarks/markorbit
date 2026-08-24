import { HttpError, json, type JsonRequest } from '@markorbit/service-kit';
import {
  DataEngineClientError,
  createDataEngineClient,
  type DataEngineTrace
} from './data-engine-http.js';

export interface DataEngineQueryRuntimeOptions {
  dataEngineUrl: string;
  dataEngineApiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function dataEngineRequestContext(request: JsonRequest) {
  return {
    ...(request.headers['x-correlation-id']
      ? { correlationId: request.headers['x-correlation-id'] }
      : {}),
    ...(request.headers['x-request-id'] ? { requestId: request.headers['x-request-id'] } : {})
  };
}

export function dataEngineTraceHeaders(
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

export function mapDataEngineError(error: unknown): never {
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

export async function runDataEngineQuery(
  options: DataEngineQueryRuntimeOptions,
  request: JsonRequest,
  call: (client: ReturnType<typeof createDataEngineClient>) => Promise<unknown>
) {
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
    return json(200, body, dataEngineTraceHeaders(trace));
  } catch (error) {
    return mapDataEngineError(error);
  }
}
