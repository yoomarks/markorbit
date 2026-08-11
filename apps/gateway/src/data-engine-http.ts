import {
  type DataEngineFactEnvelope,
  type DataEngineIntegrationDescriptor,
  type DataEngineJurisdiction,
  type DataEngineResourceKind,
  parseDataEngineFactEnvelope,
  parseDataEngineIntegrationDescriptor
} from '@markorbit/contracts/data-engine';

export interface GatewayDataEngineClientOptions {
  dataEngineUrl: string;
  fetchImpl?: typeof fetch;
}

export interface DataEngineChangeQuery {
  afterSourceRank?: number;
  afterSerial?: string;
  scanLimit?: number;
}

export class DataEngineClientError extends Error {
  constructor(
    readonly code: 'DATA_ENGINE_UNAVAILABLE' | 'DATA_ENGINE_CONTRACT_MISMATCH',
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'DataEngineClientError';
  }
}

function baseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('Data Engine URL is required.');
  return normalized;
}

function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export function createDataEngineClient(options: GatewayDataEngineClientOptions) {
  const origin = baseUrl(options.dataEngineUrl);
  const fetchImpl = options.fetchImpl ?? fetch;

  const getJson = async (path: string): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetchImpl(`${origin}${path}`, {
        method: 'GET',
        headers: { accept: 'application/json' }
      });
    } catch {
      throw new DataEngineClientError(
        'DATA_ENGINE_UNAVAILABLE',
        'Data Engine service is unavailable.'
      );
    }
    if (!response.ok) {
      throw new DataEngineClientError(
        'DATA_ENGINE_UNAVAILABLE',
        `Data Engine returned HTTP ${response.status}.`,
        response.status
      );
    }
    return response.json().catch(() => {
      throw new DataEngineClientError(
        'DATA_ENGINE_CONTRACT_MISMATCH',
        'Data Engine returned a non-JSON response.'
      );
    });
  };

  const fact = async (
    path: string,
    jurisdiction: DataEngineJurisdiction,
    resourceKind: DataEngineResourceKind
  ): Promise<DataEngineFactEnvelope> => {
    const parsed = parseDataEngineFactEnvelope(await getJson(path));
    if (
      !parsed ||
      parsed.jurisdiction !== jurisdiction ||
      parsed.resource_kind !== resourceKind
    ) {
      throw new DataEngineClientError(
        'DATA_ENGINE_CONTRACT_MISMATCH',
        'Data Engine response does not match the frozen V1 fact contract.'
      );
    }
    return parsed;
  };

  return {
    async contract(): Promise<DataEngineIntegrationDescriptor> {
      const parsed = parseDataEngineIntegrationDescriptor(await getJson('/api/v1/contract'));
      if (!parsed) {
        throw new DataEngineClientError(
          'DATA_ENGINE_CONTRACT_MISMATCH',
          'Data Engine service does not expose the expected V1 contract.'
        );
      }
      return parsed;
    },

    cnCase(applicationNumber: string): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/cn/cases/${encodeURIComponent(applicationNumber)}`,
        'CN',
        'TRADEMARK_CASE'
      );
    },

    usCase(serialNumber: string): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}`,
        'US',
        'TRADEMARK_CASE'
      );
    },

    usCase360(serialNumber: string): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}/360`,
        'US',
        'TRADEMARK_CASE_360'
      );
    },

    usCaseHistory(serialNumber: string, limit?: number): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}/history${queryString({ limit })}`,
        'US',
        'TRADEMARK_CASE_HISTORY'
      );
    },

    usAssignments(serialNumber: string, limit?: number): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}/assignments${queryString({ limit })}`,
        'US',
        'RECORDED_ASSIGNMENT_FACTS'
      );
    },

    usTtab(serialNumber: string, limit?: number): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/cases/${encodeURIComponent(serialNumber)}/ttab${queryString({ limit })}`,
        'US',
        'TTAB_PROCEEDING_FACTS'
      );
    },

    usChanges(query: DataEngineChangeQuery = {}): Promise<DataEngineFactEnvelope> {
      return fact(
        `/api/v1/us/changes${queryString({
          after_source_rank: query.afterSourceRank,
          after_serial: query.afterSerial,
          scan_limit: query.scanLimit
        })}`,
        'US',
        'TRADEMARK_CHANGE_FEED'
      );
    }
  };
}

export type DataEngineClient = ReturnType<typeof createDataEngineClient>;
