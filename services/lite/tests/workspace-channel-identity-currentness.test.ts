import { describe, expect, it } from 'vitest';
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
