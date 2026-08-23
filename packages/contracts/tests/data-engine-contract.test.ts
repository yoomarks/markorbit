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

async function descriptorFixture() {
  return JSON.parse(
    await readFile(
      new URL(
        '../fixtures/data-engine-integration-descriptor-v1.fixture',
        import.meta.url
      ),
      'utf8'
    )
  ) as unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

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

  it('accepts the read-only descriptor and rejects cross-service database access', async () => {
    const descriptor = record(await descriptorFixture());
    const consumerPolicy = record(descriptor.consumer_policy);

    expect(parseDataEngineIntegrationDescriptor(descriptor)).not.toBeNull();
    expect(
      parseDataEngineIntegrationDescriptor({
        ...descriptor,
        consumer_policy: {
          ...consumerPolicy,
          cross_service_database_access: true
        }
      })
    ).toBe(null);
  });

  it('rejects descriptors that admit admin routes into the consumer contract', async () => {
    const descriptor = record(await descriptorFixture());
    const planes = record(descriptor.planes);
    const admin = record(planes.admin);

    expect(
      parseDataEngineIntegrationDescriptor({
        ...descriptor,
        planes: {
          ...planes,
          admin: {
            ...admin,
            part_of_consumer_contract: true
          }
        }
      })
    ).toBe(null);
  });
});
