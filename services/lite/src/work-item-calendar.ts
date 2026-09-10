import type { LiteWorkItemV1 } from '@markorbit/contracts/lite-work-item';

export type LiteWorkItemCalendarEntryKind = 'INTERNAL_DUE' | 'REMINDER' | 'FOLLOW_UP';

export interface LiteWorkItemCalendarEntryV1 {
  workspaceId: string;
  liteWorkItemId: LiteWorkItemV1['liteWorkItemId'];
  workItemVersion: number;
  kind: LiteWorkItemCalendarEntryKind;
  sourceField: 'internalDueAt' | 'remindAt' | 'followUpAt';
  timestamp: string;
  timeClass: 'LITE_INTERNAL_OPERATIONAL';
  certifiedLegalDeadline: false;
}

const ENTRY_ORDER: Readonly<Record<LiteWorkItemCalendarEntryKind, number>> = Object.freeze({
  INTERNAL_DUE: 0,
  REMINDER: 1,
  FOLLOW_UP: 2
});

function entry(
  item: Readonly<LiteWorkItemV1>,
  kind: LiteWorkItemCalendarEntryKind,
  sourceField: LiteWorkItemCalendarEntryV1['sourceField'],
  timestamp: string
): LiteWorkItemCalendarEntryV1 {
  return {
    workspaceId: item.workspaceId,
    liteWorkItemId: item.liteWorkItemId,
    workItemVersion: item.version,
    kind,
    sourceField,
    timestamp,
    timeClass: 'LITE_INTERNAL_OPERATIONAL',
    certifiedLegalDeadline: false
  };
}

export function projectLiteWorkItemsToCalendarV1(
  items: readonly Readonly<LiteWorkItemV1>[]
): readonly Readonly<LiteWorkItemCalendarEntryV1>[] {
  const entries: LiteWorkItemCalendarEntryV1[] = [];
  for (const item of items) {
    const { internalDueAt, remindAt, followUpAt } = item.internalTiming;
    if (internalDueAt) entries.push(entry(item, 'INTERNAL_DUE', 'internalDueAt', internalDueAt));
    if (remindAt) entries.push(entry(item, 'REMINDER', 'remindAt', remindAt));
    if (followUpAt) entries.push(entry(item, 'FOLLOW_UP', 'followUpAt', followUpAt));
  }
  return entries.sort(
    (left, right) =>
      left.timestamp.localeCompare(right.timestamp) ||
      left.liteWorkItemId.localeCompare(right.liteWorkItemId) ||
      left.workItemVersion - right.workItemVersion ||
      ENTRY_ORDER[left.kind] - ENTRY_ORDER[right.kind]
  );
}
