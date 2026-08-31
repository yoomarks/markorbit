import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { QueryClient } from '@markorbit/persistence';
import { PostgresCurrentRuntimeCapabilityCatalogV1 } from '../src/runtime-capability-catalog.js';

function definition(capabilityId: string, version: number): RuntimeCapabilityDefinition {
  return {
    schemaVersion: 1,
    runtimeCapabilityDefinitionId: `runtime-capability_${capabilityId}`,
    version,
    capabilityId,
    capabilityVersion: `${version}.0.0`,
    title: capabilityId,
    description: `Current ${capabilityId}`,
    lineage: { capabilityId },
    canonReference: {
      canonId: `canon:${capabilityId}`,
      canonVersion: `${version}`,
      sourceFingerprintSha256: 'a'.repeat(64)
    },
    acceptedCanonProjection: true,
    createdFromWorkEvidence: false,
    createdFromAiOutput: false,
    createdAt: '2026-08-31T00:00:00.000Z'
  };
}

function queryClient(rows: readonly { capability_id: string }[]): QueryClient {
  return {
    query: () =>
      Promise.resolve({
        command: 'SELECT',
        rowCount: rows.length,
        oid: 0,
        fields: [],
        rows: [...rows]
      })
  };
}

function failingQueryClient(error: Error): QueryClient {
  return {
    query: () => Promise.reject(error)
  };
}

describe('PostgresCurrentRuntimeCapabilityCatalogV1', () => {
  it('enumerates identity ids and delegates each current document to the governed registry lookup', async () => {
    const calls: string[] = [];
    const records = new Map([
      ['alpha-capability', definition('alpha-capability', 2)],
      ['zeta-capability', definition('zeta-capability', 4)]
    ]);
    const catalog = new PostgresCurrentRuntimeCapabilityCatalogV1(
      queryClient([{ capability_id: 'zeta-capability' }, { capability_id: 'alpha-capability' }]),
      {
        findCurrent: (capabilityId) => {
          calls.push(capabilityId);
          return Promise.resolve(records.get(capabilityId));
        }
      }
    );

    const current = await catalog.listCurrent();
    expect(calls).toEqual(['zeta-capability', 'alpha-capability']);
    expect(current.map((item) => [item.capabilityId, item.version])).toEqual([
      ['alpha-capability', 2],
      ['zeta-capability', 4]
    ]);
  });

  it('fails closed when an identity has no current governed definition', async () => {
    const catalog = new PostgresCurrentRuntimeCapabilityCatalogV1(
      queryClient([{ capability_id: 'missing-capability' }]),
      { findCurrent: () => Promise.resolve(undefined) }
    );
    await expect(catalog.listCurrent()).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
  });

  it('wraps query failures as persistence unavailability', async () => {
    const catalog = new PostgresCurrentRuntimeCapabilityCatalogV1(
      failingQueryClient(new Error('database unavailable')),
      { findCurrent: () => Promise.resolve(undefined) }
    );
    await expect(catalog.listCurrent()).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
  });
});
