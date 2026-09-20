import {
  parseExternalCredentialRefV1,
  type ExternalCredentialCurrentnessV1,
  type ExternalCredentialRefV1,
  type ExternalCredentialSecretKindV1
} from '@markorbit/contracts/external-credential';
import type { CurrentWorkspaceAuthorityService } from './current-workspace-authority.js';
import type { ExternalCredentialRepositoryV1 } from './external-credential.js';

export interface ExternalCredentialCurrentnessRequestV1 {
  credential: Readonly<ExternalCredentialRefV1>;
  expectedWorkspaceId: string;
  expectedProvider: string;
  expectedExternalAccountRef: string;
  expectedSecretKind: ExternalCredentialSecretKindV1;
  requiredCapabilityId: string;
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new TypeError(`${field} is invalid.`);
  return value.trim();
}

export class ExternalCredentialCurrentnessServiceV1 {
  constructor(
    private readonly repository: Pick<ExternalCredentialRepositoryV1, 'findCredential'>,
    private readonly currentWorkspaceAuthority: Pick<CurrentWorkspaceAuthorityService, 'validate'>,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async assess(
    input: Readonly<ExternalCredentialCurrentnessRequestV1>
  ): Promise<Readonly<ExternalCredentialCurrentnessV1>> {
    const credential = parseExternalCredentialRefV1(input.credential);
    const expectedWorkspaceId = text(
      input.expectedWorkspaceId,
      'expectedWorkspaceId'
    ).toLowerCase();
    const expectedProvider = text(input.expectedProvider, 'expectedProvider', 120);
    const expectedExternalAccountRef = text(
      input.expectedExternalAccountRef,
      'expectedExternalAccountRef'
    );
    const requiredCapabilityId = text(input.requiredCapabilityId, 'requiredCapabilityId', 200);
    if (!['API_KEY', 'STATIC_BEARER', 'BASIC'].includes(input.expectedSecretKind))
      throw new TypeError('expectedSecretKind is invalid.');
    const checkedAt = this.clock().toISOString();
    const result = (
      state: ExternalCredentialCurrentnessV1['state']
    ): ExternalCredentialCurrentnessV1 => ({
      schemaVersion: 1,
      credential,
      state,
      checkedAt,
      exposesSecretMaterial: false,
      createsExecutionAuthority: false
    });

    let stored;
    try {
      stored = await this.repository.findCredential(credential.credentialBindingId);
    } catch {
      return result('UNAVAILABLE');
    }
    if (!stored) return result('UNKNOWN');
    const binding = stored.binding;
    if (
      binding.version !== credential.version ||
      binding.workspaceId !== expectedWorkspaceId ||
      binding.provider !== expectedProvider ||
      binding.externalAccountRef !== expectedExternalAccountRef ||
      binding.secretKind !== input.expectedSecretKind ||
      !binding.allowedCapabilityIds.includes(requiredCapabilityId)
    )
      return result('UNKNOWN');
    try {
      await this.currentWorkspaceAuthority.validate({
        workspaceId: binding.workspaceId,
        userId: binding.grantor.userId,
        membershipId: binding.grantor.membershipId,
        expectedMembershipVersion: binding.grantor.membershipVersion
      });
    } catch (error) {
      return result((error as { retryable?: boolean }).retryable ? 'UNAVAILABLE' : 'UNKNOWN');
    }
    if (binding.lifecycle !== 'ACTIVE') return result(binding.lifecycle);
    if (!stored.secret) return result('UNAVAILABLE');
    if (binding.expiresAt && Date.parse(binding.expiresAt) <= this.clock().getTime())
      return result('EXPIRED');
    return result('CURRENT');
  }
}
