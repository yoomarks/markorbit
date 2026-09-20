import { describe, expect, it } from 'vitest';
import type { WorkspaceChannelIdentityBindingId } from '@markorbit/contracts/channel-identity-binding';
import {
  materializeTrustedWorkspaceChannelIdentityBindingV1,
  workspaceChannelExternalIdentityFingerprintSha256V1
} from '../src/workspace-channel-identity-binding.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const bindingId = 'workspace-channel-identity-binding_unit' as WorkspaceChannelIdentityBindingId;

const command = {
  workspaceId,
  idempotencyKey: 'unit-admit',
  featureKey: 'WHATSAPP_BUSINESS' as const,
  identity: {
    externalAccountRef: 'business-account_primary',
    externalChannelRef: 'phone-number_primary',
    displayLabel: 'Primary business account'
  },
  connection: {
    sourceKind: 'PROVIDER_AUTH' as const,
    capabilityRef: { capabilityId: 'capability_whatsapp', capabilityVersion: '1.0.0' },
    implementationRef: {
      implementationProfileId: 'implementation-profile_whatsapp-primary' as const,
      version: 2
    },
    oauthCredentialRef: {
      owner: 'CORE_IDENTITY' as const,
      credentialBindingId: 'oauth-credential-binding_whatsapp-primary' as const,
      version: 3
    },
    evidenceRefs: ['provider-auth:verified:primary']
  }
};

describe('Workspace Channel Identity Binding durable materialization', () => {
  it('computes the authoritative fingerprint server-side with no authority consequences', () => {
    const binding = materializeTrustedWorkspaceChannelIdentityBindingV1(
      command,
      '2026-09-20T09:00:00.000Z',
      bindingId
    );
    expect(binding).toMatchObject({
      workspaceId,
      version: 1,
      status: 'ACTIVE',
      featureKey: 'WHATSAPP_BUSINESS'
    });
    expect(binding.bindingFingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(Object.values(binding.authority).every((value) => value === false)).toBe(true);
  });

  it('uses opaque external refs, not displayLabel, as canonical identity', () => {
    const first = workspaceChannelExternalIdentityFingerprintSha256V1(command);
    const relabeled = workspaceChannelExternalIdentityFingerprintSha256V1({
      ...command,
      identity: { ...command.identity, displayLabel: 'Renamed for display only' }
    });
    expect(relabeled).toBe(first);
  });

  it.each(['EMAIL_NOTIFICATION', 'EMAIL_CAMPAIGN', 'SMS_MO_SYSTEM_NOTIFICATION'] as const)(
    'rejects non identity-bound feature %s',
    (featureKey) => {
      expect(() =>
        materializeTrustedWorkspaceChannelIdentityBindingV1(
          { ...command, featureKey },
          '2026-09-20T09:00:00.000Z',
          bindingId
        )
      ).toThrow(/Workspace-owned identity/u);
    }
  );

  it('rejects credential and arbitrary metadata escape hatches', () => {
    expect(() =>
      materializeTrustedWorkspaceChannelIdentityBindingV1(
        {
          ...command,
          connection: {
            ...command.connection,
            accessToken: 'test-secret-not-real'
          }
        } as never,
        '2026-09-20T09:00:00.000Z',
        bindingId
      )
    ).toThrow(/contract validation/u);
    expect(() =>
      materializeTrustedWorkspaceChannelIdentityBindingV1(
        {
          ...command,
          identity: { ...command.identity, metadata: { provider: 'untrusted' } }
        } as never,
        '2026-09-20T09:00:00.000Z',
        bindingId
      )
    ).toThrow(/contract validation/u);
  });
});
