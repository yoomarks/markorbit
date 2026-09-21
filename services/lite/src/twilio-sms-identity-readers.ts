import {
  parseWorkspaceChannelIdentityBindingV1,
  parseWorkspaceChannelIdentityVerificationObservationV1,
  type WorkspaceChannelIdentityBindingV1,
  type WorkspaceChannelIdentityVerificationObservationV1
} from '@markorbit/contracts/channel-identity-binding';
import type { SmsNotificationChannelIdentityRequirementsReaderV1 } from './notification-automation-rule-currentness.js';
import type {
  WorkspaceChannelIdentityBindingReaderV1,
  WorkspaceChannelIdentityVerificationAuthorityV1
} from './workspace-channel-identity-currentness.js';

export const TWILIO_SMS_CAPABILITY_ID = 'channel.sms.notification';
export const TWILIO_SMS_CAPABILITY_VERSION = '1';
export const TWILIO_SMS_IMPLEMENTATION_PROFILE_ID =
  'implementation-profile_twilio-sms-incoming-phone-number-v1';
export const TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION = 1;

function unavailable(
  binding: Readonly<WorkspaceChannelIdentityBindingV1>,
  now: () => string
): Readonly<WorkspaceChannelIdentityVerificationObservationV1> {
  return {
    schemaVersion: 1,
    binding: {
      id: binding.workspaceChannelIdentityBindingId,
      version: binding.version,
      fingerprintSha256: binding.bindingFingerprintSha256
    },
    status: 'UNAVAILABLE',
    observedAt: now(),
    evidenceRefs: ['channel-identity-verification:unavailable']
  };
}

export class HttpCapabilityWorkspaceChannelIdentityVerificationAuthorityV1 implements WorkspaceChannelIdentityVerificationAuthorityV1 {
  constructor(
    private readonly capabilityEngineUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly timeoutMs = 3_000
  ) {}

  async verify(
    binding: Readonly<WorkspaceChannelIdentityBindingV1>
  ): Promise<Readonly<WorkspaceChannelIdentityVerificationObservationV1>> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityEngineUrl.replace(/\/$/u, '')}/internal/v1/channel-identity/verification`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify({ binding }),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return unavailable(binding, this.now);
    }
    if (!response.ok) return unavailable(binding, this.now);
    try {
      const observation = parseWorkspaceChannelIdentityVerificationObservationV1(
        await response.json()
      );
      if (
        observation.binding.id !== binding.workspaceChannelIdentityBindingId ||
        observation.binding.version !== binding.version ||
        observation.binding.fingerprintSha256 !== binding.bindingFingerprintSha256
      )
        return unavailable(binding, this.now);
      return observation;
    } catch {
      return unavailable(binding, this.now);
    }
  }
}

export class TwilioSmsNotificationChannelIdentityRequirementsReaderV1 implements SmsNotificationChannelIdentityRequirementsReaderV1 {
  constructor(
    private readonly bindings: Pick<WorkspaceChannelIdentityBindingReaderV1, 'getExact'>
  ) {}

  async resolve(
    input: Parameters<SmsNotificationChannelIdentityRequirementsReaderV1['resolve']>[0]
  ) {
    try {
      const found = await this.bindings.getExact(
        input.workspaceId,
        input.binding.id,
        input.binding.version
      );
      if (!found) return { unavailable: true as const };
      const binding = parseWorkspaceChannelIdentityBindingV1(found);
      if (
        binding.workspaceId !== input.workspaceId.toLowerCase() ||
        binding.featureKey !== 'SMS_WORKSPACE_NOTIFICATION' ||
        binding.workspaceChannelIdentityBindingId !== input.binding.id ||
        binding.version !== input.binding.version ||
        binding.bindingFingerprintSha256 !== input.binding.fingerprintSha256 ||
        binding.connection.sourceKind !== 'PROVIDER_API' ||
        binding.connection.capabilityRef.capabilityId !== TWILIO_SMS_CAPABILITY_ID ||
        binding.connection.capabilityRef.capabilityVersion !== TWILIO_SMS_CAPABILITY_VERSION ||
        binding.connection.implementationRef.implementationProfileId !==
          TWILIO_SMS_IMPLEMENTATION_PROFILE_ID ||
        binding.connection.implementationRef.version !==
          TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION ||
        !binding.connection.externalCredentialRef ||
        binding.connection.oauthCredentialRef
      )
        return { unavailable: true as const };
      return {
        kind: 'EXTERNAL_CREDENTIAL' as const,
        expectedProvider: 'TWILIO',
        expectedSecretKind: 'BASIC' as const
      };
    } catch {
      return { unavailable: true as const };
    }
  }
}
