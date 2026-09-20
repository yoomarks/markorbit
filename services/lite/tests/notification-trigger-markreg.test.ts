import { describe, expect, it, vi } from 'vitest';
import type { LifecycleEventProjection } from '@markorbit/contracts/evidence-lifecycle';
import { MarkRegLifecycleNotificationTriggerCurrentnessReaderV1 } from '../src/notification-trigger-markreg.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const event: LifecycleEventProjection = {
  schemaVersion: 1,
  lifecycleEventId: 'lifecycle-event_notification-v1',
  workspaceId,
  formalMatter: { id: 'formal-matter_notification-v1', version: 1 },
  version: 1,
  source: {
    reviewedSourceAdmission: { id: 'reviewed-source-admission_notification-v1', version: 1 },
    admissionFingerprintSha256: '1'.repeat(64),
    evidenceReviewDecision: { id: 'evidence-review-decision_notification-v1', version: 1 },
    evidenceReceipt: { id: 'evidence-receipt_notification-v1', version: 1 },
    providerReturn: { id: 'provider-return_notification-v1', version: 1 },
    formalMatter: { id: 'formal-matter_notification-v1', version: 1 }
  },
  state: 'CUSTOMER_ACTION_NEEDED',
  eventCode: 'CUSTOMER_INPUT_REQUIRED',
  customerSafeLabel: 'Action required',
  customerSafeSummary: 'Review is required.',
  occurredAt: '2026-09-20T01:00:00.000Z',
  projectedAt: '2026-09-20T01:01:00.000Z',
  lifecycleEventFingerprintSha256: '2'.repeat(64),
  officialStatusVerified: false,
  correlationId: 'correlation_notification-v1'
};

function reader(response: Response | Error) {
  const fetchImpl = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  );
  return {
    value: new MarkRegLifecycleNotificationTriggerCurrentnessReaderV1(
      'http://markreg',
      'internal-secret',
      fetchImpl
    ),
    fetchImpl
  };
}

describe('MarkReg lifecycle Notification trigger currentness', () => {
  it('validates the exact immutable owner event without consulting the latest lifecycle view', async () => {
    const { value, fetchImpl } = reader(Response.json({ event }));
    const evidence = value.materialize(event);
    await expect(value.validateCurrent(evidence)).resolves.toEqual({ state: 'CURRENT' });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(event.lifecycleEventId)),
      expect.any(Object)
    );
  });

  it.each([
    ['eventCode', { eventType: 'DIFFERENT' }],
    [
      'subject',
      {
        subject: { id: 'formal-matter_other', version: 1, owner: 'MARKREG', kind: 'FORMAL_MATTER' }
      }
    ],
    ['fingerprint', { triggerFingerprintSha256: 'f'.repeat(64) }]
  ])('returns STALE for mismatched %s evidence', async (_label, patch) => {
    const { value } = reader(Response.json({ event }));
    const evidence = { ...value.materialize(event), ...patch } as never;
    await expect(value.validateCurrent(evidence)).resolves.toEqual({ state: 'STALE' });
  });

  it('maps owner absence to UNKNOWN and owner outage to UNAVAILABLE', async () => {
    const missing = reader(new Response('{}', { status: 404 })).value;
    await expect(missing.validateCurrent(missing.materialize(event))).resolves.toEqual({
      state: 'UNKNOWN'
    });
    const unavailable = reader(new Error('offline')).value;
    await expect(unavailable.validateCurrent(unavailable.materialize(event))).resolves.toEqual({
      state: 'UNAVAILABLE'
    });
  });

  it('fails closed for unsupported owners and wrong Workspace identity', async () => {
    const { value } = reader(Response.json({ event }));
    const evidence = value.materialize(event);
    await expect(value.validateCurrent({ ...evidence, owner: 'OTHER' })).resolves.toEqual({
      state: 'UNAVAILABLE'
    });
    await expect(
      value.validateCurrent({ ...evidence, workspaceId: '24242424-2424-4424-8424-242424242424' })
    ).resolves.toEqual({ state: 'STALE' });
  });
});
