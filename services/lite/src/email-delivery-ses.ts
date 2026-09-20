import { createHash, createHmac, createVerify, randomUUID } from 'node:crypto';
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
import type {
  EmailTransportProviderV1,
  EmailTransportSubmissionResultV1,
  MaterializedEmailTransportV1
} from './email-transport.js';

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
  sendEmail(
    region: string,
    input: Readonly<AmazonSesV2SendEmailInput>
  ): Promise<Readonly<{ MessageId?: string }>>;
}

export interface AmazonSesRoutingResolver {
  resolve(
    workspaceId: string,
    routingPartitionRef: string
  ): Promise<Readonly<AmazonSesTenantRouting> | null>;
}

export interface AmazonSesEnvironmentRouteV1 extends AmazonSesTenantRouting {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  snsTopicArn?: string;
}

/** Bounded production resolver; credentials remain process configuration, never delivery truth. */
export class EnvironmentAmazonSesRoutingResolverV1 implements AmazonSesRoutingResolver {
  private readonly routes: readonly Readonly<AmazonSesEnvironmentRouteV1>[];

  constructor(serialized: string) {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) throw new Error('MO_SES_ROUTES_JSON must be an array.');
    this.routes = parsed as readonly Readonly<AmazonSesEnvironmentRouteV1>[];
  }

  resolve(workspaceId: string, routingPartitionRef: string) {
    const route = this.routes.find(
      (candidate) =>
        candidate.workspaceId.toLowerCase() === workspaceId.toLowerCase() &&
        candidate.routingPartitionRef === routingPartitionRef
    );
    return Promise.resolve(route ?? null);
  }

  credentials(workspaceId: string, routingPartitionRef: string) {
    return this.routes.find(
      (candidate) =>
        candidate.workspaceId.toLowerCase() === workspaceId.toLowerCase() &&
        candidate.routingPartitionRef === routingPartitionRef
    );
  }

  credentialsForTenant(tenantName: string, configurationSetName: string) {
    return this.routes.find(
      (candidate) =>
        candidate.tenantName === tenantName &&
        candidate.configurationSetName === configurationSetName
    );
  }

  routeForTopic(topicArn: string) {
    return this.routes.find((candidate) => candidate.snsTopicArn === topicArn);
  }
}

const hmac = (key: string | Buffer, value: string) =>
  createHmac('sha256', key).update(value, 'utf8').digest();

/** Minimal SES V2 HTTPS client using AWS Signature V4 and process-owned credentials. */
export class AwsSignedAmazonSesV2ClientV1 implements AmazonSesV2Client {
  constructor(
    private readonly routing: EnvironmentAmazonSesRoutingResolverV1,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async sendEmail(region: string, input: Readonly<AmazonSesV2SendEmailInput>) {
    const route = this.routing.credentialsForTenant(input.TenantName, input.ConfigurationSetName);
    if (!route || route.region !== region) throw new Error('SES_CREDENTIAL_ROUTE_NOT_FOUND');
    const host = `email.${region}.amazonaws.com`;
    const path = '/v2/email/outbound-emails';
    const body = JSON.stringify(input);
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const now = this.clock();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/gu, '');
    const date = amzDate.slice(0, 8);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      host,
      'x-amz-date': amzDate,
      ...(route.sessionToken ? { 'x-amz-security-token': route.sessionToken } : {})
    };
    const signedNames = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${headers[name]!.trim()}\n`)
      .join('');
    const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedNames}\n${payloadHash}`;
    const scope = `${date}/${region}/ses/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;
    const dateKey = hmac(`AWS4${route.secretAccessKey}`, date);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, 'ses');
    const signingKey = hmac(serviceKey, 'aws4_request');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${route.accessKeyId}/${scope}, SignedHeaders=${signedNames}, Signature=${createHmac('sha256', signingKey).update(stringToSign).digest('hex')}`;
    const response = await this.fetchImpl(`https://${host}${path}`, {
      method: 'POST',
      headers,
      body
    });
    const payload = (await response.json().catch(() => ({}))) as { MessageId?: string };
    if (!response.ok)
      throw Object.assign(new Error('SES_PROVIDER_REJECTED'), {
        retryable: response.status >= 500
      });
    return payload;
  }
}

type SnsEnvelope = Record<string, unknown>;

export class AmazonSnsSesEventAuthenticatorV1 implements AmazonSesEventAuthenticator {
  private readonly certificates = new Map<string, string>();

  constructor(
    private readonly routing: EnvironmentAmazonSesRoutingResolverV1,
    private readonly attemptForProviderMessage: (
      workspaceId: string,
      providerMessageRef: string
    ) => Promise<string | undefined>,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async verifyAndExtract(raw: unknown): Promise<Readonly<AmazonSesVerifiedEventEnvelope>> {
    const envelope = object(raw);
    const type = scalar(envelope.Type);
    if (type !== 'Notification')
      throw new AmazonSesDeliveryAdapterError(
        'Only authenticated SNS Notification envelopes are accepted.'
      );
    const topicArn = scalar(envelope.TopicArn);
    const route = this.routing.routeForTopic(topicArn);
    if (!route)
      throw new AmazonSesDeliveryAdapterError('SNS topic is not bound to a Workspace SES route.');
    const certUrl = scalar(envelope.SigningCertURL ?? envelope.SigningCertUrl);
    const signature = scalar(envelope.Signature);
    const version = scalar(envelope.SignatureVersion);
    if (!signature || !this.validCertificateUrl(certUrl) || !['1', '2'].includes(version))
      throw new AmazonSesDeliveryAdapterError('SNS signature metadata is invalid.');
    const certificate = await this.certificate(certUrl);
    const verifier = createVerify(version === '1' ? 'RSA-SHA1' : 'RSA-SHA256');
    verifier.update(this.signingString(envelope), 'utf8');
    verifier.end();
    if (!verifier.verify(certificate, signature, 'base64'))
      throw new AmazonSesDeliveryAdapterError('SNS signature verification failed.');
    let event: unknown;
    try {
      event = JSON.parse(scalar(envelope.Message));
    } catch {
      throw new AmazonSesDeliveryAdapterError('SNS Message is not valid SES event JSON.');
    }
    const eventRecord = object(event);
    const mail = object(eventRecord.mail);
    const providerMessageRef = scalar(mail.messageId ?? mail.message_id);
    if (!providerMessageRef)
      throw new AmazonSesDeliveryAdapterError('SES event messageId is required.');
    const attemptId = await this.attemptForProviderMessage(route.workspaceId, providerMessageRef);
    if (!attemptId)
      throw new AmazonSesDeliveryAdapterError('Unknown SES provider message reference.');
    return {
      event,
      workspaceId: route.workspaceId,
      deliveryAttemptId: attemptId as never,
      routingPartitionRef: route.routingPartitionRef,
      tenantName: route.tenantName,
      observedAt: this.now(),
      providerEventId: scalar(envelope.MessageId)
    };
  }

  private validCertificateUrl(value: string) {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        /^sns[.-][a-z0-9-]+\.amazonaws\.com$/u.test(url.hostname) &&
        /^\/SimpleNotificationService-[A-Za-z0-9_-]+\.pem$/u.test(url.pathname)
      );
    } catch {
      return false;
    }
  }

  private async certificate(url: string) {
    const cached = this.certificates.get(url);
    if (cached) return cached;
    const response = await this.fetchImpl(url);
    if (!response.ok)
      throw new AmazonSesDeliveryAdapterError('SNS signing certificate is unavailable.');
    const certificate = await response.text();
    this.certificates.set(url, certificate);
    return certificate;
  }

  private signingString(envelope: SnsEnvelope) {
    const fields = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
    return fields
      .filter((field) => envelope[field] !== undefined)
      .map((field) => `${field}\n${scalar(envelope[field])}\n`)
      .join('');
  }
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
const TAG_NAME = /^[A-Za-z0-9_-]{1,64}$/u;
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

function emailTags(
  tags: readonly Readonly<{ name: string; value: string }>[]
): readonly Readonly<{ Name: string; Value: string }>[] {
  if (tags.length > 20)
    throw new AmazonSesDeliveryAdapterError('SES metadataTags exceeds the bounded maximum.');
  const names = new Set<string>();
  return tags.map((tag, index) => {
    const name = bounded(tag.name, `metadataTags[${index}].name`, 64);
    if (!TAG_NAME.test(name))
      throw new AmazonSesDeliveryAdapterError(`metadataTags[${index}].name is invalid.`);
    if (names.has(name))
      throw new AmazonSesDeliveryAdapterError('SES metadataTags names must be unique.');
    names.add(name);
    return {
      Name: name,
      Value: tagSafe(bounded(tag.value, `metadataTags[${index}].value`, 500))
    };
  });
}

export class AmazonSesV2EmailTransport implements EmailTransportProviderV1 {
  constructor(
    private readonly client: AmazonSesV2Client,
    private readonly routing: AmazonSesRoutingResolver
  ) {}

  async submit(
    materialized: Readonly<MaterializedEmailTransportV1>
  ): Promise<EmailTransportSubmissionResultV1> {
    if (materialized.recipients.length !== 1)
      throw new AmazonSesDeliveryAdapterError('SES V1 transport requires exactly one recipient.');
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

    const tags = emailTags(materialized.metadataTags);

    try {
      const response = await this.client.sendEmail(bounded(routing.region, 'region', 80), {
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
        EmailTags: tags
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

export class AmazonSesV2DeliveryAdapter {
  private readonly transport: AmazonSesV2EmailTransport;

  constructor(client: AmazonSesV2Client, routing: AmazonSesRoutingResolver) {
    this.transport = new AmazonSesV2EmailTransport(client, routing);
  }

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

    return this.transport.submit({
      workspaceId: materialized.workspaceId,
      routingPartitionRef: materialized.routingPartitionRef,
      fromAddress: materialized.fromAddress,
      ...(materialized.replyToAddress ? { replyToAddress: materialized.replyToAddress } : {}),
      recipients: materialized.recipients,
      subject: materialized.subject,
      ...(materialized.textContent ? { textContent: materialized.textContent } : {}),
      ...(materialized.htmlContent ? { htmlContent: materialized.htmlContent } : {}),
      metadataTags: [
        { name: 'mo_attempt', value: attempt.deliveryAttemptId },
        { name: 'mo_workspace', value: materialized.workspaceId },
        { name: 'mo_campaign', value: attempt.campaign.campaignId }
      ]
    });
  }
}

export interface AmazonSesEventContext {
  authenticated: boolean;
  workspaceId: string;
  deliveryAttemptId: EmailDeliveryAttemptV1['deliveryAttemptId'];
  observedAt: string;
  providerEventId?: string;
}

export interface AmazonSesVerifiedEventEnvelope {
  event: unknown;
  workspaceId: string;
  deliveryAttemptId: EmailDeliveryAttemptV1['deliveryAttemptId'];
  routingPartitionRef: string;
  tenantName: string;
  observedAt: string;
  providerEventId?: string;
}

export interface AmazonSesEventAuthenticator {
  verifyAndExtract(envelope: unknown): Promise<Readonly<AmazonSesVerifiedEventEnvelope>>;
}

export interface AmazonSesEventCorrelationVerifier {
  assertCorrelated(
    context: Readonly<{
      workspaceId: string;
      deliveryAttemptId: EmailDeliveryAttemptV1['deliveryAttemptId'];
      routingPartitionRef: string;
      tenantName: string;
      providerMessageRef: string;
    }>
  ): Promise<void>;
}

export interface AmazonSesObservationSink {
  admit(observation: Readonly<EmailDeliveryObservationV1>): Promise<EmailDeliveryObservationV1>;
}

type SesEventRecord = Record<string, unknown>;

function object(value: unknown): SesEventRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AmazonSesDeliveryAdapterError('SES event must be an object.');
  return value as SesEventRecord;
}

function scalar(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value).trim();
  return '';
}

function providerEventTimestamp(
  event: Readonly<SesEventRecord>,
  mail: Readonly<SesEventRecord>
): string {
  const normalized = scalar(event.eventType ?? event.event_type ?? event.type).toUpperCase();
  const detailField: Record<string, string> = {
    BOUNCE: 'bounce',
    COMPLAINT: 'complaint',
    DELIVERY: 'delivery',
    DELIVERYDELAY: 'deliveryDelay',
    REJECT: 'reject',
    RENDERINGFAILURE: 'renderingFailure',
    SUBSCRIPTION: 'subscription'
  };
  const detailKey = detailField[normalized];
  const detail = detailKey ? event[detailKey] : undefined;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const timestamp = scalar((detail as SesEventRecord).timestamp);
    if (timestamp) return timestamp;
  }
  return scalar(event.timestamp ?? mail.timestamp);
}

function providerEventKind(event: Readonly<SesEventRecord>): EmailDeliveryObservationV1['event'] {
  const normalized = scalar(event.eventType ?? event.event_type ?? event.type).toUpperCase();
  if (normalized === 'BOUNCE') {
    const bounce =
      event.bounce && typeof event.bounce === 'object' && !Array.isArray(event.bounce)
        ? (event.bounce as SesEventRecord)
        : {};
    const bounceType = scalar(bounce.bounceType ?? bounce.bounce_type).toUpperCase();
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
        const status = scalar(
          (entry as SesEventRecord).subscriptionStatus ??
            (entry as SesEventRecord).subscription_status
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
  const messageId = scalar(mail.messageId ?? mail.message_id);
  if (!messageId) throw new AmazonSesDeliveryAdapterError('SES event messageId is required.');
  const timestamp = providerEventTimestamp(event, mail);
  const eventAt = new Date(timestamp);
  if (Number.isNaN(eventAt.getTime()))
    throw new AmazonSesDeliveryAdapterError('SES event timestamp is invalid.');

  const destination = Array.isArray(mail.destination)
    ? mail.destination.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : [];
  if (destination.length !== 1)
    throw new AmazonSesDeliveryAdapterError(
      'SES V1 provider event requires exactly one recipient destination.'
    );
  const endpointFingerprintSha256 = createHash('sha256')
    .update(destination[0]!, 'utf8')
    .digest('hex');
  const normalizedEvent = providerEventKind(event);
  const providerEventId = context.providerEventId?.trim();
  const identity = providerEventId
    ? `ses-event:${providerEventId}`
    : `${messageId}:${scalar(eventType) || 'unknown'}:${eventAt.toISOString()}:${endpointFingerprintSha256}`;

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
    endpointFingerprintSha256,
    authenticatedEvidence: true,
    reasonCode: `SES_${normalizedEvent}`,
    evidenceRefs: [`ses-message:${messageId}`],
    eventAt: eventAt.toISOString(),
    observedAt: new Date(context.observedAt).toISOString(),
    authority: noEmailDeliveryAuthorityConsequencesV1
  };
}

export class AmazonSesAuthenticatedEventIngestion {
  constructor(
    private readonly authenticator: AmazonSesEventAuthenticator,
    private readonly correlation: AmazonSesEventCorrelationVerifier,
    private readonly sink: AmazonSesObservationSink
  ) {}

  async ingest(envelope: unknown): Promise<EmailDeliveryObservationV1> {
    const verified = await this.authenticator.verifyAndExtract(envelope);
    const observation = normalizeAmazonSesEvent(verified.event, {
      authenticated: true,
      workspaceId: verified.workspaceId,
      deliveryAttemptId: verified.deliveryAttemptId,
      observedAt: verified.observedAt,
      ...(verified.providerEventId ? { providerEventId: verified.providerEventId } : {})
    });
    if (!observation.providerMessageRef)
      throw new AmazonSesDeliveryAdapterError('SES provider message reference is required.');
    await this.correlation.assertCorrelated({
      workspaceId: verified.workspaceId,
      deliveryAttemptId: verified.deliveryAttemptId,
      routingPartitionRef: bounded(verified.routingPartitionRef, 'routingPartitionRef', 300),
      tenantName: bounded(verified.tenantName, 'tenantName', 128),
      providerMessageRef: observation.providerMessageRef
    });
    return this.sink.admit(observation);
  }
}
