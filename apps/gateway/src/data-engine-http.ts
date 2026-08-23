import { randomUUID } from 'node:crypto';
import {
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER,
  type DataEngineFactEnvelope,
  type DataEngineFactState,
  type DataEngineIntegrationDescriptor,
  type DataEngineJurisdiction,
  type DataEngineResourceKind,
  parseDataEngineFactEnvelope,
  parseDataEngineIntegrationDescriptor,
  parseDataEngineRuntimeErrorEnvelope
} from '@markorbit/contracts/data-engine';

export interface GatewayDataEngineClientOptions {
  dataEngineUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  requestIdFactory?: () => string;
  expectedContractVersion?: string;
  onTrace?: (trace: DataEngineTrace) => void;
}

export interface DataEngineRequestContext {
  correlationId?: string;
  requestId?: string;
}

export interface DataEngineTrace {
  path: string;
  status: number;
  requestId: string;
  correlationId: string;
  providerRequestId: string;
  providerCorrelationId: string;
  contractVersion: string;
  sourceOwner: string;
}

export interface DataEngineChangeQuery {
  afterSourceRank?: number;
  afterSerial?: string;
  scanLimit?: number;
}

export type DataEngineClientErrorCode =
  | 'DATA_ENGINE_UNAVAILABLE'
  | 'DATA_ENGINE_CONTRACT_MISMATCH'
  | 'DATA_ENGINE_AUTH_FAILED'
  | 'DATA_ENGINE_FORBIDDEN'
  | 'DATA_ENGINE_NOT_FOUND'
  | 'DATA_ENGINE_RATE_LIMITED'
  | 'DATA_ENGINE_PROVIDER_ERROR';

export class DataEngineClientError extends Error {
  constructor(
    readonly code: DataEngineClientErrorCode,
    message: string,
    readonly status?: number,
    readonly options: {
      providerCode?: string;
      retryable?: boolean;
      factState?: DataEngineFactState;
      coverageState?: 'unknown';
      retryAfterSeconds?: number;
      requestId?: string;
      correlationId?: string;
    } = {}
  ) {
    super(message);
    this.name = 'DataEngineClientError';
  }

  get retryable(): boolean {
    return this.options.retryable === true;
  }

  get factState(): DataEngineFactState | undefined {
    return this.options.factState;
  }

  get coverageState(): 'unknown' | undefined {
    return this.options.coverageState;
  }

  get retryAfterSeconds(): number | undefined {
    return this.options.retryAfterSeconds;
  }
}

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

function baseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('Data Engine URL is required.');
  return normalized;
}

function normalizeIdentifier(value: string | undefined, fallback: () => string): string {
  const candidate = value?.trim() ?? '';
  return candidate && requestIdPattern.test(candidate) ? candidate : fallback();
}

function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function mapProviderError(
  response: Response,
  body: unknown,
  requestId: string,
  correlationId: string
): DataEngineClientError {
  const parsed = parseDataEngineRuntimeErrorEnvelope(body);
  if (!parsed) {
    return new DataEngineClientError(
      'DATA_ENGINE_CONTRACT_MISMATCH',
      `Data Engine returned an invalid V1 error envelope for HTTP ${response.status}.`,
      response.status,
      { requestId, correlationId }
    );
  }

  const shared = {
    providerCode: parsed.code,
    retryable: parsed.retryable,
    ...(parsed.fact_state ? { factState: parsed.fact_state } : {}),
    ...(parsed.fact_state === 'not_found' ? { coverageState: 'unknown' as const } : {}),
    ...(retryAfterSeconds(response) === undefined
      ? {}
      : { retryAfterSeconds: retryAfterSeconds(response) }),
    requestId,
    correlationId
  };

  if (response.status === 401)
    return new DataEngineClientError('DATA_ENGINE_AUTH_FAILED', parsed.message, 401, shared);
  if (response.status === 403)
    return new DataEngineClientError('DATA_ENGINE_FORBIDDEN', parsed.message, 403, shared);
  if (response.status === 404)
    return new DataEngineClientError('DATA_ENGINE_NOT_FOUND', parsed.message, 404, shared);
  if (response.status === 429)
    return new DataEngineClientError('DATA_ENGINE_RATE_LIMITED', parsed.message, 429, shared);
  if (response.status >= 500)
    return new DataEngineClientError('DATA_ENGINE_UNAVAILABLE', parsed.message, response.status, {
      ...shared,
      factState: parsed.fact_state ?? 'service_unavailable'
    });
  return new DataEngineClientError('DATA_ENGINE_PROVIDER_ERROR', parsed.message, response.status, shared);
}

export function createDataEngineClient(options: GatewayDataEngineClientOptions) {
  const origin = baseUrl(options.dataEngineUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Math.max(options.timeoutMs ?? 5_000, 1);
  const requestIdFactory = options.requestIdFactory ?? randomUUID;
  const expectedContractVersion =
    options.expectedContractVersion ?? DATA_ENGINE_INTEGRATION_CONTRACT_VERSION;
  const apiKey = options.apiKey?.trim();
  if (apiKey && apiKey.length < 32)
    throw new Error('Data Engine API key must be at least 32 characters when configured.');

  const getJson = async (
    path: string,
    context: DataEngineRequestContext = {}
  ): Promise<unknown> => {
    const requestId = normalizeIdentifier(context.requestId, requestIdFactory);
    const correlationId = normalizeIdentifier(context.correlationId, () => requestId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${origin}${path}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'X-Request-ID': requestId,
          'x-correlation-id': correlationId,
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
        },
        signal: controller.signal
      });
    } catch (error) {
      const timedOut = controller.signal.aborted;
      throw new DataEngineClientError(
        'DATA_ENGINE_UNAVAILABLE',
        timedOut ? 'Data Engine request timed out.' : 'Data Engine service is unavailable.',
        undefined,
        {
          retryable: true,
          factState: 'service_unavailable',
          requestId,
          correlationId
        }
      );
    } finally {
      clearTimeout(timer);
    }

    const providerRequestId = response.headers.get('x-request-id') ?? '';
    const providerCorrelationId = response.headers.get('x-correlation-id') ?? '';
    const contractVersion = response.headers.get('x-markorbit-contract-version') ?? '';
    const sourceOwner = response.headers.get('x-markorbit-source-owner') ?? '';
    if (
      providerRequestId !== requestId ||
      providerCorrelationId !== correlationId ||
      contractVersion !== expectedContractVersion ||
      sourceOwner !== DATA_ENGINE_SOURCE_OWNER
    ) {
      throw new DataEngineClientError(
        'DATA_ENGINE_CONTRACT_MISMATCH',
        'Data Engine response transport metadata does not match the frozen G0 contract.',
        response.status,
        { requestId, correlationId }
      );
    }

    options.onTrace?.({
      path,
      status: response.status,
      requestId,
      correlationId,
      providerRequestId,
      providerCorrelationId,
      contractVersion,
      sourceOwner
    });

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw mapProviderError(response, body, requestId, correlationId);
    if (body === undefined)
      throw new DataEngineClientError(
        'DATA_ENGINE_CONTRACT_MISMATCH',
        'Data Engine returned a non-JSON response.',
        response.status,
        { requestId, correlationId }
      );
    return body;
  };

  const fact = async (
    path: string,
    jurisdiction: DataEngineJurisdiction,
    resourceKind: DataEngineResourceKind,
    context?: DataEngineRequestContext
  ): Promise<DataEngineFactEnvelope> => {
    const parsed = parseDataEngineFactEnvelope(await getJson(path, context));
    if (!parsed || parsed.jurisdiction !== jurisdiction || parsed.resource_kind !== resourceKind) {
      throw new DataEngineClientError(
        'DATA_ENGINE_CONTRACT_MISMATCH',
        'Data Engine response does not match the frozen V1 fact contract.'
      );
    }
    return parsed;
  };

  return {
    async contract(context?: DataEngineRequestContext): Promise<DataEngineIntegrationDescriptor> {
      const parsed = parseDataEngineIntegrationDescriptor(await getJson('/api/v1/contract', context));
      if (!parsed) {
        throw new DataEngineClientError(
          'DATA_ENGINE_CONTRACT_MISMATCH',
          'Data Engine service does not expose the expected V1 contract.'
        );
      }
      if (apiKey && parsed.security.auth_mode !== 'required') {
        throw new DataEngineClientError(
          'DATA_ENGINE_CONTRACT_MISMATCH',
          'G1 requires the Data Engine runtime to advertise auth_mode=required.'
        );
      }
      return parsed;
    },

    cnCase(
      applicationNumber: string,
      context?: DataEngineRequestContext
    ): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/cn/cases/${encodeURIComponent(applicationNumber)}`,
        'CN',
        'TRADEMARK_CASE',
        context
      );
    },

    usCase(serialNumber: string, context?: DataEngineRequestContext): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}`,
        'US',
        'TRADEMARK_CASE',
        context
      );
    },

    usCase360(
      serialNumber: string,
      context?: DataEngineRequestContext
    ): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}/360`,
        'US',
        'TRADEMARK_CASE_360',
        context
      );
    },

    usCaseHistory(
      serialNumber: string,
      limit?: number,
      context?: DataEngineRequestContext
    ): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}/history${queryString({ limit })}`,
        'US',
        'TRADEMARK_CASE_HISTORY',
        context
      );
    },

    usAssignments(
      serialNumber: string,
      limit?: number,
      context?: DataEngineRequestContext
    ): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}/assignments${queryString({ limit })}`,
        'US',
        'RECORDED_ASSIGNMENT_FACTS',
        context
      );
    },

    usTtab(
      serialNumber: string,
      limit?: number,
      context?: DataEngineRequestContext
    ): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}/ttab${queryString({ limit })}`,
        'US',
        'TTAB_PROCEEDING_FACTS',
        context
      );
    },

    usChanges(
      query: DataEngineChangeQuery = {},
      context?: DataEngineRequestContext
    ): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/changes${queryString({
          after_source_rank: query.afterSourceRank,
          after_serial: query.afterSerial,
          scan_limit: query.scanLimit
        })}`,
        'US',
        'TRADEMARK_CHANGE_FEED',
        context
      );
    },

    rawGet(path: string, context?: DataEngineRequestContext): Promise<unknown> {
      if (!path.startsWith('/api/v1/'))
        throw new Error('Data Engine rawGet is restricted to the frozen /api/v1 query plane.');
      return getJson(path, context);
    }
  };
}

export type DataEngineClient = ReturnType<typeof createDataEngineClient>;
