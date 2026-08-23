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

export const dataEngineFactStates = [
  'observed',
  'not_found',
  'not_covered',
  'no_observation',
  'tombstone',
  'service_unavailable'
] as const;
export type DataEngineFactState = (typeof dataEngineFactStates)[number];

export interface DataEngineFactEnvelope<TPayload = unknown> {
  contract_version: typeof DATA_ENGINE_INTEGRATION_CONTRACT_VERSION;
  engine_version: string;
  source_owner: typeof DATA_ENGINE_SOURCE_OWNER;
  jurisdiction: DataEngineJurisdiction;
  resource_kind: DataEngineResourceKind;
  authority: typeof DATA_ENGINE_FACT_AUTHORITY;
  legal_conclusion: false;
  fact_state: DataEngineFactState;
  payload: TPayload;
}

export interface DataEngineRuntimeErrorEnvelope {
  code: string;
  message: string;
  retryable: boolean;
  detail?: unknown;
  fact_state?: DataEngineFactState;
}

export interface DataEngineG0ContractDescriptor {
  contract_id: typeof DATA_ENGINE_INTEGRATION_CONTRACT_VERSION;
  source_owner: typeof DATA_ENGINE_SOURCE_OWNER;
  compatibility: {
    v1_default: 'additive';
    breaking_change_policy: 'cross_repo_migration_or_new_version';
    deprecation_policy: 'no_v1_removal_without_cross_repo_review';
  };
  query_contract: {
    methods: ['GET'];
    storage_independent: true;
    resources: Array<{
      path: string;
      query: Readonly<Record<string, unknown>>;
      pagination: string;
    }>;
  };
  fact_semantics: {
    current_explicit_states: DataEngineFactState[];
    reserved_not_yet_emitted: DataEngineFactState[];
    [key: string]: unknown;
  };
  security: {
    scheme: 'BEARER_API_KEY';
    authorization_header: 'Authorization: Bearer <key>';
    g1_target_mode: 'required';
    environment_isolation: true;
    minimum_key_length: 32;
    multi_key_rotation: true;
    unauthenticated_status: 401;
    forbidden_status: 403;
    forbidden_current_behavior: string;
    [key: string]: unknown;
  };
  tracing: {
    request_id_header: 'X-Request-ID';
    correlation_id_header: 'x-correlation-id';
    response_echo: string[];
    provider_trace_identifier: 'X-Request-ID';
    [key: string]: unknown;
  };
  runtime_errors: {
    schema: {
      required: string[];
      optional: string[];
    };
    status_codes: Readonly<Record<string, { retryable: boolean; meaning: string }>>;
    timeout: string;
    schema_mismatch: string;
  };
  rate_limit: {
    server_enforcement_default: false;
    enabled_config: string;
    throttled_status: 429;
    retry_after_header: 'Retry-After';
    [key: string]: unknown;
  };
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
  security: {
    scheme: 'BEARER_API_KEY';
    authorization_header: 'Authorization: Bearer <key>';
    auth_mode: string;
    required_mode: 'required';
    minimum_key_length: 32;
    multi_key_rotation: true;
    fail_closed_when_required: true;
  };
  transport: {
    request_id_header: 'X-Request-ID';
    correlation_id_header: 'x-correlation-id';
    request_id_echoed: true;
    correlation_id_echoed: true;
    contract_version_header: 'X-MarkOrbit-Contract-Version';
    source_owner_header: 'X-MarkOrbit-Source-Owner';
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
  g0_contract: DataEngineG0ContractDescriptor;
}

export interface DataEngineChangeCursor {
  source_rank: number;
  serial_number: string;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function exactStringArray(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function factStateArray(value: unknown): value is DataEngineFactState[] {
  return (
    Array.isArray(value) &&
    value.every((item) => dataEngineFactStates.includes(item as DataEngineFactState))
  );
}

export function parseDataEngineFactEnvelope(value: unknown): DataEngineFactEnvelope | null {
  const candidate = record(value);
  if (!candidate) return null;
  if (candidate.contract_version !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION) return null;
  if (typeof candidate.engine_version !== 'string' || candidate.engine_version.length === 0)
    return null;
  if (candidate.source_owner !== DATA_ENGINE_SOURCE_OWNER) return null;
  if (!dataEngineJurisdictions.includes(candidate.jurisdiction as DataEngineJurisdiction))
    return null;
  if (!dataEngineResourceKinds.includes(candidate.resource_kind as DataEngineResourceKind))
    return null;
  if (candidate.authority !== DATA_ENGINE_FACT_AUTHORITY) return null;
  if (candidate.legal_conclusion !== false) return null;
  if (!dataEngineFactStates.includes(candidate.fact_state as DataEngineFactState)) return null;
  if (!Object.hasOwn(candidate, 'payload')) return null;
  return candidate as unknown as DataEngineFactEnvelope;
}

export function parseDataEngineRuntimeErrorEnvelope(
  value: unknown
): DataEngineRuntimeErrorEnvelope | null {
  const candidate = record(value);
  if (!candidate) return null;
  if (typeof candidate.code !== 'string' || candidate.code.length === 0) return null;
  if (typeof candidate.message !== 'string' || candidate.message.length === 0) return null;
  if (typeof candidate.retryable !== 'boolean') return null;
  if (
    candidate.fact_state !== undefined &&
    !dataEngineFactStates.includes(candidate.fact_state as DataEngineFactState)
  )
    return null;
  return candidate as unknown as DataEngineRuntimeErrorEnvelope;
}

export function parseDataEngineG0ContractDescriptor(
  value: unknown
): DataEngineG0ContractDescriptor | null {
  const candidate = record(value);
  const compatibility = record(candidate?.compatibility);
  const queryContract = record(candidate?.query_contract);
  const factSemantics = record(candidate?.fact_semantics);
  const security = record(candidate?.security);
  const tracing = record(candidate?.tracing);
  const runtimeErrors = record(candidate?.runtime_errors);
  const runtimeSchema = record(runtimeErrors?.schema);
  const statusCodes = record(runtimeErrors?.status_codes);
  const rateLimit = record(candidate?.rate_limit);

  if (
    !candidate ||
    !compatibility ||
    !queryContract ||
    !factSemantics ||
    !security ||
    !tracing ||
    !runtimeErrors ||
    !runtimeSchema ||
    !statusCodes ||
    !rateLimit
  )
    return null;
  if (candidate.contract_id !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION) return null;
  if (candidate.source_owner !== DATA_ENGINE_SOURCE_OWNER) return null;
  if (compatibility.v1_default !== 'additive') return null;
  if (compatibility.breaking_change_policy !== 'cross_repo_migration_or_new_version') return null;
  if (compatibility.deprecation_policy !== 'no_v1_removal_without_cross_repo_review') return null;
  if (!exactStringArray(queryContract.methods, ['GET'])) return null;
  if (queryContract.storage_independent !== true || !Array.isArray(queryContract.resources)) return null;
  if (
    !queryContract.resources.every((resource) => {
      const entry = record(resource);
      return (
        !!entry &&
        typeof entry.path === 'string' &&
        !!record(entry.query) &&
        typeof entry.pagination === 'string'
      );
    })
  )
    return null;
  if (!factStateArray(factSemantics.current_explicit_states)) return null;
  if (!factStateArray(factSemantics.reserved_not_yet_emitted)) return null;
  if (security.scheme !== 'BEARER_API_KEY') return null;
  if (security.authorization_header !== 'Authorization: Bearer <key>') return null;
  if (security.g1_target_mode !== 'required' || security.environment_isolation !== true) return null;
  if (security.minimum_key_length !== 32 || security.multi_key_rotation !== true) return null;
  if (security.unauthenticated_status !== 401 || security.forbidden_status !== 403) return null;
  if (typeof security.forbidden_current_behavior !== 'string') return null;
  if (tracing.request_id_header !== 'X-Request-ID') return null;
  if (tracing.correlation_id_header !== 'x-correlation-id') return null;
  if (!stringArray(tracing.response_echo)) return null;
  if (tracing.provider_trace_identifier !== 'X-Request-ID') return null;
  if (!stringArray(runtimeSchema.required) || !stringArray(runtimeSchema.optional)) return null;
  if (!runtimeSchema.required.includes('code')) return null;
  if (!runtimeSchema.required.includes('message')) return null;
  if (!runtimeSchema.required.includes('retryable')) return null;
  if (typeof runtimeErrors.timeout !== 'string' || typeof runtimeErrors.schema_mismatch !== 'string')
    return null;
  if (rateLimit.server_enforcement_default !== false) return null;
  if (rateLimit.throttled_status !== 429 || rateLimit.retry_after_header !== 'Retry-After')
    return null;

  return candidate as unknown as DataEngineG0ContractDescriptor;
}

export function parseDataEngineIntegrationDescriptor(
  value: unknown
): DataEngineIntegrationDescriptor | null {
  const candidate = record(value);
  const policy = record(candidate?.consumer_policy);
  const security = record(candidate?.security);
  const transport = record(candidate?.transport);
  const planes = record(candidate?.planes);
  const query = record(planes?.query);
  const changeFeed = record(planes?.change_feed);
  const admin = record(planes?.admin);
  const g0Contract = parseDataEngineG0ContractDescriptor(candidate?.g0_contract);

  if (!candidate || !policy || !security || !transport || !planes || !query || !changeFeed || !admin)
    return null;
  if (!g0Contract) return null;
  if (candidate.contract_version !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION) return null;
  if (typeof candidate.engine_version !== 'string' || candidate.engine_version.length === 0)
    return null;
  if (candidate.source_owner !== DATA_ENGINE_SOURCE_OWNER) return null;
  if (candidate.service_role !== 'SOURCE_FACT_SERVICE') return null;
  if (policy.query_plane_read_only !== true || policy.change_feed_read_only !== true) return null;
  if (policy.cross_service_database_access !== false) return null;
  if (policy.consumer_writeback_to_source_facts !== false) return null;
  if (policy.business_state_owned_outside_data_engine !== true) return null;
  if (security.scheme !== 'BEARER_API_KEY') return null;
  if (security.authorization_header !== 'Authorization: Bearer <key>') return null;
  if (typeof security.auth_mode !== 'string') return null;
  if (security.required_mode !== 'required' || security.minimum_key_length !== 32) return null;
  if (security.multi_key_rotation !== true || security.fail_closed_when_required !== true) return null;
  if (transport.request_id_header !== 'X-Request-ID') return null;
  if (transport.correlation_id_header !== 'x-correlation-id') return null;
  if (transport.request_id_echoed !== true || transport.correlation_id_echoed !== true) return null;
  if (transport.contract_version_header !== 'X-MarkOrbit-Contract-Version') return null;
  if (transport.source_owner_header !== 'X-MarkOrbit-Source-Owner') return null;
  if (query.prefix !== '/api/v1' || !exactStringArray(query.methods, ['GET'])) return null;
  if (changeFeed.path !== '/api/v1/us/changes') return null;
  if (!exactStringArray(changeFeed.methods, ['GET'])) return null;
  if (changeFeed.cursor_semantics !== 'LOSSLESS_OBSERVATION_CURSOR_NOT_LEGAL_CONCLUSION')
    return null;
  if (!exactStringArray(admin.prefixes, ['/api/admin', '/api/jobs'])) return null;
  if (admin.part_of_consumer_contract !== false) return null;
  if (!Array.isArray(candidate.stable_resources)) return null;
  if (!candidate.stable_resources.every((path) => typeof path === 'string')) return null;

  return { ...(candidate as unknown as DataEngineIntegrationDescriptor), g0_contract: g0Contract };
}
