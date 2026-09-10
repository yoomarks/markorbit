import { describe, expect, it } from 'vitest';
import {
  noLiteWorkItemAuthorityConsequencesV1,
  type LiteWorkItemV1
} from '@markorbit/contracts/lite-work-item';
import { projectLiteWorkItemsToCalendarV1 } from '../src/work-item-calendar.js';

const workspaceId = '81818181-8181-4818-8818-818181818181';
const generatedAt = '2026-09-10T00:00:00.000Z';

function workItem(id: string, overrides: Partial<LiteWorkItemV1> = {}): LiteWorkItemV1 {
  return {
    schemaVersion: 1,
    liteWorkItemId: `lite-work-item_${id}`,
    workspaceId,
    version: 1,
    taskType: 'GENERAL_FOLLOW_UP',
    title: `Work ${id}`,
    priority: 'NOTICE',
    status: 'OPEN',
    source: {
      sourceClass: 'MANUAL',
      recordedByPrincipalId: 'user_calendar',
      recordedAt: generatedAt
    },
    relatedReferences: [],
    certifiedDeadlineReferences: [],
    observedDateCandidates: [],
    internalTiming: {
      timeClass: 'LITE_INTERNAL_OPERATIONAL',
      certifiedLegalDeadline: false
    },
    waitingSinceAt: null,
    completedAt: null,
    cancelledAt: null,
    archivedAt: null,
    archivedFrom: null,
    authorityConsequences: noLiteWorkItemAuthorityConsequencesV1,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    ...overrides
  };
}

describe('Lite Work Item Calendar projection', () => {
  it('maps every populated internal timing to a separate non-certified entry', () => {
    const item = workItem('multi', {
      version: 4,
      internalTiming: {
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        internalDueAt: '2026-09-13T09:00:00.000Z',
        remindAt: '2026-09-12T08:00:00.000Z',
        followUpAt: '2026-09-14T10:00:00.000Z',
        certifiedLegalDeadline: false
      }
    });

    expect(projectLiteWorkItemsToCalendarV1([item])).toEqual([
      {
        workspaceId,
        liteWorkItemId: item.liteWorkItemId,
        workItemVersion: 4,
        kind: 'REMINDER',
        sourceField: 'remindAt',
        timestamp: '2026-09-12T08:00:00.000Z',
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        certifiedLegalDeadline: false
      },
      {
        workspaceId,
        liteWorkItemId: item.liteWorkItemId,
        workItemVersion: 4,
        kind: 'INTERNAL_DUE',
        sourceField: 'internalDueAt',
        timestamp: '2026-09-13T09:00:00.000Z',
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        certifiedLegalDeadline: false
      },
      {
        workspaceId,
        liteWorkItemId: item.liteWorkItemId,
        workItemVersion: 4,
        kind: 'FOLLOW_UP',
        sourceField: 'followUpAt',
        timestamp: '2026-09-14T10:00:00.000Z',
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        certifiedLegalDeadline: false
      }
    ]);
  });

  it('sorts deterministically by timestamp, Work id, version and entry kind', () => {
    const laterId = workItem('zeta', {
      version: 3,
      internalTiming: {
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        internalDueAt: '2026-09-12T08:00:00.000Z',
        remindAt: '2026-09-12T08:00:00.000Z',
        certifiedLegalDeadline: false
      }
    });
    const earlierId = workItem('alpha', {
      version: 2,
      internalTiming: {
        timeClass: 'LITE_INTERNAL_OPERATIONAL',
        followUpAt: '2026-09-12T08:00:00.000Z',
        certifiedLegalDeadline: false
      }
    });

    expect(projectLiteWorkItemsToCalendarV1([laterId, earlierId])).toMatchObject([
      { liteWorkItemId: earlierId.liteWorkItemId, workItemVersion: 2, kind: 'FOLLOW_UP' },
      { liteWorkItemId: laterId.liteWorkItemId, workItemVersion: 3, kind: 'INTERNAL_DUE' },
      { liteWorkItemId: laterId.liteWorkItemId, workItemVersion: 3, kind: 'REMINDER' }
    ]);
  });

  it('does not turn certified owner refs or observed date candidates into Calendar dates', () => {
    const item = workItem('references-only', {
      certifiedDeadlineReferences: [
        {
          owner: 'MARKREG',
          kind: 'MARKREG_LIFECYCLE_PROJECTION',
          referenceId: 'projection_123',
          referenceVersion: 2,
          deadlineField: 'responseDueAt',
          certificationReference: 'certification_123',
          checkedAt: '2026-09-10T01:00:00.000Z',
          legalDeadlineCertifiedByLite: false
        }
      ],
      observedDateCandidates: [
        {
          label: 'email mentioned date',
          candidateAt: '2026-09-20T00:00:00.000Z',
          source: {
            owner: 'DATA_ENGINE',
            kind: 'DATA_ENGINE_OBSERVATION',
            sourceId: 'observation_123',
            sourceVersion: 1,
            sourceFingerprintSha256: 'a'.repeat(64),
            observedAt: '2026-09-10T01:30:00.000Z'
          },
          observedAt: '2026-09-10T01:30:00.000Z',
          legalDeadlineCertified: false,
          officialTruthVerified: false
        }
      ]
    });

    expect(projectLiteWorkItemsToCalendarV1([item])).toEqual([]);
  });

  it('returns healthy empty projection for Work Items without internal timing fields', () => {
    expect(projectLiteWorkItemsToCalendarV1([workItem('untimed')])).toEqual([]);
  });
});
