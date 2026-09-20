import { describe, expect, it } from 'vitest';
import {
  assessWorkspaceChannelIdentityBindingEligibilityV1,
  noWorkspaceChannelIdentityAuthorityConsequencesV1,
  parseWorkspaceChannelIdentityBindingV1,
  parseWorkspaceChannelIdentityCurrentnessV1,
  type WorkspaceChannelIdentityBindingV1
} from '../src/channel-identity-binding.js';
import { workspaceChannelIdentityBindingFingerprintSha256V1 } from '../src/channel-identity-binding-fingerprint.js';

const workspaceId = 'workspace_channels-01';
const authority = noWorkspaceChannelIdentityAuthorityConsequencesV1;

function activeBinding(
  overrides: Partial<WorkspaceChannelIdentityBindingV1> = {}
): WorkspaceChannelIdentityBindingV1 {
  const draft = {
    schemaVersion: 1,
    workspaceChannelIdentityBindingId: 'workspace-channel-identity-binding_sms-01',
    version: 2,
    workspaceId,
    featureKey: 'SMS_WORKSPACE_NOTIFICATION',
    identity: {
      externalAccountRef: 'account_sms-01',
      externalChannelRef: 'sender_identity-01',
      displayLabel: 'Mark Orbit SMS'
    },
    status: 'ACTIVE',
    connection: {
      sourceKind: 'PROVIDER_AUTH',
      capabilityRef: {
        capabilityId: 'channel.identity.connect',
        capabilityVersion: '1.0.0'
      },
      implementationRef: {
        implementationProfileId: 'implementation-profile_sms-official-api',
        version: 3
      },
      oauthCredentialRef: {
        owner: 'CORE_IDENTITY',
        credentialBindingId: 'oauth-credential-binding_sms-01',
        version: 4
      },
      evidenceRefs: ['evidence:channel-binding:sms-01']
    },
    bindingFingerprintSha256: '0'.repeat(64),
    boundAt: '2026-09-20T07:00:00.000Z',
    lastVerifiedAt: '2026-09-20T07:01:00.000Z',
    updatedAt: '2026-09-20T07:01:00.000Z',
    authority,
    ...overrides
  } as WorkspaceChannelIdentityBindingV1;
  const fingerprint = workspaceChannelIdentityBindingFingerprintSha256V1(draft);
  return parseWorkspaceChannelIdentityBindingV1({
    ...draft,
    bindingFingerprintSha256: fingerprint
  });
}
function verification(
  binding: Readonly<WorkspaceChannelIdentityBindingV1>,
  status: 'VERIFIED' | 'UNKNOWN' | 'UNAVAILABLE' = 'VERIFIED'
) {
  return {
    schemaVersion: 1 as const,
    binding: {
      id: binding.workspaceChannelIdentityBindingId,
      version: binding.version,
      fingerprintSha256: binding.bindingFingerprintSha256
    },
    status,
    observedAt: '2026-09-20T07:02:00.000Z',
    evidenceRefs: ['evidence:channel-verification:sms-01']
  };
}

describe('Workspace identity-bound Channel binding', () => {
  it('accepts a safe Workspace-owned identity with exact implementation and OAuth lineage', () => {
    const binding = activeBinding();
    expect(binding).toMatchObject({
      workspaceId,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION',
      status: 'ACTIVE',
      identity: {
        externalAccountRef: 'account_sms-01',
        externalChannelRef: 'sender_identity-01'
      },
      connection: {
        implementationRef: {
          implementationProfileId: 'implementation-profile_sms-official-api',
          version: 3
        },
        oauthCredentialRef: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: 'oauth-credential-binding_sms-01',
          version: 4
        }
      },
      authority
    });
    expect(binding.bindingFingerprintSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(workspaceChannelIdentityBindingFingerprintSha256V1(binding)).toBe(
      binding.bindingFingerprintSha256
    );
    expect(Object.values(binding.authority).every((value) => value === false)).toBe(true);
  });

  it.each(['EMAIL_CAMPAIGN', 'SMS_MO_SYSTEM_NOTIFICATION'] as const)(
    'rejects MO-managed feature %s from the Workspace-owned binding boundary',
    (featureKey) => {
      expect(() =>
        parseWorkspaceChannelIdentityBindingV1({
          ...activeBinding(),
          featureKey
        })
      ).toThrow('featureKey must require a Workspace-owned identity');
    }
  );

  it.each([
    ['accessToken', 'secret-access'],
    ['apiKey', 'secret-key'],
    ['password', 'secret-password'],
    ['cookie', 'session-cookie'],
    ['clientSecret', 'secret-client'],
    ['header', 'x-provider-key: secret'],
    ['headers', { 'x-provider-key': 'secret' }],
    ['credentials', { token: 'secret' }]
  ] as const)('rejects credential/session escape hatch %s', (key, value) => {
    const binding = activeBinding();
    expect(() =>
      parseWorkspaceChannelIdentityBindingV1({
        ...binding,
        connection: { ...binding.connection, [key]: value }
      })
    ).toThrow('forbidden credential/session material');
  });

  it('requires the exact safe Core OAuth reference shape', () => {
    const binding = activeBinding();
    expect(() =>
      parseWorkspaceChannelIdentityBindingV1({
        ...binding,
        connection: {
          ...binding.connection,
          oauthCredentialRef: {
            ...binding.connection.oauthCredentialRef,
            owner: 'OTHER'
          }
        }
      })
    ).toThrow('credential.owner must be CORE_IDENTITY');
  });

  it('accepts one exact safe external credential ref and fingerprints its version', () => {
    const oauthBinding = activeBinding();
    const connection = { ...oauthBinding.connection };
    delete connection.oauthCredentialRef;
    const external = activeBinding({
      connection: {
        ...connection,
        externalCredentialRef: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: 'external-credential-binding_sms-01',
          version: 7
        }
      }
    });
    expect(external.connection.externalCredentialRef).toEqual({
      owner: 'CORE_IDENTITY',
      credentialBindingId: 'external-credential-binding_sms-01',
      version: 7
    });
    expect(external.bindingFingerprintSha256).not.toBe(oauthBinding.bindingFingerprintSha256);
    const next = activeBinding({
      connection: {
        ...connection,
        externalCredentialRef: {
          owner: 'CORE_IDENTITY',
          credentialBindingId: 'external-credential-binding_sms-01',
          version: 8
        }
      }
    });
    expect(next.bindingFingerprintSha256).not.toBe(external.bindingFingerprintSha256);
  });

  it('rejects both credential ref kinds in one connection', () => {
    const binding = activeBinding();
    expect(() =>
      parseWorkspaceChannelIdentityBindingV1({
        ...binding,
        connection: {
          ...binding.connection,
          externalCredentialRef: {
            owner: 'CORE_IDENTITY',
            credentialBindingId: 'external-credential-binding_sms-01',
            version: 1
          }
        }
      })
    ).toThrow('must not contain both');
  });

  it('rejects secret material nested inside the safe OAuth reference', () => {
    const binding = activeBinding();
    expect(() =>
      parseWorkspaceChannelIdentityBindingV1({
        ...binding,
        connection: {
          ...binding.connection,
          oauthCredentialRef: {
            ...binding.connection.oauthCredentialRef,
            accessToken: 'secret'
          }
        }
      })
    ).toThrow('forbidden credential/session material');
  });

  it('rejects raw metadata escape hatches instead of becoming a provider schema', () => {
    const binding = activeBinding();
    expect(() =>
      parseWorkspaceChannelIdentityBindingV1({
        ...binding,
        identity: { ...binding.identity, metadata: { providerSpecific: true } }
      })
    ).toThrow('unsupported fields');
  });
  it.each([
    ['STALE', 'BINDING_STALE'],
    ['REVOKED', 'BINDING_REVOKED']
  ] as const)('fails closed for %s lifecycle', (status, reason) => {
    const binding =
      status === 'STALE'
        ? activeBinding({
            version: 3,
            status,
            staleAt: '2026-09-20T07:03:00.000Z',
            updatedAt: '2026-09-20T07:03:00.000Z'
          })
        : activeBinding({
            version: 4,
            status,
            staleAt: '2026-09-20T07:03:00.000Z',
            revokedAt: '2026-09-20T07:04:00.000Z',
            updatedAt: '2026-09-20T07:04:00.000Z'
          });
    const result = assessWorkspaceChannelIdentityBindingEligibilityV1(binding, {
      workspaceId,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION',
      assessedAt: '2026-09-20T07:06:00.000Z',
      verification: {
        ...verification(binding),
        observedAt: '2026-09-20T07:05:00.000Z'
      }
    });
    expect(result).toMatchObject({ eligible: false, reason });
    expect(result.createsExecutionAuthority).toBe(false);
  });
  it.each([
    ['UNKNOWN', 'VERIFICATION_UNKNOWN'],
    ['UNAVAILABLE', 'VERIFICATION_UNAVAILABLE']
  ] as const)('fails closed when identity verification is %s', (status, reason) => {
    const binding = activeBinding();
    expect(
      assessWorkspaceChannelIdentityBindingEligibilityV1(binding, {
        workspaceId,
        featureKey: 'SMS_WORKSPACE_NOTIFICATION',
        assessedAt: '2026-09-20T07:03:00.000Z',
        verification: verification(binding, status)
      })
    ).toMatchObject({
      eligible: false,
      reason,
      verificationStatus: status,
      createsExecutionAuthority: false
    });
  });

  it('fails closed on Workspace, feature, or exact verification lineage mismatch', () => {
    const binding = activeBinding();
    const request = {
      workspaceId,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
      assessedAt: '2026-09-20T07:03:00.000Z',
      verification: verification(binding)
    };
    expect(
      assessWorkspaceChannelIdentityBindingEligibilityV1(binding, {
        ...request,
        workspaceId: 'workspace_other'
      })
    ).toMatchObject({ eligible: false, reason: 'WORKSPACE_MISMATCH' });
    expect(
      assessWorkspaceChannelIdentityBindingEligibilityV1(binding, {
        ...request,
        featureKey: 'SMS_WORKSPACE_CAMPAIGN'
      })
    ).toMatchObject({ eligible: false, reason: 'FEATURE_MISMATCH' });
    expect(
      assessWorkspaceChannelIdentityBindingEligibilityV1(binding, {
        ...request,
        verification: {
          ...request.verification,
          observedAt: '2026-09-20T07:00:30.000Z',
          binding: {
            ...request.verification.binding,
            fingerprintSha256: 'f'.repeat(64)
          }
        }
      })
    ).toMatchObject({
      eligible: false,
      reason: 'VERIFICATION_REFERENCE_MISMATCH'
    });
  });

  it('accepts only temporally current verification evidence', () => {
    const binding = activeBinding();
    expect(() =>
      assessWorkspaceChannelIdentityBindingEligibilityV1(binding, {
        workspaceId,
        featureKey: 'SMS_WORKSPACE_NOTIFICATION',
        assessedAt: '2026-09-20T07:03:00.000Z',
        verification: {
          ...verification(binding),
          observedAt: '2026-09-20T07:00:30.000Z'
        }
      })
    ).toThrow('lastVerifiedAt cannot be after verification.observedAt');
  });
  it('does not allow binding metadata to grant contact, provider, credential, or execution authority', () => {
    const binding = activeBinding();
    expect(() =>
      parseWorkspaceChannelIdentityBindingV1({
        ...binding,
        authority: { ...authority, protectedActionAuthorized: true }
      })
    ).toThrow('authority.protectedActionAuthorized must be false');
    expect(() =>
      parseWorkspaceChannelIdentityBindingV1({
        ...binding,
        authority: { ...authority, contactBasisEstablished: true }
      })
    ).toThrow('authority.contactBasisEstablished must be false');
  });

  it('models REAUTH_REQUIRED currentness without creating execution authority', () => {
    const binding = activeBinding();
    expect(
      parseWorkspaceChannelIdentityCurrentnessV1({
        schemaVersion: 1,
        workspaceId,
        featureKey: binding.featureKey,
        binding: {
          id: binding.workspaceChannelIdentityBindingId,
          version: binding.version,
          fingerprintSha256: binding.bindingFingerprintSha256
        },
        state: 'REAUTH_REQUIRED',
        reason: 'CREDENTIAL_REAUTH_REQUIRED',
        assessedAt: '2026-09-20T07:03:00.000Z',
        createsExecutionAuthority: false
      })
    ).toMatchObject({
      state: 'REAUTH_REQUIRED',
      reason: 'CREDENTIAL_REAUTH_REQUIRED',
      createsExecutionAuthority: false
    });
    expect(() =>
      parseWorkspaceChannelIdentityCurrentnessV1({
        schemaVersion: 1,
        workspaceId,
        featureKey: binding.featureKey,
        binding: {
          id: binding.workspaceChannelIdentityBindingId,
          version: binding.version,
          fingerprintSha256: binding.bindingFingerprintSha256
        },
        state: 'CURRENT',
        reason: 'EXACT_BINDING_CURRENT',
        assessedAt: '2026-09-20T07:03:00.000Z',
        createsExecutionAuthority: true
      })
    ).toThrow('createsExecutionAuthority must be false');
  });
});
