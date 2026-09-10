import { describe, expect, it } from 'vitest';
import { noLiteWorkItemAuthorityConsequencesV1 } from '@markorbit/contracts/lite-work-item';
import {
  LiteWorkItemRuntimeError,
  applyLiteWorkItemInternalFieldsV1,
  applyLiteWorkItemStatusTransitionV1,
  materializeManualLiteWorkItemV1,
  materializeSystemPreparedLiteWorkItemV1
} from '../src/lite-work-item.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const workItemId = 'lite-work-item_manual-001' as const;
const t0 = '2026-09-10T08:00:00.000Z';

function manual() {
  return materializeManualLiteWorkItemV1(
    {
      workspaceId,
      actorPrincipalId: 'principal_agency_owner',
      idempotencyKey: 'manual-create-1',
      taskType: 'REPLY_PROVIDER',
      title: 'Reply to foreign counsel',
      priority: 'IMPORTANT'
    },
    t0,
    workItemId
  );
}

describe('Lite Work Item runtime semantics', () => {
  it('materializes a manual OPEN item with only local operational authority', () => {
    const item = manual();
    expect(item).toMatchObject({
      schemaVersion: 1,
      liteWorkItemId: workItemId,
      workspaceId,
      version: 1,
      status: 'OPEN',
      priority: 'IMPORTANT',
      source: {
        sourceClass: 'MANUAL',
        recordedByPrincipalId: 'principal_agency_owner',
        recordedAt: t0
      },
      internalTiming: {
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        certifiedLegalDeadline: false
      },
      authorityConsequences: noLiteWorkItemAuthorityConsequencesV1
    });
  });

  it('derives the same system-prepared identity from the same exact source lineage', () => {
    const command = {
      workspaceId,
      taskType: 'CHECK_DEADLINE' as const,
      title: 'Review observed deadline candidate',
      source: {
        sourceClass: 'SYSTEM_PREPARED' as const,
        sourceReferences: [
          {
            owner: 'DATA_ENGINE' as const,
            kind: 'DATA_ENGINE_OBSERVATION' as const,
            sourceId: 'observation_us-001',
            sourceVersion: 7,
            sourceFingerprintSha256: 'a'.repeat(64),
            observedAt: '2026-09-10T07:00:00.000Z'
          }
        ],
        preparationFingerprintSha256: 'b'.repeat(64),
        idempotencyKey: 'system-deadline-001',
        preparedAt: '2026-09-10T07:30:00.000Z'
      },
      observedDateCandidates: [
        {
          label: 'Observed response date',
          candidateAt: '2026-09-20T00:00:00.000Z',
          source: {
            owner: 'DATA_ENGINE' as const,
            kind: 'DATA_ENGINE_OBSERVATION' as const,
            sourceId: 'observation_us-001',
            sourceVersion: 7,
            sourceFingerprintSha256: 'a'.repeat(64),
            observedAt: '2026-09-10T07:00:00.000Z'
          },
          observedAt: '2026-09-10T07:00:00.000Z',
          legalDeadlineCertified: false as const,
          officialTruthVerified: false as const
        }
      ]
    };
    const first = materializeSystemPreparedLiteWorkItemV1(command, t0);
    const replay = materializeSystemPreparedLiteWorkItemV1(command, '2026-09-10T09:00:00.000Z');
    expect(replay.liteWorkItemId).toBe(first.liteWorkItemId);
    expect(first.source).toEqual(command.source);
    expect(first.observedDateCandidates[0]).toMatchObject({
      legalDeadlineCertified: false,
      officialTruthVerified: false
    });
  });

  it('updates only editable internal fields under exact expectedVersion', () => {
    const current = manual();
    const updated = applyLiteWorkItemInternalFieldsV1(
      current,
      {
        workspaceId,
        liteWorkItemId: current.liteWorkItemId,
        expectedVersion: 1,
        idempotencyKey: 'patch-1',
        title: 'Reply and request registration certificate',
        note: 'Internal note only',
        priority: 'URGENT',
        assigneePrincipalId: 'principal_mile',
        internalTiming: {
          timeClass: 'LITE_INTERNAL_OPERATIONAL',
          internalDueAt: '2026-09-11T09:00:00.000Z',
          remindAt: '2026-09-11T08:00:00.000Z',
          followUpAt: '2026-09-12T09:00:00.000Z',
          certifiedLegalDeadline: false
        }
      },
      '2026-09-10T08:05:00.000Z'
    );
    expect(updated.version).toBe(2);
    expect(updated.source).toEqual(current.source);
    expect(updated.authorityConsequences).toEqual(noLiteWorkItemAuthorityConsequencesV1);
    expect(updated.internalTiming).toMatchObject({ certifiedLegalDeadline: false });
    expect(() =>
      applyLiteWorkItemInternalFieldsV1(
        updated,
        {
          workspaceId,
          liteWorkItemId: updated.liteWorkItemId,
          expectedVersion: 1,
          idempotencyKey: 'stale-patch',
          title: 'stale'
        },
        '2026-09-10T08:06:00.000Z'
      )
    ).toThrowError(LiteWorkItemRuntimeError);
  });

  it('enforces the contract lifecycle and maintains waiting/terminal/archive timestamps', () => {
    const open = manual();
    const waiting = applyLiteWorkItemStatusTransitionV1(
      open,
      {
        workspaceId,
        liteWorkItemId: open.liteWorkItemId,
        expectedVersion: 1,
        toStatus: 'WAITING_FOR_PROVIDER',
        idempotencyKey: 'wait-provider'
      },
      '2026-09-10T08:10:00.000Z'
    );
    expect(waiting).toMatchObject({
      version: 2,
      status: 'WAITING_FOR_PROVIDER',
      waitingSinceAt: '2026-09-10T08:10:00.000Z'
    });
    const reopened = applyLiteWorkItemStatusTransitionV1(
      waiting,
      {
        workspaceId,
        liteWorkItemId: waiting.liteWorkItemId,
        expectedVersion: 2,
        toStatus: 'OPEN',
        idempotencyKey: 'resume'
      },
      '2026-09-10T08:20:00.000Z'
    );
    expect(reopened.waitingSinceAt).toBeNull();
    const completed = applyLiteWorkItemStatusTransitionV1(
      reopened,
      {
        workspaceId,
        liteWorkItemId: reopened.liteWorkItemId,
        expectedVersion: 3,
        toStatus: 'COMPLETED',
        idempotencyKey: 'complete'
      },
      '2026-09-10T08:30:00.000Z'
    );
    expect(completed.completedAt).toBe('2026-09-10T08:30:00.000Z');
    expect(completed.authorityConsequences.workCompletionRepresentsExternalSuccess).toBe(false);
    const archived = applyLiteWorkItemStatusTransitionV1(
      completed,
      {
        workspaceId,
        liteWorkItemId: completed.liteWorkItemId,
        expectedVersion: 4,
        toStatus: 'ARCHIVED',
        idempotencyKey: 'archive'
      },
      '2026-09-10T08:40:00.000Z'
    );
    expect(archived).toMatchObject({
      version: 5,
      status: 'ARCHIVED',
      archivedFrom: 'COMPLETED',
      completedAt: '2026-09-10T08:30:00.000Z',
      archivedAt: '2026-09-10T08:40:00.000Z'
    });
    expect(() =>
      applyLiteWorkItemStatusTransitionV1(
        open,
        {
          workspaceId,
          liteWorkItemId: open.liteWorkItemId,
          expectedVersion: 1,
          toStatus: 'ARCHIVED',
          idempotencyKey: 'bad-archive'
        },
        '2026-09-10T08:10:00.000Z'
      )
    ).toThrowError(/cannot transition/);
  });
});
