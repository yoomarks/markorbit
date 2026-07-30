/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await, @typescript-eslint/await-thenable -- compact repository fixtures exercise a test-only normalization boundary. */
import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createMarkReg,
  InMemoryMatterFlowRepository,
  InMemoryPreparationRepository
} from '../../../services/markreg/src/index.js';
import {
  createRuntime as createExecution,
  InMemoryProfessionalReviewRepository,
  InMemoryFilingGovernanceRepository
} from '../../../services/execution/src/index.js';
import { createRuntime as createGateway } from '../src/index.js';

const active: ServiceRuntime[] = [];
afterEach(async () =>
  Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  )
);
async function start(runtime: ServiceRuntime) {
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

async function stack(enabled: boolean) {
  const matters = new InMemoryMatterFlowRepository();
  const preparation = new InMemoryPreparationRepository();
  const reviews = new InMemoryProfessionalReviewRepository();
  const filing = new InMemoryFilingGovernanceRepository();
  const publisher = () => ({
    events: [] as unknown[],
    async publish(event: unknown) {
      this.events.push(event);
    }
  });
  const markregPublisher = publisher();
  const executionPublisher = publisher();
  for (const scenario of ['scenario-a', 'scenario-b']) {
    const suffix = scenario.at(-1)!;
    const matterDraftId = `matter-draft_${suffix}` as const;
    const reviewCaseId = `professional-review_${suffix}` as const;
    const preparationLockId = `preparation-lock_${suffix}` as const;
    const filingAuthorizationId = `filing-authorization_${suffix}` as const;
    const executionReleaseId = `execution-release_${suffix}` as const;
    await matters.createMatterDraft({
      matterDraftId,
      confirmationId: `confirmation_${suffix}`,
      customerId: `customer_${suffix}`,
      preparation: { applicantName: `${scenario} Applicant`, classes: [], documentReferences: [] },
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      updatedAt: `2026-01-0${suffix === 'a' ? 1 : 2}T00:00:00Z`
    } as any);
    await reviews.create(
      {
        reviewCaseId,
        source: { matterDraftId, matterDraftVersion: `matter-v-${suffix}` },
        status: 'REVIEWED_READY_FOR_NEXT_STEP',
        updatedAt: '2026-01-03T00:00:00Z',
        decision: { decidedAt: '2026-01-04T00:00:00Z' }
      } as any,
      `review-key-${suffix}`,
      `fingerprint-${suffix}`
    );
    await preparation.createLock({
      preparationLockId,
      documentPackageVersion: 1,
      instructionLedgerVersion: 1,
      snapshot: {
        documentPackage: { professionalReviewCaseId: reviewCaseId },
        sourceReviewDecisionVersion: '2026-01-04T00:00:00Z'
      }
    } as any);
    await filing.create(
      {
        filingAuthorizationId,
        preparationLockId,
        version: 2,
        status: 'AUTHORIZED'
      } as any,
      `authorization-key-${suffix}`,
      `fingerprint-${suffix}`
    );
    await filing.create(
      {
        executionReleaseId,
        filingAuthorizationId,
        filingAuthorizationVersion: 2,
        version: 4,
        status: 'RELEASED_FOR_EXECUTION'
      } as any,
      `release-key-${suffix}`,
      `fingerprint-${suffix}`
    );
    await filing.createFromReleasedExecution({
      schemaVersion: 1,
      filingExecutionTaskDraftId: `filing-task-draft_${suffix}`,
      executionReleaseId,
      status: 'PREPARED'
    } as any);
  }
  const markRegUrl = await start(
    createMarkReg({
      port: 0,
      matterFlowRepository: matters,
      preparationRepository: preparation,
      publisher: markregPublisher,
      milestoneTestRuntime: enabled
    })
  );
  const executionUrl = await start(
    createExecution({
      port: 0,
      reviewRepository: reviews,
      filingRepository: filing,
      publisher: executionPublisher,
      milestoneTestRuntime: enabled
    })
  );
  const gatewayUrl = await start(
    createGateway({ port: 0, markRegUrl, executionUrl, milestoneTestRuntime: enabled })
  );
  return {
    gatewayUrl,
    matters,
    preparation,
    reviews,
    filing,
    markregPublisher,
    executionPublisher
  };
}

describe('Milestone scenario authoritative repository snapshot', () => {
  it('is absent unless the Milestone test-runtime flag is enabled', async () => {
    const { gatewayUrl } = await stack(false);
    expect((await fetch(`${gatewayUrl}/__milestone/scenarios/scenario-a/records`)).status).toBe(
      404
    );
  });

  it('is stable, sorted, read-only and isolated by scenario', async () => {
    const {
      gatewayUrl,
      matters,
      preparation,
      reviews,
      filing,
      markregPublisher,
      executionPublisher
    } = await stack(true);
    const idempotencyBefore = [
      matters.snapshotIdempotencyCount(),
      preparation.snapshotIdempotencyCount(),
      reviews.snapshotIdempotencyCount(),
      filing.snapshotIdempotencyCount()
    ];
    const read = async (scenario: string) => {
      const response = await fetch(`${gatewayUrl}/__milestone/scenarios/${scenario}/records`);
      expect(response.status).toBe(200);
      return response.json() as Promise<any>;
    };
    const before = await read('scenario-a');
    const repeated = await read('scenario-a');
    expect(repeated).toEqual(before);
    for (const collection of [
      before.matterDrafts,
      before.professionalReviewCases,
      before.preparationLocks,
      before.filingAuthorizations,
      before.executionReleases,
      before.filingExecutionTaskDrafts
    ]) {
      expect(collection.totalCount).toBe(1);
      expect(collection.activeCount).toBe(1);
      expect(collection.activeIds).toEqual([...collection.activeIds].sort());
      expect(collection.records.map(({ id }: any) => id)).toEqual(
        collection.records.map(({ id }: any) => id).sort()
      );
    }
    expect(JSON.stringify(before)).not.toContain('_b');
    expect(JSON.stringify(await read('scenario-b'))).not.toContain('_a');
    expect((await matters.snapshotMatterDrafts()).length).toBe(2);
    expect(preparation.snapshotLocks().length).toBe(2);
    expect((await reviews.list()).length).toBe(2);
    expect((await filing.snapshot()).filingExecutionTaskDrafts).toHaveLength(2);
    expect([
      matters.snapshotIdempotencyCount(),
      preparation.snapshotIdempotencyCount(),
      reviews.snapshotIdempotencyCount(),
      filing.snapshotIdempotencyCount()
    ]).toEqual(idempotencyBefore);
    expect(markregPublisher.events).toEqual([]);
    expect(executionPublisher.events).toEqual([]);
    expect(Object.values(before.authorityConsequences)).toEqual(Array(13).fill(false));
  });
});
