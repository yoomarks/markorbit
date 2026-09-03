import type { ManagedDatabase } from '@markorbit/persistence';
import {
  MethodImprovementCoverageGapAdmissionServiceV1,
  type CapabilityCoverageGapEvidenceAuthorityV1,
  type MethodImprovementCoverageGapAdmissionServiceOptionsV1
} from './method-improvement-coverage-gap.js';
import { PostgresMethodImprovementCoverageGapAdmissionRepositoryV1 } from './method-improvement-coverage-gap-postgres.js';

export interface PostgresMethodImprovementCoverageGapAdmissionRuntimeOptionsV1 {
  evidence: Readonly<CapabilityCoverageGapEvidenceAuthorityV1>;
  now?: MethodImprovementCoverageGapAdmissionServiceOptionsV1['now'];
  triggerIdFactory?: MethodImprovementCoverageGapAdmissionServiceOptionsV1['triggerIdFactory'];
  researchMissionIdFactory?: MethodImprovementCoverageGapAdmissionServiceOptionsV1['researchMissionIdFactory'];
}

export function createPostgresMethodImprovementCoverageGapAdmissionRuntimeV1(
  database: ManagedDatabase,
  options: Readonly<PostgresMethodImprovementCoverageGapAdmissionRuntimeOptionsV1>
): MethodImprovementCoverageGapAdmissionServiceV1 {
  return new MethodImprovementCoverageGapAdmissionServiceV1({
    repository: new PostgresMethodImprovementCoverageGapAdmissionRepositoryV1(database),
    evidence: options.evidence,
    ...(options.now ? { now: options.now } : {}),
    ...(options.triggerIdFactory ? { triggerIdFactory: options.triggerIdFactory } : {}),
    ...(options.researchMissionIdFactory
      ? { researchMissionIdFactory: options.researchMissionIdFactory }
      : {})
  });
}
