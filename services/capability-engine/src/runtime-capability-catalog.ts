import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { QueryClient } from '@markorbit/persistence';
import type { CurrentRuntimeCapabilityCatalogAuthorityV1 } from './capability-catalog-integrity.js';
import {
  RuntimeCapabilityRegistryError,
  type PostgresRuntimeCapabilityRegistry
} from './runtime-capability-registry.js';

type Row = Record<string, unknown>;

type CurrentRuntimeCapabilityLookup = Pick<PostgresRuntimeCapabilityRegistry, 'findCurrent'>;

function persistedCapabilityId(row: Row): string {
  const value = row.capability_id;
  if (typeof value !== 'string' || !value.trim() || value.length > 300) {
    throw new RuntimeCapabilityRegistryError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted runtime Capability identity is invalid.',
      503
    );
  }
  return value;
}

export class PostgresCurrentRuntimeCapabilityCatalogV1 implements CurrentRuntimeCapabilityCatalogAuthorityV1 {
  constructor(
    private readonly query: QueryClient,
    private readonly registry: Readonly<CurrentRuntimeCapabilityLookup>
  ) {}

  async listCurrent(): Promise<readonly Readonly<RuntimeCapabilityDefinition>[]> {
    try {
      const result = await this.query.query(
        'SELECT capability_id FROM capability_runtime_identities ORDER BY capability_id ASC'
      );
      const definitions: RuntimeCapabilityDefinition[] = [];
      for (const row of result.rows) {
        const capabilityId = persistedCapabilityId(row as Row);
        const current = await this.registry.findCurrent(capabilityId);
        if (!current) {
          throw new RuntimeCapabilityRegistryError(
            'PERSISTENCE_UNAVAILABLE',
            'Runtime Capability identity has no current governed definition.',
            503,
            { capabilityId }
          );
        }
        definitions.push(structuredClone(current));
      }
      return definitions.sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
    } catch (error) {
      if (error instanceof RuntimeCapabilityRegistryError) throw error;
      throw new RuntimeCapabilityRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Capability Engine current runtime catalog persistence is unavailable.',
        503,
        undefined,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}
