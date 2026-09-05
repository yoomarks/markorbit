import { describe, expect, it } from 'vitest';
import type { FormalMatter, FormalMatterId } from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleEventProjection,
  LifecycleProjectionState
} from '@markorbit/contracts/evidence-lifecycle';
import {
  EXAMINATION_HISTORY_LIMIT,
  type ExaminationStageReadError,
  ExaminationStageReadService,
  examinationEventPolicy,
  type ExaminationEventCode,
  type ExaminationLifecycleReader
} from '../src/examination-stage-read.js';
import type { FormalMatterRepository } from '../src/formal-matter.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const formalMatterId = 'formal-matter_examination' as FormalMatterId;
const sha = (character: string) => character.repeat(64);

function formalMatters(version = 1, found = true): FormalMatterRepository {
  return {
    findById: (requestedWorkspace: string, id: string) =>
      Promise.resolve(
        found && requestedWorkspace === workspaceId && id === formalMatterId
          ? ({ formalMatterId, workspaceId, version } as FormalMatter)
          : null
      )
  } as unknown as FormalMatterRepository;
}

function event(
  suffix: string,
  eventCode: string,
  state: LifecycleProjectionState,
  input: { version?: number; formalMatterVersion?: number; occurredAt?: string } = {}
): LifecycleEventProjection {
  const version = input.version ?? 1;
  const formalMatterVersion = input.formalMatterVersion ?? 1;
  return {
    schemaVersion: 1,
    lifecycleEventId: `lifecycle-event_${suffix}`,
    workspaceId,
    formalMatter: { id: formalMatterId, version: formalMatterVersion },
    version,
    source: {
      reviewedSourceAdmission: {
        id: `reviewed-source-admission_${suffix}`,
        version: 1
      },
      admissionFingerprintSha256: sha('a'),
      evidenceReviewDecision: {
        id: `evidence-review-decision_${suffix}`,
        version: 1
      },
      evidenceReceipt: { id: `evidence-receipt_${suffix}`, version: 1 },
      providerReturn: { id: `provider-return_${suffix}`, version: 1 },
      formalMatter: { id: formalMatterId, version: formalMatterVersion }
    },
    state,
    eventCode,
    customerSafeLabel: `Label ${suffix}`,
    customerSafeSummary: `Summary ${suffix}`,
    occurredAt: input.occurredAt ?? `2026-08-10T00:${String(version).padStart(2, '0')}:00.000Z`,
    projectedAt: '2026-08-10T01:00:00.000Z',
    lifecycleEventFingerprintSha256: sha(String((version % 9) + 1)),
    officialStatusVerified: false,
    correlationId: `correlation_${suffix}` as never
  };
}

function viewFor(current: LifecycleEventProjection, input: { formalMatterVersion?: number } = {}) {
  return {
    schemaVersion: 1,
    lifecycleViewId: 'lifecycle-view_examination',
    workspaceId,
    formalMatter: { id: formalMatterId, version: input.formalMatterVersion ?? 1 },
    version: 4,
    currentEvent: { id: current.lifecycleEventId, version: current.version },
    currentEventFingerprintSha256: current.lifecycleEventFingerprintSha256,
    state: current.state,
    customerSafeLabel: current.customerSafeLabel,
    customerSafeSummary: current.customerSafeSummary,
    lifecycleViewFingerprintSha256: sha('f'),
    officialStatusVerified: false,
    updatedAt: '2026-08-10T01:00:00.000Z'
  } satisfies CurrentLifecycleView;
}

function lifecycle(
  currentView: CurrentLifecycleView | undefined,
  events: readonly LifecycleEventProjection[]
): ExaminationLifecycleReader {
  return {
    getCurrentView: () => Promise.resolve(currentView ? structuredClone(currentView) : undefined),
    listEvents: () => Promise.resolve(structuredClone(events))
  };
}

function service(
  currentView: CurrentLifecycleView | undefined,
  events: readonly LifecycleEventProjection[]
) {
  return new ExaminationStageReadService(formalMatters(), lifecycle(currentView, events));
}

describe('Examination Stage V1 owner read', () => {
  it('establishes each admitted Examination event-code/state pair without Official Truth or deadline', async () => {
    for (const [eventCode, state] of Object.entries(examinationEventPolicy) as [
      ExaminationEventCode,
      LifecycleProjectionState
    ][]) {
      const current = event(eventCode.toLowerCase(), eventCode, state);
      const result = await service(viewFor(current), [current]).get(workspaceId, formalMatterId);

      expect(result).toMatchObject({
        schemaVersion: 1,
        workspaceId,
        formalMatter: { id: formalMatterId, version: 1 },
        status: 'ESTABLISHED',
        current: {
          lifecycleEvent: {
            id: current.lifecycleEventId,
            version: current.version,
            fingerprintSha256: current.lifecycleEventFingerprintSha256
          },
          lifecycleView: {
            id: 'lifecycle-view_examination',
            version: 4,
            fingerprintSha256: sha('f')
          },
          workflowState: state,
          eventCode,
          sourceClass: 'REVIEWED_EXTERNAL_EVIDENCE',
          projectionClass: 'INTERNAL_PRODUCT_PROJECTION',
          sourceCurrentness: 'CURRENT',
          officialStatusVerified: false
        },
        history: [],
        deadline: null,
        deadlineStatus: 'UNAVAILABLE',
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
      expect(result.current?.source.reviewedSourceAdmission).toEqual({
        id: current.source.reviewedSourceAdmission.id,
        version: 1,
        fingerprintSha256: sha('a')
      });
    }
  });

  it('fails closed when an Examination event code is paired with the wrong lifecycle state', async () => {
    const invalid = event(
      'invalid-policy',
      'EXAMINATION_CUSTOMER_ACTION_NEEDED',
      'WAITING_NO_ACTION'
    );
    await expect(
      service(viewFor(invalid), [invalid]).get(workspaceId, formalMatterId)
    ).rejects.toMatchObject({
      code: 'EXAMINATION_POLICY_DENIED',
      status: 409
    } satisfies Partial<ExaminationStageReadError>);
  });

  it('keeps qualifying history historical when the exact current event is unrelated', async () => {
    const historical = event(
      'historical',
      'EXAMINATION_REVIEWED_EVIDENCE',
      'REVIEWED_PROVIDER_EVIDENCE',
      { version: 1 }
    );
    const unrelated = event(
      'unrelated-current',
      'PROVIDER_EVIDENCE_REVIEWED',
      'WAITING_NO_ACTION',
      { version: 2 }
    );
    const result = await service(viewFor(unrelated), [historical, unrelated]).get(
      workspaceId,
      formalMatterId
    );

    expect(result.status).toBe('NOT_ESTABLISHED');
    expect(result.current).toBeNull();
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      lifecycleEvent: { id: historical.lifecycleEventId },
      sourceCurrentness: 'HISTORICAL',
      officialStatusVerified: false
    });
  });

  it('returns successful known absence only when lifecycle read succeeds with no lifecycle truth', async () => {
    const result = await service(undefined, []).get(workspaceId, formalMatterId);
    expect(result).toMatchObject({
      status: 'NOT_ESTABLISHED',
      current: null,
      history: [],
      deadline: null,
      officialStatusVerified: false
    });
  });

  it('bounds deterministic Examination history to the latest 50 qualifying entries', async () => {
    const history = Array.from({ length: EXAMINATION_HISTORY_LIMIT + 5 }, (_, index) =>
      event(`history-${index + 1}`, 'EXAMINATION_INTERNAL_PROCESSING', 'INTERNAL_PROCESSING', {
        version: index + 1,
        occurredAt: new Date(Date.UTC(2026, 7, 10, 0, index, 0)).toISOString()
      })
    );
    const unrelated = event('history-current', 'NON_EXAMINATION_CURRENT', 'WAITING_NO_ACTION', {
      version: 99,
      occurredAt: '2026-08-11T00:00:00.000Z'
    });
    const result = await service(viewFor(unrelated), [...history, unrelated]).get(
      workspaceId,
      formalMatterId
    );

    expect(result.status).toBe('NOT_ESTABLISHED');
    expect(result.history).toHaveLength(EXAMINATION_HISTORY_LIMIT);
    expect(result.history[0]?.lifecycleEvent.id).toBe(history[5]?.lifecycleEventId);
    expect(result.history.at(-1)?.lifecycleEvent.id).toBe(history.at(-1)?.lifecycleEventId);
    expect(result.history.every((item) => item.sourceCurrentness === 'HISTORICAL')).toBe(true);
  });

  it('treats missing or mismatched exact current-view event identity as unavailable, not absence', async () => {
    const current = event('corrupt', 'EXAMINATION_WAITING_NO_ACTION', 'WAITING_NO_ACTION');
    await expect(
      service(viewFor(current), []).get(workspaceId, formalMatterId)
    ).rejects.toMatchObject({
      code: 'EXAMINATION_TRUTH_UNAVAILABLE',
      status: 503,
      retryable: true
    });

    const corruptView = {
      ...viewFor(current),
      currentEventFingerprintSha256: sha('0')
    };
    await expect(
      service(corruptView, [current]).get(workspaceId, formalMatterId)
    ).rejects.toMatchObject({
      code: 'EXAMINATION_TRUTH_UNAVAILABLE',
      status: 503
    });
  });

  it('fails closed when the durable Formal Matter version has moved beyond lifecycle source truth', async () => {
    const current = event('stale-matter', 'EXAMINATION_INTERNAL_PROCESSING', 'INTERNAL_PROCESSING');
    const read = new ExaminationStageReadService(
      formalMatters(2),
      lifecycle(viewFor(current), [current])
    );
    await expect(read.get(workspaceId, formalMatterId)).rejects.toMatchObject({
      code: 'EXAMINATION_SOURCE_STALE',
      status: 409
    });
  });

  it('maps Formal Matter or lifecycle persistence failure to unavailable instead of NOT_ESTABLISHED', async () => {
    const failedMatter = {
      findById: () => Promise.reject(new Error('db offline'))
    } as unknown as FormalMatterRepository;
    await expect(
      new ExaminationStageReadService(failedMatter, lifecycle(undefined, [])).get(
        workspaceId,
        formalMatterId
      )
    ).rejects.toMatchObject({
      code: 'EXAMINATION_TRUTH_UNAVAILABLE',
      status: 503,
      retryable: true
    });

    const failedLifecycle: ExaminationLifecycleReader = {
      getCurrentView: () => Promise.reject(new Error('db offline')),
      listEvents: () => Promise.resolve([])
    };
    await expect(
      new ExaminationStageReadService(formalMatters(), failedLifecycle).get(
        workspaceId,
        formalMatterId
      )
    ).rejects.toMatchObject({
      code: 'EXAMINATION_TRUTH_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });

  it('keeps unknown and cross-Workspace Formal Matters privacy-safe', async () => {
    await expect(
      new ExaminationStageReadService(formalMatters(1, false), lifecycle(undefined, [])).get(
        workspaceId,
        formalMatterId
      )
    ).rejects.toMatchObject({ code: 'FORMAL_MATTER_NOT_FOUND', status: 404 });
  });
});
