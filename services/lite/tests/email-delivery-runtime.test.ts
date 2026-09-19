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
import type { SetOutboundContactSuppressionCommand } from '../src/outbound-contact-policy.js';
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
  return {
    store: {
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
    },
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
    const adapter: EmailDeliveryProviderAdapter = {
      submit: vi.fn(async () => {
        expect(memory.current()?.status).toBe('SUBMITTING');
        return { status: 'ACCEPTED' as const, providerSubmissionRef: 'ses-message-1' };
      })
    };
    const service = new EmailDeliveryRuntimeService(
      memory.store as Pick<
        PostgresEmailDeliveryStore,
        'createAttempt' | 'getAttempt' | 'updateAttempt' | 'recordObservation'
      >,
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
    const adapter: EmailDeliveryProviderAdapter = {
      submit: vi.fn(() =>
        Promise.resolve({ status: 'UNKNOWN' as const, reasonCode: 'SES_TRANSPORT_AMBIGUOUS' })
      )
    };
    const service = new EmailDeliveryRuntimeService(
      memory.store as Pick<
        PostgresEmailDeliveryStore,
        'createAttempt' | 'getAttempt' | 'updateAttempt' | 'recordObservation'
      >,
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
    expect(adapter.submit).toHaveBeenCalledTimes(1);
  });

  it('fails before transport when JIT currentness fails', async () => {
    const memory = memoryStore();
    const adapter: EmailDeliveryProviderAdapter = {
      submit: vi.fn(() =>
        Promise.resolve({ status: 'FAILED' as const, reasonCode: 'UNEXPECTED_CALL' })
      )
    };
    const service = new EmailDeliveryRuntimeService(
      memory.store as Pick<
        PostgresEmailDeliveryStore,
        'createAttempt' | 'getAttempt' | 'updateAttempt' | 'recordObservation'
      >,
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
    expect(adapter.submit).not.toHaveBeenCalled();
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
    const suppression: EmailDeliverySuppressionOwner = {
      setSuppression: vi.fn((_command: Readonly<SetOutboundContactSuppressionCommand>) =>
        Promise.resolve({})
      )
    };
    const service = new EmailDeliveryProviderEventService(
      { recordObservation } as Pick<PostgresEmailDeliveryStore, 'recordObservation'>,
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
    expect(suppression.setSuppression).toHaveBeenCalledWith(
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
    const suppression: EmailDeliverySuppressionOwner = {
      setSuppression: vi.fn((_command: Readonly<SetOutboundContactSuppressionCommand>) =>
        Promise.resolve({})
      )
    };
    const service = new EmailDeliveryProviderEventService(
      {
        recordObservation: vi.fn(({ value }: Readonly<RecordEmailDeliveryObservationCommand>) =>
          Promise.resolve(value)
        )
      } as Pick<PostgresEmailDeliveryStore, 'recordObservation'>,
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
    expect(suppression.setSuppression).not.toHaveBeenCalled();
  });
});
