import { createServiceRuntime, type JsonRoute } from '@markorbit/service-kit';
import { dataEngineRequestContext, runDataEngineQuery } from './data-engine-route-support.js';

export interface DataEngineProtectedQueryRuntimeOptions {
  dataEngineUrl: string;
  dataEngineApiKey: string;
  port?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createDataEngineProtectedQueryRuntime(
  options: DataEngineProtectedQueryRuntimeOptions
) {
  const queryOptions = {
    dataEngineUrl: options.dataEngineUrl,
    dataEngineApiKey: options.dataEngineApiKey,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
  };
  const routes: readonly JsonRoute[] = [
    {
      method: 'GET',
      path: '/api/data-engine/contract',
      handle: (request) =>
        runDataEngineQuery(queryOptions, request, (client) =>
          client.contract(dataEngineRequestContext(request))
        )
    },
    {
      method: 'GET',
      path: '/api/data-engine/not-found-probe',
      handle: (request) =>
        runDataEngineQuery(queryOptions, request, (client) =>
          client.rawGet('/api/v1/__mo_de_006_not_found_probe__', dataEngineRequestContext(request))
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
