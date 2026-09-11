import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  liteIntakeFieldPaths,
  liteIntakeInlineTextSha256V1,
  noLiteIntakeStagingAuthorityConsequencesV1,
  type LiteIntakeCaseCandidateId,
  type LiteIntakeFieldCandidateV1,
  type LiteIntakeReviewedMaterialV1,
  type LiteIntakeStagingV1
} from '@markorbit/contracts/lite-intake-staging';
import {
  noEarlyFunnelAuthorityConsequences,
  type CreateProductionIntakeCommandV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  LiteIntakeProductionIntakeClientError,
  LiteIntakeStagingRuntimeError,
  LiteIntakeStagingService,
  type LiteIntakeStagingStorePort
} from '../src/lite-intake-staging.js';

const workspaceId = '66666666-6666-4666-8666-666666666666';
const stagingId = 'lite-intake-staging_runtime';
const caseId = 'lite-intake-case_runtime' as LiteIntakeCaseCandidateId;
const sourceId = 'lite-intake-source_runtime' as const;
const baseTime = Date.parse('2026-09-11T10:00:00.000Z');
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_intake_reviewer',
  sessionId: 'session_intake_reviewer',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_intake_reviewer',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage', 'matter:create']
};
type OwnerCreate = (
  principal: Readonly<WorkspacePrincipal>,
  command: Readonly<CreateProductionIntakeCommandV1>
) => Promise<Readonly<ProductionIntakeV1>>;
function material(mark = 'ORBIT CAT'): LiteIntakeReviewedMaterialV1 {
  return {
    channel: 'LITE_PROFESSIONAL',
    relationshipModel: 'DIRECT',
    input: {
      businessContext: 'New filing instruction',
      applicant: { type: 'ORGANIZATION', name: 'Orbit Cat LLC', country: 'US' },
      trademark: { type: 'WORD', representationText: mark },
      targetJurisdictions: ['US'],
      goodsServices: { sourceText: 'downloadable software' },
      filingGoal: 'Register the mark'
    }
  };
}

function valueForPath(reviewed: LiteIntakeReviewedMaterialV1, path: string) {
  const values: Record<string, string | readonly string[]> = {
    channel: reviewed.channel,
    relationshipModel: reviewed.relationshipModel,
    'input.businessContext': reviewed.input.businessContext,
    'input.applicant.type': reviewed.input.applicant.type,
    'input.applicant.name': reviewed.input.applicant.name,
    'input.applicant.country': reviewed.input.applicant.country,
    'input.trademark.type': reviewed.input.trademark.type,
    'input.trademark.representationText': reviewed.input.trademark.representationText,
    'input.targetJurisdictions': reviewed.input.targetJurisdictions,
    'input.goodsServices.sourceText': reviewed.input.goodsServices.sourceText,
    'input.filingGoal': reviewed.input.filingGoal
  };
  return values[path]!;
}

function unreviewedFields(reviewed = material()): LiteIntakeFieldCandidateV1[] {
  return liteIntakeFieldPaths.map((fieldPath, index) => ({
    fieldCandidateId: `lite-intake-field_runtime_${index}`,
    fieldPath,
    proposedValue: valueForPath(reviewed, fieldPath),
    originClass: 'USER_SUPPLIED',
    sourceIds: [sourceId],
    aiExtractionIds: [],
    reviewState: 'UNREVIEWED',
    reviewedByPrincipalId: null,
    reviewedAt: null
  }));
}
function reviewedFields(reviewed = material()) {
  return liteIntakeFieldPaths.map((fieldPath, index) => ({
    fieldCandidateId: `lite-intake-field_runtime_${index}` as const,
    fieldPath,
    proposedValue: valueForPath(reviewed, fieldPath),
    originClass: 'USER_SUPPLIED' as const,
    sourceIds: [sourceId],
    aiExtractionIds: [],
    reviewState: 'CONFIRMED' as const
  }));
}

function stagingFixture(): LiteIntakeStagingV1 {
  const textSnapshot = 'Please file ORBIT CAT in the United States.';
  return {
    schemaVersion: 1,
    stagingId,
    workspaceId,
    version: 1,
    lifecycle: 'ACTIVE',
    sources: [
      {
        sourceId,
        kind: 'USER_INLINE_TEXT',
        owner: 'LITE',
        textSnapshot,
        sha256: liteIntakeInlineTextSha256V1(textSnapshot),
        sizeBytes: Buffer.byteLength(textSnapshot),
        recordedByPrincipalId: principal.userId,
        recordedAt: '2026-09-11T10:00:00.000Z'
      }
    ],
    aiExtractions: [],
    caseCandidates: [
      {
        caseCandidateId: caseId,
        contentVersion: 1,
        state: 'NEEDS_REVIEW',
        fieldCandidates: unreviewedFields(),
        reviewedCommit: null,
        productionIntakeReceipt: null,
        archivedAt: null
      }
    ],
    authorityConsequences: noLiteIntakeStagingAuthorityConsequencesV1,
    createdAt: '2026-09-11T10:00:00.000Z',
    updatedAt: '2026-09-11T10:00:00.000Z',
    archivedAt: null
  };
}

function memoryStore(initial = stagingFixture()) {
  let current = structuredClone(initial);
  const reserved = new Map<
    string,
    { commandType: string; requestFingerprint: string; result?: LiteIntakeStagingV1 }
  >();
  let tick = 1;
  const at = () => new Date(baseTime + tick++ * 1000).toISOString();

  type MutateInput = Parameters<LiteIntakeStagingStorePort['mutate']>[0];
  type TransitionInput = Parameters<LiteIntakeStagingStorePort['transition']>[0];
  const store = {
    create: vi.fn(() => Promise.resolve(structuredClone(current))),
    getExact: vi.fn((_workspace: string, _id: string, version: number) =>
      Promise.resolve(version === current.version ? structuredClone(current) : undefined)
    ),
    getLatest: vi.fn(() => Promise.resolve(structuredClone(current))),
    listLatest: vi.fn(() => Promise.resolve([structuredClone(current)])),
    mutate: vi.fn((input: MutateInput) => {
      if (input.expectedVersion !== current.version)
        return Promise.reject(
          new LiteIntakeStagingRuntimeError(
            'VERSION_CONFLICT',
            `Expected staging version ${input.expectedVersion}, found ${current.version}.`
          )
        );
      current = input.materialize(structuredClone(current), at());
      return Promise.resolve(structuredClone(current));
    }),
    transition: vi.fn((input: TransitionInput) => {
      if (input.expectedVersion !== current.version)
        return Promise.reject(
          new LiteIntakeStagingRuntimeError(
            'VERSION_CONFLICT',
            `Expected staging version ${input.expectedVersion}, found ${current.version}.`
          )
        );
      current = input.materialize(structuredClone(current), at());
      return Promise.resolve(structuredClone(current));
    }),
    reserveCommand: vi.fn((_workspace: string, key: string, type: string, fp: string) => {
      const prior = reserved.get(key);
      if (prior) {
        if (prior.commandType !== type || prior.requestFingerprint !== fp)
          return Promise.reject(
            new LiteIntakeStagingRuntimeError('IDEMPOTENCY_CONFLICT', 'different command')
          );
        return Promise.resolve(prior.result ? structuredClone(prior.result) : undefined);
      }
      reserved.set(key, { commandType: type, requestFingerprint: fp });
      return Promise.resolve(undefined);
    }),
    completeReservedCommand: vi.fn(
      (_workspace: string, key: string, type: string, fp: string, result: LiteIntakeStagingV1) => {
        const prior = reserved.get(key);
        if (!prior || prior.commandType !== type || prior.requestFingerprint !== fp)
          return Promise.reject(
            new LiteIntakeStagingRuntimeError('INTEGRITY_FAILURE', 'reservation mismatch', 500)
          );
        prior.result = structuredClone(result);
        return Promise.resolve(structuredClone(result));
      }
    )
  } satisfies LiteIntakeStagingStorePort;

  return {
    store,
    current: () => structuredClone(current)
  };
}

function ownerResponse(
  command: Readonly<CreateProductionIntakeCommandV1>,
  overrides: Partial<ProductionIntakeV1> = {}
): ProductionIntakeV1 {
  return {
    schemaVersion: 1,
    intakeId: 'intake_runtime-owner',
    workspaceId,
    version: 1,
    status: 'RECEIVED',
    channel: command.channel,
    relationshipModel: command.relationshipModel,
    input: structuredClone(command.input),
    sourceClass: 'CUSTOMER_SUPPLIED',
    fingerprintSha256: 'a'.repeat(64),
    createdAt: '2026-09-11T10:10:00.000Z',
    updatedAt: '2026-09-11T10:10:00.000Z',
    authorityConsequences: noEarlyFunnelAuthorityConsequences,
    ...overrides
  };
}

describe('Lite Intake Staging runtime state machine', () => {
  it('binds explicit human review to the exact staging/content fingerprint with no authority side effects', async () => {
    const memory = memoryStore();
    const service = new LiteIntakeStagingService(memory.store, { create: vi.fn() });
    const reviewed = material();
    const frozen = await service.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId,
      caseCandidateId: caseId,
      expectedVersion: 1,
      idempotencyKey: 'review-1',
      fieldCandidates: reviewedFields(reviewed),
      material: reviewed
    });
    const candidate = frozen.caseCandidates[0]!;
    expect(frozen.version).toBe(2);
    expect(candidate.state).toBe('READY_TO_COMMIT');
    expect(candidate.reviewedCommit).toMatchObject({
      reviewedStagingVersion: 2,
      reviewedContentVersion: 2,
      confirmedByPrincipalId: principal.userId
    });
    expect(Object.values(frozen.authorityConsequences).every((value) => value === false)).toBe(
      true
    );
  });
  it('rejects stale review after the staging version changes', async () => {
    const memory = memoryStore();
    const service = new LiteIntakeStagingService(memory.store, { create: vi.fn() });
    await service.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId,
      caseCandidateId: caseId,
      expectedVersion: 1,
      idempotencyKey: 'review-fresh',
      fieldCandidates: reviewedFields(),
      material: material()
    });
    await expect(
      service.reviewCase({
        workspaceId,
        actorPrincipalId: principal.userId,
        stagingId,
        caseCandidateId: caseId,
        expectedVersion: 1,
        idempotencyKey: 'review-stale',
        fieldCandidates: reviewedFields(),
        material: material()
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('commits only the frozen reviewed material and replays the exact local command', async () => {
    const memory = memoryStore();
    const create = vi.fn<OwnerCreate>((ownerPrincipal, command) => {
      void ownerPrincipal;
      return Promise.resolve(ownerResponse(command));
    });
    const service = new LiteIntakeStagingService(memory.store, { create });
    const reviewed = await service.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId,
      caseCandidateId: caseId,
      expectedVersion: 1,
      idempotencyKey: 'review-commit',
      fieldCandidates: reviewedFields(),
      material: material()
    });
    const reviewedCommit = reviewed.caseCandidates[0]!.reviewedCommit!;
    const commitCommand = {
      workspaceId,
      stagingId,
      caseCandidateId: caseId,
      expectedVersion: reviewed.version,
      expectedReviewedFingerprintSha256: reviewedCommit.reviewedFingerprintSha256,
      idempotencyKey: 'commit-1',
      principal
    } as const;
    const first = await service.commitCase(commitCommand);
    expect(first.status).toBe('COMMITTED');
    expect(first.staging.caseCandidates[0]).toMatchObject({
      state: 'COMMITTED',
      productionIntakeReceipt: {
        intakeId: 'intake_runtime-owner',
        reviewedFingerprintSha256: reviewedCommit.reviewedFingerprintSha256
      }
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![1]).toMatchObject({
      idempotencyKey: reviewedCommit.markRegIdempotencyKey,
      correlationId: reviewedCommit.correlationId,
      input: reviewedCommit.material.input
    });

    const replay = await service.commitCase(commitCommand);
    expect(replay).toEqual(first);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('persists COMMIT_UNCERTAIN and reconciles with the same MarkReg key/body', async () => {
    const memory = memoryStore();
    let ownerAttempts = 0;
    const create = vi.fn<OwnerCreate>((ownerPrincipal, command) => {
      void ownerPrincipal;
      ownerAttempts += 1;
      return ownerAttempts === 1
        ? Promise.reject(new LiteIntakeProductionIntakeClientError('timeout after dispatch', true))
        : Promise.resolve(ownerResponse(command));
    });
    const service = new LiteIntakeStagingService(memory.store, { create });
    const reviewed = await service.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId,
      caseCandidateId: caseId,
      expectedVersion: 1,
      idempotencyKey: 'review-uncertain',
      fieldCandidates: reviewedFields(),
      material: material()
    });
    const review = reviewed.caseCandidates[0]!.reviewedCommit!;
    const command = {
      workspaceId,
      stagingId,
      caseCandidateId: caseId,
      expectedVersion: reviewed.version,
      expectedReviewedFingerprintSha256: review.reviewedFingerprintSha256,
      idempotencyKey: 'commit-uncertain',
      principal
    } as const;
    const uncertain = await service.commitCase(command);
    expect(uncertain.status).toBe('COMMIT_UNCERTAIN');
    expect(uncertain.staging.caseCandidates[0]!.state).toBe('COMMIT_UNCERTAIN');

    const reconciled = await service.commitCase(command);
    expect(reconciled.status).toBe('COMMITTED');
    expect(reconciled.staging.caseCandidates[0]!.state).toBe('COMMITTED');
    expect(create).toHaveBeenCalledTimes(2);
    const firstCommand = create.mock.calls[0]![1];
    const secondCommand = create.mock.calls[1]![1];
    expect(secondCommand).toEqual(firstCommand);
    expect(secondCommand.idempotencyKey).toBe(review.markRegIdempotencyKey);
  });

  it('fails closed on MarkReg owner material drift and retains uncertain reconciliation state', async () => {
    const memory = memoryStore();
    const create = vi.fn<OwnerCreate>((ownerPrincipal, command) => {
      void ownerPrincipal;
      return Promise.resolve(
        ownerResponse(command, {
          input: { ...command.input, filingGoal: 'Tampered owner response' }
        })
      );
    });
    const service = new LiteIntakeStagingService(memory.store, { create });
    const reviewed = await service.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId,
      caseCandidateId: caseId,
      expectedVersion: 1,
      idempotencyKey: 'review-owner-drift',
      fieldCandidates: reviewedFields(),
      material: material()
    });
    const review = reviewed.caseCandidates[0]!.reviewedCommit!;
    await expect(
      service.commitCase({
        workspaceId,
        stagingId,
        caseCandidateId: caseId,
        expectedVersion: reviewed.version,
        expectedReviewedFingerprintSha256: review.reviewedFingerprintSha256,
        idempotencyKey: 'commit-owner-drift',
        principal
      })
    ).rejects.toMatchObject({ code: 'OWNER_RESPONSE_MISMATCH' });
    expect(memory.current().caseCandidates[0]!.state).toBe('COMMIT_UNCERTAIN');
    expect(memory.current().caseCandidates[0]!.productionIntakeReceipt).toBeNull();
  });

  it('uses distinct deterministic downstream keys for sibling case candidates', async () => {
    const first = stagingFixture();
    const secondId = 'lite-intake-case_runtime-two' as LiteIntakeCaseCandidateId;
    first.caseCandidates = [
      ...first.caseCandidates,
      {
        caseCandidateId: secondId,
        contentVersion: 1,
        state: 'NEEDS_REVIEW',
        fieldCandidates: unreviewedFields(material('ORBIT DOG')).map((field, index) => ({
          ...field,
          fieldCandidateId: `lite-intake-field_runtime_two_${index}`
        })),
        reviewedCommit: null,
        productionIntakeReceipt: null,
        archivedAt: null
      }
    ];
    const memory = memoryStore(first);
    const service = new LiteIntakeStagingService(memory.store, { create: vi.fn() });
    const firstReviewed = await service.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId,
      caseCandidateId: caseId,
      expectedVersion: 1,
      idempotencyKey: 'review-first-sibling',
      fieldCandidates: reviewedFields(material('ORBIT CAT')),
      material: material('ORBIT CAT')
    });
    const secondReviewed = await service.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId,
      caseCandidateId: secondId,
      expectedVersion: firstReviewed.version,
      idempotencyKey: 'review-second-sibling',
      fieldCandidates: reviewedFields(material('ORBIT DOG')).map((field, index) => ({
        ...field,
        fieldCandidateId: `lite-intake-field_runtime_two_${index}`
      })),
      material: material('ORBIT DOG')
    });
    const keys = secondReviewed.caseCandidates.map(
      (candidate) => candidate.reviewedCommit?.markRegIdempotencyKey
    );
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).toContain(caseId);
    expect(keys[1]).toContain(secondId);
  });
});
