import { timingSafeEqual } from 'node:crypto';
import {
  parseWorkspaceChannelIdentityBindingV1,
  type WorkspaceChannelIdentityBindingV1
} from '@markorbit/contracts/channel-identity-binding';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { ExternalCredentialProviderError } from './external-credential-provider.js';
import type { CoreBackedExternalCredentialProviderV1 } from './external-credential-provider.js';
import {
  TWILIO_SMS_CAPABILITY_ID_V1,
  TWILIO_SMS_CAPABILITY_VERSION_V1,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1,
  TWILIO_SMS_PROVIDER_V1
} from './twilio-sms-identity.js';

const ACCOUNT_SID = /^AC[0-9a-fA-F]{32}$/u;
const PHONE_NUMBER_SID = /^PN[0-9a-fA-F]{32}$/u;
const MESSAGE_SID = /^SM[0-9a-fA-F]{32}$/u;
const E164 = /^\+[1-9][0-9]{7,14}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

type JsonObject = Record<string, unknown>;

export interface TwilioSmsTransportMaterializedV1 {
  workspaceId: string;
  identityBinding: Readonly<WorkspaceChannelIdentityBindingV1>;
  recipient: string;
  textContent: string;
  endpointFingerprintSha256: string;
  metadataTags: readonly Readonly<{ name: string; value: string }>[];
}

export type TwilioSmsTransportSubmissionResultV1 =
  | Readonly<{ status: 'ACCEPTED'; providerSubmissionRef: string }>
  | Readonly<{ status: 'FAILED'; reasonCode: string }>
  | Readonly<{ status: 'UNKNOWN'; reasonCode: string }>;

function record(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function boundedText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || !value || value.length > maximum)
    throw new TypeError(`${field} is invalid.`);
  return value;
}

function exactObject(value: unknown, fields: readonly string[], field: string): JsonObject {
  const item = record(value);
  if (!item || Object.keys(item).some((key) => !fields.includes(key)))
    throw new TypeError(`${field} is invalid.`);
  return item;
}

function parseMaterialized(value: unknown): TwilioSmsTransportMaterializedV1 {
  const item = exactObject(
    value,
    [
      'workspaceId',
      'identityBinding',
      'recipient',
      'textContent',
      'endpointFingerprintSha256',
      'metadataTags'
    ],
    'materialized'
  );
  const workspaceId = boundedText(item.workspaceId, 'workspaceId', 240).trim().toLowerCase();
  const identityBinding = parseWorkspaceChannelIdentityBindingV1(item.identityBinding);
  if (identityBinding.workspaceId !== workspaceId)
    throw new TypeError('identityBinding workspace does not match transport workspace.');
  const recipient = boundedText(item.recipient, 'recipient', 32);
  if (!E164.test(recipient)) throw new TypeError('recipient must be one E.164 SMS endpoint.');
  const textContent = boundedText(item.textContent, 'textContent', 1_600);
  const endpointFingerprintSha256 = boundedText(
    item.endpointFingerprintSha256,
    'endpointFingerprintSha256',
    64
  );
  if (!SHA256.test(endpointFingerprintSha256))
    throw new TypeError('endpointFingerprintSha256 is invalid.');
  if (!Array.isArray(item.metadataTags) || item.metadataTags.length > 20)
    throw new TypeError('metadataTags is invalid.');
  const metadataTags = item.metadataTags.map((value, index) => {
    const tag = exactObject(value, ['name', 'value'], `metadataTags[${index}]`);
    return {
      name: boundedText(tag.name, `metadataTags[${index}].name`, 80),
      value: boundedText(tag.value, `metadataTags[${index}].value`, 300)
    };
  });
  return {
    workspaceId,
    identityBinding,
    recipient,
    textContent,
    endpointFingerprintSha256,
    metadataTags
  };
}

function callbackUrl(value: string): string {
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:' ||
    !parsed.hostname ||
    parsed.hostname.includes('_') ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  )
    throw new TypeError('Twilio SMS StatusCallback must be one HTTPS URL with a valid hostname.');
  return parsed.toString();
}

export class TwilioSmsTransportAuthorityV1 {
  private readonly statusCallbackUrl: string;

  constructor(
    private readonly credentials: Pick<CoreBackedExternalCredentialProviderV1, 'withCredential'>,
    statusCallbackUrl: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 5_000
  ) {
    this.statusCallbackUrl = callbackUrl(statusCallbackUrl);
  }

  async submit(value: unknown): Promise<TwilioSmsTransportSubmissionResultV1> {
    let materialized: TwilioSmsTransportMaterializedV1;
    try {
      materialized = parseMaterialized(value);
    } catch {
      return { status: 'FAILED', reasonCode: 'INVALID_TRANSPORT_INPUT' };
    }
    const binding = materialized.identityBinding;
    if (
      binding.featureKey !== 'SMS_WORKSPACE_NOTIFICATION' ||
      binding.status !== 'ACTIVE' ||
      binding.connection.sourceKind !== 'PROVIDER_API' ||
      binding.connection.capabilityRef.capabilityId !== TWILIO_SMS_CAPABILITY_ID_V1 ||
      binding.connection.capabilityRef.capabilityVersion !== TWILIO_SMS_CAPABILITY_VERSION_V1 ||
      binding.connection.implementationRef.implementationProfileId !==
        TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1 ||
      binding.connection.implementationRef.version !==
        TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1 ||
      binding.connection.oauthCredentialRef ||
      !binding.connection.externalCredentialRef
    )
      return { status: 'FAILED', reasonCode: 'IDENTITY_IMPLEMENTATION_MISMATCH' };

    const accountSid = binding.identity.externalAccountRef;
    const phoneNumberSid = binding.identity.externalChannelRef;
    if (!ACCOUNT_SID.test(accountSid) || !phoneNumberSid || !PHONE_NUMBER_SID.test(phoneNumberSid))
      return { status: 'FAILED', reasonCode: 'IDENTITY_REFERENCE_INVALID' };

    try {
      return await this.credentials.withCredential(
        {
          callerService: 'CAPABILITY_ENGINE',
          credential: binding.connection.externalCredentialRef,
          expectedWorkspaceId: materialized.workspaceId,
          expectedProvider: TWILIO_SMS_PROVIDER_V1,
          expectedExternalAccountRef: accountSid,
          expectedSecretKind: 'BASIC',
          requiredCapabilityId: TWILIO_SMS_CAPABILITY_ID_V1,
          requiredCapabilityVersion: TWILIO_SMS_CAPABILITY_VERSION_V1,
          implementationProfileId: TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
          implementationProfileVersion: TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1,
          correlationId: `sms-transport:${binding.workspaceChannelIdentityBindingId}:${binding.version}:${materialized.endpointFingerprintSha256}`,
          approvedUsage: 'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION'
        },
        async (secret) => {
          if (secret.kind !== 'BASIC' || secret.username !== accountSid)
            return { status: 'FAILED', reasonCode: 'CREDENTIAL_ACCOUNT_MISMATCH' } as const;
          const authorization = `Basic ${Buffer.from(
            `${secret.username}:${secret.password}`,
            'utf8'
          ).toString('base64')}`;
          const sender = await this.materializeSender(accountSid, phoneNumberSid, authorization);
          if (!sender.ok) return { status: 'FAILED', reasonCode: sender.reasonCode } as const;
          return this.createMessage(materialized, accountSid, sender.phoneNumber, authorization);
        }
      );
    } catch (error) {
      if (error instanceof ExternalCredentialProviderError) {
        return {
          status: 'FAILED',
          reasonCode:
            error.code === 'CREDENTIAL_RESOLUTION_UNAVAILABLE'
              ? 'CREDENTIAL_RESOLUTION_UNAVAILABLE'
              : 'CREDENTIAL_RESOLUTION_DENIED'
        };
      }
      return { status: 'UNKNOWN', reasonCode: 'TRANSPORT_INTERNAL_AMBIGUOUS' };
    }
  }

  private async materializeSender(
    accountSid: string,
    phoneNumberSid: string,
    authorization: string
  ): Promise<
    Readonly<{ ok: true; phoneNumber: string }> | Readonly<{ ok: false; reasonCode: string }>
  > {
    let response: Response;
    try {
      response = await this.fetcher(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
          accountSid
        )}/IncomingPhoneNumbers/${encodeURIComponent(phoneNumberSid)}.json`,
        {
          method: 'GET',
          headers: { authorization, accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return { ok: false, reasonCode: 'SENDER_LOOKUP_UNAVAILABLE' };
    }
    if (response.status >= 500 || response.status === 429)
      return { ok: false, reasonCode: 'SENDER_LOOKUP_UNAVAILABLE' };
    if (!response.ok) return { ok: false, reasonCode: 'SENDER_NOT_CURRENT' };
    const body = record(await response.json().catch(() => undefined));
    const capabilities = record(body?.capabilities);
    const phoneNumber = body?.phone_number;
    if (
      body?.sid !== phoneNumberSid ||
      body.account_sid !== accountSid ||
      capabilities?.sms !== true ||
      typeof phoneNumber !== 'string' ||
      !E164.test(phoneNumber)
    )
      return { ok: false, reasonCode: 'SENDER_NOT_CURRENT' };
    return { ok: true, phoneNumber };
  }

  private async createMessage(
    materialized: Readonly<TwilioSmsTransportMaterializedV1>,
    accountSid: string,
    from: string,
    authorization: string
  ): Promise<TwilioSmsTransportSubmissionResultV1> {
    const form = new URLSearchParams({
      To: materialized.recipient,
      From: from,
      Body: materialized.textContent,
      StatusCallback: this.statusCallbackUrl
    });
    let response: Response;
    try {
      response = await this.fetcher(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
          accountSid
        )}/Messages.json`,
        {
          method: 'POST',
          headers: {
            authorization,
            accept: 'application/json',
            'content-type': 'application/x-www-form-urlencoded'
          },
          body: form.toString(),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return { status: 'UNKNOWN', reasonCode: 'PROVIDER_SUBMISSION_AMBIGUOUS' };
    }
    if (response.status === 429) return { status: 'FAILED', reasonCode: 'PROVIDER_THROTTLED' };
    if (response.status >= 500)
      return { status: 'UNKNOWN', reasonCode: 'PROVIDER_SUBMISSION_AMBIGUOUS' };
    if (!response.ok) return { status: 'FAILED', reasonCode: 'PROVIDER_REJECTED' };

    const body = record(await response.json().catch(() => undefined));
    if (
      !body ||
      typeof body.sid !== 'string' ||
      !MESSAGE_SID.test(body.sid) ||
      body.account_sid !== accountSid
    )
      return { status: 'UNKNOWN', reasonCode: 'PROVIDER_RESPONSE_AMBIGUOUS' };
    return { status: 'ACCEPTED', providerSubmissionRef: body.sid };
  }
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createTwilioSmsTransportRoutesV1(
  options: Readonly<{
    internalServiceSecret: string;
    transport: Pick<TwilioSmsTransportAuthorityV1, 'submit'>;
  }>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/channel-sms/twilio/submit',
      async handle(request: JsonRequest) {
        if (
          !trusted(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'UNTRUSTED_INTERNAL_CALLER',
            'Trusted internal authorization is required.'
          );
        const body = exactObject(request.body, ['materialized'], 'request');
        return json(200, await options.transport.submit(body.materialized));
      }
    }
  ];
}
