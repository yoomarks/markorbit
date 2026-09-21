/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, expect, it, vi } from 'vitest';
import { noChannelNotificationAuthorityConsequencesV1 } from '@markorbit/contracts/channel-notification';
import { noWorkspaceChannelIdentityAuthorityConsequencesV1 } from '@markorbit/contracts/channel-identity-binding';
import type { ChannelNotificationAutomationRuleV1 } from '@markorbit/contracts/channel-notification-automation';
import type { LifecycleEventProjection } from '@markorbit/contracts/evidence-lifecycle';
import {
  NotificationDeliveryRuntimeError,
  SmsNotificationDeliveryRuntimeV1
} from '../src/notification-delivery-runtime.js';
import { MarkRegLifecycleNotificationTriggerCurrentnessReaderV1 } from '../src/notification-trigger-markreg.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const ruleId = 'channel-notification-rule_sms-delivery-v1' as const;
const endpointFingerprint = '8'.repeat(64);

const event: LifecycleEventProjection = {
  schemaVersion: 1,
  lifecycleEventId: 'lifecycle-event_sms-delivery-v1',
  workspaceId,
  formalMatter: { id: 'formal-matter_sms-delivery-v1', version: 1 },
  version: 1,
  source: {
    reviewedSourceAdmission: { id: 'reviewed-source-admission_sms-delivery-v1', version: 1 },
    admissionFingerprintSha256: '1'.repeat(64),
    evidenceReviewDecision: { id: 'evidence-review-decision_sms-delivery-v1', version: 1 },
    evidenceReceipt: { id: 'evidence-receipt_sms-delivery-v1', version: 1 },
    providerReturn: { id: 'provider-return_sms-delivery-v1', version: 1 },
    formalMatter: { id: 'formal-matter_sms-delivery-v1', version: 1 }
  },
  state: 'CUSTOMER_ACTION_NEEDED',
  eventCode: 'CUSTOMER_INPUT_REQUIRED',
  customerSafeLabel: 'Action required',
  customerSafeSummary: 'Review is required.',
  occurredAt: '2026-09-21T01:00:00.000Z',
  projectedAt: '2026-09-21T01:01:00.000Z',
  lifecycleEventFingerprintSha256: '2'.repeat(64),
  officialStatusVerified: false,
  correlationId: 'correlation_sms-delivery-v1'
};

const activation = {
  owner: 'CORE' as const,
  kind: 'GOVERNED_HUMAN_ACTION_RECEIPT' as const,
  action: 'ACTIVATE' as const,
  workspaceId,
  notificationRuleId: ruleId,
  authorizedRuleVersion: 1,
  authorizedRuleFingerprintSha256: '3'.repeat(64),
  evidenceRef: 'core-receipt:sms-delivery-v1',
  evidenceFingerprintSha256: '4'.repeat(64),
  verifiedAt: '2026-09-21T00:00:00.000Z'
};

const rule: ChannelNotificationAutomationRuleV1 = {
  schemaVersion: 1,
  workspaceId,
  notificationRuleId: ruleId,
  version: 1,
  status: 'ACTIVE',
  spec: {
    schemaVersion: 1,
    notificationRuleId: ruleId,
    workspaceId,
    version: 1,
    featureKey: 'SMS_WORKSPACE_NOTIFICATION',
    triggerSelector: { owner: 'MARKREG', eventType: event.eventCode, subjectKind: 'FORMAL_MATTER' },
    destinationResolver: { kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_PHONE' },
    content: {
      publishPackageId: 'publish-package_sms-delivery-v1',
      version: 1,
      fingerprintSha256: '5'.repeat(64)
    },
    channelIdentityBinding: {
      id: 'workspace-channel-identity-binding_sms-delivery-v1',
      version: 4,
      fingerprintSha256: '6'.repeat(64)
    },
    contactPolicyRef: {
      policyId: 'outbound-contact-policy_sms-delivery-v1',
      version: 2
    },
    ratePolicyRef: 'rate-policy:sms-default',
    dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' },
    ruleFingerprintSha256: '3'.repeat(64),
    authority: noChannelNotificationAuthorityConsequencesV1
  },
  ruleIntentFingerprintSha256: '7'.repeat(64),
  activationEvidence: activation,
  revocationEvidence: null,
  createdByPrincipalId: 'principal_owner',
  updatedByPrincipalId: 'principal_owner',
  createdAt: '2026-09-21T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
  suspendedAt: null,
  revokedAt: null,
  authority: noChannelNotificationAuthorityConsequencesV1
};

const smsSpec =
  rule.spec.featureKey === 'SMS_WORKSPACE_NOTIFICATION'
    ? rule.spec
    : (() => {
        throw new Error('Expected SMS fixture.');
      })();

const binding = {
  schemaVersion: 1 as const,
  workspaceChannelIdentityBindingId: smsSpec.channelIdentityBinding.id,
  version: smsSpec.channelIdentityBinding.version,
  workspaceId,
  featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
  identity: {
    externalAccountRef: 'sms-account:opaque',
    externalChannelRef: 'sms-sender:opaque',
    displayLabel: 'SMS sender'
  },
  status: 'ACTIVE' as const,
  connection: {
    sourceKind: 'PROVIDER_API' as const,
    capabilityRef: {
      capabilityId: 'channel.sms.notification',
      capabilityVersion: '1'
    },
    implementationRef: {
      implementationProfileId: 'implementation-profile_sms-delivery-v1' as const,
      version: 3
    },
    externalCredentialRef: {
      externalCredentialId: 'external-credential_sms-delivery-v1' as const,
      version: 2,
      credentialFingerprintSha256: '9'.repeat(64)
    },
    evidenceRefs: ['provider-account:opaque']
  },
  bindingFingerprintSha256: smsSpec.channelIdentityBinding.fingerprintSha256,
  boundAt: '2026-09-20T00:00:00.000Z',
  lastVerifiedAt: '2026-09-21T00:30:00.000Z',
  updatedAt: '2026-09-21T00:30:00.000Z',
  authority: noWorkspaceChannelIdentityAuthorityConsequencesV1
};

function harness(
  options: {
    releaseRejects?: boolean;
    identityState?: 'CURRENT' | 'STALE' | 'REAUTH_REQUIRED' | 'UNKNOWN' | 'UNAVAILABLE';
    headDrift?: boolean;
    transportStatus?: 'ACCEPTED' | 'FAILED' | 'UNKNOWN' | 'THROW';
  } = {},
  persistence: { stored?: any } = {}
) {
  const sequence: string[] = [];
  const trigger = new MarkRegLifecycleNotificationTriggerCurrentnessReaderV1(
    'http://markreg',
    'secret'
  );
  vi.spyOn(trigger, 'getExact').mockResolvedValue(event);

  const execution = {
    authorize: vi.fn(async ({ intent }: any) => {
      sequence.push('authorize');
      return {
        authorizationId: 'protected-action-authorization_sms-delivery-v1',
        version: 1,
        intent
      };
    }),
    release: vi.fn(async ({ authorizationId }: any) => {
      sequence.push('release');
      if (options.releaseRejects)
        throw new NotificationDeliveryRuntimeError('EXECUTION_REJECTED', 'stale');
      return {
        schemaVersion: 1,
        releaseId: 'protected-action-release_sms-delivery-v1',
        version: 1,
        workspaceId,
        authorization: { id: authorizationId, version: 1 },
        actionKind: 'NOTIFICATION_SEND',
        effectFingerprintSha256:
          execution.authorize.mock.calls[0]![0].intent.effectFingerprintSha256,
        status: 'RELEASED_FOR_EXECUTION',
        releasedBy: 'EXECUTION_AUTOMATION',
        releasedAt: '2026-09-21T01:02:00.000Z',
        idempotencyKey: 'release'
      };
    })
  };

  const identityCurrentness = {
    resolve: vi.fn(async () => {
      sequence.push('identity-currentness');
      const state = options.identityState ?? 'CURRENT';
      return {
        schemaVersion: 1 as const,
        workspaceId,
        featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
        binding: smsSpec.channelIdentityBinding,
        state,
        reason:
          state === 'CURRENT'
            ? ('EXACT_BINDING_CURRENT' as const)
            : ('OWNER_DATA_UNKNOWN' as const),
        assessedAt: '2026-09-21T01:02:01.000Z',
        createsExecutionAuthority: false as const
      };
    })
  };

  const bindings = {
    getExact: vi.fn(async () => {
      sequence.push('binding-exact');
      return binding;
    }),
    getLatest: vi.fn(async () => {
      sequence.push('binding-latest');
      return options.headDrift ? { ...binding, version: binding.version + 1 } : binding;
    })
  };

  const store = {
    createAttempt: vi.fn(async (value: any) => {
      sequence.push('planned');
      persistence.stored ??= structuredClone(value);
      return structuredClone(persistence.stored);
    }),
    getAttempt: vi.fn(async () => structuredClone(persistence.stored)),
    transitionAttempt: vi.fn(async (value: any) => {
      sequence.push(value.status.toLowerCase());
      persistence.stored = structuredClone(value);
      return value;
    }),
    recordObservation: vi.fn(async (value: any) => value)
  };

  const transport = {
    submit: vi.fn(async (materialized: any) => {
      sequence.push('transport');
      expect(materialized.identityBinding).toEqual(binding);
      expect(materialized.identityBinding.connection.implementationRef).toEqual(
        binding.connection.implementationRef
      );
      expect(materialized.recipient).toBe('+14155550123');
      expect(materialized.textContent).toBe('Exact SMS body');
      expect(materialized).not.toHaveProperty('provider');
      if (options.transportStatus === 'THROW') throw new Error('ambiguous network outcome');
      if (options.transportStatus === 'FAILED')
        return { status: 'FAILED' as const, reasonCode: 'PROVIDER_REJECTED' };
      if (options.transportStatus === 'UNKNOWN')
        return { status: 'UNKNOWN' as const, reasonCode: 'AMBIGUOUS' };
      return { status: 'ACCEPTED' as const, providerSubmissionRef: 'sms-submission-1' };
    })
  };

  const runtime = new SmsNotificationDeliveryRuntimeV1(
    { getLatest: vi.fn(async () => rule), getExact: vi.fn(async () => rule) } as never,
    trigger,
    {
      resolve: vi.fn(async () => ({
        entry: {
          workspaceDirectoryEntryId: 'workspace-directory-entry_sms-delivery-v1',
          version: 2
        },
        endpoint: '+14155550123',
        endpointFingerprintSha256: endpointFingerprint
      }))
    } as never,
    {
      findPublishPackage: vi.fn(async () => ({
        publishPackageId: smsSpec.content.publishPackageId,
        version: 1,
        publishPackageFingerprintSha256: smsSpec.content.fingerprintSha256,
        title: 'Exact SMS title',
        body: 'Exact SMS body'
      }))
    } as never,
    identityCurrentness as never,
    bindings as never,
    execution as never,
    store as never,
    transport,
    () => '2026-09-21T01:03:00.000Z'
  );

  return { runtime, sequence, transport, store, identityCurrentness, bindings };
}

const command = {
  workspaceId,
  notificationRuleId: ruleId,
  lifecycleEventId: event.lifecycleEventId,
  idempotencyKey: 'sms-delivery-v1'
};

describe('SMS_WORKSPACE_NOTIFICATION delivery runtime', () => {
  it('materializes raw SMS data only below exact Execution release and exact C6 binding currentness', async () => {
    const { runtime, sequence, transport, store } = harness();
    await expect(runtime.deliver(command)).resolves.toMatchObject({
      status: 'ACCEPTED',
      providerSubmissionRef: 'sms-submission-1',
      channelIdentityBinding: smsSpec.channelIdentityBinding,
      implementationRef: binding.connection.implementationRef
    });
    expect(sequence).toEqual([
      'authorize',
      'release',
      'identity-currentness',
      'binding-exact',
      'binding-latest',
      'planned',
      'submitting',
      'transport',
      'accepted'
    ]);
    expect(transport.submit).toHaveBeenCalledTimes(1);
    const durableAttempt = JSON.stringify(store.createAttempt.mock.calls[0]![0]);
    expect(durableAttempt).not.toContain('+14155550123');
    expect(durableAttempt).not.toContain('Exact SMS body');
    expect(durableAttempt).not.toContain('external-credential_sms-delivery-v1');
    expect(durableAttempt).not.toContain('credentialFingerprintSha256');
    expect(durableAttempt).toContain('implementation-profile_sms-delivery-v1');

    const observation = store.recordObservation.mock.calls[0]![0];
    expect(observation).toMatchObject({
      event: 'ACCEPTED',
      endpointFingerprintSha256: endpointFingerprint,
      authenticatedEvidence: true,
      evidenceRefs: ['provider-submission:sms-submission-1']
    });
    expect(JSON.stringify(observation)).not.toContain('+14155550123');
    expect(JSON.stringify(observation)).not.toContain('Exact SMS body');
  });

  it('never calls transport without an Execution release', async () => {
    const { runtime, transport, identityCurrentness } = harness({ releaseRejects: true });
    await expect(runtime.deliver(command)).rejects.toMatchObject({ code: 'EXECUTION_REJECTED' });
    expect(transport.submit).not.toHaveBeenCalled();
    expect(identityCurrentness.resolve).not.toHaveBeenCalled();
  });

  it.each(['STALE', 'REAUTH_REQUIRED', 'UNKNOWN', 'UNAVAILABLE'] as const)(
    'fails closed after release when C6 identity currentness is %s',
    async (identityState) => {
      const { runtime, transport, sequence } = harness({ identityState });
      await expect(runtime.deliver(command)).rejects.toMatchObject({
        code: 'IDENTITY_UNAVAILABLE'
      });
      expect(sequence.slice(0, 3)).toEqual(['authorize', 'release', 'identity-currentness']);
      expect(transport.submit).not.toHaveBeenCalled();
    }
  );

  it('fails closed on binding head drift after release', async () => {
    const { runtime, transport } = harness({ headDrift: true });
    await expect(runtime.deliver(command)).rejects.toMatchObject({ code: 'IDENTITY_UNAVAILABLE' });
    expect(transport.submit).not.toHaveBeenCalled();
  });

  it('persists UNKNOWN for ambiguous transport exception and never blindly retries', async () => {
    const { runtime, transport, store } = harness({ transportStatus: 'THROW' });
    await expect(runtime.deliver(command)).resolves.toMatchObject({ status: 'UNKNOWN' });
    expect(store.recordObservation.mock.calls[0]![0]).toMatchObject({
      event: 'UNKNOWN',
      reasonCode: 'TRANSPORT_EXCEPTION_AMBIGUOUS'
    });
    await expect(runtime.deliver(command)).rejects.toMatchObject({ code: 'ATTEMPT_AMBIGUOUS' });
    expect(transport.submit).toHaveBeenCalledTimes(1);
  });

  it('replays a terminal effect without another provider submission', async () => {
    const { runtime, transport } = harness();
    const first = await runtime.deliver(command);
    const replay = await runtime.deliver(command);
    expect(replay).toEqual(first);
    expect(transport.submit).toHaveBeenCalledTimes(1);
  });

  it('fails closed after restart when durable state was left UNKNOWN', async () => {
    const persistence: { stored?: any } = {};
    const first = harness({ transportStatus: 'THROW' }, persistence);
    await expect(first.runtime.deliver(command)).resolves.toMatchObject({ status: 'UNKNOWN' });

    const restarted = harness({}, persistence);
    await expect(restarted.runtime.deliver(command)).rejects.toMatchObject({
      code: 'ATTEMPT_AMBIGUOUS'
    });
    expect(restarted.transport.submit).not.toHaveBeenCalled();
  });

  it('uses provider-neutral FAILED rather than email bounce/complaint semantics', async () => {
    const { runtime, store } = harness({ transportStatus: 'FAILED' });
    await expect(runtime.deliver(command)).resolves.toMatchObject({ status: 'FAILED' });
    expect(store.recordObservation.mock.calls[0]![0]).toMatchObject({
      event: 'FAILED',
      reasonCode: 'PROVIDER_REJECTED'
    });
    expect(['HARD_BOUNCED', 'SOFT_BOUNCED', 'COMPLAINED']).not.toContain(
      store.recordObservation.mock.calls[0]![0].event
    );
  });
});
