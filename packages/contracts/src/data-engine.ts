export const DATA_ENGINE_INTEGRATION_CONTRACT_VERSION =
  'MARKORBIT_DATA_ENGINE_INTEGRATION_V1' as const;
export const DATA_ENGINE_SOURCE_OWNER = 'MARKORBIT_DATA_ENGINE' as const;
export const DATA_ENGINE_FACT_AUTHORITY = 'DATA_ENGINE_FACT_READ_MODEL' as const;

export const dataEngineJurisdictions = ['CN', 'US'] as const;
export type DataEngineJurisdiction = (typeof dataEngineJurisdictions)[number];

export const dataEngineResourceKinds = [
  'TRADEMARK_CASE',
  'TRADEMARK_CASE_360',
  'TRADEMARK_CASE_HISTORY',
  'TRADEMARK_CHANGE_FEED',
  'RECORDED_ASSIGNMENT_FACTS',
  'TTAB_PROCEEDING_FACTS'
] as const;
export type DataEngineResourceKind = (typeof dataEngineResourceKinds)[number];

export interface DataEngineFactEnvelope<TPayload = unknown> {
  contract_version: typeof DATA_ENGINE_INTEGRATION_CONTRACT_VERSION;
  engine_version: string;
  source_owner: typeof DATA_ENGINE_SOURCE_OWNER;
  jurisdiction: DataEngineJurisdiction;
  resource_kind: DataEngineResourceKind;
  authority: typeof DATA_ENGINE_FACT_AUTHORITY;
  legal_conclusion: false;
  payload: TPayload;
}

export interface DataEngineIntegrationDescriptor {
  contract_version: typeof DATA_ENGINE_INTEGRATION_CONTRACT_VERSION;
  engine_version: string;
  source_owner: typeof DATA_ENGINE_SOURCE_OWNER;
  service_role: 'SOURCE_FACT_SERVICE';
  consumer_policy: {
    query_plane_read_only: true;
    change_feed_read_only: true;
    cross_service_database_access: false;
    consumer_writeback_to_source_facts: false;
    business_state_owned_outside_data_engine: true;
  };
  planes: {
    query: {
      prefix: '/api/v1';
      methods: ['GET'];
    };
    change_feed: {
      path: '/api/v1/us/changes';
      methods: ['GET'];
      cursor_semantics: 'LOSSLESS_OBSERVATION_CURSOR_NOT_LEGAL_CONCLUSION';
    };
    admin: {
      prefixes: ['/api/admin', '/api/jobs'];
      part_of_consumer_contract: false;
    };
  };
  stable_resources: string[];
}

export interface DataEngineChangeCursor {
  source_rank: number;
  serial_number: string;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function exactStringArray(
  value: unknown,
  expected: readonly string[]
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

export function parseDataEngineFactEnvelope(
  value: unknown
): DataEngineFactEnvelope | null {
  const candidate = record(value);
  if (!candidate) return null;
  if (candidate.contract_version !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION)
    return null;
  if (
    typeof candidate.engine_version !== 'string' ||
    candidate.engine_version.length === 0
  )
    return null;
  if (candidate.source_owner !== DATA_ENGINE_SOURCE_OWNER) return null;
  if (
    !dataEngineJurisdictions.includes(
      candidate.jurisdiction as DataEngineJurisdiction
    )
  )
    return null;
  if (
    !dataEngineResourceKinds.includes(
      candidate.resource_kind as DataEngineResourceKind
    )
  )
    return null;
  if (candidate.authority !== DATA_ENGINE_FACT_AUTHORITY) return null;
  if (candidate.legal_conclusion !== false) return null;
  if (!Object.hasOwn(candidate, 'payload')) return null;
  return candidate as unknown as DataEngineFactEnvelope;
}

export function parseDataEngineIntegrationDescriptor(
  value: unknown
): DataEngineIntegrationDescriptor | null {
  const candidate = record(value);
  const policy = record(candidate?.consumer_policy);
  const planes = record(candidate?.planes);
  const query = record(planes?.query);
  const changeFeed = record(planes?.change_feed);
  const admin = record(planes?.admin);

  if (!candidate || !policy || !planes || !query || !changeFeed || !admin)
    return null;
  if (candidate.contract_version !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION)
    return null;
  if (
    typeof candidate.engine_version !== 'string' ||
    candidate.engine_version.length === 0
  )
    return null;
  if (candidate.source_owner !== DATA_ENGINE_SOURCE_OWNER) return null;
  if (candidate.service_role !== 'SOURCE_FACT_SERVICE') return null;
  if (
    policy.query_plane_read_only !== true ||
    policy.change_feed_read_only !== true
  )
    return null;
  if (policy.cross_service_database_access !== false) return null;
  if (policy.consumer_writeback_to_source_facts !== false) return null;
  if (policy.business_state_owned_outside_data_engine !== true) return null;
  if (query.prefix !== '/api/v1' || !exactStringArray(query.methods, ['GET']))
    return null;
  if (changeFeed.path !== '/api/v1/us/changes') return null;
  if (!exactStringArray(changeFeed.methods, ['GET'])) return null;
  if (
    changeFeed.cursor_semantics !==
    'LOSSLESS_OBSERVATION_CURSOR_NOT_LEGAL_CONCLUSION'
  ) {
    return null;
  }
  if (!exactStringArray(admin.prefixes, ['/api/admin', '/api/jobs']))
    return null;
  if (admin.part_of_consumer_contract !== false) return null;
  if (!Array.isArray(candidate.stable_resources)) return null;
  if (!candidate.stable_resources.every((path) => typeof path === 'string'))
    return null;

  return candidate as unknown as DataEngineIntegrationDescriptor;
}
