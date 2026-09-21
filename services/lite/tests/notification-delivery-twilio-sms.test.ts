/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/require-await */
import { describe, expect, it, vi } from 'vitest';
import {
  noChannelNotificationDeliveryAuthorityConsequencesV1,
  noWorkspaceChannelIdentityAuthorityConsequencesV1
} from '@markorbit/contracts';
import {
  NotificationTwilioSmsAuthenticatedEventIngestionV1,
  TWILIO_SMS_STATUS_CALLBACK_PATH_V1
} from '../src/notification-delivery-twilio-sms.js';
import {
  TWILIO_SMS_CAPABILITY_ID,
  TWILIO_SMS_CAPABILITY_VERSION,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_ID,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION
} from '../src/twilio-sms-identity-readers.js';

const workspaceId = '14131413-1413-4413-8413-141314131413';
const accountSid = `AC${'1'.repeat(32)}`;
const phoneNumberSid = `PN${'2'.repeat(32)}`;
const messageSid = `SM${'3'.repeat(32)}`;
const endpointFingerprint = '4'.repeat(64);
const callbackPath = TWILIO_SMS_STATUS_CALLBACK_PATH_V1;

const binding = {
  schemaVersion: 1 as const,
  workspaceChannelIdentityBindingId: 'workspace-channel-identity-binding_twilio-c7d3' as const,
  version: 4,
  workspaceId,
  featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
  identity: {
    externalAccountRef: accountSid,
    externalChannelRef: phoneNumberSid,
    displayLabel: 'Workspace SMS sender'
  },
  status: 'ACTIVE' as const,
  connection: {
    sourceKind: 'PROVIDER_API' as const,
    capabilityRef: {
      capabilityId: TWILIO_SMS_CAPABILITY_ID,
      capabilityVersion: TWILIO_SMS_CAPABILITY_VERSION
    },
    implementationRef: {
      implementationProfileId: TWILIO_SMS_IMPLEMENTATION_PROFILE_ID,
      version: TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION
    },
    externalCredentialRef: {
      owner: 'CORE_IDENTITY' as const,
      credentialBindingId: 'external-credential-binding_twilio-c7d3' as const,
      version: 2
    },
    evidenceRefs: ['twilio-account:opaque']
  },
  bindingFingerprintSha256: '5'.repeat(64),
  boundAt: '2026-09-21T08:00:00.000Z',
  lastVerifiedAt: '2026-09-21T08:10:00.000Z',
  updatedAt: '2026-09-21T08:10:00.000Z',
  authority: noWorkspaceChannelIdentityAuthorityConsequencesV1
};

const attempt = {
  schemaVersion: 1 as const,
  notificationDeliveryAttemptId: 'notification-delivery-attempt_twilio-c7d3' as const,
  workspaceId,
  version: 1 as const,
  executionRelease: { id: 'protected-action-release_twilio-c7d3' as const, version: 1 as const },
  sendIntent: { id: 'channel-notification-send-intent_twilio-c7d3' as const, version: 1 as const },
  effectFingerprintSha256: '6'.repeat(64),
  rule: {
    id: 'channel-notification-rule_twilio-c7d3' as const,
    version: 1,
    fingerprintSha256: '7'.repeat(64)
  },
  trigger: {
    id: 'channel-notification-trigger_twilio-c7d3' as const,
    version: 1 as const,
    fingerprintSha256: '8'.repeat(64)
  },
  endpointFingerprintSha256: endpointFingerprint,
  endpointRef: {
    owner: 'LITE',
    kind: 'WORKSPACE_DIRECTORY_ENTRY',
    id: 'workspace-directory-entry_twilio-c7d3',
    version: 2
  },
  content: {
    id: 'publish-package_twilio-c7d3' as const,
    version: 1,
    fingerprintSha256: '9'.repeat(64)
  },
  channelIdentityBinding: {
    id: binding.workspaceChannelIdentityBindingId,
    version: binding.version,
    fingerprintSha256: binding.bindingFingerprintSha256
  },
  implementationRef: binding.connection.implementationRef,
  deliveryPlanFingerprintSha256: 'a'.repeat(64),
  status: 'ACCEPTED' as const,
  providerSubmissionRef: messageSid,
  reconciliationIdentity: 'notification-effect:twilio-c7d3',
  createdAt: '2026-09-21T08:20:00.000Z',
  updatedAt: '2026-09-21T08:20:00.000Z',
  authority: noChannelNotificationDeliveryAuthorityConsequencesV1
};

function form(status: string, sid = messageSid) {
  return [
    { name: 'AccountSid', value: accountSid },
    { name: 'MessageSid', value: sid },
    { name: 'MessageStatus', value: status },
    { name: 'From', value: '+14155550123' },
    { name: 'To', value: '+14155550999' },
    { name: 'Body', value: 'must-never-be-durable' },
    { name: 'FutureTwilioField', value: 'future-private-ish-value' }
  ];
}

function harness(
  options: {
    currentnessState?: 'CURRENT' | 'STALE' | 'REAUTH_REQUIRED' | 'UNKNOWN' | 'UNAVAILABLE';
    wrongProfile?: boolean;
    wrongAccount?: boolean;
    authenticated?: boolean;
  } = {},
  persistence: { observations: unknown[] } = { observations: [] }
) {
  const verifier = {
    verify: vi.fn(
      async (input: Readonly<{ formParams: readonly { name: string; value: string }[] }>) => {
        const one = (name: string) => input.formParams.find((pair) => pair.name === name)?.value;
        if (options.authenticated === false)
          return { authenticated: false as const, reasonCode: 'SIGNATURE_INVALID' };
        return {
          authenticated: true as const,
          externalAccountRef: options.wrongAccount ? `AC${'f'.repeat(32)}` : accountSid,
          providerMessageRef: one('MessageSid')!,
          messageStatus: one('MessageStatus')!
        };
      }
    )
  };
  const exactBinding = options.wrongProfile
    ? {
        ...binding,
        connection: {
          ...binding.connection,
          implementationRef: {
            implementationProfileId: 'implementation-profile_other' as const,
            version: 1
          }
        }
      }
    : binding;
  const store = {
    findByProviderSubmissionRefGlobal: vi.fn(async (ref: string) =>
      ref === messageSid ? structuredClone(attempt) : undefined
    ),
    listObservationsForAttempt: vi.fn(async () => structuredClone(persistence.observations)),
    recordObservation: vi.fn(async (value: unknown) => {
      const item = value as { eventIdentity: string };
      const prior = persistence.observations.find(
        (entry) => (entry as { eventIdentity: string }).eventIdentity === item.eventIdentity
      );
      if (prior) return structuredClone(prior);
      persistence.observations.push(structuredClone(value));
      return structuredClone(value);
    })
  };
  const currentness = {
    resolve: vi.fn(async () => {
      const state = options.currentnessState ?? 'CURRENT';
      return {
        schemaVersion: 1 as const,
        workspaceId,
        featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
        binding: attempt.channelIdentityBinding,
        state,
        reason:
          state === 'CURRENT'
            ? ('EXACT_BINDING_CURRENT' as const)
            : ('OWNER_DATA_UNKNOWN' as const),
        assessedAt: '2026-09-21T08:30:00.000Z',
        createsExecutionAuthority: false as const
      };
    })
  };
  const bindings = {
    getExact: vi.fn(async () => exactBinding),
    getLatest: vi.fn(async () => exactBinding)
  };
  const ingestion = new NotificationTwilioSmsAuthenticatedEventIngestionV1(
    store as never,
    bindings as never,
    currentness as never,
    verifier as never,
    () => '2026-09-21T08:31:00.000Z'
  );
  return { ingestion, store, verifier, currentness, bindings, persistence };
}

describe('authenticated Twilio SMS delivery evidence', () => {
  it.each([
    ['queued', 'ACCEPTED'],
    ['sending', 'ACCEPTED'],
    ['sent', 'ACCEPTED'],
    ['delivered', 'DELIVERED'],
    ['failed', 'FAILED'],
    ['undelivered', 'FAILED'],
    ['future-status', 'UNKNOWN']
  ] as const)('maps %s to provider-neutral %s', async (status, expected) => {
    const { ingestion } = harness();
    await expect(
      ingestion.ingest({ signature: 'valid-signature', formParams: form(status) })
    ).resolves.toMatchObject({
      event: expected,
      providerMessageRef: messageSid,
      endpointFingerprintSha256: endpointFingerprint,
      authenticatedEvidence: true
    });
  });

  it('never promotes queued/sent evidence to delivered', async () => {
    for (const status of ['queued', 'sent']) {
      const { ingestion } = harness();
      const observation = await ingestion.ingest({
        signature: 'valid-signature',
        formParams: form(status)
      });
      expect(observation.event).toBe('ACCEPTED');
      expect(observation.event).not.toBe('DELIVERED');
    }
  });

  it('rejects unauthenticated, wrong-account, unknown-MessageSid, wrong-profile, and stale-profile callbacks', async () => {
    const unauthenticated = harness({ authenticated: false });
    await expect(
      unauthenticated.ingestion.ingest({
        signature: 'bad-signature',
        formParams: form('delivered')
      })
    ).rejects.toThrow();

    const wrongAccount = harness({ wrongAccount: true });
    await expect(
      wrongAccount.ingestion.ingest({
        signature: 'valid-signature',
        formParams: form('delivered')
      })
    ).rejects.toThrow();

    const unknown = harness();
    await expect(
      unknown.ingestion.ingest({
        signature: 'valid-signature',
        formParams: form('delivered', `SM${'f'.repeat(32)}`)
      })
    ).rejects.toThrow();
    expect(unknown.verifier.verify).not.toHaveBeenCalled();

    const wrongProfile = harness({ wrongProfile: true });
    await expect(
      wrongProfile.ingestion.ingest({
        signature: 'valid-signature',
        formParams: form('delivered')
      })
    ).rejects.toThrow();
    expect(wrongProfile.verifier.verify).not.toHaveBeenCalled();

    const stale = harness({ currentnessState: 'STALE' });
    await expect(
      stale.ingestion.ingest({
        signature: 'valid-signature',
        formParams: form('delivered')
      })
    ).rejects.toThrow();
    expect(stale.verifier.verify).toHaveBeenCalledTimes(1);
  });

  it('passes every form field to authentication but persists only safe provider-neutral evidence', async () => {
    const { ingestion, verifier, persistence } = harness();
    const pairs = form('delivered');
    const observation = await ingestion.ingest({ signature: 'valid-signature', formParams: pairs });
    expect(verifier.verify.mock.calls[0]![0].formParams).toEqual(pairs);
    const durable = JSON.stringify({ observation, persistence });
    expect(durable).not.toContain('+14155550123');
    expect(durable).not.toContain('+14155550999');
    expect(durable).not.toContain('must-never-be-durable');
    expect(durable).not.toContain('future-private-ish-value');
    expect(durable).not.toContain('valid-signature');
  });

  it('is idempotent across process restart for a duplicate authenticated callback', async () => {
    const persistence = { observations: [] as unknown[] };
    const first = harness({}, persistence);
    const recorded = await first.ingestion.ingest({
      signature: 'valid-signature',
      formParams: form('delivered')
    });

    const restarted = harness({}, persistence);
    const replay = await restarted.ingestion.ingest({
      signature: 'valid-signature',
      formParams: form('delivered')
    });
    expect(replay).toEqual(recorded);
    expect(persistence.observations).toHaveLength(1);
  });

  it('fails closed to UNKNOWN when late evidence contradicts terminal provider evidence', async () => {
    const persistence = { observations: [] as unknown[] };
    const first = harness({}, persistence);
    await first.ingestion.ingest({ signature: 'valid-signature', formParams: form('delivered') });

    const restarted = harness({}, persistence);
    await expect(
      restarted.ingestion.ingest({ signature: 'valid-signature', formParams: form('sent') })
    ).resolves.toMatchObject({
      event: 'UNKNOWN',
      reasonCode: 'TWILIO_STATUS_CONTRADICTS_TERMINAL_EVIDENCE'
    });
  });

  it('uses the production callback path contract', () => {
    expect(callbackPath).toBe(
      '/webhooks/notification-automation/sms-workspace-notification/twilio'
    );
  });
});
