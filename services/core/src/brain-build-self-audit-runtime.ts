import type { BrainBuildRun } from '@markorbit/contracts/brain-build';
import type { ManagedDatabase } from '@markorbit/persistence';
import {
  auditAndRecordBrainBuildRun,
  type BrainBuildSelfAuditObservationV1
} from './brain-build-self-audit-observation.js';
import { PostgresBrainGapRegistry } from './brain-gap-registry-postgres.js';

/**
 * Production-capable Brain Build self-audit construction boundary.
 *
 * This deliberately requires an already-started ManagedDatabase and always binds
 * the governed self-audit coordinator to durable BrainGap persistence. Tests that
 * intentionally need process-local behavior can continue to inject the existing
 * InMemoryBrainGapRegistry directly into auditAndRecordBrainBuildRun.
 *
 * This bootstrap creates no Research Mission, Method Improvement trigger,
 * Capability/Coverage Gap, activation, Product state, or Official Truth authority.
 */
export function createPostgresBrainBuildSelfAuditRuntimeV1(database: ManagedDatabase) {
  const brainGaps = new PostgresBrainGapRegistry(database);
  return Object.freeze({
    brainGaps,
    observe(
      run: Readonly<BrainBuildRun>,
      auditedAt: string
    ): Promise<Readonly<BrainBuildSelfAuditObservationV1>> {
      return auditAndRecordBrainBuildRun(run, auditedAt, brainGaps);
    }
  });
}
