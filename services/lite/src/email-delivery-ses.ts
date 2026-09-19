import { createHash, randomUUID } from 'node:crypto';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  parseEmailDeliveryAttemptV1,
  type EmailDeliveryAttemptV1,
  type EmailDeliveryObservationV1
} from '@markorbit/contracts/email-delivery';
import type {
  EmailDeliverySubmissionResult,
  MaterializedEmailDelivery
} from './email-delivery-runtime.js';

export interface AmazonSesTenantRouting {
  workspaceId: string;
  tenantName: string;
  configurationSetName: string;
  region: string;
  senderIdentity: string;
  routingPartitionRef: string;
}

export interface AmazonSesV2SendEmailInput {
  FromEmailAddress: string;
  Destination: Readonly<{ ToAddresses: readonly string[] }>;
  ReplyToAddresses?: readonly string[];
  Content: Readonly<{
    Simple: Readonly<{
      Subject: Readonly<{ Data: string; Charset: 'UTF-8' }>;
      Body: Readonly<{
        Text?: Readonly<{ Data: string; Charset: 'UTF-8' }>;
        Html?: Readonly<{ Data: string; Charset: 'UTF-8' }>;
      }>;
    }>;
  }>;
  ConfigurationSetName: string;
  EmailTags: readonly Readonly<{ Name: string; Value: string }>[];
  TenantName: string;
}

export interface AmazonSesV2Client {
  sendEmail(input: Readonly<AmazonSesV2SendEmailInput>): Promise<Readonly<{ MessageId?: string }>>;
}

export interface AmazonSesRoutingResolver {
  resolve(
    workspaceId: string,
    routingPartitionRef: string
  ): Promise<Readonly<AmazonSesTenantRouting> | null>;
}

export type AmazonSesMaterializedEmail = MaterializedEmailDelivery;
export type AmazonSesSubmissionResult = EmailDeliverySubmissionResult;

export class AmazonSesDeliveryAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmazonSesDeliveryAdapterError';
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const tagSafe = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 32);

function email(value: string, field: string): string {
  const result = value.trim().toLowerCase();
  if (!EMAIL.test(result)) throw new AmazonSesDeliveryAdapterError(`${field} is invalid.`);
  return result;
}

function bounded(value: string, field: string, max: number): string {
  const result = value.trim();
  if (!result || result.length > max)
    throw new AmazonSesDeliveryAdapterError(`${field} is invalid.`);
  return result;
}

export class AmazonSesV2DeliveryAdapter {
  constructor(
    private readonly client: AmazonSesV2Client,
    private readonly routing: AmazonSesRoutingResolver
  ) {}

  async submit(
    materialized: Readonly<AmazonSesMaterializedEmail>
  ): Promise<AmazonSesSubmissionResult> {
    const attempt = parseEmailDeliveryAttemptV1(materialized.attempt);
    if (attempt.workspaceId !== materialized.workspaceId)
      throw new AmazonSesDeliveryAdapterError(
        'Attempt Workspace does not match materialized email.'
      );
    if (attempt.status !== 'SUBMITTING')
      throw new AmazonSesDeliveryAdapterError('SES submission requires SUBMITTING attempt state.');
    if (
      materialized.recipients.length !== 1 ||
      materialized.recipients.length !== attempt.recipientCount
    )
      throw new AmazonSesDeliveryAdapterError(
        'SES V1 submission requires exactly one recipient per attempt.'
      );
    if (!materialized.textContent && !materialized.htmlContent)
      throw new AmazonSesDeliveryAdapterError('Email body materialization is required.');

    const routing = await this.routing.resolve(
      materialized.workspaceId,
      materialized.routingPartitionRef
    );
    if (!routing) return { status: 'FAILED', reasonCode: 'SES_ROUTING_NOT_FOUND' };
    if (
      routing.workspaceId !== materialized.workspaceId ||
      routing.routingPartitionRef !== materialized.routingPartitionRef
    )
      return { status: 'FAILED', reasonCode: 'SES_ROUTING_WORKSPACE_MISMATCH' };

    const fromAddress = email(materialized.fromAddress, 'fromAddress');
    if (fromAddress !== email(routing.senderIdentity, 'routing.senderIdentity'))
      return { status: 'FAILED', reasonCode: 'SES_SENDER_IDENTITY_MISMATCH' };

    const recipients = materialized.recipients.map((value, index) =>
      email(value, `recipients[${index}]`)
    );
    if (new Set(recipients).size !== recipients.length)
      throw new AmazonSesDeliveryAdapterError('Recipient shard cannot contain duplicates.');

    const body: AmazonSesV2SendEmailInput['Content']['Simple']['Body'] = {
      ...(materialized.textContent
        ? {
            Text: {
              Data: bounded(materialized.textContent, 'textContent', 500_000),
              Charset: 'UTF-8' as const
            }
          }
        : {}),
      ...(materialized.htmlContent
        ? {
            Html: {
              Data: bounded(materialized.htmlContent, 'htmlContent', 1_000_000),
              Charset: 'UTF-8' as const
            }
          }
        : {})
    };

    try {
      const response = await this.client.sendEmail({
        FromEmailAddress: fromAddress,
        Destination: { ToAddresses: recipients },
        ...(materialized.replyToAddress
          ? { ReplyToAddresses: [email(materialized.replyToAddress, 'replyToAddress')] }
          : {}),
        Content: {
          Simple: {
            Subject: {
              Data: bounded(materialized.subject, 'subject', 998),
              Charset: 'UTF-8'
            },
            Body: body
          }
        },
        ConfigurationSetName: bounded(routing.configurationSetName, 'configurationSetName', 64),
        TenantName: bounded(routing.tenantName, 'tenantName', 128),
        EmailTags: [
          { Name: 'mo_attempt', Value: tagSafe(attempt.deliveryAttemptId) },
          { Name: 'mo_workspace', Value: tagSafe(materialized.workspaceId) },
          { Name: 'mo_campaign', Value: tagSafe(attempt.campaign.campaignId) }
        ]
      });
      const messageId = response.MessageId?.trim();
      if (!messageId) return { status: 'UNKNOWN', reasonCode: 'SES_ACCEPTED_WITHOUT_MESSAGE_ID' };
      return { status: 'ACCEPTED', providerSubmissionRef: messageId };
    } catch (error) {
      const retryable =
        typeof error === 'object' &&
        error !== null &&
        'retryable' in error &&
        (error as { retryable?: unknown }).retryable === true;
      if (retryable) return { status: 'UNKNOWN', reasonCode: 'SES_TRANSPORT_AMBIGUOUS' };
      return { status: 'FAILED', reasonCode: 'SES_PROVIDER_REJECTED' };
    }
  }
}

export interface AmazonSesEventContext {
  authenticated: boolean;
  workspaceId: string;
  deliveryAttemptId: EmailDeliveryAttemptV1['deliveryAttemptId'];
  observedAt: string;
}

type SesEventRecord = Record<string, unknown>;

function object(value: unknown): SesEventRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AmazonSesDeliveryAdapterError('SES event must be an object.');
  return value as SesEventRecord;
}

function providerEventKind(event: Readonly<SesEventRecord>): EmailDeliveryObservationV1['event'] {
  const normalized = String(event.eventType ?? event.event_type ?? event.type ?? '').toUpperCase();
  if (normalized === 'BOUNCE') {
    const bounce =
      event.bounce && typeof event.bounce === 'object' && !Array.isArray(event.bounce)
        ? (event.bounce as SesEventRecord)
        : {};
    const bounceType = String(bounce.bounceType ?? bounce.bounce_type ?? '').toUpperCase();
    if (bounceType === 'PERMANENT') return 'HARD_BOUNCED';
    if (bounceType === 'TRANSIENT') return 'SOFT_BOUNCED';
    return 'UNKNOWN';
  }
  if (normalized === 'SUBSCRIPTION') {
    const subscription =
      event.subscription &&
      typeof event.subscription === 'object' &&
      !Array.isArray(event.subscription)
        ? (event.subscription as SesEventRecord)
        : {};
    const preferences =
      subscription.newTopicPreferences &&
      typeof subscription.newTopicPreferences === 'object' &&
      !Array.isArray(subscription.newTopicPreferences)
        ? (subscription.newTopicPreferences as SesEventRecord)
        : {};
    if (preferences.unsubscribeAll === true) return 'UNSUBSCRIBED';
    const statuses = Array.isArray(preferences.topicSubscriptionStatus)
      ? preferences.topicSubscriptionStatus
      : [];
    if (
      statuses.some((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        const status = String(
          (entry as SesEventRecord).subscriptionStatus ??
            (entry as SesEventRecord).subscription_status ??
            ''
        ).toUpperCase();
        return status === 'OPTOUT' || status === 'OPT_OUT';
      })
    )
      return 'UNSUBSCRIBED';
    return 'UNKNOWN';
  }
  const map: Record<string, EmailDeliveryObservationV1['event']> = {
    SEND: 'SUBMITTED',
    ACCEPT: 'ACCEPTED',
    DELIVERY: 'DELIVERED',
    DELIVERYDELAY: 'DEFERRED',
    COMPLAINT: 'COMPLAINED',
    REJECT: 'FAILED',
    RENDERINGFAILURE: 'FAILED'
  };
  return map[normalized] ?? 'UNKNOWN';
}

export function normalizeAmazonSesEvent(
  raw: unknown,
  context: Readonly<AmazonSesEventContext>
): EmailDeliveryObservationV1 {
  if (!context.authenticated)
    throw new AmazonSesDeliveryAdapterError('Unauthenticated SES event is rejected.');
  const event = object(raw);
  const mail = object(event.mail);
  const eventType = event.eventType ?? event.event_type ?? event.type;
  const messageId = String(mail.messageId ?? mail.message_id ?? '').trim();
  if (!messageId) throw new AmazonSesDeliveryAdapterError('SES event messageId is required.');
  const timestamp = String(mail.timestamp ?? event.timestamp ?? '').trim();
  const eventAt = new Date(timestamp);
  if (Number.isNaN(eventAt.getTime()))
    throw new AmazonSesDeliveryAdapterError('SES event timestamp is invalid.');

  const destination = Array.isArray(mail.destination)
    ? mail.destination.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : [];
  const endpointFingerprintSha256 =
    destination.length === 1
      ? createHash('sha256').update(destination[0]!, 'utf8').digest('hex')
      : undefined;
  const normalizedEvent = providerEventKind(event);
  const identity = `${messageId}:${String(eventType ?? 'unknown')}:${eventAt.toISOString()}`;

  return {
    schemaVersion: 1,
    observationId: `email-delivery-observation_${randomUUID()}`,
    version: 1,
    workspaceId: context.workspaceId,
    deliveryAttempt: {
      deliveryAttemptId: context.deliveryAttemptId,
      version: 1
    },
    eventIdentity: identity,
    event: normalizedEvent,
    evidenceKind: 'PROVIDER_EVENT',
    providerMessageRef: messageId,
    ...(endpointFingerprintSha256 ? { endpointFingerprintSha256 } : {}),
    authenticatedEvidence: true,
    reasonCode: `SES_${normalizedEvent}`,
    evidenceRefs: [`ses-message:${messageId}`],
    eventAt: eventAt.toISOString(),
    observedAt: new Date(context.observedAt).toISOString(),
    authority: noEmailDeliveryAuthorityConsequencesV1
  };
}
