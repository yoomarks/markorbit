import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceChannelIdentityBindingId } from '@markorbit/contracts/channel-identity-binding';
import { assessChannelEntitlementV1 } from '@markorbit/contracts/channel-platform';
import { materializeTrustedWorkspaceChannelIdentityBindingV1 } from '../src/workspace-channel-identity-binding.js';
import { WorkspaceChannelIdentityCurrentnessResolverV1 } from '../src/workspace-channel-identity-currentness.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const bindingId =
  'workspace-channel-identity-binding_currentness' as WorkspaceChannelIdentityBindingId;
const binding = materializeTrustedWorkspaceChannelIdentityBindingV1(
  {
    workspaceId,
    idempotencyKey: 'currentness-admit',
    featureKey: 'WHATSAPP_BUSINESS',
    identity: { externalAccountRef: 'account_primary', displayLabel: 'Primary' },
    connection: {
      sourceKind: 'PROVIDER_AUTH',
      capabilityRef: { capabilityId: 'capability_whatsapp', capabilityVersion: '1.0.0' },
      implementationRef: {
        implementationProfileId: 'implementation-profile_whatsapp' as const,
        version: 2
      },
      oauthCredentialRef: {
        owner: 'CORE_IDENTITY',
        credentialBindingId: 'oauth-credential-binding_whatsapp' as const,
        version: 3
      },
      evidenceRefs: ['provider:verified']
    }
  },
  '2026-09-20T09:00:00.000Z',
  bindingId
);

type Options = {
  exact?: typeof binding | undefined;
  latest?: typeof binding | undefined;
  entitled?: boolean | undefined;
  verification?: 'VERIFIED' | 'UNKNOWN' | 'UNAVAILABLE';
  credential?: 'CURRENT' | 'EXPIRED' | 'REAUTH_REQUIRED' | 'REVOKED' | 'UNKNOWN' | 'UNAVAILABLE';
  provenance?: 'CURRENT' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE';
};

function harness(options: Options = {}) {
  const exact = Object.prototype.hasOwnProperty.call(options, 'exact') ? options.exact : binding;
  const latest = Object.prototype.hasOwnProperty.call(options, 'latest') ? options.latest : binding;
  const entitled = Object.prototype.hasOwnProperty.call(options, 'entitled')
    ? options.entitled
    : true;
  return new WorkspaceChannelIdentityCurrentnessResolverV1(
    {
      getExact: () => Promise.resolve(exact),
      getLatest: () => Promise.resolve(latest)
    },
    {
      resolve: () =>
        Promise.resolve(
          entitled === undefined
            ? undefined
            : {
                ...assessChannelEntitlementV1(workspaceId, 'WHATSAPP_BUSINESS', []),
                status: entitled ? 'ENABLED' : 'NOT_ENTITLED',
                allowed: entitled
              }
        )
    },
    {
      verify: (value) =>
        Promise.resolve({
          schemaVersion: 1,
          binding: {
            id: value.workspaceChannelIdentityBindingId,
            version: value.version,
            fingerprintSha256: value.bindingFingerprintSha256
          },
          status: options.verification ?? 'VERIFIED',
          observedAt: '2026-09-20T09:30:00.000Z',
          evidenceRefs: ['provider-verification:current']
        })
    },
    { assess: () => Promise.resolve({ state: options.credential ?? 'CURRENT' }) },
    { assess: () => Promise.resolve({ state: options.credential ?? 'CURRENT' }) },
    { assess: () => Promise.resolve({ state: options.provenance ?? 'CURRENT' }) },
    () => '2026-09-20T10:00:00.000Z'
  );
}

const request = {
  workspaceId,
  featureKey: 'WHATSAPP_BUSINESS' as const,
  binding: {
    id: bindingId,
    version: 1,
    fingerprintSha256: binding.bindingFingerprintSha256
  },
  oauthRequirements: { expectedProvider: 'WHATSAPP', requiredScopes: ['messages.send'] }
};

const externalBinding = materializeTrustedWorkspaceChannelIdentityBindingV1(
  {
    workspaceId,
    idempotencyKey: 'currentness-external-admit',
    featureKey: 'WHATSAPP_BUSINESS',
    identity: { externalAccountRef: 'account_primary', displayLabel: 'Primary' },
    connection: {
      sourceKind: 'PROVIDER_API',
      capabilityRef: { capabilityId: 'capability_whatsapp', capabilityVersion: '1.0.0' },
      implementationRef: {
        implementationProfileId: 'implementation-profile_whatsapp' as const,
        version: 2
      },
      externalCredentialRef: {
        owner: 'CORE_IDENTITY',
        credentialBindingId: 'external-credential-binding_whatsapp' as const,
        version: 4
      },
      evidenceRefs: ['provider:verified']
    }
  },
  '2026-09-20T09:00:00.000Z',
  bindingId
);

function externalHarness(
  state: Options['credential'] = 'CURRENT',
  observe?: (input: unknown) => void,
  onVerify?: () => void,
  provenance: Options['provenance'] = 'CURRENT'
) {
  return new WorkspaceChannelIdentityCurrentnessResolverV1(
    {
      getExact: () => Promise.resolve(externalBinding),
      getLatest: () => Promise.resolve(externalBinding)
    },
    {
      resolve: () =>
        Promise.resolve({
          ...assessChannelEntitlementV1(workspaceId, 'WHATSAPP_BUSINESS', []),
          status: 'ENABLED',
          allowed: true
        })
    },
    {
      verify: (value) => {
        onVerify?.();
        return Promise.resolve({
          schemaVersion: 1,
          binding: {
            id: value.workspaceChannelIdentityBindingId,
            version: value.version,
            fingerprintSha256: value.bindingFingerprintSha256
          },
          status: 'VERIFIED' as const,
          observedAt: '2026-09-20T09:30:00.000Z',
          evidenceRefs: ['provider-verification:current']
        });
      }
    },
    { assess: () => Promise.reject(new Error('OAuth reader must not be selected.')) },
    {
      assess: (input) => {
        observe?.(input);
        return Promise.resolve({ state: state ?? 'CURRENT' });
      }
    },
    { assess: () => Promise.resolve({ state: provenance ?? 'CURRENT' }) },
    () => '2026-09-20T10:00:00.000Z'
  );
}

const externalRequest = {
  workspaceId,
  featureKey: 'WHATSAPP_BUSINESS' as const,
  binding: {
    id: bindingId,
    version: 1,
    fingerprintSha256: externalBinding.bindingFingerprintSha256
  },
  externalCredentialRequirements: {
    expectedProvider: 'WHATSAPP',
    expectedSecretKind: 'API_KEY' as const
  }
};

describe('Workspace Channel identity JIT currentness', () => {
  it('returns CURRENT only for the exact fully-current chain without creating authority', async () => {
    const value = await harness().resolve(request);
    expect(value).toMatchObject({
      state: 'CURRENT',
      reason: 'EXACT_BINDING_CURRENT',
      createsExecutionAuthority: false
    });
    expect(JSON.stringify(value)).not.toMatch(/accessToken|refreshToken/u);
  });

  it('selects external credential currentness with the exact immutable context', async () => {
    let received: unknown;
    await expect(
      externalHarness('CURRENT', (input) => {
        received = input;
      }).resolve(externalRequest)
    ).resolves.toMatchObject({ state: 'CURRENT', createsExecutionAuthority: false });
    expect(received).toEqual({
      credential: externalBinding.connection.externalCredentialRef,
      expectedWorkspaceId: workspaceId,
      expectedProvider: 'WHATSAPP',
      expectedExternalAccountRef: 'account_primary',
      expectedSecretKind: 'API_KEY',
      requiredCapabilityId: 'capability_whatsapp'
    });
  });

  it.each([
    ['EXPIRED', 'REAUTH_REQUIRED', 'CREDENTIAL_EXPIRED'],
    ['REAUTH_REQUIRED', 'REAUTH_REQUIRED', 'CREDENTIAL_REAUTH_REQUIRED'],
    ['REVOKED', 'REVOKED', 'CREDENTIAL_REVOKED'],
    ['UNKNOWN', 'UNKNOWN', 'CREDENTIAL_UNKNOWN'],
    ['UNAVAILABLE', 'UNAVAILABLE', 'CREDENTIAL_UNAVAILABLE']
  ] as const)(
    'fails closed when the external credential is %s',
    async (credential, state, reason) => {
      await expect(externalHarness(credential).resolve(externalRequest)).resolves.toMatchObject({
        state,
        reason
      });
    }
  );

  it('checks credential and Implementation currentness before provider identity verification', async () => {
    const verifyExpired = vi.fn();
    await expect(
      externalHarness('REAUTH_REQUIRED', undefined, verifyExpired).resolve(externalRequest)
    ).resolves.toMatchObject({
      state: 'REAUTH_REQUIRED',
      reason: 'CREDENTIAL_REAUTH_REQUIRED'
    });
    expect(verifyExpired).not.toHaveBeenCalled();

    const verifyStaleProfile = vi.fn();
    await expect(
      externalHarness('CURRENT', undefined, verifyStaleProfile, 'STALE').resolve(externalRequest)
    ).resolves.toMatchObject({
      state: 'STALE',
      reason: 'IMPLEMENTATION_STALE'
    });
    expect(verifyStaleProfile).not.toHaveBeenCalled();
  });

  it('fails closed for missing or mixed credential requirements', async () => {
    await expect(
      externalHarness().resolve({
        workspaceId,
        featureKey: 'WHATSAPP_BUSINESS',
        binding: externalRequest.binding
      })
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'CREDENTIAL_UNKNOWN' });
    await expect(
      externalHarness().resolve({
        ...externalRequest,
        oauthRequirements: { expectedProvider: 'WHATSAPP', requiredScopes: [] }
      })
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'CREDENTIAL_UNKNOWN' });
  });

  it.each([
    [{ exact: undefined }, 'UNKNOWN', 'OWNER_DATA_UNKNOWN'],
    [{ latest: { ...binding, version: 2 } }, 'STALE', 'BINDING_STALE'],
    [{ exact: { ...binding, status: 'STALE' } }, 'STALE', 'BINDING_STALE'],
    [{ exact: { ...binding, status: 'REVOKED' } }, 'REVOKED', 'BINDING_REVOKED'],
    [{ verification: 'UNKNOWN' }, 'UNKNOWN', 'IDENTITY_VERIFICATION_UNKNOWN'],
    [{ verification: 'UNAVAILABLE' }, 'UNAVAILABLE', 'IDENTITY_VERIFICATION_UNAVAILABLE'],
    [{ entitled: false }, 'NOT_ENTITLED', 'ENTITLEMENT_NOT_ENABLED'],
    [{ entitled: undefined }, 'UNAVAILABLE', 'OWNER_DATA_UNKNOWN'],
    [{ credential: 'EXPIRED' }, 'REAUTH_REQUIRED', 'CREDENTIAL_EXPIRED'],
    [{ credential: 'REAUTH_REQUIRED' }, 'REAUTH_REQUIRED', 'CREDENTIAL_REAUTH_REQUIRED'],
    [{ credential: 'REVOKED' }, 'REVOKED', 'CREDENTIAL_REVOKED'],
    [{ credential: 'UNKNOWN' }, 'UNKNOWN', 'CREDENTIAL_UNKNOWN'],
    [{ credential: 'UNAVAILABLE' }, 'UNAVAILABLE', 'CREDENTIAL_UNAVAILABLE'],
    [{ provenance: 'STALE' }, 'STALE', 'IMPLEMENTATION_STALE'],
    [{ provenance: 'UNKNOWN' }, 'UNKNOWN', 'OWNER_DATA_UNKNOWN'],
    [{ provenance: 'UNAVAILABLE' }, 'UNAVAILABLE', 'IMPLEMENTATION_UNAVAILABLE']
  ] as const)('fails closed for %o', async (options, state, reason) => {
    await expect(harness(options).resolve(request)).resolves.toMatchObject({ state, reason });
  });

  it('rejects workspace, feature, fingerprint, and missing OAuth context mismatches', async () => {
    await expect(
      harness().resolve({ ...request, workspaceId: '15151515-1515-4515-8515-151515151515' })
    ).resolves.toMatchObject({ state: 'UNKNOWN' });
    await expect(
      harness().resolve({ ...request, featureKey: 'SMS_WORKSPACE_CAMPAIGN' })
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'FEATURE_MISMATCH' });
    await expect(
      harness().resolve({
        ...request,
        binding: { ...request.binding, fingerprintSha256: 'a'.repeat(64) }
      })
    ).resolves.toMatchObject({ state: 'UNKNOWN' });
    const withoutOAuthContext = {
      workspaceId: request.workspaceId,
      featureKey: request.featureKey,
      binding: request.binding
    };
    await expect(harness().resolve(withoutOAuthContext)).resolves.toMatchObject({
      state: 'UNKNOWN',
      reason: 'CREDENTIAL_UNKNOWN'
    });
  });
});
