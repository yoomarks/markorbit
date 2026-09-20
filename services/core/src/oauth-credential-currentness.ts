import {
  parseExternalOAuthCredentialRefV1,
  type ExternalOAuthCredentialRefV1
} from '@markorbit/contracts/oauth-credential';
import type { CurrentWorkspaceAuthorityService } from './current-workspace-authority.js';
import type { OAuthCredentialRepositoryV1 } from './oauth-credential.js';

export type OAuthCredentialCurrentnessStateV1 =
  'CURRENT' | 'EXPIRED' | 'REAUTH_REQUIRED' | 'REVOKED' | 'UNKNOWN' | 'UNAVAILABLE';

export interface OAuthCredentialCurrentnessV1 {
  schemaVersion: 1;
  credential: Readonly<ExternalOAuthCredentialRefV1>;
  state: OAuthCredentialCurrentnessStateV1;
  checkedAt: string;
  exposesAccessToken: false;
}

export interface OAuthCredentialCurrentnessRequestV1 {
  credential: Readonly<ExternalOAuthCredentialRefV1>;
  expectedWorkspaceId: string;
  expectedProvider: string;
  expectedExternalAccountRef: string;
  requiredScopes: readonly string[];
}

const text = (value: string, field: string, maximum = 500): string => {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new TypeError(`${field} is invalid.`);
  return normalized;
};

export class OAuthCredentialCurrentnessServiceV1 {
  constructor(
    private readonly repository: Pick<OAuthCredentialRepositoryV1, 'findCredential'>,
    private readonly currentWorkspaceAuthority: Pick<CurrentWorkspaceAuthorityService, 'validate'>,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async assess(
    input: Readonly<OAuthCredentialCurrentnessRequestV1>
  ): Promise<Readonly<OAuthCredentialCurrentnessV1>> {
    const credential = parseExternalOAuthCredentialRefV1(input.credential);
    const expectedWorkspaceId = text(
      input.expectedWorkspaceId,
      'expectedWorkspaceId'
    ).toLowerCase();
    const expectedProvider = text(input.expectedProvider, 'expectedProvider', 120);
    const expectedExternalAccountRef = text(
      input.expectedExternalAccountRef,
      'expectedExternalAccountRef'
    );
    const requiredScopes = input.requiredScopes.map((scope) => text(scope, 'requiredScope', 200));
    if (new Set(requiredScopes).size !== requiredScopes.length)
      throw new TypeError('requiredScopes must not contain duplicates.');
    const checkedAt = this.clock().toISOString();
    const result = (state: OAuthCredentialCurrentnessStateV1): OAuthCredentialCurrentnessV1 => ({
      schemaVersion: 1,
      credential,
      state,
      checkedAt,
      exposesAccessToken: false
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
      binding.credentialBindingId !== credential.credentialBindingId ||
      binding.version !== credential.version ||
      binding.workspaceId !== expectedWorkspaceId ||
      binding.provider !== expectedProvider ||
      binding.externalAccountRef !== expectedExternalAccountRef ||
      requiredScopes.some((scope) => !binding.grantedScopes.includes(scope))
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
    if (binding.lifecycle === 'REVOKED') return result('REVOKED');
    if (binding.lifecycle === 'REAUTH_REQUIRED') return result('REAUTH_REQUIRED');
    if (binding.lifecycle === 'EXPIRED') return result('EXPIRED');
    if (binding.lifecycle !== 'ACTIVE') return result('UNKNOWN');
    if (
      binding.accessExpiresAt &&
      Date.parse(binding.accessExpiresAt) <= this.clock().getTime() + 30_000
    )
      return result('EXPIRED');
    return result('CURRENT');
  }
}
