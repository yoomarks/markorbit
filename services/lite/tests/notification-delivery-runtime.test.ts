/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, expect, it, vi } from 'vitest';
import { noChannelNotificationAuthorityConsequencesV1 } from '@markorbit/contracts/channel-notification';
import type { ChannelNotificationAutomationRuleV1 } from '@markorbit/contracts/channel-notification-automation';
import type { LifecycleEventProjection } from '@markorbit/contracts/evidence-lifecycle';
import {
  EmailNotificationDeliveryRuntimeV1,
  NotificationDeliveryRuntimeError
} from '../src/notification-delivery-runtime.js';
import { MarkRegLifecycleNotificationTriggerCurrentnessReaderV1 } from '../src/notification-trigger-markreg.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const ruleId = 'channel-notification-rule_delivery-v1' as const;
const event: LifecycleEventProjection = {
  schemaVersion: 1,
  lifecycleEventId: 'lifecycle-event_delivery-v1',
  workspaceId,
  formalMatter: { id: 'formal-matter_delivery-v1', version: 1 },
  version: 1,
  source: {
    reviewedSourceAdmission: { id: 'reviewed-source-admission_delivery-v1', version: 1 },
    admissionFingerprintSha256: '1'.repeat(64),
    evidenceReviewDecision: { id: 'evidence-review-decision_delivery-v1', version: 1 },
    evidenceReceipt: { id: 'evidence-receipt_delivery-v1', version: 1 },
    providerReturn: { id: 'provider-return_delivery-v1', version: 1 },
    formalMatter: { id: 'formal-matter_delivery-v1', version: 1 }
  },
  state: 'CUSTOMER_ACTION_NEEDED',
  eventCode: 'CUSTOMER_INPUT_REQUIRED',
  customerSafeLabel: 'Action required',
  customerSafeSummary: 'Review is required.',
  occurredAt: '2026-09-20T01:00:00.000Z',
  projectedAt: '2026-09-20T01:01:00.000Z',
  lifecycleEventFingerprintSha256: '2'.repeat(64),
  officialStatusVerified: false,
  correlationId: 'correlation_delivery-v1'
};
const activation = {
  owner: 'CORE' as const,
  kind: 'GOVERNED_HUMAN_ACTION_RECEIPT' as const,
  action: 'ACTIVATE' as const,
  workspaceId,
  notificationRuleId: ruleId,
  authorizedRuleVersion: 1,
  authorizedRuleFingerprintSha256: '3'.repeat(64),
  evidenceRef: 'core-receipt:delivery-v1',
  evidenceFingerprintSha256: '4'.repeat(64),
  verifiedAt: '2026-09-20T00:00:00.000Z'
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
    featureKey: 'EMAIL_NOTIFICATION',
    triggerSelector: { owner: 'MARKREG', eventType: event.eventCode, subjectKind: 'FORMAL_MATTER' },
    destinationResolver: { kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_EMAIL' },
    content: {
      publishPackageId: 'publish-package_delivery-v1',
      version: 1,
      fingerprintSha256: '5'.repeat(64)
    },
    senderProfile: {
      senderProfileId: 'email-sender-profile_delivery-v1',
      version: 1,
      fingerprintSha256: '6'.repeat(64)
    },
    ratePolicyRef: 'rate-policy:default',
    dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' },
    ruleFingerprintSha256: '3'.repeat(64),
    authority: noChannelNotificationAuthorityConsequencesV1
  },
  ruleIntentFingerprintSha256: '7'.repeat(64),
  activationEvidence: activation,
  revocationEvidence: null,
  createdByPrincipalId: 'principal_owner',
  updatedByPrincipalId: 'principal_owner',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  suspendedAt: null,
  revokedAt: null,
  authority: noChannelNotificationAuthorityConsequencesV1
};

function harness(
  options: { releaseRejects?: boolean; transportStatus?: 'ACCEPTED' | 'UNKNOWN' } = {}
) {
  const sequence: string[] = [];
  let stored: any;
  const trigger = new MarkRegLifecycleNotificationTriggerCurrentnessReaderV1(
    'http://markreg',
    'secret'
  );
  vi.spyOn(trigger, 'getExact').mockResolvedValue(event);
  const execution = {
    authorize: vi.fn(async ({ intent }: any) => {
      sequence.push('authorize');
      return { authorizationId: 'protected-action-authorization_delivery-v1', version: 1, intent };
    }),
    release: vi.fn(async ({ authorizationId }: any) => {
      sequence.push('release');
      if (options.releaseRejects)
        throw new NotificationDeliveryRuntimeError('EXECUTION_REJECTED', 'stale');
      return {
        schemaVersion: 1,
        releaseId: 'protected-action-release_delivery-v1',
        version: 1,
        workspaceId,
        authorization: { id: authorizationId, version: 1 },
        actionKind: 'NOTIFICATION_SEND',
        effectFingerprintSha256:
          execution.authorize.mock.calls[0]![0].intent.effectFingerprintSha256,
        status: 'RELEASED_FOR_EXECUTION',
        releasedBy: 'EXECUTION_AUTOMATION',
        releasedAt: '2026-09-20T01:02:00.000Z',
        idempotencyKey: 'release'
      };
    })
  };
  const store = {
    createAttempt: vi.fn(async (value: any) => {
      sequence.push('planned');
      stored ??= structuredClone(value);
      return structuredClone(stored);
    }),
    getAttempt: vi.fn(async () => structuredClone(stored)),
    transitionAttempt: vi.fn(async (value: any) => {
      sequence.push(value.status.toLowerCase());
      stored = structuredClone(value);
      return value;
    }),
    recordObservation: vi.fn(async (value: any) => value)
  };
  const transport = {
    submit: vi.fn(async (materialized: any) => {
      sequence.push('transport');
      expect(materialized.subject).toBe('Exact title');
      expect(materialized.textContent).toBe('Exact body');
      if (options.transportStatus === 'UNKNOWN')
        return { status: 'UNKNOWN' as const, reasonCode: 'AMBIGUOUS' };
      return { status: 'ACCEPTED' as const, providerSubmissionRef: 'ses-message-1' };
    })
  };
  const runtime = new EmailNotificationDeliveryRuntimeV1(
    { getLatest: vi.fn(async () => rule), getExact: vi.fn(async () => rule) } as never,
    trigger,
    {
      resolve: vi.fn(async () => ({
        entry: { workspaceDirectoryEntryId: 'workspace-directory-entry_delivery-v1', version: 2 },
        endpoint: 'private@example.com',
        endpointFingerprintSha256: '8'.repeat(64)
      }))
    } as never,
    {
      findPublishPackage: vi.fn(async () => ({
        publishPackageId: rule.spec.content.publishPackageId,
        version: 1,
        publishPackageFingerprintSha256: rule.spec.content.fingerprintSha256,
        title: 'Exact title',
        body: 'Exact body'
      }))
    } as never,
    {
      getExactSenderProfile: vi.fn(async () => ({
        senderProfileId: rule.spec.senderProfile.senderProfileId,
        version: 1,
        status: 'ACTIVE',
        fromAddress: 'notice@example.com',
        providerRoutingPartitionRef: 'route:one',
        replyTo: { mode: 'SAME_AS_FROM' }
      }))
    } as never,
    execution as never,
    store as never,
    transport,
    () => '2026-09-20T01:03:00.000Z'
  );
  return { runtime, sequence, transport, store };
}

const command = {
  workspaceId,
  notificationRuleId: ruleId,
  lifecycleEventId: event.lifecycleEventId,
  idempotencyKey: 'delivery-v1'
};

describe('EMAIL_NOTIFICATION delivery runtime', () => {
  it('gets Execution release, persists SUBMITTING, then calls the shared transport', async () => {
    const { runtime, sequence, transport, store } = harness();
    await expect(runtime.deliver(command)).resolves.toMatchObject({
      status: 'ACCEPTED',
      providerSubmissionRef: 'ses-message-1'
    });
    expect(sequence).toEqual([
      'authorize',
      'release',
      'planned',
      'submitting',
      'transport',
      'accepted'
    ]);
    expect(transport.submit).toHaveBeenCalledTimes(1);
    const durableAttempt = JSON.stringify(store.createAttempt.mock.calls[0]![0]);
    expect(durableAttempt).not.toContain('private@example.com');
    expect(durableAttempt).not.toContain('Exact title');
    expect(durableAttempt).not.toContain('Exact body');
    expect(durableAttempt).not.toContain('campaign');
    expect(durableAttempt).not.toContain('conversation');
  });

  it('never calls transport without an Execution release', async () => {
    const { runtime, transport } = harness({ releaseRejects: true });
    await expect(runtime.deliver(command)).rejects.toMatchObject({ code: 'EXECUTION_REJECTED' });
    expect(transport.submit).not.toHaveBeenCalled();
  });

  it('persists UNKNOWN and never blindly resubmits an ambiguous attempt', async () => {
    const { runtime, transport } = harness({ transportStatus: 'UNKNOWN' });
    await expect(runtime.deliver(command)).resolves.toMatchObject({ status: 'UNKNOWN' });
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
});
