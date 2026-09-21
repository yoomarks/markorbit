import { timingSafeEqual } from 'node:crypto';
import {
  parseWorkspaceChannelIdentityBindingV1,
  type WorkspaceChannelIdentityBindingV1,
  type WorkspaceChannelIdentityVerificationObservationV1
} from '@markorbit/contracts/channel-identity-binding';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { ExternalCredentialProviderError } from './external-credential-provider.js';
import type { CoreBackedExternalCredentialProviderV1 } from './external-credential-provider.js';

export const TWILIO_SMS_PROVIDER_V1 = 'TWILIO' as const;
export const TWILIO_SMS_CAPABILITY_ID_V1 = 'channel.sms.notification' as const;
export const TWILIO_SMS_CAPABILITY_VERSION_V1 = '1' as const;
export const TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1 =
  'implementation-profile_twilio-sms-incoming-phone-number-v1' as const;
export const TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1 = 1 as const;

export const TWILIO_SMS_IMPLEMENTATION_PROFILE_V1: Readonly<ImplementationProfile> = Object.freeze({
  schemaVersion: 1,
  implementationProfileId: TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
  version: TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1,
  capabilityId: TWILIO_SMS_CAPABILITY_ID_V1,
  capabilityVersion: TWILIO_SMS_CAPABILITY_VERSION_V1,
  kind: 'EXTERNAL_PROVIDER',
  status: 'APPROVED',
  implementationKey: 'twilio.sms.incoming-phone-number.v1',
  inputSchemaId: 'channel.sms.identity.verification.input.v1',
  outputSchemaId: 'channel.sms.identity.verification.output.v1',
  allowedCallerProducts: ['LITE'],
  maximumRiskClass: 'PROTECTED',
  timeoutMs: 5_000,
  maxAttempts: 1,
  approvalPolicyVersion: 'channels.c7d-audit.1394.v1',
  createdAt: '2026-09-21T04:39:20.000Z'
});

export const TWILIO_SMS_ACCEPTED_CAPABILITY_CANON_V1 = Object.freeze({
  sourceAuthority: 'ACCEPTED_CAPABILITY_CANON' as const,
  capabilityId: TWILIO_SMS_CAPABILITY_ID_V1,
  capabilityVersion: TWILIO_SMS_CAPABILITY_VERSION_V1,
  title: 'Workspace-owned SMS Notification',
  description:
    'Binds one Workspace-owned SMS identity to the governed Notification send capability without granting send authority.',
  lineage: { capabilityId: TWILIO_SMS_CAPABILITY_ID_V1 },
  canonReference: {
    canonId: 'github:yoomarks/markorbit#1394',
    canonVersion: 'c7d-twilio-audit-v1',
    sourceFingerprintSha256: 'db14c2a7f44301f4c23c523a9e7350c8fa67f69dd9a5c4035c97659587dbc4ec'
  }
});

const ACCOUNT_SID = /^AC[0-9a-fA-F]{32}$/u;
const PHONE_NUMBER_SID = /^PN[0-9a-fA-F]{32}$/u;

type VerificationStatus = 'VERIFIED' | 'UNKNOWN' | 'UNAVAILABLE';
type JsonObject = Record<string, unknown>;

function record(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

export class TwilioSmsIdentityVerificationAuthorityV1 {
  constructor(
    private readonly credentials: Pick<CoreBackedExternalCredentialProviderV1, 'withCredential'>,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly timeoutMs = 3_000
  ) {}

  async verify(
    value: Readonly<WorkspaceChannelIdentityBindingV1>
  ): Promise<Readonly<WorkspaceChannelIdentityVerificationObservationV1>> {
    const binding = parseWorkspaceChannelIdentityBindingV1(value);
    const result = (
      status: VerificationStatus,
      evidenceRef: string
    ): Readonly<WorkspaceChannelIdentityVerificationObservationV1> => ({
      schemaVersion: 1,
      binding: {
        id: binding.workspaceChannelIdentityBindingId,
        version: binding.version,
        fingerprintSha256: binding.bindingFingerprintSha256
      },
      status,
      observedAt: this.now(),
      evidenceRefs: [evidenceRef]
    });

    if (
      binding.featureKey !== 'SMS_WORKSPACE_NOTIFICATION' ||
      binding.connection.sourceKind !== 'PROVIDER_API' ||
      binding.connection.capabilityRef.capabilityId !== TWILIO_SMS_CAPABILITY_ID_V1 ||
      binding.connection.capabilityRef.capabilityVersion !== TWILIO_SMS_CAPABILITY_VERSION_V1 ||
      binding.connection.implementationRef.implementationProfileId !==
        TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1 ||
      binding.connection.implementationRef.version !== TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1
    )
      return result('UNAVAILABLE', 'twilio-sms-identity:unsupported-binding');

    const accountSid = binding.identity.externalAccountRef;
    const phoneNumberSid = binding.identity.externalChannelRef;
    const credential = binding.connection.externalCredentialRef;
    if (
      !ACCOUNT_SID.test(accountSid) ||
      !phoneNumberSid ||
      !PHONE_NUMBER_SID.test(phoneNumberSid) ||
      !credential ||
      binding.connection.oauthCredentialRef
    )
      return result('UNKNOWN', 'twilio-sms-identity:invalid-exact-identity');

    try {
      return await this.credentials.withCredential(
        {
          callerService: 'CAPABILITY_ENGINE',
          credential,
          expectedWorkspaceId: binding.workspaceId,
          expectedProvider: TWILIO_SMS_PROVIDER_V1,
          expectedExternalAccountRef: accountSid,
          expectedSecretKind: 'BASIC',
          requiredCapabilityId: TWILIO_SMS_CAPABILITY_ID_V1,
          requiredCapabilityVersion: TWILIO_SMS_CAPABILITY_VERSION_V1,
          implementationProfileId: TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
          implementationProfileVersion: TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1,
          correlationId: `channel-identity-verification:${binding.workspaceChannelIdentityBindingId}:${binding.version}`,
          approvedUsage: 'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION'
        },
        async (secret) => {
          if (secret.kind !== 'BASIC' || secret.username !== accountSid)
            return result('UNKNOWN', 'twilio-sms-identity:credential-account-mismatch');

          const authorization = `Basic ${Buffer.from(
            `${secret.username}:${secret.password}`,
            'utf8'
          ).toString('base64')}`;
          const account = await this.get(
            `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
            authorization
          );
          if (account.kind === 'UNAVAILABLE')
            return result('UNAVAILABLE', 'twilio-sms-identity:account-unavailable');
          if (account.kind !== 'OK')
            return result('UNKNOWN', 'twilio-sms-identity:account-not-verified');
          const accountBody = record(account.body);
          if (accountBody?.sid !== accountSid || accountBody.status !== 'active')
            return result('UNKNOWN', 'twilio-sms-identity:account-not-active');

          const number = await this.get(
            `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
              accountSid
            )}/IncomingPhoneNumbers/${encodeURIComponent(phoneNumberSid)}.json`,
            authorization
          );
          if (number.kind === 'UNAVAILABLE')
            return result('UNAVAILABLE', 'twilio-sms-identity:number-unavailable');
          if (number.kind !== 'OK')
            return result('UNKNOWN', 'twilio-sms-identity:number-not-verified');
          const numberBody = record(number.body);
          const capabilities = record(numberBody?.capabilities);
          if (
            numberBody?.sid !== phoneNumberSid ||
            numberBody.account_sid !== accountSid ||
            capabilities?.sms !== true
          )
            return result('UNKNOWN', 'twilio-sms-identity:number-context-mismatch');

          return result(
            'VERIFIED',
            `twilio-sms-identity:account:${accountSid}:number:${phoneNumberSid}:sms-capable`
          );
        }
      );
    } catch (error) {
      if (error instanceof ExternalCredentialProviderError) {
        return error.code === 'CREDENTIAL_RESOLUTION_UNAVAILABLE'
          ? result('UNAVAILABLE', 'twilio-sms-identity:credential-unavailable')
          : result('UNKNOWN', 'twilio-sms-identity:credential-not-verified');
      }
      return result('UNAVAILABLE', 'twilio-sms-identity:verification-unavailable');
    }
  }

  private async get(
    url: string,
    authorization: string
  ): Promise<
    | Readonly<{ kind: 'OK'; body: unknown }>
    | Readonly<{ kind: 'REJECTED' }>
    | Readonly<{ kind: 'UNAVAILABLE' }>
  > {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: 'GET',
        headers: { authorization, accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    if (response.status >= 500 || response.status === 429) return { kind: 'UNAVAILABLE' };
    if (!response.ok) return { kind: 'REJECTED' };
    try {
      return { kind: 'OK', body: await response.json() };
    } catch {
      return { kind: 'REJECTED' };
    }
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

function body(request: JsonRequest): JsonObject {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as JsonObject;
}

export function createTwilioSmsIdentityVerificationRoutesV1(
  options: Readonly<{
    internalServiceSecret: string;
    verification: Pick<TwilioSmsIdentityVerificationAuthorityV1, 'verify'>;
  }>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/channel-identity/verification',
      async handle(request) {
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
        const value = body(request);
        if (Object.keys(value).length !== 1 || !('binding' in value))
          throw new HttpError(400, 'INVALID_REQUEST', 'Request must contain only binding.');
        let binding: WorkspaceChannelIdentityBindingV1;
        try {
          binding = parseWorkspaceChannelIdentityBindingV1(value.binding);
        } catch (error) {
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            error instanceof Error ? error.message : 'binding is invalid.'
          );
        }
        return json(200, await options.verification.verify(binding));
      }
    }
  ];
}
