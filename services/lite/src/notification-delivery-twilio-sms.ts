import { randomUUID } from 'node:crypto';
import {
  noChannelNotificationDeliveryAuthorityConsequencesV1,
  type ChannelNotificationDeliveryObservationV1,
  type SmsChannelNotificationDeliveryAttemptV1,
  type SmsChannelNotificationDeliveryObservationV1,
  type WorkspaceChannelIdentityBindingV1
} from '@markorbit/contracts';
import type { SmsNotificationChannelIdentityCurrentnessReaderV1 } from './notification-automation-rule-currentness.js';
import type { PostgresNotificationDeliveryStore } from './notification-delivery.js';
import type { PostgresWorkspaceChannelIdentityBindingStoreV1 } from './workspace-channel-identity-binding.js';
import {
  TWILIO_SMS_IMPLEMENTATION_PROFILE_ID,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION
} from './twilio-sms-identity-readers.js';

const MESSAGE_SID = /^SM[0-9a-fA-F]{32}$/u;
const ACCOUNT_SID = /^AC[0-9a-fA-F]{32}$/u;
const REASON = /^[A-Z][A-Z0-9_]{1,119}$/u;

export const TWILIO_SMS_STATUS_CALLBACK_PATH_V1 =
  '/webhooks/notification-automation/sms-workspace-notification/twilio';

export interface TwilioSmsStatusCallbackFormPairV1 {
  name: string;
  value: string;
}

export interface TwilioSmsStatusCallbackVerificationRequestV1 {
  workspaceId: string;
  identityBinding: Readonly<WorkspaceChannelIdentityBindingV1>;
  signature: string;
  formParams: readonly Readonly<TwilioSmsStatusCallbackFormPairV1>[];
}

export type TwilioSmsStatusCallbackVerificationResultV1 =
  | Readonly<{
      authenticated: true;
      externalAccountRef: string;
      providerMessageRef: string;
      messageStatus: string;
      providerErrorCode?: string;
    }>
  | Readonly<{ authenticated: false; reasonCode: string }>;

export interface TwilioSmsStatusCallbackVerifierV1 {
  verify(
    input: Readonly<TwilioSmsStatusCallbackVerificationRequestV1>
  ): Promise<TwilioSmsStatusCallbackVerificationResultV1>;
}

function exactObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export class HttpCapabilityTwilioSmsStatusCallbackVerifierV1 implements TwilioSmsStatusCallbackVerifierV1 {
  constructor(
    private readonly capabilityEngineUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 5_000
  ) {}

  async verify(
    input: Readonly<TwilioSmsStatusCallbackVerificationRequestV1>
  ): Promise<TwilioSmsStatusCallbackVerificationResultV1> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityEngineUrl.replace(/\/$/u, '')}/internal/v1/channel-sms/twilio/status-callback/verify`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return { authenticated: false, reasonCode: 'VERIFICATION_UNAVAILABLE' };
    }
    if (!response.ok) return { authenticated: false, reasonCode: 'VERIFICATION_UNAVAILABLE' };
    const body = exactObject(await response.json().catch(() => undefined));
    if (!body || typeof body.authenticated !== 'boolean')
      return { authenticated: false, reasonCode: 'VERIFICATION_UNAVAILABLE' };
    if (body.authenticated === false) {
      const reasonCode =
        typeof body.reasonCode === 'string' && REASON.test(body.reasonCode)
          ? body.reasonCode
          : 'VERIFICATION_REJECTED';
      return { authenticated: false, reasonCode };
    }
    if (
      typeof body.externalAccountRef !== 'string' ||
      !ACCOUNT_SID.test(body.externalAccountRef) ||
      typeof body.providerMessageRef !== 'string' ||
      !MESSAGE_SID.test(body.providerMessageRef) ||
      typeof body.messageStatus !== 'string' ||
      !body.messageStatus ||
      body.messageStatus.length > 80 ||
      (body.providerErrorCode !== undefined &&
        (typeof body.providerErrorCode !== 'string' ||
          !/^[0-9]{1,10}$/u.test(body.providerErrorCode)))
    )
      return { authenticated: false, reasonCode: 'VERIFICATION_REJECTED' };
    return {
      authenticated: true,
      externalAccountRef: body.externalAccountRef,
      providerMessageRef: body.providerMessageRef,
      messageStatus: body.messageStatus,
      ...(typeof body.providerErrorCode === 'string'
        ? { providerErrorCode: body.providerErrorCode }
        : {})
    };
  }
}

function one(
  pairs: readonly Readonly<TwilioSmsStatusCallbackFormPairV1>[],
  name: string
): string | undefined {
  const values = pairs.filter((pair) => pair.name === name).map((pair) => pair.value);
  return values.length === 1 ? values[0] : undefined;
}

function normalizedStatus(value: string): string {
  return value.trim().toLowerCase();
}

const recognizedStatuses = new Set([
  'accepted',
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'undelivered'
]);

function mappedEvent(status: string): SmsChannelNotificationDeliveryObservationV1['event'] {
  if (status === 'delivered') return 'DELIVERED';
  if (status === 'failed' || status === 'undelivered') return 'FAILED';
  if (status === 'accepted' || status === 'queued' || status === 'sending' || status === 'sent')
    return 'ACCEPTED';
  return 'UNKNOWN';
}

function reasonCode(status: string, event: SmsChannelNotificationDeliveryObservationV1['event']) {
  if (event === 'DELIVERED') return 'TWILIO_STATUS_DELIVERED';
  if (event === 'FAILED')
    return status === 'undelivered' ? 'TWILIO_STATUS_UNDELIVERED' : 'TWILIO_STATUS_FAILED';
  if (event === 'ACCEPTED') return `TWILIO_STATUS_${status.toUpperCase()}`;
  return 'TWILIO_STATUS_UNKNOWN';
}

function isSmsAttempt(attempt: unknown): attempt is SmsChannelNotificationDeliveryAttemptV1 {
  const item = exactObject(attempt);
  return Boolean(
    item &&
    exactObject(item.channelIdentityBinding) &&
    exactObject(item.implementationRef) &&
    exactObject(item.endpointRef)
  );
}

function hasTerminalProviderEvidence(
  observations: readonly Readonly<ChannelNotificationDeliveryObservationV1>[]
): boolean {
  return observations.some(
    (observation) =>
      observation.authenticatedEvidence === true &&
      (observation.event === 'DELIVERED' || observation.event === 'FAILED') &&
      observation.eventIdentity.startsWith('twilio-sms-status:')
  );
}

export class NotificationTwilioSmsAuthenticatedEventIngestionV1 {
  constructor(
    private readonly store: Pick<
      PostgresNotificationDeliveryStore,
      'findByProviderSubmissionRefGlobal' | 'recordObservation' | 'listObservationsForAttempt'
    >,
    private readonly bindings: Pick<
      PostgresWorkspaceChannelIdentityBindingStoreV1,
      'getExact' | 'getLatest'
    >,
    private readonly identityCurrentness: Pick<
      SmsNotificationChannelIdentityCurrentnessReaderV1,
      'resolve'
    >,
    private readonly verifier: TwilioSmsStatusCallbackVerifierV1,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async ingest(
    input: Readonly<{
      signature: string;
      formParams: readonly Readonly<TwilioSmsStatusCallbackFormPairV1>[];
    }>
  ): Promise<SmsChannelNotificationDeliveryObservationV1> {
    const rawFormParams: readonly unknown[] = input.formParams;
    if (
      !input.signature ||
      input.signature.length > 256 ||
      rawFormParams.length < 1 ||
      rawFormParams.length > 100
    )
      throw new Error('Twilio callback envelope is invalid.');
    let total = 0;
    const formParams = rawFormParams.map((entry) => {
      const pair = exactObject(entry);
      if (
        !pair ||
        typeof pair.name !== 'string' ||
        !pair.name ||
        pair.name.length > 160 ||
        typeof pair.value !== 'string' ||
        !pair.value ||
        pair.value.length > 8_000
      )
        throw new Error('Twilio callback form is invalid.');
      total += pair.name.length + pair.value.length;
      if (total > 32_768) throw new Error('Twilio callback form is too large.');
      return { name: pair.name, value: pair.value };
    });

    const messageSid = one(formParams, 'MessageSid');
    if (!messageSid || !MESSAGE_SID.test(messageSid))
      throw new Error('Twilio MessageSid correlation is unavailable.');

    const attempt = await this.store.findByProviderSubmissionRefGlobal(messageSid);
    if (
      !attempt ||
      !isSmsAttempt(attempt) ||
      attempt.providerSubmissionRef !== messageSid ||
      attempt.implementationRef.implementationProfileId !== TWILIO_SMS_IMPLEMENTATION_PROFILE_ID ||
      attempt.implementationRef.version !== TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION
    )
      throw new Error('Twilio MessageSid does not correlate to one SMS attempt.');

    const [binding, latest] = await Promise.all([
      this.bindings.getExact(
        attempt.workspaceId,
        attempt.channelIdentityBinding.id,
        attempt.channelIdentityBinding.version
      ),
      this.bindings.getLatest(attempt.workspaceId, attempt.channelIdentityBinding.id)
    ]);
    if (
      !binding ||
      !latest ||
      binding.workspaceId !== attempt.workspaceId ||
      binding.featureKey !== 'SMS_WORKSPACE_NOTIFICATION' ||
      binding.status !== 'ACTIVE' ||
      binding.workspaceChannelIdentityBindingId !== attempt.channelIdentityBinding.id ||
      binding.version !== attempt.channelIdentityBinding.version ||
      binding.bindingFingerprintSha256 !== attempt.channelIdentityBinding.fingerprintSha256 ||
      binding.connection.implementationRef.implementationProfileId !==
        attempt.implementationRef.implementationProfileId ||
      binding.connection.implementationRef.version !== attempt.implementationRef.version ||
      latest.version !== binding.version ||
      latest.bindingFingerprintSha256 !== binding.bindingFingerprintSha256 ||
      latest.status !== 'ACTIVE'
    )
      throw new Error('Twilio SMS identity binding is not the exact current head.');

    const verified = await this.verifier.verify({
      workspaceId: attempt.workspaceId,
      identityBinding: binding,
      signature: input.signature,
      formParams
    });
    if (
      !verified.authenticated ||
      verified.providerMessageRef !== messageSid ||
      verified.externalAccountRef !== binding.identity.externalAccountRef
    )
      throw new Error('Twilio callback authentication/correlation failed.');

    const currentness = await this.identityCurrentness.resolve({
      workspaceId: attempt.workspaceId,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION',
      binding: attempt.channelIdentityBinding
    });
    if (
      currentness.state !== 'CURRENT' ||
      currentness.workspaceId !== attempt.workspaceId ||
      currentness.binding.id !== attempt.channelIdentityBinding.id ||
      currentness.binding.version !== attempt.channelIdentityBinding.version ||
      currentness.binding.fingerprintSha256 !== attempt.channelIdentityBinding.fingerprintSha256
    )
      throw new Error('Twilio SMS identity is not current.');

    const status = normalizedStatus(verified.messageStatus);
    const durableStatus = recognizedStatuses.has(status) ? status : 'unknown';
    let event = mappedEvent(status);
    let reason = reasonCode(status, event);
    const prior = await this.store.listObservationsForAttempt(
      attempt.workspaceId,
      attempt.notificationDeliveryAttemptId
    );
    if (event === 'ACCEPTED' && hasTerminalProviderEvidence(prior)) {
      event = 'UNKNOWN';
      reason = 'TWILIO_STATUS_CONTRADICTS_TERMINAL_EVIDENCE';
    } else if (
      (event === 'DELIVERED' &&
        prior.some(
          (observation) =>
            observation.event === 'FAILED' &&
            observation.eventIdentity.startsWith('twilio-sms-status:')
        )) ||
      (event === 'FAILED' &&
        prior.some(
          (observation) =>
            observation.event === 'DELIVERED' &&
            observation.eventIdentity.startsWith('twilio-sms-status:')
        ))
    ) {
      event = 'UNKNOWN';
      reason = 'TWILIO_STATUS_CONTRADICTS_TERMINAL_EVIDENCE';
    }

    const observedAt = new Date(this.now()).toISOString();
    const observation: SmsChannelNotificationDeliveryObservationV1 = {
      schemaVersion: 1,
      notificationDeliveryObservationId: `notification-delivery-observation_${randomUUID()}`,
      workspaceId: attempt.workspaceId,
      version: 1,
      attempt: { id: attempt.notificationDeliveryAttemptId, version: 1 },
      eventIdentity: `twilio-sms-status:${messageSid}:${durableStatus}`,
      event,
      providerMessageRef: messageSid,
      endpointFingerprintSha256: attempt.endpointFingerprintSha256,
      authenticatedEvidence: true,
      reasonCode: reason,
      evidenceRefs: [`provider-message:${messageSid}`, `twilio-message-status:${durableStatus}`],
      eventAt: observedAt,
      observedAt,
      authority: noChannelNotificationDeliveryAuthorityConsequencesV1
    };
    return (await this.store.recordObservation(
      observation
    )) as SmsChannelNotificationDeliveryObservationV1;
  }
}
