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
  stable_resources: ['/api/v1/us/cases/{serial_number}', '/api/v1/us/changes']
};

describe('Data Engine Integration Contract V1', () => {
  it('accepts the frozen fact envelope fixture', async () => {
    const parsed = parseDataEngineFactEnvelope(await factFixture());

    expect(parsed?.contract_version).toBe(
      DATA_ENGINE_INTEGRATION_CONTRACT_VERSION
    );
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
  ])(
    'rejects source-fact envelopes outside the frozen V1 authority',
    async (change) => {
      expect(
        parseDataEngineFactEnvelope(
          change((await factFixture()) as Record<string, unknown>)
        )
      ).toBe(null);
    }
  );

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
