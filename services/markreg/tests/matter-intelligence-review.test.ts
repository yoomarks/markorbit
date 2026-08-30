import { describe, expect, it, vi } from 'vitest';
import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import {
  MatterIntelligenceReviewService,
  type MatterIntelligenceReviewError,
  type MatterIntelligenceReviewRepository
} from '../src/matter-intelligence-review.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const MATTER_ID = 'formal-matter_phase6_review' as FormalMatterId;
const OBSERVATION_ID = 'matter-intelligence-observation_phase6_review';

function principal(workspaceId = WORKSPACE_ID): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    workspaceId,
    userId: 'principal_phase6_reviewer',
    membershipId: 'membership_phase6_reviewer',
    roles: ['OWNER'],
    permissions: ['workspace:read', 'matter:manage']
  } as WorkspacePrincipal;
}

function repository() {
  const record = vi.fn(
    (command: Parameters<MatterIntelligenceReviewRepository['record']>[0]) =>
      Promise.resolve({
        review: {
          schemaVersion: 1 as const,
          matterIntelligenceReviewId: 'matter-intelligence-review_test',
          workspaceId: command.workspaceId,
          formalMatterId: command.formalMatterId,
          matterIntelligenceObservationId: command.matterIntelligenceObservationId,
          observationFingerprintSha256: 'a'.repeat(64),
          reviewVersion: 1,
          outcome: command.outcome,
          ...(command.reason === undefined ? {} : { reason: command.reason }),
          ...(command.rationale === undefined ? {} : { rationale: command.rationale }),
          reviewedByPrincipalId: command.reviewedByPrincipalId,
          reviewedAt: command.reviewedAt,
          ...(command.supersedes === undefined ? {} : { supersedes: command.supersedes }),
          reviewPayloadFingerprintSha256: command.reviewPayloadFingerprintSha256,
          reviewFingerprintSha256: 'b'.repeat(64),
          productSourceFingerprintSha256: 'c'.repeat(64),
          correlationId: command.correlationId
        },
        replayed: false,
        semanticDuplicate: false
      })
  );
  return { record, repository: { record } as MatterIntelligenceReviewRepository };
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: WORKSPACE_ID,
    formalMatterId: MATTER_ID,
    matterIntelligenceObservationId: OBSERVATION_ID,
    outcome: 'CONFIRMED' as const,
    principal: principal(),
    idempotencyKey: 'phase6-review-1',
    correlationId: 'correlation-phase6-review-1',
    ...overrides
  };
}

describe('MatterIntelligenceReviewService', () => {
  it('records a product-owned CONFIRMED review with deterministic fingerprints', async () => {
    const fake = repository();
    const service = new MatterIntelligenceReviewService(
      fake.repository,
      () => '2026-08-30T04:00:00.000Z'
    );

    const result = await service.recordReview(command());

    expect(result.review.outcome).toBe('CONFIRMED');
    expect(result.review.reason).toBeUndefined();
    expect(fake.record).toHaveBeenCalledTimes(1);
    const persisted = fake.record.mock.calls[0]![0];
    expect(persisted.reviewedByPrincipalId).toBe('principal_phase6_reviewer');
    expect(persisted.reviewedAt).toBe('2026-08-30T04:00:00.000Z');
    expect(persisted.requestFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(persisted.reviewPayloadFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['CONFIRMED', 'METHOD_ERROR'],
    ['CONFIRMED', 'INCONCLUSIVE_EVIDENCE'],
    ['OVERRIDDEN', undefined],
    ['OVERRIDDEN', 'INCONCLUSIVE_EVIDENCE'],
    ['INCONCLUSIVE', undefined],
    ['INCONCLUSIVE', 'METHOD_ERROR'],
    ['INCONCLUSIVE', 'PRODUCT_USER_PREFERENCE']
  ] as const)('rejects invalid outcome/reason pairing %s / %s', async (outcome, reason) => {
    const fake = repository();
    const service = new MatterIntelligenceReviewService(fake.repository);

    await expect(service.recordReview(command({ outcome, reason }))).rejects.toMatchObject({
      code: 'INVALID_REVIEW'
    } satisfies Partial<MatterIntelligenceReviewError>);
    expect(fake.record).not.toHaveBeenCalled();
  });

  it.each([
    ['METHOD_ERROR'],
    ['INPUT_DATA_ERROR'],
    ['APPLICABILITY_ERROR'],
    ['PRODUCT_USER_PREFERENCE']
  ] as const)('accepts OVERRIDDEN reason %s without changing the taxonomy', async (reason) => {
    const fake = repository();
    const service = new MatterIntelligenceReviewService(fake.repository);

    await service.recordReview(command({ outcome: 'OVERRIDDEN', reason }));

    expect(fake.record.mock.calls[0]![0]).toMatchObject({ outcome: 'OVERRIDDEN', reason });
  });

  it('accepts only INCONCLUSIVE_EVIDENCE for INCONCLUSIVE', async () => {
    const fake = repository();
    const service = new MatterIntelligenceReviewService(fake.repository);

    await service.recordReview(
      command({ outcome: 'INCONCLUSIVE', reason: 'INCONCLUSIVE_EVIDENCE' })
    );

    expect(fake.record.mock.calls[0]![0]).toMatchObject({
      outcome: 'INCONCLUSIVE',
      reason: 'INCONCLUSIVE_EVIDENCE'
    });
  });

  it('fails before persistence when Workspace Principal truth does not match the command', async () => {
    const fake = repository();
    const service = new MatterIntelligenceReviewService(fake.repository);

    await expect(
      service.recordReview(
        command({
          principal: principal('22222222-2222-4222-8222-222222222222')
        })
      )
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    expect(fake.record).not.toHaveBeenCalled();
  });

  it('binds explicit supersession into the request fingerprint but not the semantic payload fingerprint', async () => {
    const first = repository();
    const second = repository();
    const serviceA = new MatterIntelligenceReviewService(
      first.repository,
      () => '2026-08-30T04:00:00.000Z'
    );
    const serviceB = new MatterIntelligenceReviewService(
      second.repository,
      () => '2026-08-30T04:00:00.000Z'
    );

    await serviceA.recordReview(command({ outcome: 'OVERRIDDEN', reason: 'METHOD_ERROR' }));
    await serviceB.recordReview(
      command({
        outcome: 'OVERRIDDEN',
        reason: 'METHOD_ERROR',
        supersedes: {
          reviewId: 'matter-intelligence-review_prior',
          reviewVersion: 1
        }
      })
    );

    const plain = first.record.mock.calls[0]![0];
    const superseding = second.record.mock.calls[0]![0];
    expect(superseding.reviewPayloadFingerprintSha256).toBe(plain.reviewPayloadFingerprintSha256);
    expect(superseding.requestFingerprintSha256).not.toBe(plain.requestFingerprintSha256);
  });

  it('trims bounded rationale before fingerprinting and persistence', async () => {
    const fake = repository();
    const service = new MatterIntelligenceReviewService(fake.repository);

    await service.recordReview(command({ rationale: '  reviewed against product record  ' }));

    expect(fake.record.mock.calls[0]![0].rationale).toBe('reviewed against product record');
  });
});
