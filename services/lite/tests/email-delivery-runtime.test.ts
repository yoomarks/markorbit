import { describe, expect, it, vi } from 'vitest';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  type EmailDeliveryAttemptV1,
  type EmailDeliveryObservationV1
} from '@markorbit/contracts/email-delivery';
import type {
  CreateEmailDeliveryAttemptCommand,
  RecordEmailDeliveryObservationCommand,
  UpdateEmailDeliveryAttemptCommand,
  PostgresEmailDeliveryStore
} from '../src/email-delivery.js';
import {
  EmailDeliveryProviderEventService,
  EmailDeliveryRuntimeService,
  type EmailDeliveryPreSubmitCurrentnessGate,
  type EmailDeliveryProviderAdapter,
  type EmailDeliverySuppressionOwner
} from '../src/email-delivery-runtime.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

const planned = (): EmailDeliveryAttemptV1 => ({
  schemaVersion: 1,
  deliveryAttemptId: 'email-delivery-attempt_runtime',
  version: 1,
  workspaceId,
  executionRelease: {
    releaseId: 'protected-action-release_runtime',
    version: 1,
    effectFingerprintSha256: '1'.repeat(64)
  },
  campaign: { campaignId: 'email-campaign_runtime', version: 1 },
  senderProfile: {
    senderProfileId: 'email-sender-profile_runtime',
    version: 1,
    fingerprintSha256: '2'.repeat(64)
  },
  implementation: {
    implementationProfileId: 'implementation-profile_amazon-ses-v2',
    version: 1
  },
  shardIndex: 0,
  recipientCount: 1,
  recipientManifestFingerprintSha256: '3'.repeat(64),
  deliveryPlanFingerprintSha256: '4'.repeat(64),
  correlationId: 'runtime:delivery:0',
  attemptNumber: 1,
  status: 'PLANNED',
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
  authority: noEmailDeliveryAuthorityConsequencesV1
});

function memoryStore() {
  let current: EmailDeliveryAttemptV1 | undefined;
  const observations: EmailDeliveryObservationV1[] = [];
  const store = {
      createAttempt: vi.fn(({ value }: Readonly<CreateEmailDeliveryAttemptCommand>) => {
        current ??= structuredClone(value);
        return Promise.resolve(structuredClone(current));
      }),
      getAttempt: vi.fn(() => {
        if (!current) throw new Error('missing');
        return Promise.resolve(structuredClone(current));
      }),
      updateAttempt: vi.fn(({ value }: Readonly<UpdateEmailDeliveryAttemptCommand>) => {
        current = structuredClone(value);
        return Promise.resolve(structuredClone(current));
      }),
      recordObservation: vi.fn(({ value }: Readonly<RecordEmailDeliveryObservationCommand>) => {
        observations.push(structuredClone(value));
        return Promise.resolve(structuredClone(value));
      })
  } satisfies Pick<
    PostgresEmailDeliveryStore,
    'createAttempt' | 'getAttempt' | 'updateAttempt' | 'recordObservation'
  >;
  return {
    store,
    current: () => current,
    observations
  };
}

describe('Email delivery runtime', () => {
  it('persists SUBMITTING before provider call and maps MessageId to ACCEPTED only', async () => {
    const memory = memoryStore();
    const currentness: EmailDeliveryPreSubmitCurrentnessGate = {
      assertCurrent: vi.fn(() => Promise.resolve())
    };
    const submit = vi.fn(() => {
      expect(memory.current()?.status).toBe('SUBMITTING');
      return Promise.resolve({
        status: 'ACCEPTED' as const,
        providerSubmissionRef: 'ses-message-1'
      });
    });
    const adapter: EmailDeliveryProviderAdapter = { submit };
    const service = new EmailDeliveryRuntimeService(
      memory.store,
      currentness,
      adapter,
      () => '2026-09-19T00:01:00.000Z'
    );
    const result = await service.submitShard({
      attempt: planned(),
      materialized: {
        workspaceId,
        routingPartitionRef: 'routing:workspace',
        fromAddress: 'hello@example.com',
        recipients: ['person@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      }
    });
    expect(result.status).toBe('ACCEPTED');
    expect(result.providerSubmissionRef).toBe('ses-message-1');
    expect(memory.observations).toHaveLength(1);
    expect(memory.observations[0]?.event).toBe('ACCEPTED');
    expect(JSON.stringify(memory.observations[0])).not.toContain('person@example.com');
  });

  it('refuses blind replay after an ambiguous provider outcome', async () => {
    const memory = memoryStore();
    const submit = vi.fn(() =>
      Promise.resolve({ status: 'UNKNOWN' as const, reasonCode: 'SES_TRANSPORT_AMBIGUOUS' })
    );
    const adapter: EmailDeliveryProviderAdapter = { submit };
    const service = new EmailDeliveryRuntimeService(
      memory.store,
      { assertCurrent: vi.fn(() => Promise.resolve()) },
      adapter,
      () => '2026-09-19T00:01:00.000Z'
    );
    await service.submitShard({
      attempt: planned(),
      materialized: {
        workspaceId,
        routingPartitionRef: 'routing:workspace',
        fromAddress: 'hello@example.com',
        recipients: ['person@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      }
    });
    await expect(
      service.submitShard({
        attempt: planned(),
        materialized: {
          workspaceId,
          routingPartitionRef: 'routing:workspace',
          fromAddress: 'hello@example.com',
          recipients: ['person@example.com'],
          subject: 'Reviewed subject',
          textContent: 'Reviewed body'
        }
      })
    ).rejects.toMatchObject({ code: 'ATTEMPT_ALREADY_AMBIGUOUS' });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('fails before currentness and transport when materialization drifts from durable attempt', async () => {
    const memory = memoryStore();
    const assertCurrent = vi.fn(() => Promise.resolve());
    const currentness: EmailDeliveryPreSubmitCurrentnessGate = { assertCurrent };
    const submit = vi.fn(() =>
      Promise.resolve({ status: 'FAILED' as const, reasonCode: 'UNEXPECTED_CALL' })
    );
    const adapter: EmailDeliveryProviderAdapter = { submit };
    const service = new EmailDeliveryRuntimeService(
      memory.store,
      currentness,
      adapter
    );
    await expect(
      service.submitShard({
        attempt: planned(),
        materialized: {
          workspaceId: '15151515-1515-4515-8515-151515151515',
          routingPartitionRef: 'routing:workspace',
          fromAddress: 'hello@example.com',
          recipients: ['person@example.com'],
          subject: 'Reviewed subject',
          textContent: 'Reviewed body'
        }
      })
    ).rejects.toMatchObject({ code: 'MATERIALIZED_ATTEMPT_MISMATCH' });
    expect(assertCurrent).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(memory.current()?.status).toBe('PLANNED');
  });

  it('fails before transport when JIT currentness fails', async () => {
    const memory = memoryStore();
    const submit = vi.fn(() =>
      Promise.resolve({ status: 'FAILED' as const, reasonCode: 'UNEXPECTED_CALL' })
    );
    const adapter: EmailDeliveryProviderAdapter = { submit };
    const service = new EmailDeliveryRuntimeService(
      memory.store,
      {
        assertCurrent: vi.fn(() => Promise.reject(new Error('stale')))
      },
      adapter
    );
    await expect(
      service.submitShard({
        attempt: planned(),
        materialized: {
          workspaceId,
          routingPartitionRef: 'routing:workspace',
          fromAddress: 'hello@example.com',
          recipients: ['person@example.com'],
          subject: 'Reviewed subject',
          textContent: 'Reviewed body'
        }
      })
    ).rejects.toThrow('stale');
    expect(submit).not.toHaveBeenCalled();
    expect(memory.current()?.status).toBe('PLANNED');
  });
});

describe('Email provider observation suppression handoff', () => {
  it.each([
    ['HARD_BOUNCED', 'HARD_BOUNCE'],
    ['COMPLAINED', 'COMPLAINT'],
    ['UNSUBSCRIBED', 'RECIPIENT_OPT_OUT']
  ] as const)('routes %s through Outbound Contact Policy owner', async (event, reasonCode) => {
    const recordObservation = vi.fn(({ value }: Readonly<RecordEmailDeliveryObservationCommand>) =>
      Promise.resolve(value)
    );
    const setSuppression = vi.fn(() => Promise.resolve({}));
    const suppression: EmailDeliverySuppressionOwner = { setSuppression };
    const service = new EmailDeliveryProviderEventService(
      { recordObservation },
      suppression
    );
    const observation: EmailDeliveryObservationV1 = {
      schemaVersion: 1,
      observationId: `email-delivery-observation_${event.toLowerCase()}`,
      version: 1,
      workspaceId,
      deliveryAttempt: {
        deliveryAttemptId: 'email-delivery-attempt_runtime',
        version: 1
      },
      eventIdentity: `ses:${event}:1`,
      event,
      evidenceKind: 'PROVIDER_EVENT',
      providerMessageRef: 'ses-message-1',
      endpointFingerprintSha256: '5'.repeat(64),
      authenticatedEvidence: true,
      reasonCode: `SES_${event}`,
      evidenceRefs: ['ses-message:ses-message-1'],
      eventAt: '2026-09-19T00:02:00.000Z',
      observedAt: '2026-09-19T00:02:01.000Z',
      authority: noEmailDeliveryAuthorityConsequencesV1
    };
    await service.admit(observation);
    expect(setSuppression).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        endpointFingerprintSha256: '5'.repeat(64),
        scope: 'ALL_OUTBOUND',
        reasonCode,
        sourceClass: 'PROVIDER_OBSERVATION'
      })
    );
  });

  it('does not create suppression from ordinary delivery evidence', async () => {
    const setSuppression = vi.fn(() => Promise.resolve({}));
    const suppression: EmailDeliverySuppressionOwner = { setSuppression };
    const service = new EmailDeliveryProviderEventService(
      {
        recordObservation: vi.fn(({ value }: Readonly<RecordEmailDeliveryObservationCommand>) =>
          Promise.resolve(value)
        )
      },
      suppression
    );
    await service.admit({
      schemaVersion: 1,
      observationId: 'email-delivery-observation_delivered',
      version: 1,
      workspaceId,
      deliveryAttempt: { deliveryAttemptId: 'email-delivery-attempt_runtime', version: 1 },
      eventIdentity: 'ses:delivery:1',
      event: 'DELIVERED',
      evidenceKind: 'PROVIDER_EVENT',
      providerMessageRef: 'ses-message-1',
      endpointFingerprintSha256: '5'.repeat(64),
      authenticatedEvidence: true,
      reasonCode: 'SES_DELIVERED',
      evidenceRefs: ['ses-message:ses-message-1'],
      eventAt: '2026-09-19T00:02:00.000Z',
      observedAt: '2026-09-19T00:02:01.000Z',
      authority: noEmailDeliveryAuthorityConsequencesV1
    });
    expect(setSuppression).not.toHaveBeenCalled();
  });
});
