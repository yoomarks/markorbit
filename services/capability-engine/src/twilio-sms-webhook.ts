import { timingSafeEqual } from 'node:crypto';
import twilio from 'twilio';
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
const MESSAGE_SID = /^SM[0-9a-fA-F]{32}$/u;
const SIGNATURE = /^[A-Za-z0-9+/=]{16,256}$/u;

type FormPair = Readonly<{ name: string; value: string }>;

export interface TwilioSmsStatusCallbackVerificationRequestV1 {
  workspaceId: string;
  identityBinding: Readonly<WorkspaceChannelIdentityBindingV1>;
  signature: string;
  formParams: readonly FormPair[];
}

export type TwilioSmsStatusCallbackVerificationResultV1 =
  | Readonly<{
      authenticated: true;
      externalAccountRef: string;
      providerMessageRef: string;
      messageStatus: string;
      providerErrorCode?: string;
    }>
  | Readonly<{
      authenticated: false;
      reasonCode:
        | 'INVALID_INPUT'
        | 'IDENTITY_IMPLEMENTATION_MISMATCH'
        | 'CREDENTIAL_UNAVAILABLE'
        | 'SIGNATURE_INVALID'
        | 'CALLBACK_CORRELATION_MISMATCH';
    }>;

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

function text(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || !value || value.length > maximum)
    throw new TypeError(`${field} is invalid.`);
  return value;
}

function parseRequest(value: unknown): TwilioSmsStatusCallbackVerificationRequestV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('verification request is invalid.');
  const item = value as Record<string, unknown>;
  const keys = Object.keys(item).sort().join(',');
  if (keys !== 'formParams,identityBinding,signature,workspaceId')
    throw new TypeError('verification request fields are invalid.');
  const workspaceId = text(item.workspaceId, 'workspaceId', 240).trim().toLowerCase();
  const identityBinding = parseWorkspaceChannelIdentityBindingV1(item.identityBinding);
  if (identityBinding.workspaceId !== workspaceId)
    throw new TypeError('identityBinding workspace does not match.');
  const signature = text(item.signature, 'signature', 256);
  if (!SIGNATURE.test(signature)) throw new TypeError('signature is invalid.');
  if (!Array.isArray(item.formParams) || item.formParams.length < 1 || item.formParams.length > 100)
    throw new TypeError('formParams are invalid.');
  let total = 0;
  const formParams = item.formParams.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new TypeError(`formParams[${index}] is invalid.`);
    const pair = entry as Record<string, unknown>;
    if (Object.keys(pair).sort().join(',') !== 'name,value')
      throw new TypeError(`formParams[${index}] fields are invalid.`);
    const name = text(pair.name, `formParams[${index}].name`, 160);
    const paramValue = text(pair.value, `formParams[${index}].value`, 8_000);
    total += name.length + paramValue.length;
    if (total > 32_768) throw new TypeError('formParams are too large.');
    return { name, value: paramValue };
  });
  return { workspaceId, identityBinding, signature, formParams };
}

function groupedParams(pairs: readonly FormPair[]): Record<string, string | string[]> {
  const grouped: Record<string, string | string[]> = {};
  for (const { name, value } of pairs) {
    const prior = grouped[name];
    if (prior === undefined) grouped[name] = value;
    else if (Array.isArray(prior)) prior.push(value);
    else grouped[name] = [prior, value];
  }
  return grouped;
}

function one(pairs: readonly FormPair[], name: string): string | undefined {
  const values = pairs.filter((pair) => pair.name === name).map((pair) => pair.value);
  return values.length === 1 ? values[0] : undefined;
}

export class TwilioSmsStatusCallbackVerificationAuthorityV1 {
  private readonly externalCallbackUrl: string;

  constructor(
    private readonly credentials: Pick<CoreBackedExternalCredentialProviderV1, 'withCredential'>,
    externalCallbackUrl: string
  ) {
    this.externalCallbackUrl = callbackUrl(externalCallbackUrl);
  }

  async verify(value: unknown): Promise<TwilioSmsStatusCallbackVerificationResultV1> {
    let request: TwilioSmsStatusCallbackVerificationRequestV1;
    try {
      request = parseRequest(value);
    } catch {
      return { authenticated: false, reasonCode: 'INVALID_INPUT' };
    }

    const binding = request.identityBinding;
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
      !binding.connection.externalCredentialRef ||
      !ACCOUNT_SID.test(binding.identity.externalAccountRef)
    )
      return { authenticated: false, reasonCode: 'IDENTITY_IMPLEMENTATION_MISMATCH' };

    const accountSid = binding.identity.externalAccountRef;
    try {
      return await this.credentials.withCredential(
        {
          callerService: 'CAPABILITY_ENGINE',
          credential: binding.connection.externalCredentialRef,
          expectedWorkspaceId: request.workspaceId,
          expectedProvider: TWILIO_SMS_PROVIDER_V1,
          expectedExternalAccountRef: accountSid,
          expectedSecretKind: 'BASIC',
          requiredCapabilityId: TWILIO_SMS_CAPABILITY_ID_V1,
          requiredCapabilityVersion: TWILIO_SMS_CAPABILITY_VERSION_V1,
          implementationProfileId: TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
          implementationProfileVersion: TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1,
          correlationId: `twilio-status-callback:${binding.workspaceChannelIdentityBindingId}:${binding.version}`,
          approvedUsage: 'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION'
        },
        async (secret) => {
          if (secret.kind !== 'BASIC' || secret.username !== accountSid)
            return { authenticated: false, reasonCode: 'CREDENTIAL_UNAVAILABLE' } as const;
          const valid = await Promise.resolve(
            twilio.validateRequest(
              secret.password,
              request.signature,
              this.externalCallbackUrl,
              groupedParams(request.formParams)
            )
          );
          if (!valid) return { authenticated: false, reasonCode: 'SIGNATURE_INVALID' } as const;

          const callbackAccountSid = one(request.formParams, 'AccountSid');
          const providerMessageRef = one(request.formParams, 'MessageSid');
          const messageStatus = one(request.formParams, 'MessageStatus');
          const providerErrorCode = one(request.formParams, 'ErrorCode');
          if (
            callbackAccountSid !== accountSid ||
            !providerMessageRef ||
            !MESSAGE_SID.test(providerMessageRef) ||
            !messageStatus ||
            messageStatus.length > 80 ||
            (providerErrorCode !== undefined && !/^[0-9]{1,10}$/u.test(providerErrorCode))
          )
            return {
              authenticated: false,
              reasonCode: 'CALLBACK_CORRELATION_MISMATCH'
            } as const;
          return {
            authenticated: true,
            externalAccountRef: accountSid,
            providerMessageRef,
            messageStatus,
            ...(providerErrorCode ? { providerErrorCode } : {})
          } as const;
        }
      );
    } catch (error) {
      if (error instanceof ExternalCredentialProviderError)
        return { authenticated: false, reasonCode: 'CREDENTIAL_UNAVAILABLE' };
      return { authenticated: false, reasonCode: 'CREDENTIAL_UNAVAILABLE' };
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

export function createTwilioSmsStatusCallbackVerificationRoutesV1(
  options: Readonly<{
    internalServiceSecret: string;
    verifier: Pick<TwilioSmsStatusCallbackVerificationAuthorityV1, 'verify'>;
  }>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/channel-sms/twilio/status-callback/verify',
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
        return json(200, await options.verifier.verify(request.body));
      }
    }
  ];
}
