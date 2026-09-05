import { describe, expect, it } from 'vitest';
import type {
  LifecycleProjectionState,
  RecommendedActionStatus
} from '@markorbit/contracts/evidence-lifecycle';
import {
  WORKSPACE_ACTION_LIMIT,
  WorkspaceActionReadService,
  type WorkspaceActionReadError,
  type WorkspaceActionSourceReader,
  type WorkspaceActionSourceRecord
} from '../src/workspace-action-read.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const sha = (character: string) => character.repeat(64);

function record(
  suffix: string,
  input: {
    lifecycleState?: LifecycleProjectionState;
    eventCode?: string;
    actionStatus?: RecommendedActionStatus;
    staleAction?: boolean;
    noAction?: boolean;
    noLifecycle?: boolean;
    staleLifecycle?: boolean;
    changedAt?: string;
  } = {}
): WorkspaceActionSourceRecord {
  const formalMatterId = `formal-matter_${suffix}`;
  const changedAt = input.changedAt ?? '2026-09-05T10:00:00.000Z';
  const lifecycleState = input.lifecycleState ?? 'CUSTOMER_ACTION_NEEDED';
  const lifecycleId = `lifecycle-view_${suffix}`;
  const eventId = `lifecycle-event_${suffix}`;
  return {
    formalMatter: {
      id: formalMatterId,
      version: 1,
      trademark: `Mark ${suffix}`,
      applicant: `Applicant ${suffix}`,
      jurisdiction: 'US',
      updatedAt: changedAt
    },
    ...(input.noLifecycle
      ? {}
      : {
          lifecycle: {
            id: lifecycleId,
            version: 3,
            fingerprintSha256: sha('a'),
            formalMatterVersion: input.staleLifecycle ? 2 : 1,
            currentEvent: { id: eventId, version: 4, fingerprintSha256: sha('b') },
            state: lifecycleState,
            customerSafeLabel: `Label ${suffix}`,
            customerSafeSummary: `Summary ${suffix}`,
            officialStatusVerified: false,
            updatedAt: changedAt
          },
          currentEvent: {
            id: eventId,
            version: 4,
            fingerprintSha256: sha('b'),
            formalMatterVersion: 1,
            state: lifecycleState,
            eventCode: input.eventCode ?? 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
            officialStatusVerified: false
          }
        }),
    ...(input.noAction
      ? {}
      : {
          recommendedAction: {
            id: `recommended-action_${suffix}`,
            version: 2,
            formalMatterVersion: 1,
            sourceLifecycleView: {
              id: input.staleAction ? `lifecycle-view_stale-${suffix}` : lifecycleId,
              version: 3,
              fingerprintSha256: sha('a')
            },
            title: `Review ${suffix}`,
            explanation: `Action ${suffix}`,
            timingBasis: 'No governed due date is present; no deadline is inferred.',
            status: input.actionStatus ?? 'OPEN',
            executionAuthorized: false,
            updatedAt: changedAt
          }
        })
  };
}

function reader(records: readonly WorkspaceActionSourceRecord[]): WorkspaceActionSourceReader {
  return { list: () => Promise.resolve(structuredClone(records)) };
}

function service(records: readonly WorkspaceActionSourceRecord[]) {
  return new WorkspaceActionReadService(reader(records), () => '2026-09-06T00:00:00.000Z');
}

describe('Workspace Action Projection V1', () => {
  it('puts only exact-current OPEN Recommended Actions in needsAttention', async () => {
    const result = await service([
      record('open-a'),
      record('open-b', { changedAt: '2026-09-05T11:00:00.000Z' }),
      record('ack', { actionStatus: 'ACKNOWLEDGED' }),
      record('dismissed', { actionStatus: 'DISMISSED' }),
      record('suppressed', { actionStatus: 'SUPPRESSED' }),
      record('stale', { staleAction: true })
    ]).get(workspaceId);

    expect(result.needsAttention.map((item) => item.formalMatter.id)).toEqual([
      'formal-matter_open-b',
      'formal-matter_open-a'
    ]);
    expect(result.waitingOrInProgress).toHaveLength(4);
    expect(
      result.waitingOrInProgress.find((item) => item.formalMatter.id === 'formal-matter_stale')
    ).toMatchObject({ attentionStatus: 'STALE', recommendedAction: null });
    expect(
      result.waitingOrInProgress
        .filter((item) =>
          ['formal-matter_ack', 'formal-matter_dismissed', 'formal-matter_suppressed'].includes(
            item.formalMatter.id
          )
        )
        .every((item) => item.attentionStatus === 'NONE')
    ).toBe(true);
  });

  it('keeps no-current-action Matter as waiting/in progress without inventing deadline or authority', async () => {
    const result = await service([record('waiting', { noAction: true })]).get(workspaceId);
    expect(result.needsAttention).toEqual([]);
    expect(result.waitingOrInProgress[0]).toMatchObject({
      currentness: 'CURRENT',
      attentionStatus: 'NONE',
      recommendedAction: null,
      officialStatusVerified: false,
      authorityConsequences: {
        protectedActionAuthorized: false,
        filingAuthorized: false,
        filingSubmitted: false,
        paymentCreated: false,
        providerContacted: false,
        officeMutationCreated: false,
        officialTruthCreated: false
      }
    });
    expect(result.waitingOrInProgress[0]?.examination).toMatchObject({
      deadline: null,
      deadlineStatus: 'UNAVAILABLE',
      officialStatusVerified: false
    });
  });

  it('derives Examination context only from the existing exact event-code/state policy', async () => {
    const established = await service([
      record('exam', {
        lifecycleState: 'WAITING_NO_ACTION',
        eventCode: 'EXAMINATION_WAITING_NO_ACTION',
        noAction: true
      })
    ]).get(workspaceId);
    expect(established.recentlyChanged[0]?.examination).toMatchObject({
      status: 'ESTABLISHED',
      workflowState: 'WAITING_NO_ACTION',
      eventCode: 'EXAMINATION_WAITING_NO_ACTION',
      deadline: null,
      officialStatusVerified: false
    });

    const unrelated = await service([
      record('not-exam', {
        lifecycleState: 'WAITING_NO_ACTION',
        eventCode: 'PROVIDER_EVIDENCE_REVIEWED',
        noAction: true
      })
    ]).get(workspaceId);
    expect(unrelated.recentlyChanged[0]?.examination).toBeNull();
  });

  it('fails closed when an Examination event code is paired with the wrong lifecycle state', async () => {
    await expect(
      service([
        record('bad-exam', {
          lifecycleState: 'WAITING_NO_ACTION',
          eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
          noAction: true
        })
      ]).get(workspaceId)
    ).rejects.toMatchObject({
      code: 'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
      status: 503,
      retryable: true
    } satisfies Partial<WorkspaceActionReadError>);
  });

  it('marks stale lifecycle source explicitly and never promotes its action', async () => {
    const result = await service([record('stale-lifecycle', { staleLifecycle: true })]).get(
      workspaceId
    );
    expect(result.needsAttention).toEqual([]);
    expect(result.waitingOrInProgress[0]).toMatchObject({
      currentness: 'STALE',
      lifecycle: null,
      attentionStatus: 'STALE',
      recommendedAction: null,
      examination: null
    });
  });

  it('uses exact owner timestamps for recent ordering rather than urgency inference', async () => {
    const result = await service([
      record('older-action', { changedAt: '2026-09-05T09:00:00.000Z' }),
      record('newer-waiting', {
        changedAt: '2026-09-05T12:00:00.000Z',
        noAction: true,
        lifecycleState: 'INTERNAL_PROCESSING',
        eventCode: 'EXAMINATION_INTERNAL_PROCESSING'
      })
    ]).get(workspaceId);
    expect(result.recentlyChanged.map((item) => item.formalMatter.id)).toEqual([
      'formal-matter_newer-waiting',
      'formal-matter_older-action'
    ]);
    expect(result.needsAttention[0]?.formalMatter.id).toBe('formal-matter_older-action');
  });

  it('returns successful empty truth and bounds the projection', async () => {
    expect(await service([]).get(workspaceId)).toMatchObject({
      schemaVersion: 1,
      workspaceId,
      needsAttention: [],
      waitingOrInProgress: [],
      recentlyChanged: [],
      truncated: false,
      officialStatusVerified: false
    });

    const many = Array.from({ length: WORKSPACE_ACTION_LIMIT + 1 }, (_, index) =>
      record(`many-${String(index).padStart(3, '0')}`, { noAction: true })
    );
    const bounded = await service(many).get(workspaceId);
    expect(bounded.truncated).toBe(true);
    expect(bounded.recentlyChanged).toHaveLength(WORKSPACE_ACTION_LIMIT);
  });

  it('maps source failure to retryable 503 instead of an empty Workspace', async () => {
    const failed: WorkspaceActionSourceReader = {
      list: () => Promise.reject(new Error('db offline'))
    };
    await expect(new WorkspaceActionReadService(failed).get(workspaceId)).rejects.toMatchObject({
      code: 'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});
