import { describe, expect, it, vi } from 'vitest';
import {
  ExternalCredentialResolutionServiceV1,
  externalCredentialApprovedUsageV1,
  type ExternalCredentialResolutionAuditEventV1,
  type ExternalCredentialResolutionRepositoryV1
} from '../src/external-credential-resolution.js';
import {
  ExternalCredentialKeyringV1,
  externalCredentialSecretAadV1
} from '../src/external-credential-crypto.js';
import type { ExternalCredentialStoredV1 } from '../src/external-credential.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const credential = {
  owner: 'CORE_IDENTITY' as const,
  credentialBindingId: 'external-credential-binding_resolution' as const,
  version: 3
};
const keyring = new ExternalCredentialKeyringV1({
  activeKeyId: 'key-v1',
  keys: { 'key-v1': Buffer.alloc(32, 1) }
});
const request = {
  callerService: 'CAPABILITY_ENGINE' as const,
  credential,
  expectedWorkspaceId: workspaceId,
  expectedProvider: 'TEST_PROVIDER',
  expectedExternalAccountRef: 'account-primary',
  expectedSecretKind: 'API_KEY' as const,
  requiredCapabilityId: 'capability.messages.send',
  requiredCapabilityVersion: '1.0.0',
  implementationProfileId: 'implementation-profile_test-provider-v1',
  implementationProfileVersion: 7,
  correlationId: 'correlation-resolution-1',
  approvedUsage: externalCredentialApprovedUsageV1
};

function stored(overrides: Record<string, unknown> = {}): ExternalCredentialStoredV1 {
  const binding = {
    schemaVersion: 1 as const,
    credentialBindingId: credential.credentialBindingId,
    version: 3,
    workspaceId,
    provider: 'TEST_PROVIDER',
    externalAccountRef: 'account-primary',
    secretKind: 'API_KEY' as const,
    allowedCapabilityIds: ['capability.messages.send'],
    grantor: {
      userId: '22222222-2222-4222-8222-222222222222',
      membershipId: '33333333-3333-4333-8333-333333333333',
      membershipVersion: 5
    },
    lifecycle: 'ACTIVE' as const,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    authority: {
      credentialSelectionAuthorityGranted: false as const,
      providerSelectionAuthorityGranted: false as const,
      implementationSelectionAuthorityGranted: false as const,
      protectedActionAuthorized: false as const,
      externalActionAuthorized: false as const,
      publishAuthorized: false as const,
      messageSendAuthorized: false as const,
      filingAuthorized: false as const,
      paymentAuthorized: false as const,
      externalIdentityLegallyVerified: false as const
    },
    ...overrides
  };
  const secretGeneration = 2;
  return {
    binding,
    secretGeneration,
    secret: keyring.encrypt(
      { kind: 'API_KEY', keyId: 'client-1', secret: 'material-must-not-leak' },
      externalCredentialSecretAadV1({
        credentialBindingId: binding.credentialBindingId,
        workspaceId: binding.workspaceId,
        provider: binding.provider,
        secretKind: binding.secretKind,
        secretGeneration
      })
    )
  };
}

class Repository implements ExternalCredentialResolutionRepositoryV1 {
  events: ExternalCredentialResolutionAuditEventV1[] = [];
  constructor(public value: ExternalCredentialStoredV1 | undefined = stored()) {}
  findCredential() {
    return Promise.resolve(this.value);
  }
  withCredentialLock<T>(_id: string, callback: () => Promise<T>) {
    return callback();
  }
  recordResolutionAudit(event: ExternalCredentialResolutionAuditEventV1) {
    this.events.push(structuredClone(event));
    return Promise.resolve();
  }
}

function service(
  repository = new Repository(),
  provenanceState: 'CURRENT' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE' = 'CURRENT'
) {
  const validate = vi.fn(() => Promise.resolve({}) as never);
  const assess = vi.fn(() => Promise.resolve({ state: provenanceState }));
  return {
    resolver: new ExternalCredentialResolutionServiceV1({
      repository,
      currentWorkspaceAuthority: { validate },
      provenance: { assess },
      keyring,
      clock: () => new Date('2026-09-20T11:00:00.000Z')
    }),
    repository,
    validate,
    assess
  };
}

describe('trusted external credential resolution', () => {
  it('validates exact authority and provenance before returning one no-authority secret', async () => {
    const h = service();
    const resolved = await h.resolver.resolve(request);
    expect(resolved).toEqual({
      schemaVersion: 1,
      credentialBindingId: credential.credentialBindingId,
      bindingVersion: 3,
      secret: { kind: 'API_KEY', keyId: 'client-1', secret: 'material-must-not-leak' },
      createsProviderSelectionAuthority: false,
      createsImplementationSelectionAuthority: false,
      createsExecutionAuthority: false,
      authorizesProtectedAction: false
    });
    expect(h.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedMembershipVersion: 5,
        requiredPermission: 'workspace:manage'
      })
    );
    expect(h.assess).toHaveBeenCalledWith({
      capabilityId: request.requiredCapabilityId,
      capabilityVersion: request.requiredCapabilityVersion,
      implementationProfileId: request.implementationProfileId,
      implementationProfileVersion: request.implementationProfileVersion
    });
    expect(h.repository.events).toMatchObject([{ outcome: 'ALLOW', reason: 'ALLOWED' }]);
    expect(JSON.stringify(h.repository.events)).not.toContain('material-must-not-leak');
  });

  it.each([
    [{ credential: { ...credential, version: 2 } }, 'EXTERNAL_CREDENTIAL_STALE'],
    [
      { expectedWorkspaceId: '44444444-4444-4444-8444-444444444444' },
      'EXTERNAL_CREDENTIAL_CONTEXT_MISMATCH'
    ],
    [{ expectedProvider: 'OTHER' }, 'EXTERNAL_CREDENTIAL_CONTEXT_MISMATCH'],
    [{ expectedExternalAccountRef: 'other' }, 'EXTERNAL_CREDENTIAL_CONTEXT_MISMATCH'],
    [{ expectedSecretKind: 'BASIC' }, 'EXTERNAL_CREDENTIAL_CONTEXT_MISMATCH'],
    [{ requiredCapabilityId: 'capability.other' }, 'EXTERNAL_CREDENTIAL_CAPABILITY_DENIED']
  ] as const)('denies forged or mismatched context %o', async (change, code) => {
    const h = service();
    await expect(h.resolver.resolve({ ...request, ...change })).rejects.toMatchObject({
      code
    });
    expect(h.repository.events.at(-1)).toMatchObject({ outcome: 'DENY', reason: code });
    expect(h.assess).not.toHaveBeenCalled();
  });

  it.each(['STALE', 'UNKNOWN', 'UNAVAILABLE'] as const)(
    'fails closed when provenance is %s',
    async (state) => {
      const h = service(new Repository(), state);
      await expect(h.resolver.resolve(request)).rejects.toMatchObject({
        code:
          state === 'UNAVAILABLE'
            ? 'EXTERNAL_CREDENTIAL_SOURCE_UNAVAILABLE'
            : 'EXTERNAL_CREDENTIAL_PROVENANCE_DENIED'
      });
      expect(h.repository.events.at(-1)?.outcome).toBe('DENY');
    }
  );

  it('fails closed for lifecycle, expiry, missing secret, tamper, and stale grantor authority', async () => {
    const withoutSecret = stored();
    delete (withoutSecret as { secret?: unknown }).secret;
    for (const value of [
      stored({ lifecycle: 'REVOKED', revokedAt: '2026-09-20T10:30:00.000Z' }),
      stored({ expiresAt: '2026-09-20T10:30:00.000Z' }),
      withoutSecret,
      { ...stored(), secret: { ...stored().secret!, ciphertextBase64: 'tampered' } }
    ]) {
      const h = service(new Repository(value));
      await expect(h.resolver.resolve(request)).rejects.toThrow();
      expect(h.repository.events.at(-1)?.reason).toMatch(/INELIGIBLE|SOURCE_UNAVAILABLE/u);
    }
    const h = service();
    h.validate.mockRejectedValueOnce(new Error('stale'));
    await expect(h.resolver.resolve(request)).rejects.toMatchObject({
      code: 'EXTERNAL_CREDENTIAL_GRANTOR_DENIED'
    });
  });

  it('rejects arbitrary usage and unknown request material before owner access', async () => {
    const h = service();
    await expect(
      h.resolver.resolve({ ...request, approvedUsage: 'ARBITRARY_HEADER' } as never)
    ).rejects.toMatchObject({ code: 'INVALID_EXTERNAL_CREDENTIAL_RESOLUTION' });
    expect(h.repository.events).toHaveLength(0);
  });
});
