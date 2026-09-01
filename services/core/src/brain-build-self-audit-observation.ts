import type { BrainBuildRun } from '@markorbit/contracts/brain-build';
import type { BrainGapRegistryRecord, BrainSelfAuditResult } from '@markorbit/contracts/brain-gap';
import { auditBrainBuildRun } from './brain-self-audit.js';

export interface BrainGapAuditAdmissionAuthorityV1 {
  admitAudit(
    result: Readonly<BrainSelfAuditResult>
  ):
    | readonly Readonly<BrainGapRegistryRecord>[]
    | Promise<readonly Readonly<BrainGapRegistryRecord>[]>;
}

export interface BrainBuildSelfAuditObservationNoAuthorityV1 {
  readonly missingCapabilityInferred: false;
  readonly researchMissionCreated: false;
  readonly methodImprovementTriggerCreated: false;
  readonly brainAssetAdmitted: false;
  readonly brainAssetActivated: false;
  readonly methodActivated: false;
  readonly productStateCreated: false;
  readonly recommendationCreated: false;
  readonly officialTruthCreated: false;
}

export const brainBuildSelfAuditObservationNoAuthorityV1: Readonly<BrainBuildSelfAuditObservationNoAuthorityV1> =
  Object.freeze({
    missingCapabilityInferred: false,
    researchMissionCreated: false,
    methodImprovementTriggerCreated: false,
    brainAssetAdmitted: false,
    brainAssetActivated: false,
    methodActivated: false,
    productStateCreated: false,
    recommendationCreated: false,
    officialTruthCreated: false
  });

export interface BrainBuildSelfAuditObservationV1 {
  readonly schemaVersion: 1;
  readonly audit: Readonly<BrainSelfAuditResult>;
  readonly admittedGapRecords: readonly Readonly<BrainGapRegistryRecord>[];
  readonly noAuthority: Readonly<BrainBuildSelfAuditObservationNoAuthorityV1>;
}

function cloneRecord(record: Readonly<BrainGapRegistryRecord>): BrainGapRegistryRecord {
  return structuredClone(record);
}

export async function auditAndRecordBrainBuildRun(
  run: Readonly<BrainBuildRun>,
  auditedAt: string,
  registry: BrainGapAuditAdmissionAuthorityV1
): Promise<Readonly<BrainBuildSelfAuditObservationV1>> {
  const audit = auditBrainBuildRun(run, auditedAt);
  const admittedGapRecords = (await registry.admitAudit(audit))
    .map(cloneRecord)
    .sort((left, right) => left.brainGapRegistryKey.localeCompare(right.brainGapRegistryKey));

  return {
    schemaVersion: 1,
    audit,
    admittedGapRecords,
    noAuthority: brainBuildSelfAuditObservationNoAuthorityV1
  };
}
