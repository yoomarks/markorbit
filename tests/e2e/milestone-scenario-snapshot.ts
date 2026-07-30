import { expect } from '@playwright/test';
import type {
  MilestoneScenarioRecordSnapshot,
  RecordCollectionSnapshot
} from '@markorbit/contracts';
import { milestoneUrls } from '../../scripts/milestone-runtime.mjs';

export async function fetchScenarioSnapshot(
  scenario: string
): Promise<MilestoneScenarioRecordSnapshot> {
  const response = await fetch(
    `${milestoneUrls.gateway}/__milestone/scenarios/${encodeURIComponent(scenario)}/records`
  );
  expect(response.status).toBe(200);
  return normalizeScenarioSnapshot((await response.json()) as MilestoneScenarioRecordSnapshot);
}

export function normalizeScenarioSnapshot(
  snapshot: MilestoneScenarioRecordSnapshot
): MilestoneScenarioRecordSnapshot {
  const normalize = (collection: RecordCollectionSnapshot): RecordCollectionSnapshot => ({
    totalCount: collection.totalCount,
    activeCount: collection.activeCount,
    activeIds: [...collection.activeIds].sort(),
    records: [...collection.records]
      .map((record) => ({ ...record }))
      .sort((left, right) => left.id.localeCompare(right.id))
  });
  return {
    scenario: snapshot.scenario,
    matterDrafts: normalize(snapshot.matterDrafts),
    professionalReviewCases: normalize(snapshot.professionalReviewCases),
    preparationLocks: normalize(snapshot.preparationLocks),
    filingAuthorizations: normalize(snapshot.filingAuthorizations),
    executionReleases: normalize(snapshot.executionReleases),
    filingExecutionTaskDrafts: normalize(snapshot.filingExecutionTaskDrafts),
    authorityConsequences: { ...snapshot.authorityConsequences }
  };
}

export function assertCollectionStable(
  before: RecordCollectionSnapshot,
  after: RecordCollectionSnapshot
) {
  expect(after.totalCount).toBe(before.totalCount);
  expect(after.activeCount).toBe(before.activeCount);
  expect(after.activeIds).toEqual(before.activeIds);
  expect(after.records).toEqual(before.records);
}

export function assertScenarioSnapshotEqual(
  before: MilestoneScenarioRecordSnapshot,
  after: MilestoneScenarioRecordSnapshot
) {
  expect(after.scenario).toBe(before.scenario);
  assertCollectionStable(before.matterDrafts, after.matterDrafts);
  assertCollectionStable(before.professionalReviewCases, after.professionalReviewCases);
  assertCollectionStable(before.preparationLocks, after.preparationLocks);
  assertCollectionStable(before.filingAuthorizations, after.filingAuthorizations);
  assertCollectionStable(before.executionReleases, after.executionReleases);
  assertCollectionStable(before.filingExecutionTaskDrafts, after.filingExecutionTaskDrafts);
  expect(Object.values(after.authorityConsequences)).toEqual(Array(13).fill(false));
  expect(after.authorityConsequences).toEqual(before.authorityConsequences);
}
