import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  parseDataEngineFactEnvelope,
  parseDataEngineIntegrationDescriptor
} from '../src/data-engine.js';

async function factFixture() {
  return JSON.parse(
    await readFile(
      new URL('../fixtures/data-engine-fact-envelope-v1.json', import.meta.url),
      'utf8'
    )
  ) as unknown;
}

const g0Contract = {
  contract_id: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  source_owner: 'MARKORBIT_DATA_ENGINE',
  compatibility: {
    v1_default: 'additive',
    breaking_change_policy: 'cross_repo_migration_or_new_version',
    deprecation_policy: 'no_v1_removal_without_cross_repo_review'
  },
  query_contract: {
    methods: ['GET'],
    storage_independent: true,
    resources: [{ path: '/api/v1/contract', query: {}, pagination: 'none' }]
  },
  fact_semantics: {
    current_explicit_states: ['observed', 'not_found', 'service_unavailable'],
    reserved_not_yet_emitted: ['not_covered', 'no_observation', 'tombstone']
  },
  security: {
    scheme: 'BEARER_API_KEY',
    authorization_header: 'Authorization: Bearer <key>',
    g1_target_mode: 'required',
    environment_isolation: true,
    minimum_key_length: 32,
    multi_key_rotation: true,
    unauthenticated_status: 401,
    forbidden_status: 403,
    forbidden_current_behavior: 'reserved; V1 has no scope/role authorization layer'
  },
  tracing: {
    request_id_header: 'X-Request-ID',
    correlation_id_header: 'x-correlation-id',
    response_echo: [
      'X-Request-ID',
      'x-correlation-id',
      'X-MarkOrbit-Contract-Version',
      'X-MarkOrbit-Source-Owner'
    ],
    provider_trace_identifier: 'X-Request-ID'
  },
  runtime_errors: {
    schema: {
      required: ['code', 'message', 'retryable'],
      optional: ['detail', 'fact_state']
    },
    status_codes: {
      '401': { retryable: false, meaning: 'missing or invalid service credential' },
      '429': { retryable: true, meaning: 'provider backpressure; obey Retry-After' },
      '503': { retryable: true, meaning: 'provider/dependency unavailable' }
    },
    timeout: 'consumer/network timeout is retryable and must never be converted to a factual negative',
    schema_mismatch: 'consumer fails closed when contract_version differs from the supported contract'
  },
  rate_limit: {
    server_enforcement_default: false,
    enabled_config: 'INTEGRATION_RATE_LIMIT_ENABLED',
    throttled_status: 429,
    retry_after_header: 'Retry-After'
  }
};

const descriptor = {
  contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  engine_version: 'M1.6',
  source_owner: 'MARKORBIT_DATA_ENGINE',
  service_role: 'SOURCE_FACT_SERVICE',
  consumer_policy: {
    query_plane_read_only: true,
    change_feed_read_only: true,
    cross_service_database_access: false,
    consumer_writeback_to_source_facts: false,
    business_state_owned_outside_data_engine: true
  },
  security: {
    scheme: 'BEARER_API_KEY',
    authorization_header: 'Authorization: Bearer <key>',
    auth_mode: 'required',
    required_mode: 'required',
    minimum_key_length: 32,
    multi_key_rotation: true,
    fail_closed_when_required: true
  },
  transport: {
    request_id_header: 'X-Request-ID',
    correlation_id_header: 'x-correlation-id',
    request_id_echoed: true,
    correlation_id_echoed: true,
    contract_version_header: 'X-MarkOrbit-Contract-Version',
    source_owner_header: 'X-MarkOrbit-Source-Owner'
  },
  planes: {
    query: { prefix: '/api/v1', methods: ['GET'] },
    change_feed: {
      path: '/api/v1/us/changes',
      methods: ['GET'],
      cursor_semantics: 'LOSSLESS_OBSERVATION_CURSOR_NOT_LEGAL_CONCLUSION'
    },
    admin: {
      prefixes: ['/api/admin', '/api/jobs'],
      part_of_consumer_contract: false
    }
  },
  stable_resources: ['/api/v1/us/cases/{serial_number}', '/api/v1/us/changes'],
  g0_contract: g0Contract
};

describe('Data Engine Integration Contract V1', () => {
  it('accepts the frozen fact envelope fixture', async () => {
    const parsed = parseDataEngineFactEnvelope(await factFixture());

    expect(parsed?.contract_version).toBe(DATA_ENGINE_INTEGRATION_CONTRACT_VERSION);
    expect(parsed?.source_owner).toBe('MARKORBIT_DATA_ENGINE');
    expect(parsed?.legal_conclusion).toBe(false);
  });

  it.each([
    (value: Record<string, unknown>) => ({ ...value, contract_version: 'V2' }),
    (value: Record<string, unknown>) => ({ ...value, source_owner: 'CORE' }),
    (value: Record<string, unknown>) => ({ ...value, legal_conclusion: true }),
    (value: Record<string, unknown>) => ({
      ...value,
      resource_kind: 'LEGAL_TITLE'
    })
  ])('rejects source-fact envelopes outside the frozen V1 authority', async (change) => {
    expect(
      parseDataEngineFactEnvelope(change((await factFixture()) as Record<string, unknown>))
    ).toBe(null);
  });

  it('accepts the read-only descriptor and rejects cross-service database access', () => {
    expect(parseDataEngineIntegrationDescriptor(descriptor)).not.toBeNull();
    expect(
      parseDataEngineIntegrationDescriptor({
        ...descriptor,
        consumer_policy: {
          ...descriptor.consumer_policy,
          cross_service_database_access: true
        }
      })
    ).toBe(null);
  });

  it('rejects descriptors that admit admin routes into the consumer contract', () => {
    expect(
      parseDataEngineIntegrationDescriptor({
        ...descriptor,
        planes: {
          ...descriptor.planes,
          admin: {
            prefixes: ['/api/admin', '/api/jobs'],
            part_of_consumer_contract: true
          }
        }
      })
    ).toBe(null);
  });
});
